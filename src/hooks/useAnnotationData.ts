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
  const [annotationsLoaded, setAnnotationsLoaded] = useState<boolean>(false);

  // Fetch discussions
  useEffect(() => {
    const fetchDiscussions = async () => {
      try {
        setLoading(true);
        const data = await api.discussions.getAll();
        
        if (data) {
          console.log(`Fetched ${data.length} discussions`);
          setDiscussions(data);
        } else {
          console.warn('No discussions data returned from API');
          setDiscussions([]);
        }
        
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

  // Fetch annotations - improved error handling and logging
  useEffect(() => {
    const fetchAnnotations = async () => {
      try {
        if (discussions.length === 0) {
          setAnnotations([]);
          return;
        }
        
        setLoading(true);
        console.log('Fetching annotations for discussions...');
        
        // In a real app, we might want to limit this to only relevant discussions
        const promises = discussions.map(discussion => 
          api.annotations.getByDiscussionId(discussion.id)
        );
        
        const results = await Promise.allSettled(promises);
        
        // Log any failed annotation fetches
        results.forEach((result, index) => {
          if (result.status === 'rejected') {
            console.error(`Failed to fetch annotations for discussion ${discussions[index].id}:`, result.reason);
          }
        });
        
        const data = results
          .filter((result): result is PromiseFulfilledResult<Annotation[]> => 
            result.status === 'fulfilled'
          )
          .flatMap(result => result.value || []);
        
        console.log(`Successfully fetched ${data.length} annotations across ${discussions.length} discussions`);
        
        // Filter out any invalid annotation data
        const validAnnotations = data.filter(a => 
          a && a.discussion_id && a.user_id && a.task_id !== undefined
        );
        
        if (validAnnotations.length !== data.length) {
          console.warn(`Filtered out ${data.length - validAnnotations.length} invalid annotations`);
        }
        
        setAnnotations(validAnnotations);
        setAnnotationsLoaded(true);
        setError(null);
      } catch (err) {
        const errorMessage = (err as ApiError).message || 'Failed to fetch annotations';
        console.error('Error fetching annotations:', errorMessage);
        // Don't set error state here to prevent blocking the UI on annotation errors
        // Just display a toast message
        toast.error(`Failed to fetch some annotations. User status might be incomplete.`);
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

  // Enhanced getUserAnnotationStatus function with better error handling
  const getUserAnnotationStatus = useCallback((discussionId: string, userId: string): UserAnnotationStatus => {
    if (!discussionId || !userId) {
      return { task1: false, task2: false, task3: false };
    }
    
    try {
      // Filter annotations for this discussion and user
      const userAnnotationsForDiscussion = annotations.filter(a => 
        a.discussion_id === discussionId && a.user_id === userId
      );
      
      // Log for debugging if we found any annotations
      if (userAnnotationsForDiscussion.length > 0) {
        console.log(`Found ${userAnnotationsForDiscussion.length} annotations for user ${userId} in discussion ${discussionId}`);
      }
      
      // Create a status object with strict boolean values
      const status = {
        task1: userAnnotationsForDiscussion.some(a => a.task_id === 1) === true,
        task2: userAnnotationsForDiscussion.some(a => a.task_id === 2) === true,
        task3: userAnnotationsForDiscussion.some(a => a.task_id === 3) === true,
      };
      
      return status;
    } catch (error) {
      console.error('Error in getUserAnnotationStatus:', error);
      // Return all false on error
      return { task1: false, task2: false, task3: false };
    }
  }, [annotations]);

  // Get user's annotation for a specific discussion and task
  const getUserAnnotation = useCallback((discussionId: string, userId: string, taskId: number) => {
    if (!discussionId || !userId) {
      console.log('[useAnnotationData] getUserAnnotation: Aborted due to missing discussionId or userId. Provided:', { discussionId, userId });
      return null;
    }
    
    console.log('[useAnnotationData] getUserAnnotation: Attempting to find annotation with:', { discussionId, userId, taskId });
    console.log('[useAnnotationData] getUserAnnotation: Full annotations array before find (first 5 items):', annotations.slice(0, 5).map(a => ({discussion_id: a.discussion_id, user_id: a.user_id, task_id: a.task_id, dataKeys: Object.keys(a.data)})));
    console.log('[useAnnotationData] getUserAnnotation: Total annotations in array:', annotations.length);

    const foundAnnotation = annotations.find(
      a => {
        const discussionMatch = a.discussion_id === discussionId;
        const userMatch = String(a.user_id) === String(userId); // Compare as strings for safety
        const taskMatch = a.task_id === taskId;

        // Log comparison for the specific item if it's the one we're interested in
        if (discussionId === "marimo-team_marimo_3256" && String(userId) === "7" && taskId === 1) {
          // console.log('[useAnnotationData] getUserAnnotation - COMPARING ITEM:', a, 'WITH PARAMS:', { discussionId, userId, taskId });
          // console.log('[useAnnotationData] getUserAnnotation - MATCHES:', { discussionMatch, userMatch, taskMatch });
        }
        return discussionMatch && userMatch && taskMatch;
      }
    );

    if (!foundAnnotation) {
      console.log('[useAnnotationData] getUserAnnotation: Annotation NOT FOUND. Searched with:', { discussionId, userId, taskId });
      // For debugging, let's see if an annotation for this discussion & user exists AT ALL (ignoring task_id)
      const anyAnnotationForUserAndDiscussion = annotations.find(
        a => a.discussion_id === discussionId && String(a.user_id) === String(userId)
      );
      if (anyAnnotationForUserAndDiscussion) {
        console.log('[useAnnotationData] getUserAnnotation: Found an annotation for this discussion & user, but task_id did not match. Found task_id:', anyAnnotationForUserAndDiscussion.task_id, 'Expected task_id:', taskId);
      } else {
        console.log('[useAnnotationData] getUserAnnotation: No annotations found for this discussion & user combination AT ALL.');
      }
    } else {
      console.log('[useAnnotationData] getUserAnnotation: Annotation FOUND:', JSON.stringify(foundAnnotation, null, 2));
    }
    
    return foundAnnotation;
  }, [annotations]);

  // Save an annotation with proper type signature to return a Promise
  const saveAnnotation = useCallback(async (annotation: Omit<Annotation, 'timestamp'>): Promise<boolean> => {
    try {
      if (!annotation.discussion_id || !annotation.user_id) { 
        console.error('[useAnnotationData.saveAnnotation] Missing discussion_id or user_id in annotation object:', annotation);
        return false;
      }
      
      setLoading(true);
      
      // Call API to save annotation
      const newAnnotation = await api.annotations.save(annotation);
      
      if (!newAnnotation) {
        throw new Error('Failed to save annotation');
      }
      
      // Update local state with the new annotation
      setAnnotations(prev => {
        const existingIndex = prev.findIndex(
          a => a.discussion_id === annotation.discussion_id && 
              a.user_id === annotation.user_id && 
              a.task_id === annotation.task_id
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
        const updatedDiscussion = await api.discussions.getById(annotation.discussion_id);
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
      console.error('[useAnnotationData.saveAnnotation] Error saving annotation:', err);
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
      if (!consensusAnnotation.discussion_id || !user || user.role !== 'pod_lead') {
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
          a => a.discussion_id === consensusAnnotation.discussion_id && a.task_id === consensusAnnotation.task_id
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
    
    const discussionAnnotations = annotations.filter(a => a.discussion_id === discussionId);
    return discussionAnnotations;
  }, [annotations]);

  // Get consensus annotation for a discussion task
  const getConsensusAnnotation = useCallback((discussionId: string, taskId: number) => {
    if (!discussionId) return null;
    return consensusAnnotations.find(
      a => a.discussion_id === discussionId && a.task_id === taskId
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
    annotationsLoaded,
    getAnnotationsForTask: useCallback((discussionId, taskId) => {
      return annotations.filter(a => a.discussion_id === discussionId && a.task_id === taskId);
    }, [annotations]),
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