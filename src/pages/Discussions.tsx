import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import Header from '@/components/layout/Header';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Search, Github, ExternalLink, Code, Calendar, Tag, Eye, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import { useUser } from '@/contexts/UserContext';
import { useAnnotationData } from '@/hooks/useAnnotationData';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from "@/components/ui/badge";
import DiscussionDetailsModal from '@/components/dashboard/DiscussionDetailsModal';
import { useAppDispatch } from '@/hooks';
import { openModal } from '@/store/discussionModalSlice';
import { fetchDiscussions } from '@/store/discussionsSlice';
import DiscussionFilters from '@/components/discussions/DiscussionFilters';
import { api } from '@/services/api/endpoints';

// Discussion type imported from api service
import { Discussion, TaskState, BatchUpload, TaskStatus } from '@/services/api';

interface EnhancedDiscussion extends Discussion {
  tasks: {
    task1: TaskState & { userAnnotated: boolean };
    task2: TaskState & { userAnnotated: boolean };
    task3: TaskState & { userAnnotated: boolean };
  };
}

interface FilterValues {
  status: string;
  showMyAnnotations: boolean;
  repositoryLanguage: string[];
  releaseTag: string[];
  fromDate: Date | undefined;
  toDate: Date | undefined;
  batchId: string;
}

const Discussions = () => {
  const { isAuthenticated, user, isPodLead } = useUser();
  const navigate = useNavigate();
  const location = useLocation();
  const dispatch = useAppDispatch();
  
  // Fetch discussions from the API with caching handled by the slice
  useEffect(() => {
    if (isAuthenticated) {
      dispatch(fetchDiscussions());
    }
  }, [dispatch, isAuthenticated]);
  
  const { discussions, getUserAnnotationStatus, getDiscussionsByStatus, loading, error, annotations } = useAnnotationData();
  const [searchQuery, setSearchQuery] = useState('');
  const [filterValues, setFilterValues] = useState<FilterValues>({
    status: 'all',
    showMyAnnotations: false,
    repositoryLanguage: [],
    releaseTag: [],
    fromDate: undefined,
    toDate: undefined,
    batchId: ''
  });
  const [filteredDiscussions, setFilteredDiscussions] = useState<EnhancedDiscussion[]>([]);
  const [isMounted, setIsMounted] = useState(false);
  
  // State for available filter options
  const [availableLanguages, setAvailableLanguages] = useState<string[]>([]);
  const [availableTags, setAvailableTags] = useState<string[]>([]);
  const [availableBatches, setAvailableBatches] = useState<{ id: number, name: string }[]>([]);
  
  // Log the annotations data for debugging
  useEffect(() => {
    if (annotations && annotations.length > 0) {
      console.log('Available annotations:', annotations.length);
    }
  }, [annotations]);

  // Extract available filter options from discussions
  useEffect(() => {
    if (discussions.length > 0) {
      // Extract unique languages
      const languages = Array.from(new Set(
        discussions
          .map(d => d.repositoryLanguage)
          .filter(Boolean) as string[]
      ));
      
      // Extract unique tags
      const tags = Array.from(new Set(
        discussions
          .map(d => d.releaseTag)
          .filter(Boolean) as string[]
      ));
      
      setAvailableLanguages(languages);
      setAvailableTags(tags);
    }
  }, [discussions]);
  
  // Fetch available batches
  useEffect(() => {
    const fetchBatches = async () => {
      if (isAuthenticated) {
        try {
          const batches = await api.batches.getAllBatches();
          setAvailableBatches(batches.map(batch => ({ id: batch.id, name: batch.name })));
          console.log('Batches',batches)
        } catch (error) {
          console.error('Failed to fetch batches:', error);
        }
      }
    };
    
    fetchBatches();
  }, [isAuthenticated]);
  
  // Parse URL query parameters
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const filter = params.get('filter');
    const search = params.get('search');
    const userIdFromParams = params.get('user_id');
    const myAnnotations = userIdFromParams === (user?.id?.toString() || ''); // Check against current user's ID
    const lang = params.get('lang')?.split(',').filter(Boolean) || [];
    const tag = params.get('tag')?.split(',').filter(Boolean) || [];
    const fromParam = params.get('from_date'); // Changed 'from' to 'from_date'
    const toParam = params.get('to_date');     // Changed 'to' to 'to_date'
    console.log('[URL PARSE] from_date param:', fromParam, ', to_date param:', toParam);

    const fromDateObj = fromParam ? new Date(fromParam) : undefined;
    const toDateObj = toParam ? new Date(toParam) : undefined;
    console.log('[URL PARSE] fromDateObj:', fromDateObj?.toISOString(), ', toDateObj:', toDateObj?.toISOString());
    
    const batch = params.get('batch');
    
    setFilterValues({
      status: filter || 'all',
      showMyAnnotations: myAnnotations,
      repositoryLanguage: lang,
      releaseTag: tag,
      fromDate: fromDateObj,
      toDate: toDateObj,
      batchId: batch || ''
    });
    
    if (search) setSearchQuery(search);
    
    setIsMounted(true);
  }, [location.search, user?.id]);
  
  // Update URL when filters change
  useEffect(() => {
    if (!isMounted) return;
    
    const params = new URLSearchParams();
    
    // Format status parameter to match backend expectations
    if (filterValues.status !== 'all') {
      // Ensure status matches one of the valid task statuses in the API
      const validStatus = ['completed', 'unlocked', 'locked'].includes(filterValues.status) 
        ? filterValues.status 
        : 'all';
      params.set('status', validStatus);
    }
    
    // Search query parameter - sanitize to prevent injection
    if (searchQuery) {
      params.set('search', searchQuery.trim());
    }
    
    // My annotations filter
    if (filterValues.showMyAnnotations && user?.id) {
      params.set('user_id', user.id.toString());
    }
    
    // Format repository language filter as comma-separated string
    if (filterValues.repositoryLanguage && filterValues.repositoryLanguage.length > 0) {
      // Ensure all languages are properly encoded
      const encodedLanguages = filterValues.repositoryLanguage
        .map(lang => encodeURIComponent(lang))
        .join(',');
      params.set('repository_language', encodedLanguages);
    }
    
    // Format release tag filter
    if (filterValues.releaseTag && filterValues.releaseTag.length > 0) {
      // Ensure all tags are properly encoded
      const encodedTags = filterValues.releaseTag
        .map(tag => encodeURIComponent(tag))
        .join(',');
      params.set('release_tag', encodedTags);
    }
    
    // Format date parameters to match API expectations (ISO format)
    if (filterValues.fromDate instanceof Date) {
      try {
        params.set('from_date', filterValues.fromDate.toISOString().split('T')[0]); // YYYY-MM-DD format
      } catch (error) {
        console.error('Error formatting fromDate:', error);
      }
    }
    
    if (filterValues.toDate instanceof Date) {
      try {
        params.set('to_date', filterValues.toDate.toISOString().split('T')[0]); // YYYY-MM-DD format
      } catch (error) {
        console.error('Error formatting toDate:', error);
      }
    }
    
    // Format batch ID parameter - ensure it's a valid number
    if (filterValues.batchId) {
      // Only include if it's a non-empty string or number
      const batchIdNum = Number(filterValues.batchId);
      if (!isNaN(batchIdNum) && batchIdNum > 0) {
        params.set('batch_id', batchIdNum.toString());
      }
    }
    
    // Create the new URL with proper parameters
    const newUrl = params.toString() ? `?${params.toString()}` : '';
    
    // Log the constructed URL for debugging
    console.log('Updating URL with filters:', newUrl);
    
    // Navigate with the updated parameters
    navigate(`/discussions${newUrl}`, { replace: true });
  }, [filterValues, searchQuery, navigate, isMounted, user?.id]);


// Apply filters to discussions
useEffect(() => {
  if (!isAuthenticated) {
    navigate('/');
    return;
  }
  
  if (!discussions || !user) {
    return;
  }
  
  console.log('Applying filters to discussions. Total discussions:', discussions.length);
  
  // Start with all discussions
  let filtered = [...discussions];
  
  // IMPROVED: Log task status distribution before filtering
  const statusCounts = {
    completed: 0,
    unlocked: 0,
    locked: 0,
    unknown: 0
  };
  
  // Count discussions by task status for debugging
  discussions.forEach(discussion => {
    if (discussion.tasks?.task1?.status) statusCounts[discussion.tasks.task1.status] = (statusCounts[discussion.tasks.task1.status] || 0) + 1;
    if (discussion.tasks?.task2?.status) statusCounts[discussion.tasks.task2.status] = (statusCounts[discussion.tasks.task2.status] || 0) + 1;
    if (discussion.tasks?.task3?.status) statusCounts[discussion.tasks.task3.status] = (statusCounts[discussion.tasks.task3.status] || 0) + 1;
  });
  
  console.log('Task status distribution:', statusCounts);
  
  // IMPROVED FILTER: Status filter with fallback implementation
  if (filterValues.status !== 'all') {
    // First try the helper function
    const statusFilteredDiscussions = getDiscussionsByStatus(filterValues.status as TaskStatus);
    console.log(`getDiscussionsByStatus returned ${statusFilteredDiscussions.length} discussions with status '${filterValues.status}'`);
    
    if (statusFilteredDiscussions.length > 0) {
      // If helper returned results, use them
      filtered = statusFilteredDiscussions;
    } else {
      console.log(`Helper function returned 0 results, using fallback filter for ${filterValues.status} status`);
      
      // Fallback filter implementation
      filtered = filtered.filter(discussion => {
        // Check status definitions
        const isCompleted = (status: string | undefined) => status === 'completed';
        const isUnlocked = (status: string | undefined) => status === 'unlocked';
        const isLocked = (status: string | undefined) => status === 'locked';
        
        // Get task statuses
        const task1Status = discussion.tasks?.task1?.status;
        const task2Status = discussion.tasks?.task2?.status;
        const task3Status = discussion.tasks?.task3?.status;
        
        if (filterValues.status === 'completed') {
          // Discussion is completed if all tasks are completed
          return isCompleted(task1Status) && isCompleted(task2Status) && isCompleted(task3Status);
        }
        
        if (filterValues.status === 'unlocked') {
          // Discussion is unlocked if any task is unlocked
          return isUnlocked(task1Status) || isUnlocked(task2Status) || isUnlocked(task3Status);
        }
        
        if (filterValues.status === 'locked') {
          // Discussion is locked if all tasks are locked
          return isLocked(task1Status) && isLocked(task2Status) && isLocked(task3Status);
        }
        
        return true; // Default case
      });
      
      console.log(`Fallback filter found ${filtered.length} discussions with status '${filterValues.status}'`);
    }
  }
  
  // Filter by search query - match with the 'search' parameter
  if (searchQuery) {
    const searchLower = searchQuery.toLowerCase().trim();
    const beforeCount = filtered.length;
    
    filtered = filtered.filter(
      discussion => 
        (discussion.title?.toLowerCase() || '').includes(searchLower) || 
        (discussion.repository?.toLowerCase() || '').includes(searchLower)
    );
    
    console.log(`Search filter for "${searchQuery}" reduced from ${beforeCount} to ${filtered.length} discussions`);
  }
  
  // Filter for user's annotations - match with 'user_id' parameter
  if (filterValues.showMyAnnotations && user) {
    const beforeCount = filtered.length;
    
    // Loop through each discussion and check if the user has any annotations
    filtered = filtered.filter(discussion => {
      const userAnnotationStatus = getUserAnnotationStatus(discussion.id, user.id);
      
      // Check if any task is annotated by this user
      const hasUserAnnotation = 
        userAnnotationStatus.task1 === true || 
        userAnnotationStatus.task2 === true || 
        userAnnotationStatus.task3 === true;
      
      // Log when we find user annotations
      if (hasUserAnnotation) {
        console.log(`Found user ${user.id} annotations for discussion ${discussion.id}:`, userAnnotationStatus);
      }
      
      return hasUserAnnotation;
    });
    
    console.log(`User annotations filter reduced from ${beforeCount} to ${filtered.length} discussions`);
  }
  
  // Filter by repository language - match with 'repository_language' parameter
  if (filterValues.repositoryLanguage && filterValues.repositoryLanguage.length > 0) {
    const beforeCount = filtered.length;
    
    filtered = filtered.filter(discussion => {
      if (!discussion.repositoryLanguage) return false;
      
      // Case-insensitive comparison
      return filterValues.repositoryLanguage.some(lang => 
        discussion.repositoryLanguage?.toLowerCase() === lang.toLowerCase()
      );
    });
    
    console.log(`Repository language filter for [${filterValues.repositoryLanguage.join(', ')}] reduced from ${beforeCount} to ${filtered.length} discussions`);
  }
  
  // Filter by release tag - match with 'release_tag' parameter
  if (filterValues.releaseTag && filterValues.releaseTag.length > 0) {
    const beforeCount = filtered.length;
    
    filtered = filtered.filter(discussion => {
      if (!discussion.releaseTag) return false;
      
      // Case-insensitive comparison
      return filterValues.releaseTag.some(tag => 
        discussion.releaseTag?.toLowerCase() === tag.toLowerCase()
      );
    });
    
    console.log(`Release tag filter for [${filterValues.releaseTag.join(', ')}] reduced from ${beforeCount} to ${filtered.length} discussions`);
  }
  
  // Filter by date range - match with 'from_date' and 'to_date' parameters
  if (filterValues.fromDate instanceof Date) {
    const beforeCount = filtered.length;
    console.log('[FILTER APPLY] filterValues.fromDate:', filterValues.fromDate.toISOString());
    
    const fromDateFilter = new Date(filterValues.fromDate); // This is YYYY-MM-DDT00:00:00.000Z
    console.log('[FILTER APPLY] Initial fromDateFilter:', fromDateFilter.toISOString());
    
    let discussionsChecked = 0;
    filtered = filtered.filter(discussion => {
      discussionsChecked++;
      if (!discussion.created_at) {
        if (discussionsChecked <= 5) { // Log for first 5 checked
          console.log(`[FROM DATE FILTER] Discussion ${discussion.id} skipped, created_at is:`, discussion.created_at);
        }
        return false;
      }
      
      try {
        const discussionDate = new Date(discussion.created_at);
        if (isNaN(discussionDate.getTime())) {
          if (discussionsChecked <= 5) { // Log for first 5 checked
            console.log(`[FROM DATE FILTER] Discussion ${discussion.id} skipped, created_at "${discussion.created_at}" resulted in Invalid Date.`);
          }
          return false;
        }

        const comparison = discussionDate >= fromDateFilter;
        console.log(`[FROM DATE FILTER CMP] DiscID: ${discussion.id}, Created: ${discussion.created_at}, Parsed: ${discussionDate.toISOString()}, FilterStart: ${fromDateFilter.toISOString()}, Passed: ${comparison}`);
        return comparison;
      } catch (e) {
        if (discussionsChecked <= 5) { // Log for first 5 checked
           console.error(`[FROM DATE FILTER ERROR] Discussion ${discussion.id}, created_at "${discussion.created_at}", Error:`, e);
        }
        return false;
      }
    });
    console.log(`[FROM DATE FILTER] Total discussions checked by fromDate filter: ${discussionsChecked}`);
    console.log(`From date filter (${fromDateFilter.toISOString()}) reduced from ${beforeCount} to ${filtered.length} discussions`);
  }
  
  if (filterValues.toDate instanceof Date) {
    const beforeCount = filtered.length;
    console.log('[FILTER APPLY] filterValues.toDate:', filterValues.toDate.toISOString());
    
    const toDateFilterEnd = new Date(filterValues.toDate); // This is YYYY-MM-DDT00:00:00.000Z
    console.log('[FILTER APPLY] Initial toDateFilterEnd:', toDateFilterEnd.toISOString());
    toDateFilterEnd.setUTCHours(23, 59, 59, 999); // Set to end of day in UTC
    console.log('[FILTER APPLY] Adjusted toDateFilterEnd (UTC end of day):', toDateFilterEnd.toISOString());
    
    let discussionsChecked = 0;
    filtered = filtered.filter(discussion => {
      discussionsChecked++;
      if (!discussion.created_at) {
        if (discussionsChecked <= 5) { // Log for first 5 checked
          console.log(`[TO DATE FILTER] Discussion ${discussion.id} skipped, created_at is:`, discussion.created_at);
        }
        return false;
      }
      
      try {
        const discussionDate = new Date(discussion.created_at);
        // Check if discussionDate is valid
        if (isNaN(discussionDate.getTime())) {
          if (discussionsChecked <= 5) { // Log for first 5 checked
            console.log(`[TO DATE FILTER] Discussion ${discussion.id} skipped, created_at "${discussion.created_at}" resulted in Invalid Date.`);
          }
          return false;
        }

        const comparison = discussionDate <= toDateFilterEnd;
        console.log(`[TO DATE FILTER CMP] DiscID: ${discussion.id}, Created: ${discussion.created_at}, Parsed: ${discussionDate.toISOString()}, FilterEnd: ${toDateFilterEnd.toISOString()}, Passed: ${comparison}`);
        return comparison;
      } catch (e) {
        if (discussionsChecked <= 5) { // Log for first 5 checked
           console.error(`[TO DATE FILTER ERROR] Discussion ${discussion.id}, created_at "${discussion.created_at}", Error:`, e);
        }
        return false;
      }
    });
    console.log(`[TO DATE FILTER] Total discussions checked by toDate filter: ${discussionsChecked}`);
    console.log(`To date filter (${toDateFilterEnd.toISOString()}) reduced from ${beforeCount} to ${filtered.length} discussions`);
  }
  
  // Filter by batch ID - match with 'batch_id' parameter
  if (filterValues.batchId) {
    const beforeCount = filtered.length;
    const batchIdNum = Number(filterValues.batchId);
    
    if (!isNaN(batchIdNum) && batchIdNum > 0) {
      filtered = filtered.filter(discussion => {
        return discussion.batchId === batchIdNum;
      });
      
      console.log(`Batch ID filter for ${batchIdNum} reduced from ${beforeCount} to ${filtered.length} discussions`);
    }
  }
  
  // Summary log of all applied filters
  console.log('Applied filters with these criteria:', {
    status: filterValues.status,
    searchQuery: searchQuery.trim() || 'none',
    myAnnotations: filterValues.showMyAnnotations,
    repositoryLanguage: filterValues.repositoryLanguage,
    releaseTag: filterValues.releaseTag,
    fromDate: filterValues.fromDate?.toISOString(),
    toDate: filterValues.toDate?.toISOString(),
    batchId: filterValues.batchId || 'none'
  });
  
  console.log('Filtered discussions count before user annotation status update:', filtered.length);
  
  // Update discussions with user annotation status - THIS IS THE CRITICAL FIX
  const updatedDiscussions = filtered.map(discussion => {
    // Get accurate user annotation status by checking actual annotations
    const userAnnotationStatus = getUserAnnotationStatus(discussion.id, user.id);
    
    // Calculate ACTUAL annotator counts from the annotations arrays
    const task1AnnotatorsCount = 
      Array.isArray(discussion.annotations?.task1_annotations) 
        ? discussion.annotations.task1_annotations.length 
        : 0;
    
    const task2AnnotatorsCount = 
      Array.isArray(discussion.annotations?.task2_annotations) 
        ? discussion.annotations.task2_annotations.length 
        : 0;
    
    const task3AnnotatorsCount = 
      Array.isArray(discussion.annotations?.task3_annotations) 
        ? discussion.annotations.task3_annotations.length 
        : 0;
    
    // Enhanced debugging for annotation counts
    if (task1AnnotatorsCount > 0 || task2AnnotatorsCount > 0 || task3AnnotatorsCount > 0) {
      console.log(`Discussion ${discussion.id} annotation counts:`, {
        task1: task1AnnotatorsCount,
        task2: task2AnnotatorsCount,
        task3: task3AnnotatorsCount
      });
    }
    
    // Create enhanced discussion with correct annotation status
    return {
      ...discussion,
      tasks: {
        task1: {
          ...discussion.tasks.task1,
          // Force to boolean
          userAnnotated: userAnnotationStatus.task1 === true,
          // CRITICAL FIX: Update annotators count from actual data
          annotators: task1AnnotatorsCount
        },
        task2: {
          ...discussion.tasks.task2,
          // Force to boolean
          userAnnotated: userAnnotationStatus.task2 === true,
          // CRITICAL FIX: Update annotators count from actual data
          annotators: task2AnnotatorsCount
        },
        task3: {
          ...discussion.tasks.task3,
          // Force to boolean
          userAnnotated: userAnnotationStatus.task3 === true,
          // CRITICAL FIX: Update annotators count from actual data
          annotators: task3AnnotatorsCount
        },
      },
    } as EnhancedDiscussion;
  });
  
  console.log('Final filtered discussions count:', updatedDiscussions.length);
  setFilteredDiscussions(updatedDiscussions);
}, [discussions, isAuthenticated, navigate, getUserAnnotationStatus, user, filterValues, searchQuery, getDiscussionsByStatus]);  // Handle search input change
  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(e.target.value);
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // URL update will happen via useEffect
  };

  const handleFilterChange = (newFilters: FilterValues) => {
    console.log('[HANDLE FILTER CHANGE] Received newFilters:', {
      ...newFilters,
      fromDate: newFilters.fromDate?.toISOString(),
      toDate: newFilters.toDate?.toISOString(),
    });
    setFilterValues(newFilters);
  };


  // Optimized function to load only the specific task data
// Enhanced function to handle task selection and navigation
const startTask = useCallback((discussionId: string, taskNumber: number) => {
  // Debug info
  console.log(`StartTask called with discussionId=${discussionId}, taskNumber=${taskNumber}`);
  
  // Authentication check
  if (!user) {
    toast.error("You must be logged in to annotate");
    navigate('/');
    return;
  }
  
  // Ensure we're using fresh discussion data
  // This force-gets the discussion from the source data rather than relying on potentially stale state
  const freshDiscussions = [...discussions]; // Create a fresh copy
  const discussion = freshDiscussions.find(d => d.id === discussionId);
  
  if (!discussion) {
    toast.error("Discussion not found. Please refresh the page and try again.");
    console.error(`Discussion with ID ${discussionId} not found in current discussions array.`);
    return;
  }
  
  console.log(`Found discussion:`, discussion);
  
  // Get the specific task data
  const task = taskNumber === 1 ? discussion.tasks.task1 : 
               taskNumber === 2 ? discussion.tasks.task2 : 
               discussion.tasks.task3;
               
  console.log(`Task ${taskNumber} info:`, task);
  
  // Get actual annotations count from annotations array
  let actualAnnotationsCount = 0;
  if (discussion.annotations) {
    if (taskNumber === 1 && discussion.annotations.task1_annotations) {
      actualAnnotationsCount = discussion.annotations.task1_annotations.length;
    } else if (taskNumber === 2 && discussion.annotations.task2_annotations) {
      actualAnnotationsCount = discussion.annotations.task2_annotations.length;
    } else if (taskNumber === 3 && discussion.annotations.task3_annotations) {
      actualAnnotationsCount = discussion.annotations.task3_annotations.length;
    }
  }
  
  console.log(`Actual annotations count for task ${taskNumber}: ${actualAnnotationsCount}`);
  console.log(`Reported annotations count: ${task.annotators}`);
  
  // Use the higher count to be safe
  const annotationsCount = Math.max(task.annotators, actualAnnotationsCount);
  
  // Get user's existing annotation status for this discussion/task
  const userAnnotationStatus = getUserAnnotationStatus(discussionId, user.id);
  console.log(`User annotation status:`, userAnnotationStatus);
  
  const hasAnnotated = taskNumber === 1 ? userAnnotationStatus.task1 : 
                        taskNumber === 2 ? userAnnotationStatus.task2 : 
                        userAnnotationStatus.task3;
  
  // Special case for pod leads - they can always access
  if (isPodLead) {
    console.log(`User is pod lead, navigating to task ${taskNumber}`);
    toast.info(`Opening task ${taskNumber} in pod lead mode`);
    navigate(`/dashboard?discussionId=${discussionId}&taskId=${taskNumber}&mode=podlead&timestamp=${Date.now()}`);
    return;
  }
  
  // Check task status
  if (task.status === 'locked' && !hasAnnotated) {
    toast.error(`Task ${taskNumber} is currently locked.`);
    return;
  }
  
  // Check maximum annotators
  const requiredAnnotators = taskNumber === 3 ? 5 : 3;
  
  if (annotationsCount >= requiredAnnotators && !hasAnnotated) {
    toast.error(`This task already has the maximum number of annotators (${annotationsCount}/${requiredAnnotators}). Please choose another task.`);
    return;
  }
  
  // Different handling based on whether user has already annotated
  if (hasAnnotated) {
    console.log(`User has already annotated task ${taskNumber}, navigating to view/edit mode`);
    toast.info(`Opening your existing annotation for task ${taskNumber}`);
    navigate(`/dashboard?discussionId=${discussionId}&taskId=${taskNumber}&mode=edit&timestamp=${Date.now()}`);
  } else {
    console.log(`User has not annotated task ${taskNumber} yet, navigating to annotation mode`);
    toast.info(`Starting task ${taskNumber}`);
    navigate(`/dashboard?discussionId=${discussionId}&taskId=${taskNumber}&mode=new&timestamp=${Date.now()}`);
  }
  
}, [discussions, getUserAnnotationStatus, isPodLead, navigate, user]);
  const getTaskStatusClass = (status: 'locked' | 'unlocked' | 'completed', userAnnotated?: boolean) => {
    // If user has annotated, use purple regardless of task status
    if (userAnnotated === true) {
      return 'bg-purple-100 text-purple-800';
    }
    
    // Otherwise use status-based colors
    switch (status) {
      case 'completed':
        return 'bg-green-100 text-green-800';
      case 'unlocked':
        return 'bg-blue-100 text-blue-800';
      case 'locked':
        return 'bg-gray-100 text-gray-800';
    }
  };

  // FIXED version of getTaskButtonState
  const getTaskButtonState = (discussion: EnhancedDiscussion, taskNumber: number) => {
    const task = taskNumber === 1 ? discussion.tasks.task1 : 
                taskNumber === 2 ? discussion.tasks.task2 : discussion.tasks.task3;
    
    // Make sure userAnnotated is a proper boolean
    const userAnnotated = task.userAnnotated === true;
    
    const requiredAnnotators = taskNumber === 3 ? 5 : 3;
    const maxAnnotatorsReached = task.annotators >= requiredAnnotators && !isPodLead && !userAnnotated;
    
    // Enable button if:
    // - Task is unlocked or completed, or
    // - User is a pod lead, or
    // - User has already annotated this task
    // But disable if max annotators reached and user hasn't annotated
    const isEnabled = (task.status === 'unlocked' || task.status === 'completed' || isPodLead || userAnnotated) && !maxAnnotatorsReached;
    
    // Determine button text based on various conditions
    let text = '';
    if (maxAnnotatorsReached) {
      text = `Maximum Annotators Reached (${task.annotators}/${requiredAnnotators})`;
    } else if (userAnnotated) {
      // If the user has annotated this task
      text = `View Your Annotation (${task.annotators}/${requiredAnnotators})`;
    } else if (isPodLead && task.status === 'completed') {
      text = `Create Consensus (${task.annotators}/${requiredAnnotators})`;
    } else if (task.status === 'completed') {
      text = `View Results (${task.annotators}/${requiredAnnotators})`;
    } else if (task.status === 'unlocked') {
      text = `Start Task (${task.annotators}/${requiredAnnotators})`;
    } else {
      text = `Locked (${task.annotators}/${requiredAnnotators})`;
    }
        
    return {
      isEnabled,
      text
    };
  };

  const openExternalLink = (url: string) => {
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  const viewDiscussionDetails = (discussion: Discussion) => {
    dispatch(openModal(discussion));
  };

  // Stats summary for quick overview
  const stats = useMemo(() => {
    const total = discussions.length;
    const completed = getDiscussionsByStatus('completed').length;
    const inProgress = getDiscussionsByStatus('unlocked').length;
    const notStarted = getDiscussionsByStatus('locked').length;
    
    return { total, completed, inProgress, notStarted };
  }, [discussions, getDiscussionsByStatus]);

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col">
        <Header />
        
        <div className="container max-w-6xl mx-auto px-4 py-6 flex-grow flex flex-col items-center justify-center">
          <div className="text-center space-y-4">
            <h1 className="text-2xl font-bold text-red-600">Error Loading Discussions</h1>
            <p className="text-gray-600">{error}</p>
            <Button onClick={() => window.location.reload()}>
              Retry
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <Header />
      
      <div className="container max-w-6xl mx-auto px-4 py-6 flex-grow">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-bold">GitHub Discussions</h1>
            <p className="text-sm text-gray-500">
              Total: {stats.total} | Completed: {stats.completed} | In Progress: {stats.inProgress} | Not Started: {stats.notStarted}
            </p>
          </div>
          
          <form onSubmit={handleSearchSubmit} className="flex gap-2 w-full md:w-auto">
            <div className="relative flex-grow">
              <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                type="text"
                placeholder="Search discussions..."
                value={searchQuery}
                onChange={handleSearchChange}
                className="pl-8 w-full"
              />
            </div>
            <Button type="submit" variant="outline">Search</Button>
          </form>
        </div>
        
        {/* Enhanced filters */}
        <div className="mb-6">
          <DiscussionFilters
            onFilterChange={handleFilterChange}
            availableLanguages={availableLanguages}
            availableTags={availableTags}
            availableBatches={availableBatches}
            initialFilters={filterValues}
          />
        </div>
        
        {loading ? (
          <div className="grid gap-6">
            {[1, 2, 3].map((i) => (
              <Card key={i} className="overflow-hidden">
                <CardHeader>
                  <Skeleton className="h-6 w-3/4" />
                  <Skeleton className="h-4 w-1/2" />
                </CardHeader>
                <CardContent>
                  <Skeleton className="h-4 w-full mb-4" />
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {[1, 2, 3].map((j) => (
                      <Skeleton key={j} className="h-32 w-full" />
                    ))}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : filteredDiscussions.length === 0 ? (
          <div className="text-center py-12">
            <h3 className="text-xl font-medium text-gray-600 mb-2">No discussions found</h3>
            <p className="text-gray-500 mb-6">Try adjusting your search or filter criteria</p>
            <Button 
              variant="outline" 
              onClick={() => {
                setSearchQuery('');
                setFilterValues({
                  status: 'all',
                  showMyAnnotations: false,
                  repositoryLanguage: [],
                  releaseTag: [],
                  fromDate: undefined,
                  toDate: undefined,
                  batchId: ''
                });
              }}
            >
              Clear Filters
            </Button>
          </div>
        ) : (
          <div className="grid gap-6">
            {filteredDiscussions.map((discussion) => (
              <Card key={discussion.id} className="overflow-hidden">
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-lg">{discussion.title}</CardTitle>
                      <CardDescription className="flex items-center gap-1">
                        <Github className="h-3 w-3" />
                        {discussion.repository}
                      </CardDescription>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button 
                        size="sm" 
                        variant="ghost" 
                        onClick={() => viewDiscussionDetails(discussion)}
                        title="View Details"
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                      <Button 
                        size="sm" 
                        variant="ghost" 
                        onClick={() => openExternalLink(discussion.url)}
                        title="Open in GitHub"
                      >
                        <ExternalLink className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                
                <CardContent>
                  <div className="flex flex-wrap items-center justify-between mb-4">
                    <div className="text-sm text-gray-600 truncate max-w-md mb-2 md:mb-0">
                      <span className="font-medium">URL:</span> {discussion.url}
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      {discussion.repositoryLanguage && (
                        <Badge variant="outline" className="flex items-center gap-1">
                          <Code className="h-3.5 w-3.5" />
                          <span>{discussion.repositoryLanguage}</span>
                        </Badge>
                      )}
                      
                      {discussion.releaseTag && (
                        <Badge variant="secondary" className="flex items-center gap-1">
                          <Tag className="h-3.5 w-3.5" />
                          <span>{discussion.releaseTag}</span>
                        </Badge>
                      )}
                      
                      {discussion.created_at && (
                        <Badge variant="outline" className="flex items-center gap-1 bg-gray-100">
                          <Calendar className="h-3.5 w-3.5" />
                          <span>{new Date(discussion.created_at).toLocaleDateString()}</span>
                        </Badge>
                      )}
                      
                      {discussion.batchId !== undefined && (
                        <Badge variant="outline" className="flex items-center gap-1 bg-blue-50">
                          <span>Batch: {availableBatches.find(b => b.id === discussion.batchId)?.name || discussion.batchId}</span>
                        </Badge>
                      )}
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {/* Task 1 */}
                    <div className="border rounded-md p-4">
                      <div className="flex justify-between items-center mb-2">
                        <h3 className="font-medium">Task 1: Question Quality</h3>
                        <span className={`text-xs px-2 py-1 rounded-full ${getTaskStatusClass(discussion.tasks.task1.status, discussion.tasks.task1.userAnnotated)}`}>
                          {discussion.tasks.task1.userAnnotated ? 'Annotated' : discussion.tasks.task1.status}
                        </span>
                      </div>
                      <p className="text-xs text-gray-500 mb-4">
                        Evaluate question relevance, learning value, clarity, and image grounding.
                      </p>
                      {discussion.tasks.task1.annotators >= 3 && !isPodLead && !discussion.tasks.task1.userAnnotated ? (
                        <div className="flex items-center justify-center space-x-2 text-amber-600 text-xs py-2">
                          <AlertCircle className="h-4 w-4" />
                          <span>Maximum annotators reached (3/3)</span>
                        </div>
                      ) : (
                        <Button 
                          onClick={() => startTask(discussion.id, 1)}
                          disabled={!getTaskButtonState(discussion, 1).isEnabled}
                          className="w-full text-xs h-8"
                          // Use different variant if user has annotated
                          variant={discussion.tasks.task1.userAnnotated ? "secondary" : (discussion.tasks.task1.status === 'completed' ? "outline" : "default")}
                        >
                          {getTaskButtonState(discussion, 1).text}
                        </Button>
                      )}
                    </div>
                    
                    {/* Task 2 */}
                    <div className="border rounded-md p-4">
                      <div className="flex justify-between items-center mb-2">
                        <h3 className="font-medium">Task 2: Answer Quality</h3>
                        <span className={`text-xs px-2 py-1 rounded-full ${getTaskStatusClass(discussion.tasks.task2.status, discussion.tasks.task2.userAnnotated)}`}>
                          {discussion.tasks.task2.userAnnotated ? 'Annotated' : discussion.tasks.task2.status}
                        </span>
                      </div>
                      <p className="text-xs text-gray-500 mb-4">
                        Evaluate answer completeness, explanation, code execution.
                      </p>
                      {discussion.tasks.task2.annotators >= 3 && !isPodLead && !discussion.tasks.task2.userAnnotated ? (
                        <div className="flex items-center justify-center space-x-2 text-amber-600 text-xs py-2">
                          <AlertCircle className="h-4 w-4" />
                          <span>Maximum annotators reached (3/3)</span>
                        </div>
                      ) : (
                        <Button 
                          onClick={() => startTask(discussion.id, 2)}
                          disabled={!getTaskButtonState(discussion, 2).isEnabled}
                          className="w-full text-xs h-8"
                          // Use different variant if user has annotated
                          variant={discussion.tasks.task2.userAnnotated ? "secondary" : (discussion.tasks.task2.status === 'completed' ? "outline" : "default")}
                        >
                          {getTaskButtonState(discussion, 2).text}
                        </Button>
                      )}
                    </div>
                    
                    {/* Task 3 */}
                    <div className="border rounded-md p-4">
                      <div className="flex justify-between items-center mb-2">
                        <h3 className="font-medium">Task 3: Rewrite</h3>
                        <span className={`text-xs px-2 py-1 rounded-full ${getTaskStatusClass(discussion.tasks.task3.status, discussion.tasks.task3.userAnnotated)}`}>
                          {discussion.tasks.task3.userAnnotated ? 'Annotated' : discussion.tasks.task3.status}
                        </span>
                      </div>
                      <p className="text-xs text-gray-500 mb-4">
                        Rewrite question & answer, classify, provide supporting docs.
                      </p>
                      {discussion.tasks.task3.annotators >= 5 && !isPodLead && !discussion.tasks.task3.userAnnotated ? (
                        <div className="flex items-center justify-center space-x-2 text-amber-600 text-xs py-2">
                          <AlertCircle className="h-4 w-4" />
                          <span>Maximum annotators reached (5/5)</span>
                        </div>
                      ) : (
                        <Button 
                          onClick={() => startTask(discussion.id, 3)}
                          disabled={!getTaskButtonState(discussion, 3).isEnabled}
                          className="w-full text-xs h-8"
                          // Use different variant if user has annotated
                          variant={discussion.tasks.task3.userAnnotated ? "secondary" : (discussion.tasks.task3.status === 'completed' ? "outline" : "default")}
                        >
                          {getTaskButtonState(discussion, 3).text}
                        </Button>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
        
        {/* Global Discussion Details Modal - controlled by Redux */}
        <DiscussionDetailsModal discussion={null} />
      </div>
    </div>
  );
};

export default Discussions;