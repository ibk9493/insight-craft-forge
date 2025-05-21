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
    const fetchAnnotationsForSpecificDiscussion = async () => {
      const specificDiscussionId = "marimo-team_marimo_3256"; // HARDCODED for testing
      try {
        setLoading(true);
        console.log(`[Debug] Fetching annotations ONLY for discussion: ${specificDiscussionId}`);
        
        const fetchedAnnotations = await api.annotations.getByDiscussionId(specificDiscussionId);
        
        if (fetchedAnnotations) {
          console.log(`[Debug] Fetched ${fetchedAnnotations.length} annotations for ${specificDiscussionId}:`, JSON.stringify(fetchedAnnotations, null, 2));
          
          const validAnnotations = fetchedAnnotations.filter(a => 
            a && a.discussion_id && a.user_id && a.task_id !== undefined
          );

          if (validAnnotations.length !== fetchedAnnotations.length) {
            console.warn(`[Debug] Filtered out ${fetchedAnnotations.length - validAnnotations.length} invalid annotations from specific fetch.`);
          }
          setAnnotations(validAnnotations);
        } else {
          console.warn(`[Debug] No annotations returned from API for specific discussion ${specificDiscussionId}`);
          setAnnotations([]);
        }
        setAnnotationsLoaded(true);
        setError(null);
      } catch (err) {
        const errorMessage = (err as ApiError).message || `Failed to fetch annotations for ${specificDiscussionId}`;
        console.error(`[Debug] Error fetching annotations for ${specificDiscussionId}:`, errorMessage);
        toast.error(errorMessage);
        setAnnotations([]); // Set empty on error
      } finally {
        setLoading(false);
      }
    };

    // We run this test fetch if discussions have loaded (or skip that check for direct test)
    // For this test, let's run it directly if you have at least one discussion or want to force it.
    // If your `discussions` state might be empty initially, you might need to ensure `api.annotations.getByDiscussionId` can be called.
    // For now, assuming it's okay to call, or that `discussions` will eventually populate.
    // Let's tie it to discussions.length > 0 for safety, or remove this condition if testing independently.
    if (discussions.length > 0) { // Or simply call `fetchAnnotationsForSpecificDiscussion()` if you want to test it without waiting for all discussions to load.
        fetchAnnotationsForSpecificDiscussion();
    } else if (discussions.length === 0 && !loading) { // If discussions is empty and we are not loading discussions already
        // This case might indicate that we want to fetch for a specific ID even if the main discussion list is empty or hasn't loaded
        // For this debug, let's assume if discussions array is empty, we still try to fetch for the specific ID once after initial discussion load attempt. 
        // This logic might need refinement based on how your app initializes.
        // Consider if this should run once unconditionally for the test.
        console.log("[Debug] Discussions array is empty, attempting test fetch for specific ID anyway after initial load cycle.");
        // To ensure it runs after the initial discussion fetch attempt (even if it yields empty), 
        // a more robust way might involve a separate flag or a small timeout, but let's try this first.
        // fetchAnnotationsForSpecificDiscussion(); // Potentially call here if you want it to run even if discussions array remains empty. 
                                              // For now, the `if (discussions.length > 0)` handles it after discussions are populated.
        // If `discussions.length > 0` is too restrictive for testing, you can call fetchAnnotationsForSpecificDiscussion() unconditionally once.
        // Example: Call it once using a flag that's set after the first run. 
    }

    // Original fetch logic commented out for this test:
    /*
    const fetchAnnotations = async () => {
      try {
        if (discussions.length === 0) {
          setAnnotations([]);
          return;
        }
        
        setLoading(true);
        console.log('Fetching annotations for discussions...');
        
        const promises = discussions.map(discussion => 
          api.annotations.getByDiscussionId(discussion.id)
        );
        
        const results = await Promise.allSettled(promises);
        
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
        toast.error(`Failed to fetch some annotations. User status might be incomplete.`);
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
    */
  }, [discussions]); // MODIFIED: Removed loading from dependency array to prevent infinite loop

  // Enhanced getUserAnnotationStatus function with better error handling
  const getUserAnnotationStatus = useCallback((discussionId: string, userId: string): UserAnnotationStatus => {
    if (!discussionId || !userId) {
      return { task1: false, task2: false, task3: false };
    }
    
    try {
      // Get the specific discussion by ID
      const discussion = discussions.find(d => d.id === discussionId);
      
      if (!discussion) {
        console.warn(`Discussion ${discussionId} not found in discussions array`);
        return { task1: false, task2: false, task3: false };
      }
      
      // Check if discussion has the annotations property with the expected structure
      if (!discussion.annotations) {
        console.warn(`Discussion ${discussionId} has no annotations property`);
        return { task1: false, task2: false, task3: false };
      }
      
      // Convert user ID to string for consistent comparison
      const userIdStr = userId.toString();
      
      // Check task1_annotations array
      const hasTask1 = Array.isArray(discussion.annotations.task1_annotations) && 
                      discussion.annotations.task1_annotations.some(a => 
                        a.user_id?.toString() === userIdStr
                      );
      
      // Check task2_annotations array
      const hasTask2 = Array.isArray(discussion.annotations.task2_annotations) && 
                      discussion.annotations.task2_annotations.some(a => 
                        a.user_id?.toString() === userIdStr
                      );
      
      // Check task3_annotations array
      const hasTask3 = Array.isArray(discussion.annotations.task3_annotations) && 
                      discussion.annotations.task3_annotations.some(a => 
                        a.user_id?.toString() === userIdStr
                      );
      
      // Log what we found for debugging
      console.log(`User annotation check for discussion ${discussionId}, user ${userId}:`, {
        task1: hasTask1,
        task2: hasTask2,
        task3: hasTask3,
        task1_annotations_count: discussion.annotations.task1_annotations?.length || 0,
        task2_annotations_count: discussion.annotations.task2_annotations?.length || 0,
        task3_annotations_count: discussion.annotations.task3_annotations?.length || 0
      });
      
      return {
        task1: hasTask1 === true,
        task2: hasTask2 === true,
        task3: hasTask3 === true
      };
    } catch (error) {
      console.error(`Error checking user annotations for discussion ${discussionId}:`, error);
      return { task1: false, task2: false, task3: false };
    }
  }, [discussions]);

  // Get user's annotation for a specific discussion and task
const getUserAnnotation = useCallback((discussionId: string, userId: string, taskId: number) => {
  if (!discussionId || !userId) {
    console.log('[useAnnotationData] getUserAnnotation: Aborted due to missing discussionId or userId. Provided:', { discussionId, userId });
    return null;
  }
  
  console.log('[useAnnotationData] getUserAnnotation: Attempting to find annotation with:', { discussionId, userId, taskId });
  
  // Find the specific discussion first
  const discussion = discussions.find(d => d.id === discussionId);
  
  if (!discussion) {
    console.log('[useAnnotationData] getUserAnnotation: Discussion not found:', discussionId);
    return null;
  }
  
  if (!discussion.annotations) {
    console.log('[useAnnotationData] getUserAnnotation: Discussion has no annotations property:', discussionId);
    return null;
  }
  
  // Map task ID to the corresponding annotations array
  let relevantAnnotations: any[] = [];
  if (taskId === 1 && Array.isArray(discussion.annotations.task1_annotations)) {
    relevantAnnotations = discussion.annotations.task1_annotations;
    console.log('[useAnnotationData] getUserAnnotation: Found task1_annotations array with', relevantAnnotations.length, 'items');
  } else if (taskId === 2 && Array.isArray(discussion.annotations.task2_annotations)) {
    relevantAnnotations = discussion.annotations.task2_annotations;
    console.log('[useAnnotationData] getUserAnnotation: Found task2_annotations array with', relevantAnnotations.length, 'items');
  } else if (taskId === 3 && Array.isArray(discussion.annotations.task3_annotations)) {
    relevantAnnotations = discussion.annotations.task3_annotations;
    console.log('[useAnnotationData] getUserAnnotation: Found task3_annotations array with', relevantAnnotations.length, 'items');
  } else {
    console.log('[useAnnotationData] getUserAnnotation: No annotations array found for task', taskId);
    return null;
  }
  
  // Log the first few annotations for debugging
  if (relevantAnnotations.length > 0) {
    console.log('[useAnnotationData] getUserAnnotation: First few annotations in array:', 
      relevantAnnotations.slice(0, 3).map(a => ({
        discussion_id: a.discussion_id, 
        user_id: a.user_id, 
        task_id: a.task_id, 
        dataKeys: Object.keys(a.data || {})
      }))
    );
  }
  
  // Find the specific annotation for this user
  const userIdStr = String(userId);
  const foundAnnotation = relevantAnnotations.find(a => String(a.user_id) === userIdStr);
  
  if (!foundAnnotation) {
    console.log('[useAnnotationData] getUserAnnotation: Annotation NOT FOUND for user:', userIdStr);
    
    // For debugging, log all user IDs in the relevant annotations array
    if (relevantAnnotations.length > 0) {
      console.log('[useAnnotationData] getUserAnnotation: Available user IDs in this task:', 
        relevantAnnotations.map(a => String(a.user_id))
      );
    }
    
    // Check if the user has annotations for other tasks
    let hasOtherTaskAnnotations = false;
    
    if (taskId !== 1 && Array.isArray(discussion.annotations.task1_annotations)) {
      const task1Anno = discussion.annotations.task1_annotations.find(a => String(a.user_id) === userIdStr);
      if (task1Anno) {
        console.log('[useAnnotationData] getUserAnnotation: User has an annotation for task 1');
        hasOtherTaskAnnotations = true;
      }
    }
    
    if (taskId !== 2 && Array.isArray(discussion.annotations.task2_annotations)) {
      const task2Anno = discussion.annotations.task2_annotations.find(a => String(a.user_id) === userIdStr);
      if (task2Anno) {
        console.log('[useAnnotationData] getUserAnnotation: User has an annotation for task 2');
        hasOtherTaskAnnotations = true;
      }
    }
    
    if (taskId !== 3 && Array.isArray(discussion.annotations.task3_annotations)) {
      const task3Anno = discussion.annotations.task3_annotations.find(a => String(a.user_id) === userIdStr);
      if (task3Anno) {
        console.log('[useAnnotationData] getUserAnnotation: User has an annotation for task 3');
        hasOtherTaskAnnotations = true;
      }
    }
    
    if (!hasOtherTaskAnnotations) {
      console.log('[useAnnotationData] getUserAnnotation: User has no annotations for ANY task in this discussion');
    }
  } else {
    console.log('[useAnnotationData] getUserAnnotation: Annotation FOUND:', JSON.stringify(foundAnnotation, null, 2));
  }
  
  return foundAnnotation;
}, [discussions]);

// Save an annotation with proper type signature to return a Promise
  const saveAnnotation = useCallback(async (annotation: Omit<Annotation, 'timestamp'>): Promise<boolean> => {
    try {
      if (!annotation.discussion_id || !annotation.user_id) { 
        console.error('[useAnnotationData.saveAnnotation] Missing discussion_id or user_id in annotation object:', annotation);
        return false;
      }
      
      setLoading(true);
      
      // Call API to save annotation
      const newSavedAnnotation = await api.annotations.save(annotation);
      
      if (!newSavedAnnotation) {
        throw new Error('Failed to save annotation');
      }
      
      // Update local state with the new annotation
      setAnnotations(prev => {
        const existingIndex = prev.findIndex(
          a => a.discussion_id === annotation.discussion_id && 
              a.user_id === annotation.user_id && 
              a.task_id === annotation.task_id
        );
        
        // Construct the annotation for local state.
        // Prioritize the data that was sent for saving, but merge with metadata (like id, timestamp)
        // that the API provides in its response.
        const finalAnnotationForState: Annotation = {
            ...newSavedAnnotation, // Start with everything from API response (id, timestamp, potentially partial/different data)
            // Ensure the core identifiers and the critical 'data' payload are from the user's input:
            discussion_id: annotation.discussion_id,
            user_id: annotation.user_id,
            task_id: annotation.task_id,
            data: annotation.data, // This ensures the data payload sent by the client is used in the local state.
        };
        
        if (existingIndex !== -1) {
          const updated = [...prev];
          updated[existingIndex] = finalAnnotationForState;
          return updated;
        } else {
          return [...prev, finalAnnotationForState];
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
  }, [annotations]);

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
      // Ensure that the user is a pod lead to save consensus
      if (!user || user.role !== 'pod_lead') {
        toast.error('Only pod leads can save consensus annotations');
        return false;
      }
      
      // Check if discussion_id is present
      if (!consensusAnnotation.discussion_id) {
        toast.error('Discussion ID is missing in consensus data');
        return false;
      }
      
      setLoading(true);
      
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
  }, [user, consensusAnnotations]);

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