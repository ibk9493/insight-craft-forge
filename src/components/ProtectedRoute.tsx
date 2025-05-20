import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';

interface ProtectedRouteProps {
  redirectPath?: string;
}

// Route that requires authentication
export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ 
  redirectPath = '/' 
}) => {
  const { isAuthenticated } = useAuth();
  
  if (!isAuthenticated) {
    return <Navigate to={redirectPath} replace />;
  }
  
  return <Outlet />;
};

// Route that should only be accessible when NOT authenticated
export const PublicOnlyRoute: React.FC<ProtectedRouteProps> = ({ 
  redirectPath = '/discussions' 
}) => {
  const { isAuthenticated } = useAuth();
  
  if (isAuthenticated) {
    return <Navigate to={redirectPath} replace />;
  }
  
  return <Outlet />;
};