
// Configuration variables for the application

// API configuration
export const API_CONFIG = {
  // Base URL for the API - ensure it ends with '/api'
  BASE_URL: import.meta.env.VITE_API_URL || 'http://localhost:8000/api',
  
  // Whether to use mock data - Default to false to ensure API calls
  USE_MOCK: import.meta.env.VITE_USE_MOCK_DATA === 'true',
  
  // API endpoints
  ENDPOINTS: {
    DISCUSSIONS: '/discussions',
    ANNOTATIONS: '/annotations',
    CONSENSUS: '/consensus'
  },
  
  // API version
  VERSION: 'v1',
  
  // Default request headers
  HEADERS: {
    'Content-Type': 'application/json',
    'X-API-Key': import.meta.env.VITE_API_KEY || 'development_api_key'
  }
};

// Authentication configuration
export const AUTH_CONFIG = {
  // Session timeout in minutes
  SESSION_TIMEOUT: 60,
  
  // Local storage keys
  STORAGE_KEYS: {
    TOKEN: 'swe_qa_token',
    USER: 'swe_qa_user',
    AUTHORIZED_USERS: 'authorizedUsers'
  },
  
  // Google OAuth client ID
  GOOGLE_CLIENT_ID: import.meta.env.VITE_GOOGLE_CLIENT_ID || ''
};

// Task configuration
export const TASK_CONFIG = {
  // Required number of annotators for each task
  REQUIRED_ANNOTATORS: {
    TASK1: 3,
    TASK2: 3,
    TASK3: 5
  }
};

// Feature flags
export const FEATURES = {
  // Enable experimental features
  EXPERIMENTAL: import.meta.env.VITE_ENABLE_EXPERIMENTAL === 'true',
  
  // Enable detailed error reporting
  DETAILED_ERRORS: import.meta.env.VITE_DETAILED_ERRORS === 'true' || import.meta.env.DEV,
  
  // Enable real-time collaboration
  REALTIME: import.meta.env.VITE_ENABLE_REALTIME === 'true'
};
