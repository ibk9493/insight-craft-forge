
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Header from '@/components/layout/Header';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Search, Github, ArrowRight } from 'lucide-react';
import { toast } from 'sonner';
import { useUser } from '@/contexts/UserContext';
import { useAnnotationData } from '@/hooks/useAnnotationData';

// Sample discussion data type
interface Discussion {
  id: string;
  title: string;
  url: string;
  repository: string;
  createdAt: string;
  tasks: {
    task1: {
      status: 'locked' | 'unlocked' | 'completed';
      annotators: number;
      userAnnotated?: boolean;
    };
    task2: {
      status: 'locked' | 'unlocked' | 'completed';
      annotators: number;
      userAnnotated?: boolean;
    };
    task3: {
      status: 'locked' | 'unlocked' | 'completed';
      annotators: number;
      userAnnotated?: boolean;
    };
  };
}

const Discussions = () => {
  const { isAuthenticated, user, isPodLead } = useUser();
  const navigate = useNavigate();
  const { discussions, getUserAnnotationStatus, getDiscussionsByStatus } = useAnnotationData();
  const [searchQuery, setSearchQuery] = useState('');
  const [filteredDiscussions, setFilteredDiscussions] = useState<Discussion[]>([]);
  
  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/');
      return;
    }
    
    // Update discussions with user annotation status
    if (discussions && user) {
      const updatedDiscussions = discussions.map(discussion => {
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
        };
      });
      
      setFilteredDiscussions(updatedDiscussions);
    }
  }, [discussions, isAuthenticated, navigate, getUserAnnotationStatus, user]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (searchQuery) {
      const filtered = discussions.filter(
        discussion => discussion.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
                      discussion.repository.toLowerCase().includes(searchQuery.toLowerCase())
      );
      setFilteredDiscussions(filtered);
    } else {
      setFilteredDiscussions(discussions);
    }
  };

  const startTask = (discussionId: string, taskNumber: number) => {
    // Check if user has already annotated this task
    const discussion = discussions.find(d => d.id === discussionId);
    if (!discussion) return;
    
    // For pod leads, they can always view the results
    if (isPodLead) {
      navigate(`/dashboard?discussionId=${discussionId}&task=${taskNumber}`);
      return;
    }
    
    // For annotators, check if they've already annotated
    const userAnnotationStatus = getUserAnnotationStatus(discussionId, user!.id);
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

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <Header />
      
      <div className="container max-w-6xl mx-auto px-4 py-6 flex-grow">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold">GitHub Discussions</h1>
          
          <form onSubmit={handleSearch} className="flex gap-2">
            <div className="relative">
              <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                type="text"
                placeholder="Search discussions..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8 w-64"
              />
            </div>
            <Button type="submit" variant="outline">Search</Button>
          </form>
        </div>
        
        <div className="grid gap-6">
          {filteredDiscussions.map((discussion) => (
            <Card key={discussion.id} className="overflow-hidden">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-lg">{discussion.title}</CardTitle>
                    <CardDescription className="flex items-center gap-1">
                      <Github className="h-3 w-3" />
                      {discussion.repository}
                    </CardDescription>
                  </div>
                  <span className="text-sm text-gray-500">Created: {discussion.createdAt}</span>
                </div>
              </CardHeader>
              
              <CardContent>
                <div className="text-sm text-gray-600 mb-4">
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
      </div>
    </div>
  );
};

export default Discussions;
