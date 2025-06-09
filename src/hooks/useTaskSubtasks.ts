import { useState, useCallback } from 'react';
import { SubTask, SubTaskStatus, SupportingDoc } from '@/components/dashboard/TaskCard';
import { toast } from 'sonner';
import { validateTask } from '@/utils/validation';
import { parseTaskStatus } from '@/services/api';

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
    imageLinks: task.imageLinks ? [] : undefined,
    multiline: task.multiline,
    structuredInput: task.structuredInput,
    requiresRemarks: task.requiresRemarks,
    placeholder: task.placeholder,
    validation: task.validation, // Preserve validation rules
    validationError: undefined // Reset validation error
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
      requiresRemarks: true,
      validation: {
        required: true,
        custom: (task) => {
          if (!task.selectedOption) return 'Please select an option';
          
          // Require explanation for both options
          if (!task.textValue || task.textValue.trim().length < 10) {
            return 'Please provide an explanation for your choice (minimum 10 characters)';
          }
          
          return null;
        }
      }
    },
    {
      id: 'learning',
      title: 'Learning Value Check',
      status: 'pending' as SubTaskStatus,
      options: ['Yes', 'No'],
      description: 'Check if the question has learning value',
      requiresRemarks: true,
      validation: {
        required: true,
        custom: (task) => {
          if (!task.selectedOption) return 'Please select an option';
          if (!task.textValue || task.textValue.trim().length < 10) {
            return 'Please provide an explanation for your choice (minimum 10 characters)';
          }
          return null;
        }
      }
    },
    {
      id: 'clarity',
      title: 'Clarity Check',
      status: 'pending' as SubTaskStatus,
      options: ['Yes', 'No'],
      description: 'Check if the question is clear',
      requiresRemarks: true,
      validation: {
        required: true,
        custom: (task) => {
          if (!task.selectedOption) return 'Please select an option';
          if (!task.textValue || task.textValue.trim().length < 10) {
            return 'Please provide an explanation for your choice (minimum 10 characters)';
          }
          return null;
        }
      }
    },
    {
      id: 'grounded',
      title: 'Image Grounded Check',
      status: 'pending' as SubTaskStatus,
      options: ['True', 'False', 'N/A'],
      description: 'Check if images are properly referenced (if any)',
      requiresRemarks: true,
      validation: {
        required: true,
        custom: (task) => {
          if (!task.selectedOption) return 'Please select an option';
          if (task.selectedOption === 'True' && (!task.textValue || task.textValue.trim().length < 10)) {
            return 'Please explain why images are properly grounded (minimum 10 characters)';
          }
          if (task.selectedOption === 'False' && (!task.textValue || task.textValue.trim().length < 10)) {
            return 'Please explain why images are not properly grounded (minimum 10 characters)';
          }
          return null;
        }
      }
    }
  ]);
  
  // Task 2 subtasks
 // Fixed Task 2 subtasks with corrected validation logic
const [task2SubTasks, setTask2SubTasks] = useState<SubTask[]>([
  {
    id: 'aspects',
    title: 'Addresses All Aspects',
    status: 'pending' as SubTaskStatus,
    options: ['Yes', 'No'],
    description: 'Check if the answer addresses all aspects of the question',
    requiresRemarks: true,
    validation: {
      required: true,
      custom: (task) => {
        if (!task.selectedOption) return 'Please select an option';
        if (!task.textValue || task.textValue.trim().length < 10) {
          return 'Please provide an explanation for your choice (minimum 10 characters)';
        }
        return null;
      }
    }
  },
  {
    id: 'explanation',
    title: 'Explanation Provided',
    status: 'pending' as SubTaskStatus,
    options: ['Yes', 'No'],
    description: 'Check if the answer provides an explanation',
    requiresRemarks: true,
    validation: {
      required: true,
      custom: (task) => {
        if (!task.selectedOption) return 'Please select an option';
        if (!task.textValue || task.textValue.trim().length < 10) {
          return 'Please provide an explanation for your choice (minimum 10 characters)(Same as address all aspects)';
        }
        return null;
      }
    }
  },
  {
    id: 'execution',
    title: 'Manual Code Execution Check',
    status: 'pending' as SubTaskStatus,
    options: ['Executable', 'Not Executable', 'N/A'],
    description: 'Check if the provided code is executable',
    requiresRemarks: true,
    validation: {
      required: true,
      custom: (task) => {
        if (!task.selectedOption) return 'Please select an option';
        
        // Always require explanation, but stricter for "Not Executable"
        if (!task.textValue || task.textValue.trim().length < 5) {
          return 'Please provide an explanation for your choice (minimum 5 characters)';
        }
        
        if (task.selectedOption === 'Not Executable' && task.textValue.trim().length < 15) {
          return 'Please provide a detailed explanation of why the code is not executable (minimum 15 characters)';
        }
        
        return null;
      }
    }
  },
  {
    id: 'download',
    title: 'Provide Code Download Link',
    status: 'pending' as SubTaskStatus,
    options: ['Provided', 'Not Provided', 'N/A'],
    description: 'Check if a code download link is provided',
    requiresRemarks: true,
    validation: {
      required: true,
      custom: (task) => {
        if (!task.selectedOption) return 'Please select an option';
        if (!task.textValue || task.textValue.trim().length < 5) {
          return 'Please provide an explanation for your choice (minimum 5 characters)';
        }
        return null;
      }
    }
  },
  {
    id: 'screenshot',
    title: 'Screenshot Google Drive URL',
    status: 'pending' as SubTaskStatus,
    options: ['Provided', 'Not Needed'],
    description: 'Provide Google Drive URL for the screenshot',
    textInput: true,
    textValue: '',
    placeholder: 'Enter Google Drive URL for the screenshot',
    validation: {
      custom: (task) => {
        if (task.selectedOption === 'Provided' && (!task.textValue || task.textValue.trim().length === 0)) {
          return 'Please provide the Google Drive URL';
        }
        if (task.textValue && task.textValue.trim() && !task.textValue.includes('drive.google.com')) {
          return 'Please provide a valid Google Drive URL (must contain drive.google.com)';
        }
        return null;
      }
    }
  },
  {
    id: 'codeDownloadUrl',
    title: 'Code Download URL',
    status: 'pending' as SubTaskStatus,
    options: ['Verified manually', 'Not verified'],
    description: 'Provide and verify the code download URL',
    textInput: true,
    textValue: '',
    placeholder: 'https://github.com/owner/repo/archive/refs/tags/version.tar.gz',
    enableDocDownload: false,
    docDownloadLink: '',
    validation: {
      custom: (task) => {
        if (task.selectedOption === 'Verified manually' && (!task.textValue || task.textValue.trim().length === 0)) {
          return 'Please provide the code download URL';
        }
        // Optional: Add URL format validation
        if (task.textValue && task.textValue.trim() && !task.textValue.startsWith('http')) {
          return 'Please provide a valid URL starting with http:// or https://';
        }
        return null;
      }
    }
  }
]);
  
  // Task 3 subtasks with improved support for multi-line answers and structured data
 // Fixed Task 3 subtasks with corrected validation logic
const [task3SubTasks, setTask3SubTasks] = useState<SubTask[]>([
  {
    id: 'rewrite',
    title: 'Rewrite Question Clearly',
    status: 'pending' as SubTaskStatus,
    options: ['Completed', 'Not Needed'],
    description: 'Rewrite the question in a clear and concise manner',
    textInput: true,
    textValue: '',
    validation: {
      custom: (task) => {
        if (task.selectedOption === 'Completed' && (!task.textValue || task.textValue.trim().length < 10)) {
          return 'Please provide the rewritten question (minimum 10 characters)';
        }
        return null;
      }
    }
  },
  // Updated validation for short_answer_list in useTaskSubtasks.js
{
  id: 'short_answer_list',
  title: 'Prepare Short Answer List',
  status: 'pending' as SubTaskStatus,
  options: ['Completed', 'Not Needed'],
  description: 'Break down into atomic, concise claims with weights (1-3 priority)',
  textInput: true,
  textValues: [''], // Initialize with one empty entry
  weights: [3], // Initialize with default weight
  multiline: true,
  placeholder: 'Enter a short answer claim',
  validation: {
    custom: (task) => {
      // ✅ FIXED: Check for content regardless of selectedOption
      const hasContent = task.textValues && task.textValues.filter(v => v.trim()).length > 0;
      
      // If user has entered content, validate it
      if (hasContent) {
        const nonEmptyValues = task.textValues.filter(v => v.trim());
        const weights = task.weights || [];
        
        // Check if we have at least one claim with weight 3 (core claim)
        let hasCoreClaimWeight3 = false;
        
        // Validate each claim
        for (let i = 0; i < nonEmptyValues.length; i++) {
          const value = nonEmptyValues[i];
          const weight = weights[i] || 1;
          
          // Check minimum length for each claim
          if (value.trim().length < 5) {
            return `Claim ${i + 1} must be at least 5 characters long`;
          }
          
          // Check if this claim has weight 3 (core claim)
          if (weight === 3) {
            hasCoreClaimWeight3 = true;
          }
        }
        
        // Require at least one core claim (weight 3)
        if (!hasCoreClaimWeight3) {
          return 'At least one claim should be a core claim (Weight 3)';
        }
      }
      
      // If selectedOption is explicitly set to 'Completed', ensure content exists
      if (task.selectedOption === 'Completed' && !hasContent) {
        return 'Please provide at least one short answer claim';
      }
      
      return null;
    }
  }
  },
  {
    id: 'longAnswer',
    title: 'Construct Coherent Long Answer',
    status: 'pending' as SubTaskStatus,
    options: ['Completed', 'Not Needed'],
    description: 'Combine claims, smooth language, add reasoning',
    textInput: true,
    textValue: '',
    validation: {
      custom: (task) => {
        if (task.selectedOption === 'Completed' && (!task.textValue || task.textValue.trim().length < 20)) {
          return 'Please provide a coherent long answer (minimum 20 characters)';
        }
        return null;
      }
    }
  },
  {
    id: 'classify',
    title: 'Classify Question Type',
    status: 'pending' as SubTaskStatus,
    options: ['Search', 'Reasoning'],
    description: 'Classify the question as "Search" or "Reasoning"',
    validation: {
      required: true,
      custom: (task) => {
        if (!task.selectedOption) {
          return 'Please select a question type';
        }
        return null;
      }
    }
  },
  {
    id: 'supporting_docs',
    title: 'Provide Supporting Docs',
    status: 'pending' as SubTaskStatus,
    options: ['Provided', 'Not Needed'],
    description: 'Add supporting documentation with links (must start with "downloads/") and paragraphs',
    structuredInput: true,
    supportingDocs: [{ link: '', paragraph: '' }], // Initialize with one empty set
    validation: {
      custom: (task) => {
        if (task.selectedOption === 'Provided') {
          if (!task.supportingDocs || task.supportingDocs.filter(d => d.link.trim() && d.paragraph.trim()).length === 0) {
            return 'Please provide at least one supporting document with both link and paragraph';
          }
          for (const doc of task.supportingDocs) {
            if (doc.link.trim() && !doc.link.startsWith('downloads/')) {
              return 'Supporting document links must start with "downloads/"';
            }
            if (doc.link.trim() && doc.paragraph.trim().length < 10) {
              return 'Supporting paragraphs must be at least 10 characters long';
            }
          }
        }
        return null;
      }
    }
  },
  {
    id: 'doc_download_link',
    title: 'Document Download Link (Optional)',
    status: 'pending' as SubTaskStatus,
    options: ['Needed', 'Not Needed'],
    description: 'Provide download link for external documentation if supporting docs are not directly from code',
    textInput: true,
    textValue: '',
    validation: {
      custom: (task) => {
        if (task.selectedOption === 'Needed' && (!task.textValue || task.textValue.trim().length === 0)) {
          return 'Please provide the document download link';
        }
        if (task.selectedOption === 'Not Needed' && task.textValue && task.textValue.trim() && !task.textValue.startsWith('http')) {
          return 'Please provide a valid URL starting with http:// or https://';
        }
        return null;
      }
    }
  },
  {
    id: 'question_image_links',
    title: 'Question Image Links (Optional)',
    status: 'pending' as SubTaskStatus,
    description: 'Add links to images related to the question',
    options: ['Provided', 'Not Needed'],
    structuredInput: true,
    placeholder: 'Enter image URL...',
    imageLinks: [''], // Initialize with one empty link
    validation: {
      custom: (task) => {
        if (task.selectedOption === 'Provided') {
          if (!task.imageLinks || task.imageLinks.filter(link => link.trim()).length === 0) {
            return 'Please provide at least one image link';
          }
          for (const link of task.imageLinks) {
            if (link.trim() && !link.startsWith('http')) {
              return 'Image links must be valid URLs starting with http:// or https://';
            }
          }
        }
        return null;
      }
    }
  }
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
    sectionIndex?: number,
    weights?: number[],
    docDownloadLink?: string,
    imageLinks?: string[]
  ) => {
    const updateTaskWithValidation = (task: SubTask): SubTask => {
      if (task.id === taskId) {
        const updatedTask = {
          ...task,
          selectedOption,
          textValue: textValue !== undefined ? textValue : task.textValue,
          textValues: textValues !== undefined ? textValues : task.textValues,
          supportingDocs: supportingDocs !== undefined ? supportingDocs : task.supportingDocs,
          imageLinks: imageLinks !== undefined ? imageLinks : task.imageLinks,
          weights: weights !== undefined ? weights : task.weights,
          docDownloadLink: docDownloadLink !== undefined ? docDownloadLink : task.docDownloadLink,
          status: (selectedOption || (textValue !== undefined) || (textValues !== undefined) || (supportingDocs !== undefined) || (imageLinks !== undefined)) ? 'completed' as SubTaskStatus : parseTaskStatus(task.status).status
        };
        
        // Validate the updated task
        const validationError = validateTask(updatedTask);
        updatedTask.validationError = validationError;
        
        return updatedTask;
      }
      return task;
    };
  
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
        updatedSections[sectionIndex] = updatedSections[sectionIndex].map(updateTaskWithValidation);
        setTask3Sections(updatedSections);
        return;
      }
      
      if (taskSet === 'task1') {
        const updated = task1SubTasks.map(updateTaskWithValidation);
        setTask1SubTasks(updated);
        
        // Special logic for Task 1
        // If relevance is No, mark the rest as N/A
        // if (taskId === 'relevance' && selectedOption === 'No') {
        //   setTask1SubTasks(prev => prev.map(task => {
        //     if (task.id !== 'relevance' && task.id !== 'consensus') {
        //       return { ...task, status: 'na' as SubTaskStatus, selectedOption: 'N/A', validationError: undefined };
        //     }
        //     return task;
        //   }));
        // }
        
        // If learning is No, mark the rest as N/A
        // if (taskId === 'learning' && selectedOption === 'No') {
        //   setTask1SubTasks(prev => prev.map(task => {
        //     if (task.id !== 'relevance' && task.id !== 'learning' && task.id !== 'consensus') {
        //       return { ...task, status: 'na' as SubTaskStatus, selectedOption: 'N/A', validationError: undefined };
        //     }
        //     return task;
        //   }));
        // }
      } else if (taskSet === 'task2') {
        const updated = task2SubTasks.map(updateTaskWithValidation);
        setTask2SubTasks(updated);
      } else if (taskSet === 'task3') {
        const updated = task3SubTasks.map(updateTaskWithValidation);
        setTask3SubTasks(updated);
      } else if (taskSet === 'consensus1') {
        const updated = consensusTask1.map(updateTaskWithValidation);
        setConsensusTask1(updated);
      } else if (taskSet === 'consensus2') {
        const updated = consensusTask2.map(updateTaskWithValidation);
        setConsensusTask2(updated);
      } else if (taskSet === 'consensus3') {
        const updated = consensusTask3.map(updateTaskWithValidation);
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