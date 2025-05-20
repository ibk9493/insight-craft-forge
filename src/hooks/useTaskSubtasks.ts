import { useState, useCallback } from 'react';
import { SubTask, SubTaskStatus, SupportingDoc } from '@/components/dashboard/TaskCard';
import { toast } from 'sonner';

// Clone a subtask array for creating new sections
const cloneSubtasks = (subtasks: SubTask[]): SubTask[] => {
  return subtasks.map(task => ({
    ...task,
    id: task.id,
    title: task.title,
    status: 'pending' as SubTaskStatus,
    options: task.options ? [...task.options] : undefined,
    selectedOption: undefined,
    description: task.description,
    textInput: task.textInput,
    textValue: '',
    textValues: task.multiline ? [''] : undefined,
    supportingDocs: task.structuredInput ? [{ link: '', paragraph: '' }] : undefined,
    multiline: task.multiline,
    structuredInput: task.structuredInput,
    requiresRemarks: task.requiresRemarks,
    placeholder: task.placeholder
  }));
};

export function useTaskSubtasks() {
  // Task 1 subtasks
  const [task1SubTasks, setTask1SubTasks] = useState<SubTask[]>([
    {
      id: 'relevance',
      title: 'Relevance Check',
      status: 'pending' as SubTaskStatus,
      options: ['Yes', 'No'],
      description: 'Check if the question is relevant to the topic',
      requiresRemarks: true
    },
    {
      id: 'learning',
      title: 'Learning Value Check',
      status: 'pending' as SubTaskStatus,
      options: ['Yes', 'No'],
      description: 'Check if the question has learning value',
      requiresRemarks: true
    },
    {
      id: 'clarity',
      title: 'Clarity Check',
      status: 'pending' as SubTaskStatus,
      options: ['Yes', 'No'],
      description: 'Check if the question is clear',
      requiresRemarks: true
    },
    {
      id: 'grounded',
      title: 'Image Grounded Check',
      status: 'pending' as SubTaskStatus,
      options: ['True', 'False', 'N/A'],
      description: 'Check if images are properly referenced (if any)',
      requiresRemarks: true
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
      description: 'Check if the answer provides an explanation',
      requiresRemarks: true
    },
    {
      id: 'execution',
      title: 'Manual Code Execution Check',
      status: 'pending' as SubTaskStatus,
      options: ['Executable', 'Not Executable', 'N/A'],
      description: 'Check if the provided code is executable',
      requiresRemarks: true
    },
    {
      id: 'download',
      title: 'Provide Code Download Link',
      status: 'pending' as SubTaskStatus,
      options: ['Provided', 'Not Provided', 'N/A'],
      description: 'Check if a code download link is provided',
      requiresRemarks: true
    }
    // ,
    // {
    //   id: 'consensus',
    //   title: 'Consensus by 3 annotators',
    //   status: 'pending' as SubTaskStatus,
    //   options: ['Agreement', 'No Agreement'],
    //   description: 'System-determined consensus based on annotator submissions',
    //   requiresRemarks: true
    // }
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
      textValues: [''], // Initialize with one empty entry
      multiline: true,
      placeholder: 'Enter a short answer claim'
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
      description: 'Add supporting documentation with links and paragraphs',
      structuredInput: true, // Using structured input instead of multiline
      supportingDocs: [{ link: '', paragraph: '' }], // Initialize with one empty set
    }
    // ,
    // {
    //   id: 'consensus',
    //   title: 'Consensus by 5 annotators',
    //   status: 'pending' as SubTaskStatus,
    //   options: ['Agreement', 'No Agreement'],
    //   description: 'System-determined consensus based on annotator submissions'
    // }
  ]);

  // Task 3 additional sections (for multiple forms)
  const [task3Sections, setTask3Sections] = useState<SubTask[][]>([]);

  // Consensus tasks
  const [consensusTask1, setConsensusTask1] = useState<SubTask[]>([...task1SubTasks]);
  const [consensusTask2, setConsensusTask2] = useState<SubTask[]>([...task2SubTasks]);
  const [consensusTask3, setConsensusTask3] = useState<SubTask[]>([...task3SubTasks]);

  // Add a new section to Task 3
  const addTask3Section = useCallback(() => {
    try {
      // Clone the base subtasks but remove the consensus task
      const newSectionTasks = cloneSubtasks(
        task3SubTasks.filter(task => task.id !== 'consensus')
      );
      
      setTask3Sections([...task3Sections, newSectionTasks]);
      toast.success('Added new form section');
    } catch (error) {
      console.error("Error adding task section:", error);
      toast.error("Failed to add section. Please try again.");
    }
  }, [task3SubTasks, task3Sections]);

  // Remove a section from Task 3
  const removeTask3Section = useCallback((sectionIndex: number) => {
    try {
      if (sectionIndex < 0 || sectionIndex >= task3Sections.length) {
        return;
      }
      
      const updatedSections = [...task3Sections];
      updatedSections.splice(sectionIndex, 1);
      setTask3Sections(updatedSections);
      
      toast.success('Removed form section');
    } catch (error) {
      console.error("Error removing task section:", error);
      toast.error("Failed to remove section. Please try again.");
    }
  }, [task3Sections]);

  const handleSubTaskChange = useCallback((
    taskSet: string, 
    taskId: string, 
    selectedOption?: string, 
    textValue?: string, 
    textValues?: string[],
    supportingDocs?: SupportingDoc[],
    sectionIndex?: number
  ) => {
    let updated: SubTask[] = [];

    // Skip changes to consensus fields as they're system-determined
    if (taskId === 'consensus') {
      return;
    }

    try {
      // Handle updates to additional sections for Task 3
      if (taskSet === 'task3' && sectionIndex !== undefined) {
        if (sectionIndex < 0 || sectionIndex >= task3Sections.length) {
          console.error(`[useTaskSubtasks] Invalid section index: ${sectionIndex}`);
          return;
        }
        
        const updatedSections = [...task3Sections];
        const originalSectionTasks = task3Sections[sectionIndex];
        updatedSections[sectionIndex] = updatedSections[sectionIndex].map(task => {
          if (task.id === taskId) {
            const newTaskData = {
              ...task,
              selectedOption,
              textValue: textValue !== undefined ? textValue : task.textValue,
              textValues: textValues !== undefined ? textValues : task.textValues,
              supportingDocs: supportingDocs !== undefined ? supportingDocs : task.supportingDocs,
              status: selectedOption ? 'completed' as SubTaskStatus : task.status
            };
            return newTaskData;
          }
          return task;
        });
        setTask3Sections(updatedSections);
        return;
      }
      
      if (taskSet === 'task1') {
        updated = task1SubTasks.map(task => 
          task.id === taskId 
            ? { 
                ...task, 
                selectedOption, 
                textValue: textValue !== undefined ? textValue : task.textValue,
                textValues: textValues !== undefined ? textValues : task.textValues,
                supportingDocs: supportingDocs !== undefined ? supportingDocs : task.supportingDocs,
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
                textValues: textValues !== undefined ? textValues : task.textValues,
                supportingDocs: supportingDocs !== undefined ? supportingDocs : task.supportingDocs,
                status: selectedOption ? 'completed' as SubTaskStatus : 'pending' as SubTaskStatus
              } 
            : task
        );
        setTask2SubTasks(updated);
      } else if (taskSet === 'task3') {
        updated = task3SubTasks.map(task => {
          if (task.id === taskId) {
            const newTaskData = {
              ...task,
              selectedOption,
              textValue: textValue !== undefined ? textValue : task.textValue,
              textValues: textValues !== undefined ? textValues : task.textValues,
              supportingDocs: supportingDocs !== undefined ? supportingDocs : task.supportingDocs,
              status: selectedOption ? 'completed' as SubTaskStatus : task.status // Potential: if selectedOption is undefined, status doesn't change to pending
            };
            return newTaskData;
          }
          return task;
        });
        setTask3SubTasks(updated);
      } else if (taskSet === 'consensus1') {
        updated = consensusTask1.map(task => 
          task.id === taskId 
            ? { 
                ...task, 
                selectedOption, 
                textValue: textValue !== undefined ? textValue : task.textValue,
                textValues: textValues !== undefined ? textValues : task.textValues,
                supportingDocs: supportingDocs !== undefined ? supportingDocs : task.supportingDocs,
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
                textValues: textValues !== undefined ? textValues : task.textValues,
                supportingDocs: supportingDocs !== undefined ? supportingDocs : task.supportingDocs,
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
                textValues: textValues !== undefined ? textValues : task.textValues,
                supportingDocs: supportingDocs !== undefined ? supportingDocs : task.supportingDocs,
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
  }, [task1SubTasks, task2SubTasks, task3SubTasks, task3Sections, consensusTask1, consensusTask2, consensusTask3]);

  // Calculate progress for Task 3 (including all sections)
  const getTask3Progress = useCallback(() => {
    try {
      const mainCompleted = task3SubTasks.filter(t => t.status === 'completed' || t.status === 'na').length;
      const mainTotal = task3SubTasks.length;
      
      // Check all additional sections
      let sectionsCompleted = 0;
      let sectionsTotal = 0;
      
      task3Sections.forEach(section => {
        const sectionCompleted = section.filter(t => t.status === 'completed' || t.status === 'na').length;
        const sectionTotal = section.length;
        
        sectionsCompleted += sectionCompleted;
        sectionsTotal += sectionTotal;
      });
      
      const totalCompleted = mainCompleted + sectionsCompleted;
      const totalTasks = mainTotal + sectionsTotal;
      
      if (totalCompleted === totalTasks) return 'completed';
      if (totalCompleted > 0) return 'inProgress';
      return 'pending';
    } catch (error) {
      console.error("Error getting task progress:", error);
      return 'pending';
    }
  }, [task3SubTasks, task3Sections]);

  return {
    task1SubTasks, 
    setTask1SubTasks,
    task2SubTasks, 
    setTask2SubTasks,
    task3SubTasks, 
    setTask3SubTasks,
    task3Sections,
    setTask3Sections,
    addTask3Section,
    removeTask3Section,
    consensusTask1, 
    setConsensusTask1,
    consensusTask2, 
    setConsensusTask2,
    consensusTask3, 
    setConsensusTask3,
    handleSubTaskChange,
    getTask3Progress
  };
}