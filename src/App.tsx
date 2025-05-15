
import { useState, useEffect } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import Login from "./pages/Login";
import Discussions from "./pages/Discussions";
import Dashboard from "./pages/Dashboard";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => {
  // Use state for authentication status
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  
  // Check authentication status on load
  useEffect(() => {
    const user = localStorage.getItem('user');
    setIsLoggedIn(!!user);
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            <Route 
              path="/" 
              element={!isLoggedIn ? <Login onLoginSuccess={() => setIsLoggedIn(true)} /> : <Navigate to="/discussions" />} 
            />
            <Route 
              path="/discussions" 
              element={isLoggedIn ? <Discussions /> : <Navigate to="/" />} 
            />
            <Route 
              path="/dashboard" 
              element={isLoggedIn ? <Dashboard /> : <Navigate to="/" />} 
            />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  );
};

export default App;
