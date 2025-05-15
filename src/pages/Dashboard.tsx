
import React, { useEffect } from 'react';
import Header from '@/components/layout/Header';
import UrlInput from '@/components/dashboard/UrlInput';
import TaskCard from '@/components/dashboard/TaskCard';
import TaskGrid from '@/components/dashboard/TaskGrid';
import ProgressStepper from '@/components/dashboard/ProgressStepper';
import Summary from '@/components/dashboard/Summary';
import DashboardNavigation from '@/components/dashboard/DashboardNavigation';
import { Button } from '@/components/ui/button';
import { CheckCircle } from 'lucide-react';
import AnnotatorView from '@/components/dashboard/AnnotatorView';
import { useDashboardState } from '@/hooks/useDashboardState';
import { useTaskSubtasks } from '@/hooks/useTaskSubtasks';
import { useTaskProgress } from '@/hooks/useTaskProgress';
import { useAnnotationHandlers } from '@/hooks/useAnnotationHandlers';

const Dashboard = () => {
  // Use the dashboard state hook
  const {
    url,
    currentStep,
    viewMode,
    handleUrlSubmit,
    handleSelectTask,
    handleBackToGrid,
    handleFileUpload,
    updateStepCompletionStatus,
    toggleConsensusMode,
    discussionId,
    steps,
    tasks,
    uploadedImage,
    codeDownloadUrl,
    isPodLead,
    user,
    getUserAnnotation,
    getAnnotationsForTask,
    saveAnnotation,
    saveConsensusAnnotation,
    getConsensusAnnotation
  } = useDashboardState();

  // Use the task subtasks hook
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

  // Use the task progress hook
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

  // Use the annotation handlers hook
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
    updateStepCompletionStatus
  });

  // Initialize data when task changes
  useEffect(() => {
    if (discussionId && user && currentStep > 0 && currentStep <= 3) {
      if (viewMode === 'detail') {
        // Load user's existing annotation
        const updatedSubTasks = loadUserAnnotation(discussionId, currentStep);
        if (updatedSubTasks) {
          if (currentStep === 1) {
            setTask1SubTasks(updatedSubTasks);
          } else if (currentStep === 2) {
            setTask2SubTasks(updatedSubTasks);
          } else if (currentStep === 3) {
            setTask3SubTasks(updatedSubTasks);
          }
        }
      } else if (viewMode === 'consensus' && isPodLead) {
        // Prepare consensus view
        const consensusTasks = prepareConsensusView(discussionId, currentStep);
        if (consensusTasks && consensusTasks.length > 0) {
          if (currentStep === 1) {
            setConsensusTask1(consensusTasks);
          } else if (currentStep === 2) {
            setConsensusTask2(consensusTasks);
          } else if (currentStep === 3) {
            setConsensusTask3(consensusTasks);
          }
        }
      }
    }
  }, [discussionId, currentStep, viewMode, user, isPodLead]);

  // Get summary data for all tasks
  const getSummaryData = () => {
    return {
      task1Results: {},
      task2Results: {},
      task3Results: {}
    };
  };

  // Handle the save button click
  const onSaveClick = async () => {
    await handleSaveAnnotation(
      discussionId, 
      currentStep, 
      viewMode, 
      uploadedImage, 
      codeDownloadUrl, 
      handleBackToGrid
    );
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
            </div>
            <TaskGrid 
              tasks={tasks} 
              onSelectTask={handleSelectTask} 
              githubUrl={url}
            />
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
            
            {/* Task cards for different steps */}
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
                  status={getTask1Progress(true)}
                  onSubTaskChange={(taskId, selectedOption, textValue) => 
                    handleSubTaskChange('consensus1', taskId, selectedOption, textValue)
                  }
                  active={true}
                />
                <AnnotatorView 
                  discussionId={discussionId || ""} 
                  currentStep={currentStep} 
                  getAnnotationsForTask={getAnnotationsForTask}
                />
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
                  status={getTask2Progress(true)}
                  onSubTaskChange={(taskId, selectedOption, textValue) => 
                    handleSubTaskChange('consensus2', taskId, selectedOption, textValue)
                  }
                  active={true}
                />
                <AnnotatorView 
                  discussionId={discussionId || ""} 
                  currentStep={currentStep} 
                  getAnnotationsForTask={getAnnotationsForTask}
                />
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
                  status={getTask3Progress(true)}
                  onSubTaskChange={(taskId, selectedOption, textValue) => 
                    handleSubTaskChange('consensus3', taskId, selectedOption, textValue)
                  }
                  active={true}
                />
                <AnnotatorView 
                  discussionId={discussionId || ""} 
                  currentStep={currentStep} 
                  getAnnotationsForTask={getAnnotationsForTask}
                />
              </>
            )}
            
            {currentStep === 4 && (
              <Summary results={getSummaryData()} />
            )}
          </>
        )}
        
        <DashboardNavigation 
          viewMode={viewMode}
          currentStep={currentStep}
          canProceed={canProceed(currentStep, viewMode)}
          onBackToGrid={handleBackToGrid}
          onSave={onSaveClick}
          isConsensus={viewMode === 'consensus'}
          onFileUpload={handleFileUpload}
          codeDownloadUrl={codeDownloadUrl}
          discussionId={discussionId || undefined}
        />
      </div>
    </div>
  );
};

export default Dashboard;
