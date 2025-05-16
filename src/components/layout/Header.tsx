
import React from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { useUser } from '@/contexts/UserContext';
import { Separator } from '@/components/ui/separator';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { User, File, Settings, LogOut } from 'lucide-react';

const Header: React.FC = () => {
  const { user, logout, isAuthenticated, isPodLead, isAdmin } = useUser();
  const location = useLocation();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  if (!isAuthenticated) {
    return null;
  }

  return (
    <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
      <div className="container max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-8">
          <Link to="/" className="font-bold text-xl text-dashboard-blue flex items-center">
            <span>SWE-QA</span>
          </Link>

          {/* Navigation Links */}
          <nav className="hidden md:flex items-center space-x-4">
            <Link
              to="/discussions"
              className={`text-sm font-medium transition-colors hover:text-dashboard-blue ${
                location.pathname === '/discussions' ? 'text-dashboard-blue' : 'text-gray-600'
              }`}
            >
              Discussions
            </Link>

            <Link
              to="/dashboard"
              className={`text-sm font-medium transition-colors hover:text-dashboard-blue ${
                location.pathname === '/dashboard' ? 'text-dashboard-blue' : 'text-gray-600'
              }`}
            >
              Dashboard
            </Link>

            {/* Pod Lead and Admin Links */}
            {(isPodLead || isAdmin) && (
              <Link
                to="/admin"
                className={`text-sm font-medium transition-colors hover:text-dashboard-blue ${
                  location.pathname === '/admin' ? 'text-dashboard-blue' : 'text-gray-600'
                }`}
              >
                Admin Panel
              </Link>
            )}

            {/* API Documentation link */}
            <Link
              to="/api-docs"
              className={`text-sm font-medium transition-colors hover:text-dashboard-blue ${
                location.pathname === '/api-docs' ? 'text-dashboard-blue' : 'text-gray-600'
              }`}
            >
              API Docs
            </Link>
          </nav>
        </div>

        {/* User menu */}
        <div className="flex items-center">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="relative h-9 w-9 rounded-full">
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gray-100">
                  <User className="h-5 w-5 text-gray-600" />
                </div>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel>
                <div className="flex flex-col space-y-1">
                  <p className="text-sm font-medium leading-none">{user?.username}</p>
                  <p className="text-xs leading-none text-gray-500">
                    {user?.role === 'annotator' && 'Annotator'}
                    {user?.role === 'pod_lead' && 'Pod Lead'}
                    {user?.role === 'admin' && 'Administrator'}
                  </p>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => navigate('/discussions')}>
                <File className="mr-2 h-4 w-4" />
                <span>Discussions</span>
              </DropdownMenuItem>
              {(isPodLead || isAdmin) && (
                <DropdownMenuItem onClick={() => navigate('/admin')}>
                  <Settings className="mr-2 h-4 w-4" />
                  <span>Admin Panel</span>
                </DropdownMenuItem>
              )}
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleLogout}>
                <LogOut className="mr-2 h-4 w-4" />
                <span>Log out</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  );
};

export default Header;
