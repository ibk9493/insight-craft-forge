
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Tab, TabList, TabPanel, TabsContainer } from '@/components/ui/tabs';
import { useUser } from '@/contexts/UserContext';
import Header from '@/components/layout/Header';
import JsonUploader from '@/components/admin/JsonUploader';
import TaskManager from '@/components/admin/TaskManager';
import SystemReports from '@/components/admin/SystemReports';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"; 
import { useAnnotationData } from '@/hooks/useAnnotationData';
import { Loader, Settings, Upload, Users, FileText } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import UserAccessManager from '@/components/admin/UserAccessManager';

const Admin = () => {
  const { isAuthenticated, isPodLead, isAdmin, user } = useUser();
  const navigate = useNavigate();
  const { discussions, loading, error } = useAnnotationData();
  const [activeTab, setActiveTab] = useState("task-management");
  
  // Redirect if not authenticated or not admin/pod lead
  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/');
      return;
    }
    
    if (!isPodLead && !isAdmin) {
      navigate('/dashboard');
      return;
    }
  }, [isAuthenticated, isPodLead, isAdmin, navigate]);
  
  const handleDiscussionUpdated = (updatedDiscussion: any) => {
    console.log('Discussion updated:', updatedDiscussion);
    // In a real app, we would refresh the discussions list
  };
  
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col">
        <Header />
        <div className="container max-w-6xl mx-auto px-4 py-6 flex-grow flex flex-col items-center justify-center">
          <Loader className="h-8 w-8 animate-spin text-dashboard-blue" />
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }
  
  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col">
        <Header />
        <div className="container max-w-6xl mx-auto px-4 py-6 flex-grow">
          <div className="bg-red-50 border border-red-200 p-4 rounded-md text-red-800">
            <h3 className="font-bold text-lg">Error</h3>
            <p>{error}</p>
          </div>
        </div>
      </div>
    );
  }
  
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <Header />
      
      <div className="container max-w-6xl mx-auto px-4 py-6 flex-grow">
        <div className="mb-6">
          <h1 className="text-2xl font-bold">Admin Panel</h1>
          <p className="text-sm text-gray-500">
            {isAdmin ? 'Full administrative access to manage discussions, tasks, and more' : 'Pod Lead access to manage tasks and annotation workflows'}
          </p>
          
          {/* Role indicator */}
          <div className="mt-2">
            <Alert>
              <div className="flex items-center gap-2">
                {isAdmin ? 
                  <Settings className="h-4 w-4" /> : 
                  <Users className="h-4 w-4" />
                }
                <AlertTitle>
                  {isAdmin ? 'Administrator Access' : 'Pod Lead Access'}
                </AlertTitle>
              </div>
              <AlertDescription>
                {isAdmin 
                  ? 'You have full access to all administrative features, including batch uploads, task management, and system settings.' 
                  : 'You can manage tasks, create consensus annotations, and oversee the annotation workflow.'
                }
              </AlertDescription>
            </Alert>
          </div>
        </div>
        
        <TabsContainer value={activeTab} onValueChange={setActiveTab} className="space-y-4">
          <TabList>
            <Tab value="task-management" className="flex items-center gap-2">
              <Settings className="h-4 w-4" />
              <span>Task Management</span>
            </Tab>
            {isPodLead && (
              <Tab value="consensus-review" className="flex items-center gap-2">
                <Users className="h-4 w-4" />
                <span>Consensus Review</span>
              </Tab>
            )}
            {isAdmin && (
              <>
                <Tab value="upload-discussions" className="flex items-center gap-2">
                  <Upload className="h-4 w-4" />
                  <span>Upload Discussions</span>
                </Tab>
                <Tab value="user-management" className="flex items-center gap-2">
                  <Users className="h-4 w-4" />
                  <span>User Management</span>
                </Tab>
                <Tab value="system-reports" className="flex items-center gap-2">
                  <FileText className="h-4 w-4" />
                  <span>System Reports</span>
                </Tab>
              </>
            )}
          </TabList>
          
          {/* Task Management Tab - Available to both Pod Lead and Admin */}
          <TabPanel value="task-management">
            <div className="mb-4">
              <h2 className="text-lg font-medium">Task Management</h2>
              <p className="text-sm text-gray-500">
                Update task statuses and manage the annotation workflow
              </p>
            </div>
            
            <TaskManager 
              discussions={discussions} 
              onTaskUpdated={handleDiscussionUpdated}
            />
          </TabPanel>
          
          {/* Consensus Review Tab - Available to Pod Lead */}
          {isPodLead && (
            <TabPanel value="consensus-review">
              <div className="mb-4">
                <h2 className="text-lg font-medium">Consensus Review</h2>
                <p className="text-sm text-gray-500">
                  Review and finalize consensus annotations
                </p>
              </div>
              
              <Card>
                <CardHeader>
                  <CardTitle>Consensus Dashboard</CardTitle>
                  <CardDescription>
                    Review annotation agreement and create consensus
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="text-center py-6">
                    <p className="text-gray-500">Select a discussion from the dashboard to review consensus</p>
                    <Button 
                      className="mt-4" 
                      onClick={() => navigate('/dashboard')}
                    >
                      Go to Dashboard
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </TabPanel>
          )}
          
          {/* Upload Discussions Tab - Admin Only */}
          {isAdmin && (
            <>
              <TabPanel value="upload-discussions">
                <div className="mb-4">
                  <h2 className="text-lg font-medium">Upload Discussions</h2>
                  <p className="text-sm text-gray-500">
                    Import discussions from JSON files
                  </p>
                </div>
                <JsonUploader />
              </TabPanel>

              {/* User Management Tab - Admin Only */}
              <TabPanel value="user-management">
                <div className="mb-4">
                  <h2 className="text-lg font-medium">User Management</h2>
                  <p className="text-sm text-gray-500">
                    Manage which email addresses can log in via Google and their roles
                  </p>
                </div>
                <UserAccessManager />
              </TabPanel>
              
              {/* System Reports Tab - Admin Only */}
              <TabPanel value="system-reports">
                <div className="mb-4">
                  <h2 className="text-lg font-medium">System Reports</h2>
                  <p className="text-sm text-gray-500">
                    View system statistics and generate reports
                  </p>
                </div>
                <SystemReports />
              </TabPanel>
            </>
          )}
        </TabsContainer>
      </div>
    </div>
  );
};

export default Admin;
