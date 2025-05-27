import { useState } from 'react';
import {SubTask, SubTaskStatus} from '@/components/dashboard/TaskCard';
import { Annotation } from '@/services/api';
import { toast } from 'sonner';
import { User } from '@/contexts/UserContext';
import { AnnotationHandlersProps, isPodLead, TaskId } from './useAnnotationTypes';

type AnnotationSaverProps = AnnotationHandlersProps;

export function useAnnotationSaver({
  task1SubTasks,
  task2SubTasks,
  task3SubTasks,
  consensusTask1,
  consensusTask2,
  consensusTask3,
  user,
  saveAnnotation,
  saveConsensusAnnotation,
  getUserAnnotation,
  getAnnotationsForTask,
  getConsensusAnnotation,
  updateStepCompletionStatus,
  overrideAnnotation
}: AnnotationSaverProps) {
  const [loading, setLoading] = useState(false);

  // Convert tasks to data format
// Update the convertTasksToData function in useAnnotationSaver

  const convertTasksToData = (tasks: SubTask[], data: Record<string, any>) => {
    tasks.forEach(task => {
      // Default handling for all fields
      if (task.selectedOption) {
        if (task.selectedOption === 'True' || task.selectedOption === 'False' ||
            task.selectedOption === 'Yes' || task.selectedOption === 'No') {
          data[task.id] = (task.selectedOption === 'True' || task.selectedOption === 'Yes');
        } else {
          data[task.id] = task.selectedOption;
        }
      }

      // Add text value if present
      if (task.textValue !== undefined && task.textValue.trim() !== '') {
        data[`${task.id}_text`] = task.textValue;
      }

      // UPDATED: Handle short_answer_list with new claim/weight format
      if (task.id === 'short_answer_list' && task.textValues && Array.isArray(task.textValues)) {
        const claims = task.textValues
            .filter(claim => claim.trim() !== '') // Remove empty claims
            .map((claim, index) => ({
              claim: claim.trim(),
              weight: String(task.weights?.[index] || 1) // Convert to string as per your format
            }));

        data[task.id] = claims; // Save as array of claim/weight objects
      }
      // Handle other multiline text inputs (NOT short_answer_list)
      else if (task.multiline && task.textValues && Array.isArray(task.textValues) && task.id !== 'short_answer_list') {
        // Example: task.id = "other_multiline_field"
        // data["other_multiline_field_items"] = ["item1", "item2"]
        data[`${task.id}_items`] = task.textValues;
      }

      // Add supportingDocs if present
      if (task.structuredInput && task.supportingDocs && Array.isArray(task.supportingDocs)) {
        // Example: task.id = "supporting_docs"
        // data["supporting_docs_data"] = [{link: "...", paragraph: "..."}]
        data[`${task.id}_data`] = task.supportingDocs;
      }

      // ADDED: Handle doc_download_link
      if (task.id === 'doc_download_link' && task.docDownloadLink && task.docDownloadLink.trim() !== '') {
        data['doc_download_link'] = task.docDownloadLink.trim();
      }
console.log("SAVING:", data)
      // if (task.id === 'screenshot') {
      //   const screenshotValue = annotation.data['screenshot'];
      //   const screenshotStatus = annotation.data['screenshot_status'];
      //   if (screenshotValue && typeof screenshotValue === 'string') {
      //     return {
      //       ...task,
      //       selectedOption: screenshotStatus || 'Provided',
      //       textValue: screenshotValue,
      //       status: 'completed' as SubTaskStatus
      //     };
      //   }
      // }
      //
      // // Special handling for codeDownloadUrl field (Task 2)
      // if (task.id === 'codeDownloadUrl') {
      //   const codeValue = annotation.data['codeDownloadUrl'];
      //   const codeStatus = annotation.data['codeDownloadUrl_status'];
      //   if (codeValue && typeof codeValue === 'string') {
      //     return {
      //       ...task,
      //       selectedOption: codeStatus || 'Verified manually',
      //       textValue: codeValue,
      //       docDownloadLink: codeValue,
      //       enableDocDownload: true,
      //       status: 'completed' as SubTaskStatus
      //     };
      //   }
      // }
    });
  };

  // Save annotation or consensus
  const handleSaveAnnotation = async (
      discussionId: string | null,
      taskId: number,
      viewMode: 'grid' | 'detail' | 'consensus',
      screenshotUrl: string | null,
      codeDownloadUrl: string | null,
      screenshotUrlText: string | null,
      codeDownloadUrlText: string | null,
      onComplete: () => void,
      consensusStars?: number | null,
      consensusComment?: string,
      // New parameters for Task 3 multiple forms
      task3Forms?: Array<{ id: string; name: string; subTasks: SubTask[] }>,
      consensusTask3Forms?: Array<{ id: string; name: string; subTasks: SubTask[] }>
  ) => {
    if (!discussionId || !user) {
      toast.error('Missing discussion ID or user information');
      return;
    }

    try {
      setLoading(true);

      // Prepare data based on current task and mode
      let taskData: Record<string, any> = {};
      let currentTasks: SubTask[] = [];

      if (viewMode === 'detail') {
        // Regular annotation
        switch (taskId) {
          case TaskId.QUESTION_QUALITY:
            currentTasks = task1SubTasks;
            convertTasksToData(currentTasks, taskData);
            break;

          case TaskId.ANSWER_QUALITY:
            currentTasks = task2SubTasks;
            convertTasksToData(currentTasks, taskData);
            // Add screenshot and code download URL for task 2
            if (screenshotUrl) {
              taskData.screenshot = screenshotUrl;
            }
            if (codeDownloadUrl) {
              taskData.codeDownloadUrl = codeDownloadUrl;
            }
            if (screenshotUrlText) {
              taskData.screenshot_text = screenshotUrlText;
            }
            if (codeDownloadUrlText) {
              taskData.codeDownloadUrl_text = codeDownloadUrlText;
            }
            break;

            case TaskId.REWRITE:
              // Handle multiple forms for Task 3
              if (task3Forms && task3Forms.length > 0) {
                // Store all forms data (individual form data for repopulation)
                taskData.forms = task3Forms.map((form, index) => {
                  const formData: Record<string, any> = {
                    formId: form.id,
                    formName: form.name,
                    formIndex: index
                  };
            
                  // Convert each form's tasks to data
                  form.subTasks.forEach(task => {
                    // Handle different task types
                    if (task.selectedOption) {
                      if (task.selectedOption === 'True' || task.selectedOption === 'False' ||
                          task.selectedOption === 'Yes' || task.selectedOption === 'No') {
                        formData[task.id] = (task.selectedOption === 'True' || task.selectedOption === 'Yes');
                      } else {
                        formData[task.id] = task.selectedOption;
                      }
                    }
            
                    // Handle text value
                    if (task.textValue !== undefined) {
                      formData[`${task.id}_text`] = task.textValue;
                    }
            
                    // Handle short_answer_list with weights (keep in individual forms)
                    if (task.id === 'short_answer_list' && task.textValues && Array.isArray(task.textValues)) {
                      const claims = task.textValues
                        .filter(claim => claim.trim() !== '')
                        .map((claim, claimIndex) => ({
                          claim: claim.trim(),
                          weight: String(task.weights?.[claimIndex] || 1)
                        }));
                      formData['short_answer_list'] = claims;
                    }
                    // Handle other multiline inputs (non-shortAnswer)
                    else if (task.multiline && task.textValues && Array.isArray(task.textValues)) {
                      formData[`${task.id}_items`] = task.textValues;
                    }
            
                    // Handle supporting docs
                    if (task.structuredInput && task.supportingDocs && Array.isArray(task.supportingDocs)) {
                      formData['supporting_docs'] = task.supportingDocs;
                    }
            
                    // Handle doc_download_link for each form
                    if (task.id === 'doc_download_link' && task.docDownloadLink && task.docDownloadLink.trim() !== '') {
                      formData['doc_download_link'] = task.docDownloadLink.trim();
                    }
                  });
            
                  return formData;
                });
            
                // Create aggregated top-level data for all fields
                
                // 1. SHORT ANSWER LIST (nested array format)
                const allShortAnswers = task3Forms.map(form => {
                  const shortAnswerTask = form.subTasks.find(task => task.id === 'short_answer_list');
                  if (shortAnswerTask && shortAnswerTask.textValues) {
                    return shortAnswerTask.textValues
                      .filter(claim => claim.trim() !== '')
                      .map((claim, index) => ({
                        claim: claim.trim(),
                        weight: String(shortAnswerTask.weights?.[index] || 1)
                      }));
                  }
                  return [];
                });
            
                const nonEmptyShortAnswers = allShortAnswers.filter(formClaims => formClaims.length > 0);
                if (nonEmptyShortAnswers.length > 0) {
                  if (nonEmptyShortAnswers.length === 1) {
                    taskData.short_answer_list = nonEmptyShortAnswers[0];
                  } else {
                    taskData.short_answer_list = nonEmptyShortAnswers;
                  }
                }
            
                // 2. LONG ANSWER (array of long answers from each form)
                const allLongAnswers = task3Forms.map(form => {
                  const longAnswerTask = form.subTasks.find(task => task.id === 'longAnswer');
                  return longAnswerTask?.textValue?.trim() || '';
                }).filter(answer => answer !== '');
            
                if (allLongAnswers.length > 0) {
                  if (allLongAnswers.length === 1) {
                    taskData.longAnswer_text = [allLongAnswers[0]];
                  } else {
                    taskData.longAnswer_list = allLongAnswers;
                  }
                }
            
                // 3. REWRITE QUESTION (array of rewrites from each form)
                const allRewrites = task3Forms.map(form => {
                  const rewriteTask = form.subTasks.find(task => task.id === 'rewrite');
                  return rewriteTask?.textValue?.trim() || '';
                }).filter(rewrite => rewrite !== '');
            
                if (allRewrites.length > 0) {
                  if (allRewrites.length === 1) {
                    taskData.rewrite_text = allRewrites[0];
                  } else {
                    taskData.rewrite_list = allRewrites;
                  }
                }
            
                // 4. SUPPORTING DOCS (aggregate all supporting docs)
                const allSupportingDocs = task3Forms.flatMap(form => {
                  const supportingDocsTask = form.subTasks.find(task => task.id === 'supporting_docs');
                  return supportingDocsTask?.supportingDocs || [];
                }).filter(doc => doc.link?.trim() && doc.paragraph?.trim());
            
                if (allSupportingDocs.length > 0) {
                  taskData.supporting_docs_data = allSupportingDocs;
                }
            
                // 5. DOC DOWNLOAD LINKS (array of all download links)
                const allDocDownloadLinks = task3Forms.map(form => {
                  const docLinkTask = form.subTasks.find(task => task.id === 'doc_download_link');
                  return docLinkTask?.docDownloadLink?.trim() || '';
                }).filter(link => link !== '');
            
                if (allDocDownloadLinks.length > 0) {
                  if (allDocDownloadLinks.length === 1) {
                    taskData.doc_download_link = allDocDownloadLinks[0];
                  } else {
                    taskData.doc_download_links = allDocDownloadLinks;
                  }
                }
            
                // 6. CLASSIFICATION (use the most common classification or first non-empty)
                const allClassifications = task3Forms.map(form => {
                  const classifyTask = form.subTasks.find(task => task.id === 'classify');
                  return classifyTask?.selectedOption || '';
                }).filter(classification => classification !== '');
            
                if (allClassifications.length > 0) {
                  // Use the first classification or most common one
                  taskData.classify = allClassifications[0];
                  
                  // If multiple different classifications, save them all
                  const uniqueClassifications = [...new Set(allClassifications)];
                  if (uniqueClassifications.length > 1) {
                    taskData.classify_list = uniqueClassifications;
                  }
                }
            
              } else {
                // Fallback to single form (backward compatibility)
                currentTasks = task3SubTasks;
                convertTasksToData(currentTasks, taskData);
              }
              break;

          default:
            toast.error('Invalid task ID');
            setLoading(false);
            return;
        }

        // Save annotation
        console.log('[useAnnotationSaver] Saving annotation data:', taskData);
        const success = await saveAnnotation({
          user_id: user.id,
          discussion_id: discussionId,
          task_id: taskId,
          data: taskData
        });

        if (success) {
          updateStepCompletionStatus(taskId, true);
          toast.success('Annotation saved successfully');
          onComplete();
        }
      } else if (viewMode === 'consensus') {
        // Consensus annotation
        if (!user || (user.role !== 'pod_lead' && user.role !== 'admin')) {
          toast.error('Only pod leads or admins can save consensus annotations');
          return;
        }

        switch (taskId) {
          case TaskId.QUESTION_QUALITY:
            currentTasks = consensusTask1;
            convertTasksToData(currentTasks, taskData);
            break;

          case TaskId.ANSWER_QUALITY:
            currentTasks = consensusTask2;
            convertTasksToData(currentTasks, taskData);
            break;

          case TaskId.REWRITE:
            // Handle multiple consensus forms for Task 3
            if (consensusTask3Forms && consensusTask3Forms.length > 0) {
              // Store all consensus forms data
              taskData.forms = consensusTask3Forms.map((form, index) => {
                const formData: Record<string, any> = {
                  formId: form.id,
                  formName: form.name,
                  formIndex: index
                };

                // Convert each form's tasks to data
                form.subTasks.forEach(task => {
                  // Handle different task types
                  if (task.selectedOption) {
                    if (task.selectedOption === 'True' || task.selectedOption === 'False' ||
                        task.selectedOption === 'Yes' || task.selectedOption === 'No') {
                      formData[task.id] = (task.selectedOption === 'True' || task.selectedOption === 'Yes');
                    } else {
                      formData[task.id] = task.selectedOption;
                    }
                  }

                  // Handle text value
                  if (task.textValue !== undefined) {
                    formData[`${task.id}_text`] = task.textValue;
                  }

                  // Special handling for short answer with weights
                  if (task.id === 'shortAnswer' && task.textValues && Array.isArray(task.textValues)) {
                    formData['short_answer_list'] = task.textValues.filter(v => v.trim() !== '');
                    // Include weights if available
                    if (task.weights && Array.isArray(task.weights)) {
                      formData['short_answer_weights'] = task.weights;
                    }
                  }

                  // Handle other multiline inputs (non-shortAnswer)
                  else if (task.multiline && task.textValues && Array.isArray(task.textValues)) {
                    formData[`${task.id}_items`] = task.textValues;
                  }

                  // Handle supporting docs
                  if (task.structuredInput && task.supportingDocs && Array.isArray(task.supportingDocs)) {
                    formData['supporting_docs'] = task.supportingDocs;
                  }
                });

                return formData;
              });
            } else {
              // Fallback to single form (backward compatibility)
              currentTasks = consensusTask3;
              convertTasksToData(currentTasks, taskData);
            }
            break;

          default:
            toast.error('Invalid task ID');
            setLoading(false);
            return;
        }

        // Add consensus stars and comment if provided
        if (consensusStars !== undefined && consensusStars !== null) {
          taskData.stars = consensusStars;
        }
        if (consensusComment && consensusComment.trim() !== '') {
          taskData.comment = consensusComment;
        }

        console.log('[useAnnotationSaver] Saving consensus data:', JSON.stringify(taskData));

        // Save consensus annotation
        const success = await saveConsensusAnnotation({
          user_id: user.id,
          discussion_id: discussionId,
          task_id: taskId,
          data: taskData
        });

        if (success) {
          updateStepCompletionStatus(taskId, true);
          toast.success('Consensus saved successfully');
          onComplete();
        }
      }
    } catch (error) {
      console.error('Failed to save annotation:', error);
      toast.error('Failed to save annotation');
    } finally {
      setLoading(false);
    }
  };
  
  // Handle pod lead overriding an annotator's annotation
  const handleOverrideAnnotation = async (
    discussionId: string | null,
    annotatorId: string,
    taskId: number,
    subTasks: SubTask[],
    onComplete: () => void
  ) => {
    if (!discussionId || !user || !isPodLead(user) || !overrideAnnotation) {
      toast.error(isPodLead(user) ? 'Missing information' : 'Only pod leads can override annotations');
      return;
    }
    
    try {
      setLoading(true);
      
      // Prepare data based on current task
      let taskData: Record<string, any> = {};
      
      // Convert form data to API format
      convertTasksToData(subTasks, taskData);
      
      // Add override metadata
      taskData._overridden_by_pod_lead = true;
      taskData._override_timestamp = new Date().toISOString();
      
      // Save override
      const success = await overrideAnnotation(
        user.id,
        annotatorId,
        discussionId,
        taskId,
        taskData
      );
      
      if (success) {
        toast.success(`Successfully overrode annotator's submission`);
        onComplete();
      }
    } catch (error) {
      console.error('Failed to override annotation:', error);
      toast.error('Failed to override annotation');
    } finally {
      setLoading(false);
    }
  };
  
  return {
    handleSaveAnnotation,
    handleOverrideAnnotation,
    loading
  };
}
