
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
  // Repository metadata fields
  repositoryLanguage?: string;
  releaseTag?: string;
  releaseUrl?: string;
  releaseDate?: string;
  // Batch ID
  batchId?: number;
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

// Batch interface
export interface BatchUpload {
  id: number;
  name: string;
  description?: string;
  created_at: string;
  created_by?: string;
  discussion_count: number;
}

// Filter interface for discussions
export interface DiscussionFilter {
  status?: TaskStatus;
  userId?: string;
  repositoryLanguage?: string[];
  releaseTag?: string[];
  fromDate?: string;
  toDate?: string;
  batchId?: number;
  searchTerm?: string;
}

// JSON Upload types
export interface UploadResult {
  success: boolean;
  message: string;
  discussionsAdded: number;
  batchId?: number;
  errors?: string[];
}

export interface TaskManagementResult {
  success: boolean;
  message: string;
  discussion?: Discussion;
}

export interface BatchManagementResult {
  success: boolean;
  message: string;
  batchId?: number;
}

// GitHub Discussion format from JSON upload
export interface GitHubDiscussionTaskState {
  status?: TaskStatus;
  annotators?: number;
}

export interface GitHubDiscussionTasks {
  task1?: GitHubDiscussionTaskState;
  task2?: GitHubDiscussionTaskState;
  task3?: GitHubDiscussionTaskState;
}

export interface GitHubDiscussion {
  id?: string;  // Now optional, will be generated if not provided
  title?: string;  // Now optional, will be generated if not provided
  url: string;
  repository?: string;
  createdAt: string;
  // Add metadata fields
  repositoryLanguage?: string;
  releaseTag?: string;
  releaseUrl?: string;
  releaseDate?: string;
  tasks?: GitHubDiscussionTasks;
  // Add batch ID
  batchId?: number;
}

// System summary types
export interface SystemSummary {
  totalDiscussions: number;
  task1Completed: number;
  task2Completed: number;
  task3Completed: number;
  totalTasksCompleted: number;
  totalAnnotations: number;
  uniqueAnnotators: number;
  totalBatches: number;
  batchesBreakdown: {
    name: string;
    discussions: number;
  }[];
}

export interface UserSummary {
  userId: string;
  totalAnnotations: number;
  task1Completed: number;
  task2Completed: number;
  task3Completed: number;
  totalTasksCompleted: number;
}
