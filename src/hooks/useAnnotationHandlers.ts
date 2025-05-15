
import { useCallback } from 'react';
import { toast } from 'sonner';
import { SubTask } from '@/components/dashboard/TaskCard';

interface UseAnnotationHandlersProps {
  task1SubTasks: SubTask[];
  task2SubTasks: SubTask[];
  task3SubTasks: SubTask[];
  consensusTask1: SubTask[];
  consensusTask2: SubTask[];
  consensusTask3: SubTask[];
  user: any;
  saveAnnotation: Function;
  saveConsensusAnnotation: Function;
  getUserAnnotation: Function;
  getAnnotationsForTask: Function;
  getConsensusAnnotation: Function;
  updateStepCompletionStatus: (stepIndex: number, completed: boolean) => void;
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
  updateStepCompletionStatus
}: UseAnnotationHandlersProps) {

  // Load user's existing annotation if it exists
  const loadUserAnnotation = useCallback((discussionId: string, taskId: number) => {
    if (!user) return;
    
    const existingAnnotation = getUserAnnotation(discussionId, user.id, taskId);
    if (!existingAnnotation) return;
    
    // Map the annotation data to subtasks
    if (taskId === 1) {
      const updatedSubTasks = task1SubTasks.map(task => {
        const value = existingAnnotation.data[task.id];
        if (value !== undefined) {
          return {
            ...task,
            selectedOption: value as string,
            status: 'completed' as 'completed' | 'pending' | 'na'
          };
        }
        return task;
      });
      // We don't have access to setTask1SubTasks here, so we return the updated tasks
      return updatedSubTasks;
    }
    else if (taskId === 2) {
      const updatedSubTasks = task2SubTasks.map(task => {
        const value = existingAnnotation.data[task.id];
        if (value !== undefined) {
          return {
            ...task,
            selectedOption: value as string,
            textValue: task.textInput ? value as string : undefined,
            status: 'completed' as 'completed' | 'pending' | 'na'
          };
        }
        return task;
      });
      return updatedSubTasks;
    }
    else if (taskId === 3) {
      const updatedSubTasks = task3SubTasks.map(task => {
        const value = existingAnnotation.data[task.id];
        if (value !== undefined) {
          return {
            ...task,
            selectedOption: task.textInput ? undefined : value as string,
            textValue: task.textInput ? value as string : undefined,
            status: 'completed' as 'completed' | 'pending' | 'na'
          };
        }
        return task;
      });
      return updatedSubTasks;
    }
  }, [user, getUserAnnotation, task1SubTasks, task2SubTasks, task3SubTasks]);

  // Prepare consensus view for pod leads
  const prepareConsensusView = useCallback((discussionId: string, taskId: number) => {
    // Get all annotations for this task
    const taskAnnotations = getAnnotationsForTask(discussionId, taskId);
    
    if (taskId === 1) {
      // Generate consensus subtasks from the data
      const consensusTasks: SubTask[] = [
        {
          id: 'relevance',
          title: 'Final Relevance Assessment',
          status: 'pending',
          options: ['Yes', 'No'],
          description: `Annotator consensus: ${
            taskAnnotations.filter(a => a.data.relevance === 'Yes').length
          }/${taskAnnotations.length} Yes`
        },
        {
          id: 'learning',
          title: 'Final Learning Value Assessment',
          status: 'pending',
          options: ['Yes', 'No'],
          description: `Annotator consensus: ${
            taskAnnotations.filter(a => a.data.learning_value === 'Yes').length
          }/${taskAnnotations.length} Yes`
        },
        {
          id: 'clarity',
          title: 'Final Clarity Assessment',
          status: 'pending',
          options: ['Yes', 'No'],
          description: `Annotator consensus: ${
            taskAnnotations.filter(a => a.data.clarity === 'Yes').length
          }/${taskAnnotations.length} Yes`
        },
        {
          id: 'grounded',
          title: 'Final Image Grounding Assessment',
          status: 'pending',
          options: ['True', 'False', 'N/A'],
          description: `Annotator results: ${
            taskAnnotations.filter(a => a.data.grounded === 'True').length
          } True, ${
            taskAnnotations.filter(a => a.data.grounded === 'False').length
          } False, ${
            taskAnnotations.filter(a => a.data.grounded === 'N/A').length
          } N/A`
        }
      ];
      
      // Check if there's already a consensus annotation
      const existingConsensus = getConsensusAnnotation(discussionId, taskId);
      if (existingConsensus) {
        // Apply existing consensus values
        consensusTasks.forEach(task => {
          const value = existingConsensus.data[task.id];
          if (value !== undefined) {
            task.selectedOption = value as string;
            task.status = 'completed';
          }
        });
      }
      
      return consensusTasks;
    }
    else if (taskId === 2) {
      // Similar to task 1, but with task 2 specific fields
      const consensusTasks: SubTask[] = [
        {
          id: 'aspects',
          title: 'Final Assessment - Addresses All Aspects',
          status: 'pending',
          options: ['Yes', 'No'],
          description: `Annotator consensus: ${
            taskAnnotations.filter(a => a.data.aspects === 'Yes').length
          }/${taskAnnotations.length} Yes`
        },
        {
          id: 'explanation',
          title: 'Final Assessment - Explanation Provided',
          status: 'pending',
          options: ['Yes', 'No'],
          description: `Annotator consensus: ${
            taskAnnotations.filter(a => a.data.explanation === 'Yes').length
          }/${taskAnnotations.length} Yes`
        },
        {
          id: 'execution',
          title: 'Final Assessment - Code Execution',
          status: 'pending',
          options: ['Executable', 'Not Executable', 'N/A'],
          description: `Annotator results: ${
            taskAnnotations.filter(a => a.data.execution === 'Executable').length
          } Executable, ${
            taskAnnotations.filter(a => a.data.execution === 'Not Executable').length
          } Not Executable, ${
            taskAnnotations.filter(a => a.data.execution === 'N/A').length
          } N/A`
        },
        {
          id: 'download',
          title: 'Final Assessment - Code Download Link',
          status: 'pending',
          options: ['Provided', 'Not Provided', 'N/A'],
          description: `Annotator consensus`
        },
        {
          id: 'justification',
          title: 'Final Assessment - Justification',
          status: 'pending',
          description: 'Provide final justification',
          textInput: true
        }
      ];
      
      // Check for existing consensus annotation
      const existingConsensus = getConsensusAnnotation(discussionId, taskId);
      if (existingConsensus) {
        consensusTasks.forEach(task => {
          const value = existingConsensus.data[task.id];
          if (value !== undefined) {
            if (task.textInput) {
              task.textValue = value as string;
            } else {
              task.selectedOption = value as string;
            }
            task.status = 'completed';
          }
        });
      }
      
      return consensusTasks;
    }
    else if (taskId === 3) {
      // Task 3 consensus fields
      const consensusTasks: SubTask[] = [
        {
          id: 'rewrite',
          title: 'Final Rewritten Question',
          status: 'pending',
          description: 'Select the best rewritten question or provide your own',
          textInput: true
        },
        {
          id: 'shortAnswer',
          title: 'Final Short Answer List',
          status: 'pending',
          description: 'Select the best short answer list or provide your own',
          textInput: true
        },
        {
          id: 'longAnswer',
          title: 'Final Long Answer',
          status: 'pending',
          description: 'Select the best long answer or provide your own',
          textInput: true
        },
        {
          id: 'classify',
          title: 'Final Question Type',
          status: 'pending',
          options: ['Search', 'Reasoning'],
          description: `Annotator consensus: ${
            taskAnnotations.filter(a => a.data.classify === 'Search').length
          } Search, ${
            taskAnnotations.filter(a => a.data.classify === 'Reasoning').length
          } Reasoning`
        },
        {
          id: 'supporting',
          title: 'Final Supporting Documentation',
          status: 'pending',
          description: 'Select the best supporting documentation or provide your own',
          textInput: true
        }
      ];
      
      // Check for existing consensus annotation
      const existingConsensus = getConsensusAnnotation(discussionId, taskId);
      if (existingConsensus) {
        consensusTasks.forEach(task => {
          const value = existingConsensus.data[task.id];
          if (value !== undefined) {
            if (task.textInput) {
              task.textValue = value as string;
            } else {
              task.selectedOption = value as string;
            }
            task.status = 'completed';
          }
        });
      }
      
      return consensusTasks;
    }
    
    return [];
  }, [getAnnotationsForTask, getConsensusAnnotation]);

  // Save annotation (combining regular and consensus cases)
  const handleSaveAnnotation = useCallback(async (
    discussionId: string | null, 
    currentStep: number, 
    viewMode: 'grid' | 'detail' | 'consensus',
    uploadedImage: string | null,
    codeDownloadUrl: string | null,
    handleBackToGrid: () => void
  ) => {
    if (!discussionId || !user) return;
    
    let data: Record<string, string | boolean> = {};
    let success = false;
    
    try {
      if (viewMode === 'consensus') {
        // Save consensus annotation
        if (currentStep === 1) {
          consensusTask1.forEach(task => {
            if (task.textInput && task.textValue) {
              data[task.id] = task.textValue;
            } else if (task.selectedOption) {
              data[task.id] = task.selectedOption;
            }
          });
          
          success = await saveConsensusAnnotation({
            discussionId,
            userId: user.id,
            taskId: 1,
            data
          });
        } else if (currentStep === 2) {
          // Add uploaded image info if available
          if (uploadedImage) {
            data['executionScreenshot'] = uploadedImage;
          }
          
          consensusTask2.forEach(task => {
            if (task.textInput && task.textValue) {
              data[task.id] = task.textValue;
            } else if (task.selectedOption) {
              data[task.id] = task.selectedOption;
            }
          });
          
          success = await saveConsensusAnnotation({
            discussionId,
            userId: user.id,
            taskId: 2,
            data
          });
        } else if (currentStep === 3) {
          consensusTask3.forEach(task => {
            if (task.textInput && task.textValue) {
              data[task.id] = task.textValue;
            } else if (task.selectedOption) {
              data[task.id] = task.selectedOption;
            }
          });
          
          success = await saveConsensusAnnotation({
            discussionId,
            userId: user.id,
            taskId: 3,
            data
          });
        }
      } else {
        // Save regular annotation
        if (currentStep === 1) {
          task1SubTasks.forEach(task => {
            if (task.selectedOption) {
              data[task.id] = task.selectedOption;
            }
          });
          
          success = await saveAnnotation({
            discussionId,
            userId: user.id,
            taskId: 1,
            data
          });
        } else if (currentStep === 2) {
          // Add uploaded image info if available
          if (uploadedImage) {
            data['executionScreenshot'] = uploadedImage;
          }
          
          // Add code download link if provided
          if (codeDownloadUrl) {
            data['download'] = codeDownloadUrl;
          }
          
          task2SubTasks.forEach(task => {
            if (task.textInput && task.textValue) {
              data[task.id] = task.textValue;
            } else if (task.selectedOption) {
              data[task.id] = task.selectedOption;
            }
          });
          
          success = await saveAnnotation({
            discussionId,
            userId: user.id,
            taskId: 2,
            data
          });
        } else if (currentStep === 3) {
          task3SubTasks.forEach(task => {
            if (task.textInput && task.textValue) {
              data[task.id] = task.textValue;
            } else if (task.selectedOption) {
              data[task.id] = task.selectedOption;
            }
          });
          
          success = await saveAnnotation({
            discussionId,
            userId: user.id,
            taskId: 3,
            data
          });
        }
      }
      
      if (success) {
        toast.success('Annotation saved successfully');
        updateStepCompletionStatus(currentStep, true);
        handleBackToGrid();
      }
    } catch (error) {
      console.error("Error saving annotation:", error);
      toast.error('Failed to save annotation');
    }
  }, [task1SubTasks, task2SubTasks, task3SubTasks, consensusTask1, consensusTask2, consensusTask3, user, saveAnnotation, saveConsensusAnnotation, updateStepCompletionStatus]);

  return {
    loadUserAnnotation,
    prepareConsensusView,
    handleSaveAnnotation
  };
}
