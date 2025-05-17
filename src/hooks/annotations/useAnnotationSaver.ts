
import { useState } from 'react';
import { SubTask } from '@/components/dashboard/TaskCard';
import { Annotation } from '@/services/api';
import { toast } from 'sonner';
import { User } from '@/contexts/UserContext';
import { AnnotationHandlersProps, isPodLead, TaskId } from './useAnnotationTypes';

type AnnotationSaverProps = AnnotationHandlersProps;

export function useAnnotationSaver({
  task1SubTasks,
  task2SubTasks,
  task3SubTasks,
  consensusTask1,
  consensusTask2,
  consensusTask3,
  user,
  saveAnnotation,
  saveConsensusAnnotation,
  updateStepCompletionStatus,
  overrideAnnotation
}: AnnotationSaverProps) {
  const [loading, setLoading] = useState(false);

  // Convert tasks to data format
  const convertTasksToData = (tasks: SubTask[], data: Record<string, any>) => {
    tasks.forEach(task => {
      if (task.selectedOption) {
        // Convert string options to actual boolean for boolean fields if needed
        if (task.selectedOption === 'True' || task.selectedOption === 'False' ||
            task.selectedOption === 'Yes' || task.selectedOption === 'No') {
          data[task.id] = (task.selectedOption === 'True' || task.selectedOption === 'Yes');
        } else {
          data[task.id] = task.selectedOption;
        }
        
        // Add text value if present
        if (task.textValue) {
          data[`${task.id}_text`] = task.textValue;
        }
      }
    });
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
          case TaskId.QUESTION_QUALITY:
            currentTasks = task1SubTasks;
            break;
          case TaskId.ANSWER_QUALITY:
            currentTasks = task2SubTasks;
            // Add screenshot and code download URL for task 2
            if (uploadedImage) {
              taskData.screenshot = uploadedImage;
            }
            if (codeDownloadUrl) {
              taskData.codeDownloadUrl = codeDownloadUrl;
            }
            break;
          case TaskId.REWRITE:
            currentTasks = task3SubTasks;
            break;
          default:
            toast.error('Invalid task ID');
            return;
        }
        
        // Convert form data to API format
        convertTasksToData(currentTasks, taskData);
        
        // Save annotation - force this to NOT use mock data
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
          case TaskId.QUESTION_QUALITY:
            currentTasks = consensusTask1;
            break;
          case TaskId.ANSWER_QUALITY:
            currentTasks = consensusTask2;
            break;
          case TaskId.REWRITE:
            currentTasks = consensusTask3;
            break;
          default:
            toast.error('Invalid task ID');
            return;
        }
        
        // Convert form data to API format
        convertTasksToData(currentTasks, taskData);
        
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
  
  // Handle pod lead overriding an annotator's annotation
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
      convertTasksToData(subTasks, taskData);
      
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
  
  return {
    handleSaveAnnotation,
    handleOverrideAnnotation,
    loading
  };
}
