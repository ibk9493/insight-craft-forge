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
    update: (annotation: Annotation) => 
      apiRequest<Annotation>(`/annotations/${annotation.discussionId}/${annotation.userId}/${annotation.taskId}`, 'PUT', annotation),
    upload: (file: File, discussionId: string) => {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('discussionId', discussionId);
      return apiRequest<{fileUrl: string}>('/files/upload', 'POST', formData, {
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
    override: (discussionId: string, taskId: number, data: Record<string, string | boolean>) =>
      apiRequest<Annotation>('/consensus/override', 'POST', { discussionId, taskId, data }),
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
  },
  
  // Admin endpoints
  admin: {
    // Upload GitHub discussions from JSON
    uploadDiscussions: (discussions: GitHubDiscussion[]) => {
      console.log('Processing discussions:', discussions);

      // Simulate API call in development
      if (import.meta.env.DEV) {
        // Process the discussions and add to mock data
        try {
          const processedDiscussions = discussions.map(disc => {
            const repository = disc.repository || extractRepositoryFromUrl(disc.url);
            return {
              ...disc,
              repository,
              tasks: {
                task1: disc.tasks?.task1 || { status: 'locked', annotators: 0 },
                task2: disc.tasks?.task2 || { status: 'locked', annotators: 0 },
                task3: disc.tasks?.task3 || { status: 'locked', annotators: 0 }
              }
            } as Discussion;
          });
          
          // In a real app, this would be saved to the database
          // For this mock, we're just logging
          console.log('Processed discussions:', processedDiscussions);
          
          // Add to mock data
          mockDiscussions.push(...processedDiscussions);
          
          return Promise.resolve({
            success: true,
            message: `Successfully uploaded ${processedDiscussions.length} discussions`,
            discussionsAdded: processedDiscussions.length
          });
        } catch (error) {
          console.error('Error processing discussions:', error);
          return Promise.resolve({
            success: false,
            message: 'Error processing discussions',
            discussionsAdded: 0,
            errors: [(error as Error).message]
          });
        }
      }
      
      // Actual API call in production
      return apiRequest<UploadResult>('/admin/discussions/upload', 'POST', { discussions });
    },
    
    // Update task status
    updateTaskStatus: (discussionId: string, taskId: number, status: TaskStatus): Promise<TaskManagementResult> => {
      console.log(`Updating task ${taskId} of discussion ${discussionId} to ${status}`);
      
      // Simulate API call in development
      if (import.meta.env.DEV) {
        const discussionIndex = mockDiscussions.findIndex(d => d.id === discussionId);
        if (discussionIndex === -1) {
          return Promise.resolve({
            success: false,
            message: 'Discussion not found'
          });
        }
        
        // Update the task status
        const taskKey = `task${taskId}` as keyof typeof mockDiscussions[0]['tasks'];
        mockDiscussions[discussionIndex].tasks[taskKey].status = status;
        
        return Promise.resolve({
          success: true,
          message: `Task ${taskId} status updated to ${status}`,
          discussion: mockDiscussions[discussionIndex]
        });
      }
      
      // Actual API call in production
      return apiRequest<TaskManagementResult>('/admin/tasks/status', 'PUT', { discussionId, taskId, status });
    },
    
    // Override annotation values
    overrideAnnotation: (annotation: Annotation) => {
      console.log('Overriding annotation:', annotation);
      
      // Actual API call in production
      return apiRequest<Annotation>('/admin/annotations/override', 'PUT', annotation);
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
