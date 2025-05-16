
import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import Header from '@/components/layout/Header';
import { useUser } from '@/contexts/UserContext';
import { useNavigate } from 'react-router-dom';
import { useEffect } from 'react';

const ApiDocs = () => {
  const { isAuthenticated, isPodLead, isAdmin } = useUser();
  const navigate = useNavigate();
  
  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/');
    }
  }, [isAuthenticated, navigate]);

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <Header />
      
      <div className="container max-w-6xl mx-auto px-4 py-6 flex-grow">
        <div className="mb-6">
          <h1 className="text-2xl font-bold">API Documentation</h1>
          <p className="text-sm text-gray-500">
            Reference for all API endpoints in the SWE-QA annotation system
          </p>
        </div>
        
        <Tabs defaultValue="discussions">
          <TabsList className="mb-4">
            <TabsTrigger value="discussions">Discussions</TabsTrigger>
            <TabsTrigger value="annotations">Annotations</TabsTrigger>
            <TabsTrigger value="consensus">Consensus</TabsTrigger>
            <TabsTrigger value="files">Files</TabsTrigger>
            <TabsTrigger value="admin">Admin</TabsTrigger>
          </TabsList>
          
          <TabsContent value="discussions">
            <ApiSection 
              title="Discussions API" 
              description="Retrieve and manage GitHub discussion data"
              endpoints={[
                {
                  name: 'GET /discussions',
                  description: 'Retrieves a list of all available discussions',
                  requestParams: [],
                  responseFields: [
                    { name: 'id', type: 'string', description: 'Unique discussion identifier' },
                    { name: 'title', type: 'string', description: 'Discussion title' },
                    { name: 'url', type: 'string', description: 'GitHub URL for the discussion' },
                    { name: 'repository', type: 'string', description: 'Repository name (org/repo format)' },
                    { name: 'createdAt', type: 'string', description: 'Date of creation (ISO format)' },
                    { name: 'tasks', type: 'object', description: 'Contains task1, task2, task3 status objects' },
                  ],
                  example: `[
  {
    "id": "github-123",
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
]`
                },
                {
                  name: 'GET /discussions/{id}',
                  description: 'Retrieves a specific discussion by ID',
                  requestParams: [
                    { name: 'id', type: 'path', description: 'Discussion ID' }
                  ],
                  responseFields: [
                    { name: 'id', type: 'string', description: 'Unique discussion identifier' },
                    { name: 'title', type: 'string', description: 'Discussion title' },
                    { name: 'url', type: 'string', description: 'GitHub URL for the discussion' },
                    { name: 'repository', type: 'string', description: 'Repository name (org/repo format)' },
                    { name: 'createdAt', type: 'string', description: 'Date of creation (ISO format)' },
                    { name: 'tasks', type: 'object', description: 'Contains task1, task2, task3 status objects' },
                  ],
                  example: `{
  "id": "github-123",
  "title": "How to implement feature X?",
  "url": "https://github.com/org/repo/discussions/123",
  "repository": "org/repo",
  "createdAt": "2025-05-01",
  "tasks": {
    "task1": { "status": "unlocked", "annotators": 1 },
    "task2": { "status": "locked", "annotators": 0 },
    "task3": { "status": "locked", "annotators": 0 }
  }
}`
                },
                {
                  name: 'GET /discussions?status={status}',
                  description: 'Filters discussions by status',
                  requestParams: [
                    { name: 'status', type: 'query', description: 'Status to filter by (locked, unlocked, completed)' }
                  ],
                  responseFields: [
                    { name: 'Array of discussion objects', type: 'array', description: 'List of discussions matching the status' }
                  ],
                  example: '[ ... array of discussion objects ... ]'
                }
              ]}
            />
          </TabsContent>
          
          <TabsContent value="annotations">
            <ApiSection 
              title="Annotations API" 
              description="Create and retrieve annotation data"
              endpoints={[
                {
                  name: 'GET /annotations?discussionId={discussionId}',
                  description: 'Retrieves all annotations for a specific discussion',
                  requestParams: [
                    { name: 'discussionId', type: 'query', description: 'Discussion ID' }
                  ],
                  responseFields: [
                    { name: 'discussionId', type: 'string', description: 'Discussion identifier' },
                    { name: 'userId', type: 'string', description: 'User identifier' },
                    { name: 'taskId', type: 'number', description: 'Task identifier (1, 2, or 3)' },
                    { name: 'data', type: 'object', description: 'Annotation data with field keys and values' },
                    { name: 'timestamp', type: 'string', description: 'Creation timestamp (ISO format)' }
                  ],
                  example: `[
  {
    "discussionId": "github-123",
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
]`
                },
                {
                  name: 'GET /annotations?discussionId={discussionId}&taskId={taskId}',
                  description: 'Retrieves all annotations for a specific discussion and task',
                  requestParams: [
                    { name: 'discussionId', type: 'query', description: 'Discussion ID' },
                    { name: 'taskId', type: 'query', description: 'Task ID (1, 2, or 3)' }
                  ],
                  responseFields: [
                    { name: 'Array of annotation objects', type: 'array', description: 'List of annotations for the specified discussion and task' }
                  ],
                  example: '[ ... array of annotation objects ... ]'
                },
                {
                  name: 'POST /annotations',
                  description: 'Creates or updates an annotation',
                  requestParams: [
                    { name: 'requestBody', type: 'body', description: 'Annotation object (without timestamp)' }
                  ],
                  requestBodyFields: [
                    { name: 'discussionId', type: 'string', description: 'Discussion identifier' },
                    { name: 'userId', type: 'string', description: 'User identifier' },
                    { name: 'taskId', type: 'number', description: 'Task identifier (1, 2, or 3)' },
                    { name: 'data', type: 'object', description: 'Annotation data with field keys and values' }
                  ],
                  responseFields: [
                    { name: 'Created or updated annotation with timestamp', type: 'object', description: 'Complete annotation object' }
                  ],
                  example: `// Request
{
  "discussionId": "github-123",
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

// Response
{
  "discussionId": "github-123",
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
}`
                }
              ]}
            />
          </TabsContent>
          
          <TabsContent value="consensus">
            <ApiSection 
              title="Consensus API" 
              description="Calculate and manage consensus annotations"
              endpoints={[
                {
                  name: 'GET /consensus?discussionId={discussionId}&taskId={taskId}',
                  description: 'Retrieves consensus annotation for a specific discussion and task',
                  requestParams: [
                    { name: 'discussionId', type: 'query', description: 'Discussion ID' },
                    { name: 'taskId', type: 'query', description: 'Task ID (1, 2, or 3)' }
                  ],
                  responseFields: [
                    { name: 'discussionId', type: 'string', description: 'Discussion identifier' },
                    { name: 'userId', type: 'string', description: 'Always "consensus" for consensus annotations' },
                    { name: 'taskId', type: 'number', description: 'Task identifier (1, 2, or 3)' },
                    { name: 'data', type: 'object', description: 'Consensus data with field keys and values' },
                    { name: 'timestamp', type: 'string', description: 'Creation timestamp (ISO format)' }
                  ],
                  example: `{
  "discussionId": "github-123",
  "userId": "consensus",
  "taskId": 1,
  "data": {
    "relevance": true,
    "learning_value": true,
    "clarity": true
  },
  "timestamp": "2025-05-01T14:30:00Z"
}`
                },
                {
                  name: 'GET /consensus/calculate?discussionId={discussionId}&taskId={taskId}',
                  description: 'Calculates consensus based on existing annotations',
                  requestParams: [
                    { name: 'discussionId', type: 'query', description: 'Discussion ID' },
                    { name: 'taskId', type: 'query', description: 'Task ID (1, 2, or 3)' }
                  ],
                  responseFields: [
                    { name: 'result', type: 'string', description: 'Result of consensus calculation' },
                    { name: 'agreement', type: 'boolean', description: 'Whether there is agreement among annotators' }
                  ],
                  example: `{
  "result": "Agreement",
  "agreement": true
}`
                },
                {
                  name: 'POST /consensus',
                  description: 'Creates or updates consensus annotation',
                  requestParams: [
                    { name: 'requestBody', type: 'body', description: 'Consensus annotation object (without timestamp)' }
                  ],
                  requestBodyFields: [
                    { name: 'discussionId', type: 'string', description: 'Discussion identifier' },
                    { name: 'userId', type: 'string', description: 'Usually pod lead user ID' },
                    { name: 'taskId', type: 'number', description: 'Task identifier (1, 2, or 3)' },
                    { name: 'data', type: 'object', description: 'Consensus data with field keys and values' }
                  ],
                  responseFields: [
                    { name: 'Created or updated consensus annotation with timestamp', type: 'object', description: 'Complete consensus annotation object' }
                  ],
                  example: `// Request
{
  "discussionId": "github-123",
  "userId": "4",
  "taskId": 1,
  "data": {
    "relevance": true,
    "learning_value": true,
    "clarity": true
  }
}

// Response
{
  "discussionId": "github-123",
  "userId": "4",
  "taskId": 1,
  "data": {
    "relevance": true,
    "learning_value": true,
    "clarity": true
  },
  "timestamp": "2025-05-01T14:30:00Z"
}`
                }
              ]}
            />
          </TabsContent>
          
          <TabsContent value="files">
            <ApiSection 
              title="Files API" 
              description="Upload and download files"
              endpoints={[
                {
                  name: 'POST /files/upload',
                  description: 'Uploads a file (such as screenshot)',
                  requestParams: [
                    { name: 'file', type: 'formData', description: 'File to upload' },
                    { name: 'discussionId', type: 'formData', description: 'Discussion ID' }
                  ],
                  responseFields: [
                    { name: 'fileUrl', type: 'string', description: 'URL of the uploaded file' }
                  ],
                  example: `// Response
{
  "fileUrl": "https://storage.example.com/files/screenshot-123.png",
  "filename": "screenshot-123.png",
  "size": 24500,
  "mimeType": "image/png"
}`
                },
                {
                  name: 'GET /code/download?discussionId={discussionId}&repo={repo}',
                  description: 'Generates download URL for code associated with a discussion',
                  requestParams: [
                    { name: 'discussionId', type: 'query', description: 'Discussion ID' },
                    { name: 'repo', type: 'query', description: 'Repository name' }
                  ],
                  responseFields: [
                    { name: 'downloadUrl', type: 'string', description: 'URL to download code archive' }
                  ],
                  example: `{
  "downloadUrl": "https://storage.example.com/code/repo-123.tar.gz",
  "filename": "repo-123.tar.gz",
  "size": 1245000,
  "expires": "2025-05-02T12:00:00Z"
}`
                }
              ]}
            />
          </TabsContent>
          
          <TabsContent value="admin">
            <ApiSection 
              title="Admin API" 
              description="Administrative endpoints (admin only)"
              endpoints={[
                {
                  name: 'POST /admin/discussions/upload',
                  description: 'Upload GitHub discussions from JSON',
                  requestParams: [
                    { name: 'discussions', type: 'body', description: 'Array of GitHub discussion objects' }
                  ],
                  responseFields: [
                    { name: 'success', type: 'boolean', description: 'Whether the upload was successful' },
                    { name: 'message', type: 'string', description: 'Status message' },
                    { name: 'discussionsAdded', type: 'number', description: 'Number of discussions added' },
                    { name: 'errors', type: 'array', description: 'Array of error messages (if any)' }
                  ],
                  example: `// Request
{
  "discussions": [
    {
      "id": "github-999",
      "title": "How to implement feature Y?",
      "url": "https://github.com/org/repo/discussions/999",
      "repository": "org/repo",
      "createdAt": "2025-05-10"
    }
  ]
}

// Response
{
  "success": true,
  "message": "Successfully uploaded 1 discussion",
  "discussionsAdded": 1,
  "errors": []
}`
                },
                {
                  name: 'PUT /admin/tasks/status',
                  description: 'Update task status',
                  requestParams: [
                    { name: 'discussionId', type: 'body', description: 'Discussion ID' },
                    { name: 'taskId', type: 'body', description: 'Task ID (1, 2, or 3)' },
                    { name: 'status', type: 'body', description: 'New status (locked, unlocked, completed)' }
                  ],
                  responseFields: [
                    { name: 'success', type: 'boolean', description: 'Whether the update was successful' },
                    { name: 'message', type: 'string', description: 'Status message' },
                    { name: 'discussion', type: 'object', description: 'Updated discussion object' }
                  ],
                  example: `// Request
{
  "discussionId": "github-123",
  "taskId": 2,
  "status": "unlocked"
}

// Response
{
  "success": true,
  "message": "Task 2 status updated to unlocked",
  "discussion": {
    "id": "github-123",
    "title": "How to implement feature X?",
    "url": "https://github.com/org/repo/discussions/123",
    "repository": "org/repo",
    "createdAt": "2025-05-01",
    "tasks": {
      "task1": { "status": "completed", "annotators": 3 },
      "task2": { "status": "unlocked", "annotators": 0 },
      "task3": { "status": "locked", "annotators": 0 }
    }
  }
}`
                }
              ]}
            />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

// Component to display API documentation sections
interface EndpointField {
  name: string;
  type: string;
  description: string;
}

interface Endpoint {
  name: string;
  description: string;
  requestParams: Array<{ name: string; type: string; description: string }>;
  requestBodyFields?: EndpointField[];
  responseFields: EndpointField[];
  example: string;
}

interface ApiSectionProps {
  title: string;
  description: string;
  endpoints: Endpoint[];
}

const ApiSection: React.FC<ApiSectionProps> = ({ title, description, endpoints }) => {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold">{title}</h2>
        <p className="text-sm text-gray-600">{description}</p>
      </div>
      
      <div className="space-y-8">
        {endpoints.map((endpoint, index) => (
          <Card key={index}>
            <CardHeader>
              <CardTitle className="font-mono text-lg">{endpoint.name}</CardTitle>
              <CardDescription>{endpoint.description}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {endpoint.requestParams.length > 0 && (
                  <div>
                    <h4 className="font-semibold mb-2">Request Parameters</h4>
                    <div className="bg-gray-50 rounded-md p-3">
                      <table className="min-w-full">
                        <thead>
                          <tr>
                            <th className="text-left text-xs font-semibold text-gray-600 p-2">Parameter</th>
                            <th className="text-left text-xs font-semibold text-gray-600 p-2">Type</th>
                            <th className="text-left text-xs font-semibold text-gray-600 p-2">Description</th>
                          </tr>
                        </thead>
                        <tbody>
                          {endpoint.requestParams.map((param, i) => (
                            <tr key={i}>
                              <td className="p-2 text-sm">{param.name}</td>
                              <td className="p-2 text-sm font-mono">{param.type}</td>
                              <td className="p-2 text-sm">{param.description}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
                
                {endpoint.requestBodyFields && endpoint.requestBodyFields.length > 0 && (
                  <div>
                    <h4 className="font-semibold mb-2">Request Body Fields</h4>
                    <div className="bg-gray-50 rounded-md p-3">
                      <table className="min-w-full">
                        <thead>
                          <tr>
                            <th className="text-left text-xs font-semibold text-gray-600 p-2">Field</th>
                            <th className="text-left text-xs font-semibold text-gray-600 p-2">Type</th>
                            <th className="text-left text-xs font-semibold text-gray-600 p-2">Description</th>
                          </tr>
                        </thead>
                        <tbody>
                          {endpoint.requestBodyFields.map((field, i) => (
                            <tr key={i}>
                              <td className="p-2 text-sm">{field.name}</td>
                              <td className="p-2 text-sm font-mono">{field.type}</td>
                              <td className="p-2 text-sm">{field.description}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
                
                <div>
                  <h4 className="font-semibold mb-2">Response</h4>
                  <div className="bg-gray-50 rounded-md p-3">
                    <table className="min-w-full">
                      <thead>
                        <tr>
                          <th className="text-left text-xs font-semibold text-gray-600 p-2">Field</th>
                          <th className="text-left text-xs font-semibold text-gray-600 p-2">Type</th>
                          <th className="text-left text-xs font-semibold text-gray-600 p-2">Description</th>
                        </tr>
                      </thead>
                      <tbody>
                        {endpoint.responseFields.map((field, i) => (
                          <tr key={i}>
                            <td className="p-2 text-sm">{field.name}</td>
                            <td className="p-2 text-sm font-mono">{field.type}</td>
                            <td className="p-2 text-sm">{field.description}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
                
                <div>
                  <h4 className="font-semibold mb-2">Example</h4>
                  <pre className="bg-gray-800 text-gray-100 rounded-md p-3 overflow-auto text-xs">
                    <code>{endpoint.example}</code>
                  </pre>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
};

export default ApiDocs;
