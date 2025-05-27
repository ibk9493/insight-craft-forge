// Save this as: components/admin/ConsensusReviewDashboard.tsx

import React, { useState, useEffect } from 'react';
import { 
  Card, 
  CardContent, 
  CardDescription, 
  CardHeader, 
  CardTitle 
} from '@/components/ui/card';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { 
  CheckCircle, 
  AlertCircle, 
  Clock, 
  Search, 
  RefreshCw, 
  Eye, 
  Edit, 
  Zap,
  Target,
  PlayCircle,
  Loader
} from 'lucide-react';
import { api } from '@/services/api';
import { useUser } from '@/contexts/UserContext';

interface ConsensusCandidate {
  discussion_id: string;
  discussion_title: string;
  task_id: number;
  agreement_rate: number;
  annotator_count: number;
  required_annotators: number;
  agreement_details?: any;
}

interface UnlockCandidate {
  discussion_id: string;
  discussion_title: string;
  completed_task_id: number;
  next_task_id: number;
  consensus_meets_criteria: boolean;
  current_next_task_status: string;
}

interface GeneralReport {
  ready_for_consensus: ConsensusCandidate[];
  ready_for_task_unlock: UnlockCandidate[];
  workflow_summary: {
    discussions_ready_for_consensus: number;
    discussions_ready_for_unlock: number;
    fully_completed_discussions: number;
  };
}

const ConsensusReviewDashboard: React.FC = () => {
  const { isAdmin, isPodLead } = useUser();
  const [isLoading, setIsLoading] = useState(false);
  const [generalReport, setGeneralReport] = useState<GeneralReport | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [taskFilter, setTaskFilter] = useState<string>('all');
  const [activeTab, setActiveTab] = useState<'consensus' | 'unlock'>('consensus');
  const [autoCreateLoading, setAutoCreateLoading] = useState(false);

  useEffect(() => {
    loadConsensusData();
  }, []);

  const loadConsensusData = async () => {
    setIsLoading(true);
    try {
      const report = await api.workflow.generalReport();
      setGeneralReport(report);
    } catch (error) {
      console.error('Error loading consensus data:', error);
      toast.error('Failed to load consensus data');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateConsensus = async (discussionId: string, taskId: number) => {
    try {
      // For now, just show a toast. In a real implementation, you might:
      // 1. Navigate to the consensus creation page
      // 2. Open a modal for consensus creation
      // 3. Auto-create if agreement is high enough
      toast.info(`Creating consensus for ${discussionId} Task ${taskId}`);
      
      // Example: Navigate to discussion with consensus creation mode
      // navigate(`/discussion/${discussionId}?task=${taskId}&mode=consensus`);
    } catch (error) {
      toast.error('Failed to create consensus');
    }
  };

  const handleAutoCreateConsensus = async (dryRun: boolean = false) => {
    setAutoCreateLoading(true);
    try {
      const result = await api.workflow.autoCreateConsensus(dryRun, 90.0);
      
      if (dryRun) {
        toast.info(`Preview: Would create ${result.successful_creations || 0} consensus annotations`);
      } else {
        toast.success(`Successfully created ${result.successful_creations || 0} consensus annotations`);
        await loadConsensusData(); // Refresh data
      }
    } catch (error) {
      console.error('Error with auto-create consensus:', error);
      toast.error('Failed to process consensus creation');
    } finally {
      setAutoCreateLoading(false);
    }
  };

  const handleUnlockTask = async (discussionId: string, taskId: number) => {
    try {
      const result = await api.admin.updateTaskStatus(discussionId, taskId, 'unlocked');
      if (result.success) {
        toast.success(`Task ${taskId} unlocked for discussion ${discussionId}`);
        await loadConsensusData(); // Refresh data
      } else {
        toast.error('Failed to unlock task');
      }
    } catch (error) {
      toast.error('Failed to unlock task');
    }
  };

  // Filter functions
  const filterConsensusItems = (items: ConsensusCandidate[]) => {
    return items.filter(item => {
      const matchesSearch = item.discussion_title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           item.discussion_id.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesTask = taskFilter === 'all' || item.task_id.toString() === taskFilter;
      return matchesSearch && matchesTask;
    });
  };

  const filterUnlockItems = (items: UnlockCandidate[]) => {
    return items.filter(item => {
      const matchesSearch = item.discussion_title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           item.discussion_id.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesTask = taskFilter === 'all' || item.completed_task_id.toString() === taskFilter;
      return matchesSearch && matchesTask;
    });
  };

  if (isLoading && !generalReport) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col items-center justify-center py-12">
            <Loader className="h-8 w-8 animate-spin text-blue-600 mb-4" />
            <p className="text-gray-500">Loading consensus review data...</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const consensusItems = generalReport?.ready_for_consensus || [];
  const unlockItems = generalReport?.ready_for_task_unlock || [];
  const filteredConsensusItems = filterConsensusItems(consensusItems);
  const filteredUnlockItems = filterUnlockItems(unlockItems);

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center">
              <div className="p-2 bg-blue-100 rounded-lg">
                <Target className="h-6 w-6 text-blue-600" />
              </div>
              <div className="ml-4">
                <p className="text-2xl font-bold">{generalReport?.workflow_summary.discussions_ready_for_consensus || 0}</p>
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
                <p className="text-2xl font-bold">{generalReport?.workflow_summary.discussions_ready_for_unlock || 0}</p>
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
                <p className="text-2xl font-bold">{generalReport?.workflow_summary.fully_completed_discussions || 0}</p>
                <p className="text-xs text-gray-500">Fully Completed</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <CardTitle>Consensus Management</CardTitle>
              <CardDescription>
                Review and manage consensus creation and task progression
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Button 
                onClick={loadConsensusData}
                disabled={isLoading}
                variant="outline"
                size="sm"
              >
                <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
                Refresh
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col sm:flex-row gap-4 mb-6">
            <div className="flex-1">
              <Input
                placeholder="Search discussions..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="max-w-md"
              />
            </div>
            <Select value={taskFilter} onValueChange={setTaskFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Filter by task" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Tasks</SelectItem>
                <SelectItem value="1">Task 1</SelectItem>
                <SelectItem value="2">Task 2</SelectItem>
                <SelectItem value="3">Task 3</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Tab Selection */}
          <div className="flex border-b border-gray-200 mb-6">
            <button
              className={`px-4 py-2 font-medium text-sm ${
                activeTab === 'consensus'
                  ? 'border-b-2 border-blue-500 text-blue-600'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
              onClick={() => setActiveTab('consensus')}
            >
              Ready for Consensus ({filteredConsensusItems.length})
            </button>
            <button
              className={`px-4 py-2 font-medium text-sm ml-6 ${
                activeTab === 'unlock'
                  ? 'border-b-2 border-blue-500 text-blue-600'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
              onClick={() => setActiveTab('unlock')}
            >
              Ready to Unlock ({filteredUnlockItems.length})
            </button>
          </div>

          {/* Consensus Creation Tab */}
          {activeTab === 'consensus' && (
            <div className="space-y-4">
              {/* Auto-create consensus controls */}
              {(isAdmin || isPodLead) && filteredConsensusItems.length > 0 && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <div className="flex justify-between items-center">
                    <div>
                      <h4 className="font-medium text-blue-900">Auto-Create Consensus</h4>
                      <p className="text-sm text-blue-700">
                        Automatically create consensus for discussions with 90%+ agreement
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleAutoCreateConsensus(true)}
                        disabled={autoCreateLoading}
                      >
                        <Eye className="h-4 w-4 mr-2" />
                        Preview
                      </Button>
                      <Button
                        size="sm"
                        onClick={() => handleAutoCreateConsensus(false)}
                        disabled={autoCreateLoading}
                      >
                        <Zap className="h-4 w-4 mr-2" />
                        {autoCreateLoading ? 'Creating...' : 'Create All'}
                      </Button>
                    </div>
                  </div>
                </div>
              )}

              {/* Consensus candidates table */}
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Discussion</TableHead>
                      <TableHead className="w-[100px]">Task</TableHead>
                      <TableHead className="w-[120px]">Agreement</TableHead>
                      <TableHead className="w-[120px]">Annotators</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredConsensusItems.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                          {consensusItems.length === 0 
                            ? "No discussions ready for consensus creation"
                            : "No discussions match your filters"
                          }
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredConsensusItems.map((item) => (
                        <TableRow key={`${item.discussion_id}-${item.task_id}`}>
                          <TableCell>
                            <div>
                              <p className="font-medium truncate max-w-[300px]" title={item.discussion_title}>
                                {item.discussion_title}
                              </p>
                              <p className="text-xs text-gray-500">{item.discussion_id}</p>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline">Task {item.task_id}</Badge>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-medium">
                                {item.agreement_rate.toFixed(0)}%
                              </span>
                              {item.agreement_rate >= 90 ? (
                                <CheckCircle className="h-4 w-4 text-green-600" />
                              ) : item.agreement_rate >= 75 ? (
                                <AlertCircle className="h-4 w-4 text-yellow-600" />
                              ) : (
                                <AlertCircle className="h-4 w-4 text-red-600" />
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            <span className="text-sm">
                              {item.annotator_count}/{item.required_annotators}
                            </span>
                          </TableCell>
                          <TableCell className="text-right">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleCreateConsensus(item.discussion_id, item.task_id)}
                            >
                              <Edit className="h-4 w-4 mr-2" />
                              Create
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}

          {/* Task Unlock Tab */}
          {activeTab === 'unlock' && (
            <div className="space-y-4">
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Discussion</TableHead>
                      <TableHead className="w-[120px]">Completed</TableHead>
                      <TableHead className="w-[120px]">Next Task</TableHead>
                      <TableHead className="w-[140px]">Criteria Met</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredUnlockItems.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                          {unlockItems.length === 0 
                            ? "No tasks ready for unlocking"
                            : "No tasks match your filters"
                          }
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredUnlockItems.map((item) => (
                        <TableRow key={`${item.discussion_id}-${item.completed_task_id}`}>
                          <TableCell>
                            <div>
                              <p className="font-medium truncate max-w-[300px]" title={item.discussion_title}>
                                {item.discussion_title}
                              </p>
                              <p className="text-xs text-gray-500">{item.discussion_id}</p>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge className="bg-green-100 text-green-800">
                              Task {item.completed_task_id}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline">
                              Task {item.next_task_id}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            {item.consensus_meets_criteria ? (
                              <Badge className="bg-green-100 text-green-800">
                                <CheckCircle className="h-3 w-3 mr-1" />
                                Yes
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="border-yellow-500 text-yellow-600">
                                <Clock className="h-3 w-3 mr-1" />
                                Pending
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell className="text-right">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleUnlockTask(item.discussion_id, item.next_task_id)}
                              disabled={item.current_next_task_status !== 'locked'}
                            >
                              <PlayCircle className="h-4 w-4 mr-2" />
                              {item.current_next_task_status === 'locked' ? 'Unlock' : 'Already Unlocked'}
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default ConsensusReviewDashboard;