import { toast } from 'sonner';
import { TASK_CONFIG } from '@/config';

/**
 * API Service for SWE-QA Annotation System
 * 
 * This file implements the API layer for the annotation system, making calls to our backend.
 * 
 * API Documentation:
 * - Discussions API: CRUD operations for GitHub discussions
 * - Annotations API: Create, read, update annotations made by users
 * - Consensus API: Calculate and save consensus annotations
 * - Files API: Upload and retrieve files (screenshots, etc.)
 * - Code API: Download repository code for annotation tasks
 */

// Types for API responses
export interface Discussion {
  id: string;
  title: string;
  url: string;
  repository: string;
  createdAt: string;
  tasks: {
    task1: TaskState;
    task2: TaskState;
    task3: TaskState;
  };
}

export interface Annotation {
  discussionId: string;
  userId: string;
  taskId: number;
  data: Record<string, string | boolean>;
  timestamp: string;
}

export interface ApiError {
  message: string;
  status?: number;
}

// Update TaskStatus type to be a union of literal strings
export type TaskStatus = 'locked' | 'unlocked' | 'completed';

// Update TaskState interface to include all the properties we're using
export interface TaskState {
  status: TaskStatus;
  annotators: number;
  userAnnotated?: boolean;
}

// API base configuration
const API_URL = import.meta.env.VITE_API_URL || '';

// Mock data for development/testing when API is unavailable
// This is a fallback mechanism when the API is not available
const mockDiscussions: Discussion[] = [
  {
    id: 'github-123',
    title: 'How to implement custom hooks in React',
    url: 'https://github.com/facebook/react/discussions/123',
    repository: 'facebook/react',
    createdAt: '2025-04-15',
    tasks: {
      task1: { status: 'completed', annotators: 3 },
      task2: { status: 'unlocked', annotators: 1 },
      task3: { status: 'locked', annotators: 0 }
    }
  },
  {
    id: 'github-456',
    title: 'Best practices for state management',
    url: 'https://github.com/reduxjs/redux/discussions/456',
    repository: 'reduxjs/redux',
    createdAt: '2025-04-10',
    tasks: {
      task1: { status: 'unlocked', annotators: 2 },
      task2: { status: 'locked', annotators: 0 },
      task3: { status: 'locked', annotators: 0 }
    }
  },
  {
    id: 'github-789',
    title: 'Optimizing TypeScript compilation',
    url: 'https://github.com/microsoft/typescript/discussions/789',
    repository: 'microsoft/typescript',
    createdAt: '2025-04-05',
    tasks: {
      task1: { status: 'completed', annotators: 3 },
      task2: { status: 'completed', annotators: 3 },
      task3: { status: 'unlocked', annotators: 2 }
    }
  }
];

const mockAnnotations: Annotation[] = [
  {
    discussionId: 'github-123',
    userId: 'user1',
    taskId: 1,
    data: { relevance: true, learning_value: true, clarity: true },
    timestamp: '2025-04-15T10:30:00Z'
  },
  {
    discussionId: 'github-123',
    userId: 'user2',
    taskId: 1,
    data: { relevance: true, learning_value: false, clarity: true },
    timestamp: '2025-04-16T14:20:00Z'
  }
];

// Helper function to handle API responses
const handleResponse = async <T>(response: Response): Promise<T> => {
  // Check if response is OK
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    const error: ApiError = {
      message: errorData.message || `Error ${response.status}: ${response.statusText}`,
      status: response.status
    };
    throw error;
  }
  
  // Check content type to ensure we're getting JSON
  const contentType = response.headers.get('content-type');
  if (!contentType || !contentType.includes('application/json')) {
    throw {
      message: 'Invalid response format: Expected JSON',
      status: response.status
    };
  }
  
  return response.json() as Promise<T>;
};

// API request function with error handling and fallback to mock data
const apiRequest = async <T>(
  endpoint: string,
  method: string = 'GET',
  body?: unknown,
  headers?: Record<string, string>
): Promise<T> => {
  try {
    const requestHeaders = {
      'Content-Type': 'application/json',
      ...(headers || {})
    };

    const config: RequestInit = {
      method,
      headers: requestHeaders,
      credentials: 'include',
    };

    if (body && (method === 'POST' || method === 'PUT' || method === 'PATCH')) {
      config.body = JSON.stringify(body);
    }

    // Try to make the actual API call
    try {
      const response = await fetch(`${API_URL}${endpoint}`, config);
      return await handleResponse<T>(response);
    } catch (apiError) {
      console.error('API Error:', apiError);
      
      // If we're in development mode or the API is unavailable, fall back to mock data
      if (import.meta.env.DEV) {
        console.warn('Falling back to mock data for:', endpoint);
        return getMockData<T>(endpoint);
      }
      
      throw apiError;
    }
  } catch (error) {
    if ((error as ApiError).message) {
      toast.error((error as ApiError).message);
    } else {
      toast.error('An error occurred while connecting to the server');
    }
    
    // In development, return mock data as a fallback
    if (import.meta.env.DEV) {
      console.warn('Using mock data as fallback for:', endpoint);
      return getMockData<T>(endpoint);
    }
    
    throw error;
  }
};

// Helper function to get mock data based on endpoint
function getMockData<T>(endpoint: string): T {
  // Parse the endpoint to determine what data to return
  if (endpoint.startsWith('/discussions')) {
    // Return all discussions or a specific one
    const idMatch = endpoint.match(/\/discussions\/(.+)/);
    if (idMatch) {
      const id = idMatch[1];
      const discussion = mockDiscussions.find(d => d.id === id);
      return discussion as unknown as T;
    }
    return mockDiscussions as unknown as T;
  }
  
  if (endpoint.startsWith('/annotations')) {
    // Parse query parameters
    const urlParams = new URLSearchParams(endpoint.split('?')[1]);
    const discussionId = urlParams.get('discussionId');
    const userId = urlParams.get('userId');
    const taskId = urlParams.get('taskId');
    
    let filtered = [...mockAnnotations];
    
    if (discussionId) {
      filtered = filtered.filter(a => a.discussionId === discussionId);
    }
    
    if (userId) {
      filtered = filtered.filter(a => a.userId === userId);
    }
    
    if (taskId) {
      filtered = filtered.filter(a => a.taskId === Number(taskId));
    }
    
    // If specific user and task, return a single annotation
    if (userId && taskId && discussionId && filtered.length > 0) {
      return filtered[0] as unknown as T;
    }
    
    return filtered as unknown as T;
  }
  
  if (endpoint.startsWith('/consensus')) {
    // Mock consensus calculation
    if (endpoint.includes('calculate')) {
      return {
        result: 'Agreement',
        agreement: true
      } as unknown as T;
    }
    
    // Mock get consensus
    return {
      discussionId: 'github-123',
      userId: 'consensus',
      taskId: 1,
      data: { relevance: true, learning_value: true, clarity: true },
      timestamp: '2025-04-20T12:00:00Z'
    } as unknown as T;
  }
  
  // Default empty response
  return {} as T;
}

/**
 * API Documentation:
 * 
 * Discussions Endpoints:
 * - GET /discussions - Get all discussions
 * - GET /discussions/:id - Get a specific discussion by ID
 * - GET /discussions?status=:status - Get discussions by status
 * 
 * Annotations Endpoints:
 * - GET /annotations?discussionId=:id - Get all annotations for a discussion
 * - GET /annotations?discussionId=:id&taskId=:taskId - Get annotations for a specific task of a discussion
 * - GET /annotations?discussionId=:id&userId=:userId&taskId=:taskId - Get a specific annotation
 * - POST /annotations - Save an annotation
 * 
 * Files Endpoints:
 * - POST /files/upload - Upload a file with discussionId
 * 
 * Consensus Endpoints:
 * - GET /consensus?discussionId=:id&taskId=:taskId - Get consensus for a specific task
 * - POST /consensus - Save a consensus annotation
 * - GET /consensus/calculate?discussionId=:id&taskId=:taskId - Calculate consensus based on existing annotations
 * 
 * Code Endpoints:
 * - GET /code/download?discussionId=:id&repo=:repo - Get code download URL
 */

// API endpoint functions
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

// API fallback implementation in case of network issues or dev environment
export const createFallbackResponse = (entity: string, error: ApiError): never => {
  toast.error(`Failed to fetch ${entity}: ${error.message}`);
  console.error(`API Error: ${error.message}`);
  throw new Error(`API Error: Failed to fetch ${entity}`);
};
