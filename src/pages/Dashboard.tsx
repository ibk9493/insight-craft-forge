import React, { useCallback, useEffect, useRef, useState } from 'react';
import Header from '@/components/layout/Header';
import UrlInput from '@/components/dashboard/UrlInput';
import TaskCard, { SubTask, SubTaskStatus } from '@/components/dashboard/TaskCard';
import TaskGrid from '@/components/dashboard/TaskGrid';
import ProgressStepper from '@/components/dashboard/ProgressStepper';
import Summary from '@/components/dashboard/Summary';
import DashboardNavigation from '@/components/dashboard/DashboardNavigation';
import DashboardBreadcrumb from '@/components/dashboard/DashboardBreadcrumb';
import { Button } from '@/components/ui/button';
import { CheckCircle, FileText, Eye, Plus, X } from 'lucide-react';
import AnnotatorView from '@/components/dashboard/AnnotatorView';
import { useDashboardState } from '@/hooks/useDashboardState';
import { useTaskSubtasks } from '@/hooks/useTaskSubtasks';
import { useTaskProgress } from '@/hooks/useTaskProgress';
import { useAnnotationHandlers } from '@/hooks/useAnnotationHandlers';
import { Annotation, TaskId } from '@/hooks/annotations/useAnnotationTypes';
import DiscussionDetailsModal from '@/components/dashboard/DiscussionDetailsModal';
import { useAppDispatch } from '@/hooks';
import { openModal } from '@/store/discussionModalSlice';
import { toast } from 'sonner';
import { MOCK_USERS_DATA } from '@/contexts/UserContext';
import { api } from '@/services/api';
import { Textarea } from '@/components/ui/textarea';

const computeCompleted = (
    task: SubTask,
    selectedOption?: string,
    textValue?: string,
    textValues?: string[],
    supportingDocs?: any[]
) => {
  if (selectedOption) return true;
  if (task.multiline && textValues?.some(v => v.trim())) return true;
  if (task.structuredInput && supportingDocs?.every(d => d.link && d.paragraph)) return true;
  if (textValue && textValue.trim()) return true;
  return false;
};

const Dashboard = () => {
  const [consensusStars, setConsensusStars] = useState<number | null>(null);
  const [consensusComment, setConsensusComment] = useState<string>('');
  const [task3Forms, setTask3Forms] = useState<Array<{ id: string; name: string; subTasks: SubTask[] }>>([]);
  const [activeTask3Form, setActiveTask3Form] = useState(0);
  const [consensusTask3Forms, setConsensusTask3Forms] = useState<Array<{ id: string; name: string; subTasks: SubTask[] }>>([]);
  const [activeConsensusTask3Form, setActiveConsensusTask3Form] = useState(0);

  const {
    url,
    currentStep,
    viewMode,
    handleUrlSubmit,
    handleSelectTask,
    handleBackToGrid,
    handleScreenshotUrlChange,
    updateStepCompletionStatus,
    toggleConsensusMode,
    discussionId,
    steps,
    tasks,
    screenshotUrl,
    codeDownloadUrl,
    handleCodeUrlChange,
    validateGitHubCodeUrl,
    isPodLead,
    isAdmin,
    user,
    getUserAnnotation,
    getAnnotationsForTask,
    saveAnnotation,
    saveConsensusAnnotation,
    getConsensusAnnotation,
    discussions,
    currentDiscussion,
    annotationsLoaded
  } = useDashboardState();

  const dispatch = useAppDispatch();

  const {
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
  } = useTaskSubtasks();

  const {
    getTask1Progress,
    getTask2Progress,
    getTask3Progress,
    canProceed
  } = useTaskProgress(
      task1SubTasks,
      task2SubTasks,
      task3SubTasks,
      consensusTask1,
      consensusTask2,
      consensusTask3
  );

  const {
    loadUserAnnotation,
    prepareConsensusView,
    handleSaveAnnotation
  } = useAnnotationHandlers({
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
    overrideAnnotation: undefined,
    task3Forms,
    consensusTask3Forms
  });

  const userEmailCache = useRef<{ [userId: string]: string }>({});

  const getUserEmailById = useCallback(async (userId: string): Promise<string> => {
    if (!userId) return 'Unknown User';
    const userIdStr = String(userId);
    if (userEmailCache.current[userIdStr]) return userEmailCache.current[userIdStr];
    try {
      const userInfo = await api.users.getUserById(userIdStr);
      if (userInfo && userInfo.email) {
        userEmailCache.current[userIdStr] = userInfo.email;
        return userInfo.email;
      } else {
        const fallback = `User ${userIdStr}`;
        userEmailCache.current[userIdStr] = fallback;
        return fallback;
      }
    } catch {
      return `User ${userIdStr}`;
    }
  }, [api.users.getUserById]);

  useEffect(() => {
    // Add proper null/undefined checks and array length validation
    if (task3Forms.length === 0 && task3SubTasks && Array.isArray(task3SubTasks) && task3SubTasks.length > 0) {
      try {
        setTask3Forms([{ 
          id: 'form-1', 
          name: 'Form 1', 
          subTasks: JSON.parse(JSON.stringify(task3SubTasks)) 
        }]);
      } catch (error) {
        console.error('Error initializing task3Forms:', error);
        console.log('task3SubTasks value:', task3SubTasks);
      }
    }
    
    if (consensusTask3Forms.length === 0 && consensusTask3 && Array.isArray(consensusTask3) && consensusTask3.length > 0) {
      try {
        setConsensusTask3Forms([{ 
          id: 'consensus-form-1', 
          name: 'Form 1', 
          subTasks: JSON.parse(JSON.stringify(consensusTask3)) 
        }]);
      } catch (error) {
        console.error('Error initializing consensusTask3Forms:', error);
        console.log('consensusTask3 value:', consensusTask3);
      }
    }
  }, [task3SubTasks, consensusTask3, task3Forms.length, consensusTask3Forms.length]);

// Update the useEffect in Dashboard component that loads annotations:

  useEffect(() => {
    setConsensusStars(null);
    setConsensusComment('');
    if (discussionId && user && currentStep > 0 && currentStep <= 3 && annotationsLoaded) {
      if (viewMode === 'detail') {
        const loadResult = loadUserAnnotation(discussionId, currentStep);

        if (loadResult.tasks) {
          switch (currentStep) {
            case TaskId.QUESTION_QUALITY:
              setTask1SubTasks(loadResult.tasks);
              break;
            case TaskId.ANSWER_QUALITY:
              setTask2SubTasks(loadResult.tasks);

              // NEW: Sync external state with API field names
              const screenshotTask = loadResult.tasks.find(t => t.id === 'screenshot_url');
              if (screenshotTask && screenshotTask.textValue && handleScreenshotUrlChange) {
                handleScreenshotUrlChange(screenshotTask.textValue);
              }

              const codeTask = loadResult.tasks.find(t => t.id === 'code_download_url');
              if (codeTask && codeTask.textValue && handleCodeUrlChange) {
                handleCodeUrlChange(codeTask.textValue);
              }
              break;
            case TaskId.REWRITE:
              // Handle Task 3 with multiple forms (existing code)
              if (loadResult.forms && loadResult.forms.length > 0) {
                console.log('Loading Task 3 forms:', loadResult.forms);
                setTask3Forms(loadResult.forms);
                setActiveTask3Form(0);
              } else {
                setTask3SubTasks(loadResult.tasks);
              }
              break;
          }
        } else {
          // If no loadResult.tasks, check if we need to manually load from raw annotation data
          const userAnnotation = getUserAnnotation(discussionId, currentStep);
          if (userAnnotation && currentStep === TaskId.ANSWER_QUALITY) {
            // Handle Task 2 special case where API returns different field names
            const mappedSubTasks = task2SubTasks.map(task => {
              if (task.id === 'screenshot_url') {
                const screenshotValue = userAnnotation.data['screenshot'];
                if (screenshotValue) {
                  handleScreenshotUrlChange && handleScreenshotUrlChange(screenshotValue);
                  return {
                    ...task,
                    selectedOption: 'Provided',
                    textValue: screenshotValue,
                    status: 'completed' as SubTaskStatus
                  };
                }
              } else if (task.id === 'code_download_url') {
                const codeValue = userAnnotation.data['codeDownloadUrl'];
                if (codeValue) {
                  handleCodeUrlChange && handleCodeUrlChange(codeValue);
                  return {
                    ...task,
                    selectedOption: 'Verified manually',
                    textValue: codeValue,
                    docDownloadLink: codeValue,
                    enableDocDownload: true,
                    status: 'completed' as SubTaskStatus
                  };
                }
              } else {
                // Handle regular fields
                const savedValue = userAnnotation.data[task.id];
                const savedTextValue = userAnnotation.data[`${task.id}_text`];

                if (savedValue !== undefined) {
                  let selectedOption = '';

                  if (typeof savedValue === 'boolean') {
                    selectedOption = savedValue ? 'Yes' : 'No';
                  } else if (typeof savedValue === 'string') {
                    selectedOption = savedValue;
                  }

                  return {
                    ...task,
                    selectedOption,
                    textValue: savedTextValue || '',
                    status: 'completed' as SubTaskStatus
                  };
                }
              }
              return task;
            });
            setTask2SubTasks(mappedSubTasks);
          }
        }
      } else if (viewMode === 'consensus' && (isPodLead || isAdmin)) {
        const loadConsensus = async () => {
          const consensusViewData = await prepareConsensusView(discussionId, currentStep);
          if (consensusViewData && consensusViewData.tasks) {
            switch (currentStep) {
              case TaskId.QUESTION_QUALITY:
                setConsensusTask1(consensusViewData.tasks);
                break;
              case TaskId.ANSWER_QUALITY:
                setConsensusTask2(consensusViewData.tasks);

                // NEW: Sync external state for consensus mode too
                const screenshotTask = consensusViewData.tasks.find(t => t.id === 'screenshot_url');
                if (screenshotTask && screenshotTask.textValue && handleScreenshotUrlChange) {
                  handleScreenshotUrlChange(screenshotTask.textValue);
                }

                const codeTask = consensusViewData.tasks.find(t => t.id === 'code_download_url');
                if (codeTask && codeTask.textValue && handleCodeUrlChange) {
                  handleCodeUrlChange(codeTask.textValue);
                }
                break;
              case TaskId.REWRITE:
                setConsensusTask3(consensusViewData.tasks);
                break;
            }
            setConsensusStars(consensusViewData.stars ?? null);
            setConsensusComment(consensusViewData.comment ?? '');
          } else {
            setConsensusStars(null);
            setConsensusComment('');
          }
        };
        loadConsensus();
      }
    }
  }, [discussionId, currentStep, viewMode, user, isPodLead, isAdmin, annotationsLoaded, getUserAnnotation, task2SubTasks]);
  const getSummaryData = () => ({ task1Results: {}, task2Results: {}, task3Results: {} });

  const onSaveClick = async () => {
    await handleSaveAnnotation(
        discussionId,
        currentStep,
        viewMode,
        screenshotUrl,
        codeDownloadUrl,
        handleBackToGrid,
        viewMode === 'consensus' ? consensusStars : null,
        viewMode === 'consensus' ? consensusComment : '',
        currentStep === TaskId.REWRITE ? task3Forms : undefined,
        currentStep === TaskId.REWRITE ? consensusTask3Forms : undefined
    );
  };
  const prepareTask2AnnotationData = (subTasks: SubTask[]) => {
    const annotationData: Record<string, any> = {};

    subTasks.forEach(task => {
      // Handle regular fields
      if (task.id !== 'screenshot_url' && task.id !== 'code_download_url') {
        if (task.selectedOption) {
          // Convert string options back to boolean for boolean fields
          if (task.options && task.options.includes('Yes') && task.options.includes('No')) {
            annotationData[task.id] = task.selectedOption === 'Yes';
          } else {
            annotationData[task.id] = task.selectedOption;
          }
        }

        // Include text values
        if (task.textValue) {
          annotationData[`${task.id}_text`] = task.textValue;
        }
      }
      // Handle special fields with API-specific naming
      else if (task.id === 'screenshot_url') {
        if (task.textValue) {
          annotationData['screenshot'] = task.textValue;
        }
      }
      else if (task.id === 'code_download_url') {
        if (task.textValue) {
          annotationData['codeDownloadUrl'] = task.textValue;
        }
      }
    });

    return annotationData;
  };
  useEffect(() => {
    // Force refresh Task 2 subtasks to include new fields
    if (currentStep === TaskId.ANSWER_QUALITY) {
      const updatedTask2 = [
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
        },
        // NEW: Screenshot URL field
        {
          id: 'screenshot_url',
          title: 'Screenshot Google Drive URL',
          status: 'pending' as SubTaskStatus,
          options: ['Provided', 'Not Needed'],
          description: 'Provide Google Drive URL for the screenshot',
          textInput: true,
          textValue: screenshotUrl || '',
          placeholder: 'Enter Google Drive URL for the screenshot'
        },
        // NEW: Code download URL field with verification
        {
          id: 'code_download_url',
          title: 'Code Download URL',
          status: 'pending' as SubTaskStatus,
          options: ['Verified manually', 'Not verified'],
          description: 'Provide and verify the code download URL',
          textInput: true,
          textValue: codeDownloadUrl || '',
          placeholder: 'https://github.com/owner/repo/archive/refs/tags/version.tar.gz',
          enableDocDownload: false,
          docDownloadLink: ''
        }
      ];

      // Only update if the current task2SubTasks doesn't have the new fields
      const hasNewFields = task2SubTasks.some(t => t.id === 'screenshot_url' || t.id === 'code_download_url');
      if (!hasNewFields) {
        console.log('Adding new fields to Task 2');
        setTask2SubTasks(updatedTask2);

        // Also update consensus tasks
        if (viewMode === 'consensus') {
          setConsensusTask2(updatedTask2);
        }
      }
    }
  }, [currentStep, task2SubTasks.length, screenshotUrl, codeDownloadUrl]);

  const handleViewDiscussion = () => {
    if (currentDiscussion) dispatch(openModal(currentDiscussion));
  };

  const handleUseAnnotationForConsensus = (annotation: Annotation) => {
    if (!annotation || !annotation.data) {
      toast.error('Selected annotation has no data to use.');
      return;
    }

    if (currentStep === TaskId.QUESTION_QUALITY) {
      // Task 1 - unchanged
      const baseSubTasks = JSON.parse(JSON.stringify(task1SubTasks));
      const mappedSubTasks = mapAnnotationToSubTasks(baseSubTasks, annotation);
      setConsensusTask1(mappedSubTasks);
    }
    else if (currentStep === TaskId.ANSWER_QUALITY) {
      // Task 2 - UPDATED to handle special field mappings
      const baseSubTasks = JSON.parse(JSON.stringify(task2SubTasks));
      const mappedSubTasks = baseSubTasks.map(task => {
        const savedValue = annotation.data[task.id];
        const savedTextValue = annotation.data[`${task.id}_text`];

        // Handle special Task 2 field mappings
        let actualTextValue = savedTextValue;
        let actualSelectedOption = savedValue;

        if (task.id === 'screenshot_url') {
          actualTextValue = annotation.data['screenshot'] || '';
          actualSelectedOption = actualTextValue ? 'Provided' : 'Not Needed';
        } else if (task.id === 'code_download_url') {
          actualTextValue = annotation.data['codeDownloadUrl'] || '';
          actualSelectedOption = actualTextValue ? 'Verified manually' : 'Not verified';
        }

        if (actualSelectedOption !== undefined || actualTextValue) {
          let selectedOption = '';

          if (typeof actualSelectedOption === 'boolean') {
            if (task.options && task.options.length > 0) {
              const trueOption = task.options.find(o => o.toLowerCase() === 'true' || o.toLowerCase() === 'yes');
              const falseOption = task.options.find(o => o.toLowerCase() === 'false' || o.toLowerCase() === 'no');
              if (actualSelectedOption === true && trueOption) selectedOption = trueOption;
              else if (actualSelectedOption === false && falseOption) selectedOption = falseOption;
            } else {
              selectedOption = actualSelectedOption ? 'Yes' : 'No';
            }
          } else if (typeof actualSelectedOption === 'string') {
            if (task.options && task.options.includes(actualSelectedOption)) {
              selectedOption = actualSelectedOption;
            } else {
              selectedOption = actualSelectedOption;
            }
          }

          let updatedTask = {
            ...task,
            selectedOption: selectedOption || actualSelectedOption,
            status: 'completed' as SubTaskStatus,
            textValue: typeof actualTextValue === 'string' ? actualTextValue : (task.textValue || '')
          };

          if (task.id === 'code_download_url') {
            updatedTask.docDownloadLink = actualTextValue || '';
            updatedTask.enableDocDownload = !!(actualTextValue && actualTextValue.trim());
          }

          return updatedTask;
        }

        return task;
      });

      setConsensusTask2(mappedSubTasks);

      // Also sync the external state for screenshot and code URLs
      const screenshotUrl = annotation.data['screenshot'];
      const codeUrl = annotation.data['codeDownloadUrl'];

      if (screenshotUrl && handleScreenshotUrlChange) {
        handleScreenshotUrlChange(screenshotUrl);
      }
      if (codeUrl && handleCodeUrlChange) {
        handleCodeUrlChange(codeUrl);
      }
    }
    else if (currentStep === TaskId.REWRITE) {
      // Task 3 - NEW: Handle multiple forms structure
      if (annotation.data.forms && Array.isArray(annotation.data.forms)) {
        // Multi-form annotation - populate consensus forms
        const consensusForms = annotation.data.forms.map((formData: any, index: number) => {
          const baseSubTasks = JSON.parse(JSON.stringify(task3SubTasks));

          const mappedSubTasks = baseSubTasks.map((task: SubTask) => {
            const savedValue = formData[task.id];
            const savedTextValue = formData[`${task.id}_text`];

            // Handle short_answer_list with claim/weight structure
            if (task.id === 'short_answer_list' && Array.isArray(savedValue)) {
              const claims = savedValue.map((item: any) =>
                  typeof item === 'object' ? item.claim : item
              );
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
                textValue: linkText || '',
                docDownloadLink: hasLink ? linkText : undefined,
                enableDocDownload: hasLink
              };
            }

            // Handle regular fields
            else if (savedValue !== undefined) {
              let selectedOption = '';

              if (typeof savedValue === 'boolean') {
                if (task.options && task.options.length > 0) {
                  const trueOption = task.options.find(o => o.toLowerCase() === 'true' || o.toLowerCase() === 'yes');
                  const falseOption = task.options.find(o => o.toLowerCase() === 'false' || o.toLowerCase() === 'no');
                  if (savedValue === true && trueOption) selectedOption = trueOption;
                  else if (savedValue === false && falseOption) selectedOption = falseOption;
                } else {
                  selectedOption = savedValue ? 'Yes' : 'No';
                }
              } else if (typeof savedValue === 'string') {
                if (task.options && task.options.length > 0 && task.options.includes(savedValue)) {
                  selectedOption = savedValue;
                } else if (!task.options || task.options.length === 0) {
                  selectedOption = savedValue;
                }
              }

              return {
                ...task,
                selectedOption,
                status: 'completed' as SubTaskStatus,
                textValue: typeof savedTextValue === 'string' ? savedTextValue : (task.textValue || '')
              };
            }

            return task;
          });

          return {
            id: formData.formId || `consensus-form-${index + 1}`,
            name: formData.formName || `Form ${index + 1}`,
            subTasks: mappedSubTasks
          };
        });

        setConsensusTask3Forms(consensusForms);
        setActiveConsensusTask3Form(0); // Set to first form

        toast.success(`Populated ${consensusForms.length} consensus forms from selected annotation.`);
      }
      else {
        // Single form annotation - fallback to old behavior
        const baseSubTasks = JSON.parse(JSON.stringify(task3SubTasks));
        const mappedSubTasks = mapAnnotationToSubTasksForTask3(baseSubTasks, annotation);
        setConsensusTask3(mappedSubTasks);

        toast.success('Consensus form populated with selected annotation.');
      }
    }

    setConsensusStars(null);
    setConsensusComment('');
    toast.success('Consensus populated with selected annotation. Please provide overall feedback.');
  };
  
  // Helper function for Task 3 single form mapping
  const mapAnnotationToSubTasksForTask3 = (baseSubTasks: SubTask[], annotation: Annotation): SubTask[] => {
    return baseSubTasks.map(task => {
      const savedValue = annotation.data[task.id];
      const savedTextValue = annotation.data[`${task.id}_text`];
      
      // Handle short_answer_list with new format
      if (task.id === 'short_answer_list') {
        // Check for aggregated format first
        if (Array.isArray(annotation.data.short_answer_list)) {
          const shortAnswerData = annotation.data.short_answer_list;
          
          // Handle nested array format (multiple forms)
          if (shortAnswerData.length > 0 && Array.isArray(shortAnswerData[0])) {
            // Use first form's data
            const firstFormData = shortAnswerData[0];
            const claims = firstFormData.map((item: any) => 
              typeof item === 'object' ? item.claim : item
            );
            const weights = firstFormData.map((item: any) => 
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
          // Handle single form format
          else {
            const claims = shortAnswerData.map((item: any) => 
              typeof item === 'object' ? item.claim : item
            );
            const weights = shortAnswerData.map((item: any) => 
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
        }
      }
      
      // Handle supporting docs from aggregated data
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
      
      // Handle doc_download_link from aggregated data
      else if (task.id === 'doc_download_link') {
        const linkValue = annotation.data['doc_download_link'] || annotation.data['doc_download_links']?.[0];
        const hasLink = linkValue && typeof linkValue === 'string' && linkValue.trim() !== '';
        
        return {
          ...task,
          selectedOption: hasLink ? 'Needed' : 'Not Needed',
          status: 'completed' as SubTaskStatus,
          textValue: linkValue || '',
          docDownloadLink: hasLink ? linkValue : undefined,
          enableDocDownload: hasLink
        };
      }
      
      // Handle other fields using aggregated data
      else if (savedValue !== undefined) {
        let selectedOption = '';
        
        if (typeof savedValue === 'boolean') {
          if (task.options && task.options.length > 0) {
            const trueOption = task.options.find(o => o.toLowerCase() === 'true' || o.toLowerCase() === 'yes');
            const falseOption = task.options.find(o => o.toLowerCase() === 'false' || o.toLowerCase() === 'no');
            if (savedValue === true && trueOption) selectedOption = trueOption;
            else if (savedValue === false && falseOption) selectedOption = falseOption;
          } else {
            selectedOption = savedValue ? 'Yes' : 'No';
          }
        } else if (typeof savedValue === 'string') {
          if (task.options && task.options.length > 0 && task.options.includes(savedValue)) {
            selectedOption = savedValue;
          } else if (!task.options || task.options.length === 0) {
            selectedOption = savedValue;
          }
        }
        
        // Handle aggregated text values
        let textValue = savedTextValue;
        if (!textValue) {
          // Try to get from aggregated lists
          if (task.id === 'rewrite' && annotation.data.rewrite_list?.[0]) {
            textValue = annotation.data.rewrite_list[0];
          } else if (task.id === 'longAnswer' && annotation.data.longAnswer_list?.[0]) {
            textValue = annotation.data.longAnswer_list[0];
          }
        }
        
        return {
          ...task,
          selectedOption,
          status: 'completed' as SubTaskStatus,
          textValue: typeof textValue === 'string' ? textValue : (task.textValue || '')
        };
      }
      
      return task;
    });
  };
  
  // Helper function for Tasks 1 & 2 (unchanged)
  const mapAnnotationToSubTasks = (baseSubTasks: SubTask[], annotation: Annotation): SubTask[] => {
    return baseSubTasks.map(task => {
      const savedValue = annotation.data[task.id];
      const savedTextValue = annotation.data[`${task.id}_text`];

      // Handle special Task 2 field mappings from API
      let actualTextValue = savedTextValue;
      let actualSelectedOption = savedValue;

      // Map API field names to our task structure
      if (task.id === 'screenshot_url') {
        actualTextValue = annotation.data['screenshot'] || '';
        actualSelectedOption = annotation.data['screenshot_status'] || (actualTextValue ? 'Provided' : 'Not Needed');
      } else if (task.id === 'code_download_url') {
        actualTextValue = annotation.data['codeDownloadUrl'] || '';
        actualSelectedOption = annotation.data['codeDownloadUrl_status'] || (actualTextValue ? 'Verified manually' : 'Not verified');
      }

      if (actualSelectedOption !== undefined || actualTextValue !== undefined) {
        let selectedOption = '';

        if (typeof actualSelectedOption === 'boolean') {
          if (task.options && task.options.length > 0) {
            const trueOption = task.options.find(o => o.toLowerCase() === 'true' || o.toLowerCase() === 'yes');
            const falseOption = task.options.find(o => o.toLowerCase() === 'false' || o.toLowerCase() === 'no');
            if (actualSelectedOption === true && trueOption) selectedOption = trueOption;
            else if (actualSelectedOption === false && falseOption) selectedOption = falseOption;
          } else {
            selectedOption = actualSelectedOption ? 'Yes' : 'No';
          }
        } else if (typeof actualSelectedOption === 'string') {
          if (task.options && task.options.length > 0 && task.options.includes(actualSelectedOption)) {
            selectedOption = actualSelectedOption;
          } else if (!task.options || task.options.length === 0) {
            selectedOption = actualSelectedOption;
          }
        }

        // Create the updated task
        let updatedTask = {
          ...task,
          selectedOption: selectedOption || actualSelectedOption,
          status: 'completed' as SubTaskStatus,
          textValue: typeof actualTextValue === 'string' ? actualTextValue : (task.textValue || '')
        };

        // Handle special properties for specific fields
        if (task.id === 'code_download_url') {
          updatedTask.docDownloadLink = actualTextValue || '';
          updatedTask.enableDocDownload = !!(actualTextValue && actualTextValue.trim());
        }

        return updatedTask;
      }

      return task;
    });
  };
// Simple duplication function
const handleDuplicateForm = (type: string) => {
  if (!task3SubTasks) return;
  
  const newForm = {
    id: `form-${Date.now()}`,
    name: `Form ${task3Forms.length + 1+ type}`,
    subTasks: JSON.parse(JSON.stringify(task3SubTasks)),
    type: type
  };
  
  if (type === 'Q') {
    // Clear questions in new form
    newForm.subTasks = newForm.subTasks.map((task: { id: string; }) => {
      if (task.id.toLowerCase().includes('question')) {
        return { ...task, textValue: '', selectedOption: '', status: 'pending' };
      }
      return task;
    });
  }
  // For type 'A', questions are duplicated (no changes needed)
  
  setTask3Forms([...task3Forms, newForm]);
  setActiveTask3Form(task3Forms.length);
};
  return (
      <div className="min-h-screen bg-gray-50 flex flex-col">
        <Header />
        <div className="container max-w-4xl mx-auto px-4 py-6 flex-grow">
          {(url || discussionId) && <DashboardBreadcrumb discussionId={discussionId || undefined} currentStep={currentStep} discussionTitle={currentDiscussion?.title || 'Discussion'} />}
          {currentStep === 0 && !discussionId && <UrlInput onSubmit={handleUrlSubmit} />}
          {(url || discussionId) && viewMode === 'grid' && (
              <>
                <div className="mb-6">
                  <h2 className="text-xl font-semibold mb-2">Annotation Tasks</h2>
                  <p className="text-gray-600 text-sm">GitHub Discussion URL: <span className="text-dashboard-blue">{url}</span></p>
                  {currentDiscussion && (
                      <div className="mt-2">
                        <Button variant="outline" className="flex items-center gap-2" onClick={handleViewDiscussion}>
                          <Eye className="h-4 w-4" />
                          <span>View Discussion Details</span>
                        </Button>
                      </div>
                  )}
                </div>
                <TaskGrid tasks={tasks} onSelectTask={handleSelectTask} githubUrl={url} repositoryLanguage={currentDiscussion?.repositoryLanguage} releaseTag={currentDiscussion?.releaseTag} releaseDate={currentDiscussion?.releaseDate} />
              </>
          )}
          {(url || discussionId) && (viewMode === 'detail' || viewMode === 'consensus') && (
              <>
                <ProgressStepper steps={steps} currentStep={currentStep} />
                <div className="mb-4 flex justify-between items-center">
                  {currentDiscussion && (
                      <Button variant="outline" className="flex items-center gap-2" onClick={handleViewDiscussion}>
                        <Eye className="h-4 w-4" />
                        <span>View Discussion Details</span>
                      </Button>
                  )}
                  {(isPodLead || isAdmin) && currentStep > 0 && (
                      <Button onClick={toggleConsensusMode} variant="outline" className="flex items-center gap-2">
                        <CheckCircle className="h-4 w-4" />
                        {viewMode === 'detail' ? 'Create Consensus' : 'View Annotator Form'}
                      </Button>
                  )}
                </div>
                {currentStep === TaskId.QUESTION_QUALITY && viewMode === 'detail' && (
                    <TaskCard title="Task 1: Question Quality Assessment" description="Evaluate the quality of the question based on relevance, learning value, clarity, and image grounding." subTasks={task1SubTasks} status={getTask1Progress()} onSubTaskChange={(taskId, selectedOption, textValue) => handleSubTaskChange('task1', taskId, selectedOption, textValue)} active />
                )}
                {currentStep === TaskId.QUESTION_QUALITY && viewMode === 'consensus' && (isPodLead || isAdmin) && (
                    <>
                      <TaskCard title="Task 1: Question Quality Consensus" description="Create a consensus based on annotator assessments of question quality." subTasks={consensusTask1} status={getTask1Progress(true)} onSubTaskChange={(taskId, selectedOption, textValue) => handleSubTaskChange('consensus1', taskId, selectedOption, textValue)} active />
                      <div className="mt-4 p-4 border rounded bg-gray-50">
                        <h3 className="text-lg font-semibold mb-2">Overall Consensus Feedback</h3>
                        <div className="mb-2">
                          <label className="block text-sm font-medium text-gray-700 mb-1">Rating (1-5 stars):</label>
                          <div className="flex space-x-1">
                            {[1, 2, 3, 4, 5].map(star => (
                                <Button key={star} variant={consensusStars === star ? 'default' : 'outline'} size="sm" onClick={() => setConsensusStars(star)}>
                                  {star}
                                </Button>
                            ))}
                            {consensusStars && <Button variant="ghost" size="sm" onClick={() => setConsensusStars(null)}>Clear</Button>}
                          </div>
                        </div>
                        <div>
                          <label htmlFor="consensusCommentTask1" className="block text-sm font-medium text-gray-700 mb-1">Comment:</label>
                          <Textarea id="consensusCommentTask1" value={consensusComment} onChange={e => setConsensusComment(e.target.value)} placeholder="Provide an overall comment for this consensus..." rows={3} />
                        </div>
                      </div>
                      <AnnotatorView discussionId={discussionId || ''} currentStep={currentStep} getAnnotationsForTask={getAnnotationsForTask} onUseForConsensus={handleUseAnnotationForConsensus} getUserEmailById={getUserEmailById} />
                    </>
                )}
                {currentStep === TaskId.ANSWER_QUALITY && viewMode === 'detail' && (
                    <TaskCard
                        title="Task 2: Answer Quality Assessment"
                        description="Evaluate the quality of the answer based on comprehensiveness, explanation, code execution, and completeness."
                        subTasks={task2SubTasks}
                        status={getTask2Progress()}
                        onSubTaskChange={(taskId, selectedOption, textValue, textValues, supportingDocs, sectionIndex, weights, docDownloadLink) => {
                          // Handle screenshot_url and code_download_url fields
                          if (taskId === 'screenshot_url') {
                            if (textValue && handleScreenshotUrlChange) {
                              handleScreenshotUrlChange(textValue);
                            }
                            handleSubTaskChange('task2', taskId, selectedOption, textValue);
                          } else if (taskId === 'code_download_url') {
                            if (textValue && handleCodeUrlChange) {
                              handleCodeUrlChange(textValue);
                            }
                            handleSubTaskChange('task2', taskId, selectedOption, textValue, textValues, supportingDocs, sectionIndex, weights, docDownloadLink);
                          } else {
                            handleSubTaskChange('task2', taskId, selectedOption, textValue, textValues, supportingDocs, sectionIndex, weights);
                          }
                        }}
                        active
                        currentDiscussion={currentDiscussion}
                        onCodeUrlVerify={validateGitHubCodeUrl}
                    />
                )}

                {currentStep === TaskId.ANSWER_QUALITY && viewMode === 'consensus' && (isPodLead || isAdmin) && (
                    <>
                      <TaskCard
                          title="Task 2: Answer Quality Consensus"
                          description="Create a consensus based on annotator assessments."
                          subTasks={consensusTask2}
                          status={getTask2Progress(true)}
                          onSubTaskChange={(taskId, selectedOption, textValue, textValues, supportingDocs, sectionIndex, weights, docDownloadLink) => {
                            // Handle screenshot_url and code_download_url fields in consensus mode
                            if (taskId === 'screenshot_url') {
                              if (textValue && handleScreenshotUrlChange) {
                                handleScreenshotUrlChange(textValue);
                              }
                              handleSubTaskChange('consensus2', taskId, selectedOption, textValue);
                            } else if (taskId === 'code_download_url') {
                              if (textValue && handleCodeUrlChange) {
                                handleCodeUrlChange(textValue);
                              }
                              handleSubTaskChange('consensus2', taskId, selectedOption, textValue, textValues, supportingDocs, sectionIndex, weights, docDownloadLink);
                            } else {
                              handleSubTaskChange('consensus2', taskId, selectedOption, textValue, textValues, supportingDocs, sectionIndex, weights);
                            }
                          }}
                          active
                          currentDiscussion={currentDiscussion}
                          onCodeUrlVerify={validateGitHubCodeUrl}
                      />
                      <div className="mt-4 p-4 border rounded bg-gray-50">
                        <h3 className="text-lg font-semibold mb-2">Overall Consensus Feedback</h3>
                        <div className="mb-2">
                          <label className="block text-sm font-medium text-gray-700 mb-1">Rating (1-5 stars):</label>
                          <div className="flex space-x-1">
                            {[1, 2, 3, 4, 5].map(star => (
                                <Button key={star} variant={consensusStars === star ? 'default' : 'outline'} size="sm" onClick={() => setConsensusStars(star)}>
                                  {star}
                                </Button>
                            ))}
                            {consensusStars && <Button variant="ghost" size="sm" onClick={() => setConsensusStars(null)}>Clear</Button>}
                          </div>
                        </div>
                        <div>
                          <label htmlFor="consensusComment" className="block text-sm font-medium text-gray-700 mb-1">Comment:</label>
                          <Textarea id="consensusComment" value={consensusComment} onChange={e => setConsensusComment(e.target.value)} placeholder="Provide an overall comment for this consensus..." rows={3} />
                        </div>
                      </div>
                      <AnnotatorView
                          discussionId={discussionId || ''}
                          currentStep={currentStep}
                          getAnnotationsForTask={getAnnotationsForTask}
                          onUseForConsensus={handleUseAnnotationForConsensus}
                          getUserEmailById={getUserEmailById}
                      />
                    </>
                )}

{currentStep === TaskId.REWRITE && viewMode === 'detail' && (
  <>
    <div className="mb-4">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-lg font-semibold">Task 3 Forms</h3>
        <div className="flex space-x-2">
          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => handleDuplicateForm('Q')}
          >
            + Question Form
          </Button>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => handleDuplicateForm('A')}
          >
            + Answer Form
          </Button>
        </div>
      </div>
      <div className="flex space-x-2 border-b">
        {task3Forms.map((form, index) => (
          <div key={form.id} className="relative">
            <Button 
              variant={activeTask3Form === index ? 'default' : 'ghost'} 
              size="sm" 
              className="rounded-b-none" 
              onClick={() => setActiveTask3Form(index)}
            >
              {form.name}
            </Button>
            {index > 0 && (
              <Button 
                variant="ghost" 
                size="sm" 
                className="absolute -top-2 -right-2 h-6 w-6 p-0 rounded-full" 
                onClick={e => {
                  e.stopPropagation();
                  const updatedForms = task3Forms.filter((_, i) => i !== index);
                  setTask3Forms(updatedForms);
                  if (activeTask3Form >= updatedForms.length) setActiveTask3Form(updatedForms.length - 1);
                }}
              >
                ×
              </Button>
            )}
          </div>
        ))}
      </div>
    </div>
    {task3Forms[activeTask3Form] && (
      <TaskCard
        title={`Task 3: Rewrite Question and Answer - ${task3Forms[activeTask3Form].name}`}
        description="Rewrite the question and answer to improve clarity, conciseness, and coherence."
        subTasks={task3Forms[activeTask3Form].subTasks}
        // FIX: Calculate status based on the actual form being displayed
        status={(() => {
          const currentForm = task3Forms[activeTask3Form];
          if (!currentForm || !currentForm.subTasks) return 'pending';
          
          const completed = currentForm.subTasks.filter(t => 
            t.status === 'completed' || t.status === 'na'
          ).length;
          const total = currentForm.subTasks.length;
          
          if (completed === total) return 'completed';
          if (completed > 0) return 'inProgress';
          return 'pending';
        })()}
        onSubTaskChange={(taskId, selectedOption, textValue, textValues, supportingDocs, sectionIndex, weights) => {
          const updatedForms = [...task3Forms];
          const currentForm = updatedForms[activeTask3Form];
          currentForm.subTasks = currentForm.subTasks.map(task => {
            if (task.id === taskId) {
              const isCompleted = computeCompleted(task, selectedOption, textValue, textValues, supportingDocs);
              return { 
                ...task, 
                selectedOption, 
                textValue: textValue !== undefined ? textValue : task.textValue, 
                textValues: textValues !== undefined ? textValues : task.textValues, 
                supportingDocs: supportingDocs !== undefined ? supportingDocs : task.supportingDocs, 
                weights: weights !== undefined ? weights : task.weights, 
                status: isCompleted ? 'completed' : 'pending' 
              };
            }
            return task;
          });
          setTask3Forms(updatedForms);
        }}
        active
        customFieldRenderers={{
          short_answer_list: (task, onChange) => (
            <div className="space-y-3">
              <div className="text-sm font-medium text-gray-700 mb-2">
                Short Answer Claims (with priority weights 1-3)
              </div>
              {task.textValues?.map((claim, index) => (
                <div key={index} className="flex space-x-3 items-start p-3 border rounded-md bg-gray-50">
                  {/* Claim Input */}
                  <div className="flex-1">
                    <label className="block text-xs font-medium text-gray-600 mb-1">
                      Claim #{index + 1}
                    </label>
                    <Textarea
                      value={claim}
                      onChange={e => {
                        const newValues = [...(task.textValues || [])]; 
                        newValues[index] = e.target.value; 
                        console.log('Claim changed:', index, 'to', e.target.value);
                        // FIX: Call with proper parameter order
                        onChange(task.id, task.selectedOption, undefined, newValues, undefined, undefined, task.weights);
                      }}
                      placeholder="Enter a short answer claim"
                      className="min-h-[80px] text-sm"
                    />
                  </div>
                  
                  {/* Weight Selection */}
                  <div className="flex flex-col items-center min-w-[80px]">
                    <label className="text-xs font-medium text-gray-600 mb-1">Weight</label>
                    <select 
                      value={task.weights?.[index] || 1} 
                      onChange={e => {
                        // Create new weights array properly
                        const currentWeights = task.weights || task.textValues?.map(() => 1) || [];
                        const newWeights = [...currentWeights]; 
                        newWeights[index] = parseInt(e.target.value); 
                        
                        console.log('Weight changed:', index, 'to', e.target.value, 'new weights:', newWeights);
                        console.log('Current task:', task.id, 'textValues:', task.textValues);
                        
                        // FIX: Call with proper parameter order - weights is the 7th parameter
                        onChange(
                          task.id,           // taskId
                          task.selectedOption, // selectedOption  
                          undefined,         // textValue
                          task.textValues,   // textValues
                          undefined,         // supportingDocs
                          undefined,         // sectionIndex
                          newWeights         // weights
                        );
                      }} 
                      className="w-16 px-2 py-2 border rounded-md text-center text-sm"
                    >
                      <option value={1}>1</option>
                      <option value={2}>2</option>
                      <option value={3}>3</option>
                    </select>
                    <span className="text-xs text-gray-500 mt-1">Priority</span>
                  </div>
                  
                  {/* Remove Button */}
                  <Button 
                    variant="ghost" 
                    size="sm"
                    onClick={() => {
                      const newValues = task.textValues?.filter((_, i) => i !== index) || []; 
                      const newWeights = task.weights?.filter((_, i) => i !== index) || []; 
                      console.log('Removing claim:', index, 'newValues:', newValues, 'newWeights:', newWeights);
                      onChange(task.id, task.selectedOption, undefined, newValues, undefined, undefined, newWeights);
                    }}
                    disabled={task.textValues?.length === 1}
                    className="mt-6"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ))}
              
              {/* Add New Claim Button */}
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => {
                  const newValues = [...(task.textValues || []), '']; 
                  const newWeights = [...(task.weights || []), 1];
                  console.log('Adding new claim, newValues:', newValues, 'newWeights:', newWeights);
                  onChange(task.id, task.selectedOption, undefined, newValues, undefined, undefined, newWeights);
                }}
                className="w-full"
              >
                <Plus className="h-4 w-4 mr-2" />
                Add Short Answer Claim
              </Button>
            </div>
          )
        }}
      />
    )}
  </>
)}
{currentStep === TaskId.REWRITE && viewMode === 'consensus' && (isPodLead || isAdmin) && (
  <>
    <div className="mb-4">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-lg font-semibold">Task 3 Consensus Forms</h3>
        <div className="flex space-x-2">
          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => handleDuplicateForm('Q')}
          >
            + Question Form
          </Button>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => handleDuplicateForm('A')}
          >
            + Answer Form
          </Button>
        </div>
      </div>
      <div className="flex space-x-2 border-b">
        {consensusTask3Forms.map((form, index) => (
          <div key={form.id} className="relative">
            <Button 
              variant={activeConsensusTask3Form === index ? 'default' : 'ghost'} 
              size="sm" 
              className="rounded-b-none" 
              onClick={() => setActiveConsensusTask3Form(index)}
            >
              {form.name}
            </Button>
            {index > 0 && (
              <Button 
                variant="ghost" 
                size="sm" 
                className="absolute -top-2 -right-2 h-6 w-6 p-0 rounded-full" 
                onClick={e => {
                  e.stopPropagation();
                  const updatedForms = consensusTask3Forms.filter((_, i) => i !== index);
                  setConsensusTask3Forms(updatedForms);
                  if (activeConsensusTask3Form >= updatedForms.length) {
                    setActiveConsensusTask3Form(updatedForms.length - 1);
                  }
                }}
              >
                ×
              </Button>
            )}
          </div>
        ))}
      </div>
    </div>
    
    {consensusTask3Forms[activeConsensusTask3Form] && (
      <TaskCard
        title={`Task 3: Rewrite Consensus - ${consensusTask3Forms[activeConsensusTask3Form].name}`}
        description="Create a consensus based on annotator assessments."
        subTasks={consensusTask3Forms[activeConsensusTask3Form].subTasks}
        // Calculate status based on the actual consensus form being displayed
        status={(() => {
          const currentForm = consensusTask3Forms[activeConsensusTask3Form];
          if (!currentForm || !currentForm.subTasks) return 'pending';
          
          const completed = currentForm.subTasks.filter(t => 
            t.status === 'completed' || t.status === 'na'
          ).length;
          const total = currentForm.subTasks.length;
          
          if (completed === total) return 'completed';
          if (completed > 0) return 'inProgress';
          return 'pending';
        })()}
        onSubTaskChange={(taskId, selectedOption, textValue, textValues, supportingDocs, sectionIndex, weights) => {
          const updatedForms = [...consensusTask3Forms];
          const currentForm = updatedForms[activeConsensusTask3Form];
          
          currentForm.subTasks = currentForm.subTasks.map(task => {
            if (task.id === taskId) {
              const isCompleted = computeCompleted(task, selectedOption, textValue, textValues, supportingDocs);
              return { 
                ...task, 
                selectedOption, 
                textValue: textValue !== undefined ? textValue : task.textValue, 
                textValues: textValues !== undefined ? textValues : task.textValues, 
                supportingDocs: supportingDocs !== undefined ? supportingDocs : task.supportingDocs, 
                weights: weights !== undefined ? weights : task.weights, 
                status: isCompleted ? 'completed' : 'pending' 
              };
            }
            return task;
          });
          
          setConsensusTask3Forms(updatedForms);
        }}
        active
        customFieldRenderers={{
          short_answer_list: (task, onChange) => (
            <div className="space-y-3">
              <div className="text-sm font-medium text-gray-700 mb-2">
                Short Answer Claims (with priority weights 1-3)
              </div>
              {task.textValues?.map((claim, index) => (
                <div key={index} className="flex space-x-3 items-start p-3 border rounded-md bg-gray-50">
                  {/* Claim Input */}
                  <div className="flex-1">
                    <label className="block text-xs font-medium text-gray-600 mb-1">
                      Claim #{index + 1}
                    </label>
                    <Textarea
                      value={claim}
                      onChange={e => {
                        const newValues = [...(task.textValues || [])]; 
                        newValues[index] = e.target.value; 
                        onChange(task.id, task.selectedOption, undefined, newValues, undefined, undefined, task.weights);
                      }}
                      placeholder="Enter a short answer claim"
                      className="min-h-[80px] text-sm"
                    />
                  </div>
                  
                  {/* Weight Selection */}
                  <div className="flex flex-col items-center min-w-[80px]">
                    <label className="text-xs font-medium text-gray-600 mb-1">Weight</label>
                    <select 
                      value={task.weights?.[index] || 1} 
                      onChange={e => {
                        const currentWeights = task.weights || task.textValues?.map(() => 1) || [];
                        const newWeights = [...currentWeights]; 
                        newWeights[index] = parseInt(e.target.value); 
                        onChange(task.id, task.selectedOption, undefined, task.textValues, undefined, undefined, newWeights);
                      }} 
                      className="w-16 px-2 py-2 border rounded-md text-center text-sm"
                    >
                      <option value={1}>1</option>
                      <option value={2}>2</option>
                      <option value={3}>3</option>
                    </select>
                    <span className="text-xs text-gray-500 mt-1">Priority</span>
                  </div>
                  
                  {/* Remove Button */}
                  <Button 
                    variant="ghost" 
                    size="sm"
                    onClick={() => {
                      const newValues = task.textValues?.filter((_, i) => i !== index) || []; 
                      const newWeights = task.weights?.filter((_, i) => i !== index) || []; 
                      onChange(task.id, task.selectedOption, undefined, newValues, undefined, undefined, newWeights);
                    }}
                    disabled={task.textValues?.length === 1}
                    className="mt-6"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ))}
              
              {/* Add New Claim Button */}
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => {
                  const newValues = [...(task.textValues || []), '']; 
                  const newWeights = [...(task.weights || []), 1];
                  onChange(task.id, task.selectedOption, undefined, newValues, undefined, undefined, newWeights);
                }}
                className="w-full"
              >
                <Plus className="h-4 w-4 mr-2" />
                Add Short Answer Claim
              </Button>
            </div>
          )
        }}
      />
    )}
    
    <div className="mt-4 p-4 border rounded bg-gray-50">
      <h3 className="text-lg font-semibold mb-2">Overall Consensus Feedback</h3>
      <div className="mb-2">
        <label className="block text-sm font-medium text-gray-700 mb-1">Rating (1-5 stars):</label>
        <div className="flex space-x-1">
          {[1, 2, 3, 4, 5].map(star => (
            <Button 
              key={star} 
              variant={consensusStars === star ? 'default' : 'outline'} 
              size="sm" 
              onClick={() => setConsensusStars(star)}
            >
              {star}
            </Button>
          ))}
          {consensusStars && (
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={() => setConsensusStars(null)}
            >
              Clear
            </Button>
          )}
        </div>
      </div>
      <div>
        <label htmlFor="consensusCommentTask3" className="block text-sm font-medium text-gray-700 mb-1">
          Comment:
        </label>
        <Textarea 
          id="consensusCommentTask3" 
          value={consensusComment} 
          onChange={e => setConsensusComment(e.target.value)} 
          placeholder="Provide an overall comment for this consensus..." 
          rows={3} 
        />
      </div>
    </div>
    
    <AnnotatorView 
      discussionId={discussionId || ''} 
      currentStep={currentStep} 
      getAnnotationsForTask={getAnnotationsForTask} 
      onUseForConsensus={handleUseAnnotationForConsensus} 
      getUserEmailById={getUserEmailById} 
    />
  </>
)}
                {currentStep === TaskId.SUMMARY && <Summary results={getSummaryData()} />}
              </>
          )}
        
              <DashboardNavigation 
                viewMode={viewMode} 
                currentStep={currentStep} 
                // Update this line to pass form context
                canProceed={(() => {
                  if (currentStep === TaskId.REWRITE) {
                    // For Task 3, check the current active form's completion
                    if (viewMode === 'consensus') {
                      return canProceed(
                        currentStep, 
                        viewMode, 
                        undefined, 
                        undefined,
                        activeConsensusTask3Form, 
                        consensusTask3Forms
                      );
                    } else {
                      return canProceed(
                        currentStep, 
                        viewMode, 
                        activeTask3Form, 
                        task3Forms
                      );
                    }
                  }
                  // For other tasks, use original logic
                  return canProceed(currentStep, viewMode);
                })()} 
                onBackToGrid={handleBackToGrid}
                onSave={onSaveClick} 
                isConsensus={viewMode === 'consensus'} 
                screenshotUrl={screenshotUrl} 
                onScreenshotUrlChange={handleScreenshotUrlChange} 
                codeDownloadUrl={codeDownloadUrl} 
                discussionId={discussionId ?? undefined} 
                onCodeUrlChange={handleCodeUrlChange} 
                onCodeUrlVerify={validateGitHubCodeUrl} 
                currentDiscussion={currentDiscussion} 
              /></div>
        <DiscussionDetailsModal discussion={null} />
      </div>
  );
};

export default Dashboard;
