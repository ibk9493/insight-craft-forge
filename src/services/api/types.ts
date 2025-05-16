
// API types for the annotation system

export interface Discussion {
  id: string;
  title: string;
  url: string;
  repository: string;
  createdAt: string;
  tasks: {
    task1: TaskState;
    task2: TaskState;
    task3: TaskState;
  };
}

export interface Annotation {
  discussionId: string;
  userId: string;
  taskId: number;
  data: Record<string, string | boolean>;
  timestamp: string;
}

export interface ApiError {
  message: string;
  status?: number;
}

// Task status types
export type TaskStatus = 'locked' | 'unlocked' | 'completed';

// Task state interface
export interface TaskState {
  status: TaskStatus;
  annotators: number;
  userAnnotated?: boolean;
}
