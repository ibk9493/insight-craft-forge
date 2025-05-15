
import { useState, useCallback } from 'react';
import { SubTask, SubTaskStatus } from '@/components/dashboard/TaskCard';
import { useAnnotationData } from './useAnnotationData';
import { toast } from 'sonner';

interface ConsensusResult {
  status: 'pending' | 'completed';
  result?: string;
  agreement?: boolean;
}

export function useTaskData() {
  const { calculateConsensus } = useAnnotationData();
  // Task 1 subtasks
  const [task1SubTasks, setTask1SubTasks] = useState<SubTask[]>([
    {
      id: 'relevance',
      title: 'Relevance Check',
      status: 'pending' as SubTaskStatus,
      options: ['Yes', 'No'],
      description: 'Check if the question is relevant to the topic'
    },
    {
      id: 'learning',
      title: 'Learning Value Check',
      status: 'pending' as SubTaskStatus,
      options: ['Yes', 'No'],
      description: 'Check if the question has learning value'
    },
    {
      id: 'clarity',
      title: 'Clarity Check',
      status: 'pending' as SubTaskStatus,
      options: ['Yes', 'No'],
      description: 'Check if the question is clear'
    },
    {
      id: 'grounded',
      title: 'Image Grounded Check',
      status: 'pending' as SubTaskStatus,
      options: ['True', 'False', 'N/A'],
      description: 'Check if images are properly referenced (if any)'
    },
    {
      id: 'consensus',
      title: 'Consensus by 3 annotators',
      status: 'pending' as SubTaskStatus,
      options: ['Agreement', 'No Agreement'],
      description: 'System-determined consensus based on annotator submissions'
    }
  ]);
  
  // Task 2 subtasks
  const [task2SubTasks, setTask2SubTasks] = useState<SubTask[]>([
    {
      id: 'aspects',
      title: 'Addresses All Aspects',
      status: 'pending' as SubTaskStatus,
      options: ['Yes', 'No'],
      description: 'Check if the answer addresses all aspects of the question'
    },
    {
      id: 'explanation',
      title: 'Explanation Provided',
      status: 'pending' as SubTaskStatus,
      options: ['Yes', 'No'],
      description: 'Check if the answer provides an explanation'
    },
    {
      id: 'execution',
      title: 'Manual Code Execution Check',
      status: 'pending' as SubTaskStatus,
      options: ['Executable', 'Not Executable', 'N/A'],
      description: 'Check if the provided code is executable'
    },
    {
      id: 'download',
      title: 'Provide Code Download Link',
      status: 'pending' as SubTaskStatus,
      options: ['Provided', 'Not Provided', 'N/A'],
      description: 'Check if a code download link is provided'
    },
    {
      id: 'consensus',
      title: 'Consensus by 3 annotators',
      status: 'pending' as SubTaskStatus,
      options: ['Agreement', 'No Agreement'],
      description: 'System-determined consensus based on annotator submissions'
    }
  ]);
  
  // Task 3 subtasks
  const [task3SubTasks, setTask3SubTasks] = useState<SubTask[]>([
    {
      id: 'rewrite',
      title: 'Rewrite Question Clearly',
      status: 'pending' as SubTaskStatus,
      options: ['Completed', 'Not Needed'],
      description: 'Rewrite the question in a clear and concise manner',
      textInput: true,
      textValue: ''
    },
    {
      id: 'shortAnswer',
      title: 'Prepare Short Answer List',
      status: 'pending' as SubTaskStatus,
      options: ['Completed', 'Not Needed'],
      description: 'Break down into atomic, concise claims',
      textInput: true,
      textValue: ''
    },
    {
      id: 'longAnswer',
      title: 'Construct Coherent Long Answer',
      status: 'pending' as SubTaskStatus,
      options: ['Completed', 'Not Needed'],
      description: 'Combine claims, smooth language, add reasoning',
      textInput: true,
      textValue: ''
    },
    {
      id: 'classify',
      title: 'Classify Question Type',
      status: 'pending' as SubTaskStatus,
      options: ['Search', 'Reasoning'],
      description: 'Classify the question as "Search" or "Reasoning"'
    },
    {
      id: 'supporting',
      title: 'Provide Supporting Docs',
      status: 'pending' as SubTaskStatus,
      options: ['Provided', 'Not Needed'],
      description: 'Annotate relevant references',
      textInput: true,
      textValue: ''
    },
    {
      id: 'consensus',
      title: 'Consensus by 5 annotators',
      status: 'pending' as SubTaskStatus,
      options: ['Agreement', 'No Agreement'],
      description: 'System-determined consensus based on annotator submissions'
    }
  ]);

  // Store annotations from multiple annotators
  const [task1Annotations, setTask1Annotations] = useState<Array<Record<string, string>>>([]);
  const [task2Annotations, setTask2Annotations] = useState<Array<Record<string, string>>>([]);
  const [task3Annotations, setTask3Annotations] = useState<Array<Record<string, string>>>([]);
  
  // Progress steps
  const [steps, setSteps] = useState([
    { id: 1, title: 'Input URL', completed: false },
    { id: 2, title: 'Task 1', completed: false },
    { id: 3, title: 'Task 2', completed: false },
    { id: 4, title: 'Task 3', completed: false },
    { id: 5, title: 'Summary', completed: false },
  ]);

  // Add annotator counters
  const [task1Annotators, setTask1Annotators] = useState(0);
  const [task2Annotators, setTask2Annotators] = useState(0);
  const [task3Annotators, setTask3Annotators] = useState(0);

  // Tasks for grid view
  const [tasks, setTasks] = useState([
    {
      id: 1,
      title: "Question Quality Assessment",
      description: "Evaluate the quality of the question based on relevance, learning value, clarity, and image grounding.",
      status: 'locked' as 'locked' | 'unlocked' | 'completed',
      requiredAnnotators: 3,
      currentAnnotators: 0
    },
    {
      id: 2,
      title: "Answer Quality Assessment",
      description: "Evaluate the quality of the answer based on comprehensiveness, explanation, code execution, and completeness.",
      status: 'locked' as 'locked' | 'unlocked' | 'completed',
      requiredAnnotators: 3,
      currentAnnotators: 0
    },
    {
      id: 3,
      title: "Rewrite Question and Answer",
      description: "Rewrite the question and answer to improve clarity, conciseness, and coherence.",
      status: 'locked' as 'locked' | 'unlocked' | 'completed',
      requiredAnnotators: 5,
      currentAnnotators: 0
    }
  ]);

  const handleSubTaskChange = useCallback((taskSet: string, taskId: string, selectedOption?: string, textValue?: string) => {
    let updated: SubTask[] = [];

    // Skip changes to consensus fields as they're system-determined
    if (taskId === 'consensus') {
      return;
    }

    try {
      if (taskSet === 'task1') {
        updated = task1SubTasks.map(task => 
          task.id === taskId 
            ? { 
                ...task, 
                selectedOption, 
                textValue: textValue !== undefined ? textValue : task.textValue,
                status: selectedOption ? 'completed' as SubTaskStatus : 'pending' as SubTaskStatus
              } 
            : task
        );
        setTask1SubTasks(updated);
      } else if (taskSet === 'task2') {
        updated = task2SubTasks.map(task => 
          task.id === taskId 
            ? { 
                ...task, 
                selectedOption, 
                textValue: textValue !== undefined ? textValue : task.textValue,
                status: selectedOption ? 'completed' as SubTaskStatus : 'pending' as SubTaskStatus
              } 
            : task
        );
        setTask2SubTasks(updated);
      } else if (taskSet === 'task3') {
        updated = task3SubTasks.map(task => 
          task.id === taskId 
            ? { 
                ...task, 
                selectedOption, 
                textValue: textValue !== undefined ? textValue : task.textValue,
                status: selectedOption ? 'completed' as SubTaskStatus : 'pending' as SubTaskStatus
              } 
            : task
        );
        setTask3SubTasks(updated);
      }

      checkForSubtaskLogic(taskSet, taskId, selectedOption);
    } catch (error) {
      console.error("Error in handleSubTaskChange:", error);
      toast.error("Failed to update task. Please try again.");
    }
  }, [task1SubTasks, task2SubTasks, task3SubTasks]);

  const checkForSubtaskLogic = useCallback((taskSet: string, taskId: string, selectedOption?: string) => {
    try {
      // Special logic for Task 1
      if (taskSet === 'task1') {
        // If relevance is No, mark the rest as N/A
        if (taskId === 'relevance' && selectedOption === 'No') {
          setTask1SubTasks(task1SubTasks.map(task => {
            if (task.id !== 'relevance' && task.id !== 'consensus') {
              return { ...task, status: 'na' as SubTaskStatus, selectedOption: 'N/A' };
            }
            return task;
          }));
        }
        // If learning is No, mark the rest as N/A
        if (taskId === 'learning' && selectedOption === 'No') {
          setTask1SubTasks(task1SubTasks.map(task => {
            if (task.id !== 'relevance' && task.id !== 'learning' && task.id !== 'consensus') {
              return { ...task, status: 'na' as SubTaskStatus, selectedOption: 'N/A' };
            }
            return task;
          }));
        }
      }
    } catch (error) {
      console.error("Error in checkForSubtaskLogic:", error);
      toast.error("Failed to apply task logic. Please try again.");
    }
  }, [task1SubTasks]);

  // Function to save annotation when an annotator completes a task
  const saveAnnotation = useCallback(async (taskSet: string, discussionId?: string) => {
    try {
      let currentAnnotation: Record<string, string> = {};
      
      if (taskSet === 'task1') {
        task1SubTasks.forEach(task => {
          if (task.id !== 'consensus' && task.selectedOption) {
            currentAnnotation[task.id] = task.selectedOption;
          }
        });
        setTask1Annotations([...task1Annotations, currentAnnotation]);
        
        // If we have 3 annotators, determine consensus
        if (task1Annotators + 1 >= 3 && discussionId) {
          await determineConsensus(taskSet, discussionId);
        } else {
          setTask1Annotators(prev => prev + 1);
        }
        
        return true;
      } 
      else if (taskSet === 'task2') {
        task2SubTasks.forEach(task => {
          if (task.id !== 'consensus' && task.selectedOption) {
            currentAnnotation[task.id] = task.selectedOption;
          }
        });
        setTask2Annotations([...task2Annotations, currentAnnotation]);
        
        // If we have 3 annotators, determine consensus
        if (task2Annotators + 1 >= 3 && discussionId) {
          await determineConsensus(taskSet, discussionId);
        } else {
          setTask2Annotators(prev => prev + 1);
        }
        
        return true;
      }
      else if (taskSet === 'task3') {
        task3SubTasks.forEach(task => {
          if (task.id !== 'consensus') {
            if (task.selectedOption) {
              currentAnnotation[task.id] = task.selectedOption;
            }
            if (task.textInput && task.textValue) {
              currentAnnotation[`${task.id}_text`] = task.textValue;
            }
          }
        });
        setTask3Annotations([...task3Annotations, currentAnnotation]);
        
        // If we have 5 annotators, determine consensus
        if (task3Annotators + 1 >= 5 && discussionId) {
          await determineConsensus(taskSet, discussionId);
        } else {
          setTask3Annotators(prev => prev + 1);
        }
        
        return true;
      }
      
      return false;
    } catch (error) {
      console.error("Error in saveAnnotation:", error);
      toast.error("Failed to save annotation. Please try again.");
      return false;
    }
  }, [task1SubTasks, task2SubTasks, task3SubTasks, task1Annotations, task2Annotations, task3Annotations, task1Annotators, task2Annotators, task3Annotators]);

  // Determine consensus based on majority rule using the API
  const determineConsensus = useCallback(async (taskSet: string, discussionId: string) => {
    try {
      const taskId = taskSet === 'task1' ? 1 : taskSet === 'task2' ? 2 : 3;
      const result = await calculateConsensus(discussionId, taskId);
      
      updateConsensusTask(taskSet, result.result);
      
      // Update annotator counts to reflect that consensus has been determined
      if (taskSet === 'task1') {
        setTask1Annotators(3); // Set to required number
      }
      else if (taskSet === 'task2') {
        setTask2Annotators(3); // Set to required number
      }
      else if (taskSet === 'task3') {
        setTask3Annotators(5); // Set to required number
      }
      
      return result.agreement;
    } catch (error) {
      console.error("Error determining consensus:", error);
      toast.error("Failed to calculate consensus. Please try again.");
      return false;
    }
  }, [calculateConsensus]);

  // Update the consensus task with the result
  const updateConsensusTask = useCallback((taskSet: string, result: string) => {
    try {
      if (taskSet === 'task1') {
        setTask1SubTasks(task1SubTasks.map(task => 
          task.id === 'consensus' 
            ? { ...task, selectedOption: result, status: 'completed' as SubTaskStatus } 
            : task
        ));
      }
      else if (taskSet === 'task2') {
        setTask2SubTasks(task2SubTasks.map(task => 
          task.id === 'consensus' 
            ? { ...task, selectedOption: result, status: 'completed' as SubTaskStatus } 
            : task
        ));
      }
      else if (taskSet === 'task3') {
        setTask3SubTasks(task3SubTasks.map(task => 
          task.id === 'consensus' 
            ? { ...task, selectedOption: result, status: 'completed' as SubTaskStatus } 
            : task
        ));
      }
    } catch (error) {
      console.error("Error updating consensus task:", error);
      toast.error("Failed to update consensus. Please try again.");
    }
  }, [task1SubTasks, task2SubTasks, task3SubTasks]);

  const getTask1Progress = useCallback(() => {
    try {
      const completed = task1SubTasks.filter(t => t.status === 'completed' || t.status === 'na').length;
      if (completed === task1SubTasks.length) return 'completed';
      if (completed > 0) return 'inProgress';
      return 'pending';
    } catch (error) {
      console.error("Error getting task progress:", error);
      return 'pending';
    }
  }, [task1SubTasks]);

  const getTask2Progress = useCallback(() => {
    try {
      const completed = task2SubTasks.filter(t => t.status === 'completed' || t.status === 'na').length;
      if (completed === task2SubTasks.length) return 'completed';
      if (completed > 0) return 'inProgress';
      return 'pending';
    } catch (error) {
      console.error("Error getting task progress:", error);
      return 'pending';
    }
  }, [task2SubTasks]);

  const getTask3Progress = useCallback(() => {
    try {
      const completed = task3SubTasks.filter(t => t.status === 'completed' || t.status === 'na').length;
      if (completed === task3SubTasks.length) return 'completed';
      if (completed > 0) return 'inProgress';
      return 'pending';
    } catch (error) {
      console.error("Error getting task progress:", error);
      return 'pending';
    }
  }, [task3SubTasks]);

  // Reset all tasks for a new discussion
  const resetTasks = useCallback(() => {
    try {
      // Reset task1
      setTask1SubTasks(prev => prev.map(task => ({
        ...task,
        selectedOption: undefined,
        status: 'pending' as SubTaskStatus,
        textValue: ''
      })));
      
      // Reset task2
      setTask2SubTasks(prev => prev.map(task => ({
        ...task,
        selectedOption: undefined,
        status: 'pending' as SubTaskStatus,
        textValue: ''
      })));
      
      // Reset task3
      setTask3SubTasks(prev => prev.map(task => ({
        ...task,
        selectedOption: undefined,
        status: 'pending' as SubTaskStatus,
        textValue: ''
      })));
      
      // Reset annotations
      setTask1Annotations([]);
      setTask2Annotations([]);
      setTask3Annotations([]);
      
      // Reset annotator counters
      setTask1Annotators(0);
      setTask2Annotators(0);
      setTask3Annotators(0);
      
      // Reset steps
      setSteps(prev => prev.map(step => ({
        ...step,
        completed: step.id === 1 // Only the first step is completed
      })));
      
      toast.success('Tasks reset successfully');
    } catch (error) {
      console.error("Error resetting tasks:", error);
      toast.error("Failed to reset tasks. Please try again.");
    }
  }, []);

  return {
    task1SubTasks, setTask1SubTasks,
    task2SubTasks, setTask2SubTasks,
    task3SubTasks, setTask3SubTasks,
    task1Annotators, setTask1Annotators,
    task2Annotators, setTask2Annotators,
    task3Annotators, setTask3Annotators,
    tasks, setTasks,
    steps, setSteps,
    handleSubTaskChange,
    checkForSubtaskLogic,
    getTask1Progress,
    getTask2Progress,
    getTask3Progress,
    saveAnnotation,
    determineConsensus,
    resetTasks
  };
}
