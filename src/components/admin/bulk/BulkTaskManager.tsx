
import React, { useState } from 'react';
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
import { toast } from 'sonner';
import { api, Discussion, TaskStatus, BulkActionResult } from '@/services/api';
import { Lock, LockOpen, Check, Filter, CheckSquare, X, AlertTriangle } from 'lucide-react';
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
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

interface BulkTaskManagerProps {
  discussions: Discussion[];
  onTaskUpdated: (discussions: Discussion[]) => void;
}

const BulkTaskManager: React.FC<BulkTaskManagerProps> = ({ discussions, onTaskUpdated }) => {
  const [selectedDiscussionIds, setSelectedDiscussionIds] = useState<string[]>([]);
  const [selectedTaskId, setSelectedTaskId] = useState<number>(1);
  const [selectedStatus, setSelectedStatus] = useState<TaskStatus | ''>('');
  const [isUpdating, setIsUpdating] = useState(false);
  const [filterText, setFilterText] = useState('');
  const [isConfirmDialogOpen, setIsConfirmDialogOpen] = useState(false);
  const [actionType, setActionType] = useState<'apply' | 'selectAll' | 'deselectAll'>('apply');
  
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

  // Filter discussions based on search text
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
    if (filteredDiscussions.length > 10) {
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

    if (selectedDiscussionIds.length > 10) {
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
      // Create the bulk update payload
      const bulkUpdate = {
        discussion_ids: selectedDiscussionIds,
        task_id: selectedTaskId,
        status: selectedStatus as TaskStatus
      };
  
      console.log('Sending bulk update request:', bulkUpdate);
      
      // Call the API endpoint for bulk updates
      const response = await api.admin.bulkUpdateTaskStatus(
        bulkUpdate.discussion_ids,
        bulkUpdate.task_id,
        bulkUpdate.status
      );
      
      // Analyze the results to determine success/failure counts
      const results = response.results || [];
      const successfulUpdates = results.filter(result => result.success);
      const failedUpdates = results.filter(result => !result.success);
      
      const result: BulkActionResult = {
        success: failedUpdates.length === 0,
        updatedCount: successfulUpdates.length,
        failedCount: failedUpdates.length,
        message: failedUpdates.length > 0
          ? `${failedUpdates.length} updates failed. Check logs for details.`
          : 'All updates successful',
        results: []
      };
      
      if (result.success) {
        toast.success(`Updated ${result.updatedCount} discussions successfully`);
        
        // Reset selection after successful update
        setSelectedDiscussionIds([]);
        setSelectedStatus('');
        
        // Refresh the data to show updated statuses
        const updatedDiscussions = await api.discussions.getAll();
        onTaskUpdated(updatedDiscussions);
      } else {
        toast.warning(`Updated ${result.updatedCount} discussions, but ${result.failedCount} failed`);
        if (failedUpdates.length > 0) {
          // Log the failed updates for debugging
          console.error('Failed updates:', failedUpdates);
        }
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

  return (
    <>
      <Card className="w-full shadow-md">
        <CardHeader>
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <CardTitle>Bulk Task Management</CardTitle>
              <CardDescription>Update task statuses for multiple discussions at once</CardDescription>
            </div>

            <div className="flex items-center gap-2">
              <Input
                placeholder="Filter discussions..."
                className="w-[200px]"
                value={filterText}
                onChange={(e) => setFilterText(e.target.value)}
                leftIcon={<Filter className="h-4 w-4 text-gray-500" />}
              />

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
                    Select All ({filteredDiscussions.length})
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleSelectAll(false)}>
                    Deselect All
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>

          {selectedDiscussionIds.length > 0 && (
            <div className="mt-4 flex flex-col sm:flex-row items-start sm:items-center gap-3 p-3 bg-slate-50 rounded-md">
              <Badge variant="default" className="px-2 py-1">
                {selectedDiscussionIds.length} selected
              </Badge>
              
              <div className="flex items-center gap-2">
                <Select value={String(selectedTaskId)} onValueChange={(value) => setSelectedTaskId(parseInt(value))}>
                  <SelectTrigger className="w-[150px] h-8">
                    <SelectValue placeholder="Select task" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1">Task 1</SelectItem>
                    <SelectItem value="2">Task 2</SelectItem>
                    <SelectItem value="3">Task 3</SelectItem>
                  </SelectContent>
                </Select>

                <Select value={selectedStatus} onValueChange={(value) => setSelectedStatus(value as TaskStatus)}>
                  <SelectTrigger className="w-[150px] h-8">
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
                  Apply
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
                {filteredDiscussions.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8 text-gray-500">
                      No discussions available
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
                          <span className={`ml-1 ${getStatusTextClass(discussion.tasks.task1.status)}`}>
                            {discussion.tasks.task1.annotators > 0 ? `(${discussion.tasks.task1.annotators})` : ''}
                          </span>
                        </div>
                      </TableCell>
                      
                      {/* Task 2 Status */}
                      <TableCell>
                        <div className="flex items-center justify-center">
                          {getStatusIcon(discussion.tasks.task2.status)}
                          <span className={`ml-1 ${getStatusTextClass(discussion.tasks.task2.status)}`}>
                            {discussion.tasks.task2.annotators > 0 ? `(${discussion.tasks.task2.annotators})` : ''}
                          </span>
                        </div>
                      </TableCell>
                      
                      {/* Task 3 Status */}
                      <TableCell>
                        <div className="flex items-center justify-center">
                          {getStatusIcon(discussion.tasks.task3.status)}
                          <span className={`ml-1 ${getStatusTextClass(discussion.tasks.task3.status)}`}>
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
        </CardContent>
        
        <CardFooter className="flex justify-between pt-4">
          <div className="text-sm text-muted-foreground">
            Showing {filteredDiscussions.length} of {discussions.length} discussions
          </div>
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
                  This action could take some time to complete.
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
