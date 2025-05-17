
import { useState, useEffect, useCallback } from 'react';
import { useUser } from '@/contexts/UserContext';
import { api, Discussion, Annotation, ApiError, TaskStatus } from '@/services/api';
import { toast } from 'sonner';
import { TASK_CONFIG } from '@/config';

export interface UserAnnotationStatus {
  task1: boolean;
  task2: boolean;
  task3: boolean;
}

export function useAnnotationData() {
  const { user } = useUser();
  const [discussions, setDiscussions] = useState<Discussion[]>([]);
  const [annotations, setAnnotations] = useState<Annotation[]>([]);
  const [consensusAnnotations, setConsensusAnnotations] = useState<Annotation[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch discussions
  useEffect(() => {
    const fetchDiscussions = async () => {
      try {
        setLoading(true);
        const data = await api.discussions.getAll();
        setDiscussions(data || []);
        setError(null);
      } catch (err) {
        const errorMessage = (err as ApiError).message || 'Failed to fetch discussions';
        setError(errorMessage);
        toast.error(errorMessage);
        // Set empty array on error to prevent UI breaks
        setDiscussions([]);
      } finally {
        setLoading(false);
      }
    };

    fetchDiscussions();
  }, []);

  // Fetch annotations
  useEffect(() => {
    const fetchAnnotations = async () => {
      try {
        if (discussions.length === 0) {
          setAnnotations([]);
          return;
        }
        
        setLoading(true);
        
        // In a real app, we might want to limit this to only relevant discussions
        const promises = discussions.map(discussion => 
          api.annotations.getByDiscussionId(discussion.id)
        );
        
        const results = await Promise.allSettled(promises);
        const data = results
          .filter((result): result is PromiseFulfilledResult<Annotation[]> => 
            result.status === 'fulfilled'
          )
          .flatMap(result => result.value || []);
        
        setAnnotations(data);
        setError(null);
      } catch (err) {
        const errorMessage = (err as ApiError).message || 'Failed to fetch annotations';
        setError(errorMessage);
        toast.error(errorMessage);
        // Set empty array on error to prevent UI breaks
        setAnnotations([]);
      } finally {
        setLoading(false);
      }
    };

    if (discussions.length > 0) {
      fetchAnnotations();
    } else {
      setAnnotations([]);
    }
  }, [discussions]);

  // Get annotations for a specific discussion and task
  const getAnnotationsForTask = useCallback((discussionId: string, taskId: number) => {
    return annotations.filter(
      annotation => annotation.discussionId === discussionId && annotation.taskId === taskId
    );
  }, [annotations]);

  // Check if a user has annotated a specific discussion task
  const getUserAnnotationStatus = useCallback((discussionId: string, userId: string): UserAnnotationStatus => {
    if (!discussionId || !userId) return { task1: false, task2: false, task3: false };
    
    return {
      task1: annotations.some(a => a.discussionId === discussionId && a.userId === userId && a.taskId === 1),
      task2: annotations.some(a => a.discussionId === discussionId && a.userId === userId && a.taskId === 2),
      task3: annotations.some(a => a.discussionId === discussionId && a.userId === userId && a.taskId === 3),
    };
  }, [annotations]);

  // Get user's annotation for a specific discussion and task
  const getUserAnnotation = useCallback((discussionId: string, userId: string, taskId: number) => {
    if (!discussionId || !userId) return null;
    
    return annotations.find(
      a => a.discussionId === discussionId && a.userId === userId && a.taskId === taskId
    );
  }, [annotations]);

  // Save an annotation with proper type signature to return a Promise
  const saveAnnotation = useCallback(async (annotation: Omit<Annotation, 'timestamp'>): Promise<boolean> => {
    try {
      if (!annotation.discussionId || !annotation.userId) return false;
      
      setLoading(true);
      
      // Call API to save annotation
      const newAnnotation = await api.annotations.save(annotation);
      
      if (!newAnnotation) {
        throw new Error('Failed to save annotation');
      }
      
      // Update local state with the new annotation
      setAnnotations(prev => {
        const existingIndex = prev.findIndex(
          a => a.discussionId === annotation.discussionId && 
              a.userId === annotation.userId && 
              a.taskId === annotation.taskId
        );
        
        if (existingIndex !== -1) {
          const updated = [...prev];
          updated[existingIndex] = newAnnotation;
          return updated;
        } else {
          return [...prev, newAnnotation];
        }
      });
      
      // Fetch updated discussion status
      try {
        const updatedDiscussion = await api.discussions.getById(annotation.discussionId);
        if (updatedDiscussion) {
          setDiscussions(prev => 
            prev.map(d => d.id === updatedDiscussion.id ? updatedDiscussion : d)
          );
        }
      } catch (err) {
        console.error('Failed to fetch updated discussion status:', err);
      }
      
      toast.success('Annotation saved successfully');
      return true;
    } catch (err) {
      const errorMessage = (err as ApiError).message || 'Failed to save annotation';
      toast.error(errorMessage);
      return false;
    } finally {
      setLoading(false);
    }
  }, []);

  // Calculate consensus for a discussion task
  const calculateConsensus = useCallback(async (discussionId: string, taskId: number) => {
    try {
      if (!discussionId) return null;
      
      setLoading(true);
      
      // Call API to calculate consensus
      const result = await api.consensus.calculate(discussionId, taskId);
      return result;
      
    } catch (err) {
      const errorMessage = (err as ApiError).message || 'Failed to calculate consensus';
      toast.error(errorMessage);
      return { result: '', agreement: false };
    } finally {
      setLoading(false);
    }
  }, []);

  // Save consensus annotation with proper type signature
  const saveConsensusAnnotation = useCallback(async (consensusAnnotation: Omit<Annotation, 'timestamp'>): Promise<boolean> => {
    try {
      if (!consensusAnnotation.discussionId || !user || user.role !== 'pod_lead') {
        return false;
      }
      
      setLoading(true);
      
      // Validate that this is coming from a pod lead
      if (!user || user.role !== 'pod_lead') {
        toast.error('Only pod leads can save consensus annotations');
        return false;
      }
      
      // Call API to save consensus annotation
      const newConsensusAnnotation = await api.consensus.save(consensusAnnotation);
      
      if (!newConsensusAnnotation) {
        throw new Error('Failed to save consensus annotation');
      }
      
      // Update local state with the new consensus annotation
      setConsensusAnnotations(prev => {
        const existingIndex = prev.findIndex(
          a => a.discussionId === consensusAnnotation.discussionId && a.taskId === consensusAnnotation.taskId
        );
        
        if (existingIndex !== -1) {
          const updated = [...prev];
          updated[existingIndex] = newConsensusAnnotation;
          return updated;
        } else {
          return [...prev, newConsensusAnnotation];
        }
      });
      
      toast.success('Consensus annotation saved successfully');
      return true;
    } catch (err) {
      const errorMessage = (err as ApiError).message || 'Failed to save consensus annotation';
      toast.error(errorMessage);
      return false;
    } finally {
      setLoading(false);
    }
  }, [user]);

  // Get all annotations for a discussion
  const getDiscussionAnnotations = useCallback((discussionId: string) => {
    if (!discussionId) return [];
    return annotations.filter(a => a.discussionId === discussionId);
  }, [annotations]);

  // Get consensus annotation for a discussion task
  const getConsensusAnnotation = useCallback((discussionId: string, taskId: number) => {
    if (!discussionId) return null;
    return consensusAnnotations.find(
      a => a.discussionId === discussionId && a.taskId === taskId
    );
  }, [consensusAnnotations]);

  // Filter discussions by their status
  const getDiscussionsByStatus = useCallback((status: TaskStatus) => {
    return discussions.filter(d => {
      if (!d || !d.tasks) return false;
      
      if (status === 'completed') {
        return d.tasks.task1?.status === 'completed' && 
               d.tasks.task2?.status === 'completed' && 
               d.tasks.task3?.status === 'completed';
      } else if (status === 'unlocked') {
        return d.tasks.task1?.status === 'unlocked' || 
               d.tasks.task2?.status === 'unlocked' || 
               d.tasks.task3?.status === 'unlocked';
      } else {
        return d.tasks.task1?.status === 'locked' && 
               d.tasks.task2?.status === 'locked' && 
               d.tasks.task3?.status === 'locked';
      }
    });
  }, [discussions]);

  return {
    discussions,
    annotations,
    consensusAnnotations,
    loading,
    error,
    getAnnotationsForTask,
    getUserAnnotationStatus,
    getUserAnnotation,
    saveAnnotation,
    calculateConsensus,
    saveConsensusAnnotation,
    getDiscussionAnnotations,
    getConsensusAnnotation,
    getDiscussionsByStatus
  };
}
