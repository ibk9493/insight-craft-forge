
import { useState, useEffect, useCallback } from 'react';
import { useUser } from '@/contexts/UserContext';
import { api, useMockApi, mockData, Discussion, Annotation, ApiError } from '@/services/api';
import { toast } from 'sonner';

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
        let data: Discussion[];
        
        if (useMockApi) {
          // Use mock data when API_URL is not available
          data = [...mockData.discussions];
        } else {
          data = await api.discussions.getAll();
        }
        
        setDiscussions(data);
        setError(null);
      } catch (err) {
        const errorMessage = (err as ApiError).message || 'Failed to fetch discussions';
        setError(errorMessage);
        toast.error(errorMessage);
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
        setLoading(true);
        let data: Annotation[];
        
        if (useMockApi) {
          // Use mock data when API_URL is not available
          data = [...mockData.annotations];
        } else {
          // In a real app, we might want to limit this to only relevant discussions
          // For simplicity, we're fetching all annotations for now
          const promises = discussions.map(discussion => 
            api.annotations.getByDiscussionId(discussion.id)
          );
          
          const results = await Promise.allSettled(promises);
          data = results
            .filter((result): result is PromiseFulfilledResult<Annotation[]> => 
              result.status === 'fulfilled'
            )
            .flatMap(result => result.value);
        }
        
        setAnnotations(data);
        setError(null);
      } catch (err) {
        const errorMessage = (err as ApiError).message || 'Failed to fetch annotations';
        setError(errorMessage);
        toast.error(errorMessage);
      } finally {
        setLoading(false);
      }
    };

    if (discussions.length > 0) {
      fetchAnnotations();
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
  const saveAnnotation = useCallback(async (annotation: Omit<Annotation, 'timestamp'>) => {
    try {
      setLoading(true);
      let newAnnotation: Annotation;
      
      if (useMockApi) {
        newAnnotation = {
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
          await updateDiscussionStatus(annotation.discussionId, annotation.taskId);
        }
      } else {
        newAnnotation = await api.annotations.save(annotation);
        
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
          setDiscussions(prev => 
            prev.map(d => d.id === updatedDiscussion.id ? updatedDiscussion : d)
          );
        } catch (err) {
          console.error('Failed to fetch updated discussion status:', err);
        }
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
  }, [annotations]);

  // Update discussion status based on annotation counts
  const updateDiscussionStatus = useCallback(async (discussionId: string, taskId: number) => {
    try {
      if (useMockApi) {
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
      } else {
        // In a real application, the API would update the discussion status
        const updatedDiscussion = await api.discussions.getById(discussionId);
        setDiscussions(prev => 
          prev.map(d => d.id === updatedDiscussion.id ? updatedDiscussion : d)
        );
      }
    } catch (err) {
      const errorMessage = (err as ApiError).message || 'Failed to update discussion status';
      toast.error(errorMessage);
    }
  }, [discussions, getAnnotationsForTask]);

  // Calculate consensus for a discussion task
  const calculateConsensus = useCallback(async (discussionId: string, taskId: number) => {
    try {
      setLoading(true);
      
      let result: { result: string, agreement: boolean };
      
      if (useMockApi) {
        const taskAnnotations = getAnnotationsForTask(discussionId, taskId);
        const fields = new Set<string>();
        
        // Collect all fields from annotations
        taskAnnotations.forEach(annotation => {
          Object.keys(annotation.data).forEach(field => fields.add(field));
        });
        
        // Check agreement for each field
        let hasAgreement = true;
        
        for (const field of fields) {
          const valueCount: Record<string, number> = {};
          
          // Count occurrences of each value
          taskAnnotations.forEach(annotation => {
            const value = annotation.data[field] as string;
            if (value) {
              valueCount[value] = (valueCount[value] || 0) + 1;
            }
          });
          
          // Find the most common value
          let maxCount = 0;
          for (const count of Object.values(valueCount)) {
            if (count > maxCount) {
              maxCount = count;
            }
          }
          
          // Check if there's a majority (more than half)
          if (maxCount <= taskAnnotations.length / 2) {
            hasAgreement = false;
            break;
          }
        }
        
        result = {
          result: hasAgreement ? 'Agreement' : 'No Agreement',
          agreement: hasAgreement
        };
      } else {
        result = await api.consensus.calculate(discussionId, taskId);
      }
      
      return result;
    } catch (err) {
      const errorMessage = (err as ApiError).message || 'Failed to calculate consensus';
      toast.error(errorMessage);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [getAnnotationsForTask]);

  // Save consensus annotation by pod lead
  const saveConsensusAnnotation = useCallback(async (consensusAnnotation: Omit<Annotation, 'timestamp'>) => {
    try {
      setLoading(true);
      
      // Validate that this is coming from a pod lead
      if (!user || user.role !== 'pod_lead') {
        toast.error('Only pod leads can save consensus annotations');
        return false;
      }
      
      let newConsensusAnnotation: Annotation;
      
      if (useMockApi) {
        newConsensusAnnotation = {
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
      } else {
        newConsensusAnnotation = await api.consensus.save(consensusAnnotation);
        
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
      }
      
      toast.success('Consensus annotation saved successfully');
      return true;
    } catch (err) {
      const errorMessage = (err as ApiError).message || 'Failed to save consensus annotation';
      toast.error(errorMessage);
      return false;
    } finally {
      setLoading(false);
    }
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
