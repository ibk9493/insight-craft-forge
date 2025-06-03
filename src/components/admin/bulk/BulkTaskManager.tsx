import React, { useState, useEffect, useCallback } from 'react';
import { 
  Card, 
  CardContent, 
  CardDescription, 
  CardFooter, 
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
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { api, Discussion, TaskStatus } from '@/services/api';
import { 
  Lock, 
  LockOpen, 
  Check, 
  Filter, 
  CheckSquare, 
  X, 
  AlertTriangle,
  Search,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  Users,
  RotateCcw,
  XCircle,
  ArrowRight
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";


const BulkTaskManager: React.FC = () => {
  // Data state
  const [discussions, setDiscussions] = useState<Discussion[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Search and pagination state
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [perPage, setPerPage] = useState(50);
  const [totalPages, setTotalPages] = useState(1);
  const [totalDiscussions, setTotalDiscussions] = useState(0);
  
  // Filter state
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [taskFilter, setTaskFilter] = useState<string>('all');
  const [filterText, setFilterText] = useState('');
  
  // Bulk operation state
  const [selectedDiscussionIds, setSelectedDiscussionIds] = useState<string[]>([]);
  const [selectedTaskId, setSelectedTaskId] = useState<number>(1);
  const [selectedStatus, setSelectedStatus] = useState<TaskStatus | ''>('');
  const [isUpdating, setIsUpdating] = useState(false);
  const [isConfirmDialogOpen, setIsConfirmDialogOpen] = useState(false);
  const [actionType, setActionType] = useState<'apply' | 'selectAll' | 'deselectAll'>('apply');

  // Debounced search
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState('');
  
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchQuery(searchQuery);
    }, 500);
    
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Get status display info
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
          icon: <AlertTriangle className="w-4 h-4 text-gray-400" />,
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
      
      console.log('📡 Fetching discussions for BulkTaskManager:', params);
      
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

  // Clear selections when discussions change
  useEffect(() => {
    setSelectedDiscussionIds([]);
  }, [discussions]);

  // Filter discussions based on local filter text
  const filteredDiscussions = filterText
    ? discussions.filter(d => 
        d.title.toLowerCase().includes(filterText.toLowerCase()) || 
        d.repository.toLowerCase().includes(filterText.toLowerCase())
      )
    : discussions;

  // Function to get task status for a discussion
  const getTaskStatus = (discussion: Discussion, taskId: number): TaskStatus => {
    const statusMap = {
      1: discussion.tasks.task1.status,
      2: discussion.tasks.task2.status,
      3: discussion.tasks.task3.status
    };
    return statusMap[taskId as keyof typeof statusMap] as TaskStatus;
  };

  // Function to get task annotators for a discussion
  const getTaskAnnotators = (discussion: Discussion, taskId: number): number => {
    const annotatorMap = {
      1: discussion.tasks.task1.annotators,
      2: discussion.tasks.task2.annotators,
      3: discussion.tasks.task3.annotators
    };
    return annotatorMap[taskId as keyof typeof annotatorMap] || 0;
  };

  // Function to toggle selection of a discussion
  const toggleDiscussionSelection = (discussionId: string) => {
    setSelectedDiscussionIds(prev => 
      prev.includes(discussionId)
        ? prev.filter(id => id !== discussionId)
        : [...prev, discussionId]
    );
  };

  // Function to select/deselect all discussions
  const handleSelectAll = (select: boolean) => {
    if (filteredDiscussions.length > 20) {
      setActionType(select ? 'selectAll' : 'deselectAll');
      setIsConfirmDialogOpen(true);
      return;
    }

    setSelectedDiscussionIds(
      select ? filteredDiscussions.map(d => d.id) : []
    );
  };

  // Function to apply bulk task status updates using new API
  const applyBulkUpdate = async () => {
    if (!selectedStatus || selectedDiscussionIds.length === 0) {
      toast.error('Please select a status and at least one discussion');
      return;
    }

    if (selectedDiscussionIds.length > 20) {
      setActionType('apply');
      setIsConfirmDialogOpen(true);
      return;
    }

    await performBulkUpdate();
  };

  // Function to perform the bulk update using individual API calls
  const performBulkUpdate = async () => {
    setIsUpdating(true);
    
    try {
      const updatePromises = selectedDiscussionIds.map(discussionId =>
        api.taskFlags.updateTaskStatus(discussionId, selectedTaskId, selectedStatus as TaskStatus)
      );
      
      console.log(`Performing bulk update: ${selectedDiscussionIds.length} discussions, Task ${selectedTaskId} → ${selectedStatus}`);
      
      const results = await Promise.allSettled(updatePromises);
      
      const successful = results.filter(result => 
        result.status === 'fulfilled' && result.value.success
      ).length;
      
      const failed = results.length - successful;
      
      if (failed === 0) {
        toast.success(`Updated ${successful} discussions successfully`);
        
        // Update local state to reflect changes
        setDiscussions(prevDiscussions => 
          prevDiscussions.map(disc => {
            if (selectedDiscussionIds.includes(disc.id)) {
              const updated = { ...disc };
              if (selectedTaskId === 1) updated.tasks.task1.status = selectedStatus as TaskStatus;
              else if (selectedTaskId === 2) updated.tasks.task2.status = selectedStatus as TaskStatus;
              else if (selectedTaskId === 3) updated.tasks.task3.status = selectedStatus as TaskStatus;
              return updated;
            }
            return disc;
          })
        );
        
        // Reset selection after successful update
        setSelectedDiscussionIds([]);
        setSelectedStatus('');
        
      } else {
        toast.warning(`Updated ${successful} discussions, but ${failed} failed`);
        console.error('Some updates failed');
        
        // Still refresh to show partial updates
        await fetchDiscussions(false);
      }
    } catch (error) {
      console.error('Error applying bulk update:', error);
      toast.error('An error occurred while updating task statuses');
    } finally {
      setIsUpdating(false);
      setIsConfirmDialogOpen(false);
    }
  };

  // Handle confirmation dialog result
  const handleConfirmAction = () => {
    if (actionType === 'apply') {
      performBulkUpdate();
    } else if (actionType === 'selectAll') {
      setSelectedDiscussionIds(filteredDiscussions.map(d => d.id));
      setIsConfirmDialogOpen(false);
    } else if (actionType === 'deselectAll') {
      setSelectedDiscussionIds([]);
      setIsConfirmDialogOpen(false);
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
            <AlertTriangle className="h-12 w-12 text-red-500 mx-auto" />
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
    <>
      <Card className="w-full shadow-md">
        <CardHeader>
          <div className="flex flex-col space-y-4">
            <div className="flex justify-between items-center">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Users className="h-5 w-5" />
                  Bulk Task Management
                </CardTitle>
                <CardDescription>
                  Search, select, and update task statuses for multiple discussions at once
                </CardDescription>
              </div>
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
                <Input
                  placeholder="Filter current page..."
                  className="w-[180px]"
                  value={filterText}
                  onChange={(e) => setFilterText(e.target.value)}
                />

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
                    <SelectItem value="20">20</SelectItem>
                    <SelectItem value="50">50</SelectItem>
                    <SelectItem value="100">100</SelectItem>
                  </SelectContent>
                </Select>

                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="sm">
                      <CheckSquare className="h-4 w-4 mr-2" />
                      Selection
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent>
                    <DropdownMenuLabel>Bulk Selection</DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={() => handleSelectAll(true)}>
                      Select All on Page ({filteredDiscussions.length})
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => handleSelectAll(false)}>
                      Deselect All
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>

            {/* Status Info */}
            <div className="text-sm text-gray-500">
              Showing {filteredDiscussions.length} of {totalDiscussions} discussions
              {searchQuery && ` (filtered by "${searchQuery}")`}
              {statusFilter !== 'all' && ` (${statusFilter} status only)`}
              {taskFilter !== 'all' && ` (Task ${taskFilter} only)`}
              • Page {currentPage} of {totalPages}
              {selectedDiscussionIds.length > 0 && ` • ${selectedDiscussionIds.length} selected`}
            </div>

            {/* Bulk Action Bar */}
            {selectedDiscussionIds.length > 0 && (
              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 p-3 bg-slate-50 rounded-md">
                <Badge variant="default" className="px-2 py-1">
                  {selectedDiscussionIds.length} selected
                </Badge>
                
                <div className="flex items-center gap-2 flex-wrap">
                  <Select value={String(selectedTaskId)} onValueChange={(value) => setSelectedTaskId(parseInt(value))}>
                    <SelectTrigger className="w-[120px] h-8">
                      <SelectValue placeholder="Select task" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1">Task 1</SelectItem>
                      <SelectItem value="2">Task 2</SelectItem>
                      <SelectItem value="3">Task 3</SelectItem>
                    </SelectContent>
                  </Select>

                  <Select value={selectedStatus} onValueChange={(value) => setSelectedStatus(value as TaskStatus)}>
                    <SelectTrigger className="w-[160px] h-8">
                      <SelectValue placeholder="Set status" />
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

                  <Button 
                    variant="default" 
                    size="sm" 
                    onClick={applyBulkUpdate}
                    disabled={isUpdating || !selectedStatus}
                  >
                    {isUpdating ? (
                      <>
                        <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                        Updating...
                      </>
                    ) : (
                      'Apply Changes'
                    )}
                  </Button>

                  <Button 
                    variant="ghost" 
                    size="sm" 
                    onClick={() => setSelectedDiscussionIds([])}
                    disabled={isUpdating}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}
          </div>
        </CardHeader>

        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[30px]">
                    <Checkbox 
                      checked={
                        filteredDiscussions.length > 0 &&
                        selectedDiscussionIds.length === filteredDiscussions.length
                      }
                      onCheckedChange={(checked) => {
                        handleSelectAll(!!checked);
                      }}
                    />
                  </TableHead>
                  <TableHead>Discussion</TableHead>
                  <TableHead>Repository</TableHead>
                  <TableHead className="w-[120px] text-center">
                    Task 1
                    <div className="text-xs text-gray-500 font-normal">Question Quality</div>
                  </TableHead>
                  <TableHead className="w-[120px] text-center">
                    Task 2
                    <div className="text-xs text-gray-500 font-normal">Answer Quality</div>
                  </TableHead>
                  <TableHead className="w-[120px] text-center">
                    Task 3
                    <div className="text-xs text-gray-500 font-normal">Rewrite</div>
                  </TableHead>
                  <TableHead className="w-[100px] text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading && discussions.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8">
                      <RefreshCw className="h-6 w-6 animate-spin mx-auto mb-2" />
                      <p className="text-gray-500">Loading discussions...</p>
                    </TableCell>
                  </TableRow>
                ) : filteredDiscussions.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8 text-gray-500">
                      No discussions found
                      {(searchQuery || filterText || statusFilter !== 'all' || taskFilter !== 'all') && (
                        <p className="mt-2 text-sm">
                          Try adjusting your search term or filters
                        </p>
                      )}
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredDiscussions.map((discussion) => (
                    <TableRow 
                      key={discussion.id}
                      className={selectedDiscussionIds.includes(discussion.id) ? 'bg-muted/30' : ''}
                    >
                      <TableCell>
                        <Checkbox 
                          checked={selectedDiscussionIds.includes(discussion.id)}
                          onCheckedChange={() => toggleDiscussionSelection(discussion.id)}
                        />
                      </TableCell>
                      <TableCell className="font-medium max-w-[200px]">
                        <div className="truncate" title={discussion.title}>
                          {discussion.title}
                        </div>
                      </TableCell>
                      <TableCell>{discussion.repository}</TableCell>
                      
                      {/* Task 1 Status */}
                      <TableCell>
                        <div className="flex items-center justify-center">
                          {getStatusDisplay(getTaskStatus(discussion, 1)).icon}
                          <span className={`ml-1 text-xs ${getStatusDisplay(getTaskStatus(discussion, 1)).className}`}>
                            {getTaskAnnotators(discussion, 1) > 0 ? `(${getTaskAnnotators(discussion, 1)})` : ''}
                          </span>
                        </div>
                      </TableCell>
                      
                      {/* Task 2 Status */}
                      <TableCell>
                        <div className="flex items-center justify-center">
                          {getStatusDisplay(getTaskStatus(discussion, 2)).icon}
                          <span className={`ml-1 text-xs ${getStatusDisplay(getTaskStatus(discussion, 2)).className}`}>
                            {getTaskAnnotators(discussion, 2) > 0 ? `(${getTaskAnnotators(discussion, 2)})` : ''}
                          </span>
                        </div>
                      </TableCell>
                      
                      {/* Task 3 Status */}
                      <TableCell>
                        <div className="flex items-center justify-center">
                          {getStatusDisplay(getTaskStatus(discussion, 3)).icon}
                          <span className={`ml-1 text-xs ${getStatusDisplay(getTaskStatus(discussion, 3)).className}`}>
                            {getTaskAnnotators(discussion, 3) > 0 ? `(${getTaskAnnotators(discussion, 3)})` : ''}
                          </span>
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
                { status: 'locked', label: 'Locked' },
                { status: 'unlocked', label: 'Unlocked' },
                { status: 'completed', label: 'Completed' },
                { status: 'rework', label: 'Needs Rework' },
                { status: 'blocked', label: 'Blocked' },
                { status: 'ready_for_next', label: 'Ready for Next' }
              ].map((item) => {
                const display = getStatusDisplay(item.status as TaskStatus);
                return (
                  <div key={item.status} className="flex items-center gap-1">
                    {display.icon}
                    <span className={`text-xs font-medium ${display.className}`}>
                      {item.label}
                    </span>
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

        <CardFooter className="flex justify-between pt-4">
          <div className="text-sm text-muted-foreground">
            Showing {filteredDiscussions.length} of {totalDiscussions} total discussions
          </div>
          {selectedDiscussionIds.length > 0 && (
            <div className="text-sm font-medium text-blue-600">
              {selectedDiscussionIds.length} discussions selected for bulk operation
            </div>
          )}
        </CardFooter>
      </Card>

      <AlertDialog open={isConfirmDialogOpen} onOpenChange={setIsConfirmDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center">
              <AlertTriangle className="h-5 w-5 mr-2 text-amber-500" />
              Confirm Bulk Action
            </AlertDialogTitle>
            <AlertDialogDescription>
              {actionType === 'apply' && (
                <>
                  You're about to update Task {selectedTaskId} status to "{selectedStatus}" for {selectedDiscussionIds.length} discussions. 
                  This action may take some time to complete and cannot be undone easily.
                  {selectedStatus === 'ready_for_next' && (
                    <div className="mt-2 text-amber-600 font-medium">
                      ⚠️ Setting status to "Ready for Next" will automatically unlock the next task for these discussions.
                    </div>
                  )}
                </>
              )}
              {actionType === 'selectAll' && (
                <>
                  You're about to select {filteredDiscussions.length} discussions.
                  Working with a large selection may impact performance.
                </>
              )}
              {actionType === 'deselectAll' && (
                <>
                  You're about to deselect all {selectedDiscussionIds.length} discussions.
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmAction}>
              Continue
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

export default BulkTaskManager;