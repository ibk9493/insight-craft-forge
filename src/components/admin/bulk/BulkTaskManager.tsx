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
import { api, Discussion, TaskStatus, BulkActionResult } from '@/services/api';
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
  Users
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

// No more props needed - BulkTaskManager is fully independent!
const BulkTaskManager: React.FC = () => {
  // Data state
  const [discussions, setDiscussions] = useState<Discussion[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Search and pagination state
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [perPage, setPerPage] = useState(50); // Higher default for bulk operations
  const [totalPages, setTotalPages] = useState(1);
  const [totalDiscussions, setTotalDiscussions] = useState(0);
  
  // Filter state
  const [statusFilter, setStatusFilter] = useState<string>('all');
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

  // Fetch discussions with current filters/search/pagination
  const fetchDiscussions = useCallback(async (resetPage = false) => {
    setLoading(true);
    setError(null);
    
    try {
      const page = resetPage ? 1 : currentPage;
      
      const params = {
        page,
        per_page: perPage,
        search: debouncedSearchQuery.trim() || undefined,
        status: statusFilter === 'all' ? undefined : statusFilter,
      };
      
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
  }, [currentPage, perPage, debouncedSearchQuery, statusFilter]);

  // Initial load and refresh when filters change
  useEffect(() => {
    fetchDiscussions(true); // Reset to page 1 when filters change
  }, [debouncedSearchQuery, statusFilter, perPage]);

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

  // Helper function to get status icon
  const getStatusIcon = (status: TaskStatus) => {
    switch (status) {
      case 'locked':
        return <Lock className="w-4 h-4 text-gray-500" />;
      case 'unlocked':
        return <LockOpen className="w-4 h-4 text-blue-500" />;
      case 'completed':
        return <Check className="w-4 h-4 text-green-500" />;
    }
  };
  
  // Helper function to get status text color
  const getStatusTextClass = (status: TaskStatus) => {
    switch (status) {
      case 'locked':
        return "text-gray-500";
      case 'unlocked':
        return "text-blue-500";
      case 'completed':
        return "text-green-500";
    }
  };

  // Filter discussions based on local filter text
  const filteredDiscussions = filterText
    ? discussions.filter(d => 
        d.title.toLowerCase().includes(filterText.toLowerCase()) || 
        d.repository.toLowerCase().includes(filterText.toLowerCase())
      )
    : discussions;

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

  // Function to apply bulk task status updates
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

  // Function to confirm and perform the bulk update
  const performBulkUpdate = async () => {
    setIsUpdating(true);
    
    try {
      const bulkUpdate = {
        discussion_ids: selectedDiscussionIds,
        task_id: selectedTaskId,
        status: selectedStatus as TaskStatus
      };
  
      console.log('Sending bulk update request:', bulkUpdate);
      
      const response = await api.admin.bulkUpdateTaskStatus(
        bulkUpdate.discussion_ids,
        bulkUpdate.task_id,
        bulkUpdate.status
      );
      
      const results = response.results || [];
      const successfulUpdates = results.filter(result => result.success);
      const failedUpdates = results.filter(result => !result.success);
      
      if (failedUpdates.length === 0) {
        toast.success(`Updated ${successfulUpdates.length} discussions successfully`);
        
        // Reset selection after successful update
        setSelectedDiscussionIds([]);
        setSelectedStatus('');
        
        // Refresh current page to show updated statuses
        await fetchDiscussions(false);
      } else {
        toast.warning(`Updated ${successfulUpdates.length} discussions, but ${failedUpdates.length} failed`);
        console.error('Failed updates:', failedUpdates);
        
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

  // Handle search form submission
  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
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
            <div className="flex flex-col sm:flex-row gap-4">
              <form onSubmit={handleSearchSubmit} className="flex gap-2 flex-1">
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
                <Button type="submit" variant="outline" disabled={loading}>
                  Search
                </Button>
              </form>

              <div className="flex gap-2">
                <Input
                  placeholder="Filter current page..."
                  className="w-[180px]"
                  value={filterText}
                  onChange={(e) => setFilterText(e.target.value)}
                />

                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-[140px]">
                    <SelectValue placeholder="Filter by status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Statuses</SelectItem>
                    <SelectItem value="locked">Locked</SelectItem>
                    <SelectItem value="unlocked">Unlocked</SelectItem>
                    <SelectItem value="completed">Completed</SelectItem>
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
              {statusFilter !== 'all' && ` (${statusFilter} tasks only)`}
              • Page {currentPage} of {totalPages}
              {selectedDiscussionIds.length > 0 && ` • ${selectedDiscussionIds.length} selected`}
            </div>

            {/* Bulk Action Bar */}
            {selectedDiscussionIds.length > 0 && (
              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 p-3 bg-slate-50 rounded-md">
                <Badge variant="default" className="px-2 py-1">
                  {selectedDiscussionIds.length} selected
                </Badge>
                
                <div className="flex items-center gap-2">
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
                    <SelectTrigger className="w-[130px] h-8">
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
                  <TableHead className="w-[100px] text-center">Task 1</TableHead>
                  <TableHead className="w-[100px] text-center">Task 2</TableHead>
                  <TableHead className="w-[100px] text-center">Task 3</TableHead>
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
                      {searchQuery && (
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
                      <TableCell className="font-medium max-w-[200px] truncate">
                        {discussion.title}
                      </TableCell>
                      <TableCell>{discussion.repository}</TableCell>
                      
                      {/* Task 1 Status */}
                      <TableCell>
                        <div className="flex items-center justify-center">
                          {getStatusIcon(discussion.tasks.task1.status)}
                          <span className={`ml-1 text-xs ${getStatusTextClass(discussion.tasks.task1.status)}`}>
                            {discussion.tasks.task1.annotators > 0 ? `(${discussion.tasks.task1.annotators})` : ''}
                          </span>
                        </div>
                      </TableCell>
                      
                      {/* Task 2 Status */}
                      <TableCell>
                        <div className="flex items-center justify-center">
                          {getStatusIcon(discussion.tasks.task2.status)}
                          <span className={`ml-1 text-xs ${getStatusTextClass(discussion.tasks.task2.status)}`}>
                            {discussion.tasks.task2.annotators > 0 ? `(${discussion.tasks.task2.annotators})` : ''}
                          </span>
                        </div>
                      </TableCell>
                      
                      {/* Task 3 Status */}
                      <TableCell>
                        <div className="flex items-center justify-center">
                          {getStatusIcon(discussion.tasks.task3.status)}
                          <span className={`ml-1 text-xs ${getStatusTextClass(discussion.tasks.task3.status)}`}>
                            {discussion.tasks.task3.annotators > 0 ? `(${discussion.tasks.task3.annotators})` : ''}
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
                  You're about to update the status of {selectedDiscussionIds.length} discussions. 
                  This action could take some time to complete and cannot be undone easily.
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