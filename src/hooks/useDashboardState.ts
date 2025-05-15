
import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { toast } from 'sonner';
import { useUser } from '@/contexts/UserContext';
import { useAnnotationData } from '@/hooks/useAnnotationData';
import { SubTask, SubTaskStatus } from '@/components/dashboard/TaskCard';

export function useDashboardState() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, isAuthenticated, isPodLead, logout } = useUser();
  const queryParams = new URLSearchParams(location.search);
  const discussionId = queryParams.get('discussionId');
  const taskNumber = queryParams.get('task') ? parseInt(queryParams.get('task')!) : null;
  
  const [url, setUrl] = useState<string>('');
  const [currentStep, setCurrentStep] = useState(taskNumber || 0);
  const [viewMode, setViewMode] = useState<'grid' | 'detail' | 'consensus'>(taskNumber ? 'detail' : 'grid');
  const [selectedTaskId, setSelectedTaskId] = useState<number | null>(taskNumber);
  const [isInitialized, setIsInitialized] = useState<boolean>(false);
  const [uploadedImage, setUploadedImage] = useState<string | null>(null);
  const [codeDownloadUrl, setCodeDownloadUrl] = useState<string | null>(null);
  
  // Prevent infinite render cycles
  const initialLoadRef = useRef(false);
  
  // Get access to annotation data
  const {
    discussions,
    getUserAnnotation,
    getAnnotationsForTask,
    saveAnnotation,
    saveConsensusAnnotation,
    getConsensusAnnotation
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
    
    // Note: loadUserAnnotation and prepareConsensusView will be handled in Dashboard.tsx
    // with useAnnotationHandlers hook
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

  const handleLogout = () => {
    if (user && logout) {
      logout();
      navigate('/');
    }
  };

  const handleFileUpload = (file: File) => {
    // Create a URL for the uploaded file
    const imageUrl = URL.createObjectURL(file);
    setUploadedImage(imageUrl);
    
    toast.success("Screenshot uploaded successfully", {
      description: "The image can be used for code execution verification"
    });
  };

  const updateStepCompletionStatus = (stepIndex: number, completed: boolean) => {
    setSteps(steps.map((step, index) => 
      index === stepIndex ? { ...step, completed } : step
    ));
  };

  const toggleConsensusMode = () => {
    if (viewMode === 'detail') {
      setViewMode('consensus');
      // Note: prepareConsensusView will be handled in Dashboard.tsx
      // with useAnnotationHandlers hook
    } else {
      setViewMode('detail');
    }
  };

  // Set code download URL when discussion ID is available
  useEffect(() => {
    if (discussionId) {
      // Find the discussion to get repository URL
      const discussion = discussions.find(d => d.id === discussionId);
      if (discussion) {
        // In a real implementation, this would come from the API or a config file
        // For now, we'll use a mock URL for demonstration
        const repoName = discussion.repository || 'owner/repo';
        setCodeDownloadUrl(`https://github.com/${repoName}/archive/refs/tags/latest.tar.gz`);
      }
    }
  }, [discussionId, discussions]);

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
    uploadedImage,
    setUploadedImage,
    codeDownloadUrl,
    setCodeDownloadUrl,
    steps,
    setSteps,
    tasks,
    setTasks,
    handleUrlSubmit,
    handleSelectTask,
    handleBackToGrid,
    handleLogout,
    handleFileUpload,
    updateStepCompletionStatus,
    toggleConsensusMode,
    discussionId,
    taskNumber,
    user,
    isPodLead,
    getUserAnnotation,
    getAnnotationsForTask,
    saveAnnotation,
    saveConsensusAnnotation,
    getConsensusAnnotation,
    discussions,
    logout
  };
}
