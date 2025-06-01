import React, { useState, useEffect, useCallback } from 'react';
import { 
  Card, 
  CardContent, 
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
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { api, Discussion, TaskStatus } from '@/services/api';
import { 
  Lock, 
  LockOpen, 
  Check, 
  Search, 
  RefreshCw, 
  ChevronLeft, 
  ChevronRight,
  Settings,
  AlertCircle,
  Flag,
  XCircle,
  ArrowRight,
  RotateCcw
} from 'lucide-react';



const TaskManager: React.FC = () => {
  const [discussions, setDiscussions] = useState<Discussion[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isUpdating, setIsUpdating] = useState<string | null>(null);
  
  // Search and pagination state
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [perPage, setPerPage] = useState(20);
  const [totalPages, setTotalPages] = useState(1);
  const [totalDiscussions, setTotalDiscussions] = useState(0);
  
  // Filter state
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [taskFilter, setTaskFilter] = useState<string>('all');

  // Debounced search
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState('');
  
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchQuery(searchQuery);
    }, 500);
    
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Get status icon and styling
  const getStatusDisplay = (status: TaskStatus) => {
    switch (status) {
      case 'locked':
        return {
          icon: <Lock className="w-4 h-4 text-gray-500" />,
          label: 'Locked',
          className: 'text-gray-600'
        };
      case 'unlocked':
        return {
          icon: <LockOpen className="w-4 h-4 text-blue-500" />,
          label: 'Unlocked',
          className: 'text-blue-600'
        };
      case 'completed':
        return {
          icon: <Check className="w-4 h-4 text-green-500" />,
          label: 'Completed',
          className: 'text-green-600'
        };
      case 'rework':
        return {
          icon: <RotateCcw className="w-4 h-4 text-orange-500" />,
          label: 'Needs Rework',
          className: 'text-orange-600'
        };
      case 'blocked':
        return {
          icon: <XCircle className="w-4 h-4 text-red-500" />,
          label: 'Blocked',
          className: 'text-red-600'
        };
      case 'ready_for_next':
        return {
          icon: <ArrowRight className="w-4 h-4 text-purple-500" />,
          label: 'Ready for Next',
          className: 'text-purple-600'
        };
      default:
        return {
          icon: <AlertCircle className="w-4 h-4 text-gray-400" />,
          label: status,
          className: 'text-gray-500'
        };
    }
  };

  // Fetch discussions with current filters/search/pagination
  const fetchDiscussions = useCallback(async (resetPage = false) => {
    setLoading(true);
    setError(null);
    
    try {
      const page = resetPage ? 1 : currentPage;
      
      const params: any = {
        page,
        per_page: perPage,
        search: debouncedSearchQuery.trim() || undefined,
      };

      // Add status filter for specific task
      if (statusFilter !== 'all' && taskFilter !== 'all') {
        params[`task${taskFilter}_status`] = statusFilter;
      }
      
      console.log('Fetching discussions for TaskManager:', params);
      
      const response = await api.discussions.getAll(params);
      
      setDiscussions(response.items || []);
      setTotalPages(response.pages || 1);
      setTotalDiscussions(response.total || 0);
      
      if (resetPage) {
        setCurrentPage(1);
      }
      
      console.log(`Loaded ${response.items?.length || 0} discussions (page ${page}/${response.pages || 1})`);
      
    } catch (error) {
      console.error('Error fetching discussions:', error);
      setError('Failed to load discussions');
      toast.error('Failed to load discussions');
    } finally {
      setLoading(false);
    }
  }, [currentPage, perPage, debouncedSearchQuery, statusFilter, taskFilter]);

  // Initial load and refresh when filters change
  useEffect(() => {
    fetchDiscussions(true);
  }, [debouncedSearchQuery, statusFilter, taskFilter, perPage]);

  // Fetch when page changes
  useEffect(() => {
    if (currentPage > 1) {
      fetchDiscussions(false);
    }
  }, [currentPage]);

  // Function to update task status using new API
  const updateTaskStatus = async (discussionId: string, taskId: number, status: TaskStatus) => {
    const updateKey = `${discussionId}-${taskId}`;
    setIsUpdating(updateKey);
    
    try {
      console.log('🔄 Updating task status:', { discussionId, taskId, status });
      
      const result = await api.taskFlags.updateTaskStatus(discussionId, taskId, status);
      
      if (result.success) {
        toast.success(result.message || 'Task status updated successfully');
        
        // Update the local discussion in the current list
        setDiscussions(prevDiscussions => 
          prevDiscussions.map(disc => {
            if (disc.id === discussionId) {
              const updated = { ...disc };
              if (taskId === 1) updated.tasks.task1.status = status;
              else if (taskId === 2) updated.tasks.task2.status = status;
              else if (taskId === 3) updated.tasks.task3.status = status;
              return updated;
            }
            return disc;
          })
        );
        
        console.log('Task status updated successfully');
        
        // Show additional info for special statuses
        if (result.auto_unlocked_next) {
          toast.success(`Next task automatically unlocked!`);
        }
      } else {
        toast.error(result.message || 'Failed to update task status');
        console.error('Task update failed:', result.message);
      }
    } catch (error) {
      console.error('Error updating task status:', error);
      toast.error('An error occurred while updating task status');
    } finally {
      setIsUpdating(null);
    }
  };

  // Handle page navigation
  const handlePageChange = (newPage: number) => {
    if (newPage >= 1 && newPage <= totalPages) {
      setCurrentPage(newPage);
    }
  };

  // Handle per page change
  const handlePerPageChange = (newPerPage: number) => {
    setPerPage(newPerPage);
    setCurrentPage(1);
  };

  // Refresh data
  const handleRefresh = () => {
    fetchDiscussions();
  };

  if (error && !discussions.length) {
    return (
      <Card className="w-full shadow-md">
        <CardContent className="pt-6">
          <div className="text-center space-y-4">
            <AlertCircle className="h-12 w-12 text-red-500 mx-auto" />
            <h3 className="text-lg font-medium text-red-600">Error Loading Discussions</h3>
            <p className="text-gray-600">{error}</p>
            <Button onClick={handleRefresh}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Retry
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full shadow-md">
      <CardHeader>
        <div className="flex flex-col space-y-4">
          <div className="flex justify-between items-center">
            <CardTitle className="flex items-center gap-2">
              <Settings className="h-5 w-5" />
              Task Management
            </CardTitle>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={handleRefresh}
              disabled={loading}
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </div>

          {/* Search and Filters */}
          <div className="flex flex-col lg:flex-row gap-4">
            <div className="flex gap-2 flex-1">
              <div className="relative flex-1">
                <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  type="text"
                  placeholder="Search discussions by title or repository..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-8"
                />
              </div>
            </div>

            <div className="flex gap-2 flex-wrap">
              <Select value={taskFilter} onValueChange={setTaskFilter}>
                <SelectTrigger className="w-[120px]">
                  <SelectValue placeholder="Filter task" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Tasks</SelectItem>
                  <SelectItem value="1">Task 1</SelectItem>
                  <SelectItem value="2">Task 2</SelectItem>
                  <SelectItem value="3">Task 3</SelectItem>
                </SelectContent>
              </Select>

              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[160px]">
                  <SelectValue placeholder="Filter by status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="locked">Locked</SelectItem>
                  <SelectItem value="unlocked">Unlocked</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                  <SelectItem value="rework">Needs Rework</SelectItem>
                  <SelectItem value="blocked">Blocked</SelectItem>
                  <SelectItem value="ready_for_next">Ready for Next</SelectItem>
                </SelectContent>
              </Select>

              <Select value={perPage.toString()} onValueChange={(value) => handlePerPageChange(Number(value))}>
                <SelectTrigger className="w-[100px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="10">10</SelectItem>
                  <SelectItem value="20">20</SelectItem>
                  <SelectItem value="50">50</SelectItem>
                  <SelectItem value="100">100</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Status Info */}
          <div className="text-sm text-gray-500">
            Showing {discussions.length} of {totalDiscussions} discussions 
            {searchQuery && ` (filtered by "${searchQuery}")`}
            {statusFilter !== 'all' && ` (${statusFilter} status only)`}
            {taskFilter !== 'all' && ` (Task ${taskFilter} only)`}
            • Page {currentPage} of {totalPages}
          </div>
        </div>
      </CardHeader>

      <CardContent>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Discussion</TableHead>
                <TableHead>Repository</TableHead>
                <TableHead className="w-[140px] text-center">
                  Task 1
                  <div className="text-xs text-gray-500 font-normal">Question Quality</div>
                </TableHead>
                <TableHead className="w-[140px] text-center">
                  Task 2
                  <div className="text-xs text-gray-500 font-normal">Answer Quality</div>
                </TableHead>
                <TableHead className="w-[140px] text-center">
                  Task 3
                  <div className="text-xs text-gray-500 font-normal">Rewrite</div>
                </TableHead>
                <TableHead className="w-[100px] text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading && discussions.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8">
                    <RefreshCw className="h-6 w-6 animate-spin mx-auto mb-2" />
                    <p className="text-gray-500">Loading discussions...</p>
                  </TableCell>
                </TableRow>
              ) : discussions.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-gray-500">
                    No discussions found
                    {(searchQuery || statusFilter !== 'all' || taskFilter !== 'all') && (
                      <p className="mt-2 text-sm">
                        Try adjusting your search term or filters
                      </p>
                    )}
                  </TableCell>
                </TableRow>
              ) : (
                discussions.map((discussion) => (
                  <TableRow key={discussion.id}>
                    <TableCell className="font-medium max-w-[200px]">
                      <div className="truncate">
                        {discussion.title}
                      </div>
                      {isUpdating?.includes(discussion.id) && (
                        <div className="flex items-center mt-1">
                          <RefreshCw className="w-3 h-3 animate-spin text-blue-500 mr-1" />
                          <span className="text-xs text-blue-500">Updating...</span>
                        </div>
                      )}
                    </TableCell>
                    <TableCell>{discussion.repository}</TableCell>
                    
                    {/* Task 1 Status */}
                    <TableCell>
                      <Select
                        value={discussion.tasks.task1.status}
                        onValueChange={(value: TaskStatus) => updateTaskStatus(discussion.id, 1, value)}
                        disabled={isUpdating === `${discussion.id}-1`}
                      >
                        <SelectTrigger className="w-full h-8">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="locked">
                            <div className="flex items-center">
                              <Lock className="w-4 h-4 mr-2 text-gray-500" />
                              <span>Locked</span>
                            </div>
                          </SelectItem>
                          <SelectItem value="unlocked">
                            <div className="flex items-center">
                              <LockOpen className="w-4 h-4 mr-2 text-blue-500" />
                              <span>Unlocked</span>
                            </div>
                          </SelectItem>
                          <SelectItem value="completed">
                            <div className="flex items-center">
                              <Check className="w-4 h-4 mr-2 text-green-500" />
                              <span>Completed</span>
                            </div>
                          </SelectItem>
                          <SelectItem value="rework">
                            <div className="flex items-center">
                              <RotateCcw className="w-4 h-4 mr-2 text-orange-500" />
                              <span>Needs Rework</span>
                            </div>
                          </SelectItem>
                          <SelectItem value="blocked">
                            <div className="flex items-center">
                              <XCircle className="w-4 h-4 mr-2 text-red-500" />
                              <span>Blocked</span>
                            </div>
                          </SelectItem>
                          <SelectItem value="ready_for_next">
                            <div className="flex items-center">
                              <ArrowRight className="w-4 h-4 mr-2 text-purple-500" />
                              <span>Ready for Next</span>
                            </div>
                          </SelectItem>
                        </SelectContent>
                      </Select>
                      <div className="text-xs text-gray-500 mt-1">
                        {discussion.tasks.task1.annotators} annotators
                      </div>
                    </TableCell>
                    
                    {/* Task 2 Status */}
                    <TableCell>
                      <Select
                        value={discussion.tasks.task2.status}
                        onValueChange={(value: TaskStatus) => updateTaskStatus(discussion.id, 2, value)}
                        disabled={isUpdating === `${discussion.id}-2`}
                      >
                        <SelectTrigger className="w-full h-8">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="locked">
                            <div className="flex items-center">
                              <Lock className="w-4 h-4 mr-2 text-gray-500" />
                              <span>Locked</span>
                            </div>
                          </SelectItem>
                          <SelectItem value="unlocked">
                            <div className="flex items-center">
                              <LockOpen className="w-4 h-4 mr-2 text-blue-500" />
                              <span>Unlocked</span>
                            </div>
                          </SelectItem>
                          <SelectItem value="completed">
                            <div className="flex items-center">
                              <Check className="w-4 h-4 mr-2 text-green-500" />
                              <span>Completed</span>
                            </div>
                          </SelectItem>
                          <SelectItem value="rework">
                            <div className="flex items-center">
                              <RotateCcw className="w-4 h-4 mr-2 text-orange-500" />
                              <span>Needs Rework</span>
                            </div>
                          </SelectItem>
                          <SelectItem value="blocked">
                            <div className="flex items-center">
                              <XCircle className="w-4 h-4 mr-2 text-red-500" />
                              <span>Blocked</span>
                            </div>
                          </SelectItem>
                          <SelectItem value="ready_for_next">
                            <div className="flex items-center">
                              <ArrowRight className="w-4 h-4 mr-2 text-purple-500" />
                              <span>Ready for Next</span>
                            </div>
                          </SelectItem>
                        </SelectContent>
                      </Select>
                      <div className="text-xs text-gray-500 mt-1">
                        {discussion.tasks.task2.annotators} annotators
                      </div>
                    </TableCell>
                    
                    {/* Task 3 Status */}
                    <TableCell>
                      <Select
                        value={discussion.tasks.task3.status}
                        onValueChange={(value: TaskStatus) => updateTaskStatus(discussion.id, 3, value)}
                        disabled={isUpdating === `${discussion.id}-3`}
                      >
                        <SelectTrigger className="w-full h-8">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="locked">
                            <div className="flex items-center">
                              <Lock className="w-4 h-4 mr-2 text-gray-500" />
                              <span>Locked</span>
                            </div>
                          </SelectItem>
                          <SelectItem value="unlocked">
                            <div className="flex items-center">
                              <LockOpen className="w-4 h-4 mr-2 text-blue-500" />
                              <span>Unlocked</span>
                            </div>
                          </SelectItem>
                          <SelectItem value="completed">
                            <div className="flex items-center">
                              <Check className="w-4 h-4 mr-2 text-green-500" />
                              <span>Completed</span>
                            </div>
                          </SelectItem>
                          <SelectItem value="rework">
                            <div className="flex items-center">
                              <RotateCcw className="w-4 h-4 mr-2 text-orange-500" />
                              <span>Needs Rework</span>
                            </div>
                          </SelectItem>
                          <SelectItem value="blocked">
                            <div className="flex items-center">
                              <XCircle className="w-4 h-4 mr-2 text-red-500" />
                              <span>Blocked</span>
                            </div>
                          </SelectItem>
                          <SelectItem value="ready_for_next">
                            <div className="flex items-center">
                              <ArrowRight className="w-4 h-4 mr-2 text-purple-500" />
                              <span>Ready for Next</span>
                            </div>
                          </SelectItem>
                        </SelectContent>
                      </Select>
                      <div className="text-xs text-gray-500 mt-1">
                        {discussion.tasks.task3.annotators} annotators
                      </div>
                    </TableCell>
                    
                    <TableCell className="text-right">
                      <Button 
                        variant="outline" 
                        size="sm" 
                        onClick={() => window.open(discussion.url, '_blank')}
                      >
                        View
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        {/* Enhanced Status Legend */}
        <div className="mt-4 p-4 bg-gray-50 rounded-lg">
          <h4 className="text-sm font-medium text-gray-700 mb-3">Status Legend</h4>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            {[
              { status: 'locked', label: 'Locked', description: 'Cannot be started' },
              { status: 'unlocked', label: 'Unlocked', description: 'Can be worked on' },
              { status: 'completed', label: 'Completed', description: 'Finished successfully' },
              { status: 'rework', label: 'Needs Rework', description: 'Flagged for issues' },
              { status: 'blocked', label: 'Blocked', description: 'Has serious problems' },
              { status: 'ready_for_next', label: 'Ready for Next', description: 'Will unlock next task' }
            ].map((item) => {
              const display = getStatusDisplay(item.status as TaskStatus);
              return (
                <div key={item.status} className="flex items-start gap-2">
                  <div className="flex items-center gap-1">
                    {display.icon}
                    <span className={`text-xs font-medium ${display.className}`}>
                      {item.label}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex justify-center items-center gap-2 mt-6">
            <Button
              variant="outline"
              size="sm"
              onClick={() => handlePageChange(1)}
              disabled={currentPage <= 1 || loading}
            >
              First
            </Button>
            
            <Button
              variant="outline"
              size="sm"
              onClick={() => handlePageChange(currentPage - 1)}
              disabled={currentPage <= 1 || loading}
            >
              <ChevronLeft className="h-4 w-4" />
              Previous
            </Button>
            
            <div className="flex items-center gap-1">
              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                const startPage = Math.max(1, currentPage - 2);
                const pageNum = startPage + i;
                
                if (pageNum > totalPages) return null;
                
                return (
                  <Button
                    key={pageNum}
                    variant={pageNum === currentPage ? "default" : "outline"}
                    size="sm"
                    onClick={() => handlePageChange(pageNum)}
                    disabled={loading}
                    className="w-10 h-8"
                  >
                    {pageNum}
                  </Button>
                );
              })}
            </div>
            
            <Button
              variant="outline"
              size="sm"
              onClick={() => handlePageChange(currentPage + 1)}
              disabled={currentPage >= totalPages || loading}
            >
              Next
              <ChevronRight className="h-4 w-4" />
            </Button>
            
            <Button
              variant="outline"
              size="sm"
              onClick={() => handlePageChange(totalPages)}
              disabled={currentPage >= totalPages || loading}
            >
              Last
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default TaskManager;