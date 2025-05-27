import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { toast } from 'sonner';
import { useUser } from '@/contexts/UserContext';
import { useAnnotationData } from '@/hooks/useAnnotationData';
import { SubTask } from '@/components/dashboard/TaskCard';
import { TaskId } from './annotations/useAnnotationTypes';

export function useDashboardState() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, isAuthenticated, isPodLead, isAdmin, logout } = useUser();
  const queryParams = new URLSearchParams(location.search);
  const discussionId = queryParams.get('discussionId');
  const taskNumber = queryParams.get('task') ? parseInt(queryParams.get('task')!) : null;
  
  const [url, setUrl] = useState<string>('');
  const [currentStep, setCurrentStep] = useState(taskNumber || 0);
  const [viewMode, setViewMode] = useState<'grid' | 'detail' | 'consensus'>(taskNumber ? 'detail' : 'grid');
  const [selectedTaskId, setSelectedTaskId] = useState<number | null>(taskNumber);
  const [isInitialized, setIsInitialized] = useState<boolean>(false);
  const [screenshotUrl, setScreenshotUrl] = useState<string | null>(null);
  const [codeDownloadUrl, setCodeDownloadUrl] = useState<string | null>(null);
  const [screenshotUrlText, setScreenshotUrlText] = useState<string | null>(null);
  const [codeDownloadUrlText, setCodeDownloadUrlText] = useState<string | null>(null);
  const [isCodeUrlValid, setIsCodeUrlValid] = useState<boolean>(false);
  const [currentDiscussion, setCurrentDiscussion] = useState<any | null>(null);
  
  // Prevent infinite render cycles
  const initialLoadRef = useRef(false);
  
  // Get access to annotation data
  const {
    discussions,
    getUserAnnotation,
    getAnnotationsForTask,
    saveAnnotation,
    saveConsensusAnnotation,
    getConsensusAnnotation,
    annotationsLoaded
  } = useAnnotationData();

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
      id: TaskId.QUESTION_QUALITY,
      title: "Question Quality Assessment",
      description: "Evaluate the quality of the question based on relevance, learning value, clarity, and image grounding.",
      status: 'locked' as 'locked' | 'unlocked' | 'completed',
      requiredAnnotators: 3,
      currentAnnotators: 0
    },
    {
      id: TaskId.ANSWER_QUALITY,
      title: "Answer Quality Assessment",
      description: "Evaluate the quality of the answer based on comprehensiveness, explanation, code execution, and completeness.",
      status: 'locked' as 'locked' | 'unlocked' | 'completed',
      requiredAnnotators: 3,
      currentAnnotators: 0
    },
    {
      id: TaskId.REWRITE,
      title: "Rewrite Question and Answer",
      description: "Rewrite the question and answer to improve clarity, conciseness, and coherence.",
      status: 'locked' as 'locked' | 'unlocked' | 'completed',
      requiredAnnotators: 5,
      currentAnnotators: 0
    }
  ]);

  // GitHub URL validation
  const validateGitHubCodeUrl = (url: string): boolean => {
    return url.includes('github.com') && 
      (url.includes('/archive/refs/tags/') || url.includes('/archive/refs/heads/'));
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
    if (discussionId) {
      navigate(`/dashboard?discussionId=${discussionId}&task=${taskId}`, { replace: true });
    } else {
      navigate(`/dashboard?task=${taskId}`, { replace: true });
    }
  };

  const handleBackToGrid = useCallback(() => {
    setViewMode('grid');
    setSelectedTaskId(null);
    
    // Update URL without the task parameter
    if (discussionId) {
      navigate(`/dashboard?discussionId=${discussionId}`, { replace: true });
    } else {
      navigate(`/dashboard`, { replace: true });
    }
  }, [discussionId, navigate]);

  const handleScreenshotUrlChange = (url: string, selectedOption?: string) => {
    setScreenshotUrl(url);
    setScreenshotUrlText(selectedOption)
    toast.success("Screenshot URL saved");
  };
  
  const handleCodeUrlChange = (url: string, selectedOption?: string) => {
    setCodeDownloadUrl(url);
    setCodeDownloadUrlText(selectedOption)
    setIsCodeUrlValid(validateGitHubCodeUrl(url));
  };

  const updateStepCompletionStatus = (stepIndex: number, completed: boolean) => {
    setSteps(steps.map((step, index) => 
      index === stepIndex ? { ...step, completed } : step
    ));
  };

  const toggleConsensusMode = () => {
    if (viewMode === 'detail') {
      setViewMode('consensus');
    } else {
      setViewMode('detail');
    }
  };

  // Load code download URL from user's saved annotation or from discussion metadata
  useEffect(() => {
    if (discussionId && discussions.length > 0) {
      const discussion = discussions.find(d => d.id === discussionId);
      setCurrentDiscussion(discussion || null);
      
      if (discussion && user && currentStep === TaskId.ANSWER_QUALITY) {
        // First try to get URL from user's saved annotation
        const annotation = getUserAnnotation(discussionId, user.id, currentStep);
        if (annotation) {
          if (annotation.data.codeDownloadUrl) {
            const url = annotation.data.codeDownloadUrl as string;
            setCodeDownloadUrl(url);
            setIsCodeUrlValid(validateGitHubCodeUrl(url));
          }
          if (annotation.data.screenshot) {
            setScreenshotUrl(annotation.data.screenshot as string);
          }
        } 
        // Then try to use the repository's release URL if available (for code download)
        else if (discussion.release_url && !codeDownloadUrl) {
          setCodeDownloadUrl(discussion.release_url);
          setIsCodeUrlValid(validateGitHubCodeUrl(discussion.release_url));
        }
        // Finally fall back to a default URL based on repository name
        else if (!codeDownloadUrl && discussion.repository) {
          const repoName = discussion.repository;
          const defaultUrl = `https://github.com/${repoName}/archive/refs/heads/main.tar.gz`;
          setCodeDownloadUrl(defaultUrl);
          setIsCodeUrlValid(validateGitHubCodeUrl(defaultUrl));
        }
      }
    }
  }, [discussionId, user, currentStep, discussions, getUserAnnotation]);

  // Load URL from query params or discussion entry
  useEffect(() => {
    if (!isInitialized) return;
    
    // If URL parameter is in the query, use it
    const urlParam = queryParams.get('url');
    if (urlParam) {
      setUrl(urlParam);
    } else if (discussionId && discussions.length > 0) {
      // Get URL from discussion
      const discussion = discussions.find(d => d.id === discussionId);
      if (discussion) {
        setUrl(discussion.url);
      }
    }
  }, [discussionId, queryParams, discussions, isInitialized]);

  // Load discussion tasks status
  useEffect(() => {
    if (discussionId && discussions.length > 0) {
      const discussion = discussions.find(d => d.id === discussionId);
      if (discussion) {
        // Update tasks with current status from the discussion
        setTasks([
          {
            ...tasks[0],
            status: discussion.tasks.task1.status,
            currentAnnotators: discussion.tasks.task1.annotators
          },
          {
            ...tasks[1],
            status: discussion.tasks.task2.status,
            currentAnnotators: discussion.tasks.task2.annotators
          },
          {
            ...tasks[2],
            status: discussion.tasks.task3.status,
            currentAnnotators: discussion.tasks.task3.annotators
          }
        ]);
      }
    }
  }, [discussionId, discussions]);

  // Check login and redirect if necessary
  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/');
      return;
    }
    
    // Only run once on component mount
    if (!initialLoadRef.current) {
      initialLoadRef.current = true;
      
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
      
      setIsInitialized(true);
    }
  }, [discussionId, taskNumber, navigate, isAuthenticated]);

  return {
    url,
    setUrl,
    currentStep,
    setCurrentStep,
    viewMode,
    setViewMode,
    selectedTaskId, 
    setSelectedTaskId,
    isInitialized,
    setIsInitialized,
    screenshotUrl,
    setScreenshotUrl,
    screenshotUrlText,
    setScreenshotUrlText,
    codeDownloadUrl,
    setCodeDownloadUrl,
    codeDownloadUrlText,
    setCodeDownloadUrlText,
    isCodeUrlValid,
    steps,
    setSteps,
    tasks,
    setTasks,
    handleUrlSubmit,
    handleSelectTask,
    handleBackToGrid,
    handleScreenshotUrlChange,
    handleCodeUrlChange,
    validateGitHubCodeUrl,
    updateStepCompletionStatus,
    toggleConsensusMode,
    discussionId,
    taskNumber,
    user,
    isPodLead,
    isAdmin,
    getUserAnnotation,
    getAnnotationsForTask,
    saveAnnotation,
    saveConsensusAnnotation,
    getConsensusAnnotation,
    discussions,
    currentDiscussion,
    annotationsLoaded
  };
}
