import { toast } from '@/components/ui/sonner';
import { ApiError } from './types';
import { Discussion, Annotation, TaskStatus, GitHubDiscussion, UploadResult, 
         TaskManagementResult, UserRole, SystemSummary, UserSummary, 
         BatchUpload, BatchManagementResult, BulkTaskUpdate, BulkActionResult } from './types';
import { API_CONFIG } from '@/config';
import { apiRequest, safeApiRequest, formatApiUrl, safeToString } from './helpers';

// Define the fetchDiscussions function to be used in the redux slice
export const fetchDiscussions = async (): Promise<Discussion[]> => {
  return await safeApiRequest<Discussion[]>('/api/discussions', 'GET', undefined, undefined, []);
};

// Helper function to format GitHub discussions for API compatibility
// Update formatGitHubDiscussion in endpoints.ts
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
  if (discussion.repositoryLanguage) {
    apiFormatted.repository_language = discussion.repositoryLanguage;
  } else if (discussion.lang) {
    apiFormatted.repository_language = discussion.lang;
  }

  if (discussion.releaseTag) {
    apiFormatted.release_tag = discussion.releaseTag;
  }

  if (discussion.releaseUrl) {
    apiFormatted.release_url = discussion.releaseUrl;
  }

  if (discussion.releaseDate) {
    apiFormatted.release_date = discussion.releaseDate;
  }

  // Handle tasks if present
  if (discussion.tasks) {
    apiFormatted.tasks = discussion.tasks;
  }

  // Handle batch ID if present
  if (discussion.batchId) {
    apiFormatted.batch_id = discussion.batchId;
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
// Add this to your api.ts file to improve reliability

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
  // Discussion endpoints
  discussions: {
    getAll: () => safeApiRequest<Discussion[]>('/api/discussions', 'GET', undefined, undefined, []),
    getById: (id: string) => safeApiRequest<Discussion>(`/api/discussions/${id}`, 'GET', undefined, undefined, {} as Discussion),
    getByStatus: (status: TaskStatus) => 
      safeApiRequest<Discussion[]>(`/api/discussions?status=${status}`, 'GET', undefined, undefined, []),
    getByBatch: (batchId: number) => 
      safeApiRequest<Discussion[]>(`/api/batches/${batchId}/discussions`, 'GET', undefined, undefined, []),
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
      safeApiRequest<Annotation>(`/api/consensus/${discussionId}/${taskId}`, 'GET', undefined, undefined, {} as Annotation),
    save: (consensus: Omit<Annotation, 'timestamp'>) => {
      if (consensus.data.grounded == "N/A") {
        consensus.data.grounded = "False"
      }
      console.log("OKAY: WHOLA!", consensus.data)
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

    getBatchDiscussions: (batchId: number) => {
      console.log(`[Batches] Getting discussions for batch ID: ${batchId}`);
      return safeApiRequest<Discussion[]>(`/api/batches/${batchId}/discussions`, 'GET', undefined, undefined, []);
    }
  },
  
  summary: {
    getSystemSummary: () => {
      console.log('[Summary] Getting system summary statistics');
      return safeApiRequest<SystemSummary>('/api/summary/stats', 'GET', undefined, undefined, {
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
  // Add this to the api object within api.ts

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
}
};