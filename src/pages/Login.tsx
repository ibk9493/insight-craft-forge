
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs-wrapper';
import { toast } from 'sonner';
import { GoogleLogin } from '@react-oauth/google';
import { useUser } from '@/contexts/UserContext';

const Login: React.FC = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  
  const { login, googleLogin, isAuthenticated } = useUser();
  const navigate = useNavigate();

  // Redirect if already logged in
  useEffect(() => {
    if (isAuthenticated) {
      navigate('/discussions');
    }
  }, [isAuthenticated, navigate]);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    
    if (!username || !password) {
      toast.error('Please enter both username and password');
      setIsLoading(false);
      return;
    }
    
    const success = login(username, password);
    
    if (!success) {
      toast.error('Invalid username or password');
    } else {
      // Successful login is handled by the useEffect above
    }
    
    setIsLoading(false);
  };
  
  const handleGoogleLoginSuccess = async (credentialResponse: any) => {
    setIsLoading(true);
    try {
      const success = await googleLogin(credentialResponse.credential);
      if (!success) {
        toast.error('Google login failed');
      }
    } catch (error) {
      console.error('Error with Google login', error);
      toast.error('Error authenticating with Google');
    } finally {
      setIsLoading(false);
    }
  };
  
  const handleGoogleLoginError = () => {
    toast.error('Google login failed');
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md space-y-8">
        <div className="text-center">
          <h1 className="text-3xl font-bold text-dashboard-blue">SWE-QA Annotation System</h1>
          <p className="mt-2 text-gray-600">Software Engineering Question Answering Dataset Annotation</p>
        </div>
        
        <Card>
          <CardHeader>
            <CardTitle>Sign In</CardTitle>
            <CardDescription>
              Sign in to start annotating software engineering discussions
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="credentials" className="w-full">
              <TabsList className="grid w-full grid-cols-2 mb-6">
                <TabsTrigger value="credentials">Credentials</TabsTrigger>
                <TabsTrigger value="google">Google</TabsTrigger>
              </TabsList>
              
              <TabsContent value="credentials">
                <form onSubmit={handleLogin} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="username">Username</Label>
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
                    <Label htmlFor="password">Password</Label>
                    <Input
                      id="password"
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Enter your password"
                      disabled={isLoading}
                    />
                  </div>
                  
                  <Button type="submit" className="w-full" disabled={isLoading}>
                    {isLoading ? 'Signing in...' : 'Sign In'}
                  </Button>
                  
                  <div className="text-xs text-gray-500 mt-4">
                    <p className="mb-1">Demo accounts:</p>
                    <p>- Annotator: annotator1 / password</p>
                    <p>- Pod Lead: lead / password</p>
                    <p>- Admin: admin / admin123</p>
                  </div>
                </form>
              </TabsContent>
              
              <TabsContent value="google">
                <div className="space-y-4">
                  <div className="text-center">
                    <p className="text-sm text-gray-500 mb-4">
                      Continue with your Google account
                    </p>
                    <div className="flex justify-center">
                      <GoogleLogin
                        onSuccess={handleGoogleLoginSuccess}
                        onError={handleGoogleLoginError}
                        useOneTap
                      />
                    </div>
                  </div>
                </div>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
        
        <div className="text-center text-sm text-gray-500">
          <p>
            API documentation is available after login <a href="/api-docs" className="underline hover:text-dashboard-blue">here</a>
          </p>
        </div>
      </div>
    </div>
  );
};

export default Login;
