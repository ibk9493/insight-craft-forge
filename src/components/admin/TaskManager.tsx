
import React, { useState, useEffect } from 'react';
import { 
  Card, 
  CardContent, 
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
import { toast } from 'sonner';
import { api, Discussion, TaskStatus } from '@/services/api';
import { Lock, LockOpen, Check } from 'lucide-react';

interface TaskManagerProps {
  discussions: Discussion[];
  onTaskUpdated: (discussion: Discussion) => void;
}

const TaskManager: React.FC<TaskManagerProps> = ({ discussions, onTaskUpdated }) => {
  const [isUpdating, setIsUpdating] = useState<string | null>(null);
  const [discussionsState, setDiscussionsState] = useState<Discussion[]>([]);
  
  // Initialize local state with props
  useEffect(() => {
    setDiscussionsState(discussions);
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
  
  // Function to update task status
  const updateTaskStatus = async (discussionId: string, taskId: number, status: TaskStatus) => {
    const updateKey = `${discussionId}-${taskId}`;
    setIsUpdating(updateKey);
    
    try {
      // Log the data being sent for debugging
      console.log('Sending task update request:', {
        discussionId,
        taskId,
        status
      });
      
      const result = await api.admin.updateTaskStatus(discussionId, taskId, status);
      
      if (result.success && result.discussion) {
        toast.success(result.message || 'Task status updated successfully');
        
        // Update local state immediately
        setDiscussionsState(prevDiscussions => 
          prevDiscussions.map(disc => 
            disc.id === discussionId ? result.discussion : disc
          )
        );
        
        // Also notify parent component
        onTaskUpdated(result.discussion);
      } else {
        toast.error(result.message || 'Failed to update task status');
      }
    } catch (error) {
      console.error('Error updating task status:', error);
      toast.error('An error occurred while updating task status');
    } finally {
      setIsUpdating(null);
    }
  };

  return (
    <Card className="w-full shadow-md">
      <CardHeader>
        <CardTitle>Task Management</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Discussion</TableHead>
                <TableHead>Repository</TableHead>
                <TableHead className="w-[120px] text-center">Task 1</TableHead>
                <TableHead className="w-[120px] text-center">Task 2</TableHead>
                <TableHead className="w-[120px] text-center">Task 3</TableHead>
                <TableHead className="w-[100px] text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {discussionsState.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-gray-500">
                    No discussions available
                  </TableCell>
                </TableRow>
              ) : (
                discussionsState.map((discussion) => (
                  <TableRow key={discussion.id}>
                    <TableCell className="font-medium max-w-[200px] truncate">
                      {discussion.title}
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
                          <SelectItem value="locked" className="flex items-center">
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
                        </SelectContent>
                      </Select>
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
                        </SelectContent>
                      </Select>
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
    </Card>
  );
};

export default TaskManager;
