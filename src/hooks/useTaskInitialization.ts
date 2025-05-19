import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { SubTask, SubTaskStatus } from '@/components/dashboard/TaskCard';
import { User } from '@/contexts/UserContext';
import { api } from '@/services/api/endpoints';
import { TaskId } from './annotations/useAnnotationTypes';

interface UseTaskInitializationProps {
  discussionId: string | null;
  currentStep: number;
  viewMode: 'grid' | 'detail' | 'consensus';
  user: User | null;
  isPodLead: boolean;
  loadUserAnnotation: (discussionId: string, taskId: number) => SubTask[] | null;
  prepareConsensusView: (discussionId: string, taskId: number) => SubTask[] | null;
  setTask1SubTasks: (tasks: SubTask[]) => void;
  setTask2SubTasks: (tasks: SubTask[]) => void;
  setTask3SubTasks: (tasks: SubTask[]) => void;
  setConsensusTask1: (tasks: SubTask[]) => void;
  setConsensusTask2: (tasks: SubTask[]) => void;
  setConsensusTask3: (tasks: SubTask[]) => void;
}

export function useTaskInitialization({
  discussionId,
  currentStep,
  viewMode,
  user,
  isPodLead,
  loadUserAnnotation,
  prepareConsensusView,
  setTask1SubTasks,
  setTask2SubTasks,
  setTask3SubTasks,
  setConsensusTask1,
  setConsensusTask2,
  setConsensusTask3
}: UseTaskInitializationProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Load task data on component mount or when discussionId/task changes
  useEffect(() => {
    if (!discussionId || !user || currentStep <= 0 || currentStep > 3) {
      return;
    }
    
    const loadTaskData = async () => {
      setLoading(true);
      setError(null);
      
      try {
        console.log(`Loading data for discussion: ${discussionId}, task: ${currentStep}, mode: ${viewMode}`);
        
        if (viewMode === 'detail') {
          // Load user's existing annotation only for the current task
          const updatedSubTasks = loadUserAnnotation(discussionId, currentStep);
          
          if (updatedSubTasks) {
            console.log("Loaded user annotation successfully:", updatedSubTasks);
            switch (currentStep) {
              case TaskId.QUESTION_QUALITY:
                setTask1SubTasks(updatedSubTasks);
                break;
              case TaskId.ANSWER_QUALITY:
                setTask2SubTasks(updatedSubTasks);
                break;
              case TaskId.REWRITE:
                setTask3SubTasks(updatedSubTasks);
                break;
            }
          } else {
            console.log("No saved annotation found or error loading");
            // If no saved annotation, ensure the form is reset to prevent old data showing
            // This is important when switching between different discussions
            switch (currentStep) {
              case TaskId.QUESTION_QUALITY:
                // Get current tasks and reset them
                const resetTask1 = loadUserAnnotation(discussionId, TaskId.QUESTION_QUALITY) || [];
                const resetTasks1 = resetTask1.map((task: SubTask) => ({
                  ...task,
                  selectedOption: undefined, 
                  textValue: '',
                  status: task.id === 'consensus' ? task.status : 'pending' as SubTaskStatus 
                }));
                setTask1SubTasks(resetTasks1);
                break;
              case TaskId.ANSWER_QUALITY:
                // Get current tasks and reset them
                const resetTask2 = loadUserAnnotation(discussionId, TaskId.ANSWER_QUALITY) || [];
                const resetTasks2 = resetTask2.map((task: SubTask) => ({
                  ...task,
                  selectedOption: undefined,
                  textValue: '',
                  status: task.id === 'consensus' ? task.status : 'pending' as SubTaskStatus
                }));
                setTask2SubTasks(resetTasks2);
                break;
              case TaskId.REWRITE:
                // Get current tasks and reset them
                const resetTask3 = loadUserAnnotation(discussionId, TaskId.REWRITE) || [];
                const resetTasks3 = resetTask3.map((task: SubTask) => ({
                  ...task,
                  selectedOption: undefined,
                  textValue: '',
                  status: task.id === 'consensus' ? task.status : 'pending' as SubTaskStatus
                }));
                setTask3SubTasks(resetTasks3);
                break;
            }
          }
        } else if (viewMode === 'consensus' && isPodLead) {
          // Prepare consensus view only for the current task
          const consensusTasks = prepareConsensusView(discussionId, currentStep);
          
          if (consensusTasks && consensusTasks.length > 0) {
            console.log("Loaded consensus view successfully");
            switch (currentStep) {
              case TaskId.QUESTION_QUALITY:
                setConsensusTask1(consensusTasks);
                break;
              case TaskId.ANSWER_QUALITY:
                setConsensusTask2(consensusTasks);
                break;
              case TaskId.REWRITE:
                setConsensusTask3(consensusTasks);
                break;
            }
          }
        }

        // Optionally, fetch updated status for the current discussion only
        try {
          if (discussionId) {
            const updatedDiscussion = await api.discussions.getById(discussionId);
            if (updatedDiscussion) {
              console.log("Fetched updated task status for current discussion:", updatedDiscussion);
            }
          }
        } catch (e) {
          console.error("Failed to fetch updated discussion status:", e);
        }
        
      } catch (error) {
        console.error("Error loading task data:", error);
        const errorMessage = error instanceof Error ? error.message : "Failed to load task data";
        setError(errorMessage);
        toast.error("Error loading task data", {
          description: errorMessage
        });
      } finally {
        setLoading(false);
      }
    };
    
    loadTaskData();
  }, [discussionId, currentStep, viewMode, user, isPodLead]);
  
  return {
    loading,
    error
  };
}