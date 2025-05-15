
import React from 'react';
import { Lock, CheckCircle, AlertCircle, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { cn } from '@/lib/utils';

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
      {tasks.map((task) => (
        <Card 
          key={task.id}
          className={cn(
            "transition-all duration-300",
            task.status === 'locked' ? "opacity-70" : "",
            task.status === 'completed' ? "border-green-500" : ""
          )}
        >
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg">Task {task.id}</CardTitle>
              {task.status === 'locked' && <Lock className="h-5 w-5 text-gray-400" />}
              {task.status === 'completed' && <CheckCircle className="h-5 w-5 text-green-500" />}
            </div>
            <CardDescription>{task.title}</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-gray-600">{task.description}</p>
            
            <div className="mt-4 flex items-center text-sm text-gray-500">
              <Users className="h-4 w-4 mr-1" />
              <span>
                {task.currentAnnotators}/{task.requiredAnnotators} annotators
              </span>
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
      ))}
    </div>
  );
};

export default TaskGrid;
