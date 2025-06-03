
import React from 'react';
import { Lock, CheckCircle, Users, Code, Tag, Calendar, Eye } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { parseTaskStatus } from '@/services/api';

interface TaskGridProps {
  tasks: {
    id: number;
    title: string;
    description: string;
    status: 'locked' | 'unlocked' | 'completed' | 'rework' | 'blocked' | 'ready_for_next' | 'ready_for_consensus' | 'consensus_created' | 'general' | 'flagged';
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
                parseTaskStatus(task.status).status === 'locked' ? "opacity-70" : "",
                parseTaskStatus(task.status).status === 'completed' ? "border-green-500" : "",
                parseTaskStatus(task.status).status === 'rework' ? "border-orange-500" : "",
                parseTaskStatus(task.status).status === 'blocked' ? "border-red-500" : "",
                parseTaskStatus(task.status).status === 'flagged' ? "border-yellow-500" : "",
                parseTaskStatus(task.status).status === 'ready_for_consensus' ? "border-amber-500" : "",
                parseTaskStatus(task.status).status === 'consensus_created' ? "border-indigo-500" : "",
                parseTaskStatus(task.status).status === 'ready_for_next' ? "border-purple-500" : "",
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
                        parseTaskStatus(task.status).status === 'completed' ? "bg-green-100 text-green-800 hover:bg-green-100" : 
                        parseTaskStatus(task.status).status === 'unlocked' ? "bg-blue-100 text-blue-800 hover:bg-blue-100" : 
                        parseTaskStatus(task.status).status === 'rework' ? "bg-orange-100 text-orange-800 hover:bg-orange-100" :
                        parseTaskStatus(task.status).status === 'blocked' ? "bg-red-100 text-red-800 hover:bg-red-100" :
                        parseTaskStatus(task.status).status === 'flagged' ? "bg-yellow-100 text-yellow-800 hover:bg-yellow-100" :
                        parseTaskStatus(task.status).status === 'ready_for_consensus' ? "bg-amber-100 text-amber-800 hover:bg-amber-100" :
                        parseTaskStatus(task.status).status === 'consensus_created' ? "bg-indigo-100 text-indigo-800 hover:bg-indigo-100" :
                        parseTaskStatus(task.status).status === 'ready_for_next' ? "bg-purple-100 text-purple-800 hover:bg-purple-100" :
                        "bg-gray-100 text-gray-800 hover:bg-gray-100"
                      )}
                    >
                      {parseTaskStatus(task.status).status === 'completed' ? 'Completed' : 
                       parseTaskStatus(task.status).status === 'unlocked' ? 'Unlocked' : 
                       parseTaskStatus(task.status).status === 'rework' ? 'Needs Rework' :
                       parseTaskStatus(task.status).status === 'blocked' ? 'Blocked' :
                       parseTaskStatus(task.status).status === 'flagged' ? 'Flagged' :
                       parseTaskStatus(task.status).status === 'ready_for_consensus' ? 'Ready for Consensus' :
                       parseTaskStatus(task.status).status === 'consensus_created' ? 'Consensus Created' :
                       parseTaskStatus(task.status).status === 'ready_for_next' ? 'Ready for Next' :
                       'Locked'}
                    </Badge>
                  </div>
                  {parseTaskStatus(task.status).status === 'locked' && <Lock className="h-5 w-5 text-gray-400" />}
                  {parseTaskStatus(task.status).status === 'completed' && <CheckCircle className="h-5 w-5 text-green-500" />}
                  {parseTaskStatus(task.status).status === 'rework' && <CheckCircle className="h-5 w-5 text-orange-500" />}
                  {parseTaskStatus(task.status).status === 'blocked' && <CheckCircle className="h-5 w-5 text-red-500" />}
                  {parseTaskStatus(task.status).status === 'flagged' && <CheckCircle className="h-5 w-5 text-yellow-500" />}
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
                        parseTaskStatus(task.status).status === 'completed' ? "bg-green-500" : 
                        parseTaskStatus(task.status).status === 'unlocked' ? "bg-blue-500" : 
                        parseTaskStatus(task.status).status === 'rework' ? "bg-orange-500" :
                        parseTaskStatus(task.status).status === 'blocked' ? "bg-red-500" :
                        parseTaskStatus(task.status).status === 'flagged' ? "bg-yellow-500" :
                        parseTaskStatus(task.status).status === 'ready_for_consensus' ? "bg-amber-500" :
                        parseTaskStatus(task.status).status === 'consensus_created' ? "bg-indigo-500" :
                        parseTaskStatus(task.status).status === 'ready_for_next' ? "bg-purple-500" :
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
                  disabled={parseTaskStatus(task.status).status === 'locked'}
                  className="w-full"
                  variant={parseTaskStatus(task.status).status === 'completed' ? "outline" : "default"}
                >
                  {parseTaskStatus(task.status).status === 'locked' && "Locked"}
                  {parseTaskStatus(task.status).status === 'unlocked' && "Start Task"}
                  {parseTaskStatus(task.status).status === 'completed' && "View Results"}
                  {parseTaskStatus(task.status).status === 'rework' && "View Rework"}
                  {parseTaskStatus(task.status).status === 'blocked' && "Contact Admin"}
                  {parseTaskStatus(task.status).status === 'flagged' && "View Flagged"}
                  {parseTaskStatus(task.status).status === 'ready_for_consensus' && "Create Consensus"}
                  {parseTaskStatus(task.status).status === 'consensus_created' && "View Consensus"}
                  {parseTaskStatus(task.status).status === 'ready_for_next' && "Start Next Task"}
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
