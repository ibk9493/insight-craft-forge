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
import { api } from '@/services/api';
import { Textarea } from '@/components/ui/textarea';

const Dashboard = () => {
  const [consensusStars, setConsensusStars] = useState<number | null>(null);
  const [consensusComment, setConsensusComment] = useState<string>('');

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
  const userCache = useRef<{[userId: string]: string}>({});
  // Helper function to get user email by ID
 // Synchronous function that returns a string directly
const getUserEmailById = useCallback((userId: string): string => {
  if (!userId) {
    return 'Unknown User';
  }
  
  const userIdStr = String(userId);
  
  // First check in mock data for immediate response
  const mockUser = MOCK_USERS_DATA.find(u => String(u.id) === userIdStr);
  if (mockUser && mockUser.username) {
    return mockUser.username;
  }
  
  // If we have a cache of previously loaded users, check there
  // This assumes you have some form of user cache in your app
  const cachedUsers = userCache.current || {};
  if (cachedUsers[userIdStr]) {
    return cachedUsers[userIdStr];
  }
  
  // Load in background for future use but return something now
  // This won't affect the current render
  setTimeout(() => {
    api.users.getPublicUserInfo(userIdStr)
      .then(userInfo => {
        if (userInfo && userInfo.username) {
          // Update cache for future use
          userCache.current = {
            ...userCache.current,
            [userIdStr]: userInfo.username
          };
        }
      })
      .catch(error => {
        console.warn(`Failed to load user info for ${userIdStr}:`, error);
      });
  }, 0);
  
  // Return a fallback immediately
  return `User ${userIdStr}`;
}, [api.users]);
  // Initialize data when task or discussion changes
  useEffect(() => {
    // Reset consensus feedback when relevant dependencies change
    setConsensusStars(null);
    setConsensusComment('');
    console.log('[Dashboard useEffect] Triggered. discussionId:', discussionId, 'currentStep:', currentStep, 'viewMode:', viewMode, 'user:', !!user, 'isPodLead:', isPodLead, 'annotationsLoaded:', annotationsLoaded); // DEBUG LOG
    
    // Log dependency references
    console.log('[Dashboard useEffect Deps] discussionId:', discussionId);
    console.log('[Dashboard useEffect Deps] currentStep:', currentStep);
    console.log('[Dashboard useEffect Deps] viewMode:', viewMode);
    console.log('[Dashboard useEffect Deps] user:', user);
    console.log('[Dashboard useEffect Deps] isPodLead:', isPodLead);
    console.log('[Dashboard useEffect Deps] annotationsLoaded:', annotationsLoaded);
    // For functions, we can't easily log their content, but logging their existence or a simple marker can help.
    // console.log('[Dashboard useEffect Deps] loadUserAnnotation === prevLoadUserAnnotation:', /* need a way to store previous */);
    // console.log('[Dashboard useEffect Deps] prepareConsensusView === prevPrepareConsensusView:', /* need a way to store previous */);

    if (discussionId && user && currentStep > 0 && currentStep <= 3 && annotationsLoaded) {
      console.log('[Dashboard useEffect] Basic conditions met. Processing viewMode...'); // DEBUG LOG
      if (viewMode === 'detail') {
        console.log('[Dashboard useEffect] ViewMode is detail. Loading user annotation...'); // DEBUG LOG
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
        console.log('[Dashboard useEffect] ViewMode is consensus and user is PodLead. Preparing consensus view...'); // DEBUG LOG
        // Prepare consensus view only for the current task
        const loadConsensus = async () => {
          const consensusViewData = await prepareConsensusView(discussionId, currentStep);
          console.log('[Dashboard] Prepared consensus view data:', JSON.stringify(consensusViewData)); // DEBUG LOG
          
          if (consensusViewData && consensusViewData.tasks) {
            console.log("Loaded consensus view successfully");
            // Set the subtasks for the consensus view
            switch (currentStep) {
              case TaskId.QUESTION_QUALITY:
                setConsensusTask1(consensusViewData.tasks);
                break;
              case TaskId.ANSWER_QUALITY:
                setConsensusTask2(consensusViewData.tasks);
                break;
              case TaskId.REWRITE:
                setConsensusTask3(consensusViewData.tasks);
                break;
            }
            // Set overall consensus feedback if available
            setConsensusStars(consensusViewData.stars ?? null);
            setConsensusComment(consensusViewData.comment ?? '');
          } else {
            // Reset if view data is null or tasks are null (e.g., error in preparation)
            setConsensusStars(null);
            setConsensusComment('');
            // Optionally, reset the task views too if tasks are null
            // switch (currentStep) {
            //   case TaskId.QUESTION_QUALITY: setConsensusTask1([]); break;
            //   case TaskId.ANSWER_QUALITY: setConsensusTask2([]); break;
            //   case TaskId.REWRITE: setConsensusTask3([]); break;
            // }
          }
        };
        loadConsensus();
      }
    }
  },  [discussionId, currentStep, viewMode, user, isPodLead])// Added dependencies from IIFE

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
      handleBackToGrid,
      // Pass consensus feedback if in consensus mode
      viewMode === 'consensus' ? consensusStars : null,
      viewMode === 'consensus' ? consensusComment : ''
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
    // Reset overall consensus feedback fields
    setConsensusStars(null);
    setConsensusComment('');
    toast.success("Consensus form populated with selected annotation. Please provide overall feedback.");
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
                  description="Create a consensus based on annotator assessments of question quality."
                  subTasks={consensusTask1}
                  status={getTask1Progress(true)}
                  onSubTaskChange={(taskId, selectedOption, textValue) => 
                    handleSubTaskChange('consensus1', taskId, selectedOption, textValue)
                  }
                  active={true}
                />
                {/* Component for overall consensus rating and comment */}
                <div className="mt-4 p-4 border rounded bg-gray-50">
                  <h3 className="text-lg font-semibold mb-2">Overall Consensus Feedback</h3>
                  <div className="mb-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1">Rating (1-5 stars):</label>
                    <div className="flex space-x-1">
                      {[1, 2, 3, 4, 5].map(star => (
                        <Button
                          key={star}
                          variant={consensusStars === star ? "default" : "outline"}
                          size="sm"
                          onClick={() => setConsensusStars(star)}
                        >
                          {star}
                        </Button>
                      ))}
                      {consensusStars && (
                        <Button variant="ghost" size="sm" onClick={() => setConsensusStars(null)}>Clear</Button>
                      )}
                    </div>
                  </div>
                  <div>
                    <label htmlFor="consensusCommentTask1" className="block text-sm font-medium text-gray-700 mb-1">Comment:</label>
                    <Textarea
                      id="consensusCommentTask1"
                      value={consensusComment}
                      onChange={(e) => setConsensusComment(e.target.value)}
                      placeholder="Provide an overall comment for this consensus..."
                      rows={3}
                    />
                  </div>
                </div>
                <AnnotatorView 
                  discussionId={discussionId || ""} 
                  currentStep={currentStep} 
                  getAnnotationsForTask={getAnnotationsForTask}
                  onUseForConsensus={handleUseAnnotationForConsensus}
                  getUserEmailById={getUserEmailById}
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
                {/* Component for overall consensus rating and comment */}
                <div className="mt-4 p-4 border rounded bg-gray-50">
                  <h3 className="text-lg font-semibold mb-2">Overall Consensus Feedback</h3>
                  <div className="mb-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1">Rating (1-5 stars):</label>
                    <div className="flex space-x-1">
                      {[1, 2, 3, 4, 5].map(star => (
                        <Button
                          key={star}
                          variant={consensusStars === star ? "default" : "outline"}
                          size="sm"
                          onClick={() => setConsensusStars(star)}
                        >
                          {star}
                        </Button>
                      ))}
                      {consensusStars && (
                        <Button variant="ghost" size="sm" onClick={() => setConsensusStars(null)}>Clear</Button>
                      )}
                    </div>
                  </div>
                  <div>
                    <label htmlFor="consensusComment" className="block text-sm font-medium text-gray-700 mb-1">Comment:</label>
                    <Textarea
                      id="consensusComment"
                      value={consensusComment}
                      onChange={(e) => setConsensusComment(e.target.value)}
                      placeholder="Provide an overall comment for this consensus..."
                      rows={3}
                    />
                  </div>
                </div>
                <AnnotatorView 
                  discussionId={discussionId || ""} 
                  currentStep={currentStep} 
                  getAnnotationsForTask={getAnnotationsForTask}
                  onUseForConsensus={handleUseAnnotationForConsensus}
                  getUserEmailById={getUserEmailById}
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
                {/* Component for overall consensus rating and comment */}
                <div className="mt-4 p-4 border rounded bg-gray-50">
                  <h3 className="text-lg font-semibold mb-2">Overall Consensus Feedback</h3>
                  <div className="mb-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1">Rating (1-5 stars):</label>
                    <div className="flex space-x-1">
                      {[1, 2, 3, 4, 5].map(star => (
                        <Button
                          key={star}
                          variant={consensusStars === star ? "default" : "outline"}
                          size="sm"
                          onClick={() => setConsensusStars(star)}
                        >
                          {star}
                        </Button>
                      ))}
                      {consensusStars && (
                        <Button variant="ghost" size="sm" onClick={() => setConsensusStars(null)}>Clear</Button>
                      )}
                    </div>
                  </div>
                  <div>
                    <label htmlFor="consensusCommentTask3" className="block text-sm font-medium text-gray-700 mb-1">Comment:</label>
                    <Textarea
                      id="consensusCommentTask3"
                      value={consensusComment}
                      onChange={(e) => setConsensusComment(e.target.value)}
                      placeholder="Provide an overall comment for this consensus..."
                      rows={3}
                    />
                  </div>
                </div>
                <AnnotatorView 
                  discussionId={discussionId || ""} 
                  currentStep={currentStep} 
                  getAnnotationsForTask={getAnnotationsForTask}
                  onUseForConsensus={handleUseAnnotationForConsensus}
                  getUserEmailById={getUserEmailById}
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
