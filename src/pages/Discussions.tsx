
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Header from '@/components/layout/Header';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Search, Github, ArrowRight } from 'lucide-react';
import { toast } from 'sonner';

// Sample discussion data - would be replaced with actual JSON data
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
    };
    task2: {
      status: 'locked' | 'unlocked' | 'completed';
      annotators: number;
    };
    task3: {
      status: 'locked' | 'unlocked' | 'completed';
      annotators: number;
    };
  };
}

const sampleDiscussions: Discussion[] = [
  {
    id: '1',
    title: 'How to implement feature X?',
    url: 'https://github.com/org/repo/discussions/123',
    repository: 'org/repo',
    createdAt: '2025-05-01',
    tasks: {
      task1: { status: 'unlocked', annotators: 1 },
      task2: { status: 'locked', annotators: 0 },
      task3: { status: 'locked', annotators: 0 }
    }
  },
  {
    id: '2',
    title: 'Bug in module Y',
    url: 'https://github.com/org/repo/discussions/456',
    repository: 'org/repo',
    createdAt: '2025-05-05',
    tasks: {
      task1: { status: 'completed', annotators: 3 },
      task2: { status: 'unlocked', annotators: 1 },
      task3: { status: 'locked', annotators: 0 }
    }
  },
  {
    id: '3',
    title: 'Documentation update for Z',
    url: 'https://github.com/org/repo/discussions/789',
    repository: 'org/repo',
    createdAt: '2025-05-10',
    tasks: {
      task1: { status: 'completed', annotators: 3 },
      task2: { status: 'completed', annotators: 3 },
      task3: { status: 'unlocked', annotators: 2 }
    }
  }
];

const Discussions = () => {
  const [discussions, setDiscussions] = useState<Discussion[]>(sampleDiscussions);
  const [searchQuery, setSearchQuery] = useState('');
  const navigate = useNavigate();

  // Check if user is logged in
  useEffect(() => {
    const user = localStorage.getItem('user');
    if (!user) {
      navigate('/');
    }
  }, [navigate]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    // Filter discussions based on search query
    // This is a simplified implementation
    if (searchQuery) {
      const filtered = sampleDiscussions.filter(
        discussion => discussion.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
                      discussion.repository.toLowerCase().includes(searchQuery.toLowerCase())
      );
      setDiscussions(filtered);
    } else {
      setDiscussions(sampleDiscussions);
    }
  };

  const startTask = (discussionId: string, taskNumber: number) => {
    navigate(`/dashboard?discussionId=${discussionId}&task=${taskNumber}`);
  };

  const getTaskStatusClass = (status: 'locked' | 'unlocked' | 'completed') => {
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
                
    const isEnabled = task.status === 'unlocked' || task.status === 'completed';
    const requiredAnnotators = taskNumber === 3 ? 5 : 3;
    const text = task.status === 'completed' 
      ? `View Results (${task.annotators}/${requiredAnnotators})` 
      : task.status === 'unlocked' 
        ? `Start Task (${task.annotators}/${requiredAnnotators})` 
        : `Locked (${task.annotators}/${requiredAnnotators})`;
        
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
          {discussions.map((discussion) => (
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
                      <span className={`text-xs px-2 py-1 rounded-full ${getTaskStatusClass(discussion.tasks.task1.status)}`}>
                        {discussion.tasks.task1.status}
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
                      <span className={`text-xs px-2 py-1 rounded-full ${getTaskStatusClass(discussion.tasks.task2.status)}`}>
                        {discussion.tasks.task2.status}
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
                      <span className={`text-xs px-2 py-1 rounded-full ${getTaskStatusClass(discussion.tasks.task3.status)}`}>
                        {discussion.tasks.task3.status}
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
