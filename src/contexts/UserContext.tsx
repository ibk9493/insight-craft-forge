
import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { api } from '@/services/api';

export interface User {
  id: string;
  username: string;
  role: 'annotator' | 'pod_lead';
  provider?: 'local' | 'google';
}

interface UserContextType {
  user: User | null;
  login: (username: string, password: string) => boolean;
  googleLogin: (googleToken: string) => Promise<boolean>;
  logout: () => void;
  isAuthenticated: boolean;
  isPodLead: boolean;
}

const UserContext = createContext<UserContextType | undefined>(undefined);

export const useUser = () => {
  const context = useContext(UserContext);
  if (!context) {
    throw new Error('useUser must be used within a UserProvider');
  }
  return context;
};

// Mock users for demonstration
const MOCK_USERS = [
  { id: '1', username: 'annotator1', password: 'password', role: 'annotator' as const },
  { id: '2', username: 'annotator2', password: 'password', role: 'annotator' as const },
  { id: '3', username: 'annotator3', password: 'password', role: 'annotator' as const },
  { id: '4', username: 'lead', password: 'password', role: 'pod_lead' as const },
  // Mock Google user
  { id: '5', username: 'google.user@example.com', provider: 'google', role: 'annotator' as const },
];

export const UserProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);

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
      return true;
    }
    
    return false;
  };

  const googleLogin = async (googleToken: string): Promise<boolean> => {
    try {
      // In a real app, this would verify the token with your backend
      // For demo purposes, we'll simulate a successful verification
      console.log("Google token received:", googleToken);
      
      // Simulate API call verification (in a real app, this would be a backend call)
      const response = await api.auth.verifyGoogleToken(googleToken);
      
      if (response.success) {
        // Find mock Google user (in a real app, this would come from the backend)
        const mockGoogleUser = MOCK_USERS.find(u => u.provider === 'google');
        
        if (mockGoogleUser) {
          setUser({
            id: mockGoogleUser.id,
            username: mockGoogleUser.username,
            role: mockGoogleUser.role,
            provider: 'google'
          });
          
          localStorage.setItem('user', JSON.stringify({
            id: mockGoogleUser.id,
            username: mockGoogleUser.username,
            role: mockGoogleUser.role,
            provider: 'google'
          }));
          
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

  const logout = () => {
    setUser(null);
    localStorage.removeItem('user');
  };

  const value = {
    user,
    login,
    googleLogin,
    logout,
    isAuthenticated: !!user,
    isPodLead: user?.role === 'pod_lead',
  };

  return <UserContext.Provider value={value}>{children}</UserContext.Provider>;
};
