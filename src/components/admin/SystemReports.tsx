import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader, BarChart, PieChart, Download, User, AlertCircle, Clock, CheckSquare, Shield, Users } from 'lucide-react';
import { api } from '@/services/api';
import { SystemSummary, TrainerBreakdown } from '@/services/api/types';
import { toast } from 'sonner';
import { useUser } from '@/contexts/UserContext';
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

// Types for pod lead data
interface PodLeadBreakdown {
  pod_lead_email: string;
  consensus_created: number;
  annotations_overridden: number;
  team_members_managed: number;
  recent_activity: string;
}

const SystemReports: React.FC = () => {
  const { isAdmin, isPodLead } = useUser();
  const [isLoading, setIsLoading] = useState(true);
  const [isDownloading, setIsDownloading] = useState(false);
  const [systemData, setSystemData] = useState<SystemSummary | null>(null);
  const [podLeadData, setPodLeadData] = useState<PodLeadBreakdown[]>([]);
  const [generalReport, setGeneralReport] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  
  // Fetch system summary data
  useEffect(() => {
    const fetchSystemData = async () => {
      try {
        setIsLoading(true);
        
        // Fetch system summary
        const data = await api.summary.getSystemSummary();
        setSystemData(data);
        console.log("Received system data:", data);

        // Fetch general workflow report for additional insights
        if (isAdmin || isPodLead) {
          try {
            const report = await api.workflow.generalReport();
            setGeneralReport(report);
            console.log("Received general report:", report);
          } catch (reportErr) {
            console.warn('Could not fetch general report:', reportErr);
          }
        }

        // Generate pod lead breakdown data
        if (isAdmin) {
          await fetchPodLeadBreakdown();
        }
        
      } catch (err) {
        console.error('Error fetching system data:', err);
        setError('Failed to load system statistics');
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchSystemData();
  }, [isAdmin, isPodLead]);

  const fetchPodLeadBreakdown = async () => {
    try {
      // Use real API call instead of mock data
      const podLeadBreakdown = await api.podLead.getAllBreakdown();
      setPodLeadData(podLeadBreakdown);
    } catch (err) {
      console.error('Error fetching pod lead breakdown:', err);
      // Fallback to empty array instead of mock data
      setPodLeadData([]);
    }
  };
  
  const handleDownloadReport = async (format: 'csv' | 'json') => {
    try {
      setIsDownloading(true);
      const result = await api.summary.downloadReport(format);
      
      if (result.downloadUrl) {
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
  
  // Helper function to safely access systemData properties (handle snake_case from backend)
  const getSafeSystemData = () => {
    if (!systemData) return null;
    
    return {
      totalDiscussions: systemData.totalDiscussions || systemData.total_discussions || 0,
      totalAnnotations: systemData.totalAnnotations || systemData.total_annotations || 0,
      uniqueAnnotators: systemData.uniqueAnnotators || systemData.unique_annotators || 0,
      task1Completed: systemData.task1Completed || systemData.task1_completed || 0,
      task2Completed: systemData.task2Completed || systemData.task2_completed || 0,
      task3Completed: systemData.task3Completed || systemData.task3_completed || 0,
      consensusAnnotations: systemData.consensusAnnotations || systemData.consensus_annotations || 0,
      trainerBreakdown: systemData.trainerBreakdown || systemData.trainer_breakdown || [],
      taskProgression: systemData.taskProgression || systemData.task_progression || {}
    };
  };

  const safeSystemData = getSafeSystemData();
  
  // Prepare chart data
  const taskCompletionData = safeSystemData ? [
    { name: 'Task 1', completed: safeSystemData.task1Completed },
    { name: 'Task 2', completed: safeSystemData.task2Completed },
    { name: 'Task 3', completed: safeSystemData.task3Completed },
  ] : [];
  
  const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8'];

  // Task distribution data for pie chart
  const taskDistributionData = safeSystemData ? [
    { name: 'Task 1', value: safeSystemData.task1Completed },
    { name: 'Task 2', value: safeSystemData.task2Completed },
    { name: 'Task 3', value: safeSystemData.task3Completed },
  ] : [];

  // Task progression data
  const taskProgressionData = safeSystemData?.taskProgression ? [
    { name: 'Stuck in Task 1', value: safeSystemData.taskProgression.stuck_in_task1 || 0 },
    { name: 'Stuck in Task 2', value: safeSystemData.taskProgression.stuck_in_task2 || 0 },
    { name: 'Reached Task 3', value: safeSystemData.taskProgression.reached_task3 || 0 },
    { name: 'Fully Completed', value: safeSystemData.taskProgression.fully_completed || 0 },
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
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-dashboard-blue/10 rounded-lg p-4">
              <p className="text-sm font-medium text-dashboard-blue">Total Discussions</p>
              <p className="text-3xl font-bold">{safeSystemData?.totalDiscussions || 0}</p>
            </div>
            <div className="bg-green-100 rounded-lg p-4">
              <p className="text-sm font-medium text-green-700">Total Annotations</p>
              <p className="text-3xl font-bold">{safeSystemData?.totalAnnotations || 0}</p>
            </div>
            <div className="bg-purple-100 rounded-lg p-4">
              <p className="text-sm font-medium text-purple-700">Active Annotators</p>
              <p className="text-3xl font-bold">{safeSystemData?.uniqueAnnotators || 0}</p>
            </div>
            <div className="bg-orange-100 rounded-lg p-4">
              <p className="text-sm font-medium text-orange-700">Consensus Created</p>
              <p className="text-3xl font-bold">{safeSystemData?.consensusAnnotations || 0}</p>
            </div>
          </div>

          {/* Workflow Summary from General Report */}
          {generalReport && (
            <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-blue-50 rounded-lg p-4">
                <p className="text-sm font-medium text-blue-700">Ready for Consensus</p>
                <p className="text-2xl font-bold">{generalReport.workflow_summary?.discussions_ready_for_consensus || 0}</p>
              </div>
              <div className="bg-green-50 rounded-lg p-4">
                <p className="text-sm font-medium text-green-700">Ready for Unlock</p>
                <p className="text-2xl font-bold">{generalReport.workflow_summary?.discussions_ready_for_unlock || 0}</p>
              </div>
              <div className="bg-purple-50 rounded-lg p-4">
                <p className="text-sm font-medium text-purple-700">Fully Completed</p>
                <p className="text-2xl font-bold">{generalReport.workflow_summary?.fully_completed_discussions || 0}</p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
      
      <Tabs defaultValue="completion">
        <TabsList className="mb-4">
          <TabsTrigger value="completion">Task Completion</TabsTrigger>
          <TabsTrigger value="progression">Task Progression</TabsTrigger>
          <TabsTrigger value="trainers">Trainer Breakdown</TabsTrigger>
          {isAdmin && (
            <TabsTrigger value="podleads">Pod Lead Breakdown</TabsTrigger>
          )}
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
                    <p className="text-2xl font-bold mt-1">{safeSystemData?.taskProgression?.stuck_in_task1 || 0}</p>
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
                    <p className="text-2xl font-bold mt-1">{safeSystemData?.taskProgression?.stuck_in_task2 || 0}</p>
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
                    <p className="text-2xl font-bold mt-1">{safeSystemData?.taskProgression?.reached_task3 || 0}</p>
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
                    <p className="text-2xl font-bold mt-1">{safeSystemData?.taskProgression?.fully_completed || 0}</p>
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
              {safeSystemData?.trainerBreakdown && safeSystemData.trainerBreakdown.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse">
                    <thead>
                      <tr className="bg-gray-50 border-b">
                        <th className="py-2 px-3 text-left text-sm font-medium text-gray-500">Trainer ID</th>
                        <th className="py-2 px-3 text-left text-sm font-medium text-gray-500">Trainer Email</th>
                        <th className="py-2 px-3 text-left text-sm font-medium text-gray-500">Total</th>
                        <th className="py-2 px-3 text-left text-sm font-medium text-gray-500">Task 1</th>
                        <th className="py-2 px-3 text-left text-sm font-medium text-gray-500">Task 2</th>
                        <th className="py-2 px-3 text-left text-sm font-medium text-gray-500">Task 3</th>
                      </tr>
                    </thead>
                    <tbody>
                      {safeSystemData.trainerBreakdown.map((trainer: TrainerBreakdown, index: number) => (
                        <tr key={index} className={`${index % 2 === 0 ? 'bg-white' : 'bg-gray-50'} border-b`}>
                          <td className="py-2 px-3 text-sm">
                            <div className="flex items-center space-x-2">
                              <User className="h-4 w-4 text-gray-400" />
                              <span>{trainer.trainer_id}</span>
                            </div>
                          </td>
                          <td className="py-2 px-3 text-sm">{trainer.trainer_email}</td> 
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
              
              {safeSystemData?.trainerBreakdown && safeSystemData.trainerBreakdown.length > 0 && (
                <div className="h-64 mt-6">
                  <ResponsiveContainer width="100%" height="100%">
                    <RechartsBarChart
                      data={safeSystemData.trainerBreakdown.map(trainer => ({
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

        {/* NEW: Pod Lead Breakdown Tab - Admin Only */}
        {isAdmin && (
          <TabsContent value="podleads">
            <Card>
              <CardHeader>
                <CardTitle>Pod Lead Activity Breakdown</CardTitle>
                <CardDescription>Consensus creation and team management metrics by pod leads</CardDescription>
              </CardHeader>
              <CardContent>
                {podLeadData && podLeadData.length > 0 ? (
                  <>
                    <div className="overflow-x-auto">
                      <table className="w-full border-collapse">
                        <thead>
                          <tr className="bg-gray-50 border-b">
                            <th className="py-2 px-3 text-left text-sm font-medium text-gray-500">Pod Lead Email</th>
                            <th className="py-2 px-3 text-left text-sm font-medium text-gray-500">Consensus Created</th>
                            <th className="py-2 px-3 text-left text-sm font-medium text-gray-500">Annotations Overridden</th>
                            <th className="py-2 px-3 text-left text-sm font-medium text-gray-500">Team Members</th>
                            <th className="py-2 px-3 text-left text-sm font-medium text-gray-500">Last Activity</th>
                          </tr>
                        </thead>
                        <tbody>
                          {podLeadData.map((podLead: PodLeadBreakdown, index: number) => (
                            <tr key={index} className={`${index % 2 === 0 ? 'bg-white' : 'bg-gray-50'} border-b`}>
                              <td className="py-2 px-3 text-sm">
                                <div className="flex items-center space-x-2">
                                  <Shield className="h-4 w-4 text-blue-400" />
                                  <span>{podLead.pod_lead_email}</span>
                                </div>
                              </td>
                              <td className="py-2 px-3 text-sm font-medium">{podLead.consensus_created}</td>
                              <td className="py-2 px-3 text-sm">{podLead.annotations_overridden}</td>
                              <td className="py-2 px-3 text-sm">{podLead.team_members_managed}</td>
                              <td className="py-2 px-3 text-sm text-gray-500">
                                {new Date(podLead.recent_activity).toLocaleDateString()}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    <div className="h-64 mt-6">
                      <ResponsiveContainer width="100%" height="100%">
                        <RechartsBarChart
                          data={podLeadData.map(podLead => ({
                            name: podLead.pod_lead_email.split('@')[0], // Show just username part
                            consensus: podLead.consensus_created,
                            overrides: podLead.annotations_overridden,
                            team: podLead.team_members_managed
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
                          <Bar dataKey="consensus" name="Consensus Created" fill="#8884d8" />
                          <Bar dataKey="overrides" name="Annotations Overridden" fill="#82ca9d" />
                          <Bar dataKey="team" name="Team Members" fill="#ffc658" />
                        </RechartsBarChart>
                      </ResponsiveContainer>
                    </div>
                  </>
                ) : (
                  <div className="text-center py-6 text-gray-500">
                    <div className="flex flex-col items-center">
                      <Users className="h-12 w-12 text-gray-300 mb-4" />
                      <p>No pod lead data available</p>
                      <p className="text-sm mt-2">Pod leads will appear here once they start managing teams and creating consensus</p>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        )}
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