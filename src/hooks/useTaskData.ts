
import { useState } from 'react';
import { SubTask } from '@/components/dashboard/TaskCard';

export function useTaskData() {
  // Task 1 subtasks
  const [task1SubTasks, setTask1SubTasks] = useState<SubTask[]>([
    {
      id: 'relevance',
      title: 'Relevance Check',
      status: 'pending',
      options: ['Yes', 'No'],
      description: 'Check if the question is relevant to the topic'
    },
    {
      id: 'learning',
      title: 'Learning Value Check',
      status: 'pending',
      options: ['Yes', 'No'],
      description: 'Check if the question has learning value'
    },
    {
      id: 'clarity',
      title: 'Clarity Check',
      status: 'pending',
      options: ['Yes', 'No'],
      description: 'Check if the question is clear'
    },
    {
      id: 'grounded',
      title: 'Image Grounded Check',
      status: 'pending',
      options: ['True', 'False', 'N/A'],
      description: 'Check if images are properly referenced (if any)'
    },
    {
      id: 'consensus',
      title: 'Consensus by 3 annotators',
      status: 'pending',
      options: ['Agreement', 'No Agreement'],
      description: 'Check if there is consensus among annotators'
    }
  ]);
  
  // Task 2 subtasks
  const [task2SubTasks, setTask2SubTasks] = useState<SubTask[]>([
    {
      id: 'aspects',
      title: 'Addresses All Aspects',
      status: 'pending',
      options: ['Yes', 'No'],
      description: 'Check if the answer addresses all aspects of the question'
    },
    {
      id: 'explanation',
      title: 'Explanation Provided',
      status: 'pending',
      options: ['Yes', 'No'],
      description: 'Check if the answer provides an explanation'
    },
    {
      id: 'execution',
      title: 'Manual Code Execution Check',
      status: 'pending',
      options: ['Executable', 'Not Executable', 'N/A'],
      description: 'Check if the provided code is executable'
    },
    {
      id: 'download',
      title: 'Provide Code Download Link',
      status: 'pending',
      options: ['Provided', 'Not Provided', 'N/A'],
      description: 'Check if a code download link is provided'
    },
    {
      id: 'consensus',
      title: 'Consensus by 3 annotators',
      status: 'pending',
      options: ['Agreement', 'No Agreement'],
      description: 'Check if there is consensus among annotators'
    }
  ]);
  
  // Task 3 subtasks
  const [task3SubTasks, setTask3SubTasks] = useState<SubTask[]>([
    {
      id: 'rewrite',
      title: 'Rewrite Question Clearly',
      status: 'pending',
      options: ['Completed', 'Not Needed'],
      description: 'Rewrite the question in a clear and concise manner'
    },
    {
      id: 'shortAnswer',
      title: 'Prepare Short Answer List',
      status: 'pending',
      options: ['Completed', 'Not Needed'],
      description: 'Break down into atomic, concise claims'
    },
    {
      id: 'longAnswer',
      title: 'Construct Coherent Long Answer',
      status: 'pending',
      options: ['Completed', 'Not Needed'],
      description: 'Combine claims, smooth language, add reasoning'
    },
    {
      id: 'classify',
      title: 'Classify Question Type',
      status: 'pending',
      options: ['Search', 'Reasoning'],
      description: 'Classify the question as "Search" or "Reasoning"'
    },
    {
      id: 'supporting',
      title: 'Provide Supporting Docs',
      status: 'pending',
      options: ['Provided', 'Not Needed'],
      description: 'Annotate relevant references'
    },
    {
      id: 'consensus',
      title: 'Consensus by 5 annotators',
      status: 'pending',
      options: ['Agreement', 'No Agreement'],
      description: 'Check if there is consensus among annotators'
    }
  ]);
  
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

  const handleSubTaskChange = (taskSet: string, taskId: string, selectedOption?: string) => {
    let updated: SubTask[] = [];

    if (taskSet === 'task1') {
      updated = task1SubTasks.map(task => 
        task.id === taskId 
          ? { 
              ...task, 
              selectedOption, 
              status: selectedOption ? 'completed' : 'pending'
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
              status: selectedOption ? 'completed' : 'pending'
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
              status: selectedOption ? 'completed' : 'pending'
            } 
          : task
      );
      setTask3SubTasks(updated);
    }

    checkForSubtaskLogic(taskSet, taskId, selectedOption);
  };

  const checkForSubtaskLogic = (taskSet: string, taskId: string, selectedOption?: string) => {
    // Special logic for Task 1
    if (taskSet === 'task1') {
      // If relevance is No, mark the rest as N/A
      if (taskId === 'relevance' && selectedOption === 'No') {
        setTask1SubTasks(task1SubTasks.map(task => {
          if (task.id !== 'relevance') {
            return { ...task, status: 'na', selectedOption: 'N/A' };
          }
          return task;
        }));
      }
      // If learning is No, mark the rest as N/A
      if (taskId === 'learning' && selectedOption === 'No') {
        setTask1SubTasks(task1SubTasks.map(task => {
          if (task.id !== 'relevance' && task.id !== 'learning') {
            return { ...task, status: 'na', selectedOption: 'N/A' };
          }
          return task;
        }));
      }
    }
  };

  const getTask1Progress = () => {
    const completed = task1SubTasks.filter(t => t.status === 'completed' || t.status === 'na').length;
    if (completed === task1SubTasks.length) return 'completed';
    if (completed > 0) return 'inProgress';
    return 'pending';
  };

  const getTask2Progress = () => {
    const completed = task2SubTasks.filter(t => t.status === 'completed' || t.status === 'na').length;
    if (completed === task2SubTasks.length) return 'completed';
    if (completed > 0) return 'inProgress';
    return 'pending';
  };

  const getTask3Progress = () => {
    const completed = task3SubTasks.filter(t => t.status === 'completed' || t.status === 'na').length;
    if (completed === task3SubTasks.length) return 'completed';
    if (completed > 0) return 'inProgress';
    return 'pending';
  };

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
    getTask3Progress
  };
}
