import { useState, useCallback } from 'react';
import { SubTask, SubTaskStatus } from '@/components/dashboard/TaskCard';
import { toast } from 'sonner';

export function useTaskSubtasks() {
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
  
  // Task 3 subtasks with improved support for multi-line answers and structured data
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
      id: 'short_answer_list',
      title: 'Prepare Short Answer List',
      status: 'pending' as SubTaskStatus,
      options: ['Completed', 'Not Needed'],
      description: 'Break down into atomic, concise claims (one per line)',
      textInput: true,
      textValue: '',
      multiline: true,
      placeholder: 'Enter each short answer on a new line:\nShort answer 1\nShort answer 2\netc.'
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
      id: 'supporting_docs',
      title: 'Provide Supporting Docs',
      status: 'pending' as SubTaskStatus,
      options: ['Provided', 'Not Needed'],
      description: 'Format as: Link: URL\nParagraph: Text\n(repeat for multiple)',
      textInput: true,
      textValue: '',
      multiline: true,
      placeholder: 'Link: https://example.com/docs/file.html\nParagraph: The relevant section of documentation\n\nLink: https://another-example.com\nParagraph: Another supporting paragraph'
    },
    {
      id: 'consensus',
      title: 'Consensus by 5 annotators',
      status: 'pending' as SubTaskStatus,
      options: ['Agreement', 'No Agreement'],
      description: 'System-determined consensus based on annotator submissions'
    }
  ]);

  // Consensus tasks
  const [consensusTask1, setConsensusTask1] = useState<SubTask[]>([...task1SubTasks]);
  const [consensusTask2, setConsensusTask2] = useState<SubTask[]>([...task2SubTasks]);
  const [consensusTask3, setConsensusTask3] = useState<SubTask[]>([...task3SubTasks]);

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
        
        // Special logic for Task 1
        // If relevance is No, mark the rest as N/A
        if (taskId === 'relevance' && selectedOption === 'No') {
          setTask1SubTasks(prev => prev.map(task => {
            if (task.id !== 'relevance' && task.id !== 'consensus') {
              return { ...task, status: 'na' as SubTaskStatus, selectedOption: 'N/A' };
            }
            return task;
          }));
        }
        
        // If learning is No, mark the rest as N/A
        if (taskId === 'learning' && selectedOption === 'No') {
          setTask1SubTasks(prev => prev.map(task => {
            if (task.id !== 'relevance' && task.id !== 'learning' && task.id !== 'consensus') {
              return { ...task, status: 'na' as SubTaskStatus, selectedOption: 'N/A' };
            }
            return task;
          }));
        }
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
      } else if (taskSet === 'consensus1') {
        updated = consensusTask1.map(task => 
          task.id === taskId 
            ? { 
                ...task, 
                selectedOption, 
                textValue: textValue !== undefined ? textValue : task.textValue,
                status: selectedOption ? 'completed' as SubTaskStatus : 'pending' as SubTaskStatus
              } 
            : task
        );
        setConsensusTask1(updated);
      } else if (taskSet === 'consensus2') {
        updated = consensusTask2.map(task => 
          task.id === taskId 
            ? { 
                ...task, 
                selectedOption, 
                textValue: textValue !== undefined ? textValue : task.textValue,
                status: selectedOption ? 'completed' as SubTaskStatus : 'pending' as SubTaskStatus
              } 
            : task
        );
        setConsensusTask2(updated);
      } else if (taskSet === 'consensus3') {
        updated = consensusTask3.map(task => 
          task.id === taskId 
            ? { 
                ...task, 
                selectedOption, 
                textValue: textValue !== undefined ? textValue : task.textValue,
                status: selectedOption ? 'completed' as SubTaskStatus : 'pending' as SubTaskStatus
              } 
            : task
        );
        setConsensusTask3(updated);
      }
    } catch (error) {
      console.error("Error in handleSubTaskChange:", error);
      toast.error("Failed to update task. Please try again.");
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
