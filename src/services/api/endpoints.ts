
import { apiRequest } from './helpers';
import { Discussion, Annotation, TaskStatus, GitHubDiscussion, UploadResult, TaskManagementResult } from './types';

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
  fallback: T
): Promise<T> => {
  try {
    const response = await apiRequest<T>(url, method, data, headers);
    return response;
  } catch (error) {
    console.error(`API request failed: ${url}`, error);
    return fallback;
  }
};

export const api = {
  // Discussion endpoints
  discussions: {
    getAll: () => safeApiRequest<Discussion[]>('/discussions', 'GET', undefined, undefined, []),
    getById: (id: string) => safeApiRequest<Discussion>(`/discussions/${id}`, 'GET', undefined, undefined, null),
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
      safeApiRequest<Annotation>(`/annotations?discussionId=${discussionId}&userId=${userId}&taskId=${taskId}`, 'GET', undefined, undefined, null),
    save: (annotation: Omit<Annotation, 'timestamp'>) => 
      safeApiRequest<Annotation>('/annotations', 'POST', annotation, undefined, null),
    update: (annotation: Annotation) => 
      safeApiRequest<Annotation>(`/annotations/${annotation.discussionId}/${annotation.userId}/${annotation.taskId}`, 'PUT', annotation, undefined, null),
    upload: (file: File, discussionId: string) => {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('discussionId', discussionId);
      return safeApiRequest<{fileUrl: string}>('/files/upload', 'POST', formData, {
        'Content-Type': undefined as any
      }, { fileUrl: '' });
    },
    // Method for pod leads to override annotations
    podLeadOverride: (podLeadId: string, annotatorId: string, discussionId: string, taskId: number, data: Record<string, string | boolean>) => 
      safeApiRequest<Annotation>('/pod-lead/annotations/override', 'POST', {
        discussion_id: discussionId,
        annotator_id: annotatorId,
        task_id: taskId,
        data,
        pod_lead_id: podLeadId
      }, undefined, null),
  },

  // Consensus endpoints
  consensus: {
    get: (discussionId: string, taskId: number) => 
      safeApiRequest<Annotation>(`/consensus?discussionId=${discussionId}&taskId=${taskId}`, 'GET', undefined, undefined, null),
    save: (consensus: Omit<Annotation, 'timestamp'>) => 
      safeApiRequest<Annotation>('/consensus', 'POST', consensus, undefined, null),
    calculate: (discussionId: string, taskId: number) => 
      safeApiRequest<{result: string, agreement: boolean}>(`/consensus/calculate?discussionId=${discussionId}&taskId=${taskId}`, 'GET', undefined, undefined, { result: '', agreement: false }),
    override: (discussionId: string, taskId: number, data: Record<string, string | boolean>) =>
      safeApiRequest<Annotation>('/consensus/override', 'POST', { discussionId, taskId, data }, undefined, null),
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
      console.log('Verifying Google token:', token);
      
      return safeApiRequest<{success: boolean, user: any}>('/auth/google', 'POST', { token }, undefined, { success: false, user: null });
    },
    
    // New endpoint to get authorized users (in real app)
    getAuthorizedUsers: () => {
      // In production, always make the API call
      return safeApiRequest<{email: string, role: UserRole}[]>('/auth/authorized-users', 'GET', undefined, undefined, []);
    },
    
    // New endpoint to add authorized user (in real app)
    addAuthorizedUser: (email: string, role: UserRole) => {
      return safeApiRequest<{success: boolean}>('/auth/authorized-users', 'POST', { email, role }, undefined, { success: false });
    },
    
    // New endpoint to remove authorized user (in real app)
    removeAuthorizedUser: (email: string) => {
      return safeApiRequest<{success: boolean}>(`/auth/authorized-users/${encodeURIComponent(email)}`, 'DELETE', undefined, undefined, { success: false });
    }
  },
  
  // Admin endpoints
  admin: {
    // Upload GitHub discussions from JSON
    uploadDiscussions: (discussions: GitHubDiscussion[]) => {
      return safeApiRequest<UploadResult>('/admin/discussions/upload', 'POST', { discussions }, undefined, { 
        success: false, 
        message: 'Failed to upload discussions', 
        discussionsAdded: 0,
        errors: ['API request failed'] 
      });
    },
    
    // Update task status
    updateTaskStatus: (discussionId: string, taskId: number, status: TaskStatus): Promise<TaskManagementResult> => {
      return safeApiRequest<TaskManagementResult>('/admin/tasks/status', 'PUT', { discussionId, taskId, status }, undefined, {
        success: false,
        message: 'Failed to update task status'
      });
    },
    
    // Override annotation values
    overrideAnnotation: (annotation: Annotation) => {
      return safeApiRequest<Annotation>('/admin/annotations/override', 'PUT', annotation, undefined, null);
    }
  }
};

// Utility function to extract repository name from GitHub URL
function extractRepositoryFromUrl(url: string): string {
  try {
    const githubUrlPattern = /github\.com\/([^\/]+\/[^\/]+)/i;
    const match = url.match(githubUrlPattern);
    return match ? match[1] : 'unknown/repository';
  } catch (error) {
    console.error('Error extracting repository from URL:', error);
    return 'unknown/repository';
  }
}
