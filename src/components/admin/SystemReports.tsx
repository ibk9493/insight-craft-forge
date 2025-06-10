import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader, BarChart, PieChart, Download, User, AlertCircle, Clock, CheckSquare, Shield, Users, Activity, Flag, Archive } from 'lucide-react';
import { api } from '@/services/api';
import { EnhancedSystemSummary, TrainerBreakdown,GeneralReportData, } from '@/services/api/types';
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
  const [systemData, setSystemData] = useState<EnhancedSystemSummary | null>(null);
  const [podLeadData, setPodLeadData] = useState<PodLeadBreakdown[]>([]);
  const [generalReport, setGeneralReport] = useState<GeneralReportData | null>(null);
  const [error, setError] = useState<string | null>(null);
  
  // Fetch system summary data
  useEffect(() => {
    const fetchSystemData = async () => {
      try {
        setIsLoading(true);
        
        // Fetch enhanced system summary
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
      const podLeadBreakdown = await api.podLead.getAllBreakdown();
      setPodLeadData(podLeadBreakdown);
    } catch (err) {
      console.error('Error fetching pod lead breakdown:', err);
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
  
  // Prepare enhanced chart data
  const taskCompletionData = systemData ? [
    { 
      name: 'Task 1', 
      completed: systemData.task_completions?.task1?.completed || systemData.task1_completed || 0,
      consensus_created: systemData.task_completions?.task1?.consensus_created || 0,
      quality_failed: systemData.task_completions?.task1?.quality_failed || 0
    },
    { 
      name: 'Task 2', 
      completed: systemData.task_completions?.task2?.completed || systemData.task2_completed || 0,
      consensus_created: systemData.task_completions?.task2?.consensus_created || 0,
      quality_failed: systemData.task_completions?.task2?.quality_failed || 0
    },
    { 
      name: 'Task 3', 
      completed: systemData.task_completions?.task3?.completed || systemData.task3_completed || 0,
      consensus_created: systemData.task_completions?.task3?.consensus_created || 0,
      quality_failed: systemData.task_completions?.task3?.quality_failed || 0
    },
  ] : [];
  
  const COLORS = ['#22C55E', '#3B82F6', '#EF4444', '#F59E0B', '#8B5CF6'];

  // Enhanced task progression data from system summary
  const taskProgressionData = systemData?.taskProgression ? [
    { name: 'Not Started', value: systemData.taskProgression.not_started || 0 },
    { name: 'Task 1 In Progress', value: systemData.taskProgression.task1_in_progress || 0 },
    { name: 'Task 1 Done', value: systemData.taskProgression.task1_done || 0 },
    { name: 'Task 2 In Progress', value: systemData.taskProgression.task2_in_progress || 0 },
    { name: 'Task 2 Done', value: systemData.taskProgression.task2_done || 0 },
    { name: 'Task 3 In Progress', value: systemData.taskProgression.task3_in_progress || 0 },
    { name: 'Fully Completed', value: systemData.taskProgression.fully_completed || 0 },
    { name: 'Workflow Blocked', value: systemData.taskProgression.workflow_blocked || 0 },
  ] : [];

  // Bottleneck analysis data
  const bottleneckData = systemData?.bottleneckAnalysis ? [
    { name: 'Task 1 Missing Annotations', value: systemData.bottleneckAnalysis.task1_missing_annotations || 0 },
    { name: 'Task 1 Ready for Consensus', value: systemData.bottleneckAnalysis.task1_ready_for_consensus || 0 },
    { name: 'Task 2 Missing Annotations', value: systemData.bottleneckAnalysis.task2_missing_annotations || 0 },
    { name: 'Task 2 Ready for Consensus', value: systemData.bottleneckAnalysis.task2_ready_for_consensus || 0 },
    { name: 'Task 3 Missing Annotations', value: systemData.bottleneckAnalysis.task3_missing_annotations || 0 },
    { name: 'Task 3 Ready for Consensus', value: systemData.bottleneckAnalysis.task3_ready_for_consensus || 0 },
  ] : [];

  // Workflow health metrics
  const workflowHealthData = systemData?.workflowHealth ? [
    { name: 'Healthy', value: systemData.workflowHealth.healthy_discussions || 0, color: '#22C55E' },
    { name: 'Quality Issues', value: systemData.workflowHealth.quality_issues || 0, color: '#F59E0B' },
    { name: 'Blocked', value: systemData.workflowHealth.blocked_discussions || 0, color: '#EF4444' },
    { name: 'Consensus Pending', value: systemData.workflowHealth.consensus_pending || 0, color: '#3B82F6' },
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
              <p className="text-3xl font-bold">{systemData?.total_discussions || 0}</p>
            </div>
            <div className="bg-green-100 rounded-lg p-4">
              <p className="text-sm font-medium text-green-700">Total Annotations</p>
              <p className="text-3xl font-bold">{systemData?.total_annotations || 0}</p>
            </div>
            <div className="bg-purple-100 rounded-lg p-4">
              <p className="text-sm font-medium text-purple-700">Active Annotators</p>
              <p className="text-3xl font-bold">{systemData?.unique_annotators || 0}</p>
            </div>
            <div className="bg-orange-100 rounded-lg p-4">
              <p className="text-sm font-medium text-orange-700">Consensus Created</p>
              <p className="text-3xl font-bold">{systemData?.consensus_annotations || 0}</p>
            </div>
          </div>

          {/* Enhanced Workflow Summary */}
          {(systemData?.workflowHealth || generalReport) && (
            <div className="mt-6">
              <h3 className="text-lg font-semibold mb-4">Workflow Health Metrics</h3>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="bg-green-50 rounded-lg p-4">
                  <p className="text-sm font-medium text-green-700">Healthy Discussions</p>
                  <p className="text-2xl font-bold">{systemData?.workflowHealth?.healthy_discussions || 0}</p>
                </div>
                <div className="bg-blue-50 rounded-lg p-4">
                  <p className="text-sm font-medium text-blue-700">Consensus Pending</p>
                  <p className="text-2xl font-bold">{systemData?.workflowHealth?.consensus_pending || 0}</p>
                </div>
                <div className="bg-yellow-50 rounded-lg p-4">
                  <p className="text-sm font-medium text-yellow-700">Quality Issues</p>
                  <p className="text-2xl font-bold">{systemData?.workflowHealth?.quality_issues || 0}</p>
                </div>
                <div className="bg-red-50 rounded-lg p-4">
                  <p className="text-sm font-medium text-red-700">Blocked Discussions</p>
                  <p className="text-2xl font-bold">{systemData?.workflowHealth?.blocked_discussions || 0}</p>
                </div>
              </div>
              
              <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-purple-50 rounded-lg p-4">
                  <p className="text-sm font-medium text-purple-700">Completion Rate</p>
                  <p className="text-2xl font-bold">{systemData?.workflowHealth?.completion_rate?.toFixed(1) || 0}%</p>
                </div>
                <div className="bg-indigo-50 rounded-lg p-4">
                  <p className="text-sm font-medium text-indigo-700">Avg Tasks per Discussion</p>
                  <p className="text-2xl font-bold">{systemData?.workflowHealth?.average_task_completion?.toFixed(1) || 0}</p>
                </div>
              </div>
            </div>
          )}

          {/* General Report Summary */}
          {generalReport && (
            <div className="mt-6">
              <h3 className="text-lg font-semibold mb-4">Current Workflow Status</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
              
              <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-gray-50 rounded-lg p-4">
                  <p className="text-sm font-medium text-gray-700">Collecting Annotations</p>
                  <p className="text-2xl font-bold">{generalReport.normal_workflow_states?.collecting_annotations || 0}</p>
                  <p className="text-xs text-gray-500">Normal workflow state</p>
                </div>
                <div className="bg-orange-50 rounded-lg p-4">
                  <p className="text-sm font-medium text-orange-700">Rework Required</p>
                  <p className="text-2xl font-bold">{generalReport.workflow_summary?.rework_discussions || 0}</p>
                  <p className="text-xs text-orange-500">Needs attention</p>
                </div>
                <div className="bg-red-50 rounded-lg p-4">
                  <p className="text-sm font-medium text-red-700">Truly Stuck</p>
                  <p className="text-2xl font-bold">{generalReport.workflow_summary?.stuck_discussions || 0}</p>
                  <p className="text-xs text-red-500">Requires intervention</p>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
      
      <Tabs defaultValue="completion">
        <TabsList className="mb-4">
          <TabsTrigger value="completion">Task Completion</TabsTrigger>
          <TabsTrigger value="progression">Task Progression</TabsTrigger>
          <TabsTrigger value="bottlenecks">Bottlenecks</TabsTrigger>
          <TabsTrigger value="health">Workflow Health</TabsTrigger>
          <TabsTrigger value="trainers">Trainer Breakdown</TabsTrigger>
          <TabsTrigger value="insights">Actionable Insights</TabsTrigger>
          {isAdmin && (
            <TabsTrigger value="podleads">Pod Lead Breakdown</TabsTrigger>
          )}
        </TabsList>
        
        <TabsContent value="completion">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Enhanced Task Completion</CardTitle>
                <CardDescription>Task completion with status breakdown</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <RechartsBarChart data={taskCompletionData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="name" />
                      <YAxis />
                      <Tooltip />
                      <Legend />
                      <Bar dataKey="completed" name="Completed" stackId="a" fill="#22C55E" />
                      <Bar dataKey="consensus_created" name="Consensus Created" stackId="a" fill="#3B82F6" />
                      <Bar dataKey="quality_failed" name="Quality Failed" stackId="a" fill="#EF4444" />
                    </RechartsBarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader>
                <CardTitle>Task Completion Distribution</CardTitle>
                <CardDescription>Overall task completion breakdown</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <RechartsPieChart>
                      <Pie
                        data={taskCompletionData.map(task => ({ name: task.name, value: task.completed }))}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={80}
                        paddingAngle={5}
                        dataKey="value"
                        label
                      >
                        {taskCompletionData.map((entry, index) => (
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
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
                <div className="bg-gray-100 rounded-lg p-4">
                  <div className="flex items-center space-x-2">
                    <Archive className="h-5 w-5 text-gray-600" />
                    <p className="text-sm font-medium text-gray-600">Not Started</p>
                  </div>
                  <p className="text-2xl font-bold mt-1">{systemData?.taskProgression?.not_started || 0}</p>
                </div>
                
                <div className="bg-blue-100 rounded-lg p-4">
                  <div className="flex items-center space-x-2">
                    <Clock className="h-5 w-5 text-blue-600" />
                    <p className="text-sm font-medium text-blue-600">In Progress</p>
                  </div>
                  <p className="text-2xl font-bold mt-1">
                    {(systemData?.taskProgression?.task1_in_progress || 0) + 
                     (systemData?.taskProgression?.task2_in_progress || 0) + 
                     (systemData?.taskProgression?.task3_in_progress || 0)}
                  </p>
                </div>
                
                <div className="bg-green-100 rounded-lg p-4">
                  <div className="flex items-center space-x-2">
                    <CheckSquare className="h-5 w-5 text-green-600" />
                    <p className="text-sm font-medium text-green-600">Fully Completed</p>
                  </div>
                  <p className="text-2xl font-bold mt-1">{systemData?.taskProgression?.fully_completed || 0}</p>
                </div>
                
                <div className="bg-red-100 rounded-lg p-4">
                  <div className="flex items-center space-x-2">
                    <AlertCircle className="h-5 w-5 text-red-600" />
                    <p className="text-sm font-medium text-red-600">Workflow Blocked</p>
                  </div>
                  <p className="text-2xl font-bold mt-1">{systemData?.taskProgression?.workflow_blocked || 0}</p>
                </div>
              </div>
              
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <RechartsBarChart data={taskProgressionData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" angle={-45} textAnchor="end" height={80} />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="value">
                      {taskProgressionData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Bar>
                  </RechartsBarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="bottlenecks">
          <Card>
            <CardHeader>
              <CardTitle>Bottleneck Analysis</CardTitle>
              <CardDescription>Identify where discussions are stuck in the workflow</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                <div className="bg-yellow-100 rounded-lg p-4">
                  <div className="flex items-center space-x-2">
                    <Users className="h-5 w-5 text-yellow-600" />
                    <p className="text-sm font-medium text-yellow-600">Missing Annotations</p>
                  </div>
                  <p className="text-2xl font-bold mt-1">
                    {(systemData?.bottleneckAnalysis?.task1_missing_annotations || 0) +
                     (systemData?.bottleneckAnalysis?.task2_missing_annotations || 0) +
                     (systemData?.bottleneckAnalysis?.task3_missing_annotations || 0)}
                  </p>
                </div>
                
                <div className="bg-blue-100 rounded-lg p-4">
                  <div className="flex items-center space-x-2">
                    <Activity className="h-5 w-5 text-blue-600" />
                    <p className="text-sm font-medium text-blue-600">Ready for Consensus</p>
                  </div>
                  <p className="text-2xl font-bold mt-1">
                    {(systemData?.bottleneckAnalysis?.task1_ready_for_consensus || 0) +
                     (systemData?.bottleneckAnalysis?.task2_ready_for_consensus || 0) +
                     (systemData?.bottleneckAnalysis?.task3_ready_for_consensus || 0)}
                  </p>
                </div>
                
                <div className="bg-red-100 rounded-lg p-4">
                  <div className="flex items-center space-x-2">
                    <AlertCircle className="h-5 w-5 text-red-600" />
                    <p className="text-sm font-medium text-red-600">Total Stuck</p>
                  </div>
                  <p className="text-2xl font-bold mt-1">{systemData?.bottleneckAnalysis?.total_stuck_discussions || 0}</p>
                </div>
              </div>

              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <RechartsBarChart data={bottleneckData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" angle={-45} textAnchor="end" height={80} />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="value" fill="#F59E0B" />
                  </RechartsBarChart>
                </ResponsiveContainer>
              </div>

              {/* Stuck Discussions Details */}
              {systemData?.bottleneckAnalysis?.stuck_details && systemData.bottleneckAnalysis.stuck_details.length > 0 && (
                <div className="mt-6">
                  <h4 className="text-md font-semibold mb-4">Stuck Discussions Details</h4>
                  <div className="max-h-64 overflow-y-auto">
                    {systemData.bottleneckAnalysis.stuck_details.slice(0, 10).map((stuck, index) => (
                      <div key={index} className="bg-red-50 rounded-lg p-3 mb-2">
                        <p className="font-medium text-sm">{stuck.discussion_title}</p>
                        <p className="text-xs text-gray-600">ID: {stuck.discussion_id}</p>
                        <div className="flex flex-wrap gap-1 mt-1">
                          {stuck.stuck_reasons.map((reason, reasonIndex) => (
                            <span key={reasonIndex} className="bg-red-200 text-red-800 text-xs px-2 py-1 rounded">
                              {reason}
                            </span>
                          ))}
                        </div>
                      </div>
                    ))}
                    {systemData.bottleneckAnalysis.stuck_details.length > 10 && (
                      <p className="text-sm text-gray-500 text-center">
                        ... and {systemData.bottleneckAnalysis.stuck_details.length - 10} more stuck discussions
                      </p>
                    )}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="health">
          <Card>
            <CardHeader>
              <CardTitle>Workflow Health</CardTitle>
              <CardDescription>Overall health and quality metrics</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="h-64">
                  <h4 className="text-md font-semibold mb-4">Discussion Health Distribution</h4>
                  <ResponsiveContainer width="100%" height="100%">
                    <RechartsPieChart>
                      <Pie
                        data={workflowHealthData}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={80}
                        paddingAngle={5}
                        dataKey="value"
                        label
                      >
                        {workflowHealthData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip />
                      <Legend />
                    </RechartsPieChart>
                  </ResponsiveContainer>
                </div>

                <div className="space-y-4">
                  <h4 className="text-md font-semibold">Health Metrics</h4>
                  <div className="space-y-3">
                    <div className="flex justify-between items-center p-3 bg-green-50 rounded-lg">
                      <span className="text-green-700 font-medium">Healthy Discussions</span>
                      <span className="text-green-800 font-bold">{systemData?.workflowHealth?.healthy_discussions || 0}</span>
                    </div>
                    <div className="flex justify-between items-center p-3 bg-blue-50 rounded-lg">
                      <span className="text-blue-700 font-medium">Consensus Pending</span>
                      <span className="text-blue-800 font-bold">{systemData?.workflowHealth?.consensus_pending || 0}</span>
                    </div>
                    <div className="flex justify-between items-center p-3 bg-yellow-50 rounded-lg">
                      <span className="text-yellow-700 font-medium">Quality Issues</span>
                      <span className="text-yellow-800 font-bold">{systemData?.workflowHealth?.quality_issues || 0}</span>
                    </div>
                    <div className="flex justify-between items-center p-3 bg-red-50 rounded-lg">
                      <span className="text-red-700 font-medium">Blocked Discussions</span>
                      <span className="text-red-800 font-bold">{systemData?.workflowHealth?.blocked_discussions || 0}</span>
                    </div>
                  </div>
                </div>
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
                <div className="space-y-6">
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
                        {systemData.trainerBreakdown.map((trainer: TrainerBreakdown, index: number) => (
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

                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <RechartsBarChart
                        data={systemData.trainerBreakdown.map(trainer => ({
                          name: trainer.trainer_email?.split('@')[0] || trainer.trainer_id,
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
                </div>
              ) : (
                <div className="text-center py-6 text-gray-500">
                  <p>No trainer data available</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="insights">
          <Card>
            <CardHeader>
              <CardTitle>Actionable Insights</CardTitle>
              <CardDescription>System-generated recommendations for workflow optimization</CardDescription>
            </CardHeader>
            <CardContent>
              {systemData?.actionableInsights && systemData.actionableInsights.length > 0 ? (
                <div className="space-y-4">
                  {systemData.actionableInsights.map((insight, index) => {
                    const priorityColors = {
                      high: 'bg-red-50 border-red-200 text-red-800',
                      medium: 'bg-yellow-50 border-yellow-200 text-yellow-800',
                      low: 'bg-blue-50 border-blue-200 text-blue-800',
                      info: 'bg-gray-50 border-gray-200 text-gray-800'
                    };
                    
                    const priorityIcons = {
                      high: <AlertCircle className="h-5 w-5 text-red-600" />,
                      medium: <Clock className="h-5 w-5 text-yellow-600" />,
                      low: <CheckSquare className="h-5 w-5 text-blue-600" />,
                      info: <Activity className="h-5 w-5 text-gray-600" />
                    };

                    return (
                      <div key={index} className={`p-4 rounded-lg border ${priorityColors[insight.priority as keyof typeof priorityColors] || priorityColors.info}`}>
                        <div className="flex items-start space-x-3">
                          {priorityIcons[insight.priority as keyof typeof priorityIcons] || priorityIcons.info}
                          <div className="flex-1">
                            <div className="flex items-center space-x-2 mb-2">
                              <span className="font-medium capitalize">{insight.priority} Priority</span>
                              <span className="text-xs bg-white px-2 py-1 rounded">{insight.type}</span>
                            </div>
                            <p className="font-medium mb-1">{insight.message}</p>
                            <p className="text-sm opacity-80">{insight.action}</p>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="text-center py-6 text-gray-500">
                  <Activity className="h-12 w-12 text-gray-300 mb-4 mx-auto" />
                  <p>No actionable insights available</p>
                  <p className="text-sm mt-2">Insights will appear here when workflow issues are detected</p>
                </div>
              )}

              {/* General Report Recommendations */}
              {generalReport?.recommendations && generalReport.recommendations.length > 0 && (
                <div className="mt-8">
                  <h4 className="text-md font-semibold mb-4">Additional Workflow Recommendations</h4>
                  <div className="space-y-3">
                    {generalReport.recommendations.map((rec, index) => {
                      const priorityColors = {
                        high: 'bg-red-50 border-red-200 text-red-800',
                        medium: 'bg-yellow-50 border-yellow-200 text-yellow-800',
                        low: 'bg-blue-50 border-blue-200 text-blue-800',
                        info: 'bg-gray-50 border-gray-200 text-gray-800'
                      };

                      return (
                        <div key={index} className={`p-3 rounded-lg border ${priorityColors[rec.priority as keyof typeof priorityColors] || priorityColors.info}`}>
                          <div className="flex items-center justify-between mb-1">
                            <span className="font-medium text-sm">{rec.message}</span>
                            <span className="text-xs bg-white px-2 py-1 rounded">{rec.count}</span>
                          </div>
                          <p className="text-xs opacity-80">{rec.action}</p>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Pod Lead Breakdown Tab - Admin Only */}
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
                            name: podLead.pod_lead_email.split('@')[0],
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