
import { useState } from 'react';
import { SubTask, SubTaskStatus } from '@/components/dashboard/TaskCard';
import { Annotation } from '@/services/api';
import { toast } from 'sonner';

interface AnnotationLoaderProps {
  task1SubTasks: SubTask[];
  task2SubTasks: SubTask[];
  task3SubTasks: SubTask[];
  getUserAnnotation: (discussionId: string, userId: string, taskId: number) => Annotation | undefined;
  getConsensusAnnotation: (discussionId: string, taskId: number) => Annotation | undefined;
  getAnnotationsForTask: (discussionId: string, taskId: number) => Annotation[];
}

export function useAnnotationLoader({
  task1SubTasks,
  task2SubTasks,
  task3SubTasks,
  getUserAnnotation,
  getAnnotationsForTask,
  getConsensusAnnotation
}: AnnotationLoaderProps) {
  const [loading, setLoading] = useState(false);

  // Load user's annotation for a specific task
  const loadUserAnnotation = (discussionId: string, taskId: number, userId: string = 'current'): SubTask[] | null => {
    try {
      // If userId is 'current', use default behavior
      const annotation = getUserAnnotation(discussionId, userId, taskId);
      
      if (!annotation) {
        console.log(`No annotation found for discussion: ${discussionId}, task: ${taskId}`);
        return null;
      }
      
      console.log(`Loading annotation for task ${taskId}:`, annotation.data);
      
      // Create a deep copy of the tasks based on which task we're loading
      let tasksCopy: SubTask[] = [];
      if (taskId === 1) {
        tasksCopy = JSON.parse(JSON.stringify(task1SubTasks));
      } else if (taskId === 2) {
        tasksCopy = JSON.parse(JSON.stringify(task2SubTasks));
      } else if (taskId === 3) {
        tasksCopy = JSON.parse(JSON.stringify(task3SubTasks));
      }
      
      // Map the saved data back to the form fields
      const updatedTasks = tasksCopy.map(task => {
        let savedValue = annotation.data[task.id];
        const savedTextValue = annotation.data[`${task.id}_text`];
        
        // Handle arrays for short answer lists and supporting docs
        if (task.id === 'short_answer_list' && Array.isArray(savedValue)) {
          return {
            ...task,
            selectedOption: '',
            status: 'completed' as SubTaskStatus,
            textValue: savedValue.join('\n')
          };
        } else if (task.id === 'supporting_docs' && Array.isArray(savedValue)) {
          // Format as JSON string for display
          const formattedDocs = savedValue.map(doc => {
            if (typeof doc === 'object' && doc.link && doc.paragraph) {
              return { link: doc.link, paragraph: doc.paragraph };
            }
            return doc;
          });
          return {
            ...task,
            selectedOption: '',
            status: 'completed' as SubTaskStatus,
            textValue: JSON.stringify(formattedDocs, null, 2)
          };
        } else if (savedValue !== undefined) {
          let status: SubTaskStatus = 'completed';
          let selectedOption = '';
          
          // Handle boolean values by converting to strings
          if (typeof savedValue === 'boolean') {
            selectedOption = savedValue ? 'True' : 'False';
          } else if (typeof savedValue === 'string') {
            selectedOption = savedValue;
          }
          
          return {
            ...task,
            selectedOption,
            status,
            textValue: typeof savedTextValue === 'string' ? savedTextValue : (task.textValue || '')
          };
        }
        
        return task;
      });
      
      return updatedTasks;
    } catch (error) {
      console.error('Failed to load annotation:', error);
      toast.error('Failed to load annotation');
      return null;
    }
  };

  // Prepare consensus view based on annotations
  const prepareConsensusView = (discussionId: string, taskId: number): SubTask[] | null => {
    try {
      // First check if there's already a consensus annotation
      const consensusAnnotation = getConsensusAnnotation(discussionId, taskId);
      
      // Initialize with empty consensus tasks based on taskId
      let consensusTasks: SubTask[] = [];
      if (taskId === 1) {
        consensusTasks = JSON.parse(JSON.stringify(task1SubTasks));
      } else if (taskId === 2) {
        consensusTasks = JSON.parse(JSON.stringify(task2SubTasks));
      } else if (taskId === 3) {
        consensusTasks = JSON.parse(JSON.stringify(task3SubTasks));
      }
      
      // If we have an existing consensus annotation, use it
      if (consensusAnnotation) {
        console.log("Using existing consensus annotation:", consensusAnnotation.data);
        return mapAnnotationToSubTasks(consensusTasks, consensusAnnotation);
      }
      
      // If no consensus exists yet, populate with annotator data
      const annotations = getAnnotationsForTask(discussionId, taskId);
      
      if (!annotations || annotations.length === 0) {
        return consensusTasks;
      }
      
      console.log(`Generating consensus from ${annotations.length} annotations`);
      return generateConsensusFromAnnotations(consensusTasks, annotations);
    } catch (error) {
      console.error('Failed to prepare consensus view:', error);
      toast.error('Failed to prepare consensus view');
      return null;
    }
  };

  // Helper function to map annotation data to subtasks
  const mapAnnotationToSubTasks = (tasks: SubTask[], annotation: Annotation): SubTask[] => {
    return tasks.map(task => {
      const savedValue = annotation.data[task.id];
      const savedTextValue = annotation.data[`${task.id}_text`];
      
      if (task.id === 'short_answer_list' && Array.isArray(savedValue)) {
        return {
          ...task,
          selectedOption: '',
          status: 'completed' as SubTaskStatus,
          textValue: savedValue.join('\n')
        };
      } else if (task.id === 'supporting_docs' && Array.isArray(savedValue)) {
        // Format as JSON string for display
        const formattedDocs = savedValue.map(doc => {
          if (typeof doc === 'object' && doc.link && doc.paragraph) {
            return { link: doc.link, paragraph: doc.paragraph };
          }
          return doc;
        });
        return {
          ...task,
          selectedOption: '',
          status: 'completed' as SubTaskStatus,
          textValue: JSON.stringify(formattedDocs, null, 2)
        };
      } else if (savedValue !== undefined) {
        let status: SubTaskStatus = 'completed';
        let selectedOption = '';
        
        if (typeof savedValue === 'boolean') {
          selectedOption = savedValue ? 'True' : 'False';
        } else if (typeof savedValue === 'string') {
          selectedOption = savedValue;
        }
        
        return {
          ...task,
          selectedOption,
          status,
          textValue: typeof savedTextValue === 'string' ? savedTextValue : (task.textValue || '')
        };
      }
      return task;
    });
  };

  // Helper function to generate consensus from multiple annotations
  const generateConsensusFromAnnotations = (consensusTasks: SubTask[], annotations: Annotation[]): SubTask[] => {
    // Convert all annotations to form fields format and count occurrences
    const fieldCounts: Record<string, Record<string, number>> = {};
    const textValues: Record<string, string[]> = {};
    const shortAnswerLists: string[][] = [];
    const supportingDocs: any[][] = [];
    
    annotations.forEach(annotation => {
      Object.entries(annotation.data).forEach(([key, value]) => {
        // Special handling for short_answer_list
        if (key === 'short_answer_list' && Array.isArray(value)) {
          shortAnswerLists.push(value);
          return;
        }
        
        // Special handling for supporting_docs
        if (key === 'supporting_docs' && Array.isArray(value)) {
          supportingDocs.push(value);
          return;
        }
        
        // Skip text fields, we'll handle them separately
        if (key.endsWith('_text')) {
          const baseKey = key.replace('_text', '');
          if (!textValues[baseKey]) {
            textValues[baseKey] = [];
          }
          if (typeof value === 'string' && value.trim() !== '') {
            textValues[baseKey].push(value);
          }
          return;
        }
        
        if (!fieldCounts[key]) {
          fieldCounts[key] = {};
        }
        
        // Convert boolean values to strings to match our options format
        let stringValue: string;
        if (typeof value === 'boolean') {
          stringValue = value ? 'True' : 'False';
        } else {
          stringValue = String(value);
        }
        
        if (!fieldCounts[key][stringValue]) {
          fieldCounts[key][stringValue] = 0;
        }
        
        fieldCounts[key][stringValue]++;
      });
    });
    
    // Find most common value for each field
    return consensusTasks.map(task => {
      // Special handling for short_answer_list
      if (task.id === 'short_answer_list' && shortAnswerLists.length > 0) {
        // Collect all answers across all annotators
        const allAnswers = shortAnswerLists.flat();
        return {
          ...task,
          selectedOption: '',
          textValue: allAnswers.join('\n'),
          status: 'completed' as SubTaskStatus
        };
      }
      
      // Special handling for supporting_docs
      if (task.id === 'supporting_docs' && supportingDocs.length > 0) {
        // Collect all unique supporting docs
        const allDocs: any[] = [];
        supportingDocs.forEach(docList => {
          docList.forEach(doc => {
            // Check if this doc is already in allDocs
            const exists = allDocs.some(existingDoc => 
              existingDoc.link === doc.link && existingDoc.paragraph === doc.paragraph
            );
            if (!exists) {
              allDocs.push(doc);
            }
          });
        });
        
        return {
          ...task,
          selectedOption: '',
          textValue: JSON.stringify(allDocs, null, 2),
          status: 'completed' as SubTaskStatus
        };
      }
      
      const counts = fieldCounts[task.id];
      if (!counts) return task;
      
      let maxCount = 0;
      let mostCommonValue: string = '';
      
      Object.entries(counts).forEach(([value, count]) => {
        if (count > maxCount) {
          maxCount = count;
          mostCommonValue = value;
        }
      });
      
      // If we found a most common value
      if (mostCommonValue) {
        // Use the first non-empty text value for this field
        const textFieldValues = textValues[task.id] || [];
        const textValue = textFieldValues.length > 0 ? textFieldValues[0] : '';
        
        return {
          ...task,
          selectedOption: mostCommonValue,
          textValue,
          status: 'completed' as SubTaskStatus
        };
      }
      
      return task;
    });
  };

  return {
    loadUserAnnotation,
    prepareConsensusView,
    loading,
    setLoading
  };
}
