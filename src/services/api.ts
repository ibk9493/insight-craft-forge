
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

// Helper function to handle API responses
const handleResponse = async <T>(response: Response): Promise<T> => {
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    const error: ApiError = {
      message: errorData.message || `Error ${response.status}: ${response.statusText}`,
      status: response.status
    };
    throw error;
  }
  return response.json() as Promise<T>;
};

// API request function with error handling
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

    const response = await fetch(`${API_URL}${endpoint}`, config);
    return await handleResponse<T>(response);
  } catch (error) {
    if ((error as ApiError).message) {
      toast.error((error as ApiError).message);
    } else {
      toast.error('An error occurred while connecting to the server');
    }
    throw error;
  }
};

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
  }
};

// API fallback implementation in case of network issues or dev environment
export const createFallbackResponse = (entity: string, error: ApiError): never => {
  toast.error(`Failed to fetch ${entity}: ${error.message}`);
  console.error(`API Error: ${error.message}`);
  throw new Error(`API Error: Failed to fetch ${entity}`);
};
