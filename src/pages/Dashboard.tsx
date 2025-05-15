import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import Header from '@/components/layout/Header';
import UrlInput from '@/components/dashboard/UrlInput';
import TaskCard from '@/components/dashboard/TaskCard';
import TaskGrid from '@/components/dashboard/TaskGrid';
import ProgressStepper from '@/components/dashboard/ProgressStepper';
import Summary from '@/components/dashboard/Summary';
import { Button } from '@/components/ui/button';
import { ArrowLeft, ArrowRight } from 'lucide-react';
import { toast } from 'sonner';
import { useTaskData } from '@/hooks/useTaskData';
import { useTaskUI } from '@/hooks/useTaskUI';

const Dashboard = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const queryParams = new URLSearchParams(location.search);
  const discussionId = queryParams.get('discussionId');
  const taskNumber = queryParams.get('task') ? parseInt(queryParams.get('task')!) : null;
  
  const [url, setUrl] = useState<string>('');
  const [currentStep, setCurrentStep] = useState(taskNumber || 0);
  const [viewMode, setViewMode] = useState<'grid' | 'detail'>(taskNumber ? 'detail' : 'grid');
  const [selectedTaskId, setSelectedTaskId] = useState<number | null>(taskNumber);
  
  // Import task data and UI logic from custom hooks
  const {
    task1SubTasks, setTask1SubTasks,
    task2SubTasks, setTask2SubTasks,
    task3SubTasks, setTask3SubTasks,
    task1Annotators, setTask1Annotators,
    task2Annotators, setTask2Annotators,
    task3Annotators, setTask3Annotators,
    tasks, setTasks,
    steps, setSteps,
    handleSubTaskChange,
    checkForSubtaskLogic,
    getTask1Progress,
    getTask2Progress,
    getTask3Progress,
    saveAnnotation
  } = useTaskData();
  
  const { 
    updateStepCompletionStatus,
    canProceed,
    getSummaryData
  } = useTaskUI({ 
    currentStep, 
    url, 
    task1SubTasks, 
    task2SubTasks, 
    task3SubTasks, 
    steps, 
    setSteps, 
    getTask1Progress, 
    getTask2Progress, 
    getTask3Progress 
  });

  // Check login and redirect if necessary
  useEffect(() => {
    const user = localStorage.getItem('user');
    if (!user) {
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
    }
    // If nothing is provided, redirect to discussions page
    else if (!discussionId) {
      navigate('/discussions');
    }
    
    // If URL parameter is in the query, use it
    const urlParam = queryParams.get('url');
    if (urlParam) {
      setUrl(urlParam);
    }
  }, [discussionId, taskNumber, navigate, queryParams]);

  // Effect to update tasks status based on URL and annotator counts
  useEffect(() => {
    if (!url && !discussionId) return;
    
    const updatedTasks = [...tasks];
    
    // Task 1 is unlocked once URL is submitted
    updatedTasks[0].status = task1Annotators >= 3 ? 'completed' : 'unlocked';
    updatedTasks[0].currentAnnotators = task1Annotators;
    
    // Task 2 is unlocked when Task 1 is completed (3 annotators)
    if (task1Annotators >= 3) {
      updatedTasks[1].status = task2Annotators >= 3 ? 'completed' : 'unlocked';
      updatedTasks[1].currentAnnotators = task2Annotators;
    }
    
    // Task 3 is unlocked when Task 2 is completed (3 annotators)
    if (task2Annotators >= 3) {
      updatedTasks[2].status = task3Annotators >= 5 ? 'completed' : 'unlocked';
      updatedTasks[2].currentAnnotators = task3Annotators;
    }
    
    setTasks(updatedTasks);
  }, [url, discussionId, task1Annotators, task2Annotators, task3Annotators, tasks]);

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
  };

  const handleBackToGrid = () => {
    setViewMode('grid');
    setSelectedTaskId(null);
    
    // Update URL without the task parameter
    navigate(`/dashboard?discussionId=${discussionId}`, { replace: true });
  };

  const handleCompleteAnnotation = (taskId: number) => {
    // Save the annotation data
    if (taskId === 1) {
      saveAnnotation('task1');
      setTask1Annotators(prev => Math.min(prev + 1, 3));
      toast.success(`Task 1: Annotator ${task1Annotators + 1}/3 completed`);
    } else if (taskId === 2) {
      saveAnnotation('task2');
      setTask2Annotators(prev => Math.min(prev + 1, 3));
      toast.success(`Task 2: Annotator ${task2Annotators + 1}/3 completed`);
    } else if (taskId === 3) {
      saveAnnotation('task3');
      setTask3Annotators(prev => Math.min(prev + 1, 5));
      toast.success(`Task 3: Annotator ${task3Annotators + 1}/5 completed`);
    }
    
    handleBackToGrid();
  };

  const handleNext = () => {
    if (currentStep < 4) {
      updateStepCompletionStatus(currentStep, true);
      
      // Simulate annotator completion
      if (currentStep === 1) {
        handleCompleteAnnotation(1);
      } else if (currentStep === 2) {
        handleCompleteAnnotation(2);
      } else if (currentStep === 3) {
        handleCompleteAnnotation(3);
      } else {
        setCurrentStep(currentStep + 1);
      }
    }
  };

  const handleBack = () => {
    if (currentStep > 0 && viewMode === 'detail') {
      handleBackToGrid();
    } else {
      // Go back to discussions page
      navigate('/discussions');
    }
  };

  // Determine if all tasks are completed and we can show summary
  const allTasksCompleted = task1Annotators >= 3 && task2Annotators >= 3 && task3Annotators >= 5;

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <Header />
      
      <div className="container max-w-4xl mx-auto px-4 py-6 flex-grow">
        {currentStep === 0 && !discussionId && (
          <UrlInput onSubmit={handleUrlSubmit} />
        )}
        
        {(url || discussionId) && currentStep > 0 && viewMode === 'grid' && (
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
            
            {allTasksCompleted && (
              <div className="mt-6 text-center">
                <Button 
                  onClick={() => setCurrentStep(4)}
                  className="bg-dashboard-blue hover:bg-blue-600"
                >
                  View Final Summary
                </Button>
              </div>
            )}
          </>
        )}
        
        {(url || discussionId) && viewMode === 'detail' && (
          <>
            <ProgressStepper steps={steps} currentStep={currentStep} />
            
            {currentStep === 1 && (
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
            
            {currentStep === 2 && (
              <TaskCard
                title="Task 2: Answer Quality Assessment"
                description="Evaluate the quality of the answer based on comprehensiveness, explanation, code execution, and completeness."
                subTasks={task2SubTasks}
                status={getTask2Progress()}
                onSubTaskChange={(taskId, selectedOption) => 
                  handleSubTaskChange('task2', taskId, selectedOption)
                }
                active={true}
              />
            )}
            
            {currentStep === 3 && (
              <TaskCard
                title="Task 3: Rewrite Question and Answer"
                description="Rewrite the question and answer to improve clarity, conciseness, and coherence."
                subTasks={task3SubTasks}
                status={getTask3Progress()}
                onSubTaskChange={(taskId, selectedOption) => 
                  handleSubTaskChange('task3', taskId, selectedOption)
                }
                active={true}
              />
            )}
            
            {currentStep === 4 && (
              <Summary results={getSummaryData()} />
            )}
          </>
        )}
        
        <div className="flex justify-between mt-6">
          {viewMode === 'detail' && currentStep > 0 && (
            <Button
              onClick={handleBack}
              variant="outline"
              className="flex items-center gap-2"
            >
              <ArrowLeft className="h-4 w-4" />
              <span>Back to Grid</span>
            </Button>
          )}
          
          {viewMode === 'detail' && currentStep < 4 && currentStep > 0 && (
            <Button
              onClick={handleNext}
              disabled={!canProceed()}
              className="flex items-center gap-2 bg-dashboard-blue hover:bg-blue-600 ml-auto"
            >
              <span>Complete Annotation</span>
              <ArrowRight className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
