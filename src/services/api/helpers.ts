
import { toast } from 'sonner';
import { ApiError } from './types';
import { mockDiscussions, mockAnnotations } from './mockData';
import { API_CONFIG } from '@/config';

/**
 * API base configuration values
 */
export const API_URL = API_CONFIG.BASE_URL;
export const API_KEY = API_CONFIG.HEADERS['X-API-Key'];
export const USE_MOCK_DATA = API_CONFIG.USE_MOCK;

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
    console.error(`[API Error] Response not OK: ${response.status} ${response.statusText}`);
    
    let errorData;
    try {
      // Try to parse error as JSON
      errorData = await response.json();
      console.error('[API Error] Error response body:', errorData);
    } catch (e) {
      // If it's not JSON, get text content for debugging
      const textContent = await response.text();
      console.error('[API Error] Non-JSON error response:', textContent.substring(0, 500) + (textContent.length > 500 ? '...' : ''));
      errorData = { message: 'Server returned a non-JSON error' };
    }
    
    const error: ApiError = {
      message: errorData.message || errorData.detail || `Error ${response.status}: ${response.statusText}`,
      status: response.status
    };
    throw error;
  }
  
  // Check content type to ensure we're getting JSON
  const contentType = response.headers.get('content-type');
  console.log(`[API Response] Content-Type: ${contentType || 'not specified'}`);
  
  if (!contentType || !contentType.includes('application/json')) {
    try {
      // Try to get the first 500 chars of the response for debugging
      const textContent = await response.text();
      console.error('[API Error] Expected JSON but got:', contentType || 'no content type');
      console.error('[API Error] Response preview:', textContent.substring(0, 500) + (textContent.length > 500 ? '...' : ''));
      
      throw {
        message: `Invalid response format: Expected JSON but got ${contentType || 'unknown format'}`,
        status: response.status
      };
    } catch (error) {
      console.error('[API Error] Failed to read response body:', error);
      throw {
        message: 'Invalid response format: Expected JSON',
        status: response.status
      };
    }
  }
  
  try {
    const jsonResponse = await response.json();
    console.log(`[API Response] Successful JSON response for ${response.url}`);
    return jsonResponse as T;
  } catch (error) {
    console.error('[API Error] Failed to parse JSON response:', error);
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
  console.info(`[API Request] ${method} ${endpoint} - Mock data enabled: ${USE_MOCK_DATA}`);
  
  // Check if we should use mock data based on config
  if (USE_MOCK_DATA) {
    console.info(`[API Mock] Using mock data for: ${endpoint}`);
    return getMockData<T>(endpoint);
  }
  
  try {
    const requestHeaders = {
      ...API_CONFIG.HEADERS,
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
        console.log(`[API Request] Sending FormData with ${body.getAll('file').length} files`);
      } else if (method === 'POST' || method === 'PUT' || method === 'PATCH') {
        config.body = JSON.stringify(body);
        console.log(`[API Request] Request body:`, body);
      }
    }

    // Format the API URL properly
    const formattedUrl = formatApiUrl(endpoint);
    console.debug(`[API Request] Making actual API request to: ${formattedUrl}`);
    
    // Track request timing
    const startTime = performance.now();
    
    // Make the actual API call
    const response = await fetch(formattedUrl, config);
    
    const endTime = performance.now();
    console.log(`[API Timing] Request to ${endpoint} took ${(endTime - startTime).toFixed(2)}ms`);
    
    try {
      return await handleResponse<T>(response);
    } catch (apiError) {
      console.error('[API Error]:', apiError);
      
      // Only fall back to mock data if API call failed and we're in dev mode
      if (import.meta.env.DEV) {
        console.warn('[API Fallback] API call failed. Falling back to mock data for:', endpoint);
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
      console.warn('[API Fallback] Using mock data as fallback for:', endpoint);
      return getMockData<T>(endpoint);
    }
    
    throw error;
  }
};

// Helper function to get mock data based on endpoint
export function getMockData<T>(endpoint: string): T {
  console.log('[API Mock] Getting mock data for endpoint:', endpoint);
  
  // Parse the endpoint to determine what data to return
  if (endpoint.startsWith('/discussions')) {
    // Return all discussions or a specific one
    const idMatch = endpoint.match(/\/discussions\/(.+)/);
    if (idMatch) {
      const id = idMatch[1];
      console.log(`[API Mock] Looking for discussion with ID: ${id}`);
      const discussion = mockDiscussions.find(d => d.id === id);
      return discussion as unknown as T || ({} as unknown as T);
    }
    return mockDiscussions as unknown as T;
  }
  
  if (endpoint.startsWith('/annotations')) {
    // Parse query parameters
    const urlParams = new URLSearchParams(endpoint.split('?')[1]);
    const discussionId = urlParams.get('discussionId');
    const userId = urlParams.get('userId');
    const taskId = urlParams.get('taskId');
    
    console.log(`[API Mock] Looking for annotations with discussionId: ${discussionId}, userId: ${userId}, taskId: ${taskId}`);
    
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
  
  if (endpoint.startsWith('/admin/tasks/status')) {
    // Mock task status update
    return {
      success: true,
      message: 'Task status updated successfully',
      discussion: {
        id: 'mock-123',
        title: 'Mock Discussion',
        url: 'https://github.com/org/repo/discussions/1',
        repository: 'org/repo',
        createdAt: '2025-05-01T00:00:00Z',
        repositoryLanguage: 'TypeScript',
        releaseTag: 'v1.0.0',
        tasks: {
          task1: { status: 'unlocked', annotators: 0 },
          task2: { status: 'locked', annotators: 0 },
          task3: { status: 'locked', annotators: 0 }
        }
      }
    } as unknown as T;
  }
  
  if (endpoint.startsWith('/admin/discussions/upload')) {
    // Mock upload discussions
    return {
      success: true,
      message: 'Successfully uploaded 3 discussions',
      discussionsAdded: 3,
      errors: []
    } as unknown as T;
  }
  
  if (endpoint.startsWith('/auth/authorized-users')) {
    console.log('[API Mock] Returning mock authorized users');
    return [
      { email: 'admin@example.com', role: 'admin' },
      { email: 'lead@example.com', role: 'pod_lead' },
      { email: 'annotator1@example.com', role: 'annotator' }
    ] as unknown as T;
  }
  
  // Default empty response
  console.log('[API Mock] No specific mock data for endpoint, returning empty object');
  return {} as T;
}
