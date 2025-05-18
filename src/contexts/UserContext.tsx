
import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { toast } from 'sonner';
import { api } from '@/services/api';
import { UserRole } from '@/services/api/types';
import { AUTH_CONFIG } from '@/config';

export interface User {
  id: string;
  username: string;
  role: UserRole;
  provider?: 'local' | 'google';
}

export interface AuthorizedUser {
  email: string;
  role: UserRole;
}

interface UserContextType {
  user: User | null;
  login: (username: string, password: string) => boolean;
  signup: (email: string, password: string) => Promise<boolean>;
  googleLogin: (googleToken: string) => Promise<boolean>;
  logout: () => void;
  isAuthenticated: boolean;
  isPodLead: boolean;
  isAdmin: boolean;
  setUserRole: (role: UserRole) => void;
  authorizedUsers: AuthorizedUser[];
  addAuthorizedUser: (email: string, role: UserRole) => Promise<void>;
  removeAuthorizedUser: (email: string) => Promise<void>;
  loadAuthorizedUsers: () => Promise<void>;
}

const UserContext = createContext<UserContextType | undefined>(undefined);

export const useUser = () => {
  const context = useContext(UserContext);
  if (!context) {
    throw new Error('useUser must be used within a UserProvider');
  }
  return context;
};

// Mock users for demonstration - Updated to include ibrahim.u@turing.com as admin
const MOCK_USERS = [
  { id: '1', username: 'annotator1', password: 'password', role: 'annotator' as UserRole },
  { id: '2', username: 'annotator2', password: 'password', role: 'annotator' as UserRole },
  { id: '3', username: 'annotator3', password: 'password', role: 'annotator' as UserRole },
  { id: '4', username: 'lead', password: 'password', role: 'pod_lead' as UserRole },
  { id: '5', username: 'google.user@example.com', provider: 'google', role: 'annotator' as UserRole },
  { id: '6', username: 'admin', password: 'admin123', role: 'admin' as UserRole },
  { id: '7', username: 'ibrahim.u@turing.com', password: 'admin123', role: 'admin' as UserRole },
];

export const UserProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [authorizedUsers, setAuthorizedUsers] = useState<AuthorizedUser[]>([]);

  // Check if user is already logged in and load authorized users
  useEffect(() => {
    const storedUser = localStorage.getItem(AUTH_CONFIG.STORAGE_KEYS.USER);
    if (storedUser) {
      try {
        const parsedUser = JSON.parse(storedUser);
        setUser(parsedUser);
      } catch (error) {
        localStorage.removeItem(AUTH_CONFIG.STORAGE_KEYS.USER);
      }
    }
    
    // Load authorized users
    loadAuthorizedUsers();
  }, []);
  
  // Load authorized users from API or localStorage
  const loadAuthorizedUsers = async () => {
    try {
      // Try to load from API first
      const apiUsers = await api.auth.getAuthorizedUsers();
      
      // Ensure we cast the roles to UserRole type
      const typedUsers: AuthorizedUser[] = apiUsers.map(user => ({
        email: user.email,
        role: user.role as UserRole
      }));
      
      setAuthorizedUsers(typedUsers);
      
      // Cache in localStorage for offline use
      localStorage.setItem(AUTH_CONFIG.STORAGE_KEYS.AUTHORIZED_USERS, JSON.stringify(typedUsers));
    } catch (error) {
      console.error('Failed to load authorized users from API', error);
      
      // Fall back to localStorage if API fails
      const storedAuthorizedUsers = localStorage.getItem(AUTH_CONFIG.STORAGE_KEYS.AUTHORIZED_USERS);
      if (storedAuthorizedUsers) {
        try {
          const parsedAuthorizedUsers = JSON.parse(storedAuthorizedUsers);
          setAuthorizedUsers(parsedAuthorizedUsers);
        } catch (error) {
          console.error('Failed to parse authorized users from localStorage', error);
          localStorage.removeItem(AUTH_CONFIG.STORAGE_KEYS.AUTHORIZED_USERS);
        }
      }
    }
  };

  const login = (username: string, password: string) => {
    // In a real app, this would be an API call
    const foundUser = MOCK_USERS.find(
      (u) => u.username === username && u.password === password
    );
    
    if (foundUser) {
      const { password: _, ...userWithoutPassword } = foundUser;
      setUser({...userWithoutPassword, provider: 'local'});
      localStorage.setItem(AUTH_CONFIG.STORAGE_KEYS.USER, JSON.stringify({...userWithoutPassword, provider: 'local'}));
      
      // Show toast based on user role
      if (userWithoutPassword.role === 'admin') {
        toast.success('Logged in as Administrator');
      } else if (userWithoutPassword.role === 'pod_lead') {
        toast.success('Logged in as Pod Lead');
      } else {
        toast.success('Logged in as Annotator');
      }
      
      return true;
    }
    
    return false;
  };

  const signup = async (email: string, password: string): Promise<boolean> => {
    try {
      // Check if email is in authorized users list
      const authorizedUser = authorizedUsers.find(
        user => user.email.toLowerCase() === email.toLowerCase()
      );
      
      if (!authorizedUser) {
        toast.error('Email not authorized for signup');
        return false;
      }
      
      // In a real app, this would be an API call to create a user
      const signupResult = await api.auth.signupUser(email, password);
      
      if (signupResult.success) {
        // Create new user object
        const newUser = {
          id: signupResult.userId || Date.now().toString(),
          username: email,
          role: authorizedUser.role,
          provider: 'local' as const
        };
        
        setUser(newUser);
        localStorage.setItem(AUTH_CONFIG.STORAGE_KEYS.USER, JSON.stringify(newUser));
        
        // Show toast based on user role
        if (authorizedUser.role === 'admin') {
          toast.success('Signed up as Administrator');
        } else if (authorizedUser.role === 'pod_lead') {
          toast.success('Signed up as Pod Lead');
        } else {
          toast.success('Signed up as Annotator');
        }
        
        return true;
      }
      
      return false;
    } catch (error) {
      console.error('Signup error:', error);
      toast.error('Failed to create account');
      return false;
    }
  };

  const googleLogin = async (googleToken: string): Promise<boolean> => {
    try {
      // Call the API to verify the Google token
      const response = await api.auth.verifyGoogleToken(googleToken);
      
      if (response.success) {
        const email = response.user.email;
        
        // Check if email is in authorized users
        const authorizedUser = authorizedUsers.find(u => u.email.toLowerCase() === email.toLowerCase());
        
        if (authorizedUser) {
          // Use the role assigned by admin
          const googleUser = {
            id: response.user.id,
            username: email,
            role: authorizedUser.role,
            provider: 'google' as const
          };
          
          setUser(googleUser);
          localStorage.setItem(AUTH_CONFIG.STORAGE_KEYS.USER, JSON.stringify(googleUser));
          
          toast.success(`Logged in as ${googleUser.role === 'admin' ? 'Administrator' : googleUser.role === 'pod_lead' ? 'Pod Lead' : 'Annotator'}`);
          
          return true;
        } else {
          toast.error('Email not authorized for login');
          return false;
        }
      }
      toast.error('Failed to authenticate with Google');
      return false;
    } catch (error) {
      console.error('Google login error:', error);
      toast.error('Failed to authenticate with Google');
      return false;
    }
  };

  const setUserRole = (role: UserRole) => {
    if (!user) return;
    
    const updatedUser = { ...user, role };
    setUser(updatedUser);
    localStorage.setItem(AUTH_CONFIG.STORAGE_KEYS.USER, JSON.stringify(updatedUser));
    
    toast.success(`Role updated to ${role === 'admin' ? 'Administrator' : role === 'pod_lead' ? 'Pod Lead' : 'Annotator'}`);
  };

  const addAuthorizedUser = async (email: string, role: UserRole) => {
    try {
      // Call API to add authorized user
      await api.auth.addAuthorizedUser(email, role);
      
      // Update local state
      const newAuthorizedUsers = [...authorizedUsers, { email, role }];
      setAuthorizedUsers(newAuthorizedUsers);
      
      // Update localStorage
      localStorage.setItem(AUTH_CONFIG.STORAGE_KEYS.AUTHORIZED_USERS, JSON.stringify(newAuthorizedUsers));
    } catch (error) {
      console.error('Failed to add authorized user', error);
      toast.error('Failed to add authorized user');
    }
  };
  
  const removeAuthorizedUser = async (email: string) => {
    try {
      // Call API to remove authorized user
      await api.auth.removeAuthorizedUser(email);
      
      // Update local state
      const newAuthorizedUsers = authorizedUsers.filter(user => user.email !== email);
      setAuthorizedUsers(newAuthorizedUsers);
      
      // Update localStorage
      localStorage.setItem(AUTH_CONFIG.STORAGE_KEYS.AUTHORIZED_USERS, JSON.stringify(newAuthorizedUsers));
    } catch (error) {
      console.error('Failed to remove authorized user', error);
      toast.error('Failed to remove authorized user');
    }
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem(AUTH_CONFIG.STORAGE_KEYS.USER);
    toast.info('Logged out successfully');
  };

  const value = {
    user,
    login,
    signup,
    googleLogin,
    logout,
    setUserRole,
    isAuthenticated: !!user,
    isPodLead: user?.role === 'pod_lead',
    isAdmin: user?.role === 'admin',
    authorizedUsers,
    addAuthorizedUser,
    removeAuthorizedUser,
    loadAuthorizedUsers
  };

  return <UserContext.Provider value={value}>{children}</UserContext.Provider>;
};
