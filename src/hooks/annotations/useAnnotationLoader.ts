
import { useState } from 'react';
import { SubTask } from '@/components/dashboard/TaskCard';
import { Annotation } from '@/services/api';
import { toast } from 'sonner';
import { User } from '@/contexts/UserContext';

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
  const loadUserAnnotation = (discussionId: string, taskId: number, userId: string): SubTask[] | null => {
    try {
      const annotation = getUserAnnotation(discussionId, userId, taskId);
      
      if (!annotation) return null;
      
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
      return tasksCopy.map(task => {
        const savedValue = annotation.data[task.id];
        const savedTextValue = annotation.data[`${task.id}_text`];
        
        if (savedValue !== undefined) {
          if (typeof savedValue === 'boolean') {
            return {
              ...task,
              selectedOption: savedValue ? 'True' : 'False', // Convert boolean to string option
              textValue: typeof savedTextValue === 'string' ? savedTextValue : (task.textValue || '') // Ensure textValue is string
            };
          } else if (typeof savedValue === 'string') {
            return {
              ...task,
              selectedOption: savedValue,
              textValue: typeof savedTextValue === 'string' ? savedTextValue : (task.textValue || '')
            };
          }
        }
        return task;
      });
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
        return mapAnnotationToSubTasks(consensusTasks, consensusAnnotation);
      }
      
      // If no consensus exists yet, populate with annotator data
      const annotations = getAnnotationsForTask(discussionId, taskId);
      
      if (!annotations || annotations.length === 0) {
        return consensusTasks;
      }
      
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
      
      if (savedValue !== undefined) {
        if (typeof savedValue === 'boolean') {
          return {
            ...task,
            selectedOption: savedValue ? 'True' : 'False',
            textValue: typeof savedTextValue === 'string' ? savedTextValue : (task.textValue || '')
          };
        } else if (typeof savedValue === 'string') {
          return {
            ...task,
            selectedOption: savedValue,
            textValue: typeof savedTextValue === 'string' ? savedTextValue : (task.textValue || '')
          };
        }
      }
      return task;
    });
  };

  // Helper function to generate consensus from multiple annotations
  const generateConsensusFromAnnotations = (consensusTasks: SubTask[], annotations: Annotation[]): SubTask[] => {
    // Convert all annotations to form fields format and count occurrences
    const fieldCounts: Record<string, Record<string, number>> = {};
    const textValues: Record<string, string[]> = {};
    
    annotations.forEach(annotation => {
      Object.entries(annotation.data).forEach(([key, value]) => {
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
          status: 'completed'
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
