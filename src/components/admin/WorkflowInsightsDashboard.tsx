import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import { toast } from 'sonner';
import { 
  Activity, 
  Users, 
  CheckCircle, 
  Clock, 
  AlertTriangle, 
  TrendingUp,
  BarChart3,
  UserCheck,
  Zap,
  Target,
  RefreshCw,
  Eye,
  Settings,
  ChevronRight,
  PlayCircle,
  Lock
} from 'lucide-react';
import { useUser } from '@/contexts/UserContext';
import { api } from '@/services/api';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs-wrapper';

// Types for our API responses
interface GeneralReport {
  report_timestamp: string;
  total_discussions: number;
  ready_for_consensus: ConsensusCandidate[];
  ready_for_task_unlock: UnlockCandidate[];
  workflow_summary: {
    discussions_ready_for_consensus: number;
    discussions_ready_for_unlock: number;
    fully_completed_discussions: number;
    blocked_discussions: number;
  };
  task_breakdown: {
    [key: string]: {
      ready_for_consensus: number;
      ready_for_unlock: number;
      completed: number;
    };
  };
  recommendations: Recommendation[];
}

interface ConsensusCandidate {
  discussion_id: string;
  discussion_title: string;
  task_id: number;
  agreement_rate: number;
  annotator_count: number;
  required_annotators: number;
}

interface UnlockCandidate {
  discussion_id: string;
  discussion_title: string;
  completed_task_id: number;
  next_task_id: number;
  consensus_meets_criteria: boolean;
  current_next_task_status: string;
}

interface Recommendation {
  type: string;
  message: string;
  priority: 'high' | 'medium' | 'low' | 'info';
  action?: string;
}

interface UserAgreementSummary {
  user_id: string;
  total_annotations: number;
  annotations_with_consensus: number;
  agreement_rate: number;
  status: 'excellent' | 'good' | 'needs_improvement' | 'needs_training' | 'no_data' | 'error';
}

interface AllUsersOverview {
  total_users: number;
  users: UserAgreementSummary[];
  users_needing_training: UserAgreementSummary[];
  summary: {
    excellent_users: number;
    good_users: number;
    users_needing_improvement: number;
    users_needing_training: number;
    users_with_no_data: number;
    users_with_errors: number;
  };
}

const WorkflowInsightsDashboard: React.FC = () => {
  const { isAdmin, isPodLead, user } = useUser();
  const [generalReport, setGeneralReport] = useState<GeneralReport | null>(null);
  const [usersOverview, setUsersOverview] = useState<AllUsersOverview | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [autoCreateLoading, setAutoCreateLoading] = useState(false);

  // Load data on component mount
  useEffect(() => {
    loadAllData();
  }, []);

  const loadAllData = async () => {
    setIsLoading(true);
    try {
      await Promise.all([
        loadGeneralReport(),
        isAdmin ? loadUsersOverview() : Promise.resolve()
      ]);
      setLastUpdated(new Date());
    } catch (error) {
      console.error('Error loading dashboard data:', error);
      toast.error('Failed to load dashboard data');
    } finally {
      setIsLoading(false);
    }
  };

  const loadGeneralReport = async () => {
    try {
      console.log(' Loading general report...');
      const data = await api.workflow.generalReport();
      console.log(' General report loaded:', data);
      setGeneralReport(data);
    } catch (error) {
      console.error(' Error loading general report:', error);
      throw error;
    }
  };

  const loadUsersOverview = async () => {
    try {
      console.log('Loading users overview...');
      const data = await api.workflow.agreementOverview();
      console.log('Users overview loaded:', data);
      setUsersOverview(data);
    } catch (error) {
      console.error('Error loading users overview:', error);
      throw error;
    }
  };
  

  const handleAutoCreateConsensus = async (dryRun: boolean = true) => {
    setAutoCreateLoading(true);
    try {
      console.log(`${dryRun ? 'Previewing' : 'Creating'} consensus...`);
      const result = await api.workflow.autoCreateConsensus(dryRun, 95.0);
      console.log('Auto-create consensus result:', result);
      
      if (dryRun) {
        toast.info(`Preview: Would create ${result.successful_creations || 0} consensus annotations`);
      } else {
        toast.success(`Successfully created ${result.successful_creations || 0} consensus annotations`);
        await loadGeneralReport(); // Refresh data
      }
    } catch (error) {
      console.error('Error with auto-create consensus:', error);
      toast.error('Failed to process consensus creation');
    } finally {
      setAutoCreateLoading(false);
    }
  };
  

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high': return 'bg-red-100 text-red-800 border-red-200';
      case 'medium': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'low': return 'bg-blue-100 text-blue-800 border-blue-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'excellent': return 'bg-green-100 text-green-800';
      case 'good': return 'bg-blue-100 text-blue-800';
      case 'needs_improvement': return 'bg-yellow-100 text-yellow-800';
      case 'needs_training': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  if (!generalReport && !isLoading) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="text-center">
            <AlertTriangle className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium mb-2">No Data Available</h3>
            <p className="text-gray-500 mb-4">Unable to load workflow insights</p>
            <Button onClick={loadAllData}>Retry</Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header with Refresh */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold">Workflow Insights</h2>
          <p className="text-gray-500">
            Real-time workflow analysis and recommendations
            {lastUpdated && (
              <span className="ml-2 text-sm">
                • Last updated: {lastUpdated.toLocaleTimeString()}
              </span>
            )}
          </p>
        </div>
        <Button 
          onClick={loadAllData} 
          disabled={isLoading}
          variant="outline"
          size="sm"
        >
          <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {/* Quick Stats Cards */}
      {generalReport && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center">
                <div className="p-2 bg-blue-100 rounded-lg">
                  <Target className="h-6 w-6 text-blue-600" />
                </div>
                <div className="ml-4">
                  <p className="text-2xl font-bold">{generalReport.workflow_summary.discussions_ready_for_consensus}</p>
                  <p className="text-xs text-gray-500">Ready for Consensus</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center">
                <div className="p-2 bg-green-100 rounded-lg">
                  <PlayCircle className="h-6 w-6 text-green-600" />
                </div>
                <div className="ml-4">
                  <p className="text-2xl font-bold">{generalReport.workflow_summary.discussions_ready_for_unlock}</p>
                  <p className="text-xs text-gray-500">Ready to Unlock</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center">
                <div className="p-2 bg-purple-100 rounded-lg">
                  <CheckCircle className="h-6 w-6 text-purple-600" />
                </div>
                <div className="ml-4">
                  <p className="text-2xl font-bold">{generalReport.workflow_summary.fully_completed_discussions}</p>
                  <p className="text-xs text-gray-500">Fully Completed</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center">
                <div className="p-2 bg-orange-100 rounded-lg">
                  <BarChart3 className="h-6 w-6 text-orange-600" />
                </div>
                <div className="ml-4">
                  <p className="text-2xl font-bold">{generalReport.total_discussions}</p>
                  <p className="text-xs text-gray-500">Total Discussions</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Main Content Tabs */}
      <Tabs defaultValue="workflow" className="space-y-4">
        <TabsList>
          <TabsTrigger value="workflow" className="flex items-center gap-2">
            <Activity className="h-4 w-4" />
            Workflow Status
          </TabsTrigger>
          {isAdmin && (
            <TabsTrigger value="users" className="flex items-center gap-2">
              <Users className="h-4 w-4" />
              User Performance
            </TabsTrigger>
          )}
          <TabsTrigger value="recommendations" className="flex items-center gap-2">
            <Zap className="h-4 w-4" />
            Recommendations
          </TabsTrigger>
        </TabsList>

        {/* Workflow Status Tab */}
        <TabsContent value="workflow" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Ready for Consensus */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Target className="h-5 w-5 text-blue-600" />
                  Ready for Consensus Creation
                </CardTitle>
                <CardDescription>
                  Tasks with high agreement rates ready for consensus
                </CardDescription>
              </CardHeader>
              <CardContent>
                {generalReport?.ready_for_consensus.length === 0 ? (
                  <p className="text-gray-500 text-center py-4">No tasks ready for consensus</p>
                ) : (
                  <div className="space-y-3">
                    {generalReport?.ready_for_consensus.slice(0, 5).map((item, index) => (
                      <div key={index} className="flex items-center justify-between p-3 border rounded-lg">
                        <div className="flex-1">
                          <p className="font-medium text-sm truncate">{item.discussion_title}</p>
                          <p className="text-xs text-gray-500">
                            Task {item.task_id} • {item.agreement_rate}% agreement • {item.annotator_count}/{item.required_annotators} annotators
                          </p>
                        </div>
                        <Badge variant="outline" className="ml-2">
                          {item.agreement_rate}%
                        </Badge>
                      </div>
                    ))}
                    
                    {generalReport && generalReport.ready_for_consensus.length > 5 && (
                      <p className="text-xs text-gray-500 text-center pt-2">
                        +{generalReport.ready_for_consensus.length - 5} more tasks
                      </p>
                    )}
                    
                    {/* Auto-create consensus button */}
                    {generalReport && generalReport.ready_for_consensus.length > 0 && isAdmin && (
                      <div className="pt-4 border-t space-y-2">
                        <div className="flex gap-2">
                          <Button 
                            size="sm" 
                            variant="outline"
                            onClick={() => handleAutoCreateConsensus(true)}
                            disabled={autoCreateLoading}
                          >
                            <Eye className="h-4 w-4 mr-2" />
                            Preview Auto-Create
                          </Button>
                          <Button 
                            size="sm"
                            onClick={() => handleAutoCreateConsensus(false)}
                            disabled={autoCreateLoading}
                          >
                            <Zap className="h-4 w-4 mr-2" />
                            Auto-Create Consensus
                          </Button>
                        </div>
                        <p className="text-xs text-gray-500">
                          Auto-create consensus for tasks with 95%+ agreement
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Ready for Unlock */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <PlayCircle className="h-5 w-5 text-green-600" />
                  Ready for Task Unlock
                </CardTitle>
                <CardDescription>
                  Completed tasks that should unlock next steps
                </CardDescription>
              </CardHeader>
              <CardContent>
                {generalReport?.ready_for_task_unlock.length === 0 ? (
                  <p className="text-gray-500 text-center py-4">No tasks ready for unlock</p>
                ) : (
                  <div className="space-y-3">
                    {generalReport?.ready_for_task_unlock.slice(0, 5).map((item, index) => (
                      <div key={index} className="flex items-center justify-between p-3 border rounded-lg">
                        <div className="flex-1">
                          <p className="font-medium text-sm truncate">{item.discussion_title}</p>
                          <p className="text-xs text-gray-500">
                            Task {item.completed_task_id} completed → Unlock Task {item.next_task_id}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          {item.consensus_meets_criteria ? (
                            <Badge variant="default" className="bg-green-100 text-green-800">
                              Criteria Met
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="border-yellow-500 text-yellow-600">
                              Check Criteria
                            </Badge>
                          )}
                        </div>
                      </div>
                    ))}
                    
                    {generalReport && generalReport.ready_for_task_unlock.length > 5 && (
                      <p className="text-xs text-gray-500 text-center pt-2">
                        +{generalReport.ready_for_task_unlock.length - 5} more tasks
                      </p>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Task Breakdown */}
          {generalReport && (
            <Card>
              <CardHeader>
                <CardTitle>Task Progress Breakdown</CardTitle>
                <CardDescription>Status across all task types</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {Object.entries(generalReport.task_breakdown).map(([taskKey, stats]) => (
                    <div key={taskKey} className="p-4 border rounded-lg">
                      <h4 className="font-medium mb-3 capitalize">{taskKey.replace('_', ' ')}</h4>
                      <div className="space-y-2">
                        <div className="flex justify-between text-sm">
                          <span>Ready for Consensus:</span>
                          <Badge variant="outline">{stats.ready_for_consensus}</Badge>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span>Ready for Unlock:</span>
                          <Badge variant="outline">{stats.ready_for_unlock}</Badge>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span>Completed:</span>
                          <Badge className="bg-green-100 text-green-800">{stats.completed}</Badge>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* User Performance Tab - Admin Only */}
        {isAdmin && (
          <TabsContent value="users" className="space-y-4">
            {usersOverview && (
              <>
                {/* User Stats Overview */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <Card>
                    <CardContent className="pt-6">
                      <div className="text-center">
                        <p className="text-2xl font-bold text-green-600">{usersOverview.summary.excellent_users}</p>
                        <p className="text-xs text-gray-500">Excellent</p>
                      </div>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="pt-6">
                      <div className="text-center">
                        <p className="text-2xl font-bold text-blue-600">{usersOverview.summary.good_users}</p>
                        <p className="text-xs text-gray-500">Good</p>
                      </div>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="pt-6">
                      <div className="text-center">
                        <p className="text-2xl font-bold text-yellow-600">{usersOverview.summary.users_needing_improvement}</p>
                        <p className="text-xs text-gray-500">Needs Improvement</p>
                      </div>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="pt-6">
                      <div className="text-center">
                        <p className="text-2xl font-bold text-red-600">{usersOverview.summary.users_needing_training}</p>
                        <p className="text-xs text-gray-500">Needs Training</p>
                      </div>
                    </CardContent>
                  </Card>
                </div>

                {/* Users Needing Attention */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <AlertTriangle className="h-5 w-5 text-orange-600" />
                      Users Needing Training
                    </CardTitle>
                    <CardDescription>
                      Users with low agreement rates who may benefit from additional training
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    {usersOverview.users_needing_training.length === 0 ? (
                      <p className="text-gray-500 text-center py-4">All users performing well!</p>
                    ) : (
                      <div className="space-y-3">
                        {usersOverview.users_needing_training.map((user, index) => (
                          <div key={index} className="flex items-center justify-between p-3 border rounded-lg">
                            <div className="flex-1">
                              <p className="font-medium text-sm">{user.user_id}</p>
                              <p className="text-xs text-gray-500">
                                {user.total_annotations} annotations • {user.agreement_rate}% agreement rate
                              </p>
                            </div>
                            <div className="flex items-center gap-2">
                              <Badge className={getStatusColor(user.status)}>
                                {user.status.replace('_', ' ')}
                              </Badge>
                              <Button size="sm" variant="outline">
                                <UserCheck className="h-4 w-4 mr-2" />
                                View Details
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Top Performers */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <TrendingUp className="h-5 w-5 text-green-600" />
                      Top Performers
                    </CardTitle>
                    <CardDescription>Users with highest agreement rates</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {usersOverview.users
                        .filter(user => user.status === 'excellent')
                        .slice(0, 5)
                        .map((user, index) => (
                          <div key={index} className="flex items-center justify-between p-3 border rounded-lg">
                            <div className="flex-1">
                              <p className="font-medium text-sm">{user.user_id}</p>
                              <p className="text-xs text-gray-500">
                                {user.total_annotations} annotations • {user.agreement_rate}% agreement rate
                              </p>
                            </div>
                            <Badge className="bg-green-100 text-green-800">
                              Excellent
                            </Badge>
                          </div>
                        ))}
                    </div>
                  </CardContent>
                </Card>
              </>
            )}
          </TabsContent>
        )}

        {/* Recommendations Tab */}
        <TabsContent value="recommendations" className="space-y-4">
          {generalReport?.recommendations && generalReport.recommendations.length > 0 ? (
            <div className="space-y-4">
              {generalReport.recommendations.map((rec, index) => (
                <Alert key={index} className={`border-l-4 ${getPriorityColor(rec.priority)}`}>
                  <div className="flex items-start gap-3">
                    <div className="flex-shrink-0 mt-1">
                      {rec.priority === 'high' && <AlertTriangle className="h-5 w-5 text-red-600" />}
                      {rec.priority === 'medium' && <Clock className="h-5 w-5 text-yellow-600" />}
                      {rec.priority === 'low' && <Activity className="h-5 w-5 text-blue-600" />}
                      {rec.priority === 'info' && <CheckCircle className="h-5 w-5 text-green-600" />}
                    </div>
                    <div className="flex-1">
                      <AlertTitle className="capitalize">
                        {rec.type.replace('_', ' ')} • {rec.priority} Priority
                      </AlertTitle>
                      <AlertDescription className="mt-2">
                        <p className="mb-2">{rec.message}</p>
                        {rec.action && (
                          <p className="text-sm font-medium">
                            <span className="text-gray-600">Action:</span> {rec.action}
                          </p>
                        )}
                      </AlertDescription>
                    </div>
                  </div>
                </Alert>
              ))}
            </div>
          ) : (
            <Card>
              <CardContent className="pt-6">
                <div className="text-center py-8">
                  <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-4" />
                  <h3 className="text-lg font-medium mb-2">All Good!</h3>
                  <p className="text-gray-500">No urgent recommendations at this time.</p>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default WorkflowInsightsDashboard;