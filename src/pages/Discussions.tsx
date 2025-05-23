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
  
  // Get discussions from Redux store
  const { discussions, loading, error, pagination } = useAppSelector(state => state.discussions);
  
  const { getUserAnnotationStatus, annotations } = useAnnotationData();
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

  // Manual fetch batches function (only this one stays)
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
    
    // Initial discussions fetch - DIRECT DISPATCH
    const initialFetchParams = {
      status: (statusFromParams && statusFromParams !== 'all') ? statusFromParams : undefined,
      page: pageParam ? parseInt(pageParam) : 1,
      per_page: perPageParam ? parseInt(perPageParam) : 10,
      forceRefresh: false
    };
    
    console.log('Initial fetch with params:', initialFetchParams);
    dispatch(fetchDiscussions(initialFetchParams));
    
    setIsMounted(true);
  }, [isAuthenticated, location.search, user?.id, navigate, dispatch, fetchBatchesData]);

  // Extract available filter options when discussions change
  useEffect(() => {
    if (discussions.length > 0) {
      const languages = Array.from(new Set(
        discussions
          .map(d => d.repository_language)
          .filter(Boolean) as string[]
      ));
      
      const tags = Array.from(new Set(
        discussions
          .map(d => d.release_tag)
          .filter(Boolean) as string[]
      ));
      
      setAvailableLanguages(languages);
      setAvailableTags(tags);
    }
  }, [discussions]);

  // Update URL when filters change - but don't trigger fetches
  useEffect(() => {
    if (!isMounted) return;
    
    const params = new URLSearchParams();
    
    // Add pagination params
    if (pagination.page > 1) params.set('page', pagination.page.toString());
    if (pagination.per_page !== 10) params.set('per_page', pagination.per_page.toString());
    
    // Format status parameter
    if (filterValues.status !== 'all') {
      const validStatus = ['completed', 'unlocked', 'locked'].includes(filterValues.status) 
        ? filterValues.status 
        : 'all';
      params.set('status', validStatus);
    }
    
    // Other filter parameters
    if (searchQuery) params.set('search', searchQuery.trim());
    if (filterValues.showMyAnnotations && user?.id) params.set('user_id', user.id.toString());
    
    if (filterValues.repositoryLanguage?.length > 0) {
      const encodedLanguages = filterValues.repositoryLanguage
        .map(lang => encodeURIComponent(lang))
        .join(',');
      params.set('repository_language', encodedLanguages);
    }
    
    if (filterValues.releaseTag?.length > 0) {
      const encodedTags = filterValues.releaseTag
        .map(tag => encodeURIComponent(tag))
        .join(',');
      params.set('release_tag', encodedTags);
    }
    
    if (filterValues.fromDate instanceof Date) {
      try {
        params.set('from_date', filterValues.fromDate.toISOString().split('T')[0]);
      } catch (error) {
        console.error('Error formatting fromDate:', error);
      }
    }
    
    if (filterValues.toDate instanceof Date) {
      try {
        params.set('to_date', filterValues.toDate.toISOString().split('T')[0]);
      } catch (error) {
        console.error('Error formatting toDate:', error);
      }
    }
    
    if (filterValues.batchId) {
      const batchIdNum = Number(filterValues.batchId);
      if (!isNaN(batchIdNum) && batchIdNum > 0) {
        params.set('batch_id', batchIdNum.toString());
      }
    }
    
    const newUrl = params.toString() ? `?${params.toString()}` : '';
    navigate(`/discussions${newUrl}`, { replace: true });
  }, [filterValues, searchQuery, pagination, navigate, isMounted, user?.id]);

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

  // FIXED: Direct dispatch handlers - no problematic useCallback dependencies
  const handleSearchSubmit = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    dispatch(setPaginationParams({ page: 1 }));
    
    // DIRECT DISPATCH
    const fetchParams = {
      status: filterValues.status === 'all' ? undefined : filterValues.status,
      page: 1,
      per_page: pagination.per_page,
      forceRefresh: true
    };
    
    console.log('Search submit - fetching with params:', fetchParams);
    dispatch(fetchDiscussions(fetchParams));
  }, [dispatch, filterValues.status, pagination.per_page]);

  const handleFilterChange = useCallback((newFilters: FilterValues) => {
    console.log('[HANDLE FILTER CHANGE] Received newFilters:', newFilters);
    setFilterValues(newFilters);
    dispatch(setPaginationParams({ page: 1 }));
    
    // DIRECT DISPATCH
    const fetchParams = {
      status: newFilters.status === 'all' ? undefined : newFilters.status,
      page: 1,
      per_page: pagination.per_page,
      forceRefresh: true
    };
    
    console.log('Filter change - fetching with params:', fetchParams);
    dispatch(fetchDiscussions(fetchParams));
  }, [dispatch, pagination.per_page]);

  const handlePageChange = useCallback((newPage: number) => {
    dispatch(setPaginationParams({ page: newPage }));
    
    // DIRECT DISPATCH
    const fetchParams = {
      status: filterValues.status === 'all' ? undefined : filterValues.status,
      page: newPage,
      per_page: pagination.per_page,
      forceRefresh: true
    };
    
    console.log('Page change - fetching with params:', fetchParams);
    dispatch(fetchDiscussions(fetchParams));
  }, [dispatch, filterValues.status, pagination.per_page]);

  const handlePerPageChange = useCallback((newPerPage: number) => {
    dispatch(setPaginationParams({ page: 1, per_page: newPerPage }));
    
    // DIRECT DISPATCH
    const fetchParams = {
      status: filterValues.status === 'all' ? undefined : filterValues.status,
      page: 1,
      per_page: newPerPage,
      forceRefresh: true
    };
    
    console.log('Per page change - fetching with params:', fetchParams);
    dispatch(fetchDiscussions(fetchParams));
  }, [dispatch, filterValues.status]);

  const handleSearchChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(e.target.value);
  }, []);

  const handleRetry = useCallback(() => {
    // DIRECT DISPATCH
    const fetchParams = {
      status: filterValues.status === 'all' ? undefined : filterValues.status,
      page: pagination.page,
      per_page: pagination.per_page,
      forceRefresh: true
    };
    
    console.log('Retry - fetching with params:', fetchParams);
    dispatch(fetchDiscussions(fetchParams));
  }, [dispatch, filterValues.status, pagination.page, pagination.per_page]);

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
    
    // DIRECT DISPATCH
    const fetchParams = {
      status: undefined, // 'all' becomes undefined
      page: 1,
      per_page: pagination.per_page,
      forceRefresh: true
    };
    
    console.log('Clear filters - fetching with params:', fetchParams);
    dispatch(fetchDiscussions(fetchParams));
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
    
    if (isPodLead) {
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
    
  }, [discussions, getUserAnnotationStatus, isPodLead, navigate, user]);

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
    const maxAnnotatorsReached = task.annotators >= requiredAnnotators && !isPodLead && !userAnnotated;
    
    const isEnabled = (task.status === 'unlocked' || task.status === 'completed' || isPodLead || userAnnotated) && !maxAnnotatorsReached;
    
    let text = '';
    if (maxAnnotatorsReached) {
      text = `Maximum Annotators Reached (${task.annotators}/${requiredAnnotators})`;
    } else if (userAnnotated) {
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
        
    return { isEnabled, text };
  }, [isPodLead]);

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