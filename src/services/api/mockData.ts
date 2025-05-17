
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
    },
    repositoryLanguage: 'JavaScript',
    releaseTag: 'v18.3.0',
    releaseUrl: 'https://github.com/facebook/react/archive/refs/tags/v18.3.0.tar.gz',
    releaseDate: '2025-01-15',
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
    },
    repositoryLanguage: 'JavaScript',
    releaseTag: 'v5.0.0',
    releaseUrl: 'https://github.com/reduxjs/redux/archive/refs/tags/v5.0.0.tar.gz',
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
    },
    repositoryLanguage: 'TypeScript',
    releaseTag: 'v5.2.0',
    releaseDate: '2025-03-01',
  },
  {
    id: 'github-3256',
    title: 'How to print the name of a file uploaded via a button?',
    url: 'https://github.com/marimo-team/marimo/discussions/3256',
    repository: 'marimo-team/marimo',
    createdAt: '2024-12-20',
    tasks: {
      task1: { status: 'completed', annotators: 3 },
      task2: { status: 'unlocked', annotators: 1 },
      task3: { status: 'locked', annotators: 0 }
    },
    repositoryLanguage: 'Python',
    releaseTag: 'v0.2.0',
    releaseUrl: 'https://github.com/marimo-team/marimo/archive/refs/tags/v0.2.0.tar.gz',
    releaseDate: '2024-11-15',
  },
  {
    id: 'github-3198',
    title: 'How to change a dropdown\'s options based on a text field?',
    url: 'https://github.com/marimo-team/marimo/discussions/3198',
    repository: 'marimo-team/marimo',
    createdAt: '2024-12-17',
    tasks: {
      task1: { status: 'completed', annotators: 3 },
      task2: { status: 'unlocked', annotators: 2 },
      task3: { status: 'locked', annotators: 0 }
    },
    repositoryLanguage: 'Python',
    releaseTag: 'v0.2.0',
    releaseUrl: 'https://github.com/marimo-team/marimo/archive/refs/tags/v0.2.0.tar.gz',
    releaseDate: '2024-11-15',
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
  },
  {
    discussionId: 'github-123',
    userId: 'user3',
    taskId: 1,
    data: { 
      relevance: true, 
      learning_value: true, 
      clarity: true,
      justification_for_relevance: "Question is about core React hooks functionality"
    },
    timestamp: '2025-04-15T12:45:00Z'
  },
  {
    discussionId: 'github-123',
    userId: 'user1',
    taskId: 2,
    data: { 
      address_all_aspects: true, 
      with_explanation: true, 
      code_executable: true,
      justification_for_addressing_all_aspects: "The answer covers all aspects of custom hook implementation",
      codeDownloadUrl: "https://github.com/facebook/react/archive/refs/tags/v18.3.0.tar.gz"
    },
    timestamp: '2025-04-17T09:20:00Z'
  },
  {
    discussionId: 'github-3256',
    userId: 'user1',
    taskId: 1,
    data: { 
      relevance: true, 
      learning_value: true, 
      clarity: true,
      image_grounded: true
    },
    timestamp: '2024-12-21T10:30:00Z'
  },
  {
    discussionId: 'github-3256',
    userId: 'user1',
    taskId: 2,
    data: { 
      address_all_aspects: true, 
      with_explanation: true, 
      code_executable: true,
      justification_for_addressing_all_aspects: "The answer addresses all aspects of the file upload button issue",
      codeDownloadUrl: "https://github.com/marimo-team/marimo/archive/refs/tags/v0.2.0.tar.gz"
    },
    timestamp: '2024-12-22T15:45:00Z'
  }
];
