
// Main API service barrel file
// Re-exports all API modules for easier imports

// First, export types
export * from './types';

// Export mock data 
export * from './mockData';

// Export the API object from endpoints
export { api, fetchDiscussions } from './endpoints';

// Export helper functions
export { 
  apiRequest, 
  safeApiRequest, 
  handleResponse, 
  formatApiUrl, 
  safeToString,
  API_URL,
  API_KEY,
  USE_MOCK_DATA
} from './helpers';
