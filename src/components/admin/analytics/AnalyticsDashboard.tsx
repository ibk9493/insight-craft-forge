import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs-wrapper';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, ResponsiveContainer, PieChart, Pie, Cell, Tooltip } from 'recharts';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Grid, List, BarChart3, PieChart as PieChartIcon, Calendar, Download, AlertTriangle, Users, Target } from 'lucide-react';
import {  AnnotationActivity, EnhancedSystemSummary, RepositoryBreakdown } from '@/services/api/types';
import { DateRange } from 'react-day-picker';
import { DateRangePicker } from '@/components/ui/date-range-picker';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { api } from '@/services/api';

interface AnalyticsDashboardProps {
  systemSummary?: EnhancedSystemSummary; // Make optional since we'll fetch it
  annotationActivity?: AnnotationActivity[];
  repositoryBreakdown?: RepositoryBreakdown[];
  isLoading?: boolean;
  onDateRangeChange?: (dateRange: DateRange | undefined) => void;
  onExport?: (format: 'csv' | 'json') => void;
  autoRefresh?: boolean; // Enable auto-refresh
  refreshInterval?: number; // Refresh interval in ms
}

// Mock data for development purposes
const mockAnnotationActivity: AnnotationActivity[] = [
  { date: '2025-05-10', count: 12 },
  { date: '2025-05-11', count: 19 },
  { date: '2025-05-12', count: 24 },
  { date: '2025-05-13', count: 15 },
  { date: '2025-05-14', count: 28 },
  { date: '2025-05-15', count: 22 },
  { date: '2025-05-16', count: 30 },
];

const mockRepositoryBreakdown: RepositoryBreakdown[] = [
  { repository: 'react', count: 25 },
  { repository: 'typescript', count: 18 },
  { repository: 'pytorch', count: 15 },
  { repository: 'tensorflow', count: 12 },
  { repository: 'langchain', count: 10 },
];

// Colors for the charts
const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8'];
const HEALTH_COLORS = {
  healthy: '#22C55E',
  consensus_pending: '#3B82F6',
  quality_issues: '#F59E0B',
  blocked: '#EF4444'
};

const AnalyticsDashboard: React.FC<AnalyticsDashboardProps> = ({
  systemSummary: propSystemSummary,
  annotationActivity: propAnnotationActivity,
  repositoryBreakdown: propRepositoryBreakdown,
  isLoading: propIsLoading = false,
  onDateRangeChange,
  onExport,
  autoRefresh = true,
  refreshInterval = 30000, // 30 seconds default
}) => {
  const [activeTab, setActiveTab] = useState('overview');
  const [dateRange, setDateRange] = useState<DateRange | undefined>({
    from: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
    to: new Date()
  });
  const [chartView, setChartView] = useState<'bar' | 'pie'>('bar');
  const [isExporting, setIsExporting] = useState(false);
  
  // State for API data
  const [systemSummary, setSystemSummary] = useState<EnhancedSystemSummary | null>(propSystemSummary || null);
  const [annotationActivity, setAnnotationActivity] = useState<AnnotationActivity[]>(propAnnotationActivity || mockAnnotationActivity);
  const [repositoryBreakdown, setRepositoryBreakdown] = useState<RepositoryBreakdown[]>(propRepositoryBreakdown || mockRepositoryBreakdown);
  const [isLoading, setIsLoading] = useState(propIsLoading);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Fetch system summary data
  const fetchSystemSummary = async () => {
    try {
      setIsLoading(true);
      setError(null);
      
      console.log('[AnalyticsDashboard] Fetching enhanced system summary...');
      
      // Try enhanced API first, fallback to legacy
      let summaryData;
      try {
        // Check if enhanced API is available
        if (api.summary.getSystemSummary) {
          summaryData = await api.summary.getSystemSummary();
          console.log('[AnalyticsDashboard] Enhanced system summary received:', summaryData);
        } else {
          throw new Error('Enhanced API not available');
        }
      } catch (enhancedError) {
        console.warn('[AnalyticsDashboard] Enhanced API failed, falling back to legacy:', enhancedError);
        summaryData = await api.summary.getSystemSummary();
        console.log('[AnalyticsDashboard] Legacy system summary received:', summaryData);
      }
      
      setSystemSummary(summaryData);
      setLastUpdated(new Date());
      
    } catch (err) {
      console.error('[AnalyticsDashboard] Error fetching system summary:', err);
      setError('Failed to load system analytics');
      toast.error('Failed to load system analytics');
    } finally {
      setIsLoading(false);
    }
  };

  // Fetch annotation activity data
  const fetchAnnotationActivity = async () => {
    if (propAnnotationActivity) return; // Don't fetch if provided as prop
    
    try {
      const fromDate = dateRange?.from?.toISOString().split('T')[0];
      const toDate = dateRange?.to?.toISOString().split('T')[0];
      
      console.log('[AnalyticsDashboard] Fetching annotation activity...');
      // const activityData = await api.summary.getAnnotationActivity(fromDate, toDate);
      // console.log('[AnalyticsDashboard] Annotation activity received:', activityData);
      
      // setAnnotationActivity(activityData);
    } catch (err) {
      console.error('[AnalyticsDashboard] Error fetching annotation activity:', err);
      // Keep using mock data on error
    }
  };

  // Fetch repository breakdown data
  const fetchRepositoryBreakdown = async () => {
    if (propRepositoryBreakdown) return; // Don't fetch if provided as prop
    
    try {
      console.log('[AnalyticsDashboard] Fetching repository breakdown...');
      const repoData = await api.summary.getRepositoryBreakdown();
      console.log('[AnalyticsDashboard] Repository breakdown received:', repoData);
      
      setRepositoryBreakdown(repoData);
    } catch (err) {
      console.error('[AnalyticsDashboard] Error fetching repository breakdown:', err);
      // Keep using mock data on error
    }
  };

  // Fetch all data
  const fetchAllData = async () => {
    await Promise.all([
      fetchSystemSummary(),
      fetchAnnotationActivity(),
      fetchRepositoryBreakdown()
    ]);
  };

  // Initial data fetch
  useEffect(() => {
    // Only fetch if not provided as props
    if (!propSystemSummary) {
      fetchAllData();
    }
  }, [propSystemSummary]);

  // Auto-refresh effect
  useEffect(() => {
    if (!autoRefresh) return;
    
    const interval = setInterval(() => {
      console.log('[AnalyticsDashboard] Auto-refreshing data...');
      fetchSystemSummary(); // Only refresh the main summary, not charts
    }, refreshInterval);

    return () => clearInterval(interval);
  }, [autoRefresh, refreshInterval]);

  // Refresh data when date range changes
  useEffect(() => {
    if (!propAnnotationActivity) {
      fetchAnnotationActivity();
    }
  }, [dateRange, propAnnotationActivity]);

  // Handle manual refresh
  const handleRefresh = async () => {
    console.log('[AnalyticsDashboard] Manual refresh triggered');
    await fetchAllData();
    toast.success('Analytics data refreshed');
  };

  // Handle date range change
  const handleDateRangeChange = (range: DateRange | undefined) => {
    setDateRange(range);
    if (onDateRangeChange) {
      onDateRangeChange(range);
    }
  };

  // Format date for display
  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return format(date, 'MMM dd');
  };

  // Handle export
  const handleExport = async (format: 'csv' | 'json' = 'json') => {
    setIsExporting(true);
    
    try {
      if (onExport) {
        await onExport(format);
      } else {
        // Fallback export if no handler is provided
        const data = {
          systemSummary,
          annotationActivity,
          repositoryBreakdown,
          exportedAt: new Date().toISOString(),
          dateRange
        };
        
        const blob = new Blob(
          [format === 'json' ? JSON.stringify(data, null, 2) : convertToCSV(data)], 
          { type: format === 'json' ? 'application/json' : 'text/csv' }
        );
        
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `analytics-export-${new Date().toISOString().split('T')[0]}.${format}`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
        toast.success(`Export completed as ${format.toUpperCase()}`);
      }
    } catch (error) {
      console.error('Export error:', error);
      toast.error(`Failed to export as ${format.toUpperCase()}`);
    } finally {
      setIsExporting(false);
    }
  };
  
  // Helper function to convert data to CSV format
  const convertToCSV = (data: any) => {
    const replacer = (key: string, value: any) => value === null ? '' : value;
    const header = Object.keys(data.systemSummary || {});
    let csv = header.join(',') + '\n';
    
    csv += header.map(key => 
      JSON.stringify((data.systemSummary || {})[key], replacer)
    ).join(',');
    
    return csv;
  };

  // ✅ ENHANCED: Better mapping of backend data with enhanced metrics
  const safeSystemSummary = (() => {
    if (!systemSummary) {
      return {
        totalDiscussions: 0,
        totalAnnotations: 0,
        uniqueAnnotators: 0,
        consensusAnnotations: 0,
        taskCompletions: {
          task1: { completed: 0, consensus_created: 0, quality_failed: 0, total_done: 0 },
          task2: { completed: 0, consensus_created: 0, quality_failed: 0, total_done: 0 },
          task3: { completed: 0, consensus_created: 0, quality_failed: 0, total_done: 0 }
        },
        bottleneckAnalysis: {
          task1_missing_annotations: 0,
          task1_ready_for_consensus: 0,
          task2_missing_annotations: 0,
          task2_ready_for_consensus: 0,
          task3_missing_annotations: 0,
          task3_ready_for_consensus: 0,
          total_stuck_discussions: 0,
          stuck_details: []
        },
        workflowHealth: {
          healthy_discussions: 0,
          quality_issues: 0,
          blocked_discussions: 0,
          consensus_pending: 0,
          completion_rate: 0,
          average_task_completion: 0
        },
        taskProgression: {
          not_started: 0,
          task1_in_progress: 0,
          task1_done: 0,
          task2_in_progress: 0,
          task2_done: 0,
          task3_in_progress: 0,
          fully_completed: 0,
          workflow_blocked: 0
        },
        actionableInsights: [],
        task1Completed: 0,
        task2Completed: 0,
        task3Completed: 0,
        batchesBreakdown: []
      };
    }
    
    const enhanced = systemSummary as EnhancedSystemSummary;
    
    return {
      // Basic metrics
      totalDiscussions: enhanced?.totalDiscussions || enhanced?.total_discussions || 0,
      totalAnnotations: enhanced?.totalAnnotations || enhanced?.total_annotations || 0,
      uniqueAnnotators: enhanced?.uniqueAnnotators || enhanced?.unique_annotators || 0,
      consensusAnnotations: enhanced?.consensusAnnotations || enhanced?.consensus_annotations || 0,
      
      // Enhanced task completion data
      taskCompletions: enhanced?.taskCompletions || enhanced?.task_completions || {
        task1: { completed: 0, consensus_created: 0, quality_failed: 0, total_done: 0 },
        task2: { completed: 0, consensus_created: 0, quality_failed: 0, total_done: 0 },
        task3: { completed: 0, consensus_created: 0, quality_failed: 0, total_done: 0 }
      },
      
      // Enhanced bottleneck analysis
      bottleneckAnalysis: enhanced?.bottleneckAnalysis || {
        task1_missing_annotations: 0,
        task1_ready_for_consensus: 0,
        task2_missing_annotations: 0,
        task2_ready_for_consensus: 0,
        task3_missing_annotations: 0,
        task3_ready_for_consensus: 0,
        total_stuck_discussions: 0,
        stuck_details: []
      },
      
      // Workflow health
      workflowHealth: enhanced?.workflowHealth || {
        healthy_discussions: 0,
        quality_issues: 0,
        blocked_discussions: 0,
        consensus_pending: 0,
        completion_rate: 0,
        average_task_completion: 0
      },
      
      // Enhanced task progression (includes workflow_blocked for rework/flagged)
      taskProgression: enhanced?.taskProgression || {
        not_started: 0,
        task1_in_progress: 0,
        task1_done: 0,
        task2_in_progress: 0,
        task2_done: 0,
        task3_in_progress: 0,
        fully_completed: 0,
        workflow_blocked: 0
      },
      
      // Actionable insights
      actionableInsights: enhanced?.actionableInsights || [],
      
      // Legacy fields for backward compatibility
      task1Completed: enhanced?.task1Completed || enhanced?.task1_completed || 0,
      task2Completed: enhanced?.task2Completed || enhanced?.task2_completed || 0,
      task3Completed: enhanced?.task3Completed || enhanced?.task3_completed || 0,
      batchesBreakdown: enhanced?.batchesBreakdown || enhanced?.batches_breakdown || []
    };
  })();

  // Prepare enhanced chart data
  const enhancedTaskCompletionData = [
    { 
      name: 'Task 1', 
      completed: safeSystemSummary.taskCompletions.task1.completed,
      consensus_created: safeSystemSummary.taskCompletions.task1.consensus_created,
      quality_failed: safeSystemSummary.taskCompletions.task1.quality_failed
    },
    { 
      name: 'Task 2', 
      completed: safeSystemSummary.taskCompletions.task2.completed,
      consensus_created: safeSystemSummary.taskCompletions.task2.consensus_created,
      quality_failed: safeSystemSummary.taskCompletions.task2.quality_failed
    },
    { 
      name: 'Task 3', 
      completed: safeSystemSummary.taskCompletions.task3.completed,
      consensus_created: safeSystemSummary.taskCompletions.task3.consensus_created,
      quality_failed: safeSystemSummary.taskCompletions.task3.quality_failed
    }
  ];

  // Workflow health data for pie chart
  const workflowHealthData = [
    { name: 'Healthy', value: safeSystemSummary.workflowHealth.healthy_discussions, color: HEALTH_COLORS.healthy },
    { name: 'Consensus Pending', value: safeSystemSummary.workflowHealth.consensus_pending, color: HEALTH_COLORS.consensus_pending },
    { name: 'Quality Issues', value: safeSystemSummary.workflowHealth.quality_issues, color: HEALTH_COLORS.quality_issues },
    { name: 'Blocked/Rework', value: safeSystemSummary.workflowHealth.blocked_discussions, color: HEALTH_COLORS.blocked }
  ].filter(item => item.value > 0);

  // Bottleneck analysis data
  const bottleneckData = [
    { name: 'T1 Missing Annotations', value: safeSystemSummary.bottleneckAnalysis.task1_missing_annotations, color: '#EF4444' },
    { name: 'T1 Ready for Consensus', value: safeSystemSummary.bottleneckAnalysis.task1_ready_for_consensus, color: '#F59E0B' },
    { name: 'T2 Missing Annotations', value: safeSystemSummary.bottleneckAnalysis.task2_missing_annotations, color: '#EF4444' },
    { name: 'T2 Ready for Consensus', value: safeSystemSummary.bottleneckAnalysis.task2_ready_for_consensus, color: '#F59E0B' },
    { name: 'T3 Missing Annotations', value: safeSystemSummary.bottleneckAnalysis.task3_missing_annotations, color: '#EF4444' },
    { name: 'T3 Ready for Consensus', value: safeSystemSummary.bottleneckAnalysis.task3_ready_for_consensus, color: '#F59E0B' }
  ].filter(item => item.value > 0);

  // Debug log
  console.log('Enhanced SystemSummary processed:', safeSystemSummary);

  // Loading state
  if (isLoading && !systemSummary) {
    return (
      <Card className="w-full shadow-md">
        <CardContent className="pt-6 flex flex-col items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mb-4"></div>
          <p className="text-gray-500">Loading analytics data...</p>
          {lastUpdated && (
            <p className="text-xs text-gray-400 mt-2">
              Last updated: {lastUpdated.toLocaleTimeString()}
            </p>
          )}
        </CardContent>
      </Card>
    );
  }

  // Error state
  if (error && !systemSummary) {
    return (
      <Card className="w-full shadow-md">
        <CardContent className="pt-6">
          <div className="text-center">
            <AlertTriangle className="h-12 w-12 text-red-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium mb-2 text-red-600">Failed to Load Analytics</h3>
            <p className="text-gray-500 mb-4">{error}</p>
            <Button onClick={handleRefresh} variant="outline">
              Try Again
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full shadow-md">
      <CardHeader>
        <div className="flex justify-between items-center">
          <div>
            <CardTitle>Analytics Dashboard</CardTitle>
            <CardDescription>
              Enhanced workflow monitoring with bottleneck analysis and health metrics
              {lastUpdated && (
                <span className="ml-2 text-xs text-gray-400">
                  • Last updated: {lastUpdated.toLocaleTimeString()}
                </span>
              )}
            </CardDescription>
          </div>
          <div className="flex items-center space-x-2">
            <DateRangePicker
              value={dateRange}
              onValueChange={handleDateRangeChange}
            />
            <Button 
              variant="outline" 
              size="sm"
              onClick={handleRefresh}
              disabled={isLoading}
              className="flex items-center gap-2"
            >
              <div className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`}>
                ⟳
              </div>
              <span>Refresh</span>
            </Button>
            <Button 
              variant="outline" 
              className="flex items-center gap-2"
              disabled={isExporting}
              onClick={() => handleExport('json')}
            >
              <Download className="h-4 w-4" />
              <span>{isExporting ? 'Exporting...' : 'Export'}</span>
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <Tabs 
          defaultValue={activeTab}
          value={activeTab} 
          onValueChange={setActiveTab}
        >
          <TabsList className="mb-4">
            <TabsTrigger value="overview" className="flex items-center gap-2">
              <Grid className="h-4 w-4" />
              <span>Overview</span>
            </TabsTrigger>
            <TabsTrigger value="bottlenecks" className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4" />
              <span>Bottlenecks</span>
            </TabsTrigger>
            <TabsTrigger value="health" className="flex items-center gap-2">
              <Target className="h-4 w-4" />
              <span>Workflow Health</span>
            </TabsTrigger>
            <TabsTrigger value="activity" className="flex items-center gap-2">
              <BarChart3 className="h-4 w-4" />
              <span>Activity</span>
            </TabsTrigger>
            <TabsTrigger value="repositories" className="flex items-center gap-2">
              <PieChartIcon className="h-4 w-4" />
              <span>Repositories</span>
            </TabsTrigger>
          </TabsList>

          {/* Enhanced Overview Tab */}
          <TabsContent value="overview" className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-lg">Total Discussions</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold">
                    {safeSystemSummary.totalDiscussions}
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-lg">Total Annotations</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold">
                    {safeSystemSummary.totalAnnotations}
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-lg">Unique Annotators</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold">
                    {safeSystemSummary.uniqueAnnotators}
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-lg">Completion Rate</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold">
                    {safeSystemSummary.workflowHealth.completion_rate.toFixed(1)}%
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Enhanced Task Completion Chart */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Enhanced Task Completion</CardTitle>
                  <CardDescription>Breakdown by completion state</CardDescription>
                </CardHeader>
                <CardContent className="h-[300px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={enhancedTaskCompletionData}
                      margin={{ top: 10, right: 10, left: 0, bottom: 20 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" vertical={false} />
                      <XAxis dataKey="name" />
                      <YAxis />
                      <Tooltip />
                      <Bar dataKey="completed" name="Completed" fill="#22C55E" stackId="a" />
                      <Bar dataKey="consensus_created" name="Consensus Created" fill="#3B82F6" stackId="a" />
                      <Bar dataKey="quality_failed" name="Quality Failed" fill="#F59E0B" stackId="a" />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Workflow Health Distribution</CardTitle>
                  <CardDescription>Discussion states across the workflow</CardDescription>
                </CardHeader>
                <CardContent className="h-[300px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={workflowHealthData}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                        outerRadius={80}
                        fill="#8884d8"
                        dataKey="value"
                        nameKey="name"
                      >
                        {workflowHealthData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </div>

            {/* Key Metrics Summary */}
            <Card>
              <CardHeader>
                <CardTitle>Key Performance Indicators</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="p-4 border rounded-lg">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-gray-600">Stuck Discussions</p>
                        <p className="text-2xl font-bold text-red-600">
                          {safeSystemSummary.bottleneckAnalysis.total_stuck_discussions}
                        </p>
                      </div>
                      <AlertTriangle className="h-8 w-8 text-red-500" />
                    </div>
                  </div>
                  <div className="p-4 border rounded-lg">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-gray-600">Blocked/Rework</p>
                        <p className="text-2xl font-bold text-orange-600">
                          {safeSystemSummary.workflowHealth.blocked_discussions}
                        </p>
                      </div>
                      <Users className="h-8 w-8 text-orange-500" />
                    </div>
                  </div>
                  <div className="p-4 border rounded-lg">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-gray-600">Avg Task Completion</p>
                        <p className="text-2xl font-bold text-blue-600">
                          {safeSystemSummary.workflowHealth.average_task_completion.toFixed(1)}
                        </p>
                      </div>
                      <Target className="h-8 w-8 text-blue-500" />
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* NEW: Bottlenecks Analysis Tab */}
          <TabsContent value="bottlenecks" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Workflow Bottlenecks Analysis</CardTitle>
                <CardDescription>
                  Identify where discussions are stuck and need intervention
                </CardDescription>
              </CardHeader>
              <CardContent>
                {bottleneckData.length > 0 ? (
                  <div className="h-[300px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart
                        data={bottleneckData}
                        margin={{ top: 10, right: 30, left: 20, bottom: 20 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" vertical={false} />
                        <XAxis dataKey="name" angle={-45} textAnchor="end" height={100} />
                        <YAxis />
                        <Tooltip />
                        <Bar dataKey="value" fill="#EF4444">
                          {bottleneckData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                ) : (
                  <div className="text-center py-8 text-gray-500">
                    <Target className="h-12 w-12 mx-auto mb-4 text-green-500" />
                    <p className="text-lg font-medium text-green-600">No Bottlenecks Detected!</p>
                    <p>All discussions are progressing smoothly through the workflow.</p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Detailed Stuck Discussions */}
            {safeSystemSummary.bottleneckAnalysis.stuck_details.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle>Stuck Discussions Detail</CardTitle>
                  <CardDescription>
                    Specific discussions that need attention
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3 max-h-96 overflow-y-auto">
                    {safeSystemSummary.bottleneckAnalysis.stuck_details.slice(0, 10).map((stuck, index) => (
                      <div key={index} className="p-3 border rounded-lg">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <p className="font-medium text-sm truncate">{stuck.discussion_title}</p>
                            <p className="text-xs text-gray-500 mb-2">ID: {stuck.discussion_id}</p>
                            <div className="flex flex-wrap gap-1">
                              {stuck.stuck_reasons.map((reason, reasonIndex) => (
                                <Badge key={reasonIndex} variant="outline" className="text-xs">
                                  {reason}
                                </Badge>
                              ))}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                    {safeSystemSummary.bottleneckAnalysis.stuck_details.length > 10 && (
                      <p className="text-xs text-gray-500 text-center pt-2">
                        +{safeSystemSummary.bottleneckAnalysis.stuck_details.length - 10} more stuck discussions
                      </p>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* NEW: Workflow Health Tab */}
          <TabsContent value="health" className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <Card className="border-l-4 border-green-500">
                <CardContent className="pt-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-green-700">Healthy</p>
                      <p className="text-2xl font-bold">{safeSystemSummary.workflowHealth.healthy_discussions}</p>
                    </div>
                    <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center">
                      <div className="w-4 h-4 bg-green-500 rounded-full"></div>
                    </div>
                  </div>
                </CardContent>
              </Card>
              
              <Card className="border-l-4 border-blue-500">
                <CardContent className="pt-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-blue-700">Consensus Pending</p>
                      <p className="text-2xl font-bold">{safeSystemSummary.workflowHealth.consensus_pending}</p>
                    </div>
                    <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                      <div className="w-4 h-4 bg-blue-500 rounded-full"></div>
                    </div>
                  </div>
                </CardContent>
              </Card>
              
              <Card className="border-l-4 border-yellow-500">
                <CardContent className="pt-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-yellow-700">Quality Issues</p>
                      <p className="text-2xl font-bold">{safeSystemSummary.workflowHealth.quality_issues}</p>
                    </div>
                    <div className="w-8 h-8 bg-yellow-100 rounded-full flex items-center justify-center">
                      <div className="w-4 h-4 bg-yellow-500 rounded-full"></div>
                    </div>
                  </div>
                </CardContent>
              </Card>
              
              <Card className="border-l-4 border-red-500">
                <CardContent className="pt-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-red-700">Blocked/Rework</p>
                      <p className="text-2xl font-bold">{safeSystemSummary.workflowHealth.blocked_discussions}</p>
                    </div>
                    <div className="w-8 h-8 bg-red-100 rounded-full flex items-center justify-center">
                      <div className="w-4 h-4 bg-red-500 rounded-full"></div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Actionable Insights */}
            {safeSystemSummary.actionableInsights && safeSystemSummary.actionableInsights.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle>Actionable Insights</CardTitle>
                  <CardDescription>
                    System-generated recommendations for workflow optimization
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {safeSystemSummary.actionableInsights.map((insight, index) => (
                      <div key={index} className={`p-4 border rounded-lg ${
                        insight.priority === 'high' ? 'border-red-200 bg-red-50' :
                        insight.priority === 'medium' ? 'border-yellow-200 bg-yellow-50' :
                        'border-blue-200 bg-blue-50'
                      }`}>
                        <div className="flex items-start gap-3">
                          <div className="flex-shrink-0 mt-1">
                            {insight.priority === 'high' && <AlertTriangle className="h-5 w-5 text-red-600" />}
                            {insight.priority === 'medium' && <AlertTriangle className="h-5 w-5 text-yellow-600" />}
                            {insight.priority === 'low' && <Target className="h-5 w-5 text-blue-600" />}
                          </div>
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-2">
                              <Badge variant={
                                insight.priority === 'high' ? 'destructive' :
                                insight.priority === 'medium' ? 'default' : 'secondary'
                              }>
                                {insight.priority} priority
                              </Badge>
                              <span className="text-xs text-gray-500 capitalize">
                                {insight.type.replace('_', ' ')}
                              </span>
                            </div>
                            <p className="text-sm mb-2">{insight.message}</p>
                            <p className="text-xs text-gray-600 font-medium">
                              Action: {insight.action}
                            </p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* Activity Tab - Keep existing but enhance */}
          <TabsContent value="activity">
            <Card>
              <CardHeader>
                <div className="flex justify-between items-center">
                  <CardTitle>Annotation Activity</CardTitle>
                  <div className="flex items-center space-x-2">
                    <Button variant="outline" size="sm" onClick={() => setChartView('bar')} className={chartView === 'bar' ? 'bg-muted' : ''}>
                      <BarChart3 className="h-4 w-4" />
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => setChartView('pie')} className={chartView === 'pie' ? 'bg-muted' : ''}>
                      <PieChartIcon className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  {chartView === 'bar' ? (
                    <BarChart
                      data={annotationActivity}
                      margin={{ top: 10, right: 10, left: 10, bottom: 20 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" vertical={false} />
                      <XAxis dataKey="date" tickFormatter={formatDate} />
                      <YAxis />
                      <Tooltip
                        content={({ active, payload }) => {
                          if (active && payload && payload.length) {
                            return (
                              <div className="bg-white border p-2 shadow-md">
                                <p className="font-medium">{`Date: ${formatDate(payload[0].payload.date)}`}</p>
                                <p>{`Annotations: ${payload[0].value}`}</p>
                              </div>
                            );
                          }
                          return null;
                        }}
                      />
                      <Bar dataKey="count" fill="#0088FE" />
                    </BarChart>
                  ) : (
                    <PieChart>
                      <Pie
                        data={annotationActivity}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        label={({ date, count, percent }) => 
                          `${formatDate(date)}: ${(percent * 100).toFixed(0)}%`
                        }
                        outerRadius={80}
                        fill="#8884d8"
                        dataKey="count"
                        nameKey="date"
                      >
                        {annotationActivity.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  )}
                </ResponsiveContainer>
              </CardContent>
              <CardFooter>
                <div className="text-sm text-muted-foreground">
                  {dateRange?.from && dateRange?.to ? (
                    <p>Showing data from {format(dateRange.from, 'MMM dd, yyyy')} to {format(dateRange.to, 'MMM dd, yyyy')}</p>
                  ) : (
                    <p>Select a date range to filter data</p>
                  )}
                </div>
              </CardFooter>
            </Card>
          </TabsContent>

          {/* Repositories Tab - Keep existing */}
          <TabsContent value="repositories">
            <Card>
              <CardHeader>
                <CardTitle>Repository Distribution</CardTitle>
                <CardDescription>
                  Breakdown of discussions by repository
                </CardDescription>
              </CardHeader>
              <CardContent className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={repositoryBreakdown}
                    layout="vertical"
                    margin={{ top: 5, right: 30, left: 80, bottom: 5 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} />
                    <XAxis type="number" />
                    <YAxis type="category" dataKey="repository" width={80} />
                    <Tooltip
                      content={({ active, payload }) => {
                        if (active && payload && payload.length) {
                          return (
                            <div className="bg-white border p-2 shadow-md">
                              <p className="font-medium">{`${payload[0].payload.repository}`}</p>
                              <p>{`Discussions: ${payload[0].value}`}</p>
                            </div>
                          );
                        }
                        return null;
                      }}
                    />
                    <Bar dataKey="count" fill="#00C49F" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Enhanced Debug Section */}
        {process.env.NODE_ENV === 'development' && (
          <Card className="mt-6 bg-gray-50">
            <CardHeader>
              <CardTitle className="text-sm text-gray-600">Enhanced Debug Info (Dev Only)</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-xs space-y-2">
                <div>
                  <strong>API Data Source:</strong>{' '}
                  {systemSummary ? 'Live API data' : 'No data loaded'}
                </div>
                <div>
                  <strong>Last Fetch:</strong>{' '}
                  {lastUpdated ? lastUpdated.toISOString() : 'Never'}
                </div>
                <div>
                  <strong>Enhanced Bottleneck Analysis:</strong>{' '}
                  Total Stuck: {safeSystemSummary.bottleneckAnalysis.total_stuck_discussions}, 
                  Missing Annotations: {safeSystemSummary.bottleneckAnalysis.task1_missing_annotations + 
                                      safeSystemSummary.bottleneckAnalysis.task2_missing_annotations + 
                                      safeSystemSummary.bottleneckAnalysis.task3_missing_annotations}
                </div>
                <div>
                  <strong>Workflow Health:</strong>{' '}
                  Blocked: {safeSystemSummary.workflowHealth.blocked_discussions}, 
                  Completion Rate: {safeSystemSummary.workflowHealth.completion_rate}%
                </div>
                <div>
                  <strong>Task Progression:</strong>{' '}
                  Workflow Blocked: {safeSystemSummary.taskProgression.workflow_blocked} (includes rework/flagged)
                </div>
                <div>
                  <strong>Actionable Insights:</strong>{' '}
                  {safeSystemSummary.actionableInsights.length} insights available
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </CardContent>
    </Card>
  );
};

export default AnalyticsDashboard;