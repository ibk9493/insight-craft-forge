import { useState, useCallback } from 'react';
import { SubTask, SubTaskStatus } from '@/components/dashboard/TaskCard';
import { Annotation } from '@/services/api';
import { toast } from 'sonner';

interface AnnotationLoaderProps {
  task1SubTasks: SubTask[];
  task2SubTasks: SubTask[];
  task3SubTasks: SubTask[];
  getUserAnnotation: (discussionId: string, userId: string, taskId: number) => Annotation | undefined;
  getConsensusAnnotation: (discussionId: string, taskId: number) => Promise<Annotation | undefined>;
  getAnnotationsForTask: (discussionId: string, taskId: number) => Annotation[];
}

interface PreparedConsensusView {
  tasks: SubTask[] | null;
  stars?: number | null;
  comment?: string;
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
// Updated loadUserAnnotation function for Task 3 multiple forms support

// Fixed loadUserAnnotation function with proper typing
interface LoadUserAnnotationResult {
  tasks: SubTask[] | null;
  forms?: Array<{ id: string; name: string; subTasks: SubTask[] }>;
}

const loadUserAnnotation = useCallback((
  discussionId: string, 
  taskId: number, 
  userId: string = 'current'
): LoadUserAnnotationResult => {
  try {
    const annotation = getUserAnnotation(discussionId, userId, taskId);
    
    if (!annotation) {
      console.log(`No annotation found for discussion: ${discussionId}, task: ${taskId}`);
      return { tasks: null };
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
      
      // Special handling for Task 3 with multiple forms
      if (annotation.data.forms && Array.isArray(annotation.data.forms)) {
        console.log('Loading multiple forms for Task 3:', annotation.data.forms);
        
        const loadedForms = annotation.data.forms.map((formData: any) => {
          // Create a copy of base tasks for each form
          const formSubTasks: SubTask[] = JSON.parse(JSON.stringify(task3SubTasks));
          
          // Map form data back to subtasks
          const mappedSubTasks: SubTask[] = formSubTasks.map((task: SubTask): SubTask => {
            const savedValue = formData[task.id];
            const savedTextValue = formData[`${task.id}_text`];
            
            // Handle short_answer_list with new claim/weight format
            if (task.id === 'short_answer_list' && Array.isArray(savedValue)) {
              const claims = savedValue.map((item: any) => item.claim || item);
              const weights = savedValue.map((item: any) => 
                typeof item === 'object' ? parseInt(item.weight) || 1 : 1
              );
              
              return {
                ...task,
                selectedOption: 'Completed',
                status: 'completed' as SubTaskStatus,
                textValues: claims,
                weights: weights
              };
            }
            
            // Handle supporting docs
            else if (task.id === 'supporting_docs' && Array.isArray(savedValue)) {
              return {
                ...task,
                selectedOption: 'Provided',
                status: 'completed' as SubTaskStatus,
                supportingDocs: savedValue.map((doc: any) => ({
                  link: doc.link || '',
                  paragraph: doc.paragraph || ''
                }))
              };
            }
            
            // Handle doc_download_link
            else if (task.id === 'doc_download_link') {
              const linkText = savedTextValue;
              const hasLink = linkText && typeof linkText === 'string' && linkText.trim() !== '';
              
              return {
                ...task,
                selectedOption: typeof savedValue === 'string' ? savedValue : (hasLink ? 'Needed' : 'Not Needed'),
                status: 'completed' as SubTaskStatus,
                textValue: linkText || '', // FIX: Use textValue instead of docDownloadLink for compatibility
                docDownloadLink: hasLink ? linkText : undefined,
                enableDocDownload: hasLink
              };
            }
            
            // Handle regular fields
            else if (savedValue !== undefined) {
              let selectedOption: string = '';
              
              if (typeof savedValue === 'boolean') {
                if (task.options && task.options.length > 0) {
                  const trueOption = task.options.find(o => o.toLowerCase() === 'true' || o.toLowerCase() === 'yes');
                  const falseOption = task.options.find(o => o.toLowerCase() === 'false' || o.toLowerCase() === 'no');
                  
                  if (savedValue === true && trueOption) {
                    selectedOption = trueOption;
                  } else if (savedValue === false && falseOption) {
                    selectedOption = falseOption;
                  } else {
                    selectedOption = savedValue ? 'Yes' : 'No';
                  }
                } else {
                  selectedOption = savedValue ? 'Yes' : 'No';
                }
              } else if (typeof savedValue === 'string') {
                selectedOption = savedValue;
              } else {
                selectedOption = String(savedValue);
              }
              
              return {
                ...task,
                selectedOption,
                status: 'completed' as SubTaskStatus,
                textValue: typeof savedTextValue === 'string' ? savedTextValue : task.textValue
              };
            }
            
            return task;
          });
          
          return {
            id: formData.formId,
            name: formData.formName,
            subTasks: mappedSubTasks
          };
        });
        
        return { 
          tasks: tasksCopy, // Return base tasks (may not be used)
          forms: loadedForms 
        };
      }
    }
    
    // For Tasks 1, 2, or Task 3 without forms (fallback)
    const updatedTasks: SubTask[] = tasksCopy.map((task: SubTask): SubTask => {
      let savedValue = annotation.data[task.id];
      const savedTextValue = annotation.data[`${task.id}_text`];
      
      // Handle short_answer_list with new format
      if (task.id === 'short_answer_list' && Array.isArray(savedValue)) {
        // Check if it's the new format with claim/weight objects
        if (savedValue.length > 0 && typeof savedValue[0] === 'object' && savedValue[0].claim) {
          const claims = savedValue.map((item: any) => item.claim);
          const weights = savedValue.map((item: any) => parseInt(item.weight) || 1);
          
          return {
            ...task,
            selectedOption: 'Completed',
            status: 'completed' as SubTaskStatus,
            textValues: claims,
            weights: weights
          };
        } else {
          // Old format - just strings
          return {
            ...task,
            selectedOption: 'Completed',  
            status: 'completed' as SubTaskStatus,
            textValues: savedValue
          };
        }
      } 
      
      // Handle supporting docs
      else if (task.id === 'supporting_docs') {
        const docsData = annotation.data['supporting_docs_data'];
        if (Array.isArray(docsData)) {
          return {
            ...task,
            selectedOption: 'Provided',
            status: 'completed' as SubTaskStatus,
            supportingDocs: docsData.map((doc: any) => ({
              link: doc.link || '',
              paragraph: doc.paragraph || ''
            }))
          };
        }
      }
      
      // Handle doc_download_link
      else if (task.id === 'doc_download_link') {
        const linkValue = annotation.data['doc_download_link'];
        const hasLink = linkValue && typeof linkValue === 'string' && linkValue.trim() !== '';
        
        return {
          ...task,
          selectedOption: typeof savedValue === 'string' ? savedValue : (hasLink ? 'Needed' : 'Not Needed'),
          status: 'completed' as SubTaskStatus,
          docDownloadLink: hasLink ? linkValue : undefined,
          enableDocDownload: hasLink
        };
      }
      
      // Handle regular fields
      else if (savedValue !== undefined) {
        let selectedOption: string = '';
        
        if (typeof savedValue === 'boolean') {
          if (task.options && task.options.length > 0) {
            const trueOption = task.options.find(o => o.toLowerCase() === 'true' || o.toLowerCase() === 'yes');
            const falseOption = task.options.find(o => o.toLowerCase() === 'false' || o.toLowerCase() === 'no');

            if (savedValue === true && trueOption) {
              selectedOption = trueOption;
            } else if (savedValue === false && falseOption) {
              selectedOption = falseOption;
            } else {
              selectedOption = savedValue ? 'Yes' : 'No';
            }
          } else {
            selectedOption = savedValue ? 'Yes' : 'No';
          }
        } else if (typeof savedValue === 'string') {
          selectedOption = savedValue;
        } else {
          selectedOption = String(savedValue);
        }
        
        return {
          ...task,
          selectedOption,
          status: 'completed' as SubTaskStatus,
          textValue: typeof savedTextValue === 'string' ? savedTextValue : task.textValue
        };
      }
      
      return task;
    });
    
    return { tasks: updatedTasks };
  } catch (error) {
    console.error('Failed to load annotation:', error);
    toast.error('Failed to load annotation');
    return { tasks: null };
  }
}, [getUserAnnotation, task1SubTasks, task2SubTasks, task3SubTasks]);
  // Prepare consensus view based on annotations
  const prepareConsensusView = useCallback(async (discussionId: string, taskId: number): Promise<PreparedConsensusView> => {
    try {
      // First check if there's already a consensus annotation
      const consensusAnnotation = await getConsensusAnnotation(discussionId, taskId);
      
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
        console.log('[useAnnotationLoader] Fetched consensus data from API:', JSON.stringify(consensusAnnotation.data)); // DEBUG LOG
        const mappedTasks = mapAnnotationToSubTasks(consensusTasks, consensusAnnotation);
        const starsValue = consensusAnnotation.data?.stars;
        const commentValue = consensusAnnotation.data?.comment;
        return {
          tasks: mappedTasks,
          stars: typeof starsValue === 'number' ? starsValue : null,
          comment: typeof commentValue === 'string' ? commentValue : undefined
        };
      }
      
      // If no consensus exists yet, populate with annotator data
      const annotations = getAnnotationsForTask(discussionId, taskId);
      
      if (!annotations || annotations.length === 0) {
        return { tasks: consensusTasks }; // Return default tasks, no stars/comment
      }
      
      console.log(`Generating consensus from ${annotations.length} annotations`);
      const generatedTasks = generateConsensusFromAnnotations(consensusTasks, annotations);
      return { tasks: generatedTasks }; // No specific stars/comment when generated
    } catch (error) {
      console.error('Failed to prepare consensus view:', error);
      toast.error('Failed to prepare consensus view');
      return { tasks: null };
    }
  }, [getConsensusAnnotation, getAnnotationsForTask, task1SubTasks, task2SubTasks, task3SubTasks]);

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
        
        // Handle boolean and string values for selectedOption
        if (typeof savedValue === 'boolean') {
          // Check if this task is a radio-button like task with defined options
          if (task.options && task.options.length > 0) {
            const trueOption = task.options.find(o => o.toLowerCase() === 'true' || o.toLowerCase() === 'yes');
            const falseOption = task.options.find(o => o.toLowerCase() === 'false' || o.toLowerCase() === 'no');

            if (savedValue === true && trueOption) {
              selectedOption = trueOption;
            } else if (savedValue === false && falseOption) {
              selectedOption = falseOption;
            } else {
              // Mismatch: boolean value stored, but no corresponding True/Yes or False/No option found
              console.warn(`[AnnotationLoader] For task '${task.id}', boolean value ${savedValue} found, but no matching True/Yes/False/No option in [${task.options.join(', ')}]. Radio will likely be unselected.`);
            }
          } else {
            // Boolean savedValue, but task.options is not defined/empty.
            // Fallback to the generic Yes/No mapping used previously for such cases.
            selectedOption = savedValue ? 'Yes' : 'No';
          }
        } else if (typeof savedValue === 'string') {
          // Check if this task is a radio-button like task with defined options
          if (task.options && task.options.length > 0) {
            if (task.options.includes(savedValue)) {
              selectedOption = savedValue; // Handles "N/A" or other string options
            } else {
              // String value stored, but it's not one of the defined options
              console.warn(`[AnnotationLoader] For task '${task.id}', string value "${savedValue}" found, but it's not in the defined options [${task.options.join(', ')}]. Radio will likely be unselected.`);
            }
          } else {
            // String savedValue, but task.options is not defined/empty.
            // Assume it's for a non-radio field or a radio without predefined options, use the value directly.
            selectedOption = savedValue;
          }
        } else if (savedValue !== undefined) {
            // savedValue is defined but not boolean or string (e.g., number)
            console.warn(`[AnnotationLoader] For task '${task.id}', unexpected data type for savedValue: ${typeof savedValue} ('${savedValue}'). 'selectedOption' may not be set correctly.`);
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
