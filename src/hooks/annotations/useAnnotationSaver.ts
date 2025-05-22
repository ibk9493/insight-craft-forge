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
  getUserAnnotation,
  getAnnotationsForTask,
  getConsensusAnnotation,
  updateStepCompletionStatus,
  overrideAnnotation
}: AnnotationSaverProps) {
  const [loading, setLoading] = useState(false);

  // Convert tasks to data format
  const convertTasksToData = (tasks: SubTask[], data: Record<string, any>) => {
    tasks.forEach(task => {
      // Always save the status if a selection was made (original condition)
      if (task.selectedOption) {
        if (task.selectedOption === 'True' || task.selectedOption === 'False' ||
            task.selectedOption === 'Yes' || task.selectedOption === 'No') {
          data[task.id] = (task.selectedOption === 'True' || task.selectedOption === 'Yes');
        } else {
          data[task.id] = task.selectedOption; // e.g., data['rewrite'] = 'Completed'
        }
      }

      // Add text value if present (for single text inputs like rewrite_text)
      if (task.textValue !== undefined) { // Added textInput check for clarity, and check for undefined
        data[`${task.id}_text`] = task.textValue; // e.g., data['rewrite_text'] = "Some text"
      }

      // Add textValues if present (for multiline text inputs like short_answer_list)
      if (task.multiline && task.textValues && Array.isArray(task.textValues)) {
        // Example: task.id = "short_answer_list"
        // data["short_answer_list_items"] = ["item1", "item2"]
        data[`${task.id}_items`] = task.textValues;
      }

      // Add supportingDocs if present
      if (task.structuredInput && task.supportingDocs && Array.isArray(task.supportingDocs)) {
        // Example: task.id = "supporting_docs"
        // data["supporting_docs_data"] = [{link: "...", paragraph: "..."}]
        data[`${task.id}_data`] = task.supportingDocs;
      }
    });
  };

  // Save annotation or consensus
  const handleSaveAnnotation = async (
    discussionId: string | null, 
    taskId: number, 
    viewMode: 'grid' | 'detail' | 'consensus',
    screenshotUrl: string | null,
    codeDownloadUrl: string | null,
    onComplete: () => void,
    consensusStars?: number | null,
    consensusComment?: string
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
            if (screenshotUrl) {
              taskData.screenshot = screenshotUrl;
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
            setLoading(false); // Added to ensure loading is false on early return
            return;
        }
        
        // Convert form data to API format
        console.log('[useAnnotationSaver] Converting tasks to data:', currentTasks);
        convertTasksToData(currentTasks, taskData);
        
        // Save annotation - force this to NOT use mock data
        const success = await saveAnnotation({
          user_id: user.id,
          discussion_id: discussionId,
          task_id: taskId,
          data: taskData
        });
        
        if (success) {
          updateStepCompletionStatus(taskId, true);
          toast.success('Annotation saved successfully');
          onComplete();
        }
      } else if (viewMode === 'consensus') {
        // Consensus annotation
        if (!user || (user.role !== 'pod_lead' && user.role !== 'admin')) {
          toast.error('Only pod leads or admins can save consensus annotations');
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
            setLoading(false); // Added to ensure loading is false on early return
            return;
        }
        
        // Convert form data to API format
        convertTasksToData(currentTasks, taskData);
        
        // Add consensus stars and comment if provided
        if (consensusStars !== undefined && consensusStars !== null) {
          taskData.stars = consensusStars;
        }
        if (consensusComment && consensusComment.trim() !== '') {
          taskData.comment = consensusComment;
        }
        
        console.log('[useAnnotationSaver] Saving consensus data:', JSON.stringify(taskData)); // DEBUG LOG

        // Save consensus annotation
        const success = await saveConsensusAnnotation({
          user_id: user.id,
          discussion_id: discussionId,
          task_id: taskId,
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
