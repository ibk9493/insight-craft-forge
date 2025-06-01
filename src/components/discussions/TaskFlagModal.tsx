import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Flag, AlertTriangle, CheckCircle, X } from 'lucide-react';
import { toast } from 'sonner';
import { api } from '@/services/api';

interface TaskFlagModalProps {
  isOpen: boolean;
  onClose: () => void;
  discussionId: string;
  taskId: number;
  taskName: string;
  onFlagSubmitted?: () => void;
}

const FLAG_CATEGORIES = [
  {
    id: 'data_issue',
    label: 'Data Issue',
    description: 'Missing data, broken links, incorrect information',
    color: 'bg-red-100 text-red-800'
  },
  {
    id: 'workflow_issue', 
    label: 'Workflow Issue',
    description: 'Previous task incomplete, unclear dependencies',
    color: 'bg-orange-100 text-orange-800'
  },
  {
    id: 'quality_issue',
    label: 'Quality Issue', 
    description: 'Poor annotations, inconsistent guidelines',
    color: 'bg-yellow-100 text-yellow-800'
  },
  {
    id: 'technical_issue',
    label: 'Technical Issue',
    description: 'System bugs, UI problems, performance issues',
    color: 'bg-blue-100 text-blue-800'
  },
  {
    id: 'unclear_instructions',
    label: 'Unclear Instructions',
    description: 'Confusing guidelines, ambiguous requirements',
    color: 'bg-purple-100 text-purple-800'
  }
];

const TaskFlagModal: React.FC<TaskFlagModalProps> = ({
  isOpen,
  onClose,
  discussionId,
  taskId,
  taskName,
  onFlagSubmitted
}) => {
  const [reason, setReason] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [flaggedTaskId, setFlaggedTaskId] = useState(taskId);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!selectedCategory) {
      toast.error('Please select a flag category');
      return;
    }
    
    if (!reason.trim() || reason.trim().length < 10) {
      toast.error('Please provide a detailed reason (minimum 10 characters)');
      return;
    }

    setIsSubmitting(true);
    
    try {
      const result = await api.taskFlags.flagTask(
        discussionId,
        flaggedTaskId,
        reason.trim(),
        selectedCategory,
        taskId
      );

      if (!result.success) {
        throw new Error(result.message || 'Failed to flag task');
      }
      
      const successMessage = flaggedTaskId !== taskId 
        ? `Task ${flaggedTaskId} flagged successfully (flagged from Task ${taskId})`
        : `Task ${flaggedTaskId} flagged successfully`;
      
      toast.success(successMessage);
      
      setReason('');
      setSelectedCategory('');
      setFlaggedTaskId(taskId);
      
      onFlagSubmitted?.();
      onClose();
      
    } catch (error) {
      console.error('Error flagging task:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to flag task');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    if (!isSubmitting) {
      setReason('');
      setSelectedCategory('');
      setFlaggedTaskId(taskId);
      onClose();
    }
  };

  const selectedCategoryConfig = FLAG_CATEGORIES.find(cat => cat.id === selectedCategory);

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Flag className="h-5 w-5 text-orange-500" />
            Flag {taskName}
          </DialogTitle>
          <DialogDescription>
            Report an issue with this task that prevents proper completion.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Task Selection - Show only if current task > 1 */}
          {taskId > 1 && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Which Task Has The Problem? *
              </label>
              <div className="flex gap-2 flex-wrap">
                {Array.from({ length: taskId }, (_, i) => i + 1).map((task) => (
                  <div
                    key={task}
                    className={`flex-1 min-w-0 p-2 border rounded-lg cursor-pointer transition-colors ${
                      flaggedTaskId === task
                        ? 'border-red-300 bg-red-50'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                    onClick={() => setFlaggedTaskId(task)}
                  >
                    <div className="flex items-center gap-1">
                      <span className="font-medium text-sm">Task {task}</span>
                      {flaggedTaskId === task && <CheckCircle className="h-3 w-3 text-red-500" />}
                    </div>
                    <p className="text-xs text-gray-600 truncate">
                      {task === 1 ? 'Question Quality' :
                       task === 2 ? 'Answer Quality' :
                       task === 3 ? 'Rewrite' : ''}
                    </p>
                  </div>
                ))}
              </div>
              
              {flaggedTaskId !== taskId && (
                <div className="mt-2 p-2 bg-amber-50 border border-amber-200 rounded text-xs text-amber-800">
                  <strong>Upstream Flag:</strong> Task {flaggedTaskId} will be flagged (discovered while on Task {taskId})
                </div>
              )}
            </div>
          )}

          {/* Category Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Issue Category *
            </label>
            <div className="grid grid-cols-2 gap-2">
              {FLAG_CATEGORIES.map((category) => (
                <div
                  key={category.id}
                  className={`p-2 border rounded-lg cursor-pointer transition-colors ${
                    selectedCategory === category.id
                      ? 'border-orange-300 bg-orange-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                  onClick={() => setSelectedCategory(category.id)}
                >
                  <div className="flex items-center gap-1">
                    <Badge className={`${category.color} text-xs`}>
                      {category.label}
                    </Badge>
                    {selectedCategory === category.id && (
                      <CheckCircle className="h-3 w-3 text-orange-500" />
                    )}
                  </div>
                  <p className="text-xs text-gray-600 mt-1 line-clamp-2">
                    {category.description}
                  </p>
                </div>
              ))}
            </div>
          </div>

          {/* Reason Text Area */}
          <div>
            <label htmlFor="flagReason" className="block text-sm font-medium text-gray-700 mb-1">
              Detailed Reason *
            </label>
            <Textarea
              id="flagReason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder={
                flaggedTaskId !== taskId 
                  ? `Why Task ${flaggedTaskId} has issues (discovered on Task ${taskId})...`
                  : "Describe the specific issue you encountered..."
              }
              rows={3}
              className={`${reason.length < 10 && reason.length > 0 ? 'border-red-300' : ''}`}
            />
            <div className="flex justify-between items-center mt-1">
              <span className={`text-xs ${reason.length < 10 ? 'text-red-500' : 'text-gray-500'}`}>
                {reason.length}/10 minimum
              </span>
              {selectedCategoryConfig && (
                <Badge className={`${selectedCategoryConfig.color} text-xs`}>
                  {selectedCategoryConfig.label}
                </Badge>
              )}
            </div>
          </div>

          {/* Compact Warning Notice */}
          <div className="p-2 bg-amber-50 border border-amber-200 rounded text-xs text-amber-800">
            <div className="flex items-start gap-1">
              <AlertTriangle className="h-3 w-3 mt-0.5 flex-shrink-0" />
              <div>
                <strong>Important:</strong> Task {flaggedTaskId} will be marked for rework
                {flaggedTaskId !== taskId && <span> (may block workflow)</span>}
              </div>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex justify-end gap-3 pt-4">
          <Button 
            variant="outline" 
            onClick={handleClose}
            disabled={isSubmitting}
          >
            Cancel
          </Button>
          <Button 
            onClick={handleSubmit}
            disabled={!selectedCategory || reason.length < 10 || isSubmitting}
            className="bg-orange-600 hover:bg-orange-700"
          >
            {isSubmitting ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                Flagging...
              </>
            ) : (
              <>
                <Flag className="h-4 w-4 mr-2" />
                Flag Task {flaggedTaskId}
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default TaskFlagModal;