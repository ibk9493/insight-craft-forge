
import { apiRequest } from './helpers';
import { Discussion, Annotation, TaskStatus } from './types';

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
 */

export const api = {
  // Discussion endpoints
  discussions: {
    getAll: () => apiRequest<Discussion[]>('/discussions'),
    getById: (id: string) => apiRequest<Discussion>(`/discussions/${id}`),
    getByStatus: (status: TaskStatus) => 
      apiRequest<Discussion[]>(`/discussions?status=${status}`),
  },

  // Annotation endpoints
  annotations: {
    getByDiscussionId: (discussionId: string) => 
      apiRequest<Annotation[]>(`/annotations?discussionId=${discussionId}`),
    getByTaskAndDiscussion: (discussionId: string, taskId: number) => 
      apiRequest<Annotation[]>(`/annotations?discussionId=${discussionId}&taskId=${taskId}`),
    getUserAnnotation: (discussionId: string, userId: string, taskId: number) => 
      apiRequest<Annotation>(`/annotations?discussionId=${discussionId}&userId=${userId}&taskId=${taskId}`),
    save: (annotation: Omit<Annotation, 'timestamp'>) => 
      apiRequest<Annotation>('/annotations', 'POST', annotation),
    upload: (file: File, discussionId: string) => {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('discussionId', discussionId);
      return apiRequest<{fileUrl: string}>('/files/upload', 'POST', formData, {
        // Don't set Content-Type for FormData, browser will set it correctly
        'Content-Type': undefined as any
      });
    }
  },

  // Consensus endpoints
  consensus: {
    get: (discussionId: string, taskId: number) => 
      apiRequest<Annotation>(`/consensus?discussionId=${discussionId}&taskId=${taskId}`),
    save: (consensus: Omit<Annotation, 'timestamp'>) => 
      apiRequest<Annotation>('/consensus', 'POST', consensus),
    calculate: (discussionId: string, taskId: number) => 
      apiRequest<{result: string, agreement: boolean}>(`/consensus/calculate?discussionId=${discussionId}&taskId=${taskId}`),
  },
  
  // Code download endpoint
  code: {
    getDownloadUrl: (discussionId: string, repo: string) => 
      apiRequest<{downloadUrl: string}>(`/code/download?discussionId=${discussionId}&repo=${repo}`)
  },
  
  // Authentication endpoints
  auth: {
    verifyGoogleToken: (token: string) => {
      // In a real app, this would send the token to your backend
      console.log('Verifying Google token:', token);
      
      // Simulate API response for development/testing
      if (import.meta.env.DEV) {
        console.log('DEV mode: Simulating Google authentication success');
        return Promise.resolve({
          success: true,
          user: {
            id: '5',
            username: 'google.user@example.com',
            role: 'annotator',
            provider: 'google'
          }
        });
      }
      
      // Actual API call in production
      return apiRequest<{success: boolean, user: any}>('/auth/google', 'POST', { token });
    }
  }
};
