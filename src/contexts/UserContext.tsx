import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { toast } from 'sonner';
import { api } from '@/services/api';
import { UserRole } from '@/services/api/types';
import { AUTH_CONFIG } from '@/config';

// Define the User interface
export interface User {
  id: string;
  username: string;
  role: UserRole;
  provider?: 'local' | 'google';
  token?: string;
  password?: string;
}

// Define the mock users data
export const MOCK_USERS_DATA: User[] = [
  { id: '1', username: 'user1@example.com', role: 'annotator', password: 'password123' },
  { id: '2', username: 'user2@example.com', role: 'pod_lead', password: 'password456' },
  { id: '3', username: 'admin@example.com', role: 'admin', password: 'adminpassword' },
  { id: '4', username: 'podlead@example.com', role: 'pod_lead', password: 'podleadpassword' },
];

// Define the AuthorizedUser interface
export interface AuthorizedUser {
  email: string;
  role: UserRole;
}

// Define the UserContext type
interface UserContextType {
  user: User | null;
  login: (username: string, password: string) => Promise<boolean>;
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

// Create the context
const UserContext = createContext<UserContextType | undefined>(undefined);

// Create a hook to use the context
export const useUser = () => {
  const context = useContext(UserContext);
  if (!context) {
    throw new Error('useUser must be used within a UserProvider');
  }
  return context;
};

// Create the UserProvider component
export const UserProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [authorizedUsers, setAuthorizedUsers] = useState<AuthorizedUser[]>([]);

  // Check if user is already logged in and load authorized users on mount
  useEffect(() => {
    // Load user from localStorage
    const storedUser = localStorage.getItem(AUTH_CONFIG.STORAGE_KEYS.USER);
    if (storedUser) {
      try {
        const parsedUser = JSON.parse(storedUser);
        setUser(parsedUser);
        
        // Verify the stored token with the server
        verifyToken(parsedUser);
      } catch (error) {
        localStorage.removeItem(AUTH_CONFIG.STORAGE_KEYS.USER);
      }
    }
    
    // Load authorized users
    loadAuthorizedUsers();
  }, []);
  
  // Verify token with the server
  const verifyToken = async (userWithToken: User) => {
    try {
      // Use the API helper for token verification
      const response = await api.auth.getMe();
      
      if (!response.authenticated) {
        // Token is invalid, logout the user
        logout();
      }
    } catch (error) {
      console.error('Error verifying token:', error);
      // Don't logout on network errors to allow offline usage
    }
  };
  
  // Load authorized users from API
  const loadAuthorizedUsers = async () => {
    try {
      // Use the API helper to get authorized users
      const apiUsers = await api.auth.getAuthorizedUsers();
      
      // Ensure we cast the roles to UserRole type
      const typedUsers: AuthorizedUser[] = apiUsers.map((user) => ({
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

  // Login function using the API helper
  const login = async (email: string, password: string): Promise<boolean> => {
    try {
      console.log('[Auth] Attempting API login for:', email);
      const response = await api.auth.login(email, password);

      if (response.success) {
        const loggedInUser: User = {
          id: response.user.id || response.user.username,
          username: response.user.username,
          role: response.user.role as UserRole,
          provider: response.user.provider || 'local',
          token: response.token,
        };
        setUser(loggedInUser);
        localStorage.setItem(AUTH_CONFIG.STORAGE_KEYS.USER, JSON.stringify(loggedInUser));
        toast.success(`Logged in as ${loggedInUser.role}`);
        return true;
      } else {
        // API login failed, try mock data
        console.log('[Auth] API login failed, trying mock data for:', email);
        const mockUser = MOCK_USERS_DATA.find(
          (u) => u.username === email && u.password === password
        );

        if (mockUser) {
          console.log('[Auth] Mock login successful for:', email);
          const loggedInUser: User = {
            id: mockUser.id,
            username: mockUser.username,
            role: mockUser.role,
            provider: 'local', // Assuming mock users are local
            // No token for mock users, or generate a mock one if needed
          };
          setUser(loggedInUser);
          localStorage.setItem(AUTH_CONFIG.STORAGE_KEYS.USER, JSON.stringify(loggedInUser));
          toast.success(`Logged in as ${loggedInUser.role} (Mock Data)`);
          return true;
        }

        toast.error(response.user?.message || 'Login failed from API and Mock Data');
        return false;
      }
    } catch (error) {
      console.error('[Auth] API Login error, trying mock data:', error);
      // API login failed due to error, try mock data
      const mockUser = MOCK_USERS_DATA.find(
        (u) => u.username === email && u.password === password
      );

      if (mockUser) {
        console.log('[Auth] Mock login successful after API error for:', email);
        const loggedInUser: User = {
          id: mockUser.id,
          username: mockUser.username,
          role: mockUser.role,
          provider: 'local',
        };
        setUser(loggedInUser);
        localStorage.setItem(AUTH_CONFIG.STORAGE_KEYS.USER, JSON.stringify(loggedInUser));
        toast.success(`Logged in as ${loggedInUser.role} (Mock Data)`);
        return true;
      }

      toast.error('Login failed. Please try again.');
      return false;
    }
  };

  // Signup function using the API helper
  const signup = async (email: string, password: string): Promise<boolean> => {
    try {
      // Use the API helper for signup
      const response = await api.auth.signupUser(email, password);
      
      if (response.success) {
        // Create user object with token
        const newUser: User = {
          id: response.user.id || response.user.username,
          username: response.user.username,
          role: response.user.role as UserRole,
          provider: response.user.provider || 'local',
          token: response.token
        };
        
        // Save user to state and localStorage
        setUser(newUser);
        localStorage.setItem(AUTH_CONFIG.STORAGE_KEYS.USER, JSON.stringify(newUser));
        
        // Show toast based on user role
        if (newUser.role === 'admin') {
          toast.success('Signed up as Administrator');
        } else if (newUser.role === 'pod_lead') {
          toast.success('Signed up as Pod Lead');
        } else {
          toast.success('Signed up as Annotator');
        }
        
        return true;
      } else {
        toast.error(response.user?.message || 'Signup failed');
        return false;
      }
    } catch (error) {
      console.error('Signup error:', error);
      toast.error('Failed to create account');
      return false;
    }
  };

  // Google login function using the API helper
  const googleLogin = async (googleToken: string): Promise<boolean> => {
    try {
      // Use the API helper for Google login
      const response = await api.auth.verifyGoogleToken(googleToken);
      
      if (response.success) {
        // Create user object with token
        const googleUser: User = {
          id: response.user.id || response.user.username,
          username: response.user.username,
          role: response.user.role as UserRole,
          provider: 'google',
          token: response.token
        };
        
        // Save user to state and localStorage
        setUser(googleUser);
        localStorage.setItem(AUTH_CONFIG.STORAGE_KEYS.USER, JSON.stringify(googleUser));
        
        // Show toast based on user role
        if (googleUser.role === 'admin') {
          toast.success('Logged in as Administrator');
        } else if (googleUser.role === 'pod_lead') {
          toast.success('Logged in as Pod Lead');
        } else {
          toast.success('Logged in as Annotator');
        }
        
        return true;
      } else {
        toast.error(response.user?.message || 'Google login failed');
        return false;
      }
    } catch (error) {
      console.error('Google login error:', error);
      toast.error('Failed to authenticate with Google');
      return false;
    }
  };

  // Function to update user role
  const setUserRole = (role: UserRole) => {
    if (!user) return;
    
    const updatedUser = { ...user, role };
    setUser(updatedUser);
    localStorage.setItem(AUTH_CONFIG.STORAGE_KEYS.USER, JSON.stringify(updatedUser));
    
    toast.success(`Role updated to ${role === 'admin' ? 'Administrator' : role === 'pod_lead' ? 'Pod Lead' : 'Annotator'}`);
  };

  // Function to add an authorized user using the API helper
  const addAuthorizedUser = async (email: string, role: UserRole) => {
    try {
      // Use the API helper to add an authorized user
      const newUser = await api.auth.addAuthorizedUser(email, role);
      
      // Update local state
      const newAuthorizedUsers = [...authorizedUsers, { email: newUser.email, role: newUser.role as UserRole }];
      setAuthorizedUsers(newAuthorizedUsers);
      
      // Update localStorage
      localStorage.setItem(AUTH_CONFIG.STORAGE_KEYS.AUTHORIZED_USERS, JSON.stringify(newAuthorizedUsers));
      
      toast.success(`Added ${email} as ${role === 'admin' ? 'Administrator' : role === 'pod_lead' ? 'Pod Lead' : 'Annotator'}`);
    } catch (error) {
      console.error('Failed to add authorized user', error);
      toast.error('Failed to add authorized user');
    }
  };
  
  // Function to remove an authorized user using the API helper
  const removeAuthorizedUser = async (email: string) => {
    try {
      // Use the API helper to remove an authorized user
      await api.auth.removeAuthorizedUser(email);
      
      // Update local state
      const newAuthorizedUsers = authorizedUsers.filter(user => user.email !== email);
      setAuthorizedUsers(newAuthorizedUsers);
      
      // Update localStorage
      localStorage.setItem(AUTH_CONFIG.STORAGE_KEYS.AUTHORIZED_USERS, JSON.stringify(newAuthorizedUsers));
      
      toast.success(`Removed ${email} from authorized users`);
    } catch (error) {
      console.error('Failed to remove authorized user', error);
      toast.error('Failed to remove authorized user');
    }
  };

  // Logout function
  const logout = () => {
    setUser(null);
    localStorage.removeItem(AUTH_CONFIG.STORAGE_KEYS.USER);
    toast.info('Logged out successfully');
  };

  // Create the context value
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