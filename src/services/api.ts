import { toast } from 'sonner';

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

// API base configuration
const API_URL = import.meta.env.VITE_API_URL || 'https://api-mock.example.com';

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

// API endpoint functions
export const api = {
  // Discussion endpoints
  discussions: {
    getAll: () => apiRequest<Discussion[]>('/discussions'),
    getById: (id: string) => apiRequest<Discussion>(`/discussions/${id}`),
    getByStatus: (status: 'locked' | 'unlocked' | 'completed') => 
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
  },

  // Consensus endpoints
  consensus: {
    get: (discussionId: string, taskId: number) => 
      apiRequest<Annotation>(`/consensus?discussionId=${discussionId}&taskId=${taskId}`),
    save: (consensus: Omit<Annotation, 'timestamp'>) => 
      apiRequest<Annotation>('/consensus', 'POST', consensus),
    calculate: (discussionId: string, taskId: number) => 
      apiRequest<{result: string, agreement: boolean}>(`/consensus/calculate?discussionId=${discussionId}&taskId=${taskId}`),
  }
};

// Mock API implementation for development when API_URL is not set
export const useMockApi = !import.meta.env.VITE_API_URL;

// Mock data - will be used when API_URL is not available
export const mockData = {
  discussions: [
    {
      id: '1',
      title: 'How to implement feature X?',
      url: 'https://github.com/org/repo/discussions/123',
      repository: 'org/repo',
      createdAt: '2025-05-01',
      tasks: {
        task1: { status: 'unlocked', annotators: 1 },
        task2: { status: 'locked', annotators: 0 },
        task3: { status: 'locked', annotators: 0 }
      }
    },
    {
      id: '2',
      title: 'Bug in module Y',
      url: 'https://github.com/org/repo/discussions/456',
      repository: 'org/repo',
      createdAt: '2025-05-05',
      tasks: {
        task1: { status: 'completed', annotators: 3 },
        task2: { status: 'unlocked', annotators: 1 },
        task3: { status: 'locked', annotators: 0 }
      }
    },
    {
      id: '3',
      title: 'Documentation update for Z',
      url: 'https://github.com/org/repo/discussions/789',
      repository: 'org/repo',
      createdAt: '2025-05-10',
      tasks: {
        task1: { status: 'completed', annotators: 3 },
        task2: { status: 'completed', annotators: 3 },
        task3: { status: 'unlocked', annotators: 2 }
      }
    },
    {
      id: '4',
      title: 'Processing logic in Sensors',
      url: 'https://github.com/apache/airflow/discussions/43579',
      repository: 'apache/airflow',
      createdAt: '2024-11-01',
      tasks: {
        task1: { status: 'completed', annotators: 3 },
        task2: { status: 'completed', annotators: 3 },
        task3: { status: 'unlocked', annotators: 3 }
      }
    }
  ],
  annotations: [
    // User 1 annotations
    {
      discussionId: '1',
      userId: '1',
      taskId: 1,
      data: { relevance: 'Yes', learning_value: 'Yes', clarity: 'No' },
      timestamp: new Date().toISOString()
    },
    {
      discussionId: '2',
      userId: '1',
      taskId: 1,
      data: { relevance: 'Yes', learning_value: 'Yes', clarity: 'Yes' },
      timestamp: new Date().toISOString()
    },
    {
      discussionId: '2',
      userId: '1',
      taskId: 2,
      data: { aspects: 'Yes', explanation: 'Yes', execution: 'N/A' },
      timestamp: new Date().toISOString()
    },
    
    // User 2 annotations
    {
      discussionId: '2',
      userId: '2',
      taskId: 1,
      data: { relevance: 'Yes', learning_value: 'Yes', clarity: 'Yes' },
      timestamp: new Date().toISOString()
    },
    {
      discussionId: '3',
      userId: '2',
      taskId: 1,
      data: { relevance: 'Yes', learning_value: 'Yes', clarity: 'Yes' },
      timestamp: new Date().toISOString()
    },
    {
      discussionId: '3',
      userId: '2',
      taskId: 2,
      data: { aspects: 'Yes', explanation: 'Yes', execution: 'Executable' },
      timestamp: new Date().toISOString()
    },
    
    // User 3 annotations
    {
      discussionId: '2',
      userId: '3',
      taskId: 1,
      data: { relevance: 'Yes', learning_value: 'No', clarity: 'Yes' },
      timestamp: new Date().toISOString()
    },
    {
      discussionId: '3',
      userId: '3',
      taskId: 1,
      data: { relevance: 'Yes', learning_value: 'Yes', clarity: 'Yes' },
      timestamp: new Date().toISOString()
    },
    {
      discussionId: '3',
      userId: '3',
      taskId: 2,
      data: { aspects: 'Yes', explanation: 'Yes', execution: 'Executable' },
      timestamp: new Date().toISOString()
    },
    {
      discussionId: '3',
      userId: '3',
      taskId: 3,
      data: { rewrite: 'Completed', classify: 'Search' },
      timestamp: new Date().toISOString()
    },
    {
      discussionId: '4',
      userId: '1',
      taskId: 1,
      data: { relevance: 'Yes', learning_value: 'Yes', clarity: 'Yes' },
      timestamp: new Date().toISOString()
    },
    {
      discussionId: '4',
      userId: '2',
      taskId: 1,
      data: { relevance: 'Yes', learning_value: 'Yes', clarity: 'Yes' },
      timestamp: new Date().toISOString()
    },
    {
      discussionId: '4',
      userId: '3',
      taskId: 1,
      data: { relevance: 'Yes', learning_value: 'Yes', clarity: 'Yes' },
      timestamp: new Date().toISOString()
    },
    {
      discussionId: '4',
      userId: '1',
      taskId: 2,
      data: { aspects: 'Yes', explanation: 'Yes', execution: 'Executable' },
      timestamp: new Date().toISOString()
    },
    {
      discussionId: '4',
      userId: '2',
      taskId: 2,
      data: { aspects: 'Yes', explanation: 'Yes', execution: 'Executable' },
      timestamp: new Date().toISOString()
    },
    {
      discussionId: '4',
      userId: '3',
      taskId: 2,
      data: { aspects: 'Yes', explanation: 'Yes', execution: 'Executable' },
      timestamp: new Date().toISOString()
    },
    {
      discussionId: '4',
      userId: '1',
      taskId: 3,
      data: { rewrite: 'Completed', classify: 'Reasoning' },
      timestamp: new Date().toISOString()
    },
    {
      discussionId: '4',
      userId: '2',
      taskId: 3,
      data: { rewrite: 'Completed', classify: 'Reasoning' },
      timestamp: new Date().toISOString()
    },
    {
      discussionId: '4',
      userId: '3',
      taskId: 3,
      data: { rewrite: 'Completed', classify: 'Reasoning' },
      timestamp: new Date().toISOString()
    }
  ],
  consensus: []
};

export type TaskStatus = 'locked' | 'unlocked' | 'completed';

export type TaskState = {
  status: TaskStatus;
  annotators: number;
  userAnnotated?: boolean;
};
