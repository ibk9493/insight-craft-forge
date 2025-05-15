import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import Header from '@/components/layout/Header';
import UrlInput from '@/components/dashboard/UrlInput';
import TaskCard, { SubTask, SubTaskStatus } from '@/components/dashboard/TaskCard';
import TaskGrid from '@/components/dashboard/TaskGrid';
import ProgressStepper from '@/components/dashboard/ProgressStepper';
import Summary from '@/components/dashboard/Summary';
import { Button } from '@/components/ui/button';
import { ArrowLeft, ArrowRight, CheckCircle } from 'lucide-react';
import { toast } from 'sonner';
import { useUser } from '@/contexts/UserContext';
import { useAnnotationData } from '@/hooks/useAnnotationData';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

const Dashboard = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, isAuthenticated, isPodLead } = useUser();
  const queryParams = new URLSearchParams(location.search);
  const discussionId = queryParams.get('discussionId');
  const taskNumber = queryParams.get('task') ? parseInt(queryParams.get('task')!) : null;
  
  const [url, setUrl] = useState<string>('');
  const [currentStep, setCurrentStep] = useState(taskNumber || 0);
  const [viewMode, setViewMode] = useState<'grid' | 'detail' | 'consensus'>(taskNumber ? 'detail' : 'grid');
  const [selectedTaskId, setSelectedTaskId] = useState<number | null>(taskNumber);
  
  // Get access to annotation data
  const {
    discussions,
    getUserAnnotation,
    getAnnotationsForTask,
    saveAnnotation,
    saveConsensusAnnotation,
    getConsensusAnnotation
  } = useAnnotationData();

  // Task sub-tasks state
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
  
  // Progress steps
  const [steps, setSteps] = useState([
    { id: 1, title: 'Input URL', completed: false },
    { id: 2, title: 'Task 1', completed: false },
    { id: 3, title: 'Task 2', completed: false },
    { id: 4, title: 'Task 3', completed: false },
    { id: 5, title: 'Summary', completed: false },
  ]);
  
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

  // Check login and redirect if necessary
  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/');
      return;
    }
    
    // If discussion ID is provided but no task is selected, show grid view
    if (discussionId && !taskNumber) {
      setViewMode('grid');
      setCurrentStep(0);
    }
    // If discussion ID and task are provided, show task detail view
    else if (discussionId && taskNumber) {
      setViewMode('detail');
      setCurrentStep(taskNumber);
      setSelectedTaskId(taskNumber);
      
      // Load existing annotation for this user if it exists
      loadUserAnnotation(discussionId, taskNumber);
      
      // For pod leads, also prepare consensus view
      if (isPodLead) {
        prepareConsensusView(discussionId, taskNumber);
      }
    }
    // If nothing is provided, redirect to discussions page
    else if (!discussionId) {
      navigate('/discussions');
    }
    
    // If URL parameter is in the query, use it
    const urlParam = queryParams.get('url');
    if (urlParam) {
      setUrl(urlParam);
    } else if (discussionId) {
      // Get URL from discussion
      const discussion = discussions.find(d => d.id === discussionId);
      if (discussion) {
        setUrl(discussion.url);
      }
    }
  }, [discussionId, taskNumber, navigate, queryParams, isAuthenticated, isPodLead]);

  // Load user's existing annotation if it exists
  const loadUserAnnotation = (discussionId: string, taskId: number) => {
    if (!user) return;
    
    const existingAnnotation = getUserAnnotation(discussionId, user.id, taskId);
    if (!existingAnnotation) return;
    
    // Map the annotation data to subtasks
    if (taskId === 1) {
      const updatedSubTasks = task1SubTasks.map(task => {
        const value = existingAnnotation.data[task.id];
        if (value !== undefined) {
          return {
            ...task,
            selectedOption: value as string,
            status: 'completed' as SubTaskStatus
          };
        }
        return task;
      });
      setTask1SubTasks(updatedSubTasks);
    }
    else if (taskId === 2) {
      const updatedSubTasks = task2SubTasks.map(task => {
        const value = existingAnnotation.data[task.id];
        if (value !== undefined) {
          return {
            ...task,
            selectedOption: value as string,
            textValue: task.textInput ? value as string : undefined,
            status: 'completed' as SubTaskStatus
          };
        }
        return task;
      });
      setTask2SubTasks(updatedSubTasks);
    }
    else if (taskId === 3) {
      const updatedSubTasks = task3SubTasks.map(task => {
        const value = existingAnnotation.data[task.id];
        if (value !== undefined) {
          return {
            ...task,
            selectedOption: task.textInput ? undefined : value as string,
            textValue: task.textInput ? value as string : undefined,
            status: 'completed' as SubTaskStatus
          };
        }
        return task;
      });
      setTask3SubTasks(updatedSubTasks);
    }
  };

  // Prepare consensus view for pod leads
  const prepareConsensusView = (discussionId: string, taskId: number) => {
    // Get all annotations for this task
    const taskAnnotations = getAnnotationsForTask(discussionId, taskId);
    
    if (taskId === 1) {
      // Generate consensus subtasks from the data
      const consensusTasks: SubTask[] = [
        {
          id: 'relevance',
          title: 'Final Relevance Assessment',
          status: 'pending',
          options: ['Yes', 'No'],
          description: `Annotator consensus: ${
            taskAnnotations.filter(a => a.data.relevance === 'Yes').length
          }/${taskAnnotations.length} Yes`
        },
        {
          id: 'learning',
          title: 'Final Learning Value Assessment',
          status: 'pending',
          options: ['Yes', 'No'],
          description: `Annotator consensus: ${
            taskAnnotations.filter(a => a.data.learning_value === 'Yes').length
          }/${taskAnnotations.length} Yes`
        },
        {
          id: 'clarity',
          title: 'Final Clarity Assessment',
          status: 'pending',
          options: ['Yes', 'No'],
          description: `Annotator consensus: ${
            taskAnnotations.filter(a => a.data.clarity === 'Yes').length
          }/${taskAnnotations.length} Yes`
        },
        {
          id: 'grounded',
          title: 'Final Image Grounding Assessment',
          status: 'pending',
          options: ['True', 'False', 'N/A'],
          description: `Annotator results: ${
            taskAnnotations.filter(a => a.data.grounded === 'True').length
          } True, ${
            taskAnnotations.filter(a => a.data.grounded === 'False').length
          } False, ${
            taskAnnotations.filter(a => a.data.grounded === 'N/A').length
          } N/A`
        }
      ];
      
      // Check if there's already a consensus annotation
      const existingConsensus = getConsensusAnnotation(discussionId, taskId);
      if (existingConsensus) {
        // Apply existing consensus values
        consensusTasks.forEach(task => {
          const value = existingConsensus.data[task.id];
          if (value !== undefined) {
            task.selectedOption = value as string;
            task.status = 'completed';
          }
        });
      }
      
      setConsensusTask1(consensusTasks);
    }
    else if (taskId === 2) {
      // Similar to task 1, but with task 2 specific fields
      const consensusTasks: SubTask[] = [
        {
          id: 'aspects',
          title: 'Final Assessment - Addresses All Aspects',
          status: 'pending',
          options: ['Yes', 'No'],
          description: `Annotator consensus: ${
            taskAnnotations.filter(a => a.data.aspects === 'Yes').length
          }/${taskAnnotations.length} Yes`
        },
        {
          id: 'explanation',
          title: 'Final Assessment - Explanation Provided',
          status: 'pending',
          options: ['Yes', 'No'],
          description: `Annotator consensus: ${
            taskAnnotations.filter(a => a.data.explanation === 'Yes').length
          }/${taskAnnotations.length} Yes`
        },
        {
          id: 'execution',
          title: 'Final Assessment - Code Execution',
          status: 'pending',
          options: ['Executable', 'Not Executable', 'N/A'],
          description: `Annotator results: ${
            taskAnnotations.filter(a => a.data.execution === 'Executable').length
          } Executable, ${
            taskAnnotations.filter(a => a.data.execution === 'Not Executable').length
          } Not Executable, ${
            taskAnnotations.filter(a => a.data.execution === 'N/A').length
          } N/A`
        },
        {
          id: 'download',
          title: 'Final Assessment - Code Download Link',
          status: 'pending',
          options: ['Provided', 'Not Provided', 'N/A'],
          description: `Annotator consensus`
        },
        {
          id: 'justification',
          title: 'Final Assessment - Justification',
          status: 'pending',
          description: 'Provide final justification',
          textInput: true
        }
      ];
      
      // Check for existing consensus annotation
      const existingConsensus = getConsensusAnnotation(discussionId, taskId);
      if (existingConsensus) {
        consensusTasks.forEach(task => {
          const value = existingConsensus.data[task.id];
          if (value !== undefined) {
            if (task.textInput) {
              task.textValue = value as string;
            } else {
              task.selectedOption = value as string;
            }
            task.status = 'completed';
          }
        });
      }
      
      setConsensusTask2(consensusTasks);
    }
    else if (taskId === 3) {
      // Task 3 consensus fields
      const consensusTasks: SubTask[] = [
        {
          id: 'rewrite',
          title: 'Final Rewritten Question',
          status: 'pending',
          description: 'Select the best rewritten question or provide your own',
          textInput: true
        },
        {
          id: 'shortAnswer',
          title: 'Final Short Answer List',
          status: 'pending',
          description: 'Select the best short answer list or provide your own',
          textInput: true
        },
        {
          id: 'longAnswer',
          title: 'Final Long Answer',
          status: 'pending',
          description: 'Select the best long answer or provide your own',
          textInput: true
        },
        {
          id: 'classify',
          title: 'Final Question Type',
          status: 'pending',
          options: ['Search', 'Reasoning'],
          description: `Annotator consensus: ${
            taskAnnotations.filter(a => a.data.classify === 'Search').length
          } Search, ${
            taskAnnotations.filter(a => a.data.classify === 'Reasoning').length
          } Reasoning`
        },
        {
          id: 'supporting',
          title: 'Final Supporting Documentation',
          status: 'pending',
          description: 'Select the best supporting documentation or provide your own',
          textInput: true
        }
      ];
      
      // Check for existing consensus annotation
      const existingConsensus = getConsensusAnnotation(discussionId, taskId);
      if (existingConsensus) {
        consensusTasks.forEach(task => {
          const value = existingConsensus.data[task.id];
          if (value !== undefined) {
            if (task.textInput) {
              task.textValue = value as string;
            } else {
              task.selectedOption = value as string;
            }
            task.status = 'completed';
          }
        });
      }
      
      setConsensusTask3(consensusTasks);
    }
  };

  const handleUrlSubmit = (url: string) => {
    setUrl(url);
    updateStepCompletionStatus(0, true);
    
    // Update URL parameters without reloading
    const params = new URLSearchParams(location.search);
    params.set('url', url);
    navigate(`/dashboard?${params.toString()}`, { replace: true });
    
    toast.success("URL submitted successfully", {
      description: "Tasks are now available for annotation"
    });
  };

  const handleSelectTask = (taskId: number) => {
    setSelectedTaskId(taskId);
    setViewMode('detail');
    setCurrentStep(taskId);
    
    // Update URL with task parameters without full page reload
    navigate(`/dashboard?discussionId=${discussionId}&task=${taskId}`, { replace: true });
    
    // Load user annotation if it exists
    if (discussionId) {
      loadUserAnnotation(discussionId, taskId);
      
      // For pod leads, also prepare consensus view
      if (isPodLead) {
        prepareConsensusView(discussionId, taskId);
      }
    }
  };

  const handleBackToGrid = () => {
    setViewMode('grid');
    setSelectedTaskId(null);
    
    // Update URL without the task parameter
    navigate(`/dashboard?discussionId=${discussionId}`, { replace: true });
  };

  const updateStepCompletionStatus = (stepIndex: number, completed: boolean) => {
    setSteps(steps.map((step, index) => 
      index === stepIndex ? { ...step, completed } : step
    ));
  };

  const handleSubTaskChange = (taskSet: string, taskId: string, selectedOption?: string, textValue?: string) => {
    if (viewMode === 'consensus') {
      // Handle consensus task changes
      if (taskSet === 'task1') {
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
      } else if (taskSet === 'task2') {
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
      } else if (taskSet === 'task3') {
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
    } else {
      // Handle regular task changes
      if (taskSet === 'task1') {
        const updatedTasks = task1SubTasks.map(task => 
          task.id === taskId 
            ? { 
                ...task, 
                selectedOption,
                status: selectedOption ? 'completed' as SubTaskStatus : 'pending' as SubTaskStatus
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
      }
    }
  };

  const canProceed = () => {
    if (!discussionId || !user) return false;
    
    if (viewMode === 'consensus') {
      if (currentStep === 1) {
        return consensusTask1.every(t => t.status === 'completed');
      } else if (currentStep === 2) {
        return consensusTask2.every(t => t.status === 'completed');
      } else if (currentStep === 3) {
        return consensusTask3.every(t => t.status === 'completed');
      }
    } else {
      if (currentStep === 1) {
        return task1SubTasks.every(t => t.status === 'completed' || t.status === 'na');
      } else if (currentStep === 2) {
        return task2SubTasks.every(t => t.status === 'completed' || t.status === 'na');
      } else if (currentStep === 3) {
        return task3SubTasks.every(t => t.status === 'completed' || t.status === 'na');
      }
    }
    
    return true;
  };

  const handleSaveAnnotation = () => {
    if (!discussionId || !user) return;
    
    let data: Record<string, string | boolean> = {};
    let success = false;
    
    if (viewMode === 'consensus') {
      // Save consensus annotation
      if (currentStep === 1) {
        consensusTask1.forEach(task => {
          if (task.textInput && task.textValue) {
            data[task.id] = task.textValue;
          } else if (task.selectedOption) {
            data[task.id] = task.selectedOption;
          }
        });
        
        success = saveConsensusAnnotation({
          discussionId,
          userId: user.id,
          taskId: 1,
          data
        });
        
      } else if (currentStep === 2) {
        consensusTask2.forEach(task => {
          if (task.textInput && task.textValue) {
            data[task.id] = task.textValue;
          } else if (task.selectedOption) {
            data[task.id] = task.selectedOption;
          }
        });
        
        success = saveConsensusAnnotation({
          discussionId,
          userId: user.id,
          taskId: 2,
          data
        });
        
      } else if (currentStep === 3) {
        consensusTask3.forEach(task => {
          if (task.textInput && task.textValue) {
            data[task.id] = task.textValue;
          } else if (task.selectedOption) {
            data[task.id] = task.selectedOption;
          }
        });
        
        success = saveConsensusAnnotation({
          discussionId,
          userId: user.id,
          taskId: 3,
          data
        });
      }
      
      if (success) {
        toast.success('Consensus saved successfully');
        updateStepCompletionStatus(currentStep, true);
        handleBackToGrid();
      }
    } else {
      // Save regular annotation
      if (currentStep === 1) {
        task1SubTasks.forEach(task => {
          if (task.selectedOption) {
            data[task.id] = task.selectedOption;
          }
        });
        
        success = saveAnnotation({
          discussionId,
          userId: user.id,
          taskId: 1,
          data
        });
        
      } else if (currentStep === 2) {
        task2SubTasks.forEach(task => {
          if (task.textInput && task.textValue) {
            data[task.id] = task.textValue;
          } else if (task.selectedOption) {
            data[task.id] = task.selectedOption;
          }
        });
        
        success = saveAnnotation({
          discussionId,
          userId: user.id,
          taskId: 2,
          data
        });
        
      } else if (currentStep === 3) {
        task3SubTasks.forEach(task => {
          if (task.textInput && task.textValue) {
            data[task.id] = task.textValue;
          } else if (task.selectedOption) {
            data[task.id] = task.selectedOption;
          }
        });
        
        success = saveAnnotation({
          discussionId,
          userId: user.id,
          taskId: 3,
          data
        });
      }
      
      if (success) {
        toast.success('Annotation saved successfully');
        updateStepCompletionStatus(currentStep, true);
        handleBackToGrid();
      }
    }
  };

  const getTask1Progress = () => {
    if (viewMode === 'consensus') {
      const completed = consensusTask1.filter(t => t.status === 'completed').length;
      if (completed === consensusTask1.length) return 'completed';
      if (completed > 0) return 'inProgress';
      return 'pending';
    } else {
      const completed = task1SubTasks.filter(t => t.status === 'completed' || t.status === 'na').length;
      if (completed === task1SubTasks.length) return 'completed';
      if (completed > 0) return 'inProgress';
      return 'pending';
    }
  };

  const getTask2Progress = () => {
    if (viewMode === 'consensus') {
      const completed = consensusTask2.filter(t => t.status === 'completed').length;
      if (completed === consensusTask2.length) return 'completed';
      if (completed > 0) return 'inProgress';
      return 'pending';
    } else {
      const completed = task2SubTasks.filter(t => t.status === 'completed' || t.status === 'na').length;
      if (completed === task2SubTasks.length) return 'completed';
      if (completed > 0) return 'inProgress';
      return 'pending';
    }
  };

  const getTask3Progress = () => {
    if (viewMode === 'consensus') {
      const completed = consensusTask3.filter(t => t.status === 'completed').length;
      if (completed === consensusTask3.length) return 'completed';
      if (completed > 0) return 'inProgress';
      return 'pending';
    } else {
      const completed = task3SubTasks.filter(t => t.status === 'completed' || t.status === 'na').length;
      if (completed === task3SubTasks.length) return 'completed';
      if (completed > 0) return 'inProgress';
      return 'pending';
    }
  };

  const toggleConsensusMode = () => {
    if (viewMode === 'detail') {
      setViewMode('consensus');
      prepareConsensusView(discussionId!, currentStep);
    } else {
      setViewMode('detail');
    }
  };

  // Show individual annotations in consensus mode
  const renderAnnotatorView = () => {
    if (!discussionId) return null;
    
    const annotations = getAnnotationsForTask(discussionId, currentStep);
    
    return (
      <div className="mt-6 space-y-4">
        <h3 className="text-lg font-medium">Annotator Submissions</h3>
        <div className="grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
          {annotations.map((annotation, index) => (
            <Card key={index} className="text-sm">
              <CardHeader className="py-3">
                <CardTitle className="text-base">Annotator {index + 1}</CardTitle>
              </CardHeader>
              <CardContent className="py-3">
                <div className="space-y-2">
                  {Object.entries(annotation.data).map(([key, value]) => (
                    <div key={key} className="flex justify-between">
                      <span className="font-medium">{key}:</span>
                      <span className="text-gray-600">{value.toString()}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  };

  // Get summary data for all tasks
  const getSummaryData = () => {
    return {
      task1Results: {},
      task2Results: {},
      task3Results: {}
    };
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <Header />
      
      <div className="container max-w-4xl mx-auto px-4 py-6 flex-grow">
        {currentStep === 0 && !discussionId && (
          <UrlInput onSubmit={handleUrlSubmit} />
        )}
        
        {(url || discussionId) && viewMode === 'grid' && (
          <>
            <div className="mb-6">
              <h2 className="text-xl font-semibold mb-2">Annotation Tasks</h2>
              <p className="text-gray-600 text-sm">
                GitHub Discussion URL: <span className="text-dashboard-blue">{url}</span>
              </p>
              <p className="text-gray-600 text-sm mt-2">
                Task 1 requires 3 annotators, Task 2 requires 3 annotators, Task 3 requires 5 annotators.
              </p>
            </div>
            <TaskGrid tasks={tasks} onSelectTask={handleSelectTask} />
          </>
        )}
        
        {(url || discussionId) && (viewMode === 'detail' || viewMode === 'consensus') && (
          <>
            <ProgressStepper steps={steps} currentStep={currentStep} />
            
            {isPodLead && currentStep > 0 && (
              <div className="mb-4 flex justify-end">
                <Button 
                  onClick={toggleConsensusMode} 
                  variant="outline"
                  className="flex items-center gap-2"
                >
                  <CheckCircle className="h-4 w-4" />
                  {viewMode === 'detail' ? 'Create Consensus' : 'View Annotator Form'}
                </Button>
              </div>
            )}
            
            {currentStep === 1 && viewMode === 'detail' && (
              <TaskCard
                title="Task 1: Question Quality Assessment"
                description="Evaluate the quality of the question based on relevance, learning value, clarity, and image grounding."
                subTasks={task1SubTasks}
                status={getTask1Progress()}
                onSubTaskChange={(taskId, selectedOption) => 
                  handleSubTaskChange('task1', taskId, selectedOption)
                }
                active={true}
              />
            )}
            
            {currentStep === 1 && viewMode === 'consensus' && isPodLead && (
              <>
                <TaskCard
                  title="Task 1: Question Quality Consensus"
                  description="Create a consensus based on annotator assessments."
                  subTasks={consensusTask1}
                  status={getTask1Progress()}
                  onSubTaskChange={(taskId, selectedOption, textValue) => 
                    handleSubTaskChange('task1', taskId, selectedOption, textValue)
                  }
                  active={true}
                />
                {renderAnnotatorView()}
              </>
            )}
            
            {currentStep === 2 && viewMode === 'detail' && (
              <TaskCard
                title="Task 2: Answer Quality Assessment"
                description="Evaluate the quality of the answer based on comprehensiveness, explanation, code execution, and completeness."
                subTasks={task2SubTasks}
                status={getTask2Progress()}
                onSubTaskChange={(taskId, selectedOption, textValue) => 
                  handleSubTaskChange('task2', taskId, selectedOption, textValue)
                }
                active={true}
              />
            )}
            
            {currentStep === 2 && viewMode === 'consensus' && isPodLead && (
              <>
                <TaskCard
                  title="Task 2: Answer Quality Consensus"
                  description="Create a consensus based on annotator assessments."
                  subTasks={consensusTask2}
                  status={getTask2Progress()}
                  onSubTaskChange={(taskId, selectedOption, textValue) => 
                    handleSubTaskChange('task2', taskId, selectedOption, textValue)
                  }
                  active={true}
                />
                {renderAnnotatorView()}
              </>
            )}
            
            {currentStep === 3 && viewMode === 'detail' && (
              <TaskCard
                title="Task 3: Rewrite Question and Answer"
                description="Rewrite the question and answer to improve clarity, conciseness, and coherence."
                subTasks={task3SubTasks}
                status={getTask3Progress()}
                onSubTaskChange={(taskId, selectedOption, textValue) => 
                  handleSubTaskChange('task3', taskId, selectedOption, textValue)
                }
                active={true}
              />
            )}
            
            {currentStep === 3 && viewMode === 'consensus' && isPodLead && (
              <>
                <TaskCard
                  title="Task 3: Rewrite Consensus"
                  description="Create a consensus based on annotator assessments."
                  subTasks={consensusTask3}
                  status={getTask3Progress()}
                  onSubTaskChange={(taskId, selectedOption, textValue) => 
                    handleSubTaskChange('task3', taskId, selectedOption, textValue)
                  }
                  active={true}
                />
                {renderAnnotatorView()}
              </>
            )}
            
            {currentStep === 4 && (
              <Summary results={getSummaryData()} />
            )}
          </>
        )}
        
        <div className="flex justify-between mt-6">
          {viewMode !== 'grid' && (
            <Button
              onClick={handleBackToGrid}
              variant="outline"
              className="flex items-center gap-2"
            >
              <ArrowLeft className="h-4 w-4" />
              <span>Back to Grid</span>
            </Button>
          )}
          
          {viewMode !== 'grid' && currentStep < 4 && currentStep > 0 && (
            <Button
              onClick={handleSaveAnnotation}
              disabled={!canProceed()}
              className="flex items-center gap-2 bg-dashboard-blue hover:bg-blue-600 ml-auto"
            >
              <span>Save {viewMode === 'consensus' ? 'Consensus' : 'Annotation'}</span>
              <ArrowRight className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
