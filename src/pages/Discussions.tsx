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
import { Discussion, TaskState, BatchUpload } from '@/services/api';

interface EnhancedDiscussion extends Discussion {
  tasks: {
    task1: TaskState & { userAnnotated?: boolean };
    task2: TaskState & { userAnnotated?: boolean };
    task3: TaskState & { userAnnotated?: boolean };
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
  
  const { discussions, getUserAnnotationStatus, getDiscussionsByStatus, loading, error } = useAnnotationData();
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
    const myAnnotations = params.get('mine') === 'true';
    const lang = params.get('lang')?.split(',').filter(Boolean) || [];
    const tag = params.get('tag')?.split(',').filter(Boolean) || [];
    const from = params.get('from');
    const to = params.get('to');
    const batch = params.get('batch');
    
    setFilterValues({
      status: filter || 'all',
      showMyAnnotations: myAnnotations,
      repositoryLanguage: lang,
      releaseTag: tag,
      fromDate: from ? new Date(from) : undefined,
      toDate: to ? new Date(to) : undefined,
      batchId: batch || ''
    });
    
    if (search) setSearchQuery(search);
    
    setIsMounted(true);
  }, [location.search]);
  
  // Update URL when filters change
  useEffect(() => {
    if (!isMounted) return;
    
    const params = new URLSearchParams();
    if (filterValues.status !== 'all') params.set('filter', filterValues.status);
    if (searchQuery) params.set('search', searchQuery);
    if (filterValues.showMyAnnotations) params.set('mine', 'true');
    
    if (filterValues.repositoryLanguage.length > 0) {
      params.set('lang', filterValues.repositoryLanguage.join(','));
    }
    
    if (filterValues.releaseTag.length > 0) {
      params.set('tag', filterValues.releaseTag.join(','));
    }
    
    if (filterValues.fromDate) {
      params.set('from', filterValues.fromDate.toISOString());
    }
    
    if (filterValues.toDate) {
      params.set('to', filterValues.toDate.toISOString());
    }
    
    if (filterValues.batchId) {
      params.set('batch', filterValues.batchId);
    }
    
    const newUrl = params.toString() ? `?${params.toString()}` : '';
    navigate(`/discussions${newUrl}`, { replace: true });
  }, [filterValues, searchQuery, navigate, isMounted]);
  
  // Apply filters to discussions
  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/');
      return;
    }
    
    if (!discussions || !user) {
      return;
    }
    
    // Apply filters to discussions
    let filtered = [...discussions];
    
    // Filter by status
    if (filterValues.status === 'completed') {
      filtered = getDiscussionsByStatus('completed');
    } else if (filterValues.status === 'unlocked') {
      filtered = getDiscussionsByStatus('unlocked');
    } else if (filterValues.status === 'locked') {
      filtered = getDiscussionsByStatus('locked');
    }
    
    // Filter by search query
    if (searchQuery) {
      filtered = filtered.filter(
        discussion => 
          discussion.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
          discussion.repository.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }
    
    // Filter for user's annotations
    if (filterValues.showMyAnnotations && user) {
      filtered = filtered.filter(discussion => {
        const userAnnotationStatus = getUserAnnotationStatus(discussion.id, user.id);
        return userAnnotationStatus.task1 || userAnnotationStatus.task2 || userAnnotationStatus.task3;
      });
    }
    
    // Filter by repository language
    if (filterValues.repositoryLanguage.length > 0) {
      filtered = filtered.filter(discussion => 
        discussion.repositoryLanguage && 
        filterValues.repositoryLanguage.includes(discussion.repositoryLanguage)
      );
    }
    
    // Filter by release tag
    if (filterValues.releaseTag.length > 0) {
      filtered = filtered.filter(discussion => 
        discussion.releaseTag && 
        filterValues.releaseTag.includes(discussion.releaseTag)
      );
    }
    
    // Filter by date range
    if (filterValues.fromDate) {
      filtered = filtered.filter(discussion => {
        const discussionDate = new Date(discussion.createdAt);
        return discussionDate >= filterValues.fromDate!;
      });
    }
    
    if (filterValues.toDate) {
      filtered = filtered.filter(discussion => {
        const discussionDate = new Date(discussion.createdAt);
        return discussionDate <= filterValues.toDate!;
      });
    }
    
    // Filter by batch ID
    if (filterValues.batchId) {
      filtered = filtered.filter(discussion => 
        discussion.batchId && 
        discussion.batchId.toString() === filterValues.batchId
      );
    }
    
    // Update discussions with user annotation status
    const updatedDiscussions = filtered.map(discussion => {
      const userAnnotationStatus = getUserAnnotationStatus(discussion.id, user.id);
      return {
        ...discussion,
        tasks: {
          task1: {
            ...discussion.tasks.task1,
            userAnnotated: userAnnotationStatus.task1,
          },
          task2: {
            ...discussion.tasks.task2,
            userAnnotated: userAnnotationStatus.task2,
          },
          task3: {
            ...discussion.tasks.task3,
            userAnnotated: userAnnotationStatus.task3,
          },
        },
      } as EnhancedDiscussion;
    });
    
    setFilteredDiscussions(updatedDiscussions);
  }, [discussions, isAuthenticated, navigate, getUserAnnotationStatus, user, filterValues, searchQuery, getDiscussionsByStatus]);

  // Handle search input change
  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(e.target.value);
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // URL update will happen via useEffect
  };

  const handleFilterChange = (newFilters: FilterValues) => {
    setFilterValues(newFilters);
  };

  // Optimized function to load only the specific task data
  const startTask = useCallback((discussionId: string, taskNumber: number) => {
    if (!user) {
      toast.error("You must be logged in to annotate");
      navigate('/');
      return;
    }
    
    // Check if user has already annotated this task
    const discussion = discussions.find(d => d.id === discussionId);
    if (!discussion) {
      toast.error("Discussion not found");
      return;
    }
    
    // For pod leads, they can always view the results
    if (isPodLead) {
      navigate(`/dashboard?discussionId=${discussionId}&task=${taskNumber}`);
      return;
    }
    
    // Check if the task has reached maximum annotators
    const task = taskNumber === 1 ? discussion.tasks.task1 : 
                taskNumber === 2 ? discussion.tasks.task2 : discussion.tasks.task3;
    
    const requiredAnnotators = taskNumber === 3 ? 5 : 3;
    
    if (task.annotators >= requiredAnnotators) {
      toast.error(`This task already has the maximum number of annotators (${requiredAnnotators}). Please choose another task.`);
      return;
    }
    
    // For annotators, check if they've already annotated
    const userAnnotationStatus = getUserAnnotationStatus(discussionId, user.id);
    const hasAnnotated = taskNumber === 1 ? userAnnotationStatus.task1 : 
                        taskNumber === 2 ? userAnnotationStatus.task2 : 
                        userAnnotationStatus.task3;
    
    if (hasAnnotated) {
      toast.info("You've already annotated this task. You can view or edit your annotation.");
    }
    
    navigate(`/dashboard?discussionId=${discussionId}&task=${taskNumber}`);
  }, [discussions, getUserAnnotationStatus, isPodLead, navigate, user]);

  const getTaskStatusClass = (status: 'locked' | 'unlocked' | 'completed', userAnnotated?: boolean) => {
    if (userAnnotated) return 'bg-purple-100 text-purple-800';
    
    switch (status) {
      case 'completed':
        return 'bg-green-100 text-green-800';
      case 'unlocked':
        return 'bg-blue-100 text-blue-800';
      case 'locked':
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getTaskButtonState = (discussion: Discussion, taskNumber: number) => {
    const task = taskNumber === 1 ? discussion.tasks.task1 : 
                taskNumber === 2 ? discussion.tasks.task2 : discussion.tasks.task3;
    
    const userAnnotated = task.userAnnotated;
    const requiredAnnotators = taskNumber === 3 ? 5 : 3;
    const maxAnnotatorsReached = task.annotators >= requiredAnnotators && !isPodLead && !userAnnotated;
    const isEnabled = (task.status === 'unlocked' || task.status === 'completed' || isPodLead) && !maxAnnotatorsReached;
    
    let text = '';
    if (maxAnnotatorsReached) {
      text = `Maximum Annotators Reached (${task.annotators}/${requiredAnnotators})`;
    } else if (isPodLead && task.status === 'completed') {
      text = `Create Consensus (${task.annotators}/${requiredAnnotators})`;
    } else if (userAnnotated) {
      text = `View Your Annotation (${task.annotators}/${requiredAnnotators})`;
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
                      
                      {discussion.createdAt && (
                        <Badge variant="outline" className="flex items-center gap-1 bg-gray-100">
                          <Calendar className="h-3.5 w-3.5" />
                          <span>{new Date(discussion.createdAt).toLocaleDateString()}</span>
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
                          variant={discussion.tasks.task1.status === 'completed' ? "outline" : "default"}
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
                          variant={discussion.tasks.task2.status === 'completed' ? "outline" : "default"}
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
                          variant={discussion.tasks.task3.status === 'completed' ? "outline" : "default"}
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
