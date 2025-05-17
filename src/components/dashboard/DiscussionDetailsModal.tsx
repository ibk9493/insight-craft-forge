
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
import { Github, ExternalLink } from 'lucide-react';
import { Discussion } from '@/services/api/types';
import { cn } from '@/lib/utils';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { useAppDispatch, useAppSelector } from '@/hooks';
import { closeModal } from '@/store/discussionModalSlice';

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

  // Format JSON for display
  const formattedTasks = JSON.stringify(discussion.tasks, null, 2);
  const formattedMeta = JSON.stringify({
    repository: discussion.repository,
    repositoryLanguage: discussion.repositoryLanguage || null,
    releaseTag: discussion.releaseTag || null,
    releaseUrl: discussion.releaseUrl || null,
    releaseDate: discussion.releaseDate || null,
    createdAt: discussion.createdAt
  }, null, 2);

  // Render the dialog
  const dialogContent = (
    <DialogContent className="max-w-3xl">
      <DialogHeader>
        <DialogTitle className="text-xl font-bold">Original GitHub Discussion</DialogTitle>
      </DialogHeader>
      
      <div className="space-y-6 py-4">
        {/* GitHub Link */}
        <div className="flex items-center space-x-2">
          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => window.open(discussion.url, '_blank')}
            className="flex items-center space-x-2"
          >
            <Github className="h-4 w-4" />
            <span>Open in GitHub</span>
            <ExternalLink className="h-3 w-3" />
          </Button>
        </div>

        {/* Title */}
        <div>
          <h3 className="text-sm font-medium mb-2">Title</h3>
          <div className="bg-muted p-3 rounded-md">
            <p>{discussion.title}</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Repository Metadata */}
          <div>
            <h3 className="text-sm font-medium mb-2">Repository Metadata</h3>
            <ScrollArea className="h-[200px] w-full">
              <div className="bg-muted p-3 rounded-md">
                <pre className="text-xs whitespace-pre-wrap break-all">{formattedMeta}</pre>
              </div>
            </ScrollArea>
          </div>

          {/* Task Status */}
          <div>
            <h3 className="text-sm font-medium mb-2">Task Status</h3>
            <ScrollArea className="h-[200px] w-full">
              <div className="bg-muted p-3 rounded-md">
                <pre className="text-xs whitespace-pre-wrap break-all">{formattedTasks}</pre>
              </div>
            </ScrollArea>
          </div>
        </div>

        {/* Raw Data */}
        <div>
          <h3 className="text-sm font-medium mb-2">Raw Data</h3>
          <ScrollArea className="h-[200px] w-full">
            <div className="bg-muted p-3 rounded-md">
              <pre className="text-xs whitespace-pre-wrap break-all">{JSON.stringify(discussion, null, 2)}</pre>
            </div>
          </ScrollArea>
        </div>
      </div>
      
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
