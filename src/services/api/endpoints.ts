import { apiRequest } from './helpers';
import { Discussion, Annotation, TaskStatus, GitHubDiscussion, UploadResult, 
         TaskManagementResult, UserRole, SystemSummary, UserSummary, 
         BatchUpload, BatchManagementResult, BulkTaskUpdate, BulkActionResult } from './types';

/**
 * API endpoint functions for the SWE-QA Annotation System
 * 
 * Includes endpoints for:
 * - Discussions: CRUD operations for GitHub discussions
 * - Annotations: Create, read, update annotations made by users
 * - Consensus: Calculate and save consensus annotations
 * - Files: Upload and retrieve files (screenshots, etc.)
 * - Code: Download repository code for annotation tasks
 * - Auth: Authentication-related endpoints
 * - Admin: Admin-specific endpoints for managing discussions and tasks
 * - Batches: Batch management for uploaded discussions
 */

// Custom error handler for API requests that returns empty fallbacks
const safeApiRequest = async <T>(
  url: string, 
  method: string = 'GET', 
  data?: any, 
  headers?: Record<string, string>,
  fallback?: T
): Promise<T> => {
  try {
    console.log(`[API Request] ${method} ${url}`, data ? JSON.stringify(data).substring(0, 100) + '...' : '');
    const response = await apiRequest<T>(url, method, data, headers);
    console.log(`[API Response] ${method} ${url} - Success:`, response);
    return response;
  } catch (error) {
    console.error(`[API Error] ${method} ${url} - Failed:`, error);
    if (fallback !== undefined) {
      return fallback;
    } else {
      // Return appropriate fallback based on expected return type
      // This handles the case where batches.filter is not a function
      if (url.includes('batches') && !url.includes('batch')) {
        // For batch list endpoints, return empty array
        return ([] as unknown) as T;
      }
      // Return empty array for array types, empty object for object types
      return (Array.isArray(fallback) ? [] : {}) as T;
    }
  }
};

// Define the fetchDiscussions function to be used in the redux slice
export const fetchDiscussions = async (): Promise<Discussion[]> => {
  return await safeApiRequest<Discussion[]>('/api/discussions', 'GET', undefined, undefined, []);
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
    save: (annotation: Omit<Annotation, 'timestamp'>) => 
      safeApiRequest<Annotation>('/api/annotations', 'POST', annotation, undefined, {} as Annotation),
    update: (annotation: Annotation) => 
      safeApiRequest<Annotation>(`/api/annotations/${annotation.discussionId}/${annotation.userId}/${annotation.taskId}`, 'PUT', annotation, undefined, {} as Annotation),
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
    save: (consensus: Omit<Annotation, 'timestamp'>) => 
      safeApiRequest<Annotation>('/api/consensus', 'POST', consensus, undefined, {} as Annotation),
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
    
    // Get authorized users endpoint
    getAuthorizedUsers: () => {
      console.log('[Auth] Getting authorized users');
      // In production, always make the API call
      return safeApiRequest<{email: string, role: UserRole}[]>('/api/auth/authorized-users', 'GET', undefined, undefined, []);
    },
    
    // Add authorized user endpoint
    addAuthorizedUser: (email: string, role: UserRole) => {
      console.log('[Auth] Adding authorized user:', email, role);
      return safeApiRequest<{success: boolean}>('/api/auth/authorized-users', 'POST', { email, role }, undefined, { success: false });
    },
    
    // Remove authorized user endpoint
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
      return safeApiRequest<UploadResult>('/api/admin/discussions/upload', 'POST', { 
        discussions, 
        batch_name: batchName, 
        batch_description: batchDescription
      }, undefined, { 
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
    
    // NEW: Bulk update task status
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
    
    // Override annotation values
    overrideAnnotation: (annotation: Annotation) => {
      console.log('[Admin] Overriding annotation:', annotation.discussionId, annotation.taskId);
      return safeApiRequest<Annotation>('/api/admin/annotations/override', 'PUT', annotation, undefined, {} as Annotation);
    },
    
    // NEW: Get quality metrics
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
    
    // NEW: Get annotator performance
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
    // Get all batches
    getAllBatches: () => {
      console.log('[Batches] Getting all batches');
      return safeApiRequest<BatchUpload[]>('/api/batches', 'GET', undefined, undefined, []);
    },

    // Get batch by ID
    getBatchById: (batchId: number) => {
      console.log(`[Batches] Getting batch with ID: ${batchId}`);
      return safeApiRequest<BatchUpload>(`/api/batches/${batchId}`, 'GET', undefined, undefined, {} as BatchUpload);
    },

    // Create a new batch
    createBatch: (name: string, description?: string) => {
      console.log(`[Batches] Creating new batch: ${name}`);
      return safeApiRequest<BatchManagementResult>('/api/batches', 'POST', { name, description }, undefined, {
        success: false,
        message: 'Failed to create batch'
      });
    },

    // Delete a batch
    deleteBatch: (batchId: number) => {
      console.log(`[Batches] Deleting batch with ID: ${batchId}`);
      return safeApiRequest<BatchManagementResult>(`/api/batches/${batchId}`, 'DELETE', undefined, undefined, {
        success: false,
        message: 'Failed to delete batch'
      });
    },

    // Get discussions in a batch
    getBatchDiscussions: (batchId: number) => {
      console.log(`[Batches] Getting discussions for batch ID: ${batchId}`);
      return safeApiRequest<Discussion[]>(`/api/batches/${batchId}/discussions`, 'GET', undefined, undefined, []);
    }
  },
  
  // System summary endpoints
  summary: {
    // Get system summary statistics
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
    
    // Get user summary statistics
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
    
    // Generate and download report
    downloadReport: (format: 'csv' | 'json' = 'csv') => {
      console.log(`[Summary] Downloading report in ${format} format`);
      return safeApiRequest<{downloadUrl: string}>(`/api/summary/report?format=${format}`, 'GET', undefined, undefined, {
        downloadUrl: ''
      });
    },
    
    // NEW: Get annotation activity data
    getAnnotationActivity: (fromDate?: string, toDate?: string) => {
      const dateParams = [];
      if (fromDate) dateParams.push(`fromDate=${fromDate}`);
      if (toDate) dateParams.push(`toDate=${toDate}`);
      const queryString = dateParams.length > 0 ? `?${dateParams.join('&')}` : '';
      
      console.log(`[Summary] Getting annotation activity data${queryString}`);
      return safeApiRequest<{date: string, count: number}[]>(`/api/summary/activity${queryString}`, 'GET', undefined, undefined, []);
    },
    
    // NEW: Get repository breakdown
    getRepositoryBreakdown: () => {
      console.log('[Summary] Getting repository breakdown');
      return safeApiRequest<{repository: string, count: number}[]>('/api/summary/repositories', 'GET', undefined, undefined, []);
    }
  }
};
