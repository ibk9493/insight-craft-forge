import React, { useEffect, useState } from 'react';
import Header from '@/components/layout/Header';
import UrlInput from '@/components/dashboard/UrlInput';
import TaskCard, { SubTask, SubTaskStatus } from '@/components/dashboard/TaskCard';
import TaskGrid from '@/components/dashboard/TaskGrid';
import ProgressStepper from '@/components/dashboard/ProgressStepper';
import Summary from '@/components/dashboard/Summary';
import DashboardNavigation from '@/components/dashboard/DashboardNavigation';
import DashboardBreadcrumb from '@/components/dashboard/DashboardBreadcrumb';
import { Button } from '@/components/ui/button';
import { CheckCircle, FileText, Eye } from 'lucide-react';
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

// Define a type for the feedback data
interface AnnotationFeedbackData {
  rating?: number;
  comment?: string;
}

interface AnnotationFeedbackState {
  [annotationId: string]: AnnotationFeedbackData;
}

const Dashboard = () => {
  const [annotationFeedback, setAnnotationFeedback] = useState<AnnotationFeedbackState>({});

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
    handleCodeUrlChange,
    validateGitHubCodeUrl,
    isPodLead,
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

  // Use the annotation handlers hook with all required props
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
    overrideAnnotation: undefined
  });

  // Helper function to get user email by ID
  const getUserEmailById = (userId: string): string => {
    const user = MOCK_USERS_DATA.find(u => u.id === userId);
    return user ? user.username : 'Unknown User';
  };

  // Initialize data when task or discussion changes
  useEffect(() => {
    if (discussionId && user && currentStep > 0 && currentStep <= 3 && annotationsLoaded) {
      console.log(`Loading data for discussion: ${discussionId}, task: ${currentStep}, mode: ${viewMode}, annotationsLoaded: ${annotationsLoaded}`);
      
      if (viewMode === 'detail') {
        // Load user's existing annotation only for the current task
        const updatedSubTasks = loadUserAnnotation(discussionId, currentStep);
        
        if (updatedSubTasks) {
          console.log("Loaded user annotation successfully:", updatedSubTasks);
          switch (currentStep) {
            case TaskId.QUESTION_QUALITY:
              setTask1SubTasks(updatedSubTasks);
              break;
            case TaskId.ANSWER_QUALITY:
              setTask2SubTasks(updatedSubTasks);
              break;
            case TaskId.REWRITE:
              setTask3SubTasks(updatedSubTasks);
              break;
          }
        } else {
          console.log("No saved annotation found or error loading");
        }
      } else if (viewMode === 'consensus' && isPodLead) {
        // Prepare consensus view only for the current task
        const consensusTasks = prepareConsensusView(discussionId, currentStep);
        
        if (consensusTasks && consensusTasks.length > 0) {
          console.log("Loaded consensus view successfully");
          switch (currentStep) {
            case TaskId.QUESTION_QUALITY:
              setConsensusTask1(consensusTasks);
              break;
            case TaskId.ANSWER_QUALITY:
              setConsensusTask2(consensusTasks);
              break;
            case TaskId.REWRITE:
              setConsensusTask3(consensusTasks);
              break;
          }
        }
      }
    }
  }, [discussionId, currentStep, viewMode, user, isPodLead, annotationsLoaded]);

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

  // Handle opening the discussion details modal
  const handleViewDiscussion = () => {
    if (currentDiscussion) {
      dispatch(openModal(currentDiscussion));
    }
  };

  const handleUseAnnotationForConsensus = (annotation: Annotation) => {
    if (!annotation || !annotation.data) {
      toast.error("Selected annotation has no data to use.");
      return;
    }

    let baseSubTasks: SubTask[] = [];
    // Use a deep copy of the original task structure
    if (currentStep === TaskId.QUESTION_QUALITY) {
      baseSubTasks = JSON.parse(JSON.stringify(task1SubTasks)); 
    } else if (currentStep === TaskId.ANSWER_QUALITY) {
      baseSubTasks = JSON.parse(JSON.stringify(task2SubTasks));
    } else if (currentStep === TaskId.REWRITE) {
      baseSubTasks = JSON.parse(JSON.stringify(task3SubTasks));
    } else {
      toast.error("Invalid task step for consensus.");
      return;
    }

    // Replicated logic from mapAnnotationToSubTasks
    const mappedSubTasks: SubTask[] = baseSubTasks.map(task => {
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
        const formattedDocs = savedValue.map(doc =>
          (typeof doc === 'object' && doc.link && doc.paragraph)
            ? { link: doc.link, paragraph: doc.paragraph }
            : doc
        );
        return {
          ...task,
          selectedOption: '',
          status: 'completed' as SubTaskStatus,
          textValue: JSON.stringify(formattedDocs, null, 2)
        };
      } else if (savedValue !== undefined) {
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

    switch (currentStep) {
      case TaskId.QUESTION_QUALITY:
        setConsensusTask1(mappedSubTasks);
        break;
      case TaskId.ANSWER_QUALITY:
        setConsensusTask2(mappedSubTasks);
        break;
      case TaskId.REWRITE:
        setConsensusTask3(mappedSubTasks);
        break;
      default:
        toast.error("Cannot determine which consensus task to update.");
        return;
    }
    toast.success("Consensus form populated with selected annotation.");
  };

  const handleAnnotationRatingChange = (annotationId: string, rating: number) => {
    setAnnotationFeedback(prev => ({
      ...prev,
      [annotationId]: {
        ...prev[annotationId],
        rating
      }
    }));
  };

  const handleAnnotationCommentChange = (annotationId: string, comment: string) => {
    setAnnotationFeedback(prev => ({
      ...prev,
      [annotationId]: {
        ...prev[annotationId],
        comment
      }
    }));
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <Header />
      
      <div className="container max-w-4xl mx-auto px-4 py-6 flex-grow">
        {/* Add breadcrumb component */}
        {(url || discussionId) && (
          <DashboardBreadcrumb 
            discussionId={discussionId || undefined} 
            currentStep={currentStep} 
            discussionTitle={currentDiscussion?.title || 'Discussion'}
          />
        )}
        
        {currentStep === 0 && !discussionId && (
          <UrlInput onSubmit={handleUrlSubmit} />
        )}
        
        {/* Grid view */}
        {(url || discussionId) && viewMode === 'grid' && (
          <>
            <div className="mb-6">
              <h2 className="text-xl font-semibold mb-2">Annotation Tasks</h2>
              <p className="text-gray-600 text-sm">
                GitHub Discussion URL: <span className="text-dashboard-blue">{url}</span>
              </p>
              {currentDiscussion && (
                <div className="mt-2">
                  <Button 
                    variant="outline" 
                    className="flex items-center gap-2"
                    onClick={handleViewDiscussion}
                  >
                    <Eye className="h-4 w-4" />
                    <span>View Discussion Details</span>
                  </Button>
                </div>
              )}
            </div>
            
            <TaskGrid 
              tasks={tasks} 
              onSelectTask={handleSelectTask} 
              githubUrl={url}
              repositoryLanguage={currentDiscussion?.repositoryLanguage}
              releaseTag={currentDiscussion?.releaseTag}
              releaseDate={currentDiscussion?.releaseDate}
            />
          </>
        )}
        
        {/* Detail or consensus view */}
        {(url || discussionId) && (viewMode === 'detail' || viewMode === 'consensus') && (
          <>
            <ProgressStepper steps={steps} currentStep={currentStep} />
            
            <div className="mb-4 flex justify-between items-center">
              {/* Discussion details button */}
              {currentDiscussion && (
                <Button 
                  variant="outline" 
                  className="flex items-center gap-2"
                  onClick={handleViewDiscussion}
                >
                  <Eye className="h-4 w-4" />
                  <span>View Discussion Details</span>
                </Button>
              )}
              
              {/* Consensus mode toggle button */}
              {isPodLead && currentStep > 0 && (
                <Button 
                  onClick={toggleConsensusMode} 
                  variant="outline"
                  className="flex items-center gap-2"
                >
                  <CheckCircle className="h-4 w-4" />
                  {viewMode === 'detail' ? 'Create Consensus' : 'View Annotator Form'}
                </Button>
              )}
            </div>
            
            {/* Task cards for different steps */}
            {currentStep === TaskId.QUESTION_QUALITY && viewMode === 'detail' && (
              <TaskCard
                title="Task 1: Question Quality Assessment"
                description="Evaluate the quality of the question based on relevance, learning value, clarity, and image grounding."
                subTasks={task1SubTasks}
                status={getTask1Progress()}
                onSubTaskChange={(taskId, selectedOption, textValue) => 
                  handleSubTaskChange('task1', taskId, selectedOption, textValue)
                }
                active={true}
              />
            )}
            
            {currentStep === TaskId.QUESTION_QUALITY && viewMode === 'consensus' && isPodLead && (
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
                  onUseForConsensus={handleUseAnnotationForConsensus}
                  getUserEmailById={getUserEmailById}
                  annotationFeedback={annotationFeedback}
                  onRatingChange={handleAnnotationRatingChange}
                  onCommentChange={handleAnnotationCommentChange}
                />
              </>
            )}
            
            {currentStep === TaskId.ANSWER_QUALITY && viewMode === 'detail' && (
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
            
            {currentStep === TaskId.ANSWER_QUALITY && viewMode === 'consensus' && isPodLead && (
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
                  onUseForConsensus={handleUseAnnotationForConsensus}
                  getUserEmailById={getUserEmailById}
                  annotationFeedback={annotationFeedback}
                  onRatingChange={handleAnnotationRatingChange}
                  onCommentChange={handleAnnotationCommentChange}
                />
              </>
            )}
            
            {currentStep === TaskId.REWRITE && viewMode === 'detail' && (
              <TaskCard
                title="Task 3: Rewrite Question and Answer"
                description="Rewrite the question and answer to improve clarity, conciseness, and coherence."
                subTasks={task3SubTasks}
                status={getTask3Progress()}
                onSubTaskChange={( 
                  taskId,
                  selectedOption,
                  textValue,
                  textValues,
                  supportingDocs,
                  sectionIndex
                ) => 
                  handleSubTaskChange(
                    'task3',
                    taskId,
                    selectedOption,
                    textValue,
                    textValues,
                    supportingDocs,
                    sectionIndex
                  )
                }
                active={true}
              />
            )}
            
            {currentStep === TaskId.REWRITE && viewMode === 'consensus' && isPodLead && (
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
                  onUseForConsensus={handleUseAnnotationForConsensus}
                  getUserEmailById={getUserEmailById}
                  annotationFeedback={annotationFeedback}
                  onRatingChange={handleAnnotationRatingChange}
                  onCommentChange={handleAnnotationCommentChange}
                />
              </>
            )}
            
            {currentStep === TaskId.SUMMARY && (
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
          onCodeUrlChange={handleCodeUrlChange}
          onCodeUrlVerify={validateGitHubCodeUrl}
          currentDiscussion={currentDiscussion}
        />
      </div>
      
      {/* Global Discussion Details Modal - controlled by Redux */}
      <DiscussionDetailsModal discussion={null} />
    </div>
  );
};

export default Dashboard;
