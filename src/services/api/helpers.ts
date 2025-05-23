
import { toast } from '@/components/ui/sonner';
import { ApiError } from './types';
import { API_CONFIG, AUTH_CONFIG } from '@/config';


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
  
  // Remove leading slash from endpoint if it exists and API_URL ends with a slash
  const cleanEndpoint = API_URL.endsWith('/') && endpoint.startsWith('/') 
    ? endpoint.substring(1) 
    : endpoint;
  
  // Ensure proper joining of URL parts
  const baseUrl = API_URL.endsWith('/') ? API_URL : `${API_URL}/`;
  const formattedEndpoint = cleanEndpoint.startsWith('/') ? cleanEndpoint.substring(1) : cleanEndpoint;
  
  return `${baseUrl.replace(/\/+$/, '')}/${formattedEndpoint}`;
};

/**
 * Safely converts any value to a string suitable for display
 * @param value - Any value to convert to a string
 * @returns A string representation of the value
 */
export const safeToString = (value: unknown): string => {
  if (value === null) return 'null';
  if (value === undefined) return 'undefined';
  
  if (typeof value === 'object') {
    try {
      return JSON.stringify(value);
    } catch (e) {
      return '[Object]';
    }
  }
  
  return String(value);
};

/**
 * Gets the authentication token from localStorage
 */
export const getAuthToken = (): string | null => {
  try {
    const userJson = localStorage.getItem(AUTH_CONFIG.STORAGE_KEYS.USER);
    if (!userJson) return null;
    
    const user = JSON.parse(userJson);
    return user.token || null;
  } catch (error) {
    console.error('Error retrieving auth token:', error);
    return null;
  }
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
    
    // Handle authentication errors specifically
    if (response.status === 401) {
      // Clear user data and redirect to login
      localStorage.removeItem(AUTH_CONFIG.STORAGE_KEYS.USER);
      
      // Don't redirect if we're already at the login page
      if (!window.location.pathname.includes('/login')) {
        toast.error('Your session has expired. Please login again.');
        window.location.href = '/';
      }
    }
    
    let errorData;
    try {
      // Try to parse error as JSON
      errorData = await response.json();
      console.error('[API Error] Error response body:', errorData);
      
      // If the error contains details in a structured format, format it for better display
      if (errorData.detail && Array.isArray(errorData.detail)) {
        const formattedErrors = errorData.detail.map((err: any) => {
          if (err.msg && err.loc) {
            return `${err.msg} at ${err.loc.join('.')}`;
          }
          return safeToString(err);
        });
        
        errorData.message = formattedErrors.join('; ');
      }
      
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
  console.info(`[API Request] ${method} ${endpoint}`);
  
  try {
    const requestHeaders: Record<string, string> = {
      ...API_CONFIG.HEADERS,
      ...(headers || {})
    };

    // Add Authorization header with JWT token if available
    const token = getAuthToken();
    if (token) {
      requestHeaders['Authorization'] = `Bearer ${token}`;
      console.debug('[API Request] Including JWT token in request');
    } else {
      console.debug('[API Request] No JWT token available');
    }

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
    
    return await handleResponse<T>(response);
  } catch (error) {
    if ((error as ApiError).message) {
      toast.error(safeToString((error as ApiError).message));
    } else {
      toast.error('An error occurred while connecting to the server');
    }
    
    throw error;
  }
};

/**
 * Makes API requests with error handling and provides a fallback value on failure
 * 
 * @param endpoint - API endpoint path (without base URL)
 * @param method - HTTP method (GET, POST, PUT, DELETE)
 * @param body - Request body for POST/PUT requests
 * @param headers - Additional headers to include
 * @param fallbackValue - Value to return if the request fails
 * @returns The API response data or fallbackValue if the request fails
 */
export const safeApiRequest = async <T>(
  endpoint: string,
  method: string = 'GET',
  body?: unknown,
  headers?: Record<string, string>,
  fallbackValue: T = {} as T
): Promise<T> => {
  try {
    const response = await apiRequest<T>(endpoint, method, body, headers);
    console.log(`[API] ${method} ${endpoint} successful`);
    return response;
  } catch (error) {
    console.error(`[API Error] ${method} ${endpoint} - Failed: `, error);
    return fallbackValue;
  }
};

// Helper function to check if a user is authenticated
export const isAuthenticated = (): boolean => {
  return getAuthToken() !== null;
};

// Helper function to check if current user has a specific role
export const hasRole = (role: string): boolean => {
  try {
    const userJson = localStorage.getItem(AUTH_CONFIG.STORAGE_KEYS.USER);
    if (!userJson) return false;
    
    const user = JSON.parse(userJson);
    return user.role === role;
  } catch (error) {
    console.error('Error checking user role:', error);
    return false;
  }
};