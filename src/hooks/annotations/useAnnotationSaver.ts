
import { useState } from 'react';
import { SubTask } from '@/components/dashboard/TaskCard';
import { Annotation } from '@/services/api';
import { toast } from 'sonner';
import { User } from '@/contexts/UserContext';

interface AnnotationSaverProps {
  task1SubTasks: SubTask[];
  task2SubTasks: SubTask[];
  task3SubTasks: SubTask[];
  consensusTask1: SubTask[];
  consensusTask2: SubTask[];
  consensusTask3: SubTask[];
  user: User | null;
  saveAnnotation: (annotation: Omit<Annotation, 'timestamp'>) => Promise<boolean>;
  saveConsensusAnnotation: (annotation: Omit<Annotation, 'timestamp'>) => Promise<boolean>;
  updateStepCompletionStatus: (stepIndex: number, completed: boolean) => void;
  overrideAnnotation?: (podLeadId: string, annotatorId: string, discussionId: string, taskId: number, data: Record<string, string | boolean>) => Promise<boolean>;
}

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
        convertTasksToData(currentTasks, taskData);
        
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
  
  // Helper function to convert tasks to data format
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

// Helper function to check if user is pod lead
export const isPodLead = (user: User): boolean => {
  return user.role === 'pod_lead';
};
