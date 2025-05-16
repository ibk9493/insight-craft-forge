
# SWE-QA API Server (FastAPI)

This is the FastAPI backend server for the Software Engineering QA Annotation System.

## Setup

### 1. Install Dependencies

```bash
pip install -r requirements.txt
```

### 2. Configure Environment Variables

Copy the example environment file and update it with your settings:

```bash
cp .env.example .env
```

Key variables to configure:

- `DATABASE_URL`: Connection string for your database
- `API_KEY`: Secret key for API authentication

### 3. Run the Server

```bash
cd api-server-fastapi
uvicorn main:app --reload --port 8000
```

The API will be available at http://localhost:8000/api/

## API Documentation

Once the server is running, interactive API documentation is available at:
- Swagger UI: http://localhost:8000/docs
- ReDoc: http://localhost:8000/redoc

## API Endpoints

### Authentication

- `POST /api/auth/google`: Verify Google OAuth tokens
- `GET /api/auth/authorized-users`: Get all authorized users
- `POST /api/auth/authorized-users`: Add a new authorized user
- `DELETE /api/auth/authorized-users/{email}`: Remove an authorized user

### Discussions

- `GET /api/discussions`: Get all discussions
- `GET /api/discussions/{discussion_id}`: Get a specific discussion
- `POST /api/admin/discussions/upload`: Upload discussions from JSON

### Annotations

- `GET /api/annotations`: Get annotations (filtered by query parameters)
- `POST /api/annotations`: Create a new annotation
- `PUT /api/annotations/{discussion_id}/{user_id}/{task_id}`: Update an annotation
- `PUT /api/admin/annotations/override`: Override an annotation (admin)

### Consensus

- `GET /api/consensus`: Get consensus for a discussion task
- `POST /api/consensus`: Create a consensus annotation
- `POST /api/consensus/calculate`: Calculate consensus for a discussion task
- `POST /api/consensus/override`: Override consensus (admin)

### Files

- `POST /api/files/upload`: Upload files related to annotations

### Task Management

- `PUT /api/admin/tasks/status`: Update task status

## Database Schema

### Models

- `Discussion`: GitHub discussions for annotation
- `Annotation`: User annotations for each discussion task
- `AuthorizedUser`: Users allowed to access the system

## Authentication

The API uses API key authentication. Include the API key in requests using the `X-API-Key` header.

