
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { useEffect, useState } from "react";
import Login from "./pages/Login";
import Discussions from "./pages/Discussions";
import Dashboard from "./pages/Dashboard";
import Admin from "./pages/Admin";
import ApiDocs from "./pages/ApiDocs";
import NotFound from "./pages/NotFound";
import { UserProvider } from "./contexts/UserContext";
import { Provider } from 'react-redux';
import { store } from './store/store';
import { GoogleOAuthProvider } from '@react-oauth/google';

function App() {
  // Create a client once per component render
  // This ensures the QueryClient isn't created during module initialization
  const [queryClient] = useState(() => new QueryClient({
    defaultOptions: {
      queries: {
        retry: 1,
        staleTime: 30000,
      },
    },
  }));

  const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID || '';

  return (
    <GoogleOAuthProvider clientId={clientId}>
      <Provider store={store}>
        <QueryClientProvider client={queryClient}>
          <UserProvider>
            <TooltipProvider>
              <BrowserRouter>
                <Routes>
                  <Route path="/" element={<Login />} />
                  <Route path="/discussions" element={<Discussions />} />
                  <Route path="/dashboard" element={<Dashboard />} />
                  <Route path="/admin" element={<Admin />} />
                  <Route path="/api-docs" element={<ApiDocs />} />
                  <Route path="*" element={<NotFound />} />
                </Routes>
                <Toaster />
                <Sonner />
              </BrowserRouter>
            </TooltipProvider>
          </UserProvider>
        </QueryClientProvider>
      </Provider>
    </GoogleOAuthProvider>
  );
}

export default App;
