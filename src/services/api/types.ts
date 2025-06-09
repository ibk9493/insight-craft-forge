// API types for the annotation system
export interface EnhancedSystemSummary {
  // Basic metrics
  total_discussions: number;
  total_annotations: number;
  unique_annotators: number;
  consensus_annotations: number;
  
  // Enhanced task completion breakdown
  task_completions: {
    task1: { completed: number; consensus_created: number; quality_failed: number; total_done: number };
    task2: { completed: number; consensus_created: number; quality_failed: number; total_done: number };
    task3: { completed: number; consensus_created: number; quality_failed: number; total_done: number };
  };
  
  // Enhanced bottleneck analysis - includes rework/flagged as "stuck"
  bottleneckAnalysis: {
    task1_missing_annotations: number;
    task1_ready_for_consensus: number;
    task1_rework_flagged: number; // NEW: Count of rework/flagged discussions
    task2_missing_annotations: number;
    task2_ready_for_consensus: number;
    task2_rework_flagged: number; // NEW: Count of rework/flagged discussions
    task3_missing_annotations: number;
    task3_ready_for_consensus: number;
    task3_rework_flagged: number; // NEW: Count of rework/flagged discussions
    total_stuck_discussions: number;
    stuck_details: Array<{
      discussion_id: string;
      discussion_title: string;
      stuck_reasons: string[];
      stuck_type: 'missing_annotations' | 'ready_for_consensus' | 'rework'; // NEW
    }>;
  };
  
  // Workflow health metrics - enhanced to distinguish rework from other blocks
  workflowHealth: {
    healthy_discussions: number;
    quality_issues: number; // quality_failed discussions
    blocked_discussions: number; // blocked status
    rework_discussions: number; // NEW: rework/flagged status
    consensus_pending: number;
    completion_rate: number;
    average_task_completion: number;
  };
  
  // Enhanced task progression - separate workflow_blocked into components
  taskProgression: {
    not_started: number;
    task1_in_progress: number;
    task1_done: number;
    task2_in_progress: number;
    task2_done: number;
    task3_in_progress: number;
    fully_completed: number;
    workflow_blocked: number; // blocked status
    workflow_rework: number; // NEW: rework/flagged status
  };
  
  // Actionable insights - enhanced with rework-specific recommendations
  actionableInsights: Array<{
    type: 'annotation_shortage' | 'consensus_backlog' | 'workflow_blockers' | 'quality_concerns' | 'rework_required' | 'low_completion';
    priority: 'high' | 'medium' | 'low';
    message: string;
    action: string;
    count?: number; // NEW: Number of affected discussions
  }>;
  
  // Legacy compatibility fields
  task1_completed: number;
  task2_completed: number;
  task3_completed: number;
  total_tasks_completed: number;
  batches_breakdown: any[];
  trainerBreakdown: TrainerBreakdown[];
}

export interface GeneralReportData {
  report_timestamp: string;
  total_discussions: number;
  ready_for_consensus: Array<{
    discussion_id: string;
    discussion_title: string;
    task_id: number;
    agreement_rate: number;
    priority: string;
  }>;
  ready_for_task_unlock: Array<{
    discussion_id: string;
    discussion_title: string;
    completed_task_id: number;
    next_task_id: number;
  }>;
  rework_required: Array<{
    discussion_id: string;
    discussion_title: string;
    task_id: number;
    status: string;
  }>;
  stuck_discussions: Array<{
    discussion_id: string;
    discussion_title: string;
    stuck_reasons: string[];
  }>;
  normal_workflow_states: {
    collecting_annotations: number;
    quality_blocked_expected: number;
  };
  workflow_summary: {
    discussions_ready_for_consensus: number;
    discussions_ready_for_unlock: number;
    fully_completed_discussions: number;
    rework_discussions: number;
    stuck_discussions: number;
    collecting_annotations: number;
    quality_blocked: number;
  };
  task_breakdown: {
    task_1: {
      ready_for_consensus: number;
      ready_for_unlock: number;
      completed: number;
      rework_required: number;
      collecting_annotations: number;
      quality_blocked: number;
    };
    task_2: {
      ready_for_consensus: number;
      ready_for_unlock: number;
      completed: number;
      rework_required: number;
      collecting_annotations: number;
      quality_blocked: number;
    };
    task_3: {
      ready_for_consensus: number;
      ready_for_unlock: number;
      completed: number;
      rework_required: number;
      collecting_annotations: number;
      quality_blocked: number;
    };
  };
  bottleneck_analysis: {
    total_stuck: number;
    ready_for_consensus: number;
    rework_flagged: number;
    blocked_non_quality: number;
    normal_flow_collecting: number;
    normal_flow_quality_blocked: number;
  };
  recommendations: Array<{
    type: string;
    priority: string;
    message: string;
    action: string;
    count: number;
  }>;
}

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
// This would work just fine too:
export const parseTaskStatus = (statusData) => {
  if (!statusData) return { status: 'locked' };
  
  if (typeof statusData === 'string' && statusData.startsWith('{')) {
    try {
      return JSON.parse(statusData);
    } catch (error) {
      console.warn('Failed to parse status JSON:', statusData);
      return { status: statusData };
    }
  }
  
  return { status: statusData };
};
// Task status types
export type TaskStatus = 
  | 'locked' 
  | 'unlocked' 
  | 'completed' 
  | 'rework' 
  | 'blocked' 
  | 'ready_for_next'
  | 'ready_for_consensus'  // When enough annotations are collected
  | 'consensus_created'    // After consensus process is complete
  | 'general'
  | 'flagged';

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



export interface StatusUpdate {
  discussion_id: string;
  discussion_title: string;
  task_id: number;
  current_status: string;
  correct_status: string;
  reason: string;
  applied: boolean;
}
export interface StatusFixResult {
  success: boolean;
  dry_run: boolean;
  message: string;
  updated_discussions: number;
  total_discussions_analyzed: number;
  status_updates: StatusUpdate[];
  summary: {
    status_changes: Record<string, number>;
    fixes_applied: Record<string, number>;
    tasks_affected: Record<string, number>;
  };
  errors?: string[];
  timestamp?: string;
  api_version?: string;
  operation?: string;
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

export interface BulkFlagTask {
  discussionId: string;
  taskId: number;
  reason: string;
  category?: string;
}