import React, { useState } from 'react';
import { ChevronDown, ChevronRight, CheckCircle, AlertCircle, HelpCircle, Plus, X, Copy } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';

export type SubTaskStatus = 'pending' | 'completed' | 'failed' | 'na';

export interface SupportingDoc {
  link: string;
  paragraph: string;
}

export interface SubTask {
  id: string;
  title: string;
  status: SubTaskStatus;
  options: string[];
  description: string;
  selectedOption?: string;
  textInput?: boolean;
  textValue?: string;
  textValues?: string[];
  supportingDocs?: SupportingDoc[];
  weights?: number[];
  multiline?: boolean;
  structuredInput?: boolean;
  requiresRemarks?: boolean;
  placeholder?: string;
  sections?: SubTask[][];
}

interface TaskCardProps {
  title: string;
  description: string;
  subTasks: SubTask[];
  status: 'pending' | 'inProgress' | 'completed';
  onSubTaskChange: (
      taskId: string,
      selectedOption?: string,
      textValue?: string,
      textValues?: string[],
      supportingDocs?: SupportingDoc[],
      sectionIndex?: number,
      weights?: number[]
  ) => void;
  onAddSection?: () => void;
  onRemoveSection?: (sectionIndex: number) => void;
  sections?: SubTask[][];
  active?: boolean;
  allowMultipleSections?: boolean;
  customFieldRenderers?: {
    [taskId: string]: (
        task: SubTask,
        onChange: (
            taskId: string,
            selectedOption?: string,
            textValue?: string,
            textValues?: string[],
            supportingDocs?: SupportingDoc[],
            sectionIndex?: number,
            weights?: number[]
        ) => void
    ) => React.ReactNode;
  };
}

const TaskCard: React.FC<TaskCardProps> = ({
                                             title,
                                             description,
                                             subTasks,
                                             status,
                                             onSubTaskChange,
                                             onAddSection,
                                             onRemoveSection,
                                             sections = [],
                                             active = false,
                                             allowMultipleSections = false,
                                             customFieldRenderers = {}
                                           }) => {
  const [expanded, setExpanded] = useState(active);
  const [multilineFields, setMultilineFields] = useState<Record<string, string[]>>({});
  const [supportingDocFields, setSupportingDocFields] = useState<Record<string, SupportingDoc[]>>({});

  React.useEffect(() => {
    const newMultilineFields: Record<string, string[]> = {};
    const newSupportingDocFields: Record<string, SupportingDoc[]> = {};
    subTasks.forEach(task => {
      if (task.multiline && !task.structuredInput) {
        newMultilineFields[task.id] = task.textValues && task.textValues.length > 0 ? [...task.textValues] : [''];
      }
      if (task.structuredInput) {
        newSupportingDocFields[task.id] = task.supportingDocs && task.supportingDocs.length > 0
            ? task.supportingDocs.map(doc => ({ ...doc }))
            : [{ link: '', paragraph: '' }];
      }
    });
    setMultilineFields(newMultilineFields);
    setSupportingDocFields(newSupportingDocFields);
  }, [subTasks]);

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

  const shouldShowRemarks = (task: SubTask): boolean => {
    return Boolean(task.textInput || task.requiresRemarks);
  };

  const handleHeaderClick = () => {
    setExpanded(!expanded);
  };

  const getProgressPercentage = () => {
    if (subTasks.length === 0) return 0;
    const completedCount = subTasks.filter(task => task.status === 'completed' || task.status === 'na').length;
    return Math.round((completedCount / subTasks.length) * 100);
  };

  const addField = (taskId: string) => {
    setMultilineFields(prev => {
      const currentFields = prev[taskId] || [''];
      return {
        ...prev,
        [taskId]: [...currentFields, '']
      };
    });
  };

  const addSupportingDocField = (taskId: string) => {
    const currentDocFields = supportingDocFields[taskId] || [{ link: '', paragraph: '' }];
    const newFields = [...currentDocFields, { link: '', paragraph: '' }];
    onSubTaskChange(
        taskId,
        subTasks.find(t => t.id === taskId)?.selectedOption,
        undefined,
        undefined,
        newFields
    );
    setSupportingDocFields(prev => ({
      ...prev,
      [taskId]: newFields
    }));
  };

  const removeField = (taskId: string, index: number) => {
    const prevFields = multilineFields[taskId] || [''];
    const currentFields = [...prevFields];
    if (currentFields.length > 1) {
      currentFields.splice(index, 1);
    } else {
      currentFields[0] = '';
    }
    const newTextValues = [...currentFields];
    onSubTaskChange(taskId, subTasks.find(t => t.id === taskId)?.selectedOption, undefined, newTextValues);
    setMultilineFields(prev => ({
      ...prev,
      [taskId]: currentFields
    }));
  };

  const removeSupportingDocField = (taskId: string, index: number) => {
    const prevDocFields = supportingDocFields[taskId] || [{ link: '', paragraph: '' }];
    const currentFields = [...prevDocFields];
    if (currentFields.length > 1) {
      currentFields.splice(index, 1);
    } else {
      currentFields[0] = { link: '', paragraph: '' };
    }
    onSubTaskChange(
        taskId,
        subTasks.find(t => t.id === taskId)?.selectedOption,
        undefined,
        undefined,
        currentFields
    );
    setSupportingDocFields(prev => ({
      ...prev,
      [taskId]: currentFields
    }));
  };

  const handleMultilineChange = (taskId: string, index: number, value: string) => {
    const currentSubTaskFields = multilineFields[taskId] || [''];
    const newTextValues = [...currentSubTaskFields];
    newTextValues[index] = value;
    onSubTaskChange(
        taskId,
        subTasks.find(t => t.id === taskId)?.selectedOption,
        undefined,
        newTextValues
    );
  };

  const handleSupportingDocChange = (taskId: string, index: number, field: 'link' | 'paragraph', value: string) => {
    const currentSubTaskDocFields = supportingDocFields[taskId] || [{ link: '', paragraph: '' }];
    const newSupportingDocs = currentSubTaskDocFields.map((doc, i) =>
        i === index ? { ...doc, [field]: value } : doc
    );
    onSubTaskChange(
        taskId,
        subTasks.find(t => t.id === taskId)?.selectedOption,
        undefined,
        undefined,
        newSupportingDocs
    );
  };

  const handleSectionSubTaskChange = (sectionIndex: number, taskId: string, selectedOption?: string, textValue?: string, textValues?: string[], supportingDocs?: SupportingDoc[]) => {
    onSubTaskChange(taskId, selectedOption, textValue, textValues, supportingDocs, sectionIndex);
  };

  const progressPercentage = getProgressPercentage();

  const renderTaskForm = (tasks: SubTask[], sectionIndex?: number) => (
      <div className="space-y-4">
        {tasks.map(task => (
            <div key={task.id + (sectionIndex !== undefined ? `-section-${sectionIndex}` : '')} className="bg-white border rounded-md p-3">
              <div className="flex items-center mb-2">
                {getStatusIcon(task.status)}
                <span className="ml-2 font-medium text-sm">{task.title}</span>
              </div>
              {task.description && <p className="text-gray-500 text-xs mb-2">{task.description}</p>}
              {task.options && task.options.length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-2">
                    {task.options.map(option => (
                        <button
                            key={option}
                            onClick={() => {
                              if (sectionIndex !== undefined) {
                                handleSectionSubTaskChange(sectionIndex, task.id, option, task.textValue);
                              } else {
                                onSubTaskChange(task.id, option, task.textValue);
                              }
                            }}
                            className={cn(
                                'text-xs py-1 px-3 rounded-full',
                                task.selectedOption === option ? 'bg-dashboard-blue text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                            )}
                        >
                          {option}
                        </button>
                    ))}
                  </div>
              )}
              {shouldShowRemarks(task) && !task.multiline && !task.structuredInput && (
                  <div className="mt-3">
                    <Textarea
                        value={task.textValue || ''}
                        onChange={e => {
                          e.stopPropagation();
                          if (sectionIndex !== undefined) {
                            handleSectionSubTaskChange(sectionIndex, task.id, task.selectedOption, e.target.value);
                          } else {
                            onSubTaskChange(task.id, task.selectedOption, e.target.value);
                          }
                        }}
                        onClick={e => e.stopPropagation()}
                        onMouseDown={e => e.stopPropagation()}
                        placeholder={task.placeholder || `Enter ${task.textInput ? task.title.toLowerCase() : 'remarks or justification'}`}
                        className="min-h-[100px] text-sm w-full"
                    />
                  </div>
              )}
              {task.multiline && !task.structuredInput && (
                  customFieldRenderers?.[task.id] ? (
                      customFieldRenderers[task.id](task, (taskId, selectedOption, textValue, textValues, supportingDocs, sectionIdx, weights) => {
                        if (weights) {
                          const updatedTask = { ...task, weights };
                        }
                        onSubTaskChange(taskId, selectedOption, textValue, textValues, supportingDocs, sectionIdx);
                      })
                  ) : (
                      <div className="mt-3 space-y-3">
                        {(multilineFields[task.id] || ['']).map((fieldValue, index) => (
                            <div key={`${task.id}-field-${index}`} className="flex gap-2">
                              <Textarea
                                  value={fieldValue}
                                  onChange={e => {
                                    e.stopPropagation();
                                    handleMultilineChange(task.id, index, e.target.value);
                                  }}
                                  onClick={e => e.stopPropagation()}
                                  onMouseDown={e => e.stopPropagation()}
                                  placeholder={task.placeholder || `Enter ${task.title.toLowerCase()} item ${index + 1}`}
                                  className="min-h-[100px] text-sm flex-1"
                              />
                              {multilineFields[task.id]?.length > 1 && (
                                  <Button
                                      variant="ghost"
                                      size="icon"
                                      onClick={e => {
                                        e.stopPropagation();
                                        removeField(task.id, index);
                                      }}
                                      className="h-8 w-8 self-start"
                                  >
                                    <X className="h-4 w-4" />
                                  </Button>
                              )}
                            </div>
                        ))}
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={e => {
                              e.stopPropagation();
                              addField(task.id);
                            }}
                            className="flex items-center mt-2"
                        >
                          <Plus className="h-4 w-4 mr-1" />
                          <span>Add {task.title.toLowerCase()} item</span>
                        </Button>
                      </div>
                  )
              )}
              {task.structuredInput && (
                  <div className="mt-3 space-y-4">
                    {(supportingDocFields[task.id] || [{ link: '', paragraph: '' }]).map((docField, index) => (
                        <div key={`${task.id}-doc-${index}`} className="p-3 border rounded-md bg-gray-50">
                          <div className="flex justify-between mb-2">
                            <span className="text-xs font-medium text-gray-500">Supporting Document #{index + 1}</span>
                            {supportingDocFields[task.id]?.length > 1 && (
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={e => {
                                      e.stopPropagation();
                                      removeSupportingDocField(task.id, index);
                                    }}
                                    className="h-6 w-6 -mt-1 -mr-1"
                                >
                                  <X className="h-4 w-4" />
                                </Button>
                            )}
                          </div>
                          <div className="mb-2">
                            <label className="block text-xs font-medium text-gray-700 mb-1">Link</label>
                            <Input
                                value={docField.link}
                                onChange={e => {
                                  e.stopPropagation();
                                  handleSupportingDocChange(task.id, index, 'link', e.target.value);
                                }}
                                onClick={e => e.stopPropagation()}
                                onMouseDown={e => e.stopPropagation()}
                                placeholder="https://example.com/docs/file.html"
                                className="text-sm w-full"
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-gray-700 mb-1">Supporting Paragraph</label>
                            <Textarea
                                value={docField.paragraph}
                                onChange={e => {
                                  e.stopPropagation();
                                  handleSupportingDocChange(task.id, index, 'paragraph', e.target.value);
                                }}
                                onClick={e => e.stopPropagation()}
                                onMouseDown={e => e.stopPropagation()}
                                placeholder="The relevant section of documentation"
                                className="min-h-[80px] text-sm w-full"
                            />
                          </div>
                        </div>
                    ))}
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={e => {
                          e.stopPropagation();
                          addSupportingDocField(task.id);
                        }}
                        className="flex items-center"
                    >
                      <Plus className="h-4 w-4 mr-1" />
                      <span>Add supporting document</span>
                    </Button>
                  </div>
              )}
            </div>
        ))}
      </div>
  );

  return (
      <div className={cn(
          'border rounded-lg overflow-hidden transition-all duration-300 mb-4',
          getStatusColor(status),
          active && 'ring-2 ring-dashboard-blue'
      )}>
        <div
            className="flex items-center justify-between p-4 cursor-pointer"
            onClick={handleHeaderClick}
        >
          <div className="flex items-center">
            {expanded ? <ChevronDown className="h-5 w-5 text-gray-500 mr-2" /> : <ChevronRight className="h-5 w-5 text-gray-500 mr-2" />}
            <h3 className="font-medium">{title}</h3>
          </div>
          <div className="flex items-center">
            {status === 'completed' && <span className="text-sm text-green-600 mr-2">Completed</span>}
            {status === 'inProgress' && <span className="text-sm text-blue-600 mr-2">In Progress</span>}
          </div>
        </div>
        <div className="px-4 pb-2">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs text-gray-500">{progressPercentage}% complete</span>
            <span className="text-xs text-gray-500">{subTasks.filter(task => task.status === 'completed' || task.status === 'na').length}/{subTasks.length} tasks</span>
          </div>
          <Progress value={progressPercentage} className="h-2" />
        </div>
        {expanded && (
            <div className="p-4 pt-0 animate-fadeIn">
              <p className="text-gray-600 mb-4 text-sm">{description}</p>
              {renderTaskForm(subTasks)}
              {allowMultipleSections && sections.map((sectionTasks, index) => (
                  <div key={`section-${index}`} className="mt-6 border-t pt-4">
                    <div className="flex justify-between items-center mb-3">
                      <h3 className="text-sm font-medium">Additional Form Section #{index + 1}</h3>
                      {sections.length > 0 && onRemoveSection && (
                          <Button
                              variant="outline"
                              size="sm"
                              onClick={e => {
                                e.stopPropagation();
                                onRemoveSection(index);
                              }}
                              className="text-red-500 border-red-200 hover:bg-red-50"
                          >
                            <X className="h-4 w-4 mr-1" />
                            <span>Remove Section</span>
                          </Button>
                      )}
                    </div>
                    {renderTaskForm(sectionTasks, index)}
                  </div>
              ))}
              {allowMultipleSections && onAddSection && (
                  <div className="mt-6 flex justify-center">
                    <Button
                        variant="outline"
                        onClick={e => {
                          e.stopPropagation();
                          onAddSection();
                        }}
                        className="flex items-center"
                    >
                      <Plus className="h-4 w-4 mr-1" />
                      <span>Add Another Form Section</span>
                    </Button>
                  </div>
              )}
            </div>
        )}
      </div>
  );
};

export default TaskCard;