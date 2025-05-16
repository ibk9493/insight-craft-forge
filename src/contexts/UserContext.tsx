
import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { api } from '@/services/api';
import { UserRole } from '@/services/api/types';

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
  googleLogin: (googleToken: string) => Promise<boolean>;
  logout: () => void;
  isAuthenticated: boolean;
  isPodLead: boolean;
  isAdmin: boolean;
  setUserRole: (role: UserRole) => void;
  authorizedUsers: AuthorizedUser[];
  addAuthorizedUser: (email: string, role: UserRole) => void;
  removeAuthorizedUser: (email: string) => void;
}

const UserContext = createContext<UserContextType | undefined>(undefined);

export const useUser = () => {
  const context = useContext(UserContext);
  if (!context) {
    throw new Error('useUser must be used within a UserProvider');
  }
  return context;
};

// Mock users for demonstration - clear distinction between Pod Lead and Admin
const MOCK_USERS = [
  { id: '1', username: 'annotator1', password: 'password', role: 'annotator' as const },
  { id: '2', username: 'annotator2', password: 'password', role: 'annotator' as const },
  { id: '3', username: 'annotator3', password: 'password', role: 'annotator' as const },
  { id: '4', username: 'lead', password: 'password', role: 'pod_lead' as const },
  { id: '5', username: 'google.user@example.com', provider: 'google', role: 'annotator' as const },
  { id: '6', username: 'admin', password: 'admin123', role: 'admin' as const },
];

export const UserProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [authorizedUsers, setAuthorizedUsers] = useState<AuthorizedUser[]>([]);

  // Check if user is already logged in
  useEffect(() => {
    const storedUser = localStorage.getItem('user');
    if (storedUser) {
      try {
        const parsedUser = JSON.parse(storedUser);
        setUser(parsedUser);
      } catch (error) {
        localStorage.removeItem('user');
      }
    }
    
    // Load authorized users from localStorage
    const storedAuthorizedUsers = localStorage.getItem('authorizedUsers');
    if (storedAuthorizedUsers) {
      try {
        const parsedAuthorizedUsers = JSON.parse(storedAuthorizedUsers);
        setAuthorizedUsers(parsedAuthorizedUsers);
      } catch (error) {
        localStorage.removeItem('authorizedUsers');
      }
    }
  }, []);

  const login = (username: string, password: string) => {
    // In a real app, this would be an API call
    const foundUser = MOCK_USERS.find(
      (u) => u.username === username && u.password === password
    );
    
    if (foundUser) {
      const { password: _, ...userWithoutPassword } = foundUser;
      setUser({...userWithoutPassword, provider: 'local'});
      localStorage.setItem('user', JSON.stringify({...userWithoutPassword, provider: 'local'}));
      
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

  const googleLogin = async (googleToken: string): Promise<boolean> => {
    try {
      // In a real app, this would verify the token with your backend
      console.log("Google token received:", googleToken);
      
      // Simulate API call verification (in a real app, this would be a backend call)
      const response = await api.auth.verifyGoogleToken(googleToken);
      
      if (response.success) {
        // Extract email from Google response (mock for now)
        const email = 'google.user@example.com'; // In a real app, this would come from the Google response
        
        // Check if email is in authorized users
        const authorizedUser = authorizedUsers.find(u => u.email.toLowerCase() === email.toLowerCase());
        
        if (authorizedUser) {
          // Use the role assigned by admin
          const googleUser = {
            id: '5', // Generated ID in real app
            username: email,
            role: authorizedUser.role,
            provider: 'google' as const
          };
          
          setUser(googleUser);
          localStorage.setItem('user', JSON.stringify(googleUser));
          
          toast.success(`Logged in as ${googleUser.role === 'admin' ? 'Administrator' : googleUser.role === 'pod_lead' ? 'Pod Lead' : 'Annotator'}`);
          
          return true;
        } else {
          // If user not authorized, show role selector
          // Role will be confirmed but not saved until user selects a role
          const googleUser = {
            id: '5', // Generated ID in real app
            username: email,
            role: 'annotator' as const, // Default role
            provider: 'google' as const
          };
          
          setUser(googleUser);
          localStorage.setItem('user', JSON.stringify(googleUser));
          return true;
        }
      }
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
    localStorage.setItem('user', JSON.stringify(updatedUser));
    
    toast.success(`Role updated to ${role === 'admin' ? 'Administrator' : role === 'pod_lead' ? 'Pod Lead' : 'Annotator'}`);
  };

  const addAuthorizedUser = (email: string, role: UserRole) => {
    const newAuthorizedUsers = [...authorizedUsers, { email, role }];
    setAuthorizedUsers(newAuthorizedUsers);
    localStorage.setItem('authorizedUsers', JSON.stringify(newAuthorizedUsers));
  };
  
  const removeAuthorizedUser = (email: string) => {
    const newAuthorizedUsers = authorizedUsers.filter(user => user.email !== email);
    setAuthorizedUsers(newAuthorizedUsers);
    localStorage.setItem('authorizedUsers', JSON.stringify(newAuthorizedUsers));
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem('user');
    toast.info('Logged out successfully');
  };

  const value = {
    user,
    login,
    googleLogin,
    logout,
    setUserRole,
    isAuthenticated: !!user,
    isPodLead: user?.role === 'pod_lead',
    isAdmin: user?.role === 'admin',
    authorizedUsers,
    addAuthorizedUser,
    removeAuthorizedUser,
  };

  return <UserContext.Provider value={value}>{children}</UserContext.Provider>;
};
