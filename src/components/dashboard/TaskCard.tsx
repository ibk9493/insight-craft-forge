
import React, { useState } from 'react';
import { ChevronDown, ChevronRight, CheckCircle, AlertCircle, HelpCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Textarea } from '@/components/ui/textarea';

export type SubTaskStatus = 'pending' | 'completed' | 'failed' | 'na';

export interface SubTask {
  id: string;
  title: string;
  status: SubTaskStatus;
  options?: string[];
  selectedOption?: string;
  description?: string;
  textInput?: boolean;
  textValue?: string;
  requiresRemarks?: boolean; // New field to indicate if remarks are required
}

interface TaskCardProps {
  title: string;
  description: string;
  subTasks: SubTask[];
  status: 'pending' | 'inProgress' | 'completed';
  onSubTaskChange: (taskId: string, selectedOption?: string, textValue?: string) => void;
  active?: boolean;
}

const TaskCard: React.FC<TaskCardProps> = ({
  title,
  description,
  subTasks,
  status,
  onSubTaskChange,
  active = false
}) => {
  const [expanded, setExpanded] = useState(active);

  const getStatusIcon = (status: SubTask['status']) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="h-5 w-5 text-dashboard-green" />;
      case 'failed':
        return <AlertCircle className="h-5 w-5 text-dashboard-red" />;
      case 'na':
        return <HelpCircle className="h-5 w-5 text-dashboard-gray" />;
      default:
        return <div className="h-5 w-5 rounded-full border-2 border-gray-300"></div>;
    }
  };

  const getStatusColor = (status: 'pending' | 'inProgress' | 'completed') => {
    switch (status) {
      case 'completed':
        return 'bg-green-100 border-green-200';
      case 'inProgress':
        return 'bg-blue-50 border-blue-200';
      default:
        return 'bg-gray-50 border-gray-200';
    }
  };

  return (
    <div className={cn(
      'border rounded-lg overflow-hidden transition-all duration-300 mb-4',
      getStatusColor(status),
      active && 'ring-2 ring-dashboard-blue'
    )}>
      <div 
        className="flex items-center justify-between p-4 cursor-pointer"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center">
          {expanded ? 
            <ChevronDown className="h-5 w-5 text-gray-500 mr-2" /> : 
            <ChevronRight className="h-5 w-5 text-gray-500 mr-2" />
          }
          <h3 className="font-medium">{title}</h3>
        </div>
        <div className="flex items-center">
          {status === 'completed' && <span className="text-sm text-green-600 mr-2">Completed</span>}
          {status === 'inProgress' && <span className="text-sm text-blue-600 mr-2">In Progress</span>}
        </div>
      </div>
      
      {expanded && (
        <div className="p-4 pt-0 animate-fadeIn">
          <p className="text-gray-600 mb-4 text-sm">{description}</p>
          <div className="space-y-4">
            {subTasks.map((task) => (
              <div key={task.id} className="bg-white border rounded-md p-3">
                <div className="flex items-center mb-2">
                  {getStatusIcon(task.status)}
                  <span className="ml-2 font-medium text-sm">{task.title}</span>
                </div>
                {task.description && (
                  <p className="text-gray-500 text-xs mb-2">{task.description}</p>
                )}
                
                {/* Option buttons */}
                {task.options && task.options.length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-2">
                    {task.options.map((option) => (
                      <button
                        key={option}
                        onClick={() => onSubTaskChange(task.id, option)}
                        className={cn(
                          "text-xs py-1 px-3 rounded-full",
                          task.selectedOption === option
                            ? "bg-dashboard-blue text-white"
                            : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                        )}
                      >
                        {option}
                      </button>
                    ))}
                  </div>
                )}
                
                {/* Text input field - shown for explicit textInput or when a Yes/No option is selected and requiresRemarks is true */}
                {(task.textInput || 
                 (task.requiresRemarks && task.selectedOption && 
                  (task.selectedOption === 'Yes' || task.selectedOption === 'No' || 
                   task.selectedOption === 'True' || task.selectedOption === 'False'))) && (
                  <div className="mt-3">
                    <Textarea
                      value={task.textValue || ''}
                      onChange={(e) => onSubTaskChange(task.id, undefined, e.target.value)}
                      placeholder={`Enter ${task.textInput ? task.title.toLowerCase() : 'remarks'}`}
                      className="min-h-[100px] text-sm"
                    />
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default TaskCard;
