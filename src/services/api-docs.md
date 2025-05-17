
# Frontend API Integration Documentation

This document outlines how the frontend integrates with the FastAPI backend for the SWE-QA annotation system.

## Configuration

API configurations are stored in `src/config.ts` and can be customized via environment variables:

```typescript
// .env file
VITE_API_URL=http://localhost:8000/api
VITE_API_KEY=your_api_key_here
VITE_USE_MOCK_DATA=true|false
```

## API Services

The frontend uses a modular approach to API services:

### Core API Functions

- `api.discussions`: Methods for fetching and managing GitHub discussions
- `api.annotations`: Methods for creating and retrieving annotations
- `api.consensus`: Methods for calculating and managing consensus annotations
- `api.auth`: Methods for authentication and user management
- `api.admin`: Admin-specific methods for managing discussions and tasks

### Error Handling

- All API requests include error handling with fallback to mock data when appropriate
- Toast notifications inform users of API success/failure

### Mock Data

- When `VITE_USE_MOCK_DATA=true`, the application uses mock data instead of real API calls
- This allows for easier development and testing without a backend

## Usage Examples

### Fetching Discussions

```typescript
import { api } from '@/services/api';

// Get all discussions
const discussions = await api.discussions.getAll();

// Get a specific discussion
const discussion = await api.discussions.getById('github-123');
```

### Working with Annotations

```typescript
import { api } from '@/services/api';

// Get user's annotation
const annotation = await api.annotations.getUserAnnotation('github-123', 'user1', 1);

// Save an annotation
await api.annotations.save({
  userId: 'user1',
  discussionId: 'github-123',
  taskId: 1,
  data: { relevance: true }
});

// For pod leads: Override an annotator's annotation
await api.annotations.podLeadOverride(
  'podlead1',    // Pod lead's user ID
  'annotator2',  // Annotator's user ID
  'github-123',  // Discussion ID
  1,             // Task ID
  { relevance: true }  // New annotation data
);
```

### Managing Consensus

```typescript
import { api } from '@/services/api';

// Calculate consensus
await api.consensus.calculate('github-123', 1);

// Save consensus
await api.consensus.save({
  userId: 'consensus',
  discussionId: 'github-123',
  taskId: 1,
  data: { relevance: true }
});
```

## Troubleshooting API Integration

### Common Issues

1. **Receiving HTML instead of JSON**: If your API calls return HTML content instead of JSON:
   - Check that the API server is running correctly
   - Verify your API URL in `.env` (should end with `/api` for the FastAPI server)
   - Ensure CORS is configured properly on the server
   - Try using `VITE_USE_MOCK_DATA=true` for development

2. **Authentication Issues**:
   - Verify that API keys are correctly set in your environment
   - Check that cookies are being properly sent for authenticated requests

3. **Fallback Mechanism**:
   - The application automatically falls back to mock data when `USE_MOCK_DATA=true` or in development mode
   - Check browser console for API errors and fallback messages

## Best Practices

1. **Error Handling**: Always handle potential API errors in UI components
2. **Loading States**: Implement loading indicators during API calls
3. **Caching**: Consider caching responses for frequently accessed data
4. **Type Safety**: Utilize TypeScript interfaces for API responses

## Role-Based Features

### For Annotators
- Create and update their own annotations
- View discussions assigned to them

### For Pod Leads
- All annotator capabilities
- Create/update consensus annotations
- Override individual annotator submissions when necessary
- View annotator submissions

### For Admins
- All pod lead capabilities
- Upload discussions
- Manage tasks (lock/unlock)
- Manage user access
