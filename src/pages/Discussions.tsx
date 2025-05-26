import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import Header from '@/components/layout/Header';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Search, Github, ExternalLink, Code, Calendar, Tag, Eye, AlertCircle, ChevronLeft, ChevronRight } from 'lucide-react';
import { toast } from 'sonner';
import { useUser } from '@/contexts/UserContext';
import { useAnnotationData } from '@/hooks/useAnnotationData';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from "@/components/ui/badge";
import DiscussionDetailsModal from '@/components/dashboard/DiscussionDetailsModal';
import { useAppDispatch, useAppSelector } from '@/hooks';
import { openModal } from '@/store/discussionModalSlice';
import { fetchDiscussions, setPaginationParams } from '@/store/discussionsSlice';
import DiscussionFilters from '@/components/discussions/DiscussionFilters';
import { api } from '@/services/api/endpoints';

// Discussion type imported from api service
import { Discussion, TaskState, TaskStatus } from '@/services/api';

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

// Custom hook for debounced search
function useDebounce(value: string, delay: number) {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
}

const Discussions = () => {
  const { isAuthenticated, user, isPodLead, isAdmin } = useUser();
  const navigate = useNavigate();
  const location = useLocation();
  const dispatch = useAppDispatch();
  
  // Get discussions from Redux store
  const { discussions, loading, error, pagination } = useAppSelector(state => state.discussions);
  
  const { getUserAnnotationStatus } = useAnnotationData();
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
  const [isMounted, setIsMounted] = useState(false);
  
  // State for available filter options
  const [availableLanguages, setAvailableLanguages] = useState<string[]>([]);
  const [availableTags, setAvailableTags] = useState<string[]>([]);
  const [availableBatches, setAvailableBatches] = useState<{ id: number, name: string }[]>([]);

  const debouncedSearchQuery = useDebounce(searchQuery, 500);

  // CENTRALIZED FETCH PARAMS BUILDER - THIS ELIMINATES ALL DUPLICATION
  const buildFetchParams = useCallback((overrides = {}) => {
    console.log('🔍 DETAILED DEBUG in buildFetchParams:');
    console.log('  filterValues.showMyAnnotations:', filterValues.showMyAnnotations);
    console.log('  typeof showMyAnnotations:', typeof filterValues.showMyAnnotations);
    console.log('  user object:', user);
    console.log('  user?.id:', user?.id);
    console.log('  typeof user?.id:', typeof user?.id);
    
    // Test the condition step by step
    const step1 = filterValues.showMyAnnotations;
    const step2 = user?.id;
    const step3 = step1 && step2;
    const step4 = step3 ? user.id.toString() : undefined;
    console.log('🔍 DETAILED DEBUG in buildFetchParams:');
    console.log('  step1:', step1);
    console.log('  step2:', step2);
    console.log('  step3:', step3);
    console.log('  step4:', step4);
    const params ={
      status: filterValues.status === 'all' ? undefined : filterValues.status,
      search: debouncedSearchQuery.trim() || undefined,
      repository_language: filterValues.repositoryLanguage.length > 0 ? filterValues.repositoryLanguage.join(',') : undefined,
      release_tag: filterValues.releaseTag.length > 0 ? filterValues.releaseTag.join(',') : undefined,
      from_date: filterValues.fromDate ? filterValues.fromDate.toISOString().split('T')[0] : undefined,
      to_date: filterValues.toDate ? filterValues.toDate.toISOString().split('T')[0] : undefined,
      batch_id: filterValues.batchId ? Number(filterValues.batchId) : undefined,
      user_id: filterValues.showMyAnnotations && user?.id ? user.id.toString() : undefined,
      page: 1,
      per_page: pagination.per_page,
      forceRefresh: true,
      ...overrides // Allow overriding specific params
    };
  console.log('🔍 FINAL PARAMS TO API:', params);
    return params
  }, [filterValues, debouncedSearchQuery, user?.id, pagination.per_page]);

  // SINGLE FETCH FUNCTION - USED EVERYWHERE
  const fetchDiscussionsWithParams = useCallback((overrides = {}) => {
    const params = buildFetchParams(overrides);
    console.log('Fetching discussions with params:', params);
    dispatch(fetchDiscussions(params));
  }, [buildFetchParams, dispatch]);

  // Fetch filter options
  const fetchFilterOptions = useCallback(async () => {
    if (!isAuthenticated) return;
    
    try {
      const options = await api.discussions.getFilterOptions();
      setAvailableLanguages(options.repository_languages || []);
      setAvailableTags(options.release_tags || []);
    } catch (error) {
      console.error('Failed to fetch filter options:', error);
    }
  }, [isAuthenticated]);

  // Fetch batches
  const fetchBatchesData = useCallback(async () => {
    if (!isAuthenticated) return;
    
    try {
      const batches = await api.batches.getAllBatches();
      setAvailableBatches(batches.map(batch => ({ id: batch.id, name: batch.name })));
    } catch (error) {
      console.error('Failed to fetch batches:', error);
    }
  }, [isAuthenticated]);

  // Initialize component - Only run once on mount
  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/');
      return;
    }

    // Parse URL parameters and set initial state
    const params = new URLSearchParams(location.search);
    const statusFromParams = params.get('status');
    const search = params.get('search');
    const userIdFromParams = params.get('user_id');
    const myAnnotations = userIdFromParams === (user?.id?.toString() || '');
    const lang = params.get('repository_language')?.split(',').filter(Boolean) || [];
    const tag = params.get('tag')?.split(',').filter(Boolean) || [];
    const fromParam = params.get('from_date');
    const toParam = params.get('to_date');
    const pageParam = params.get('page');
    const perPageParam = params.get('per_page');
    const batch = params.get('batch_id');
    const fromDateObj = fromParam ? new Date(fromParam) : undefined;
    const toDateObj = toParam ? new Date(toParam) : undefined;
    
    // Set initial filter values
    setFilterValues({
      status: statusFromParams || 'all',
      showMyAnnotations: myAnnotations,
      repositoryLanguage: lang,
      releaseTag: tag,
      fromDate: fromDateObj,
      toDate: toDateObj,
      batchId: batch || ''
    });
    
    if (search) setSearchQuery(search);
    
    // Update pagination params if they exist in URL
    if (pageParam || perPageParam) {
      dispatch(setPaginationParams({
        page: pageParam ? parseInt(pageParam) : undefined,
        per_page: perPageParam ? parseInt(perPageParam) : undefined
      }));
    }
    
    // Fetch initial data
    fetchBatchesData();
    fetchFilterOptions();
    
    // Initial discussions fetch with URL params
    const initialFetchParams = {
      status: (statusFromParams && statusFromParams !== 'all') ? statusFromParams : undefined,
      search: search || undefined,
      repository_language: lang.length > 0 ? lang.join(',') : undefined,
      release_tag: tag.length > 0 ? tag.join(',') : undefined,
      from_date: fromDateObj ? fromDateObj.toISOString().split('T')[0] : undefined,
      to_date: toDateObj ? toDateObj.toISOString().split('T')[0] : undefined,
      batch_id: batch ? Number(batch) : undefined,
      user_id: myAnnotations && user?.id ? user.id.toString() : undefined,
      page: pageParam ? parseInt(pageParam) : 1,
      per_page: perPageParam ? parseInt(perPageParam) : 10,
      forceRefresh: false
    };
    
    console.log('Initial fetch with params:', initialFetchParams);
    dispatch(fetchDiscussions(initialFetchParams));
    
    setIsMounted(true);
  }, [isAuthenticated, location.search, user?.id, navigate, dispatch, fetchBatchesData, fetchFilterOptions]);

  // Effect to handle debounced search - SIMPLIFIED
  useEffect(() => {
    if (!isMounted) return;
    
    dispatch(setPaginationParams({ page: 1 }));
    fetchDiscussionsWithParams();
  }, [debouncedSearchQuery, filterValues, isMounted, dispatch, fetchDiscussionsWithParams]);

  // Enhanced discussions with user annotation status
  const enhancedDiscussions = useMemo((): EnhancedDiscussion[] => {
    if (!discussions || !user) return [];

    return discussions.map(discussion => {
      const userAnnotationStatus = getUserAnnotationStatus(discussion.id, user.id);
      
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

      return {
        ...discussion,
        tasks: {
          task1: {
            ...discussion.tasks.task1,
            userAnnotated: userAnnotationStatus.task1 === true,
            annotators: task1AnnotatorsCount
          },
          task2: {
            ...discussion.tasks.task2,
            userAnnotated: userAnnotationStatus.task2 === true,
            annotators: task2AnnotatorsCount
          },
          task3: {
            ...discussion.tasks.task3,
            userAnnotated: userAnnotationStatus.task3 === true,
            annotators: task3AnnotatorsCount
          },
        },
      } as EnhancedDiscussion;
    });
  }, [discussions, user, getUserAnnotationStatus]);

  // CLEANED UP HANDLERS - ALL USE THE SAME FETCH FUNCTION
  const handleSearchSubmit = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    dispatch(setPaginationParams({ page: 1 }));
    fetchDiscussionsWithParams();
  }, [dispatch, fetchDiscussionsWithParams]);

  const handleFilterChange = useCallback((newFilters: FilterValues) => {
    console.log('[HANDLE FILTER CHANGE] Received newFilters:', newFilters);
    setFilterValues(newFilters);
    dispatch(setPaginationParams({ page: 1 }));
    // fetchDiscussionsWithParams will be called by the useEffect when filterValues changes
  }, [dispatch]);

  const handlePageChange = useCallback((newPage: number) => {
    dispatch(setPaginationParams({ page: newPage }));
    fetchDiscussionsWithParams({ page: newPage });
  }, [dispatch, fetchDiscussionsWithParams]);

  const handlePerPageChange = useCallback((newPerPage: number) => {
    dispatch(setPaginationParams({ page: 1, per_page: newPerPage }));
    fetchDiscussionsWithParams({ page: 1, per_page: newPerPage });
  }, [dispatch, fetchDiscussionsWithParams]);

  const handleSearchChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(e.target.value);
    // Debounced search will be handled by useEffect
  }, []);

  const handleRetry = useCallback(() => {
    fetchDiscussionsWithParams({ 
      page: pagination.page,
      per_page: pagination.per_page 
    });
  }, [fetchDiscussionsWithParams, pagination.page, pagination.per_page]);

  const handleClearFilters = useCallback(() => {
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
    dispatch(setPaginationParams({ page: 1 }));
    
    // Use direct dispatch for clear filters since we're clearing everything
    dispatch(fetchDiscussions({
      status: undefined,
      search: undefined,
      repository_language: undefined,
      release_tag: undefined,
      from_date: undefined,
      to_date: undefined,
      batch_id: undefined,
      user_id: undefined,
      page: 1,
      per_page: pagination.per_page,
      forceRefresh: true
    }));
  }, [dispatch, pagination.per_page]);

  // Task navigation handler
  const startTask = useCallback((discussionId: string, taskNumber: number) => {
    console.log(`StartTask called with discussionId=${discussionId}, taskNumber=${taskNumber}`);
    
    if (!user) {
      toast.error("You must be logged in to annotate");
      navigate('/');
      return;
    }
    
    const discussion = discussions.find(d => d.id === discussionId);
    
    if (!discussion) {
      toast.error("Discussion not found. Please refresh the page and try again.");
      console.error(`Discussion with ID ${discussionId} not found in current discussions array.`);
      return;
    }
    
    const task = taskNumber === 1 ? discussion.tasks.task1 : 
                 taskNumber === 2 ? discussion.tasks.task2 : 
                 discussion.tasks.task3;
                 
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
    
    const annotationsCount = Math.max(task.annotators, actualAnnotationsCount);
    const userAnnotationStatus = getUserAnnotationStatus(discussionId, user.id);
    
    const hasAnnotated = taskNumber === 1 ? userAnnotationStatus.task1 : 
                          taskNumber === 2 ? userAnnotationStatus.task2 : 
                          userAnnotationStatus.task3;
    
    if (isPodLead || isAdmin) {
      toast.info(`Opening task ${taskNumber} in pod lead mode`);
      navigate(`/dashboard?discussionId=${discussionId}&taskId=${taskNumber}&mode=podlead&timestamp=${Date.now()}`);
      return;
    }
    
    if (task.status === 'locked' && !hasAnnotated) {
      toast.error(`Task ${taskNumber} is currently locked.`);
      return;
    }
    
    const requiredAnnotators = taskNumber === 3 ? 5 : 3;
    
    if (annotationsCount >= requiredAnnotators && !hasAnnotated) {
      toast.error(`This task already has the maximum number of annotators (${annotationsCount}/${requiredAnnotators}). Please choose another task.`);
      return;
    }
    
    if (hasAnnotated) {
      toast.info(`Opening your existing annotation for task ${taskNumber}`);
      navigate(`/dashboard?discussionId=${discussionId}&taskId=${taskNumber}&mode=edit&timestamp=${Date.now()}`);
    } else {
      toast.info(`Starting task ${taskNumber}`);
      navigate(`/dashboard?discussionId=${discussionId}&taskId=${taskNumber}&mode=new&timestamp=${Date.now()}`);
    }
    
  }, [discussions, getUserAnnotationStatus, isPodLead, isAdmin, navigate, user]);

  // Utility functions
  const getTaskStatusClass = useCallback((status: 'locked' | 'unlocked' | 'completed', userAnnotated?: boolean) => {
    if (userAnnotated === true) {
      return 'bg-purple-100 text-purple-800';
    }
    
    switch (status) {
      case 'completed':
        return 'bg-green-100 text-green-800';
      case 'unlocked':
        return 'bg-blue-100 text-blue-800';
      case 'locked':
        return 'bg-gray-100 text-gray-800';
    }
  }, []);

  const getTaskButtonState = useCallback((discussion: EnhancedDiscussion, taskNumber: number) => {
    const task = taskNumber === 1 ? discussion.tasks.task1 : 
                taskNumber === 2 ? discussion.tasks.task2 : discussion.tasks.task3;
    
    const userAnnotated = task.userAnnotated === true;
    const requiredAnnotators = taskNumber === 3 ? 5 : 3;
    const maxAnnotatorsReached = task.annotators >= requiredAnnotators && !isPodLead && !isAdmin && !userAnnotated;
    
    const isEnabled = (task.status === 'unlocked' || task.status === 'completed' || isPodLead || isAdmin || userAnnotated) && !maxAnnotatorsReached;
    
    let text = '';
    if (maxAnnotatorsReached) {
      text = `Maximum Annotators Reached (${task.annotators}/${requiredAnnotators})`;
    } else if (userAnnotated) {
      text = `View Your Annotation (${task.annotators}/${requiredAnnotators})`;
    } else if ((isPodLead || isAdmin) && task.status === 'completed') {
      text = `Create Consensus (${task.annotators}/${requiredAnnotators})`;
    } else if (task.status === 'completed') {
      text = `View Results (${task.annotators}/${requiredAnnotators})`;
    } else if (task.status === 'unlocked') {
      text = `Start Task (${task.annotators}/${requiredAnnotators})`;
    } else {
      text = `Locked (${task.annotators}/${requiredAnnotators})`;
    }
        
    return { isEnabled, text };
  }, [isPodLead, isAdmin]);

  const openExternalLink = useCallback((url: string) => {
    window.open(url, '_blank', 'noopener,noreferrer');
  }, []);

  const viewDiscussionDetails = useCallback((discussion: Discussion) => {
    dispatch(openModal(discussion));
  }, [dispatch]);

  // Calculate statistics
  const stats = useMemo(() => {
    return {
      total: pagination.total,
      showing: discussions.length,
      page: pagination.page,
      pages: pagination.pages
    };
  }, [pagination, discussions.length]);

  // Early returns for loading states
  if (!isAuthenticated) {
    return null; // Will redirect in useEffect
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col">
        <Header />
        
        <div className="container max-w-6xl mx-auto px-4 py-6 flex-grow flex flex-col items-center justify-center">
          <div className="text-center space-y-4">
            <h1 className="text-2xl font-bold text-red-600">Error Loading Discussions</h1>
            <p className="text-gray-600">{error}</p>
            <Button onClick={handleRetry}>
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
              Showing {stats.showing} of {stats.total} discussions (Page {stats.page} of {stats.pages})
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

        {/* Pagination controls */}
        <div className="flex justify-between items-center mb-6">
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-600">Items per page:</span>
            <select
              value={pagination.per_page}
              onChange={(e) => handlePerPageChange(Number(e.target.value))}
              className="border rounded px-2 py-1 text-sm"
            >
              <option value={10}>10</option>
              <option value={20}>20</option>
              <option value={50}>50</option>
            </select>
          </div>
          
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => handlePageChange(pagination.page - 1)}
              disabled={pagination.page <= 1}
            >
              <ChevronLeft className="h-4 w-4" />
              Previous
            </Button>
            
            <span className="text-sm text-gray-600">
              Page {pagination.page} of {pagination.pages}
            </span>
            
            <Button
              variant="outline"
              size="sm"
              onClick={() => handlePageChange(pagination.page + 1)}
              disabled={pagination.page >= pagination.pages}
            >
              Next
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
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
        ) : enhancedDiscussions.length === 0 ? (
          <div className="text-center py-12">
            <h3 className="text-xl font-medium text-gray-600 mb-2">No discussions found</h3>
            <p className="text-gray-500 mb-6">Try adjusting your search or filter criteria</p>
            <Button variant="outline" onClick={handleClearFilters}>
              Clear Filters
            </Button>
          </div>
        ) : (
          <div className="grid gap-6">
            {enhancedDiscussions.map((discussion) => (
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
                      <div className="flex flex-wrap items-center gap-1">
                        {discussion.id && (
                          <Badge variant="outline" className="flex items-center gap-1">
                            <Code className="h-3.5 w-3.5" />
                            <span>{discussion.id}</span>
                          </Badge>
                        )}
                      </div>
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
                      {discussion.repository_language && (
                        <Badge variant="outline" className="flex items-center gap-1">
                          <Code className="h-3.5 w-3.5" />
                          <span>{discussion.repository_language}</span>
                        </Badge>
                      )}
                      
                      {discussion.release_tag && (
                        <Badge variant="secondary" className="flex items-center gap-1">
                          <Tag className="h-3.5 w-3.5" />
                          <span>{discussion.release_tag}</span>
                        </Badge>
                      )}
                      
                      {discussion.created_at && (
                        <Badge variant="outline" className="flex items-center gap-1 bg-gray-100">
                          <Calendar className="h-3.5 w-3.5" />
                          <span>{new Date(discussion.created_at).toLocaleDateString()}</span>
                        </Badge>
                      )}
                      
                      {discussion.batch_id !== undefined && (
                        <Badge variant="outline" className="flex items-center gap-1 bg-blue-50">
                          <span>Batch: {availableBatches.find(b => b.id === discussion.batch_id)?.name || discussion.batch_id}</span>
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
                      {discussion.tasks.task1.annotators >= 3 && !(isPodLead || isAdmin) && !discussion.tasks.task1.userAnnotated ? (
                        <div className="flex items-center justify-center space-x-2 text-amber-600 text-xs py-2">
                          <AlertCircle className="h-4 w-4" />
                          <span>Maximum annotators reached (3/3)</span>
                        </div>
                      ) : (
                        <Button 
                          onClick={() => startTask(discussion.id, 1)}
                          disabled={!getTaskButtonState(discussion, 1).isEnabled}
                          className="w-full text-xs h-8"
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
                      {discussion.tasks.task2.annotators >= 3 && !(isPodLead || isAdmin) && !discussion.tasks.task2.userAnnotated ? (
                        <div className="flex items-center justify-center space-x-2 text-amber-600 text-xs py-2">
                          <AlertCircle className="h-4 w-4" />
                          <span>Maximum annotators reached (3/3)</span>
                        </div>
                      ) : (
                        <Button 
                          onClick={() => startTask(discussion.id, 2)}
                          disabled={!getTaskButtonState(discussion, 2).isEnabled}
                          className="w-full text-xs h-8"
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
                      {discussion.tasks.task3.annotators >= 5 && !(isPodLead || isAdmin) && !discussion.tasks.task3.userAnnotated ? (
                        <div className="flex items-center justify-center space-x-2 text-amber-600 text-xs py-2">
                          <AlertCircle className="h-4 w-4" />
                          <span>Maximum annotators reached (5/5)</span>
                        </div>
                      ) : (
                        <Button 
                          onClick={() => startTask(discussion.id, 3)}
                          disabled={!getTaskButtonState(discussion, 3).isEnabled}
                          className="w-full text-xs h-8"
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

        {/* Bottom pagination controls */}
        {pagination.pages > 1 && (
          <div className="flex justify-center items-center gap-2 mt-8">
            <Button
              variant="outline"
              size="sm"
              onClick={() => handlePageChange(1)}
              disabled={pagination.page <= 1}
            >
              First
            </Button>
            
            <Button
              variant="outline"
              size="sm"
              onClick={() => handlePageChange(pagination.page - 1)}
              disabled={pagination.page <= 1}
            >
              <ChevronLeft className="h-4 w-4" />
              Previous
            </Button>
            
            <div className="flex items-center gap-1">
              {/* Show page numbers around current page */}
              {Array.from({ length: Math.min(5, pagination.pages) }, (_, i) => {
                const startPage = Math.max(1, pagination.page - 2);
                const pageNum = startPage + i;
                
                if (pageNum > pagination.pages) return null;
                
                return (
                  <Button
                    key={pageNum}
                    variant={pageNum === pagination.page ? "default" : "outline"}
                    size="sm"
                    onClick={() => handlePageChange(pageNum)}
                    className="w-10 h-8"
                  >
                    {pageNum}
                  </Button>
                );
              })}
            </div>
            
            <Button
              variant="outline"
              size="sm"
              onClick={() => handlePageChange(pagination.page + 1)}
              disabled={pagination.page >= pagination.pages}
            >
              Next
              <ChevronRight className="h-4 w-4" />
            </Button>
            
            <Button
              variant="outline"
              size="sm"
              onClick={() => handlePageChange(pagination.pages)}
              disabled={pagination.page >= pagination.pages}
            >
              Last
            </Button>
          </div>
        )}
        
        {/* Global Discussion Details Modal - controlled by Redux */}
        <DiscussionDetailsModal discussion={null} />
      </div>
    </div>
  );
};

export default Discussions;