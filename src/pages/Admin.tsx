
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Tab, TabList, TabPanel, TabsContainer } from '@/components/ui/tabs';
import { useUser } from '@/contexts/UserContext';
import Header from '@/components/layout/Header';
import JsonUploader from '@/components/admin/JsonUploader';
import TaskManager from '@/components/admin/TaskManager';
import { useAnnotationData } from '@/hooks/useAnnotationData';
import { Loader, Settings, Upload } from 'lucide-react';

const Admin = () => {
  const { isAuthenticated, isPodLead, isAdmin } = useUser();
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
    // For this demo, we're relying on the mock data update directly
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
            Manage discussions, tasks, and more
          </p>
        </div>
        
        <TabsContainer value={activeTab} onValueChange={setActiveTab} className="space-y-4">
          <TabList>
            <Tab value="task-management" className="flex items-center gap-2">
              <Settings className="h-4 w-4" />
              <span>Task Management</span>
            </Tab>
            {isAdmin && (
              <Tab value="upload-discussions" className="flex items-center gap-2">
                <Upload className="h-4 w-4" />
                <span>Upload Discussions</span>
              </Tab>
            )}
          </TabList>
          
          {/* Task Management Tab */}
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
          
          {/* Upload Discussions Tab (Admin Only) */}
          <TabPanel value="upload-discussions">
            <div className="mb-4">
              <h2 className="text-lg font-medium">Upload Discussions</h2>
              <p className="text-sm text-gray-500">
                Import discussions from JSON files
              </p>
            </div>
            
            <JsonUploader />
          </TabPanel>
        </TabsContainer>
      </div>
    </div>
  );
};

export default Admin;
