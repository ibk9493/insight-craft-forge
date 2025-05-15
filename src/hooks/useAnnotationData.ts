
import { useState, useEffect, useCallback } from 'react';
import { useUser } from '@/contexts/UserContext';

// Types for annotation data
export interface Annotation {
  discussionId: string;
  userId: string;
  taskId: number;
  data: Record<string, string | boolean>;
  timestamp: string;
}

export interface UserAnnotationStatus {
  task1: boolean;
  task2: boolean;
  task3: boolean;
}

interface Discussion {
  id: string;
  title: string;
  url: string;
  repository: string;
  createdAt: string;
  tasks: {
    task1: {
      status: 'locked' | 'unlocked' | 'completed';
      annotators: number;
    };
    task2: {
      status: 'locked' | 'unlocked' | 'completed';
      annotators: number;
    };
    task3: {
      status: 'locked' | 'unlocked' | 'completed';
      annotators: number;
    };
  };
}

// Sample discussion data - would be replaced with actual API calls
const sampleDiscussions: Discussion[] = [
  {
    id: '1',
    title: 'How to implement feature X?',
    url: 'https://github.com/org/repo/discussions/123',
    repository: 'org/repo',
    createdAt: '2025-05-01',
    tasks: {
      task1: { status: 'unlocked', annotators: 1 },
      task2: { status: 'locked', annotators: 0 },
      task3: { status: 'locked', annotators: 0 }
    }
  },
  {
    id: '2',
    title: 'Bug in module Y',
    url: 'https://github.com/org/repo/discussions/456',
    repository: 'org/repo',
    createdAt: '2025-05-05',
    tasks: {
      task1: { status: 'completed', annotators: 3 },
      task2: { status: 'unlocked', annotators: 1 },
      task3: { status: 'locked', annotators: 0 }
    }
  },
  {
    id: '3',
    title: 'Documentation update for Z',
    url: 'https://github.com/org/repo/discussions/789',
    repository: 'org/repo',
    createdAt: '2025-05-10',
    tasks: {
      task1: { status: 'completed', annotators: 3 },
      task2: { status: 'completed', annotators: 3 },
      task3: { status: 'unlocked', annotators: 2 }
    }
  },
  {
    id: '4',
    title: 'Processing logic in Sensors',
    url: 'https://github.com/apache/airflow/discussions/43579',
    repository: 'apache/airflow',
    createdAt: '2024-11-01',
    tasks: {
      task1: { status: 'completed', annotators: 3 },
      task2: { status: 'completed', annotators: 3 },
      task3: { status: 'unlocked', annotators: 3 }
    }
  }
];

// Sample annotations data
const sampleAnnotations: Annotation[] = [
  // User 1 annotations
  {
    discussionId: '1',
    userId: '1',
    taskId: 1,
    data: { relevance: 'Yes', learning_value: 'Yes', clarity: 'No' },
    timestamp: new Date().toISOString()
  },
  {
    discussionId: '2',
    userId: '1',
    taskId: 1,
    data: { relevance: 'Yes', learning_value: 'Yes', clarity: 'Yes' },
    timestamp: new Date().toISOString()
  },
  {
    discussionId: '2',
    userId: '1',
    taskId: 2,
    data: { aspects: 'Yes', explanation: 'Yes', execution: 'N/A' },
    timestamp: new Date().toISOString()
  },
  
  // User 2 annotations
  {
    discussionId: '2',
    userId: '2',
    taskId: 1,
    data: { relevance: 'Yes', learning_value: 'Yes', clarity: 'Yes' },
    timestamp: new Date().toISOString()
  },
  {
    discussionId: '3',
    userId: '2',
    taskId: 1,
    data: { relevance: 'Yes', learning_value: 'Yes', clarity: 'Yes' },
    timestamp: new Date().toISOString()
  },
  {
    discussionId: '3',
    userId: '2',
    taskId: 2,
    data: { aspects: 'Yes', explanation: 'Yes', execution: 'Executable' },
    timestamp: new Date().toISOString()
  },
  
  // User 3 annotations
  {
    discussionId: '2',
    userId: '3',
    taskId: 1,
    data: { relevance: 'Yes', learning_value: 'No', clarity: 'Yes' },
    timestamp: new Date().toISOString()
  },
  {
    discussionId: '3',
    userId: '3',
    taskId: 1,
    data: { relevance: 'Yes', learning_value: 'Yes', clarity: 'Yes' },
    timestamp: new Date().toISOString()
  },
  {
    discussionId: '3',
    userId: '3',
    taskId: 2,
    data: { aspects: 'Yes', explanation: 'Yes', execution: 'Executable' },
    timestamp: new Date().toISOString()
  },
  {
    discussionId: '3',
    userId: '3',
    taskId: 3,
    data: { rewrite: 'Completed', classify: 'Search' },
    timestamp: new Date().toISOString()
  },
  {
    discussionId: '4',
    userId: '1',
    taskId: 1,
    data: { relevance: 'Yes', learning_value: 'Yes', clarity: 'Yes' },
    timestamp: new Date().toISOString()
  },
  {
    discussionId: '4',
    userId: '2',
    taskId: 1,
    data: { relevance: 'Yes', learning_value: 'Yes', clarity: 'Yes' },
    timestamp: new Date().toISOString()
  },
  {
    discussionId: '4',
    userId: '3',
    taskId: 1,
    data: { relevance: 'Yes', learning_value: 'Yes', clarity: 'Yes' },
    timestamp: new Date().toISOString()
  },
  {
    discussionId: '4',
    userId: '1',
    taskId: 2,
    data: { aspects: 'Yes', explanation: 'Yes', execution: 'Executable' },
    timestamp: new Date().toISOString()
  },
  {
    discussionId: '4',
    userId: '2',
    taskId: 2,
    data: { aspects: 'Yes', explanation: 'Yes', execution: 'Executable' },
    timestamp: new Date().toISOString()
  },
  {
    discussionId: '4',
    userId: '3',
    taskId: 2,
    data: { aspects: 'Yes', explanation: 'Yes', execution: 'Executable' },
    timestamp: new Date().toISOString()
  },
  {
    discussionId: '4',
    userId: '1',
    taskId: 3,
    data: { rewrite: 'Completed', classify: 'Reasoning' },
    timestamp: new Date().toISOString()
  },
  {
    discussionId: '4',
    userId: '2',
    taskId: 3,
    data: { rewrite: 'Completed', classify: 'Reasoning' },
    timestamp: new Date().toISOString()
  },
  {
    discussionId: '4',
    userId: '3',
    taskId: 3,
    data: { rewrite: 'Completed', classify: 'Reasoning' },
    timestamp: new Date().toISOString()
  }
];

export function useAnnotationData() {
  const { user } = useUser();
  const [discussions, setDiscussions] = useState<Discussion[]>(sampleDiscussions);
  const [annotations, setAnnotations] = useState<Annotation[]>(sampleAnnotations);
  const [consensusAnnotations, setConsensusAnnotations] = useState<Annotation[]>([]);

  // Simulating API call to fetch discussions
  useEffect(() => {
    // This would be an API call in a real application
    setDiscussions(sampleDiscussions);
  }, []);

  // Simulating API call to fetch annotations
  useEffect(() => {
    // This would be an API call in a real application
    setAnnotations(sampleAnnotations);
  }, []);

  // Get annotations for a specific discussion and task
  const getAnnotationsForTask = useCallback((discussionId: string, taskId: number) => {
    return annotations.filter(
      annotation => annotation.discussionId === discussionId && annotation.taskId === taskId
    );
  }, [annotations]);

  // Check if a user has annotated a specific discussion task
  const getUserAnnotationStatus = useCallback((discussionId: string, userId: string): UserAnnotationStatus => {
    return {
      task1: annotations.some(a => a.discussionId === discussionId && a.userId === userId && a.taskId === 1),
      task2: annotations.some(a => a.discussionId === discussionId && a.userId === userId && a.taskId === 2),
      task3: annotations.some(a => a.discussionId === discussionId && a.userId === userId && a.taskId === 3),
    };
  }, [annotations]);

  // Get user's annotation for a specific discussion and task
  const getUserAnnotation = useCallback((discussionId: string, userId: string, taskId: number) => {
    return annotations.find(
      a => a.discussionId === discussionId && a.userId === userId && a.taskId === taskId
    );
  }, [annotations]);

  // Save an annotation
  const saveAnnotation = useCallback((annotation: Omit<Annotation, 'timestamp'>) => {
    const newAnnotation = {
      ...annotation,
      timestamp: new Date().toISOString()
    };
    
    // Check if an annotation already exists
    const existingIndex = annotations.findIndex(
      a => a.discussionId === annotation.discussionId && 
           a.userId === annotation.userId && 
           a.taskId === annotation.taskId
    );
    
    if (existingIndex !== -1) {
      // Update existing annotation
      const updatedAnnotations = [...annotations];
      updatedAnnotations[existingIndex] = newAnnotation;
      setAnnotations(updatedAnnotations);
    } else {
      // Add new annotation
      setAnnotations(prev => [...prev, newAnnotation]);
      
      // Update discussion status
      updateDiscussionStatus(annotation.discussionId, annotation.taskId);
    }
    
    return true;
  }, [annotations]);

  // Update discussion status based on annotation counts
  const updateDiscussionStatus = useCallback((discussionId: string, taskId: number) => {
    const taskAnnotations = getAnnotationsForTask(discussionId, taskId);
    const uniqueUserCount = new Set(taskAnnotations.map(a => a.userId)).size;
    
    const updatedDiscussions = discussions.map(discussion => {
      if (discussion.id !== discussionId) return discussion;
      
      const updatedTasks = { ...discussion.tasks };
      
      if (taskId === 1) {
        updatedTasks.task1 = { 
          ...updatedTasks.task1,
          annotators: uniqueUserCount,
          status: uniqueUserCount >= 3 ? 'completed' : 'unlocked'
        };
        
        // Unlock task 2 if task 1 is completed
        if (uniqueUserCount >= 3) {
          updatedTasks.task2 = { 
            ...updatedTasks.task2,
            status: 'unlocked'
          };
        }
      } else if (taskId === 2) {
        updatedTasks.task2 = { 
          ...updatedTasks.task2,
          annotators: uniqueUserCount,
          status: uniqueUserCount >= 3 ? 'completed' : 'unlocked'
        };
        
        // Unlock task 3 if task 2 is completed
        if (uniqueUserCount >= 3) {
          updatedTasks.task3 = { 
            ...updatedTasks.task3,
            status: 'unlocked'
          };
        }
      } else if (taskId === 3) {
        updatedTasks.task3 = { 
          ...updatedTasks.task3,
          annotators: uniqueUserCount,
          status: uniqueUserCount >= 5 ? 'completed' : 'unlocked'
        };
      }
      
      return {
        ...discussion,
        tasks: updatedTasks
      };
    });
    
    setDiscussions(updatedDiscussions);
  }, [discussions, getAnnotationsForTask]);

  // Save consensus annotation by pod lead
  const saveConsensusAnnotation = useCallback((consensusAnnotation: Omit<Annotation, 'timestamp'>) => {
    // Validate that this is coming from a pod lead
    if (!user || user.role !== 'pod_lead') return false;
    
    const newConsensusAnnotation = {
      ...consensusAnnotation,
      timestamp: new Date().toISOString()
    };
    
    // Check if a consensus annotation already exists
    const existingIndex = consensusAnnotations.findIndex(
      a => a.discussionId === consensusAnnotation.discussionId && a.taskId === consensusAnnotation.taskId
    );
    
    if (existingIndex !== -1) {
      // Update existing consensus annotation
      const updatedConsensusAnnotations = [...consensusAnnotations];
      updatedConsensusAnnotations[existingIndex] = newConsensusAnnotation;
      setConsensusAnnotations(updatedConsensusAnnotations);
    } else {
      // Add new consensus annotation
      setConsensusAnnotations(prev => [...prev, newConsensusAnnotation]);
    }
    
    return true;
  }, [consensusAnnotations, user]);

  // Get all annotations for a discussion
  const getDiscussionAnnotations = useCallback((discussionId: string) => {
    return annotations.filter(a => a.discussionId === discussionId);
  }, [annotations]);

  // Get consensus annotation for a discussion task
  const getConsensusAnnotation = useCallback((discussionId: string, taskId: number) => {
    return consensusAnnotations.find(
      a => a.discussionId === discussionId && a.taskId === taskId
    );
  }, [consensusAnnotations]);

  // Filter discussions by their status
  const getDiscussionsByStatus = useCallback((status: 'locked' | 'unlocked' | 'completed') => {
    return discussions.filter(d => {
      if (status === 'completed') {
        return d.tasks.task1.status === 'completed' && 
               d.tasks.task2.status === 'completed' && 
               d.tasks.task3.status === 'completed';
      } else if (status === 'unlocked') {
        return d.tasks.task1.status === 'unlocked' || 
               d.tasks.task2.status === 'unlocked' || 
               d.tasks.task3.status === 'unlocked';
      } else {
        return d.tasks.task1.status === 'locked' && 
               d.tasks.task2.status === 'locked' && 
               d.tasks.task3.status === 'locked';
      }
    });
  }, [discussions]);

  return {
    discussions,
    annotations,
    consensusAnnotations,
    getAnnotationsForTask,
    getUserAnnotationStatus,
    getUserAnnotation,
    saveAnnotation,
    saveConsensusAnnotation,
    getDiscussionAnnotations,
    getConsensusAnnotation,
    getDiscussionsByStatus
  };
}
