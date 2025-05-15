
// Configuration variables for the application

// API configuration
export const API_CONFIG = {
  // Base URL for the API
  BASE_URL: import.meta.env.VITE_API_URL || 'https://api-mock.example.com',
  
  // Whether to use mock data (true if VITE_API_URL is not set)
  USE_MOCK: !import.meta.env.VITE_API_URL,
  
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
    'Content-Type': 'application/json'
  }
};

// Authentication configuration
export const AUTH_CONFIG = {
  // Session timeout in minutes
  SESSION_TIMEOUT: 60,
  
  // Local storage keys
  STORAGE_KEYS: {
    TOKEN: 'swe_qa_token',
    USER: 'swe_qa_user'
  }
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
  DETAILED_ERRORS: import.meta.env.VITE_DETAILED_ERRORS === 'true',
  
  // Enable real-time collaboration
  REALTIME: import.meta.env.VITE_ENABLE_REALTIME === 'true'
};
