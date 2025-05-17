
import { apiRequest } from './helpers';
import { Discussion, Annotation, TaskStatus, GitHubDiscussion, UploadResult, TaskManagementResult } from './types';
import { mockDiscussions } from './mockData';

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

export const api = {
  // Discussion endpoints
  discussions: {
    getAll: () => apiRequest<Discussion[]>('/discussions').catch(() => []),
    getById: (id: string) => apiRequest<Discussion>(`/discussions/${id}`).catch(() => null),
    getByStatus: (status: TaskStatus) => 
      apiRequest<Discussion[]>(`/discussions?status=${status}`).catch(() => []),
  },

  // Annotation endpoints
  annotations: {
    getByDiscussionId: (discussionId: string) => 
      apiRequest<Annotation[]>(`/annotations?discussionId=${discussionId}`).catch(() => []),
    getByTaskAndDiscussion: (discussionId: string, taskId: number) => 
      apiRequest<Annotation[]>(`/annotations?discussionId=${discussionId}&taskId=${taskId}`).catch(() => []),
    getUserAnnotation: (discussionId: string, userId: string, taskId: number) => 
      apiRequest<Annotation>(`/annotations?discussionId=${discussionId}&userId=${userId}&taskId=${taskId}`)
        .catch(() => null),
    save: (annotation: Omit<Annotation, 'timestamp'>) => 
      apiRequest<Annotation>('/annotations', 'POST', annotation),
    update: (annotation: Annotation) => 
      apiRequest<Annotation>(`/annotations/${annotation.discussionId}/${annotation.userId}/${annotation.taskId}`, 'PUT', annotation),
    upload: (file: File, discussionId: string) => {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('discussionId', discussionId);
      return apiRequest<{fileUrl: string}>('/files/upload', 'POST', formData, {
        'Content-Type': undefined as any
      }).catch(() => ({ fileUrl: '' }));
    },
    // New method for pod leads to override annotations
    podLeadOverride: (podLeadId: string, annotatorId: string, discussionId: string, taskId: number, data: Record<string, string | boolean>) => 
      apiRequest<Annotation>('/pod-lead/annotations/override', 'POST', {
        discussion_id: discussionId,
        annotator_id: annotatorId,
        task_id: taskId,
        data,
        pod_lead_id: podLeadId
      }).catch(() => null),
  },

  // Consensus endpoints
  consensus: {
    get: (discussionId: string, taskId: number) => 
      apiRequest<Annotation>(`/consensus?discussionId=${discussionId}&taskId=${taskId}`).catch(() => null),
    save: (consensus: Omit<Annotation, 'timestamp'>) => 
      apiRequest<Annotation>('/consensus', 'POST', consensus).catch(() => null),
    calculate: (discussionId: string, taskId: number) => 
      apiRequest<{result: string, agreement: boolean}>(`/consensus/calculate?discussionId=${discussionId}&taskId=${taskId}`)
        .catch(() => ({ result: '', agreement: false })),
    override: (discussionId: string, taskId: number, data: Record<string, string | boolean>) =>
      apiRequest<Annotation>('/consensus/override', 'POST', { discussionId, taskId, data })
        .catch(() => null),
  },
  
  // Code download endpoint
  code: {
    getDownloadUrl: (discussionId: string, repo: string) => 
      apiRequest<{downloadUrl: string}>(`/code/download?discussionId=${discussionId}&repo=${repo}`)
        .catch(() => ({ downloadUrl: '' }))
  },
  
  // Authentication endpoints
  auth: {
    verifyGoogleToken: (token: string) => {
      // In a real app, this would send the token to your backend
      console.log('Verifying Google token:', token);
      
      // Return empty user object if verification fails
      return apiRequest<{success: boolean, user: any}>('/auth/google', 'POST', { token })
        .catch(() => ({ success: false, user: null }));
    },
    
    // New endpoint to get authorized users (in real app)
    getAuthorizedUsers: () => {
      // In production, always make the API call
      return apiRequest<{email: string, role: string}[]>('/auth/authorized-users')
        .catch(() => []);
    },
    
    // New endpoint to add authorized user (in real app)
    addAuthorizedUser: (email: string, role: string) => {
      return apiRequest<{success: boolean}>('/auth/authorized-users', 'POST', { email, role })
        .catch(() => ({ success: false }));
    },
    
    // New endpoint to remove authorized user (in real app)
    removeAuthorizedUser: (email: string) => {
      return apiRequest<{success: boolean}>(`/auth/authorized-users/${encodeURIComponent(email)}`, 'DELETE')
        .catch(() => ({ success: false }));
    }
  },
  
  // Admin endpoints
  admin: {
    // Upload GitHub discussions from JSON
    uploadDiscussions: (discussions: GitHubDiscussion[]) => {
      // Actual API call in production
      return apiRequest<UploadResult>('/admin/discussions/upload', 'POST', { discussions })
        .catch(() => ({ 
          success: false, 
          message: 'Failed to upload discussions', 
          discussionsAdded: 0,
          errors: ['API request failed'] 
        }));
    },
    
    // Update task status
    updateTaskStatus: (discussionId: string, taskId: number, status: TaskStatus): Promise<TaskManagementResult> => {
      // Actual API call in production
      return apiRequest<TaskManagementResult>('/admin/tasks/status', 'PUT', { discussionId, taskId, status })
        .catch(() => ({
          success: false,
          message: 'Failed to update task status'
        }));
    },
    
    // Override annotation values
    overrideAnnotation: (annotation: Annotation) => {
      // Actual API call in production
      return apiRequest<Annotation>('/admin/annotations/override', 'PUT', annotation)
        .catch(() => null);
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
