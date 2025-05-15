import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import Header from '@/components/layout/Header';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Search, Github, ExternalLink, Filter } from 'lucide-react';
import { toast } from 'sonner';
import { useUser } from '@/contexts/UserContext';
import { useAnnotationData } from '@/hooks/useAnnotationData';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { 
  Popover,
  PopoverContent,
  PopoverTrigger 
} from '@/components/ui/popover';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';

// Discussion type imported from api service
import { Discussion, TaskState } from '@/services/api';

interface EnhancedDiscussion extends Discussion {
  tasks: {
    task1: TaskState & { userAnnotated?: boolean };
    task2: TaskState & { userAnnotated?: boolean };
    task3: TaskState & { userAnnotated?: boolean };
  };
}

const Discussions = () => {
  const { isAuthenticated, user, isPodLead } = useUser();
  const navigate = useNavigate();
  const location = useLocation();
  const { discussions, getUserAnnotationStatus, getDiscussionsByStatus, loading, error } = useAnnotationData();
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filteredDiscussions, setFilteredDiscussions] = useState<EnhancedDiscussion[]>([]);
  const [showMyAnnotations, setShowMyAnnotations] = useState(false);
  const [isMounted, setIsMounted] = useState(false);
  
  // Parse URL query parameters
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const filter = params.get('filter');
    const search = params.get('search');
    const myAnnotations = params.get('mine') === 'true';
    
    if (filter) setFilterStatus(filter);
    if (search) setSearchQuery(search);
    if (myAnnotations) setShowMyAnnotations(true);
    
    setIsMounted(true);
  }, [location.search]);
  
  // Update URL when filters change
  useEffect(() => {
    if (!isMounted) return;
    
    const params = new URLSearchParams();
    if (filterStatus !== 'all') params.set('filter', filterStatus);
    if (searchQuery) params.set('search', searchQuery);
    if (showMyAnnotations) params.set('mine', 'true');
    
    const newUrl = params.toString() ? `?${params.toString()}` : '';
    navigate(`/discussions${newUrl}`, { replace: true });
  }, [filterStatus, searchQuery, showMyAnnotations, navigate, isMounted]);
  
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
    if (filterStatus === 'completed') {
      filtered = getDiscussionsByStatus('completed');
    } else if (filterStatus === 'unlocked') {
      filtered = getDiscussionsByStatus('unlocked');
    } else if (filterStatus === 'locked') {
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
    if (showMyAnnotations && user) {
      filtered = filtered.filter(discussion => {
        const userAnnotationStatus = getUserAnnotationStatus(discussion.id, user.id);
        return userAnnotationStatus.task1 || userAnnotationStatus.task2 || userAnnotationStatus.task3;
      });
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
  }, [discussions, isAuthenticated, navigate, getUserAnnotationStatus, user, filterStatus, searchQuery, showMyAnnotations, getDiscussionsByStatus]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // URL update will happen via useEffect
  };

  const startTask = (discussionId: string, taskNumber: number) => {
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
    
    // For annotators, check if they've already annotated
    const userAnnotationStatus = getUserAnnotationStatus(discussionId, user.id);
    const hasAnnotated = taskNumber === 1 ? userAnnotationStatus.task1 : 
                        taskNumber === 2 ? userAnnotationStatus.task2 : 
                        userAnnotationStatus.task3;
    
    if (hasAnnotated) {
      toast.info("You've already annotated this task. You can view or edit your annotation.");
    }
    
    navigate(`/dashboard?discussionId=${discussionId}&task=${taskNumber}`);
  };

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
    const isEnabled = task.status === 'unlocked' || task.status === 'completed' || isPodLead;
    const requiredAnnotators = taskNumber === 3 ? 5 : 3;
    
    let text = '';
    if (isPodLead && task.status === 'completed') {
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
          
          <div className="flex flex-col md:flex-row gap-2 w-full md:w-auto">
            <form onSubmit={handleSearchSubmit} className="flex gap-2 w-full md:w-auto">
              <div className="relative flex-grow">
                <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  type="text"
                  placeholder="Search discussions..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-8 w-full"
                />
              </div>
              <Button type="submit" variant="outline">Search</Button>
            </form>
            
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Discussions</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
                <SelectItem value="unlocked">In Progress</SelectItem>
                <SelectItem value="locked">Not Started</SelectItem>
              </SelectContent>
            </Select>
            
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className="min-w-[100px]">
                  <Filter className="h-4 w-4 mr-2" />
                  Filter
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[200px] p-4">
                <div className="space-y-4">
                  <div className="flex items-center space-x-2">
                    <Checkbox 
                      id="my-annotations" 
                      checked={showMyAnnotations} 
                      onCheckedChange={(checked) => setShowMyAnnotations(checked === true)}
                    />
                    <Label htmlFor="my-annotations">My Annotations Only</Label>
                  </div>
                </div>
              </PopoverContent>
            </Popover>
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
        ) : filteredDiscussions.length === 0 ? (
          <div className="text-center py-12">
            <h3 className="text-xl font-medium text-gray-600 mb-2">No discussions found</h3>
            <p className="text-gray-500 mb-6">Try adjusting your search or filter criteria</p>
            <Button 
              variant="outline" 
              onClick={() => {
                setSearchQuery('');
                setFilterStatus('all');
                setShowMyAnnotations(false);
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
                      <span className="text-sm text-gray-500">Created: {discussion.createdAt}</span>
                      <Button 
                        size="icon" 
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
                  <div className="text-sm text-gray-600 mb-4 truncate">
                    <span className="font-medium">URL:</span> {discussion.url}
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
                      <Button 
                        onClick={() => startTask(discussion.id, 1)}
                        disabled={!getTaskButtonState(discussion, 1).isEnabled}
                        className="w-full text-xs h-8"
                        variant={discussion.tasks.task1.status === 'completed' ? "outline" : "default"}
                      >
                        {getTaskButtonState(discussion, 1).text}
                      </Button>
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
                      <Button 
                        onClick={() => startTask(discussion.id, 2)}
                        disabled={!getTaskButtonState(discussion, 2).isEnabled}
                        className="w-full text-xs h-8"
                        variant={discussion.tasks.task2.status === 'completed' ? "outline" : "default"}
                      >
                        {getTaskButtonState(discussion, 2).text}
                      </Button>
                    </div>
                    
                    {/* Task 3 */}
                    <div className="border rounded-md p-4">
                      <div className="flex justify-between items-center mb-2">
                        <h3 className="font-medium">Task 3: Rewriting</h3>
                        <span className={`text-xs px-2 py-1 rounded-full ${getTaskStatusClass(discussion.tasks.task3.status, discussion.tasks.task3.userAnnotated)}`}>
                          {discussion.tasks.task3.userAnnotated ? 'Annotated' : discussion.tasks.task3.status}
                        </span>
                      </div>
                      <p className="text-xs text-gray-500 mb-4">
                        Rewrite question & answer, classify, provide supporting docs.
                      </p>
                      <Button 
                        onClick={() => startTask(discussion.id, 3)}
                        disabled={!getTaskButtonState(discussion, 3).isEnabled}
                        className="w-full text-xs h-8"
                        variant={discussion.tasks.task3.status === 'completed' ? "outline" : "default"}
                      >
                        {getTaskButtonState(discussion, 3).text}
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default Discussions;
