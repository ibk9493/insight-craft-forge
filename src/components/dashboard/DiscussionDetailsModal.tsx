import React, { useState } from 'react';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogFooter,
  DialogClose,
  DialogTrigger
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Github, ExternalLink, Code, Calendar, Box, Hash, FileCode, GitBranch } from 'lucide-react';
import { Discussion } from '@/services/api/types';
import { cn } from '@/lib/utils';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { useAppDispatch, useAppSelector } from '@/hooks';
import { closeModal } from '@/store/discussionModalSlice';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs-wrapper';

interface DiscussionDetailsModalProps {
  isOpen?: boolean;
  onClose?: () => void;
  discussion: Discussion | null;
  trigger?: React.ReactNode;
}

const DiscussionDetailsModal: React.FC<DiscussionDetailsModalProps> = ({ 
  isOpen: externalIsOpen, 
  onClose: externalOnClose, 
  discussion: externalDiscussion,
  trigger
}) => {
  // Local state for the controlled version without Redux
  const [localIsOpen, setLocalIsOpen] = useState(false);
  
  // Redux state for the uncontrolled version
  const { isOpen: reduxIsOpen, discussion: reduxDiscussion } = useAppSelector(state => state.discussionModal);
  const dispatch = useAppDispatch();
  
  // Determine if we're using external control, Redux, or local state
  const isControlled = externalIsOpen !== undefined && externalOnClose !== undefined;
  const isUsingRedux = !isControlled && !trigger;
  
  // Select the appropriate values based on the mode
  const isOpen = isControlled ? externalIsOpen : isUsingRedux ? reduxIsOpen : localIsOpen;
  const discussion = isControlled ? externalDiscussion : isUsingRedux ? reduxDiscussion : externalDiscussion;
  
  // Handle dialog close
  const handleOpenChange = (open: boolean) => {
    if (isControlled) {
      if (!open) externalOnClose?.();
    } else if (isUsingRedux) {
      if (!open) dispatch(closeModal());
    } else {
      setLocalIsOpen(open);
    }
  };

  // Return early if there's no discussion
  if (!discussion) {
    if (trigger) {
      return <DialogTrigger asChild>{trigger}</DialogTrigger>;
    }
    return null;
  }

  // Get task status counts
  const getTaskStatusCounts = () => {
    const statuses = {
      completed: 0,
      unlocked: 0,
      locked: 0
    };
    
    if (discussion.tasks) {
      Object.values(discussion.tasks).forEach(task => {
        if (task.status === 'completed') statuses.completed++;
        else if (task.status === 'unlocked') statuses.unlocked++;
        else if (task.status === 'locked') statuses.locked++;
      });
    }
    
    return statuses;
  };
  
  const taskStatusCounts = getTaskStatusCounts();

  // Format dates
  const formatDate = (dateString?: string) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  // Render the dialog
  const dialogContent = (
    <DialogContent className="max-w-4xl max-h-[90vh]">
      <DialogHeader>
        <DialogTitle className="flex items-center space-x-2 text-xl">
          <Github className="h-5 w-5 text-primary" />
          <span>GitHub Discussion</span>
        </DialogTitle>
      </DialogHeader>
      
      <Tabs defaultValue="overview" className="w-full">
        <TabsList className="grid grid-cols-3 mb-4">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="metadata">Metadata</TabsTrigger>
          <TabsTrigger value="raw">Raw Data</TabsTrigger>
        </TabsList>
        
        <TabsContent value="overview" className="mt-0">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-lg font-bold line-clamp-2">{discussion.title}</CardTitle>
              <CardDescription className="flex items-center mt-1 space-x-2">
                <GitBranch className="h-4 w-4 text-muted-foreground" />
                <span>{discussion.repository}</span>
              </CardDescription>
            </CardHeader>
            
            <CardContent className="space-y-4">
              <div className="flex flex-wrap gap-2">
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={() => window.open(discussion.url, '_blank')}
                  className="flex items-center space-x-2"
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                  <span>Open in GitHub</span>
                </Button>
                
                {discussion.repository_language && (
                  <Badge variant="outline" className="flex items-center space-x-1.5">
                    <FileCode className="h-3 w-3" />
                    <span>{discussion.repository_language}</span>
                  </Badge>
                )}
                
                {discussion.release_tag && (
                  <Badge variant="outline" className="flex items-center space-x-1.5">
                    <Hash className="h-3 w-3" />
                    <span>{discussion.release_tag}</span>
                  </Badge>
                )}
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <h3 className="text-sm font-medium flex items-center space-x-1.5">
                    <Calendar className="h-4 w-4 text-primary" />
                    <span>Created</span>
                  </h3>
                  <p className="text-sm">{formatDate(discussion.created_at)}</p>
                </div>
                
                <div className="space-y-2">
                  <h3 className="text-sm font-medium flex items-center space-x-1.5">
                    <Box className="h-4 w-4 text-primary" />
                    <span>Task Status</span>
                  </h3>
                  <div className="flex gap-2">
                    {taskStatusCounts.completed > 0 && (
                      <Badge variant="default" className="bg-green-500 hover:bg-green-600">
                        {taskStatusCounts.completed} Completed
                      </Badge>
                    )}
                    {taskStatusCounts.unlocked > 0 && (
                      <Badge variant="default" className="bg-blue-500 hover:bg-blue-600">
                        {taskStatusCounts.unlocked} Unlocked
                      </Badge>
                    )}
                    {taskStatusCounts.locked > 0 && (
                      <Badge variant="outline">
                        {taskStatusCounts.locked} Locked
                      </Badge>
                    )}
                  </div>
                </div>
              </div>
              
              <div className="space-y-2">
                <h3 className="text-sm font-medium flex items-center space-x-1.5">
                  <Code className="h-4 w-4 text-primary" />
                  <span>Task Details</span>
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  {discussion.tasks && Object.entries(discussion.tasks).map(([taskKey, task]) => (
                    <Card key={taskKey} className="bg-muted/50 border">
                      <CardHeader className="p-3 pb-2">
                        <CardTitle className="text-sm font-medium">
                          {taskKey.replace('task', 'Task ')}
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="p-3 pt-0 space-y-1">
                        <div className="flex justify-between text-xs">
                          <span>Status:</span>
                          <Badge 
                            variant={task.status === 'completed' ? 'default' : 'outline'} 
                            className={cn(
                              "text-[10px] h-5",
                              task.status === 'completed' && "bg-green-500",
                              task.status === 'unlocked' && "border-blue-500 text-blue-500"
                            )}
                          >
                            {task.status.charAt(0).toUpperCase() + task.status.slice(1)}
                          </Badge>
                        </div>
                        <div className="flex justify-between text-xs">
                          <span>Annotators:</span>
                          <span className="font-mono">{task.annotators || 0}</span>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="metadata" className="mt-0">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-lg">Repository Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <h3 className="text-sm font-medium">Repository</h3>
                  <div className="bg-muted p-3 rounded-md">
                    <p className="text-sm">{discussion.repository || 'N/A'}</p>
                  </div>
                </div>
                
                <div className="space-y-2">
                  <h3 className="text-sm font-medium">Language</h3>
                  <div className="bg-muted p-3 rounded-md">
                    <p className="text-sm">{discussion.repository_language || 'N/A'}</p>
                  </div>
                </div>
                
                <div className="space-y-2">
                  <h3 className="text-sm font-medium">Release Tag</h3>
                  <div className="bg-muted p-3 rounded-md">
                    <p className="text-sm">{discussion.release_tag || 'N/A'}</p>
                  </div>
                </div>
                
                <div className="space-y-2">
                  <h3 className="text-sm font-medium">Release Date</h3>
                  <div className="bg-muted p-3 rounded-md">
                    <p className="text-sm">{formatDate(discussion.release_date)}</p>
                  </div>
                </div>
              </div>
              
              {discussion.release_url && (
                <div className="space-y-2">
                  <h3 className="text-sm font-medium">Release URL</h3>
                  <div className="bg-muted p-3 rounded-md">
                    <a 
                      href={discussion.release_url} 
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-blue-500 hover:underline flex items-center space-x-1"
                    >
                      <span>{discussion.release_url}</span>
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="raw" className="mt-0">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-lg">Raw JSON Data</CardTitle>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[400px] w-full">
                <div className="bg-muted p-3 rounded-md">
                  <pre className="text-xs whitespace-pre-wrap break-all">{JSON.stringify(discussion, null, 2)}</pre>
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
      
      <DialogFooter>
        <DialogClose asChild>
          <Button variant="outline">Close</Button>
        </DialogClose>
      </DialogFooter>
    </DialogContent>
  );

  // Render with or without trigger
  if (trigger) {
    return (
      <Dialog open={localIsOpen} onOpenChange={handleOpenChange}>
        <DialogTrigger asChild onClick={() => setLocalIsOpen(true)}>
          {trigger}
        </DialogTrigger>
        {dialogContent}
      </Dialog>
    );
  }

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      {dialogContent}
    </Dialog>
  );
};

export default DiscussionDetailsModal;