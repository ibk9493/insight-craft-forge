import { toast } from '@/components/ui/sonner';
import { ApiError } from './types';
import { Discussion, Annotation, TaskStatus, GitHubDiscussion, UploadResult, 
         TaskManagementResult, UserRole, SystemSummary, UserSummary, 
         BatchUpload, BatchManagementResult, BulkTaskUpdate, BulkActionResult } from './types';
import { API_CONFIG } from '@/config';
import { apiRequest, safeApiRequest, formatApiUrl, safeToString } from './helpers';

// Add pagination types
interface PaginatedDiscussionsResponse {
  items: Discussion[];
  total: number;
  page: number;
  per_page: number;
  pages: number;
}

interface DiscussionQueryParams {
  status?: string;
  page?: number;
  per_page?: number;
}
interface EnhancedDiscussionQueryParams {
  status?: string;
  search?: string;
  repository_language?: string;  // comma-separated
  release_tag?: string;          // comma-separated
  from_date?: string;            // ISO date string
  to_date?: string;              // ISO date string
  batch_id?: number;
  page?: number;
  per_page?: number;
  user_id?: string;
  task1_status?: string;
  task2_status?: string;
  task3_status?: string;
}

interface FilterOptionsResponse {
  repository_languages: string[];
  release_tags: string[];
  batches: Array<{id: number; name: string}>;
  date_range: {
    min_date: string | null;
    max_date: string | null;
  };
}

// NEW: Add missing response types
interface TaskCompletionStatusResponse {
  discussion_id: string;
  task_id: number;
  can_complete: boolean;
  message: string;
  criteria: Record<string, boolean>;
  missing_criteria: string[];
}

interface ExportResponse {
  success: boolean;
  downloadUrl: string;
  filename: string;
  format: string;
  discussionCount?: number;
  batchId?: number;
  batchName?: string;
  expiresIn: string;
}

// Update this function to use the enhanced parameters
export const fetchDiscussions = async (params: EnhancedDiscussionQueryParams = {}): Promise<PaginatedDiscussionsResponse> => {
  return api.discussions.getAll(params);
};

// Helper function to format GitHub discussions for API compatibility
const formatGitHubDiscussion = (discussion: GitHubDiscussion): any => {
  // Create a new object to map camelCase to snake_case for API compatibility
  const apiFormatted: any = {
    url: discussion.url,
  };

  // Map camelCase to snake_case fields
  if (discussion.id) apiFormatted.id = discussion.id;
  if (discussion.title) apiFormatted.title = discussion.title;
  if (discussion.repository) apiFormatted.repository = discussion.repository;

  // Ensure created_at is in ISO format
  if (discussion.createdAt) {
    apiFormatted.created_at = new Date(discussion.createdAt).toISOString();
  } else {
    // Fallback to current date if no date is provided
    apiFormatted.created_at = new Date().toISOString();
  }

  // Handle repository information
  if (!discussion.repository && discussion.url) {
    apiFormatted.repository = extractRepositoryFromUrl(discussion.url);
  }

  // Ensure we have a title
  if (!apiFormatted.title && discussion.title) {
    // Extract first line from question as title
    const firstLine = discussion.title.split('\n')[0].trim();
    apiFormatted.title = firstLine.substring(0, 120); // Limit title length
  }

  // Handle new fields
  if (discussion.question) apiFormatted.question = discussion.question;
  if (discussion.answer) apiFormatted.answer = discussion.answer;
  if (discussion.category) apiFormatted.category = discussion.category;
  if (discussion.knowledge) apiFormatted.knowledge = discussion.knowledge;
  if (discussion.code) apiFormatted.code = discussion.code;

  // Convert metadata fields to snake_case
  if (discussion.repository_language) {
    apiFormatted.repository_language = discussion.repository_language;
  } else if (discussion.lang) {
    apiFormatted.repository_language = discussion.lang;
  }

  if (discussion.release_tag) {
    apiFormatted.release_tag = discussion.release_tag;
  }

  if (discussion.release_url) {
    apiFormatted.release_url = discussion.release_url;
  }

  if (discussion.release_date) {
    apiFormatted.release_date = discussion.release_date;
  }

  // Handle tasks if present
  if (discussion.tasks) {
    apiFormatted.tasks = discussion.tasks;
  }

  // Handle batch ID if present
  if (discussion.batch_id) {
    apiFormatted.batch_id = discussion.batch_id;
  }

  return apiFormatted;
};

// Helper function to extract repository name from GitHub URL
const extractRepositoryFromUrl = (url: string): string => {
  try {
    const githubUrlPattern = /github\.com\/([^\/]+\/[^\/]+)/i;
    const match = url.match(githubUrlPattern);
    return match ? match[1] : 'unknown/repository';
  } catch (error) {
    console.error('Error extracting repository from URL:', error);
    return 'unknown/repository';
  }
};

// Configure request timeout
const API_TIMEOUT = 10000; // 10 seconds

// Create a timeout promise
const timeoutPromise = (ms: number) => new Promise((_, reject) => 
  setTimeout(() => reject(new Error(`Request timed out after ${ms}ms`)), ms)
);

// Enhanced API request with timeout and better error handling
export const enhancedApiRequest = async <T>(
  url: string, 
  method: string, 
  body?: any, 
  headers?: any, 
  fallbackValue?: T
): Promise<T> => {
  try {
    // Configure the fetch options
    const options: RequestInit = {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...headers,
      },
      // Don't set Content-Type for FormData
      ...(body instanceof FormData ? { body } : body ? { body: JSON.stringify(body) } : {}),
    };

    // If it's FormData, remove Content-Type header to let browser set it with boundary
    if (body instanceof FormData) {
      delete options.headers['Content-Type'];
    }

    // Add authorization token if available
    const authToken = localStorage.getItem('auth_token');
    if (authToken) {
      options.headers['Authorization'] = `Bearer ${authToken}`;
    }

    // Race the fetch against a timeout
    const response = await Promise.race([
      fetch(url, options),
      timeoutPromise(API_TIMEOUT)
    ]) as Response;

    // Check if response is OK
    if (!response.ok) {
      // Try to extract error message from response
      let errorMessage;
      try {
        const errorData = await response.json();
        errorMessage = errorData.message || `Error: ${response.status} ${response.statusText}`;
      } catch (e) {
        errorMessage = `Error: ${response.status} ${response.statusText}`;
      }
      throw new Error(errorMessage);
    }

    // Check if we have a content-type header and it's JSON
    const contentType = response.headers.get('content-type');
    if (contentType && contentType.includes('application/json')) {
      const responseText = await response.text();
      
      // Handle empty responses
      if (!responseText.trim()) {
        console.warn('Empty JSON response received');
        return fallbackValue as T;
      }
      
      // Parse the JSON
      try {
        return JSON.parse(responseText) as T;
      } catch (e) {
        console.error('Failed to parse JSON:', e, 'Response:', responseText);
        throw new Error('Invalid JSON response from server');
      }
    } else {
      // Handle non-JSON responses based on what your API might return
      const text = await response.text();
      console.warn('Non-JSON response received:', text);
      return fallbackValue as T;
    }
  } catch (error) {
    console.error('API request failed:', error);
    
    // Check if we're offline
    if (!navigator.onLine) {
      console.log('Browser is offline, returning fallback value');
      return fallbackValue as T;
    }
    
    throw error;
  }
};

export const api = {
  // Discussion endpoints - updated with pagination support
  workflow: {
    generalReport: () => {
      console.log('[Workflow] Getting general workflow report');
      return safeApiRequest('/api/admin/workflow/general-report', 'GET', undefined, undefined, {
        report_timestamp: new Date().toISOString(),
        total_discussions: 0,
        ready_for_consensus: [],
        ready_for_task_unlock: [],
        workflow_summary: {
          discussions_ready_for_consensus: 0,
          discussions_ready_for_unlock: 0,
          fully_completed_discussions: 0,
          blocked_discussions: 0
        },
        task_breakdown: {
          task_1: { ready_for_consensus: 0, ready_for_unlock: 0, completed: 0 },
          task_2: { ready_for_consensus: 0, ready_for_unlock: 0, completed: 0 },
          task_3: { ready_for_consensus: 0, ready_for_unlock: 0, completed: 0 }
        },
        recommendations: []
      });
    },

    agreementOverview: () => {
      console.log('[Workflow] Getting user agreement overview');
      return safeApiRequest('/api/admin/users/agreement-overview', 'GET', undefined, undefined, {
        total_users: 0,
        users: [],
        users_needing_training: [],
        summary: {
          excellent_users: 0,
          good_users: 0,
          users_needing_improvement: 0,
          users_needing_training: 0,
          users_with_no_data: 0,
          users_with_errors: 0
        },
        analysis_timestamp: new Date().toISOString()
      });
    },

    consensusCandidates: (minAgreementRate = 80.0, taskId = null) => {
      const queryParams = new URLSearchParams();
      queryParams.append('min_agreement_rate', minAgreementRate.toString());
      if (taskId) queryParams.append('task_id', taskId.toString());
      
      const url = `/api/admin/workflow/consensus-candidates?${queryParams.toString()}`;
      
      console.log('[Workflow] Getting consensus candidates');
      return safeApiRequest(url, 'GET', undefined, undefined, {
        total_candidates: 0,
        candidates: [],
        min_agreement_rate: minAgreementRate,
        task_filter: taskId,
        report_timestamp: new Date().toISOString()
      });
    },

    unlockCandidates: (taskId = null) => {
      const queryParams = new URLSearchParams();
      if (taskId) queryParams.append('task_id', taskId.toString());
      
      const url = `/api/admin/workflow/unlock-candidates?${queryParams.toString()}`;
      
      console.log('[Workflow] Getting unlock candidates');
      return safeApiRequest(url, 'GET', undefined, undefined, {
        total_candidates: 0,
        candidates: [],
        completed_task_filter: taskId,
        report_timestamp: new Date().toISOString()
      });
    },

    autoCreateConsensus: (dryRun = true, minAgreementRate = 90.0, taskId = null) => {
      const queryParams = new URLSearchParams();
      queryParams.append('dry_run', dryRun.toString());
      queryParams.append('min_agreement_rate', minAgreementRate.toString());
      if (taskId) queryParams.append('task_id', taskId.toString());
      
      const url = `/api/admin/workflow/auto-create-consensus?${queryParams.toString()}`;
      
      console.log('[Workflow] Auto-creating consensus');
      return safeApiRequest(url, 'POST', undefined, undefined, {
        message: dryRun ? 'Preview mode - no changes made' : 'Consensus creation completed',
        total_candidates: 0,
        successful_creations: 0,
        errors: [],
        created_consensus: [],
        dry_run: dryRun,
        min_agreement_rate: minAgreementRate,
        timestamp: new Date().toISOString()
      });
    },

    userAgreementAnalysis: (userId, taskId = null, includeDetails = false) => {
      const queryParams = new URLSearchParams();
      if (taskId) queryParams.append('task_id', taskId.toString());
      queryParams.append('include_details', includeDetails.toString());
      
      const url = `/api/users/${encodeURIComponent(userId)}/annotations/agreement-analysis?${queryParams.toString()}`;
      
      console.log(`[Workflow] Getting agreement analysis for user: ${userId}`);
      return safeApiRequest(url, 'GET', undefined, undefined, {
        user_id: userId,
        total_annotations: 0,
        summary: {
          total_annotations: 0,
          annotations_with_consensus: 0,
          perfect_agreements: 0,
          partial_agreements: 0,
          disagreements: 0,
          no_consensus_available: 0,
          agreement_rate: 0.0
        },
        recommendations: []
      });
    },

    userDisagreementReport: (userId, taskId = null) => {
      const queryParams = new URLSearchParams();
      if (taskId) queryParams.append('task_id', taskId.toString());
      
      const url = `/api/users/${encodeURIComponent(userId)}/annotations/disagreement-report?${queryParams.toString()}`;
      
      console.log(`[Workflow] Getting disagreement report for user: ${userId}`);
      return safeApiRequest(url, 'GET', undefined, undefined, {
        user_id: userId,
        total_disagreements: 0,
        disagreement_details: [],
        training_recommendations: [],
        overall_stats: {}
      });
    },

    userAgreementSummary: (userId) => {
      const url = `/api/users/${encodeURIComponent(userId)}/annotations/summary`;
      
      console.log(`[Workflow] Getting agreement summary for user: ${userId}`);
      return safeApiRequest(url, 'GET', undefined, undefined, {
        user_id: userId,
        total_annotations: 0,
        annotations_with_consensus: 0,
        agreement_rate: 0,
        status: 'no_data'
      });
    },

    // NEW: Task completion status endpoint
    taskCompletionStatus: (discussionId: string, taskId: number) => {
      const url = `/api/tasks/${encodeURIComponent(discussionId)}/${taskId}/completion-status`;
      
      console.log(`[Workflow] Getting completion status for discussion: ${discussionId}, task: ${taskId}`);
      return safeApiRequest<TaskCompletionStatusResponse>(url, 'GET', undefined, undefined, {
        discussion_id: discussionId,
        task_id: taskId,
        can_complete: false,
        message: 'Status check failed',
        criteria: {},
        missing_criteria: []
      });
    }
  },
 // Add these endpoints to your existing api object

taskFlags: {
  flagTask: (
    discussionId: string, 
    taskId: number, 
    flagData: {
      reason: string;
      category: string;
      flagged_from_task: number;
      workflow_scenario?: string;
      flagged_by_role: string;
    }
  ) => {
    console.log(`[TaskFlags] Flagging task ${taskId} for discussion ${discussionId}`);
    
    return safeApiRequest<{
      success: boolean;
      message: string;
      discussion_id: string;
      task_id: number;
      new_status: string;
      flagged_by: string;
      reason: string;
      category: string;
    }>(`/api/discussions/${encodeURIComponent(discussionId)}/tasks/${taskId}/flag-enhanced`, 'POST', flagData, undefined, {
      success: false,
      message: 'Failed to flag task',
      discussion_id: discussionId,
      task_id: taskId,
      new_status: 'failed',
      flagged_by: '',
      reason: flagData.reason,
      category: flagData.category
    });
  },

  updateTaskStatus: (discussionId: string, taskId: number, status: string) => {
    return safeApiRequest<{
      auto_unlocked_next: any;
      success: boolean;
      message: string;
      discussion_id: string;
      task_id: number;
      old_status: string;
      new_status: string;
      updated_by: string;
    }>(`/api/admin/discussions/${encodeURIComponent(discussionId)}/tasks/${taskId}/status`, 'PUT', { status });
  }
},

github: {
  getLatestCommit: (repoUrl: string, discussionDate: string) => {
    const params = new URLSearchParams({
      repo_url: repoUrl,
      discussion_date: discussionDate
    });
    
    return safeApiRequest<{
      [x: string]: string;
      success: boolean;
      repository: string;
      latest_commit: {
        sha: string;
        short_sha: string;
        message: string;
        author: { name: string; date: string };
        url: string;
        hours_before_discussion: number;
      } | null;
    }>(`/api/github/latest-commit?${params.toString()}`, 'GET');
  },
  getLatestTag: (repoUrl: string, discussionDate: string) => {
    const params = new URLSearchParams({
      repo_url: repoUrl,
      discussion_date: discussionDate
    });
    
    return safeApiRequest<{
      [x: string]: string;
      success: boolean;
      repository: string;
      latest_tag: {
        name: string;
        sha: string;
        short_sha: string;
        url: string;
        date: string;
        hours_before_discussion: number;
        message?: string;
      } | null;
    }>(`/api/github/latest-tag?${params.toString()}`, 'GET');
  }
},
  discussions: {
    // Updated to support pagination parameters
    getFilterOptions: () => {
      console.log('[Discussions] Getting filter options');
      return safeApiRequest<FilterOptionsResponse>(
        '/api/filter-options', 
        'GET', 
        undefined, 
        undefined, 
        {
          repository_languages: [],
          release_tags: [],
          batches: [],
          date_range: { min_date: null, max_date: null }
        }
      );
    },

    // Update your existing getAll method to support all filters
    getAll: (params: EnhancedDiscussionQueryParams = {}) => {
      const queryParams = new URLSearchParams();
      
      if (params.status) queryParams.append('status', params.status);
      if (params.search) queryParams.append('search', params.search);
      if (params.repository_language) queryParams.append('repository_language', params.repository_language);
      if (params.release_tag) queryParams.append('release_tag', params.release_tag);
      if (params.from_date) queryParams.append('from_date', params.from_date);
      if (params.to_date) queryParams.append('to_date', params.to_date);
      if (params.batch_id) queryParams.append('batch_id', params.batch_id.toString());
      if (params.page) queryParams.append('page', params.page.toString());
      if (params.per_page) queryParams.append('per_page', params.per_page.toString());
      if (params.user_id) queryParams.append('user_id', params.user_id);
      if (params.task1_status) queryParams.append('task1_status', params.task1_status);
      if (params.task2_status) queryParams.append('task2_status', params.task2_status);
      if (params.task3_status) queryParams.append('task3_status', params.task3_status);
      const url = `/api/discussions${queryParams.toString() ? `?${queryParams.toString()}` : ''}`;
      
      return safeApiRequest<PaginatedDiscussionsResponse>(
        url, 
        'GET', 
        undefined, 
        undefined, 
        {
          items: [],
          total: 0,
          page: 1,
          per_page: 10,
          pages: 0
        }
      );
    },
    
    // Legacy method for backward compatibility - returns all discussions without pagination
    getAllLegacy: () => safeApiRequest<Discussion[]>('/api/discussions?per_page=1000', 'GET', undefined, undefined, []),
    
    getById: (id: string) => safeApiRequest<Discussion>(`/api/discussions/${id}`, 'GET', undefined, undefined, {} as Discussion),
    
    getByStatus: (status: TaskStatus, params: Omit<DiscussionQueryParams, 'status'> = {}) => {
      const queryParams = new URLSearchParams();
      queryParams.append('status', status);
      
      if (params.page) queryParams.append('page', params.page.toString());
      if (params.per_page) queryParams.append('per_page', params.per_page.toString());
      
      const url = `/api/discussions?${queryParams.toString()}`;
      
      return safeApiRequest<PaginatedDiscussionsResponse>(
        url, 
        'GET', 
        undefined, 
        undefined, 
        {
          items: [],
          total: 0,
          page: 1,
          per_page: 10,
          pages: 0
        }
      );
    },
    
    getByBatch: (batchId: number, params: DiscussionQueryParams = {}) => {
      const queryParams = new URLSearchParams();
      
      if (params.page) queryParams.append('page', params.page.toString());
      if (params.per_page) queryParams.append('per_page', params.per_page.toString());
      
      const url = `/api/batches/${batchId}/discussions${queryParams.toString() ? `?${queryParams.toString()}` : ''}`;
      
      return safeApiRequest<PaginatedDiscussionsResponse>(
        url, 
        'GET', 
        undefined, 
        undefined, 
        {
          items: [],
          total: 0,
          page: 1,
          per_page: 10,
          pages: 0
        }
      );
    },
  },

  // Annotation endpoints
  annotations: {
    getByDiscussionId: (discussionId: string) => 
      safeApiRequest<Annotation[]>(`/api/annotations?discussion_id=${discussionId}`, 'GET', undefined, undefined, []),
    getByTaskAndDiscussion: (discussionId: string, taskId: number) => 
      safeApiRequest<Annotation[]>(`/api/annotations?discussion_id=${discussionId}&task_id=${taskId}`, 'GET', undefined, undefined, []),
    getUserAnnotation: (discussionId: string, userId: string, taskId: number) => 
      safeApiRequest<Annotation>(`/api/annotations?discussion_id=${discussionId}&user_id=${userId}&task_id=${taskId}`, 'GET', undefined, undefined, {} as Annotation),
    save: (annotation: Omit<Annotation, 'timestamp'>) => {
      // The incoming 'annotation' object is already expected to have snake_case keys
      const apiAnnotation = {
        discussion_id: annotation.discussion_id,
        user_id: annotation.user_id,
        task_id: annotation.task_id,
        data: annotation.data
      };
      
      return safeApiRequest<Annotation>('/api/annotations', 'POST', apiAnnotation, undefined, {} as Annotation);
    },
    update: (annotation: Annotation) => {
      // The incoming 'annotation' object is already expected to have snake_case keys.
      const apiAnnotation = {
        data: annotation.data  // Only need to send the data for updates
      };
      
      return safeApiRequest<Annotation>(
        `/api/annotations/${annotation.discussion_id}/${annotation.user_id}/${annotation.task_id}`,
        'PUT',
        apiAnnotation, 
        undefined, 
        {} as Annotation
      );
    },
    upload: (file: File, discussionId: string) => {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('discussion_id', discussionId);
      console.log(`[File Upload] Uploading file for discussion: ${discussionId}`, file.name, file.type, file.size);
      return safeApiRequest<{fileUrl: string}>('/api/files/upload', 'POST', formData, {
        'Content-Type': undefined as any
      }, { fileUrl: '' });
    },
    // Method for pod leads to override annotations
    podLeadOverride: (annotatorId: string, discussionId: string, taskId: number, data: Record<string, any>) => 
      safeApiRequest<Annotation>('/api/pod-lead/annotations/override', 'PUT', {
        annotator_id: annotatorId,
        discussion_id: discussionId,
        task_id: taskId,
        data
      }, undefined, {} as Annotation),
  },

  // Consensus endpoints
  consensus: {
    get: (discussionId: string, taskId: number) => 
      safeApiRequest<Annotation>(`/api/selected/consensus/${discussionId}/${taskId}`, 'GET', undefined, undefined, {} as Annotation),
    save: (consensus: Omit<Annotation, 'timestamp'>) => {
      // The incoming 'consensus' object is already expected to have snake_case keys.
      const apiConsensus = {
        discussion_id: consensus.discussion_id,
        user_id: consensus.user_id,
        task_id: consensus.task_id,
        data: consensus.data
      };
      
      console.log('[api.consensus.save] Sending to API:', JSON.stringify(apiConsensus)); // DEBUG LOG
      return safeApiRequest<Annotation>('/api/consensus', 'POST', apiConsensus, undefined, {} as Annotation);
    },
    calculate: (discussionId: string, taskId: number) => 
      safeApiRequest<{result: string, agreement: boolean}>(`/api/consensus/${discussionId}/${taskId}/calculate`, 'GET', undefined, undefined, { result: '', agreement: false }),
    override: (discussionId: string, taskId: number, data: Record<string, any>) =>
      safeApiRequest<Annotation>('/api/consensus/override', 'PUT', { 
        discussion_id: discussionId, 
        task_id: taskId, 
        data 
      }, undefined, {} as Annotation),
  },
  
  // Code download endpoint
  code: {
    getDownloadUrl: (discussionId: string, repo: string) => 
      safeApiRequest<{downloadUrl: string}>(`/api/code/download?discussion_id=${discussionId}&repo=${repo}`, 'GET', undefined, undefined, { downloadUrl: '' })
  },
  
  // Authentication endpoints
  auth: {
    login: (email: string, password: string) => {
      console.log('[Auth] Logging in user:', email);
      return safeApiRequest<{success: boolean, token: string, user: any}>('/api/auth/login', 'POST', { email, password }, undefined, { 
        success: false, 
        token: '', 
        user: null, 

      });
    },
    
    verifyGoogleToken: (credential: string) => {
      console.log('[Auth] Verifying Google token:', credential.substring(0, 20) + '...');
      return safeApiRequest<{success: boolean, user: any, token: string}>('/api/auth/google/login', 'POST', { credential }, undefined, { 
        success: false, 
        user: null, 
        token: '',

      });
    },
    
    // Sign up a new user
    signupUser: (email: string, password: string) => {
      console.log('[Auth] Signing up user:', email);
      return safeApiRequest<{success: boolean, user: any, token: string}>('/api/auth/signup', 'POST', { email, password }, undefined, { 
        success: false, 
        user: null,
        token: '',

      });
    },
    
    getMe: () => {
      console.log('[Auth] Getting current user profile');
      return safeApiRequest<{authenticated: boolean, user: any}>('/api/auth/me', 'GET', undefined, undefined, { 
        authenticated: false, 
        user: null 
      });
    },
    
    getAuthorizedUsers: () => {
      console.log('[Auth] Getting authorized users');
      return safeApiRequest<{id: number, email: string, role: UserRole}[]>('/api/auth/authorized-users', 'GET', undefined, undefined, []);
    },
    
    addAuthorizedUser: (email: string, role: UserRole) => {
      console.log('[Auth] Adding authorized user:', email, role);
      return safeApiRequest<{id: number, email: string, role: UserRole}>('/api/auth/authorized-users', 'POST', { email, role }, undefined, { 
        id: 0, 
        email: '', 
        role: 'annotator' as UserRole 
      });
    },
    
    removeAuthorizedUser: (email: string) => {
      console.log('[Auth] Removing authorized user:', email);
      return safeApiRequest<{message: string}>(`/api/auth/authorized-users/${encodeURIComponent(email)}`, 'DELETE', undefined, undefined, { 
        message: 'User removed' 
      });
    },
    
    changePassword: (currentPassword: string, newPassword: string) => {
      console.log('[Auth] Changing password');
      return safeApiRequest<{success: boolean, message: string}>('/api/auth/change-password', 'POST', { current_password: currentPassword, new_password: newPassword }, undefined, { 
        success: false, 
        message: 'Password change failed' 
      });
    },
    
    resetPassword: (userEmail: string, newPassword: string) => {
      console.log('[Auth] Resetting password for:', userEmail);
      return safeApiRequest<{success: boolean, message: string}>(`/api/auth/reset-password/${encodeURIComponent(userEmail)}`, 'POST', { new_password: newPassword }, undefined, { 
        success: false, 
        message: 'Password reset failed' 
      });
    },

    // NEW: Check email authorization
    checkEmailAuthorization: (email: string) => {
      console.log('[Auth] Checking email authorization:', email);
      return safeApiRequest<{id: number, email: string, role: UserRole} | null>(
        `/api/auth/check-email/${encodeURIComponent(email)}`, 
        'GET', 
        undefined, 
        undefined, 
        null
      );
    },

    // NEW: Verify user authorization
    verifyUserAuthorization: (email: string) => {
      console.log('[Auth] Verifying user authorization:', email);
      return safeApiRequest<{id: number, email: string, role: UserRole}>(
        '/api/auth/verify-user', 
        'POST', 
        { email }, 
        undefined, 
        { id: 0, email: '', role: 'annotator' as UserRole }
      );
    },
  },
  
  // Admin endpoints
  admin: {
    // Upload GitHub discussions from JSON
    uploadDiscussions: (discussions: GitHubDiscussion[], batchName?: string, batchDescription?: string) => {
      console.log('[Admin] Uploading discussions:', discussions.length);
      
      // Format each discussion to ensure API compatibility
      const formattedDiscussions = discussions.map(formatGitHubDiscussion);
      
      const payload = { 
        discussions: formattedDiscussions, 
        batch_name: batchName, 
        batch_description: batchDescription
      };
      
      console.log('[Admin] Formatted payload for API:', JSON.stringify(payload).substring(0, 200) + '...');
      
      return safeApiRequest<UploadResult>('/api/admin/discussions/upload', 'POST', payload, undefined, { 
        success: false, 
        message: 'Failed to upload discussions', 
        discussionsAdded: 0,
        errors: ['API request failed'] 
      });
    },
    
    // Update task status
    updateTaskStatus: (discussionId: string, taskId: number, status: TaskStatus) => {
      console.log(`[Admin] Updating task status: ${discussionId}, Task ${taskId} to ${status}`);
      return safeApiRequest<TaskManagementResult>('/api/admin/tasks/status', 'PUT', { 
        discussion_id: discussionId,
        task_id: taskId, 
        status 
      }, undefined, {
        success: false,
        message: 'Failed to update task status'
      });
    },
    
    bulkUpdateTaskStatus: (discussionIds: string[], taskId: number, status: TaskStatus) => {
      console.log(`[Admin] Bulk updating task status for ${discussionIds.length} discussions, Task ${taskId} to ${status}`);
      return safeApiRequest<BulkActionResult>('/api/admin/tasks/bulk-status', 'PUT', {
        discussion_ids: discussionIds,
        task_id: taskId,
        status
      }, undefined, {
        success: false,
        message: 'Failed to bulk update task status',
        updatedCount: 0,
        failedCount: 0,
        results: []
      });
    },
    
    overrideAnnotation: (annotation: Annotation) => {
      console.log('[Admin] Overriding annotation:', annotation.discussion_id, annotation.task_id);
      return safeApiRequest<Annotation>('/api/admin/annotations/override', 'PUT', annotation, undefined, {} as Annotation);
    },
    
    getQualityMetrics: () => {
      console.log('[Admin] Getting annotation quality metrics');
      return safeApiRequest<{
        discussionId: string,
        title: string,
        agreementScore: number,
        annotatorCount: number,
        conflictAreas: string[]
      }[]>('/api/admin/quality/metrics', 'GET', undefined, undefined, []);
    },
    
    getAnnotatorPerformance: () => {
      console.log('[Admin] Getting annotator performance data');
      return safeApiRequest<{
        userId: string,
        completedTasks: number,
        averageTime: number,
        agreement: number
      }[]>('/api/admin/quality/performance', 'GET', undefined, undefined, []);
    }
  },
  
  // Batch management endpoints
  batches: {
    getAllBatches: () => {
      console.log('[Batches] Getting all batches');
      return safeApiRequest<BatchUpload[]>('/api/batches', 'GET', undefined, undefined, []);
    },

    getBatchById: (batchId: number) => {
      console.log(`[Batches] Getting batch with ID: ${batchId}`);
      return safeApiRequest<BatchUpload>(`/api/batches/${batchId}`, 'GET', undefined, undefined, {} as BatchUpload);
    },

    createBatch: (name: string, description?: string) => {
      console.log(`[Batches] Creating new batch: ${name}`);
      return safeApiRequest<BatchManagementResult>('/api/batches', 'POST', { name, description }, undefined, {
        success: false,
        message: 'Failed to create batch'
      });
    },

    deleteBatch: (batchId: number) => {
      console.log(`[Batches] Deleting batch with ID: ${batchId}`);
      return safeApiRequest<BatchManagementResult>(`/api/batches/${batchId}`, 'DELETE', undefined, undefined, {
        success: false,
        message: 'Failed to delete batch'
      });
    },

    updateBatch: (batchId: number, name: string, description?: string) => {
      console.log(`[Batches] Updating batch with ID: ${batchId}`);
      return safeApiRequest<BatchManagementResult>(`/api/batches/${batchId}`, 'PUT', { name, description }, undefined, {
        success: false,
        message: 'Failed to update batch'
      });
    },

    getBatchDiscussions: (batchId: number, params: DiscussionQueryParams = {}) => {
      const queryParams = new URLSearchParams();
      
      if (params.page) queryParams.append('page', params.page.toString());
      if (params.per_page) queryParams.append('per_page', params.per_page.toString());
      
      const url = `/api/batches/${batchId}/discussions${queryParams.toString() ? `?${queryParams.toString()}` : ''}`;
      
      console.log(`[Batches] Getting discussions for batch ID: ${batchId}`);
      return safeApiRequest<PaginatedDiscussionsResponse>(
        url, 
        'GET', 
        undefined, 
        undefined, 
        {
          items: [],
          total: 0,
          page: 1,
          per_page: 10,
          pages: 0
        }
      );
    }
  },

  // NEW: Downloads endpoints (from download_handler.py)
  downloads: {
    getFile: (filename: string) => {
      console.log(`[Downloads] Getting file: ${filename}`);
      // This endpoint returns the actual file, so we handle it differently
      const url = `/downloads/${encodeURIComponent(filename)}`;
      window.open(formatApiUrl(url), '_blank');
      return Promise.resolve({ success: true });
    }
  },

  // NEW: Export endpoints (from export_service.py)
  export: {
    batchDiscussions: (batchId: number, format: 'json' | 'csv' = 'json') => {
      console.log(`[Export] Exporting batch ${batchId} discussions as ${format}`);
      return safeApiRequest<ExportResponse>(
        `/api/export/batches/${batchId}?format=${format}`, 
        'GET', 
        undefined, 
        undefined, 
        {
          success: false,
          downloadUrl: '',
          filename: '',
          format: format,
          expiresIn: '24 hours'
        }
      );
    },

    allDiscussions: (format: 'json' | 'csv' = 'json') => {
      console.log(`[Export] Exporting all discussions as ${format}`);
      return safeApiRequest<ExportResponse>(
        `/api/export/discussions?format=${format}`, 
        'GET', 
        undefined, 
        undefined, 
        {
          success: false,
          downloadUrl: '',
          filename: '',
          format: format,
          expiresIn: '24 hours'
        }
      );
    }
  },
  
  summary: {
    getSystemSummary: () => {
      console.log('[Summary] Getting system summary statistics');
      return safeApiRequest<any>('/api/summary/stats', 'GET', undefined, undefined, {
        totalDiscussions: 0,
        task1Completed: 0,
        task2Completed: 0,
        task3Completed: 0,
        totalTasksCompleted: 0,
        totalAnnotations: 0,
        uniqueAnnotators: 0,
        totalBatches: 0,
        batchesBreakdown: [],
        trainerBreakdown: [],
        taskProgression: {
          stuck_in_task1: 0,
          stuck_in_task2: 0,
          reached_task3: 0,
          fully_completed: 0
        },
        consensus_annotations: 0
      });
    },
    
    getUserSummary: (userId: string) => {
      console.log(`[Summary] Getting user summary for: ${userId}`);
      return safeApiRequest<UserSummary>(`/api/summary/user/${userId}`, 'GET', undefined, undefined, {
        userId: userId,
        totalAnnotations: 0,
        task1Completed: 0,
        task2Completed: 0,
        task3Completed: 0,
        totalTasksCompleted: 0
      });
    },

    downloadReportAsFile: async (format: 'json' | 'csv' = 'json') => {
      console.log(`[Summary] Downloading ${format} report as file`);

      try {
        // Make a direct fetch request to get the file
        const response = await fetch(`${formatApiUrl('/api/summary/report')}?format=${format}`, {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
          }
        });

        if (!response.ok) {
          throw new Error(`Failed to download report: ${response.statusText}`);
        }

        // Get the blob data
        const blob = await response.blob();

        // Create a download link
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        const timestamp = new Date().toISOString().split('T')[0]; // YYYY-MM-DD

        // Set download attributes
        a.href = url;
        a.download = `annotation-report-${timestamp}.${format}`;
        a.style.display = 'none';

        // Trigger the download
        document.body.appendChild(a);
        a.click();

        // Clean up
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);

        return { success: true };
      } catch (error) {
        console.error(`[Summary] Error downloading ${format} report:`, error);
        return { success: false, error: error.message };
      }
    },

    downloadReport: (format: 'json' | 'csv' = 'json') => {
      console.log(`[Summary] Downloading report in ${format} format`);
      return safeApiRequest<{downloadUrl: string}>(`/api/summary/report?format=${format}`, 'GET', undefined, undefined, {
        downloadUrl: ''
      });
    },
    
    getAnnotationActivity: (fromDate?: string, toDate?: string) => {
      const dateParams = [];
      if (fromDate) dateParams.push(`fromDate=${fromDate}`);
      if (toDate) dateParams.push(`toDate=${toDate}`);
      const queryString = dateParams.length > 0 ? `?${dateParams.join('&')}` : '';
      
      console.log(`[Summary] Getting annotation activity data${queryString}`);
      return safeApiRequest<{date: string, count: number}[]>(`/api/summary/activity${queryString}`, 'GET', undefined, undefined, []);
    },
    
    getRepositoryBreakdown: () => {
      console.log('[Summary] Getting repository breakdown');
      return safeApiRequest<{repository: string, count: number}[]>('/api/summary/repositories', 'GET', undefined, undefined, []);
    }
  },

  // User endpoints
  users: {
    getUserById: (userId: string) => {
      console.log(`[Users] Getting user with ID: ${userId}`);
      return safeApiRequest<{id: string, email: string, username: string, role: UserRole}>(
        `/api/auth/users/${encodeURIComponent(userId)}`, 
        'GET', 
        undefined, 
        undefined, 
        {id: userId, email: '', username: '', role: 'annotator' as UserRole}
      );
    },
    
    getAllUsers: () => {
      console.log('[Users] Getting all users');
      return safeApiRequest<{id: string, email: string, username: string, role: UserRole}[]>(
        '/api/auth/users', 
        'GET', 
        undefined, 
        undefined, 
        []
      );
    },
    
    // Add a method to check if a user exists and get basic info without needing admin privileges
    getPublicUserInfo: (userId: string) => {
      console.log(`[Users] Getting public info for user: ${userId}`);
      return safeApiRequest<{id: string, username: string}>(
        `/api/auth/users/${encodeURIComponent(userId)}/public`, 
        'GET', 
        undefined, 
        undefined, 
        {id: userId, username: `User ${userId}`}
      );
    }
  },

  // NEW: Pod Lead specific endpoints (using existing database)
  podLead: {
    // Get pod lead summary/dashboard data (uses existing tables)
    getSummary: () => {
      console.log('[Pod Lead] Getting pod lead summary');
      return safeApiRequest('/api/pod-lead/summary', 'GET', undefined, undefined, {
        team_members: [],
        team_performance: {
          total_annotations: 0,
          average_agreement_rate: 0,
          users_needing_attention: []
        },
        workflow_status: {
          discussions_ready_for_review: 0,
          pending_consensus: 0
        }
      });
    },
    getBreakdown: () => {
      console.log('[Pod Lead] Getting pod lead breakdown');
      return safeApiRequest('/api/pod-lead/breakdown', 'GET', undefined, undefined, {
        pod_lead_email: '',
        consensus_created: 0,
        annotations_overridden: 0,
        team_members_managed: 0,
        recent_activity: new Date().toISOString()
      });
    },
    getAllBreakdown: () => {
      console.log('[Pod Lead] Getting all pod leads breakdown');
      return safeApiRequest('/api/pod-lead/all-breakdown', 'GET', undefined, undefined, []);
    },
    // Get team performance metrics (aggregates existing user data)
    getTeamPerformance: () => {
      console.log('[Pod Lead] Getting team performance metrics');
      return safeApiRequest('/api/pod-lead/team/performance', 'GET', undefined, undefined, {
        team_members: [],
        performance_summary: {
          excellent_performers: 0,
          needs_improvement: 0,
          total_annotations: 0,
          average_agreement_rate: 0
        }
      });
    },

    // Get discussions that need pod lead review (filters existing discussions)
    getDiscussionsForReview: (params: { priority?: string; page?: number; per_page?: number } = {}) => {
      const queryParams = new URLSearchParams();
      if (params.priority) queryParams.append('priority', params.priority);
      if (params.page) queryParams.append('page', params.page.toString());
      if (params.per_page) queryParams.append('per_page', params.per_page.toString());
      
      const url = `/api/pod-lead/discussions/review${queryParams.toString() ? `?${queryParams.toString()}` : ''}`;
      
      console.log('[Pod Lead] Getting discussions for review');
      return safeApiRequest(url, 'GET', undefined, undefined, {
        items: [],
        total: 0,
        page: 1,
        per_page: 10,
        pages: 0
      });
    },

    // Override annotation as pod lead (already exists!)
    overrideAnnotation: (annotatorId: string, discussionId: string, taskId: number, data: Record<string, any>) => {
      console.log(`[Pod Lead] Overriding annotation for ${annotatorId} on ${discussionId} task ${taskId}`);
      return safeApiRequest<Annotation>('/api/pod-lead/annotations/override', 'PUT', {
        annotator_id: annotatorId,
        discussion_id: discussionId,
        task_id: taskId,
        data
      }, undefined, {} as Annotation);
    },

    // Get team member's detailed performance (uses existing user agreement analysis)
    getUserPerformance: (userId: string) => {
      console.log(`[Pod Lead] Getting performance data for user: ${userId}`);
      // This can directly use the existing workflow.userAgreementAnalysis endpoint
      return api.workflow.userAgreementAnalysis(userId, null, true);
    }
  },

  // NEW: File Upload/Management endpoints (for code uploads, attachments)
  files: {
    upload: (file: File, discussionId?: string, taskId?: number) => {
      const formData = new FormData();
      formData.append('file', file);
      if (discussionId) formData.append('discussion_id', discussionId);
      if (taskId) formData.append('task_id', taskId.toString());
      
      console.log(`[Files] Uploading file: ${file.name}`);
      return safeApiRequest<{success: boolean, fileUrl: string, filename: string}>('/api/files/upload', 'POST', formData, {
        'Content-Type': undefined as any
      }, { success: false, fileUrl: '', filename: '' });
    },

    delete: (fileUrl: string) => {
      console.log(`[Files] Deleting file: ${fileUrl}`);
      return safeApiRequest<{success: boolean, message: string}>('/api/files/delete', 'DELETE', { file_url: fileUrl }, undefined, {
        success: false,
        message: 'Failed to delete file'
      });
    },

    getMetadata: (fileUrl: string) => {
      console.log(`[Files] Getting file metadata: ${fileUrl}`);
      return safeApiRequest<{filename: string, size: number, type: string, uploadedAt: string}>(`/api/files/metadata?file_url=${encodeURIComponent(fileUrl)}`, 'GET', undefined, undefined, {
        filename: '',
        size: 0,
        type: '',
        uploadedAt: ''
      });
    }
  },


};

// Export the pagination types for use in other files
export type { 
  PaginatedDiscussionsResponse, 
  DiscussionQueryParams, 
  EnhancedDiscussionQueryParams, 
  FilterOptionsResponse,
  TaskCompletionStatusResponse,
  ExportResponse
};