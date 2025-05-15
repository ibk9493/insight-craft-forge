
import { useState, useCallback } from 'react';
import { SubTask, SubTaskStatus } from '@/components/dashboard/TaskCard';

export function useTaskSubtasks() {
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
      description: 'Provide a link to download the code'
    },
    {
      id: 'justification',
      title: 'Justification',
      status: 'pending',
      description: 'Provide justification for your answers',
      textInput: true
    }
  ]);
  
  // Task 3 subtasks
  const [task3SubTasks, setTask3SubTasks] = useState<SubTask[]>([
    {
      id: 'rewrite',
      title: 'Rewrite Question',
      status: 'pending',
      options: ['Completed', 'Not Needed'],
      description: 'Rewrite the question in a clear and concise manner',
      textInput: true
    },
    {
      id: 'shortAnswer',
      title: 'Short Answer List',
      status: 'pending',
      options: ['Completed', 'Not Needed'],
      description: 'Provide a list of short answers',
      textInput: true
    },
    {
      id: 'longAnswer',
      title: 'Long Answer',
      status: 'pending',
      options: ['Completed', 'Not Needed'],
      description: 'Provide a comprehensive answer',
      textInput: true
    },
    {
      id: 'classify',
      title: 'Question Type',
      status: 'pending',
      options: ['Search', 'Reasoning'],
      description: 'Classify the question type'
    },
    {
      id: 'supporting',
      title: 'Supporting Docs',
      status: 'pending',
      options: ['Provided', 'Not Needed'],
      description: 'Provide links to supporting documentation',
      textInput: true
    }
  ]);

  // For consensus tasks (pod lead only)
  const [consensusTask1, setConsensusTask1] = useState<SubTask[]>([]);
  const [consensusTask2, setConsensusTask2] = useState<SubTask[]>([]);
  const [consensusTask3, setConsensusTask3] = useState<SubTask[]>([]);

  const handleSubTaskChange = useCallback((taskSet: string, taskId: string, selectedOption?: string, textValue?: string) => {
    if (taskSet === 'task1') {
      const updatedTasks = task1SubTasks.map(task => 
        task.id === taskId 
          ? { 
              ...task, 
              selectedOption,
              textValue,
              status: (selectedOption || textValue) ? 'completed' as SubTaskStatus : 'pending' as SubTaskStatus
            } 
          : task
      );
      setTask1SubTasks(updatedTasks);
    } else if (taskSet === 'task2') {
      const updatedTasks = task2SubTasks.map(task => 
        task.id === taskId 
          ? { 
              ...task, 
              selectedOption,
              textValue,
              status: (selectedOption || textValue) ? 'completed' as SubTaskStatus : 'pending' as SubTaskStatus
            } 
          : task
      );
      setTask2SubTasks(updatedTasks);
    } else if (taskSet === 'task3') {
      const updatedTasks = task3SubTasks.map(task => 
        task.id === taskId 
          ? { 
              ...task, 
              selectedOption,
              textValue,
              status: (selectedOption || textValue) ? 'completed' as SubTaskStatus : 'pending' as SubTaskStatus
            } 
          : task
      );
      setTask3SubTasks(updatedTasks);
    } else if (taskSet === 'consensus1') {
      const updatedTasks = consensusTask1.map(task => 
        task.id === taskId 
          ? { 
              ...task, 
              selectedOption,
              textValue,
              status: (selectedOption || textValue) ? 'completed' as SubTaskStatus : 'pending' as SubTaskStatus
            } 
          : task
      );
      setConsensusTask1(updatedTasks);
    } else if (taskSet === 'consensus2') {
      const updatedTasks = consensusTask2.map(task => 
        task.id === taskId 
          ? { 
              ...task, 
              selectedOption,
              textValue,
              status: (selectedOption || textValue) ? 'completed' as SubTaskStatus : 'pending' as SubTaskStatus
            } 
          : task
      );
      setConsensusTask2(updatedTasks);
    } else if (taskSet === 'consensus3') {
      const updatedTasks = consensusTask3.map(task => 
        task.id === taskId 
          ? { 
              ...task, 
              selectedOption,
              textValue,
              status: (selectedOption || textValue) ? 'completed' as SubTaskStatus : 'pending' as SubTaskStatus
            } 
          : task
      );
      setConsensusTask3(updatedTasks);
    }
  }, [task1SubTasks, task2SubTasks, task3SubTasks, consensusTask1, consensusTask2, consensusTask3]);

  return {
    task1SubTasks,
    setTask1SubTasks,
    task2SubTasks,
    setTask2SubTasks,
    task3SubTasks,
    setTask3SubTasks,
    consensusTask1,
    setConsensusTask1,
    consensusTask2,
    setConsensusTask2,
    consensusTask3,
    setConsensusTask3,
    handleSubTaskChange
  };
}
