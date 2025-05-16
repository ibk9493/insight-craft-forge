
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from '@/components/ui/card';
import { toast } from 'sonner';
import { useUser } from '@/contexts/UserContext';
import { GoogleLogin } from '@react-oauth/google';
import { Separator } from "@/components/ui/separator";

const Login = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();
  const { login, googleLogin, isAuthenticated } = useUser();
  
  // Redirect if already logged in
  React.useEffect(() => {
    if (isAuthenticated) {
      navigate('/discussions');
    }
  }, [isAuthenticated, navigate]);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Simple validation
    if (!username || !password) {
      toast.error('Please enter both username and password');
      return;
    }
    
    setIsLoading(true);
    const success = login(username, password);
    setIsLoading(false);
    
    if (success) {
      toast.success('Login successful');
      navigate('/discussions');
    } else {
      toast.error('Invalid username or password');
    }
  };

  const handleGoogleSuccess = async (response: any) => {
    setIsLoading(true);
    const success = await googleLogin(response.credential);
    setIsLoading(false);
    
    if (success) {
      toast.success('Google login successful');
      navigate('/discussions');
    } else {
      toast.error('Google authentication failed');
    }
  };

  const handleGoogleError = () => {
    toast.error('Google login was cancelled or failed');
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl font-bold">SWE-QA Annotation Tool</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-2">
              <label htmlFor="username" className="text-sm font-medium">Username</label>
              <Input
                id="username"
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Enter your username"
                disabled={isLoading}
              />
            </div>
            <div className="space-y-2">
              <label htmlFor="password" className="text-sm font-medium">Password</label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter your password"
                disabled={isLoading}
              />
            </div>
            <Button 
              type="submit" 
              className="w-full bg-dashboard-blue hover:bg-blue-600"
              disabled={isLoading}
            >
              {isLoading ? 'Logging in...' : 'Login'}
            </Button>
          </form>
          
          <div className="mt-6 mb-6">
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <Separator />
              </div>
              <div className="relative flex justify-center">
                <span className="bg-white px-2 text-sm text-gray-500">
                  Or continue with
                </span>
              </div>
            </div>
          </div>
          
          <div className="flex justify-center">
            <GoogleLogin
              onSuccess={handleGoogleSuccess}
              onError={handleGoogleError}
              useOneTap
            />
          </div>
          
          <div className="mt-4 text-center text-sm text-gray-500">
            <p>Available test accounts:</p>
            <p>annotator1 / password</p>
            <p>annotator2 / password</p>
            <p>annotator3 / password</p>
            <p>lead / password</p>
            <p className="mt-2 font-semibold">Google login is also available</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default Login;
