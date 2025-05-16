
import { Discussion, Annotation } from './types';

// Mock data for development/testing when API is unavailable
export const mockDiscussions: Discussion[] = [
  {
    id: 'github-123',
    title: 'How to implement custom hooks in React',
    url: 'https://github.com/facebook/react/discussions/123',
    repository: 'facebook/react',
    createdAt: '2025-04-15',
    tasks: {
      task1: { status: 'completed', annotators: 3 },
      task2: { status: 'unlocked', annotators: 1 },
      task3: { status: 'locked', annotators: 0 }
    }
  },
  {
    id: 'github-456',
    title: 'Best practices for state management',
    url: 'https://github.com/reduxjs/redux/discussions/456',
    repository: 'reduxjs/redux',
    createdAt: '2025-04-10',
    tasks: {
      task1: { status: 'unlocked', annotators: 2 },
      task2: { status: 'locked', annotators: 0 },
      task3: { status: 'locked', annotators: 0 }
    }
  },
  {
    id: 'github-789',
    title: 'Optimizing TypeScript compilation',
    url: 'https://github.com/microsoft/typescript/discussions/789',
    repository: 'microsoft/typescript',
    createdAt: '2025-04-05',
    tasks: {
      task1: { status: 'completed', annotators: 3 },
      task2: { status: 'completed', annotators: 3 },
      task3: { status: 'unlocked', annotators: 2 }
    }
  }
];

export const mockAnnotations: Annotation[] = [
  {
    discussionId: 'github-123',
    userId: 'user1',
    taskId: 1,
    data: { relevance: true, learning_value: true, clarity: true },
    timestamp: '2025-04-15T10:30:00Z'
  },
  {
    discussionId: 'github-123',
    userId: 'user2',
    taskId: 1,
    data: { relevance: true, learning_value: false, clarity: true },
    timestamp: '2025-04-16T14:20:00Z'
  }
];
