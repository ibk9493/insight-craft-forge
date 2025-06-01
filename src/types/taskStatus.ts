// types/taskStatus.ts - Enhanced task status types
export type TaskStatus = 'locked' | 'unlocked' | 'completed' | 'rework' | 'blocked' | 'ready_for_next';

export interface TaskState {
  status: TaskStatus;
  annotators: number;
  flagged?: boolean;
  flag_reason?: string;
  flag_by?: string;
  flag_timestamp?: string;
}

export interface DiscussionFlag {
  id: string;
  discussion_id: string;
  task_id: number;
  flagged_by: string;
  reason: string;
  status: 'active' | 'resolved';
  created_at: string;
  resolved_at?: string;
  resolved_by?: string;
}

// Enhanced status mappings
export const TASK_STATUS_CONFIG = {
  locked: {
    label: 'Locked',
    color: 'bg-gray-100 text-gray-800',
    description: 'Task is locked and cannot be started'
  },
  unlocked: {
    label: 'Unlocked', 
    color: 'bg-blue-100 text-blue-800',
    description: 'Task is unlocked and can be started'
  },
  completed: {
    label: 'Completed',
    color: 'bg-green-100 text-green-800', 
    description: 'Task is completed but not moved to next task'
  },
  rework: {
    label: 'Needs Rework',
    color: 'bg-orange-100 text-orange-800',
    description: 'Task needs to be reworked due to issues'
  },
  blocked: {
    label: 'Blocked',
    color: 'bg-red-100 text-red-800',
    description: 'Task is blocked and cannot proceed'
  },
  ready_for_next: {
    label: 'Ready for Next',
    color: 'bg-purple-100 text-purple-800',
    description: 'Task is completed and ready to unlock next task'
  }
} as const;