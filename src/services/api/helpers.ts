import { toast } from 'sonner';
import { ApiError } from './types';
import { mockDiscussions, mockAnnotations } from './mockData';
import { API_CONFIG } from '@/config';

/**
 * API base configuration values
 */
export const API_URL = API_CONFIG.BASE_URL;
export const API_KEY = API_CONFIG.HEADERS['X-API-Key'];
export const USE_MOCK_DATA = false; // Set this to false to disable mock data

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
      
      // Don't fall back to mock data anymore
      throw apiError;
    }
  } catch (error) {
    if ((error as ApiError).message) {
      toast.error((error as ApiError).message);
    } else {
      toast.error('An error occurred while connecting to the server');
    }
    
    // Don't fall back to mock data in development anymore
    throw error;
  }
};

// Helper function to get mock data based on endpoint - keeping this for reference but not using it anymore
export function getMockData<T>(endpoint: string): T {
  console.log('[API Mock] Getting mock data for endpoint:', endpoint);
  
  // Return empty results by default
  console.log('[API Mock] No specific mock data for endpoint, returning empty fallback');
  
  // Try to infer the appropriate default value based on usage patterns and endpoint name
  if (endpoint.includes('list') || endpoint.endsWith('s') || 
      endpoint.includes('all') || endpoint.includes('get')) {
    // For endpoints likely returning lists
    return ([] as unknown) as T;
  } else {
    // For endpoints likely returning objects
    return ({} as unknown) as T;
  }
}
