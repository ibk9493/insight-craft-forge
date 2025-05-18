import { toast } from '@/components/ui/sonner';
import { ApiError } from './types';
import { Discussion, Annotation, TaskStatus, GitHubDiscussion, UploadResult, 
         TaskManagementResult, UserRole, SystemSummary, UserSummary, 
         BatchUpload, BatchManagementResult, BulkTaskUpdate, BulkActionResult } from './types';
import { API_CONFIG } from '@/config';

/**
 * API base configuration values
 */
export const API_URL = API_CONFIG.BASE_URL;
export const API_KEY = API_CONFIG.HEADERS['X-API-Key'];
export const USE_MOCK_DATA = false; // Set this to false to disable mock data

/**
 * Properly formats the API URL to ensure it doesn't have duplicate slashes
 * @param endpoint - The API endpoint to format
 * @returns The properly formatted API URL
 */
export const formatApiUrl = (endpoint: string): string => {
  if (!API_URL) return endpoint; // If no API URL, just return the endpoint
  
  // Remove leading slash from endpoint if it exists and API_URL ends with a slash
  const cleanEndpoint = API_URL.endsWith('/') && endpoint.startsWith('/') 
    ? endpoint.substring(1) 
    : endpoint;
  
  // Ensure proper joining of URL parts
  const baseUrl = API_URL.endsWith('/') ? API_URL : `${API_URL}/`;
  const formattedEndpoint = cleanEndpoint.startsWith('/') ? cleanEndpoint.substring(1) : cleanEndpoint;
  
  return `${baseUrl.replace(/\/+$/, '')}/${formattedEndpoint}`;
};

/**
 * Safely converts any value to a string suitable for display
 * @param value - Any value to convert to a string
 * @returns A string representation of the value
 */
export const safeToString = (value: unknown): string => {
  if (value === null) return 'null';
  if (value === undefined) return 'undefined';
  
  if (typeof value === 'object') {
    try {
      return JSON.stringify(value);
    } catch (e) {
      return '[Object]';
    }
  }
  
  return String(value);
};

/**
 * Handles API responses and performs error checking
 * @param response - The fetch API response
 * @returns The parsed JSON response
 * @throws ApiError if the response is not ok or not JSON
 */
export const handleResponse = async <T>(response: Response): Promise<T> => {
  // Check if response is OK
  if (!response.ok) {
    console.error(`[API Error] Response not OK: ${response.status} ${response.statusText}`);
    
    let errorData;
    try {
      // Try to parse error as JSON
      errorData = await response.json();
      console.error('[API Error] Error response body:', errorData);
      
      // If the error contains details in a structured format, format it for better display
      if (errorData.detail && Array.isArray(errorData.detail)) {
        const formattedErrors = errorData.detail.map((err: any) => {
          if (err.msg && err.loc) {
            return `${err.msg} at ${err.loc.join('.')}`;
          }
          return safeToString(err);
        });
        
        errorData.message = formattedErrors.join('; ');
      }
      
    } catch (e) {
      // If it's not JSON, get text content for debugging
      const textContent = await response.text();
      console.error('[API Error] Non-JSON error response:', textContent.substring(0, 500) + (textContent.length > 500 ? '...' : ''));
      errorData = { message: 'Server returned a non-JSON error' };
    }
    
    const error: ApiError = {
      message: errorData.message || errorData.detail || `Error ${response.status}: ${response.statusText}`,
      status: response.status
    };
    throw error;
  }
  
  // Check content type to ensure we're getting JSON
  const contentType = response.headers.get('content-type');
  console.log(`[API Response] Content-Type: ${contentType || 'not specified'}`);
  
  if (!contentType || !contentType.includes('application/json')) {
    try {
      // Try to get the first 500 chars of the response for debugging
      const textContent = await response.text();
      console.error('[API Error] Expected JSON but got:', contentType || 'no content type');
      console.error('[API Error] Response preview:', textContent.substring(0, 500) + (textContent.length > 500 ? '...' : ''));
      
      throw {
        message: `Invalid response format: Expected JSON but got ${contentType || 'unknown format'}`,
        status: response.status
      };
    } catch (error) {
      console.error('[API Error] Failed to read response body:', error);
      throw {
        message: 'Invalid response format: Expected JSON',
        status: response.status
      };
    }
  }
  
  try {
    const jsonResponse = await response.json();
    console.log(`[API Response] Successful JSON response for ${response.url}`);
    return jsonResponse as T;
  } catch (error) {
    console.error('[API Error] Failed to parse JSON response:', error);
    throw {
      message: 'Failed to parse JSON response',
      status: response.status
    };
  }
};

/**
 * Makes API requests with error handling and fallback to mock data
 * 
 * @param endpoint - API endpoint path (without base URL)
 * @param method - HTTP method (GET, POST, PUT, DELETE)
 * @param body - Request body for POST/PUT requests
 * @param headers - Additional headers to include
 * @returns The API response data
 */
export const apiRequest = async <T>(
  endpoint: string,
  method: string = 'GET',
  body?: unknown,
  headers?: Record<string, string>
): Promise<T> => {
  console.info(`[API Request] ${method} ${endpoint} - Mock data disabled`);
  
  try {
    const requestHeaders = {
      ...API_CONFIG.HEADERS,
      ...(headers || {})
    };

    const config: RequestInit = {
      method,
      headers: requestHeaders,
      credentials: 'include',
    };

    if (body) {
      if (body instanceof FormData) {
        // If body is FormData, delete Content-Type header to let browser set it
        delete requestHeaders['Content-Type'];
        config.body = body;
        console.log(`[API Request] Sending FormData with ${body.getAll('file').length} files`);
      } else if (method === 'POST' || method === 'PUT' || method === 'PATCH') {
        config.body = JSON.stringify(body);
        console.log(`[API Request] Request body:`, body);
      }
    }

    // Format the API URL properly
    const formattedUrl = formatApiUrl(endpoint);
    console.debug(`[API Request] Making actual API request to: ${formattedUrl}`);
    
    // Track request timing
    const startTime = performance.now();
    
    // Make the actual API call
    const response = await fetch(formattedUrl, config);
    
    const endTime = performance.now();
    console.log(`[API Timing] Request to ${endpoint} took ${(endTime - startTime).toFixed(2)}ms`);
    
    return await handleResponse<T>(response);
  } catch (error) {
    if ((error as ApiError).message) {
      toast.error(safeToString((error as ApiError).message));
    } else {
      toast.error('An error occurred while connecting to the server');
    }
    
    // Don't fall back to mock data anymore
    throw error;
  }
};

// Helper function to get mock data based on endpoint - not used anymore
export function getMockData<T>(endpoint: string): T {
  console.error('[API Error] Mock data is disabled. This function should not be called.');
  throw new Error('Mock data is disabled');
}

// Define the fetchDiscussions function to be used in the redux slice
export const fetchDiscussions = async (): Promise<Discussion[]> => {
  return await safeApiRequest<Discussion[]>('/api/discussions', 'GET', undefined, undefined, []);
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
  
  // Convert metadata fields to snake_case
  if (discussion.repositoryLanguage) {
    apiFormatted.repository_language = discussion.repositoryLanguage;
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

export const api = {
  // Discussion endpoints
  discussions: {
    getAll: () => safeApiRequest<Discussion[]>('/api/discussions', 'GET', undefined, undefined, []),
    getById: (id: string) => safeApiRequest<Discussion>(`/api/discussions/${id}`, 'GET', undefined, undefined, {} as Discussion),
    getByStatus: (status: TaskStatus) => 
      safeApiRequest<Discussion[]>(`/api/discussions?status=${status}`, 'GET', undefined, undefined, []),
    getByBatch: (batchId: number) => 
      safeApiRequest<Discussion[]>(`/api/discussions?batchId=${batchId}`, 'GET', undefined, undefined, []),
  },

  // Annotation endpoints
  annotations: {
    getByDiscussionId: (discussionId: string) => 
      safeApiRequest<Annotation[]>(`/api/annotations?discussionId=${discussionId}`, 'GET', undefined, undefined, []),
    getByTaskAndDiscussion: (discussionId: string, taskId: number) => 
      safeApiRequest<Annotation[]>(`/api/annotations?discussionId=${discussionId}&taskId=${taskId}`, 'GET', undefined, undefined, []),
    getUserAnnotation: (discussionId: string, userId: string, taskId: number) => 
      safeApiRequest<Annotation>(`/api/annotations?discussionId=${discussionId}&userId=${userId}&taskId=${taskId}`, 'GET', undefined, undefined, {} as Annotation),
    save: (annotation: Omit<Annotation, 'timestamp'>) => {
      // Convert camelCase to snake_case for the API
      const apiAnnotation = {
        discussion_id: annotation.discussionId,
        user_id: annotation.userId,
        task_id: annotation.taskId,
        data: annotation.data
      };
      
      return safeApiRequest<Annotation>('/api/annotations', 'POST', apiAnnotation, undefined, {} as Annotation);
    },
    update: (annotation: Annotation) => {
      // Convert camelCase to snake_case for the API
      const apiAnnotation = {
        discussion_id: annotation.discussionId,
        user_id: annotation.userId,
        task_id: annotation.taskId,
        data: annotation.data
      };
      
      return safeApiRequest<Annotation>(
        `/api/annotations/${annotation.discussionId}/${annotation.userId}/${annotation.taskId}`, 
        'PUT', 
        apiAnnotation, 
        undefined, 
        {} as Annotation
      );
    },
    upload: (file: File, discussionId: string) => {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('discussionId', discussionId);
      console.log(`[File Upload] Uploading file for discussion: ${discussionId}`, file.name, file.type, file.size);
      return safeApiRequest<{fileUrl: string}>('/api/files/upload', 'POST', formData, {
        'Content-Type': undefined as any
      }, { fileUrl: '' });
    },
    // Method for pod leads to override annotations
    podLeadOverride: (podLeadId: string, annotatorId: string, discussionId: string, taskId: number, data: Record<string, string | boolean>) => 
      safeApiRequest<Annotation>('/api/pod-lead/annotations/override', 'POST', {
        pod_lead_id: podLeadId,
        annotator_id: annotatorId,
        discussion_id: discussionId,
        task_id: taskId,
        data
      }, undefined, {} as Annotation),
  },

  // Consensus endpoints
  consensus: {
    get: (discussionId: string, taskId: number) => 
      safeApiRequest<Annotation>(`/api/consensus?discussionId=${discussionId}&taskId=${taskId}`, 'GET', undefined, undefined, {} as Annotation),
    save: (consensus: Omit<Annotation, 'timestamp'>) => {
      // Convert camelCase to snake_case for the API
      const apiConsensus = {
        discussion_id: consensus.discussionId,
        user_id: consensus.userId,
        task_id: consensus.taskId,
        data: consensus.data
      };
      
      return safeApiRequest<Annotation>('/api/consensus', 'POST', apiConsensus, undefined, {} as Annotation);
    },
    calculate: (discussionId: string, taskId: number) => 
      safeApiRequest<{result: string, agreement: boolean}>(`/api/consensus/calculate?discussionId=${discussionId}&taskId=${taskId}`, 'GET', undefined, undefined, { result: '', agreement: false }),
    override: (discussionId: string, taskId: number, data: Record<string, string | boolean>) =>
      safeApiRequest<Annotation>('/api/consensus/override', 'POST', { discussionId, taskId, data }, undefined, {} as Annotation),
  },
  
  // Code download endpoint
  code: {
    getDownloadUrl: (discussionId: string, repo: string) => 
      safeApiRequest<{downloadUrl: string}>(`/api/code/download?discussionId=${discussionId}&repo=${repo}`, 'GET', undefined, undefined, { downloadUrl: '' })
  },
  
  // Authentication endpoints
  auth: {
    verifyGoogleToken: (token: string) => {
      // In a real app, this would send the token to your backend
      console.log('[Auth] Verifying Google token:', token.substring(0, 20) + '...');
      
      return safeApiRequest<{success: boolean, user: any}>('/api/auth/google', 'POST', { token }, undefined, { success: false, user: null });
    },
    
    // Sign up a new user
    signupUser: (email: string, password: string) => {
      console.log('[Auth] Signing up user:', email);
      return safeApiRequest<{success: boolean, userId: string}>('/api/auth/signup', 'POST', { email, password }, undefined, { success: false, userId: '' });
    },
    
    getAuthorizedUsers: () => {
      console.log('[Auth] Getting authorized users');
      return safeApiRequest<{email: string, role: UserRole}[]>('/api/auth/authorized-users', 'GET', undefined, undefined, []);
    },
    
    addAuthorizedUser: (email: string, role: UserRole) => {
      console.log('[Auth] Adding authorized user:', email, role);
      return safeApiRequest<{success: boolean}>('/api/auth/authorized-users', 'POST', { email, role }, undefined, { success: false });
    },
    
    removeAuthorizedUser: (email: string) => {
      console.log('[Auth] Removing authorized user:', email);
      return safeApiRequest<{success: boolean}>(`/api/auth/authorized-users/${encodeURIComponent(email)}`, 'DELETE', undefined, undefined, { success: false });
    }
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
      // Use proper field names to match backend expectations
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
        discussionIds,
        taskId,
        status
      }, undefined, {
        success: false,
        message: 'Failed to bulk update task status',
        updatedCount: 0,
        failedCount: 0
      });
    },
    
    overrideAnnotation: (annotation: Annotation) => {
      console.log('[Admin] Overriding annotation:', annotation.discussionId, annotation.taskId);
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
    
    downloadReport: (format: 'csv' | 'json' = 'csv') => {
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
  }
};
