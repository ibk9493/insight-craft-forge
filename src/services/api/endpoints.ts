import { apiRequest } from './helpers';
import { Discussion, Annotation, TaskStatus, GitHubDiscussion, UploadResult, TaskManagementResult, UserRole } from './types';

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
      // Return empty array for array types, empty object for object types
      return (Array.isArray(fallback) ? [] : {}) as T;
    }
  }
};

// Define the fetchDiscussions function to be used in the redux slice
export const fetchDiscussions = async (): Promise<Discussion[]> => {
  return await safeApiRequest<Discussion[]>('/discussions', 'GET', undefined, undefined, []);
};

export const api = {
  // Discussion endpoints
  discussions: {
    getAll: () => safeApiRequest<Discussion[]>('/discussions', 'GET', undefined, undefined, []),
    getById: (id: string) => safeApiRequest<Discussion>(`/discussions/${id}`, 'GET', undefined, undefined, {} as Discussion),
    getByStatus: (status: TaskStatus) => 
      safeApiRequest<Discussion[]>(`/discussions?status=${status}`, 'GET', undefined, undefined, []),
  },

  // Annotation endpoints
  annotations: {
    getByDiscussionId: (discussionId: string) => 
      safeApiRequest<Annotation[]>(`/annotations?discussionId=${discussionId}`, 'GET', undefined, undefined, []),
    getByTaskAndDiscussion: (discussionId: string, taskId: number) => 
      safeApiRequest<Annotation[]>(`/annotations?discussionId=${discussionId}&taskId=${taskId}`, 'GET', undefined, undefined, []),
    getUserAnnotation: (discussionId: string, userId: string, taskId: number) => 
      safeApiRequest<Annotation>(`/annotations?discussionId=${discussionId}&userId=${userId}&taskId=${taskId}`, 'GET', undefined, undefined, {} as Annotation),
    save: (annotation: Omit<Annotation, 'timestamp'>) => 
      safeApiRequest<Annotation>('/annotations', 'POST', annotation, undefined, {} as Annotation),
    update: (annotation: Annotation) => 
      safeApiRequest<Annotation>(`/annotations/${annotation.discussionId}/${annotation.userId}/${annotation.taskId}`, 'PUT', annotation, undefined, {} as Annotation),
    upload: (file: File, discussionId: string) => {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('discussionId', discussionId);
      console.log(`[File Upload] Uploading file for discussion: ${discussionId}`, file.name, file.type, file.size);
      return safeApiRequest<{fileUrl: string}>('/files/upload', 'POST', formData, {
        'Content-Type': undefined as any
      }, { fileUrl: '' });
    },
    // Method for pod leads to override annotations
    podLeadOverride: (podLeadId: string, annotatorId: string, discussionId: string, taskId: number, data: Record<string, string | boolean>) => 
      safeApiRequest<Annotation>('/pod-lead/annotations/override', 'POST', {
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
      safeApiRequest<Annotation>(`/consensus?discussionId=${discussionId}&taskId=${taskId}`, 'GET', undefined, undefined, {} as Annotation),
    save: (consensus: Omit<Annotation, 'timestamp'>) => 
      safeApiRequest<Annotation>('/consensus', 'POST', consensus, undefined, {} as Annotation),
    calculate: (discussionId: string, taskId: number) => 
      safeApiRequest<{result: string, agreement: boolean}>(`/consensus/calculate?discussionId=${discussionId}&taskId=${taskId}`, 'GET', undefined, undefined, { result: '', agreement: false }),
    override: (discussionId: string, taskId: number, data: Record<string, string | boolean>) =>
      safeApiRequest<Annotation>('/consensus/override', 'POST', { discussionId, taskId, data }, undefined, {} as Annotation),
  },
  
  // Code download endpoint
  code: {
    getDownloadUrl: (discussionId: string, repo: string) => 
      safeApiRequest<{downloadUrl: string}>(`/code/download?discussionId=${discussionId}&repo=${repo}`, 'GET', undefined, undefined, { downloadUrl: '' })
  },
  
  // Authentication endpoints
  auth: {
    verifyGoogleToken: (token: string) => {
      // In a real app, this would send the token to your backend
      console.log('[Auth] Verifying Google token:', token.substring(0, 20) + '...');
      
      return safeApiRequest<{success: boolean, user: any}>('/auth/google', 'POST', { token }, undefined, { success: false, user: null });
    },
    
    // Get authorized users endpoint
    getAuthorizedUsers: () => {
      console.log('[Auth] Getting authorized users');
      // In production, always make the API call
      return safeApiRequest<{email: string, role: UserRole}[]>('/auth/authorized-users', 'GET', undefined, undefined, []);
    },
    
    // Add authorized user endpoint
    addAuthorizedUser: (email: string, role: UserRole) => {
      console.log('[Auth] Adding authorized user:', email, role);
      return safeApiRequest<{success: boolean}>('/auth/authorized-users', 'POST', { email, role }, undefined, { success: false });
    },
    
    // Remove authorized user endpoint
    removeAuthorizedUser: (email: string) => {
      console.log('[Auth] Removing authorized user:', email);
      return safeApiRequest<{success: boolean}>(`/auth/authorized-users/${encodeURIComponent(email)}`, 'DELETE', undefined, undefined, { success: false });
    }
  },
  
  // Admin endpoints
  admin: {
    // Upload GitHub discussions from JSON
    uploadDiscussions: (discussions: GitHubDiscussion[]) => {
      console.log('[Admin] Uploading discussions:', discussions.length);
      return safeApiRequest<UploadResult>('/admin/discussions/upload', 'POST', { discussions }, undefined, { 
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
      return safeApiRequest<TaskManagementResult>('/admin/tasks/status', 'PUT', { 
        discussionId,
        taskId, 
        status 
      }, undefined, {
        success: false,
        message: 'Failed to update task status'
      });
    },
    
    // Override annotation values
    overrideAnnotation: (annotation: Annotation) => {
      console.log('[Admin] Overriding annotation:', annotation.discussionId, annotation.taskId);
      return safeApiRequest<Annotation>('/admin/annotations/override', 'PUT', annotation, undefined, {} as Annotation);
    }
  }
};
