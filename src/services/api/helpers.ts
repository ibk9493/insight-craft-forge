
import { toast } from 'sonner';
import { ApiError } from './types';
import { mockDiscussions, mockAnnotations } from './mockData';
import { API_CONFIG } from '@/config';

/**
 * API base configuration values from environment variables
 */
export const API_URL = import.meta.env.VITE_API_URL || '';
export const API_KEY = import.meta.env.VITE_API_KEY || '';
export const USE_MOCK_DATA = import.meta.env.VITE_USE_MOCK_DATA === 'true';

/**
 * Properly formats the API URL to ensure it doesn't have duplicate slashes
 * @param endpoint - The API endpoint to format
 * @returns The properly formatted API URL
 */
export const formatApiUrl = (endpoint: string): string => {
  if (!API_URL) return endpoint; // If no API URL, just return the endpoint
  
  // Remove leading slash from endpoint if it exists
  const cleanEndpoint = endpoint.startsWith('/') ? endpoint.substring(1) : endpoint;
  
  // Ensure API_URL ends with a slash
  const baseUrl = API_URL.endsWith('/') ? API_URL : `${API_URL}/`;
  
  return `${baseUrl}${cleanEndpoint}`;
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
    let errorData;
    try {
      // Try to parse error as JSON
      errorData = await response.json();
    } catch (e) {
      // If it's not JSON, get text content for debugging
      const textContent = await response.text();
      console.error('Non-JSON error response:', textContent.substring(0, 500) + (textContent.length > 500 ? '...' : ''));
      errorData = { message: 'Server returned a non-JSON error' };
    }
    
    const error: ApiError = {
      message: errorData.message || `Error ${response.status}: ${response.statusText}`,
      status: response.status
    };
    throw error;
  }
  
  // Check content type to ensure we're getting JSON
  const contentType = response.headers.get('content-type');
  
  if (!contentType || !contentType.includes('application/json')) {
    try {
      // Try to get the first 500 chars of the response for debugging
      const textContent = await response.text();
      console.error('Expected JSON but got:', contentType || 'no content type');
      console.error('Response preview:', textContent.substring(0, 500) + (textContent.length > 500 ? '...' : ''));
      
      throw {
        message: `Invalid response format: Expected JSON but got ${contentType || 'unknown format'}`,
        status: response.status
      };
    } catch (error) {
      throw {
        message: 'Invalid response format: Expected JSON',
        status: response.status
      };
    }
  }
  
  try {
    return await response.json() as T;
  } catch (error) {
    console.error('Failed to parse JSON response:', error);
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
  try {
    // If mock data is enabled, use mock data directly
    if (USE_MOCK_DATA || import.meta.env.DEV) {
      console.info(`Using mock data for: ${endpoint}`);
      return getMockData<T>(endpoint);
    }
    
    const requestHeaders = {
      'Content-Type': 'application/json',
      'X-API-Key': API_KEY,
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
      } else if (method === 'POST' || method === 'PUT' || method === 'PATCH') {
        config.body = JSON.stringify(body);
      }
    }

    // Format the API URL properly
    const formattedUrl = formatApiUrl(endpoint);
    console.debug(`Making API request to: ${formattedUrl}`);
    
    // Try to make the actual API call
    try {
      const response = await fetch(formattedUrl, config);
      return await handleResponse<T>(response);
    } catch (apiError) {
      console.error('API Error:', apiError);
      
      // If we're using mock data or the API is unavailable, fall back to mock data
      if (USE_MOCK_DATA || import.meta.env.DEV) {
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
    
    // In development or if mock data is enabled, return mock data as a fallback
    if (USE_MOCK_DATA || import.meta.env.DEV) {
      console.warn('Using mock data as fallback for:', endpoint);
      return getMockData<T>(endpoint);
    }
    
    throw error;
  }
};

// Helper function to get mock data based on endpoint
export function getMockData<T>(endpoint: string): T {
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

// API fallback implementation in case of network issues or dev environment
export const createFallbackResponse = (entity: string, error: ApiError): never => {
  toast.error(`Failed to fetch ${entity}: ${error.message}`);
  console.error(`API Error: ${error.message}`);
  throw new Error(`API Error: Failed to fetch ${entity}`);
};
