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
  // Add repository metadata fields
  repositoryLanguage?: string;
  releaseTag?: string;
  releaseUrl?: string;
  releaseDate?: string;
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
export type UserRole = 'annotator' | 'pod_lead' | 'admin';

// Task state interface
export interface TaskState {
  status: TaskStatus;
  annotators: number;
  userAnnotated?: boolean;
}

// JSON Upload types
export interface UploadResult {
  success: boolean;
  message: string;
  discussionsAdded: number;
  errors?: string[];
}

export interface TaskManagementResult {
  success: boolean;
  message: string;
  discussion?: Discussion;
}

// GitHub Discussion format from JSON upload
export interface GitHubDiscussion {
  id: string;
  title: string;
  url: string;
  repository?: string;
  createdAt: string;
  // Add metadata fields from Python script
  repositoryLanguage?: string;
  releaseTag?: string;
  releaseUrl?: string;
  releaseDate?: string;
  tasks?: {
    task1?: Partial<TaskState>;
    task2?: Partial<TaskState>;
    task3?: Partial<TaskState>;
  };
}
