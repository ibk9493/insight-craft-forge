
import React from 'react';
import { Github, ChevronDown, LogOut, User, Home, Settings } from 'lucide-react';
import { useUser } from '@/contexts/UserContext';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Link, useLocation } from 'react-router-dom';

const Header = () => {
  const { user, logout, isAdmin, isPodLead } = useUser();
  const location = useLocation();
  
  // Helper to generate breadcrumbs based on current path
  const getBreadcrumbs = () => {
    const path = location.pathname;
    
    if (path === '/') return null;
    
    if (path === '/dashboard') {
      return <span className="text-sm text-gray-500">Dashboard</span>;
    }
    
    if (path === '/discussions') {
      return <span className="text-sm text-gray-500">Discussions</span>;
    }
    
    if (path === '/admin') {
      return <span className="text-sm text-gray-500">Admin</span>;
    }
    
    const queryParams = new URLSearchParams(location.search);
    const discussionId = queryParams.get('discussionId');
    const taskId = queryParams.get('task');
    
    if (path === '/dashboard' && discussionId) {
      if (taskId) {
        return (
          <div className="flex items-center text-sm text-gray-500">
            <Link to="/dashboard" className="hover:text-dashboard-blue">Dashboard</Link>
            <span className="mx-2">•</span>
            <Link to={`/dashboard?discussionId=${discussionId}`} className="hover:text-dashboard-blue">Tasks</Link>
            <span className="mx-2">•</span>
            <span>Task {taskId}</span>
          </div>
        );
      }
      
      return (
        <div className="flex items-center text-sm text-gray-500">
          <Link to="/dashboard" className="hover:text-dashboard-blue">Dashboard</Link>
          <span className="mx-2">•</span>
          <span>Tasks</span>
        </div>
      );
    }
    
    return null;
  };
  
  return (
    <header className="bg-white border-b border-gray-200 py-4 px-6 flex justify-between items-center">
      <div className="flex items-center space-x-6">
        <Link to="/" className="flex items-center hover:text-dashboard-blue transition-colors">
          <Github className="h-6 w-6 text-dashboard-blue mr-2" />
          <h1 className="text-xl font-semibold">GitHub Discussion Evaluator</h1>
        </Link>
        
        {getBreadcrumbs()}
      </div>
      <div className="flex items-center space-x-4">
        {user && (
          <div className="flex items-center space-x-4">
            <Link to="/dashboard" className="flex items-center text-dashboard-blue hover:underline">
              <Home className="h-4 w-4 mr-1" />
              <span>Dashboard</span>
            </Link>
            <Link to="/discussions" className="text-dashboard-blue hover:underline">
              All Discussions
            </Link>
            {(isAdmin || isPodLead) && (
              <Link to="/admin" className="flex items-center text-dashboard-blue hover:underline">
                <Settings className="h-4 w-4 mr-1" />
                <span>Admin</span>
              </Link>
            )}
          </div>
        )}
        
        <span className="text-sm text-gray-500 ml-4">Dashboard v1.0</span>
        
        {user && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="flex items-center gap-2">
                <Avatar className="h-8 w-8">
                  <AvatarFallback className="bg-dashboard-blue text-white">
                    {user.username.substring(0, 2).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <span>{user.username}</span>
                <ChevronDown className="h-4 w-4 opacity-50" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel>My Account</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem className="flex items-center gap-2">
                <User className="h-4 w-4" />
                <span>Role: {user.role === 'pod_lead' ? 'Pod Lead' : user.role === 'admin' ? 'Administrator' : 'Annotator'}</span>
              </DropdownMenuItem>
              {(isAdmin || isPodLead) && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem asChild>
                    <Link to="/admin" className="flex items-center gap-2 cursor-pointer">
                      <Settings className="h-4 w-4" />
                      <span>Admin Panel</span>
                    </Link>
                  </DropdownMenuItem>
                </>
              )}
              <DropdownMenuSeparator />
              <DropdownMenuItem 
                onClick={logout}
                className="text-red-600 cursor-pointer flex items-center gap-2"
              >
                <LogOut className="h-4 w-4" />
                <span>Logout</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>
    </header>
  );
};

export default Header;
