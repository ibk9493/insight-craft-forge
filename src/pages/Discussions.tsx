import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
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
import { Discussion, parseTaskStatus, TaskState, TaskStatus } from '@/services/api';

interface EnhancedDiscussion extends Discussion {
  tasks: {
    task1: TaskState & { userAnnotated: boolean; annotators: number };
    task2: TaskState & { userAnnotated: boolean; annotators: number };
    task3: TaskState & { userAnnotated: boolean; annotators: number };
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
  taskStatuses: {
    task1: string;
    task2: string;
    task3: string;
  };
}

function useDebounce(value: string, delay: number) {
  const [debouncedValue, setDebouncedValue] = useState(value);
  useEffect(() => {
    const handler = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(handler);
  }, [value, delay]);
  return debouncedValue;
}

const Discussions = () => {
  const { isAuthenticated, user, isPodLead, isAdmin } = useUser();
  const { getUserAnnotationStatus } = useAnnotationData();
  const navigate = useNavigate();
  const location = useLocation();
  const dispatch = useAppDispatch();
  const { discussions, loading, error, pagination } = useAppSelector(state => state.discussions);

  const [filterValues, setFilterValues] = useState<FilterValues>({
    status: 'all',
    showMyAnnotations: false,
    repositoryLanguage: [],
    releaseTag: [],
    fromDate: undefined,
    toDate: undefined,
    batchId: '',
    taskStatuses: { task1: 'all', task2: 'all', task3: 'all' }
  });
  const [searchQuery, setSearchQuery] = useState('');
  const [isMounted, setIsMounted] = useState(false);
  const [isInitializing, setIsInitializing] = useState(true);

  const debouncedSearchQuery = useDebounce(searchQuery, 500);
  const lastFetchParamsRef = useRef<string>('');
  const [availableLanguages, setAvailableLanguages] = useState<string[]>([]);
  const [availableTags, setAvailableTags] = useState<string[]>([]);
  const [availableBatches, setAvailableBatches] = useState<{ id: number, name: string }[]>([]);
  
  const fetchFilterOptions = useCallback(async () => {
    if (!isAuthenticated) return;
    try {
      const options = await api.discussions.getFilterOptions();
      setAvailableLanguages(options.repository_languages || []);
      setAvailableTags(options.release_tags || []);
    } catch (err) {
      console.error('Failed to fetch filter options:', err);
    }
  }, [isAuthenticated]);
  
  const fetchBatchesData = useCallback(async () => {
    if (!isAuthenticated) return;
    try {
      const batches = await api.batches.getAllBatches();
      setAvailableBatches(batches.map(b => ({ id: b.id, name: b.name })));
    } catch (err) {
      console.error('Failed to fetch batches:', err);
    }
  }, [isAuthenticated]);

  const fetchDiscussionsWithCurrentState = useCallback((overrides = {}) => {
    const params = {
      status: filterValues.status === 'all' ? undefined : filterValues.status,
      search: debouncedSearchQuery.trim() || undefined,
      repository_language: filterValues.repositoryLanguage.join(',') || undefined,
      release_tag: filterValues.releaseTag.join(',') || undefined,
      from_date: filterValues.fromDate?.toISOString().split('T')[0],
      to_date: filterValues.toDate?.toISOString().split('T')[0],
      batch_id: filterValues.batchId ? Number(filterValues.batchId) : undefined,
      user_id: filterValues.showMyAnnotations && user?.id ? user.id.toString() : undefined,
      task1_status: filterValues.taskStatuses.task1 === 'all' ? undefined : filterValues.taskStatuses.task1,
      task2_status: filterValues.taskStatuses.task2 === 'all' ? undefined : filterValues.taskStatuses.task2,
      task3_status: filterValues.taskStatuses.task3 === 'all' ? undefined : filterValues.taskStatuses.task3,
      page: pagination.page,
      per_page: pagination.per_page,
      forceRefresh: true,
      ...overrides // Add this line to allow overriding any param
    };
    const paramsString = JSON.stringify(params);
    if (lastFetchParamsRef.current === paramsString) return;
    lastFetchParamsRef.current = paramsString;
    dispatch(fetchDiscussions(params));
  }, [dispatch, filterValues, debouncedSearchQuery, pagination, user?.id]);
  
  const handleRetry = useCallback(() => {
    fetchDiscussionsWithCurrentState();
  }, [fetchDiscussionsWithCurrentState]);
  
  const handleClearFilters = useCallback(() => {
    setSearchQuery('');
    setFilterValues({
      status: 'all',
      showMyAnnotations: false,
      repositoryLanguage: [],
      releaseTag: [],
      fromDate: undefined,
      toDate: undefined,
      batchId: '',
      taskStatuses: { task1: 'all', task2: 'all', task3: 'all' }
    });
    dispatch(setPaginationParams({ page: 1 }));
    dispatch(fetchDiscussions({
      page: 1,
      per_page: pagination.per_page,
      forceRefresh: true
    }));
  }, [dispatch, pagination.per_page]);
  
  useEffect(() => {
    if (!isAuthenticated || isMounted) return;

    const params = new URLSearchParams(location.search);
    const hasUrlFilters = Array.from(params.entries()).some(([k, v]) => v && k !== 'page' && k !== 'per_page');
    let restored = false;

    if (!hasUrlFilters) {
      const saved = sessionStorage.getItem('discussions-filters');
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          if (Date.now() - parsed.timestamp < 30 * 60 * 1000) {
            setFilterValues(parsed.filterValues);
            setSearchQuery(parsed.searchQuery || '');
            dispatch(setPaginationParams(parsed.pagination));
            restored = true;
          }
        } catch {}
      }
    }

    if (!restored && hasUrlFilters) {
      const f = { ...filterValues };
      if (params.get('status')) f.status = params.get('status');
      if (params.get('user_id')) f.showMyAnnotations = params.get('user_id') === user?.id?.toString();
      if (params.get('repository_language')) f.repositoryLanguage = params.get('repository_language').split(',');
      if (params.get('release_tag')) f.releaseTag = params.get('release_tag').split(',');
      if (params.get('from_date')) f.fromDate = new Date(params.get('from_date'));
      if (params.get('to_date')) f.toDate = new Date(params.get('to_date'));
      if (params.get('batch_id')) f.batchId = params.get('batch_id');
      f.taskStatuses.task1 = params.get('task1_status') || 'all';
      f.taskStatuses.task2 = params.get('task2_status') || 'all';
      f.taskStatuses.task3 = params.get('task3_status') || 'all';
      setFilterValues(f);
      setSearchQuery(params.get('search') || '');
      dispatch(setPaginationParams({
        page: parseInt(params.get('page')) || 1,
        per_page: parseInt(params.get('per_page')) || 10
      }));
    }

    setIsMounted(true);
    setIsInitializing(false);
  }, [isAuthenticated, location.search, user?.id]);

  useEffect(() => {
    if (!isMounted || isInitializing) return;
    const params = {
      status: filterValues.status === 'all' ? undefined : filterValues.status,
      search: debouncedSearchQuery.trim() || undefined,
      repository_language: filterValues.repositoryLanguage.join(',') || undefined,
      release_tag: filterValues.releaseTag.join(',') || undefined,
      from_date: filterValues.fromDate?.toISOString().split('T')[0],
      to_date: filterValues.toDate?.toISOString().split('T')[0],
      batch_id: filterValues.batchId ? Number(filterValues.batchId) : undefined,
      user_id: filterValues.showMyAnnotations && user?.id ? user.id.toString() : undefined,
      task1_status: filterValues.taskStatuses.task1 === 'all' ? undefined : filterValues.taskStatuses.task1,
      task2_status: filterValues.taskStatuses.task2 === 'all' ? undefined : filterValues.taskStatuses.task2,
      task3_status: filterValues.taskStatuses.task3 === 'all' ? undefined : filterValues.taskStatuses.task3,
      page: pagination.page,
      per_page: pagination.per_page
    };
    const paramsString = JSON.stringify(params);
    if (lastFetchParamsRef.current === paramsString) return;
    lastFetchParamsRef.current = paramsString;
    dispatch(fetchDiscussions(params));
  }, [filterValues, debouncedSearchQuery, pagination, user?.id, isMounted, isInitializing]);

  useEffect(() => {
    if (!isMounted || isInitializing) return;
    const filtersToSave = {
      filterValues,
      searchQuery: debouncedSearchQuery,
      pagination,
      timestamp: Date.now()
    };
    sessionStorage.setItem('discussions-filters', JSON.stringify(filtersToSave));
    const params = new URLSearchParams();
    if (filterValues.status !== 'all') params.set('status', filterValues.status);
    if (filterValues.showMyAnnotations && user?.id) params.set('user_id', user.id.toString());
    if (filterValues.repositoryLanguage.length > 0) params.set('repository_language', filterValues.repositoryLanguage.join(','));
    if (filterValues.releaseTag.length > 0) params.set('release_tag', filterValues.releaseTag.join(','));
    if (filterValues.fromDate) params.set('from_date', filterValues.fromDate.toISOString().split('T')[0]);
    if (filterValues.toDate) params.set('to_date', filterValues.toDate.toISOString().split('T')[0]);
    if (filterValues.batchId) params.set('batch_id', filterValues.batchId);
    if (filterValues.taskStatuses.task1 !== 'all') params.set('task1_status', filterValues.taskStatuses.task1);
    if (filterValues.taskStatuses.task2 !== 'all') params.set('task2_status', filterValues.taskStatuses.task2);
    if (filterValues.taskStatuses.task3 !== 'all') params.set('task3_status', filterValues.taskStatuses.task3);
    if (debouncedSearchQuery) params.set('search', debouncedSearchQuery);
    params.set('page', pagination.page.toString());
    params.set('per_page', pagination.per_page.toString());
    const newUrl = `/discussions?${params.toString()}`;
    if (location.pathname + location.search !== newUrl) {
      window.history.replaceState(null, '', newUrl);
    }
  }, [filterValues, debouncedSearchQuery, pagination, user?.id, isMounted, isInitializing]);

  const handleFilterChange = useCallback((newFilters: FilterValues) => {
    setFilterValues(newFilters);
    dispatch(setPaginationParams({ page: 1 }));
  }, [dispatch]);

  const handleSearchSubmit = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    dispatch(setPaginationParams({ page: 1 }));
  }, [dispatch]);

 const handlePageChange = useCallback((newPage: number) => {
  dispatch(setPaginationParams({ page: newPage }));
  fetchDiscussionsWithCurrentState({ page: newPage }); // Pass the new page explicitly
}, [dispatch, fetchDiscussionsWithCurrentState]);

const handlePerPageChange = useCallback((newPerPage: number) => {
  dispatch(setPaginationParams({ page: 1, per_page: newPerPage }));
  fetchDiscussionsWithCurrentState({ page: 1, per_page: newPerPage }); // Pass both explicitly
}, [dispatch, fetchDiscussionsWithCurrentState]);

  const handleSearchChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(e.target.value);
  }, []);

  // Enhanced discussions with user annotation status
  const enhancedDiscussions = useMemo((): EnhancedDiscussion[] => {
    if (!discussions || !user) return [];
    return discussions.map(discussion => {
      const status = getUserAnnotationStatus(discussion.id, user.id);
      return {
        ...discussion,
        tasks: {
          task1: {
            ...discussion.tasks.task1,
            userAnnotated: status.task1 === true,
            annotators: discussion.annotations?.task1_annotations?.length || 0
          },
          task2: {
            ...discussion.tasks.task2,
            userAnnotated: status.task2 === true,
            annotators: discussion.annotations?.task2_annotations?.length || 0
          },
          task3: {
            ...discussion.tasks.task3,
            userAnnotated: status.task3 === true,
            annotators: discussion.annotations?.task3_annotations?.length || 0
          }
        }
      };
    });
  }, [discussions, user, getUserAnnotationStatus]);

  const viewDiscussionDetails = useCallback((discussion: Discussion) => {
    dispatch(openModal(discussion));
  }, [dispatch]);

  const stats = useMemo(() => {
    return {
      total: pagination.total,
      showing: discussions.length,
      page: pagination.page,
      pages: pagination.pages
    };
  }, [pagination, discussions.length]);

  const openExternalLink = useCallback((url: string) => {
    window.open(url, '_blank', 'noopener,noreferrer');
  }, []);


  
  const getCategoryLabel = useCallback((category) => {
    const categoryMap = {
      'workflow_misrouting': 'Wrong Task Stage',
      'quality_issue': 'Quality Issue',
      'consensus_mismatch': 'Consensus Problem',
      'data_error': 'Data Error',
      'general': 'Other Issue'
    };
    return categoryMap[category] || category;
  }, []);


  const getTaskStatusClass = useCallback((status: TaskStatus, userAnnotated?: boolean) => {
    // If user has annotated, show that first
    if (userAnnotated) return 'bg-purple-100 text-purple-800';
    
    // Handle your existing statuses + new enhanced ones
    switch (status) {
      // Your existing statuses
      case 'completed': 
        return 'bg-green-100 text-green-800';
      case 'unlocked': 
        return 'bg-blue-100 text-blue-800';
      case 'locked': 
        return 'bg-gray-100 text-gray-800';
      
      // New enhanced statuses
      case 'rework':
        return 'bg-orange-100 text-orange-800';
      case 'blocked':
        return 'bg-red-100 text-red-800';
      case 'ready_for_next':
        return 'bg-purple-100 text-purple-800';
      case 'ready_for_consensus':
        return 'bg-amber-100 text-amber-800';
      case 'consensus_created':
        return 'bg-indigo-100 text-indigo-800';
      case 'flagged':
        return 'bg-yellow-100 text-yellow-800';
      
      default:
        return 'bg-gray-100 text-gray-800';
    }
  }, []);

const getTaskButtonState = useCallback((discussion: EnhancedDiscussion, taskNumber: number) => {
  const task = discussion.tasks[`task${taskNumber}` as keyof EnhancedDiscussion['tasks']];
  const userAnnotated = task.userAnnotated;
  const required = taskNumber === 3 ? 5 : 3;
  const maxed = task.annotators >= required && !isPodLead && !isAdmin && !userAnnotated;
  
  // Handle special statuses first
  if (parseTaskStatus(task.status).status === 'rework') {
    return {
      isEnabled: isPodLead || isAdmin || userAnnotated,
      text: `Needs Rework (${task.annotators}/${required})`
    };
  }
  
  if (parseTaskStatus(task.status).status === 'flagged') {
    return {
      isEnabled: isPodLead || isAdmin,
      text: `Flagged for Review (${task.annotators}/${required})`
    };
  }
  
  if (parseTaskStatus(task.status).status === 'ready_for_consensus') {
    return {
      isEnabled: isPodLead || isAdmin,
      text: `Ready for Consensus (${task.annotators}/${required})`
    };
  }

  if (parseTaskStatus(task.status).status === 'blocked') {
    return {
      isEnabled: isPodLead || isAdmin,
      text: `Blocked - Contact Admin (${task.annotators}/${required})`
    };
  }
  
  if (parseTaskStatus(task.status).status === 'consensus_created') {
    return {
      isEnabled: isPodLead || isAdmin,
      text: `Consensus Created (${task.annotators}/${required})`
    };
  }
  
  if (parseTaskStatus(task.status).status === 'ready_for_next') {
    return {
      isEnabled: isPodLead || isAdmin,
      text: `Ready for Next Task (${task.annotators}/${required})`
    };
  }

  // Standard enablement logic
  const isEnabled = (parseTaskStatus(task.status).status !== 'locked' || isPodLead || isAdmin || userAnnotated) && !maxed;

  let text = '';
  if (maxed) {
    text = `Maximum Annotators Reached (${task.annotators}/${required})`;
  } else if (userAnnotated) {
    text = `View Your Annotation (${task.annotators}/${required})`;
  } else if ((isPodLead || isAdmin) && parseTaskStatus(task.status).status === 'completed') {
    text = `Create Consensus (${task.annotators}/${required})`;
  } else if (parseTaskStatus(task.status).status === 'completed') {
    text = `View Results (${task.annotators}/${required})`;
  } else if (parseTaskStatus(task.status).status === 'unlocked') {
    text = `Start Task (${task.annotators}/${required})`;
  } else {
    text = `Locked (${task.annotators}/${required})`;
  }

  return { isEnabled, text };
}, [isPodLead, isAdmin]);


const startTask = useCallback((discussionId: string, taskNumber: number) => {
  const discussion = discussions.find(d => d.id === discussionId);
  if (!user || !discussion) return toast.error("Discussion not found or user not authenticated");

  const task = discussion.tasks[`task${taskNumber}` as keyof EnhancedDiscussion['tasks']];
  const hasAnnotated = getUserAnnotationStatus(discussionId, user.id)[`task${taskNumber}` as keyof TaskStatus];
  const annotationsCount = task.annotators;
  const required = taskNumber === 3 ? 5 : 3;

  // Pod leads and admins can always access tasks
  if (isPodLead || isAdmin) {
    return navigate(`/dashboard?discussionId=${discussionId}&taskId=${taskNumber}&mode=podlead&timestamp=${Date.now()}`);
  }

  // Handle special status types for regular users
  // Handle special status types for regular users
  if (parseTaskStatus(task.status).status === 'rework') {
    // Rework tasks should be accessible to regular annotators for re-annotation
    // Show a special message indicating this is a rework
    toast.info(`This task was flagged for rework. Please review updated guidelines before annotating.`);
    // Continue to allow access (don't return early)
  }
  
  if (parseTaskStatus(task.status).status === 'flagged') {
    return toast.error(`Task ${taskNumber} is flagged and requires pod lead review.`);
  }
  
  if (parseTaskStatus(task.status).status === 'blocked') {
    return toast.error(`Task ${taskNumber} is blocked. Please contact an administrator.`);
  }
  
  if (parseTaskStatus(task.status).status === 'ready_for_consensus') {
    return toast.error(`Task ${taskNumber} is ready for consensus creation by a pod lead.`);
  }
  
  if (parseTaskStatus(task.status).status === 'consensus_created') {
    return toast.error(`Task ${taskNumber} consensus has been created. Contact a pod lead for next steps.`);
  }
  
  if (parseTaskStatus(task.status).status === 'ready_for_next') {
    return toast.error(`Task ${taskNumber} is complete and ready for next task unlock by a pod lead.`);
  }

  // Standard status checks
  if (parseTaskStatus(task.status).status === 'locked' && !hasAnnotated) {
    return toast.error(`Task ${taskNumber} is currently locked.`);
  }
  
  if (annotationsCount >= required && !hasAnnotated) {
    return toast.error(`This task already has the maximum number of annotators.`);
  }

  // Allow access for unlocked tasks or if user has already annotated
  const mode = hasAnnotated ? 'edit' : 'new';
  navigate(`/dashboard?discussionId=${discussionId}&taskId=${taskNumber}&mode=${mode}&timestamp=${Date.now()}`);
}, [user, discussions, getUserAnnotationStatus, isPodLead, isAdmin, navigate]);

const getStatusLabel = useCallback((status: string, userAnnotated: boolean) => {
  if (userAnnotated) return 'Annotated';
  
  switch (status) {
    case 'locked': return 'Locked';
    case 'unlocked': return 'Unlocked';
    case 'completed': return 'Completed';
    case 'rework': return 'Needs Rework';
    case 'blocked': return 'Blocked';
    case 'flagged': return 'Flagged';
    case 'ready_for_consensus': return 'Ready for Consensus';
    case 'consensus_created': return 'Consensus Created';   
    case 'ready_for_next': return 'Ready for Next';
    default: return status;
  }
}, []);

  // Early returns for loading states
  if (!isAuthenticated) {
    return null;
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
                        <span className={`text-xs px-2 py-1 rounded-full ${getTaskStatusClass(parseTaskStatus(discussion.tasks.task1.status).status, discussion.tasks.task1.userAnnotated)}`}>
                          {getStatusLabel(parseTaskStatus(discussion.tasks.task1.status).status, discussion.tasks.task1.userAnnotated)}
                        </span>
                      </div>
                      <p className="text-xs text-gray-500 mb-4">
                        Evaluate question relevance, learning value, clarity, and image grounding.
                      </p>
                      {parseTaskStatus(discussion.tasks.task1.status).status === 'rework' && (() => {
                        const statusData = parseTaskStatus(discussion.tasks.task1.status);
                        return statusData.reason ? (
                          <div className="mt-2 p-2 bg-orange-50 border border-orange-200 rounded text-xs">
                            <div className="font-medium text-orange-800">Flagged: {getCategoryLabel(statusData.category)}</div>
                            <div className="text-orange-700 mt-1">{statusData.reason.length > 80 ? `${statusData.reason.substring(0, 80)}...` : statusData.reason}</div>
                            <div className="text-orange-600 mt-1">By: {statusData.flagged_by}</div>
                          </div>
                        ) : null;
                      })()}
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
                          variant={
                            discussion.tasks.task1.userAnnotated ? "secondary" :
                            ['rework', 'flagged', 'blocked'].includes(parseTaskStatus(discussion.tasks.task1.status).status) ? "destructive" :
                            ['ready_for_consensus', 'consensus_created'].includes(parseTaskStatus(discussion.tasks.task1.status).status) ? "outline" :
                            parseTaskStatus(discussion.tasks.task1.status).status === 'completed' ? "outline" : "default"
                          }
                        >
                          {getTaskButtonState(discussion, 1).text}
                        </Button>
                      )}
                    </div>
                    
                    {/* Task 2 */}
                    <div className="border rounded-md p-4">
                      <div className="flex justify-between items-center mb-2">
                        <h3 className="font-medium">Task 2: Answer Quality</h3>
                        <span className={`text-xs px-2 py-1 rounded-full ${getTaskStatusClass(parseTaskStatus(discussion.tasks.task2.status).status, discussion.tasks.task2.userAnnotated)}`}>
                          {getStatusLabel(parseTaskStatus(discussion.tasks.task2.status).status, discussion.tasks.task2.userAnnotated)}
                        </span>
                      </div>
                      <p className="text-xs text-gray-500 mb-4">
                        Evaluate answer completeness, explanation, code execution.
                      </p>
                      {parseTaskStatus(discussion.tasks.task2.status).status === 'rework' && (() => {
                        const statusData = parseTaskStatus(discussion.tasks.task2.status);
                        return statusData.reason ? (
                          <div className="mt-2 p-2 bg-orange-50 border border-orange-200 rounded text-xs">
                            <div className="font-medium text-orange-800">Flagged: {getCategoryLabel(statusData.category)}</div>
                            <div className="text-orange-700 mt-1">{statusData.reason.length > 80 ? `${statusData.reason.substring(0, 80)}...` : statusData.reason}</div>
                            <div className="text-orange-600 mt-1">By: {statusData.flagged_by}</div>
                          </div>
                        ) : null;
                      })()}
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
                          variant={
                            discussion.tasks.task2.userAnnotated ? "secondary" :
                            ['rework', 'flagged', 'blocked'].includes(parseTaskStatus(discussion.tasks.task2.status).status) ? "destructive" :
                            ['ready_for_consensus', 'consensus_created'].includes(parseTaskStatus(discussion.tasks.task2.status).status) ? "outline" :
                            parseTaskStatus(discussion.tasks.task2.status).status === 'completed' ? "outline" : "default"
                          }
                        >
                          {getTaskButtonState(discussion, 2).text}
                        </Button>
                      )}
                    </div>
                    
                    {/* Task 3 */}
                    <div className="border rounded-md p-4">
                      <div className="flex justify-between items-center mb-2">
                        <h3 className="font-medium">Task 3: Rewrite</h3>
                        <span className={`text-xs px-2 py-1 rounded-full ${getTaskStatusClass(parseTaskStatus(discussion.tasks.task3.status).status, discussion.tasks.task3.userAnnotated)}`}>
                          {getStatusLabel(parseTaskStatus(discussion.tasks.task3.status).status, discussion.tasks.task3.userAnnotated)}
                        </span>
                      </div>
                      <p className="text-xs text-gray-500 mb-4">
                        Rewrite question & answer, classify, provide supporting docs.
                      </p>
                      {parseTaskStatus(discussion.tasks.task3.status).status === 'rework' && (() => {
                        const statusData = parseTaskStatus(discussion.tasks.task3.status);
                        return statusData.reason ? (
                          <div className="mt-2 p-2 bg-orange-50 border border-orange-200 rounded text-xs">
                            <div className="font-medium text-orange-800">Flagged: {getCategoryLabel(statusData.category)}</div>
                            <div className="text-orange-700 mt-1">{statusData.reason.length > 80 ? `${statusData.reason.substring(0, 80)}...` : statusData.reason}</div>
                            <div className="text-orange-600 mt-1">By: {statusData.flagged_by}</div>
                          </div>
                        ) : null;
                      })()}
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
                          variant={
                            discussion.tasks.task3.userAnnotated ? "secondary" :
                            ['rework', 'flagged', 'blocked'].includes(parseTaskStatus(discussion.tasks.task3.status).status) ? "destructive" :
                            ['ready_for_consensus', 'consensus_created'].includes(parseTaskStatus(discussion.tasks.task3.status).status) ? "outline" :
                            parseTaskStatus(discussion.tasks.task3.status).status === 'completed' ? "outline" : "default"
                          }
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