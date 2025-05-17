
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader, BarChart, PieChart, Download } from 'lucide-react';
import { api } from '@/services/api';
import { SystemSummary } from '@/services/api/types';
import { toast } from 'sonner';
import { 
  Bar, 
  BarChart as RechartsBarChart, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend,
  ResponsiveContainer,
  PieChart as RechartsPieChart,
  Pie,
  Cell
} from 'recharts';

const SystemReports: React.FC = () => {
  const [isLoading, setIsLoading] = useState(true);
  const [isDownloading, setIsDownloading] = useState(false);
  const [systemData, setSystemData] = useState<SystemSummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  
  // Fetch system summary data
  useEffect(() => {
    const fetchSystemData = async () => {
      try {
        setIsLoading(true);
        const data = await api.summary.getSystemSummary();
        setSystemData(data);
      } catch (err) {
        console.error('Error fetching system data:', err);
        setError('Failed to load system statistics');
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchSystemData();
  }, []);
  
  const handleDownloadReport = async (format: 'csv' | 'json') => {
    try {
      setIsDownloading(true);
      const result = await api.summary.downloadReport(format);
      
      if (result.downloadUrl) {
        // In a real app, this would trigger a download
        window.open(result.downloadUrl, '_blank');
        toast.success(`${format.toUpperCase()} report downloaded successfully`);
      } else {
        toast.error('Failed to generate report');
      }
    } catch (err) {
      console.error('Error downloading report:', err);
      toast.error('Failed to download report');
    } finally {
      setIsDownloading(false);
    }
  };
  
  // Prepare chart data
  const taskCompletionData = systemData ? [
    { name: 'Task 1', completed: systemData.task1Completed },
    { name: 'Task 2', completed: systemData.task2Completed },
    { name: 'Task 3', completed: systemData.task3Completed },
  ] : [];
  
  const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042'];

  // Task distribution data for pie chart
  const taskDistributionData = systemData ? [
    { name: 'Task 1', value: systemData.task1Completed },
    { name: 'Task 2', value: systemData.task2Completed },
    { name: 'Task 3', value: systemData.task3Completed },
  ] : [];
  
  if (isLoading) {
    return (
      <Card className="w-full">
        <CardContent className="pt-6 flex flex-col items-center justify-center h-64">
          <Loader className="h-8 w-8 animate-spin text-dashboard-blue mb-4" />
          <p className="text-gray-500">Loading system statistics...</p>
        </CardContent>
      </Card>
    );
  }
  
  if (error) {
    return (
      <Card className="w-full">
        <CardContent className="pt-6">
          <div className="bg-red-50 p-4 rounded-md text-red-700 mb-4">
            {error}
          </div>
          <Button onClick={() => window.location.reload()}>Retry</Button>
        </CardContent>
      </Card>
    );
  }
  
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>System Overview</CardTitle>
          <CardDescription>Key metrics from the annotation system</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-dashboard-blue/10 rounded-lg p-4">
              <p className="text-sm font-medium text-dashboard-blue">Total Discussions</p>
              <p className="text-3xl font-bold">{systemData?.totalDiscussions || 0}</p>
            </div>
            <div className="bg-green-100 rounded-lg p-4">
              <p className="text-sm font-medium text-green-700">Total Annotations</p>
              <p className="text-3xl font-bold">{systemData?.totalAnnotations || 0}</p>
            </div>
            <div className="bg-purple-100 rounded-lg p-4">
              <p className="text-sm font-medium text-purple-700">Active Annotators</p>
              <p className="text-3xl font-bold">{systemData?.uniqueAnnotators || 0}</p>
            </div>
          </div>
        </CardContent>
      </Card>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Task Completion</CardTitle>
            <CardDescription>Number of completed tasks by type</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <RechartsBarChart
                  data={taskCompletionData}
                  margin={{
                    top: 5,
                    right: 30,
                    left: 20,
                    bottom: 5,
                  }}
                >
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="completed" fill="#8884d8" />
                </RechartsBarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader>
            <CardTitle>Task Distribution</CardTitle>
            <CardDescription>Proportion of tasks completed</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <RechartsPieChart>
                  <Pie
                    data={taskDistributionData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={80}
                    fill="#8884d8"
                    paddingAngle={5}
                    dataKey="value"
                    label
                  >
                    {taskDistributionData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </RechartsPieChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>
      
      <Card>
        <CardHeader>
          <CardTitle>Export Reports</CardTitle>
          <CardDescription>Download system data in various formats</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col sm:flex-row gap-4">
          <Button 
            onClick={() => handleDownloadReport('csv')}
            disabled={isDownloading}
            className="flex items-center gap-2"
          >
            <Download size={16} />
            <span>Export as CSV</span>
          </Button>
          <Button 
            onClick={() => handleDownloadReport('json')} 
            variant="outline"
            disabled={isDownloading}
            className="flex items-center gap-2"
          >
            <Download size={16} />
            <span>Export as JSON</span>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};

export default SystemReports;
