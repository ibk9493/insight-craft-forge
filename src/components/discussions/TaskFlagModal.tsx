import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Flag, AlertTriangle, CheckCircle, ArrowLeft, Users, FileX } from 'lucide-react';
import { toast } from 'sonner';
import { api } from '@/services/api';

interface TaskFlagModalProps {
  isOpen: boolean;
  onClose: () => void;
  discussionId: string;
  taskId: number;
  taskName: string;
  onFlagSubmitted?: () => void;
  userRole?: 'annotator' | 'pod_lead' | 'admin';
}

const FLAG_CATEGORIES = [
  {
    id: 'workflow_misrouting',
    label: 'Wrong Task Stage',
    description: 'This discussion should have stopped at an earlier task or belongs in a different stage',
    color: 'bg-purple-100 text-purple-800',
    icon: ArrowLeft,
    allowedRoles: ['annotator', 'pod_lead', 'admin'],
    upstreamFlag: true
  },
  {
    id: 'quality_issue',
    label: 'Quality Issue', 
    description: 'Poor annotations, inconsistent guidelines, quality standards not met',
    color: 'bg-yellow-100 text-yellow-800',
    icon: FileX,
    allowedRoles: ['pod_lead', 'admin'],
    upstreamFlag: false
  },
  {
    id: 'consensus_mismatch',
    label: 'Consensus Problem',
    description: 'Consensus doesn\'t reflect annotations or has errors',
    color: 'bg-orange-100 text-orange-800',
    icon: Users,
    allowedRoles: ['annotator', 'pod_lead', 'admin'],
    upstreamFlag: false
  },
  {
    id: 'data_error',
    label: 'Data Error',
    description: 'Invalid source data, corrupted content, or incorrect discussion parameters',
    color: 'bg-red-100 text-red-800',
    icon: AlertTriangle,
    allowedRoles: ['annotator', 'pod_lead', 'admin'],
    upstreamFlag: true
  },
  ,
  {
    id: 'general',
    label: 'Other Issue',
    description: 'General issue that doesn\'t fit other categories',
    color: 'bg-gray-100 text-gray-800',
    icon: Flag,
    allowedRoles: ['annotator', 'pod_lead', 'admin'],
    upstreamFlag: false
  }
];

const WORKFLOW_SCENARIOS = [
  {
    id: 'stop_at_task1',
    label: 'Should have stopped at Task 1',
    description: 'Question quality issues mean this shouldn\'t proceed further',
    targetTask: 1
  },
  {
    id: 'stop_at_task2', 
    label: 'Should have stopped at Task 2',
    description: 'Answer quality issues mean this shouldn\'t reach Task 3',
    targetTask: 2
  },
  {
    id: 'skip_to_task3',
    label: 'Should skip directly to Task 3',
    description: 'Tasks 1-2 are perfect, no need for extra review',
    targetTask: 3
  }
];

const TaskFlagModal: React.FC<TaskFlagModalProps> = ({
  isOpen,
  onClose,
  discussionId,
  taskId,
  taskName,
  onFlagSubmitted,
  userRole = 'annotator'
}) => {
  const [reason, setReason] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [flaggedTaskId, setFlaggedTaskId] = useState(taskId);
  const [workflowScenario, setWorkflowScenario] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Filter categories based on user role
  const availableCategories = FLAG_CATEGORIES.filter(cat => 
    cat.allowedRoles.includes(userRole)
  );

  const handleSubmit = async () => {
    if (!selectedCategory) {
      toast.error('Please select a flag category');
      return;
    }
    
    if (!reason.trim() || reason.trim().length < 15) {
      toast.error('Please provide a detailed reason (minimum 15 characters)');
      return;
    }

    // Special validation for workflow misrouting
    if (selectedCategory === 'workflow_misrouting' && !workflowScenario) {
      toast.error('Please select a workflow scenario');
      return;
    }

    setIsSubmitting(true);
    
    try {
      // Updated API call structure
      // Use the existing taskFlags.flagTask method
        const result = await api.taskFlags.flagTask(discussionId, flaggedTaskId, {
          reason: reason.trim(),
          category: selectedCategory,
          flagged_from_task: taskId,
          workflow_scenario: workflowScenario || undefined,
          flagged_by_role: userRole
        });

      if (!result.success) {
        throw new Error(result.message || 'Failed to flag task');
      }
      
      const successMessage = flaggedTaskId !== taskId 
        ? `Task ${flaggedTaskId} flagged successfully (flagged from Task ${taskId})`
        : `Task ${flaggedTaskId} flagged successfully`;
      
      toast.success(successMessage);
      
      // Reset form
      setReason('');
      setSelectedCategory('');
      setFlaggedTaskId(taskId);
      setWorkflowScenario('');
      
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
      setWorkflowScenario('');
      onClose();
    }
  };

  const selectedCategoryConfig = availableCategories.find(cat => cat.id === selectedCategory);
  const isWorkflowIssue = selectedCategory === 'workflow_misrouting';

  const getReasonPlaceholder = (): string => {
    if (isWorkflowIssue && workflowScenario) {
      const scenario = WORKFLOW_SCENARIOS.find(s => s.id === workflowScenario);
      return `Explain why this discussion ${scenario?.label.toLowerCase()}. What specific issues did you identify?`;
    }
    
    if (selectedCategory === 'quality_issue') {
      return 'Describe the specific quality issues: inconsistent annotations, guideline violations, etc.';
    }
    
    if (selectedCategory === 'consensus_mismatch') {
      return 'Explain how the consensus differs from the annotations or what errors you found...';
    }
    
    if (selectedCategory === 'data_error') {
      return 'Describe the data error: corrupted content, wrong parameters, invalid source, etc.';
    }
    
    return 'Provide a detailed explanation of the issue you encountered...';
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Flag className="h-5 w-5 text-orange-500" />
            Flag {taskName}
            <Badge variant="outline" className="ml-2">
              {userRole === 'pod_lead' ? 'Pod Lead' : userRole === 'admin' ? 'Admin' : 'Annotator'}
            </Badge>
          </DialogTitle>
          <DialogDescription>
            Report an issue that prevents proper task completion or workflow progression.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Issue Category Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-3">
              Issue Category *
            </label>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {availableCategories.map((category) => {
                const IconComponent = category.icon;
                return (
                  <div
                    key={category.id}
                    className={`p-4 border rounded-lg cursor-pointer transition-all ${
                      selectedCategory === category.id
                        ? 'border-orange-300 bg-orange-50 shadow-sm'
                        : 'border-gray-200 hover:border-gray-300 hover:shadow-sm'
                    }`}
                    onClick={() => {
                      setSelectedCategory(category.id);
                      // Reset workflow scenario when changing categories
                      if (category.id !== 'workflow_misrouting') {
                        setWorkflowScenario('');
                      }
                    }}
                  >
                    <div className="flex items-start gap-3">
                      <IconComponent className="h-5 w-5 text-gray-600 mt-0.5" />
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-medium text-sm">{category.label}</span>
                          {selectedCategory === category.id && (
                            <CheckCircle className="h-4 w-4 text-orange-500" />
                          )}
                        </div>
                        <p className="text-xs text-gray-600 leading-relaxed">
                          {category.description}
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Workflow Scenario Selection (only for workflow_misrouting) */}
          {isWorkflowIssue && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-3">
                Workflow Issue Type *
              </label>
              <div className="space-y-2">
                {WORKFLOW_SCENARIOS.map((scenario) => (
                  <div
                    key={scenario.id}
                    className={`p-3 border rounded-lg cursor-pointer transition-colors ${
                      workflowScenario === scenario.id
                        ? 'border-purple-300 bg-purple-50'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                    onClick={() => {
                      setWorkflowScenario(scenario.id);
                      setFlaggedTaskId(scenario.targetTask);
                    }}
                  >
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm">{scenario.label}</span>
                      {workflowScenario === scenario.id && (
                        <CheckCircle className="h-4 w-4 text-purple-500" />
                      )}
                    </div>
                    <p className="text-xs text-gray-600 mt-1">{scenario.description}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Task Selection - Show for all non-workflow categories when taskId > 1 */}
          {(taskId > 1 && !isWorkflowIssue) && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Which Task Has The Problem? *
              </label>
              <div className="flex gap-2 flex-wrap">
                {Array.from({ length: taskId }, (_, i) => i + 1).map((task) => (
                  <div
                    key={task}
                    className={`flex-1 min-w-0 p-3 border rounded-lg cursor-pointer transition-colors ${
                      flaggedTaskId === task
                        ? 'border-red-300 bg-red-50'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                    onClick={() => setFlaggedTaskId(task)}
                  >
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm">Task {task}</span>
                      {flaggedTaskId === task && <CheckCircle className="h-4 w-4 text-red-500" />}
                    </div>
                    <p className="text-xs text-gray-600 mt-1">
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

          {/* Detailed Reason */}
          <div>
            <label htmlFor="flagReason" className="block text-sm font-medium text-gray-700 mb-2">
              Detailed Explanation *
            </label>
            <Textarea
              id="flagReason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder={getReasonPlaceholder()}
              rows={4}
              className={`${reason.length < 15 && reason.length > 0 ? 'border-red-300' : ''}`}
            />
            <div className="flex justify-between items-center mt-2">
              <span className={`text-xs ${reason.length < 15 ? 'text-red-500' : 'text-gray-500'}`}>
                {reason.length}/15 minimum
              </span>
              {selectedCategoryConfig && (
                <Badge className={`${selectedCategoryConfig.color} text-xs`}>
                  {selectedCategoryConfig.label}
                </Badge>
              )}
            </div>
          </div>

          {/* Impact Warning */}
          <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
            <div className="flex items-start gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-600 mt-0.5 flex-shrink-0" />
              <div className="text-sm text-amber-800">
                <div className="font-medium mb-1">Impact of flagging:</div>
                <ul className="text-xs space-y-1 list-disc list-inside">
                <li>Task {flaggedTaskId} will be marked for {selectedCategory === 'quality_issue' ? 'rework' : 'review'}</li>
                  {flaggedTaskId !== taskId && (
                    <li>This may block progression to downstream tasks</li>
                  )}
                  {userRole === 'pod_lead' && (
                    <li>Pod lead flag will trigger immediate review</li>
                  )}
                  {isWorkflowIssue && (
                    <li>Workflow will be reevaluated from the flagged task</li>
                  )}
                </ul>
              </div>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex justify-end gap-3 pt-4 border-t">
          <Button 
            variant="outline" 
            onClick={handleClose}
            disabled={isSubmitting}
          >
            Cancel
          </Button>
          <Button 
            onClick={handleSubmit}
            disabled={!selectedCategory || reason.length < 15 || isSubmitting ||
                     (isWorkflowIssue && !workflowScenario)}
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