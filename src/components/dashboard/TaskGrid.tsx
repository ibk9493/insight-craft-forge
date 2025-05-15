
import React from 'react';
import { Lock, CheckCircle, Users } from 'lucide-react';
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
}

const TaskGrid: React.FC<TaskGridProps> = ({ tasks, onSelectTask }) => {
  return (
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
  );
};

export default TaskGrid;
