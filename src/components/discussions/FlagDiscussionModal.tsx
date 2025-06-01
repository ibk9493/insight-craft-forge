
import React from 'react';
import { Badge } from '@/components/ui/badge';
import { 
  Lock, 
  Unlock, 
  CheckCircle, 
  AlertTriangle, 
  RotateCcw, 
  ArrowRight,
  XCircle 
} from 'lucide-react';

// Uses your existing status values + new ones
type ExistingTaskStatus = 'locked' | 'unlocked' | 'completed' | 'needs_rework' | 'blocked' | 'ready_for_next';

interface TaskStatusProps {
  status: ExistingTaskStatus;
  annotators: number;
  requiredAnnotators: number;
  className?: string;
}

// Status configuration using your existing system
const STATUS_CONFIG = {
  // Your existing statuses
  locked: {
    label: 'Locked',
    color: 'bg-gray-100 text-gray-800',
    icon: Lock,
    description: 'Task is locked and cannot be started'
  },
  unlocked: {
    label: 'Unlocked', 
    color: 'bg-blue-100 text-blue-800',
    icon: Unlock,
    description: 'Task is unlocked and can be started'
  },
  completed: {
    label: 'Completed',
    color: 'bg-green-100 text-green-800',
    icon: CheckCircle,
    description: 'Task is completed'
  },
  
  // New enhanced statuses (stored in your existing status column)
  needs_rework: {
    label: 'Needs Rework',
    color: 'bg-orange-100 text-orange-800',
    icon: RotateCcw,
    description: 'Task completed but needs fixes'
  },
  blocked: {
    label: 'Blocked',
    color: 'bg-red-100 text-red-800', 
    icon: XCircle,
    description: 'Task is blocked due to issues'
  },
  ready_for_next: {
    label: 'Ready for Next',
    color: 'bg-purple-100 text-purple-800',
    icon: ArrowRight,
    description: 'Task completed and ready to unlock next task'
  }
} as const;

const ExistingTaskStatusDisplay: React.FC<TaskStatusProps> = ({
  status,
  annotators,
  requiredAnnotators,
  className = ''
}) => {
  const config = STATUS_CONFIG[status] || STATUS_CONFIG.locked;
  const Icon = config.icon;

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <Badge 
        variant="outline" 
        className={`flex items-center gap-1 ${config.color}`}
        title={config.description}
      >
        <Icon className="h-3 w-3" />
        {config.label}
      </Badge>
      
      {/* Show annotator count */}
      <span className="text-xs text-gray-500">
        ({annotators}/{requiredAnnotators})
      </span>
      
      {/* Additional indicators based on status */}
      {status === 'blocked' && (
        <Badge variant="outline" className="bg-red-50 text-red-700 border-red-300">
          <AlertTriangle className="h-3 w-3 mr-1" />
          Flagged
        </Badge>
      )}
      
      {status === 'ready_for_next' && (
        <Badge variant="outline" className="bg-green-50 text-green-700 border-green-300">
          <CheckCircle className="h-3 w-3 mr-1" />
          Auto-unlock Next
        </Badge>
      )}
    </div>
  );
};

// Helper function to determine smart status based on your existing data
export const getSmartStatus = (
  currentStatus: 'locked' | 'unlocked' | 'completed',
  annotators: number,
  requiredAnnotators: number,
  hasConsensus: boolean = false,
  isFlagged: boolean = false
): ExistingTaskStatus => {
  
  // If flagged, always show as blocked
  if (isFlagged) {
    return 'blocked';
  }
  
  // If completed, determine the specific type
  if (currentStatus === 'completed') {
    if (hasConsensus) {
      return 'ready_for_next'; // Has consensus, ready to unlock next
    } else if (annotators >= requiredAnnotators) {
      return 'completed'; // Completed with enough annotators but no consensus yet
    } else {
      return 'needs_rework'; // Marked complete but doesn't have enough annotators
    }
  }
  
  // For locked/unlocked, use as-is
  return currentStatus;
};