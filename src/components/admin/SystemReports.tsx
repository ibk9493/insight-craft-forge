
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader, BarChart, PieChart, Download, User, AlertCircle, Clock, CheckSquare } from 'lucide-react';
import { api } from '@/services/api';
import { SystemSummary, TrainerBreakdown } from '@/services/api/types';
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs-wrapper';

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
        console.log("Received system data:", data);
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
  
  const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8'];

  // Task distribution data for pie chart
  const taskDistributionData = systemData ? [
    { name: 'Task 1', value: systemData.task1Completed },
    { name: 'Task 2', value: systemData.task2Completed },
    { name: 'Task 3', value: systemData.task3Completed },
  ] : [];

  // Task progression data
  const taskProgressionData = systemData?.taskProgression ? [
    { name: 'Stuck in Task 1', value: systemData.taskProgression.stuck_in_task1 },
    { name: 'Stuck in Task 2', value: systemData.taskProgression.stuck_in_task2 },
    { name: 'Reached Task 3', value: systemData.taskProgression.reached_task3 },
    { name: 'Fully Completed', value: systemData.taskProgression.fully_completed },
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
      
      <Tabs defaultValue="completion">
        <TabsList className="mb-4">
          <TabsTrigger value="completion">Task Completion</TabsTrigger>
          <TabsTrigger value="progression">Task Progression</TabsTrigger>
          <TabsTrigger value="trainers">Trainer Breakdown</TabsTrigger>
        </TabsList>
        
        <TabsContent value="completion">
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
        </TabsContent>
        
        <TabsContent value="progression">
          <Card>
            <CardHeader>
              <CardTitle>Task Progression Status</CardTitle>
              <CardDescription>Number of discussions at each stage of the workflow</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                <div className="bg-yellow-100 rounded-lg p-4 flex items-center justify-between">
                  <div>
                    <div className="flex items-center space-x-2">
                      <AlertCircle className="h-5 w-5 text-yellow-600" />
                      <p className="text-sm font-medium text-yellow-600">Stuck in Task 1</p>
                    </div>
                    <p className="text-2xl font-bold mt-1">{systemData?.taskProgression?.stuck_in_task1 || 0}</p>
                  </div>
                  <div className="text-sm text-yellow-700">
                    Awaiting consensus
                  </div>
                </div>
                
                <div className="bg-orange-100 rounded-lg p-4 flex items-center justify-between">
                  <div>
                    <div className="flex items-center space-x-2">
                      <Clock className="h-5 w-5 text-orange-600" />
                      <p className="text-sm font-medium text-orange-600">Stuck in Task 2</p>
                    </div>
                    <p className="text-2xl font-bold mt-1">{systemData?.taskProgression?.stuck_in_task2 || 0}</p>
                  </div>
                  <div className="text-sm text-orange-700">
                    Passed Task 1, awaiting Task 2 completion
                  </div>
                </div>
                
                <div className="bg-blue-100 rounded-lg p-4 flex items-center justify-between">
                  <div>
                    <div className="flex items-center space-x-2">
                      <CheckSquare className="h-5 w-5 text-blue-600" />
                      <p className="text-sm font-medium text-blue-600">Reached Task 3</p>
                    </div>
                    <p className="text-2xl font-bold mt-1">{systemData?.taskProgression?.reached_task3 || 0}</p>
                  </div>
                  <div className="text-sm text-blue-700">
                    In Task 3 or beyond
                  </div>
                </div>
                
                <div className="bg-green-100 rounded-lg p-4 flex items-center justify-between">
                  <div>
                    <div className="flex items-center space-x-2">
                      <CheckSquare className="h-5 w-5 text-green-600" />
                      <p className="text-sm font-medium text-green-600">Fully Completed</p>
                    </div>
                    <p className="text-2xl font-bold mt-1">{systemData?.taskProgression?.fully_completed || 0}</p>
                  </div>
                  <div className="text-sm text-green-700">
                    All 3 tasks completed
                  </div>
                </div>
              </div>
              
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <RechartsBarChart
                    data={taskProgressionData}
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
                    <Bar dataKey="value" fill="#8884d8">
                      {taskProgressionData.map((entry, index) => (
                        <Cell 
                          key={`cell-${index}`} 
                          fill={['#EAB308', '#F97316', '#3B82F6', '#22C55E'][index % 4]} 
                        />
                      ))}
                    </Bar>
                  </RechartsBarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="trainers">
          <Card>
            <CardHeader>
              <CardTitle>Trainer Productivity Breakdown</CardTitle>
              <CardDescription>Task completion metrics by individual trainers</CardDescription>
            </CardHeader>
            <CardContent>
              {systemData?.trainerBreakdown && systemData.trainerBreakdown.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse">
                    <thead>
                      <tr className="bg-gray-50 border-b">
                        <th className="py-2 px-3 text-left text-sm font-medium text-gray-500">Trainer ID</th>
                        <th className="py-2 px-3 text-left text-sm font-medium text-gray-500">Total</th>
                        <th className="py-2 px-3 text-left text-sm font-medium text-gray-500">Task 1</th>
                        <th className="py-2 px-3 text-left text-sm font-medium text-gray-500">Task 2</th>
                        <th className="py-2 px-3 text-left text-sm font-medium text-gray-500">Task 3</th>
                      </tr>
                    </thead>
                    <tbody>
                      {systemData.trainerBreakdown.map((trainer: TrainerBreakdown, index: number) => (
                        <tr key={index} className={`${index % 2 === 0 ? 'bg-white' : 'bg-gray-50'} border-b`}>
                          <td className="py-2 px-3 text-sm">
                            <div className="flex items-center space-x-2">
                              <User className="h-4 w-4 text-gray-400" />
                              <span>{trainer.trainer_id}</span>
                            </div>
                          </td>
                          <td className="py-2 px-3 text-sm font-medium">{trainer.total_annotations}</td>
                          <td className="py-2 px-3 text-sm">{trainer.task1_count}</td>
                          <td className="py-2 px-3 text-sm">{trainer.task2_count}</td>
                          <td className="py-2 px-3 text-sm">{trainer.task3_count}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="text-center py-6 text-gray-500">
                  <p>No trainer data available</p>
                </div>
              )}
              
              {systemData?.trainerBreakdown && systemData.trainerBreakdown.length > 0 && (
                <div className="h-64 mt-6">
                  <ResponsiveContainer width="100%" height="100%">
                    <RechartsBarChart
                      data={systemData.trainerBreakdown.map(trainer => ({
                        name: trainer.trainer_id,
                        task1: trainer.task1_count,
                        task2: trainer.task2_count,
                        task3: trainer.task3_count
                      }))}
                      margin={{
                        top: 5,
                        right: 30,
                        left: 20,
                        bottom: 20,
                      }}
                    >
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="name" />
                      <YAxis />
                      <Tooltip />
                      <Legend />
                      <Bar dataKey="task1" name="Task 1" stackId="a" fill="#8884d8" />
                      <Bar dataKey="task2" name="Task 2" stackId="a" fill="#82ca9d" />
                      <Bar dataKey="task3" name="Task 3" stackId="a" fill="#ffc658" />
                    </RechartsBarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
      
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
