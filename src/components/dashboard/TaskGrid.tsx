
import React from 'react';
import { Lock, CheckCircle, Users, Code, Tag, Calendar, Eye } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';

interface TaskGridProps {
  tasks: {
    id: number;
    title: string;
    description: string;
    status: 'locked' | 'unlocked' | 'completed';
    requiredAnnotators: number;
    currentAnnotators: number;
  }[];
  onSelectTask: (taskId: number) => void;
  githubUrl?: string;
  repositoryLanguage?: string;
  releaseTag?: string;
  releaseDate?: string;
  onViewDetails?: () => void;
}

const TaskGrid: React.FC<TaskGridProps> = ({ 
  tasks, 
  onSelectTask, 
  githubUrl,
  repositoryLanguage,
  releaseTag,
  releaseDate,
  onViewDetails
}) => {




  return (
    <div className="space-y-6">
      {/* Display GitHub URL if provided */}
      {githubUrl && (
        <div className="bg-white p-4 rounded-md shadow mb-6">
          <div className="flex justify-between items-start mb-2">
            <h3 className="text-sm font-medium text-gray-600">GitHub Discussion URL:</h3>
            {onViewDetails && (
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={onViewDetails} 
                className="text-dashboard-blue hover:text-dashboard-blue/80 -mt-1"
              >
                <Eye className="h-4 w-4 mr-1" />
                View Details
              </Button>
            )}
          </div>
          <a 
            href={githubUrl} 
            target="_blank" 
            rel="noopener noreferrer"
            className="text-dashboard-blue hover:underline break-all"
          >
            {githubUrl}
          </a>
          
          {/* Display repository metadata */}
          <div className="mt-3 flex flex-wrap gap-3">
            {repositoryLanguage && (
              <div className="flex items-center text-xs bg-blue-50 text-blue-700 px-2 py-1 rounded-md">
                <Code className="w-3 h-3 mr-1" />
                <span>Language: {repositoryLanguage}</span>
              </div>
            )}
            
            {releaseTag && (
              <div className="flex items-center text-xs bg-purple-50 text-purple-700 px-2 py-1 rounded-md">
                <Tag className="w-3 h-3 mr-1" />
                <span>Release: {releaseTag}</span>
              </div>
            )}
            
            {releaseDate && (
              <div className="flex items-center text-xs bg-green-50 text-green-700 px-2 py-1 rounded-md">
                <Calendar className="w-3 h-3 mr-1" />
                <span>Date: {new Date(releaseDate).toLocaleDateString()}</span>
              </div>
            )}
          </div>
          
          <p className="text-gray-600 text-sm mt-4">
            Task 1 requires 3 annotators, Task 2 requires 3 annotators, Task 3 requires 5 annotators.
          </p>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {tasks.map((task) => {
          // Calculate progress percentage
          const progressPercentage = Math.min(
            Math.floor((task.currentAnnotators / task.requiredAnnotators) * 100),
            100
          );
          
          return (
            <Card 
              key={task.id}
              className={cn(
                "transition-all duration-300",
                task.status === 'locked' ? "opacity-70" : "",
                task.status === 'completed' ? "border-green-500" : "",
                "hover:shadow-md"
              )}
            >
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <CardTitle className="text-lg">Task {task.id}</CardTitle>
                    <Badge 
                      variant="outline" 
                      className={cn(
                        task.status === 'completed' ? "bg-green-100 text-green-800 hover:bg-green-100" : 
                        task.status === 'unlocked' ? "bg-blue-100 text-blue-800 hover:bg-blue-100" : 
                        "bg-gray-100 text-gray-800 hover:bg-gray-100"
                      )}
                    >
                      {task.status === 'completed' ? 'Completed' : 
                       task.status === 'unlocked' ? 'Unlocked' : 'Locked'}
                    </Badge>
                  </div>
                  {task.status === 'locked' && <Lock className="h-5 w-5 text-gray-400" />}
                  {task.status === 'completed' && <CheckCircle className="h-5 w-5 text-green-500" />}
                </div>
                <CardDescription>{task.title}</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-gray-600">{task.description}</p>
                
                {/* Progress bar */}
                <div className="mt-4">
                  <div className="w-full bg-gray-200 rounded-full h-2.5">
                    <div 
                      className={cn(
                        "h-2.5 rounded-full",
                        task.status === 'completed' ? "bg-green-500" : 
                        task.status === 'unlocked' ? "bg-blue-500" : 
                        "bg-gray-400"
                      )} 
                      style={{width: `${progressPercentage}%`}}
                    ></div>
                  </div>
                </div>
                
                <div className="mt-2 flex items-center justify-between text-sm text-gray-500">
                  <div className="flex items-center">
                    <Users className="h-4 w-4 mr-1" />
                    <span>
                      {task.currentAnnotators}/{task.requiredAnnotators} annotators
                    </span>
                  </div>
                  <span>{progressPercentage}% complete</span>
                </div>
              </CardContent>
              <CardFooter>
                <Button 
                  onClick={() => onSelectTask(task.id)} 
                  disabled={task.status === 'locked'}
                  className="w-full"
                  variant={task.status === 'completed' ? "outline" : "default"}
                >
                  {task.status === 'locked' && "Locked"}
                  {task.status === 'unlocked' && "Start Task"}
                  {task.status === 'completed' && "View Results"}
                </Button>
              </CardFooter>
            </Card>
          );
        })}
      </div>
    </div>
  );
};

export default TaskGrid;
