
# API Documentation for SWE-QA Annotation System

## Overview

This document outlines the expected API endpoints and data structures for the SWE-QA annotation system. The current implementation uses mock data, but these are the endpoints that would be needed for a production implementation.

## Base URL

All API endpoints are expected to be available at: `https://api.swe-qa.example.com/v1`

## Authentication

All API requests should include authentication headers:
```
Authorization: Bearer {JWT_TOKEN}
```

## Endpoints

### Discussions

#### GET /discussions
Retrieves a list of all available discussions.

**Response:**
```json
[
  {
    "id": "1",
    "title": "How to implement feature X?",
    "url": "https://github.com/org/repo/discussions/123",
    "repository": "org/repo",
    "createdAt": "2025-05-01",
    "tasks": {
      "task1": { "status": "unlocked", "annotators": 1 },
      "task2": { "status": "locked", "annotators": 0 },
      "task3": { "status": "locked", "annotators": 0 }
    }
  }
]
```

#### GET /discussions/{id}
Retrieves a specific discussion by ID.

**Response:**
Same as single element from the array above.

#### GET /discussions?status={status}
Filters discussions by status (locked, unlocked, completed).

**Response:**
Array of discussions matching the status.

### Annotations

#### GET /annotations?discussionId={discussionId}
Retrieves all annotations for a specific discussion.

**Response:**
```json
[
  {
    "discussionId": "1",
    "userId": "1",
    "taskId": 1,
    "data": {
      "relevance": true,
      "learning_value": true,
      "clarity": false,
      "relevance_text": "This is relevant because...",
      "learning_value_text": "It has learning value because..."
    },
    "timestamp": "2025-05-01T12:00:00Z"
  }
]
```

#### GET /annotations?discussionId={discussionId}&taskId={taskId}
Retrieves all annotations for a specific discussion and task.

**Response:**
Array of annotations filtered by discussion and task.

#### GET /annotations?discussionId={discussionId}&userId={userId}&taskId={taskId}
Retrieves a specific annotation by discussion, user, and task.

**Response:**
Single annotation object.

#### POST /annotations
Creates or updates an annotation.

**Request Body:**
```json
{
  "discussionId": "1",
  "userId": "1",
  "taskId": 1,
  "data": {
    "relevance": true,
    "learning_value": true,
    "clarity": false,
    "relevance_text": "This is relevant because...",
    "learning_value_text": "It has learning value because..."
  }
}
```

**Response:**
Created or updated annotation with timestamp added.

### Consensus

#### GET /consensus?discussionId={discussionId}&taskId={taskId}
Retrieves the consensus annotation for a specific discussion and task.

**Response:**
Single annotation object representing the consensus.

#### POST /consensus
Creates or updates a consensus annotation.

**Request Body:**
Same as POST /annotations

**Response:**
Created or updated consensus annotation with timestamp added.

#### GET /consensus/calculate?discussionId={discussionId}&taskId={taskId}
Calculates consensus based on existing annotations.

**Response:**
```json
{
  "result": "Agreement",
  "agreement": true
}
```

## File Upload/Download

### POST /files/upload
Uploads a file (such as screenshot for code execution verification).

**Request:**
Multipart form data with file.

**Response:**
```json
{
  "fileUrl": "https://storage.swe-qa.example.com/files/screenshot-123.png",
  "filename": "screenshot-123.png",
  "size": 24500,
  "mimeType": "image/png"
}
```

### GET /code/download?discussionId={discussionId}
Generates and returns a download URL for code associated with a discussion.

**Response:**
```json
{
  "downloadUrl": "https://storage.swe-qa.example.com/code/repo-123.tar.gz",
  "filename": "repo-123.tar.gz",
  "size": 1245000,
  "expires": "2025-05-02T12:00:00Z"
}
```

## Error Responses

All endpoints may return error responses with this structure:

```json
{
  "message": "Error message description",
  "status": 400,
  "errors": [
    {
      "field": "relevance",
      "message": "Field is required"
    }
  ]
}
```

## Implementation Notes

1. The current mock implementation simulates these endpoints using in-memory arrays.
2. For production, implement proper authentication, validation, and database storage.
3. File uploads should be handled with proper security scanning and size limitations.
4. Consider implementing versioning for annotations to track changes over time.
