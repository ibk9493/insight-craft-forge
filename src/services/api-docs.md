
# API Documentation for SWE-QA Annotation System

## Overview

The SWE-QA Annotation System API provides endpoints for managing GitHub discussions, user annotations, and consensus building. This document outlines the available endpoints, expected request/response formats, and common troubleshooting tips.

## Base URL

All API requests should be made to the base URL followed by the specific endpoint:

```
{VITE_API_URL}/{endpoint}
```

For example, if your API URL is `http://localhost:8000/api`, then you would make a request to `http://localhost:8000/api/discussions` to get all discussions.

## Authentication

All API requests require an API key to be provided in the request header:

```
X-API-Key: your_api_key_here
```

## Available Endpoints

### Discussions

- `GET /discussions`: Get all discussions
- `GET /discussions/{id}`: Get a specific discussion by ID
- `GET /discussions?status={status}`: Get discussions by status (locked, unlocked, completed)

### Annotations

- `GET /annotations?discussionId={id}`: Get all annotations for a discussion
- `GET /annotations?discussionId={id}&taskId={taskId}`: Get annotations for a discussion and task
- `GET /annotations?discussionId={id}&userId={userId}&taskId={taskId}`: Get a specific user's annotation
- `POST /annotations`: Save a new annotation
- `PUT /annotations/{discussionId}/{userId}/{taskId}`: Update an existing annotation

### Consensus

- `GET /consensus?discussionId={id}&taskId={taskId}`: Get consensus annotation for a discussion/task
- `POST /consensus`: Save a new consensus annotation
- `GET /consensus/calculate?discussionId={id}&taskId={taskId}`: Calculate consensus for a discussion/task
- `POST /consensus/override`: Override consensus values

## Mock Data

In development mode or when `VITE_USE_MOCK_DATA` is set to `true`, the system will use mock data instead of making actual API calls. This is useful for development and testing when the API server is not available.

## Troubleshooting

### Common Issues

1. **API URL Configuration**
   - Ensure your `VITE_API_URL` in the `.env` file ends with `/api`
   - The correct format is: `http://localhost:8000/api` (not `http://localhost:8000`)

2. **Receiving HTML Responses Instead of JSON**
   - This usually happens when your API URL is pointing to a frontend server instead of an API server
   - Check that your FastAPI server is running and accessible at the specified URL
   - Verify that the endpoint exists and returns JSON responses

3. **API Key Issues**
   - Ensure your API key in the `.env` file matches the one expected by the server
   - Check that the API key is being included in request headers

4. **Server Not Running**
   - Start your FastAPI server using `uvicorn main:app --reload` from the api-server-fastapi directory
   - Check that the server is listening on the correct port (default: 8000)

5. **Mock Data**
   - If you're having issues with the API, you can enable mock data by setting `VITE_USE_MOCK_DATA=true` in your `.env` file
   - This will allow you to develop the frontend without needing the API server running

### Using the API in Development

For local development, you can:

1. Set `VITE_USE_MOCK_DATA=true` to use mock data without an API server
2. Run the FastAPI server and set `VITE_USE_MOCK_DATA=false` to use actual API calls
3. In development mode (`import.meta.env.DEV`), the system will automatically fall back to mock data if API calls fail

### Debugging API Calls

The system logs detailed information about API calls and responses to the console, including:

- API request URLs
- Response format errors
- Mock data fallbacks

Check the browser's developer console for these logs when troubleshooting API issues.
