
// This is a new file that we'll create to fix the annotation loading issue
import { useState } from 'react';
import { SubTask, SubTaskStatus } from '@/components/dashboard/TaskCard';
import { Annotation } from '@/services/api';
import { toast } from 'sonner';
import { User } from '@/contexts/UserContext'; // Import User from UserContext instead of api

interface AnnotationHandlersProps {
  task1SubTasks: SubTask[];
  task2SubTasks: SubTask[];
  task3SubTasks: SubTask[];
  consensusTask1: SubTask[];
  consensusTask2: SubTask[];
  consensusTask3: SubTask[];
  user: User | null;
  saveAnnotation: (annotation: Omit<Annotation, 'timestamp'>) => Promise<boolean>;
  saveConsensusAnnotation: (annotation: Omit<Annotation, 'timestamp'>) => Promise<boolean>;
  getUserAnnotation: (discussionId: string, userId: string, taskId: number) => Annotation | undefined;
  getAnnotationsForTask: (discussionId: string, taskId: number) => Annotation[];
  getConsensusAnnotation: (discussionId: string, taskId: number) => Annotation | undefined;
  updateStepCompletionStatus: (stepIndex: number, completed: boolean) => void;
  overrideAnnotation?: (podLeadId: string, annotatorId: string, discussionId: string, taskId: number, data: Record<string, string | boolean>) => Promise<boolean>;
}

export function useAnnotationHandlers({
  task1SubTasks,
  task2SubTasks,
  task3SubTasks,
  consensusTask1,
  consensusTask2,
  consensusTask3,
  user,
  saveAnnotation,
  saveConsensusAnnotation,
  getUserAnnotation,
  getAnnotationsForTask,
  getConsensusAnnotation,
  updateStepCompletionStatus,
  overrideAnnotation
}: AnnotationHandlersProps) {
  const [loading, setLoading] = useState(false);

  // Load user's annotation for a specific task
  const loadUserAnnotation = (discussionId: string, taskId: number): SubTask[] | null => {
    if (!user) return null;

    try {
      const annotation = getUserAnnotation(discussionId, user.id, taskId);
      
      if (!annotation) return null;
      
      // Create a deep copy of the tasks based on which task we're loading
      let tasksCopy: SubTask[] = [];
      if (taskId === 1) {
        tasksCopy = JSON.parse(JSON.stringify(task1SubTasks));
      } else if (taskId === 2) {
        tasksCopy = JSON.parse(JSON.stringify(task2SubTasks));
      } else if (taskId === 3) {
        tasksCopy = JSON.parse(JSON.stringify(task3SubTasks));
      }
      
      // Map the saved data back to the form fields
      // Ensure we're returning properly typed SubTask[] objects
      return tasksCopy.map(task => {
        const savedValue = annotation.data[task.id];
        const savedTextValue = annotation.data[`${task.id}_text`];
        
        if (savedValue !== undefined) {
          if (typeof savedValue === 'boolean') {
            return {
              ...task,
              selectedOption: savedValue ? 'True' : 'False', // Convert boolean to string option
              textValue: typeof savedTextValue === 'string' ? savedTextValue : (task.textValue || '') // Ensure textValue is string
            };
          } else if (typeof savedValue === 'string') {
            return {
              ...task,
              selectedOption: savedValue,
              textValue: typeof savedTextValue === 'string' ? savedTextValue : (task.textValue || '')
            };
          }
        }
        return task;
      });
    } catch (error) {
      console.error('Failed to load annotation:', error);
      toast.error('Failed to load your annotation');
      return null;
    }
  };

  // Load specific annotator's annotation (for pod leads to view/edit)
  const loadAnnotatorAnnotation = (discussionId: string, annotatorId: string, taskId: number): SubTask[] | null => {
    try {
      const annotation = getUserAnnotation(discussionId, annotatorId, taskId);
      
      if (!annotation) return null;
      
      // Create a deep copy of the tasks based on which task we're loading
      let tasksCopy: SubTask[] = [];
      if (taskId === 1) {
        tasksCopy = JSON.parse(JSON.stringify(task1SubTasks));
      } else if (taskId === 2) {
        tasksCopy = JSON.parse(JSON.stringify(task2SubTasks));
      } else if (taskId === 3) {
        tasksCopy = JSON.parse(JSON.stringify(task3SubTasks));
      }
      
      // Map the saved data back to the form fields
      return tasksCopy.map(task => {
        const savedValue = annotation.data[task.id];
        const savedTextValue = annotation.data[`${task.id}_text`];
        
        if (savedValue !== undefined) {
          if (typeof savedValue === 'boolean') {
            return {
              ...task,
              selectedOption: savedValue ? 'True' : 'False',
              textValue: typeof savedTextValue === 'string' ? savedTextValue : (task.textValue || '')
            };
          } else if (typeof savedValue === 'string') {
            return {
              ...task,
              selectedOption: savedValue,
              textValue: typeof savedTextValue === 'string' ? savedTextValue : (task.textValue || '')
            };
          }
        }
        return task;
      });
    } catch (error) {
      console.error('Failed to load annotator annotation:', error);
      toast.error('Failed to load annotator annotation');
      return null;
    }
  };

  // Prepare consensus view based on annotations
  const prepareConsensusView = (discussionId: string, taskId: number): SubTask[] | null => {
    try {
      // First check if there's already a consensus annotation
      const consensusAnnotation = getConsensusAnnotation(discussionId, taskId);
      
      // Initialize with empty consensus tasks based on taskId
      let consensusTasks: SubTask[] = [];
      if (taskId === 1) {
        consensusTasks = JSON.parse(JSON.stringify(task1SubTasks));
      } else if (taskId === 2) {
        consensusTasks = JSON.parse(JSON.stringify(task2SubTasks));
      } else if (taskId === 3) {
        consensusTasks = JSON.parse(JSON.stringify(task3SubTasks));
      }
      
      // If we have an existing consensus annotation, use it
      if (consensusAnnotation) {
        // Ensure we're returning properly typed SubTask[] objects
        return consensusTasks.map(task => {
          const savedValue = consensusAnnotation.data[task.id];
          const savedTextValue = consensusAnnotation.data[`${task.id}_text`];
          
          if (savedValue !== undefined) {
            if (typeof savedValue === 'boolean') {
              return {
                ...task,
                selectedOption: savedValue ? 'True' : 'False', // Convert boolean to string option
                textValue: typeof savedTextValue === 'string' ? savedTextValue : (task.textValue || '') // Ensure textValue is string
              };
            } else if (typeof savedValue === 'string') {
              return {
                ...task,
                selectedOption: savedValue,
                textValue: typeof savedTextValue === 'string' ? savedTextValue : (task.textValue || '')
              };
            }
          }
          return task;
        });
      }
      
      // If no consensus exists yet, populate with annotator data
      const annotations = getAnnotationsForTask(discussionId, taskId);
      
      if (!annotations || annotations.length === 0) {
        return consensusTasks;
      }
      
      // Convert all annotations to form fields format and count occurrences
      const fieldCounts: Record<string, Record<string, number>> = {};
      const textValues: Record<string, string[]> = {};
      
      annotations.forEach(annotation => {
        Object.entries(annotation.data).forEach(([key, value]) => {
          // Skip text fields, we'll handle them separately
          if (key.endsWith('_text')) {
            const baseKey = key.replace('_text', '');
            if (!textValues[baseKey]) {
              textValues[baseKey] = [];
            }
            if (typeof value === 'string' && value.trim() !== '') {
              textValues[baseKey].push(value);
            }
            return;
          }
          
          if (!fieldCounts[key]) {
            fieldCounts[key] = {};
          }
          
          // Convert boolean values to strings to match our options format
          let stringValue: string;
          if (typeof value === 'boolean') {
            stringValue = value ? 'True' : 'False';
          } else {
            stringValue = String(value);
          }
          
          if (!fieldCounts[key][stringValue]) {
            fieldCounts[key][stringValue] = 0;
          }
          
          fieldCounts[key][stringValue]++;
        });
      });
      
      // Find most common value for each field
      // Ensure we're returning properly typed SubTask[] objects
      return consensusTasks.map(task => {
        const counts = fieldCounts[task.id];
        if (!counts) return task;
        
        let maxCount = 0;
        let mostCommonValue: string = '';
        
        Object.entries(counts).forEach(([value, count]) => {
          if (count > maxCount) {
            maxCount = count;
            mostCommonValue = value;
          }
        });
        
        // If we found a most common value
        if (mostCommonValue) {
          // Use the first non-empty text value for this field
          const textFieldValues = textValues[task.id] || [];
          const textValue = textFieldValues.length > 0 ? textFieldValues[0] : '';
          
          return {
            ...task,
            selectedOption: mostCommonValue,
            textValue,
            status: 'completed' as SubTaskStatus
          };
        }
        
        return task;
      });
    } catch (error) {
      console.error('Failed to prepare consensus view:', error);
      toast.error('Failed to prepare consensus view');
      return null;
    }
  };

  // Save annotation or consensus
  const handleSaveAnnotation = async (
    discussionId: string | null, 
    taskId: number, 
    viewMode: 'grid' | 'detail' | 'consensus',
    uploadedImage: string | null,
    codeDownloadUrl: string | null,
    onComplete: () => void
  ) => {
    if (!discussionId || !user) {
      toast.error('Missing discussion ID or user information');
      return;
    }
    
    try {
      setLoading(true);
      
      // Prepare data based on current task and mode
      let taskData: Record<string, any> = {};
      let currentTasks: SubTask[] = [];
      
      if (viewMode === 'detail') {
        // Regular annotation
        switch (taskId) {
          case 1:
            currentTasks = task1SubTasks;
            break;
          case 2:
            currentTasks = task2SubTasks;
            // Add screenshot and code download URL for task 2
            if (uploadedImage) {
              taskData.screenshot = uploadedImage;
            }
            if (codeDownloadUrl) {
              taskData.codeDownloadUrl = codeDownloadUrl;
            }
            break;
          case 3:
            currentTasks = task3SubTasks;
            break;
          default:
            toast.error('Invalid task ID');
            return;
        }
        
        // Convert form data to API format
        currentTasks.forEach(task => {
          if (task.selectedOption) {
            // Convert string options to actual boolean for boolean fields if needed
            if (task.selectedOption === 'True' || task.selectedOption === 'False' ||
                task.selectedOption === 'Yes' || task.selectedOption === 'No') {
              taskData[task.id] = (task.selectedOption === 'True' || task.selectedOption === 'Yes');
            } else {
              taskData[task.id] = task.selectedOption;
            }
            
            // Add text value if present
            if (task.textValue) {
              taskData[`${task.id}_text`] = task.textValue;
            }
          }
        });
        
        // Save annotation
        const success = await saveAnnotation({
          userId: user.id,
          discussionId,
          taskId,
          data: taskData
        });
        
        if (success) {
          updateStepCompletionStatus(taskId, true);
          toast.success('Annotation saved successfully');
          onComplete();
        }
      } else if (viewMode === 'consensus') {
        // Consensus annotation
        if (!isPodLead(user)) {
          toast.error('Only pod leads can save consensus annotations');
          return;
        }
        
        switch (taskId) {
          case 1:
            currentTasks = consensusTask1;
            break;
          case 2:
            currentTasks = consensusTask2;
            break;
          case 3:
            currentTasks = consensusTask3;
            break;
          default:
            toast.error('Invalid task ID');
            return;
        }
        
        // Convert form data to API format
        currentTasks.forEach(task => {
          if (task.selectedOption) {
            // Convert string options to actual boolean for boolean fields if needed
            if (task.selectedOption === 'True' || task.selectedOption === 'False' ||
                task.selectedOption === 'Yes' || task.selectedOption === 'No') {
              taskData[task.id] = (task.selectedOption === 'True' || task.selectedOption === 'Yes');
            } else {
              taskData[task.id] = task.selectedOption;
            }
            
            // Add text value if present
            if (task.textValue) {
              taskData[`${task.id}_text`] = task.textValue;
            }
          }
        });
        
        // Save consensus annotation
        const success = await saveConsensusAnnotation({
          userId: user.id,
          discussionId,
          taskId,
          data: taskData
        });
        
        if (success) {
          updateStepCompletionStatus(taskId, true);
          toast.success('Consensus saved successfully');
          onComplete();
        }
      }
    } catch (error) {
      console.error('Failed to save annotation:', error);
      toast.error('Failed to save annotation');
    } finally {
      setLoading(false);
    }
  };
  
  // New function to handle pod lead overriding an annotator's annotation
  const handleOverrideAnnotation = async (
    discussionId: string | null,
    annotatorId: string,
    taskId: number,
    subTasks: SubTask[],
    onComplete: () => void
  ) => {
    if (!discussionId || !user || !isPodLead(user) || !overrideAnnotation) {
      toast.error(isPodLead(user) ? 'Missing information' : 'Only pod leads can override annotations');
      return;
    }
    
    try {
      setLoading(true);
      
      // Prepare data based on current task
      let taskData: Record<string, any> = {};
      
      // Convert form data to API format
      subTasks.forEach(task => {
        if (task.selectedOption) {
          // Convert string options to actual boolean for boolean fields if needed
          if (task.selectedOption === 'True' || task.selectedOption === 'False' ||
              task.selectedOption === 'Yes' || task.selectedOption === 'No') {
            taskData[task.id] = (task.selectedOption === 'True' || task.selectedOption === 'Yes');
          } else {
            taskData[task.id] = task.selectedOption;
          }
          
          // Add text value if present
          if (task.textValue) {
            taskData[`${task.id}_text`] = task.textValue;
          }
        }
      });
      
      // Add override metadata
      taskData._overridden_by_pod_lead = true;
      taskData._override_timestamp = new Date().toISOString();
      
      // Save override
      const success = await overrideAnnotation(
        user.id,
        annotatorId,
        discussionId,
        taskId,
        taskData
      );
      
      if (success) {
        toast.success(`Successfully overrode annotator's submission`);
        onComplete();
      }
    } catch (error) {
      console.error('Failed to override annotation:', error);
      toast.error('Failed to override annotation');
    } finally {
      setLoading(false);
    }
  };
  
  // Helper function to check if user is pod lead
  const isPodLead = (user: User): boolean => {
    return user.role === 'pod_lead';
  };

  return {
    loadUserAnnotation,
    loadAnnotatorAnnotation,
    prepareConsensusView,
    handleSaveAnnotation,
    handleOverrideAnnotation,
    loading
  };
}
