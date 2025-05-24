// API types for the annotation system

export interface Discussion {
  annotations: any;
  id: string;
  title: string;
  url: string;
  repository: string;
  created_at: string;
  tasks: {
    task1: TaskState;
    task2: TaskState;
    task3: TaskState;
  };
  // Repository metadata fields
  repository_language?: string;
  release_tag?: string;
  release_url?: string;
  release_date?: string;
  // Batch ID
  batch_id?: number;
  // New fields from test.json
  question?: string;
  answer?: string;
  category?: string;
  knowledge?: string;
  code?: string;
}

export interface Annotation {
  discussion_id: string;
  user_id: string;
  task_id: number;
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
  repository_language?: string[];
  release_tag?: string[];
  fromDate?: string;
  toDate?: string;
  batch_id?: number;
  searchTerm?: string;
}

// JSON Upload types
export interface UploadResult {
  success: boolean;
  message: string;
  discussionsAdded: number;
  batch_id?: number;
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
  batch_id?: number;
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

// Update GitHubDiscussion in types.ts
export interface GitHubDiscussion {
  id?: string;
  title?: string;
  url: string;
  repository?: string;
  createdAt: string;
  repository_language?: string;
  release_tag?: string;
  release_url?: string;
  release_date?: string;
  tasks?: Record<string, any>;
  batch_id?: number;
  // New fields
  question?: string;
  answer?: string;
  category?: string;
  knowledge?: string;
  code?: string;
  lang?: string;  // Alternative to repository_language
}

// System summary types
export interface BatchBreakdown {
  name: string;
  discussions: number;
}

export interface TrainerBreakdown {
  trainer_id: string;
  trainer_email: string; 
  total_annotations: number;
  task1_count: number;
  task2_count: number;
  task3_count: number;
}

export interface TaskProgression {
  stuck_in_task1: number;
  stuck_in_task2: number;
  reached_task3: number;
  fully_completed: number;
}

export interface SystemSummary {
  totalDiscussions: number;
  task1Completed: number;
  task2Completed: number;
  task3Completed: number;
  totalTasksCompleted: number;
  totalAnnotations: number;
  uniqueAnnotators: number;
  totalBatches: number;
  batchesBreakdown: BatchBreakdown[];
  trainerBreakdown: TrainerBreakdown[];
  taskProgression: TaskProgression;
  consensus_annotations: number;
}

export interface UserSummary {
  userId: string;
  totalAnnotations: number;
  task1Completed: number;
  task2Completed: number;
  task3Completed: number;
  totalTasksCompleted: number;
}

// Analytics types
export interface AnnotationActivity {
  date: string;
  count: number;
}

export interface RepositoryBreakdown {
  repository: string;
  count: number;
}

export interface AnnotatorPerformance {
  userId: string;
  completedTasks: number;
  averageTime: number;
  agreement: number;
}

export interface QualityMetrics {
  discussionId: string;
  title: string;
  agreementScore: number;
  annotatorCount: number;
  conflictAreas: string[];
}

// Bulk action types
export interface BulkTaskUpdate {
  discussionIds: string[];
  taskId: number;
  status: TaskStatus;
}

export interface BulkActionResult {
  success: boolean;
  message: string;
  updatedCount: number;
  failedCount: number;
  results:[];
}
