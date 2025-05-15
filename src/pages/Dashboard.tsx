import React, { useState, useEffect } from 'react';
import Header from '@/components/layout/Header';
import UrlInput from '@/components/dashboard/UrlInput';
import TaskCard, { SubTask } from '@/components/dashboard/TaskCard';
import TaskGrid from '@/components/dashboard/TaskGrid';
import ProgressStepper from '@/components/dashboard/ProgressStepper';
import Summary from '@/components/dashboard/Summary';
import { Button } from '@/components/ui/button';
import { ArrowLeft, ArrowRight } from 'lucide-react';
import { toast } from 'sonner';

const Dashboard = () => {
  const [url, setUrl] = useState<string>('');
  const [currentStep, setCurrentStep] = useState(0);
  const [viewMode, setViewMode] = useState<'grid' | 'detail'>('grid');
  const [selectedTaskId, setSelectedTaskId] = useState<number | null>(null);
  
  // Task 1 subtasks
  const [task1SubTasks, setTask1SubTasks] = useState<SubTask[]>([
    {
      id: 'relevance',
      title: 'Relevance Check',
      status: 'pending',
      options: ['Yes', 'No'],
      description: 'Check if the question is relevant to the topic'
    },
    {
      id: 'learning',
      title: 'Learning Value Check',
      status: 'pending',
      options: ['Yes', 'No'],
      description: 'Check if the question has learning value'
    },
    {
      id: 'clarity',
      title: 'Clarity Check',
      status: 'pending',
      options: ['Yes', 'No'],
      description: 'Check if the question is clear'
    },
    {
      id: 'grounded',
      title: 'Image Grounded Check',
      status: 'pending',
      options: ['True', 'False', 'N/A'],
      description: 'Check if images are properly referenced (if any)'
    },
    {
      id: 'consensus',
      title: 'Consensus by 3 annotators',
      status: 'pending',
      options: ['Agreement', 'No Agreement'],
      description: 'Check if there is consensus among annotators'
    }
  ]);
  
  // Task 2 subtasks
  const [task2SubTasks, setTask2SubTasks] = useState<SubTask[]>([
    {
      id: 'aspects',
      title: 'Addresses All Aspects',
      status: 'pending',
      options: ['Yes', 'No'],
      description: 'Check if the answer addresses all aspects of the question'
    },
    {
      id: 'explanation',
      title: 'Explanation Provided',
      status: 'pending',
      options: ['Yes', 'No'],
      description: 'Check if the answer provides an explanation'
    },
    {
      id: 'execution',
      title: 'Manual Code Execution Check',
      status: 'pending',
      options: ['Executable', 'Not Executable', 'N/A'],
      description: 'Check if the provided code is executable'
    },
    {
      id: 'download',
      title: 'Provide Code Download Link',
      status: 'pending',
      options: ['Provided', 'Not Provided', 'N/A'],
      description: 'Check if a code download link is provided'
    },
    {
      id: 'consensus',
      title: 'Consensus by 3 annotators',
      status: 'pending',
      options: ['Agreement', 'No Agreement'],
      description: 'Check if there is consensus among annotators'
    }
  ]);
  
  // Task 3 subtasks
  const [task3SubTasks, setTask3SubTasks] = useState<SubTask[]>([
    {
      id: 'rewrite',
      title: 'Rewrite Question Clearly',
      status: 'pending',
      options: ['Completed', 'Not Needed'],
      description: 'Rewrite the question in a clear and concise manner'
    },
    {
      id: 'shortAnswer',
      title: 'Prepare Short Answer List',
      status: 'pending',
      options: ['Completed', 'Not Needed'],
      description: 'Break down into atomic, concise claims'
    },
    {
      id: 'longAnswer',
      title: 'Construct Coherent Long Answer',
      status: 'pending',
      options: ['Completed', 'Not Needed'],
      description: 'Combine claims, smooth language, add reasoning'
    },
    {
      id: 'classify',
      title: 'Classify Question Type',
      status: 'pending',
      options: ['Search', 'Reasoning'],
      description: 'Classify the question as "Search" or "Reasoning"'
    },
    {
      id: 'supporting',
      title: 'Provide Supporting Docs',
      status: 'pending',
      options: ['Provided', 'Not Needed'],
      description: 'Annotate relevant references'
    },
    {
      id: 'consensus',
      title: 'Consensus by 5 annotators',
      status: 'pending',
      options: ['Agreement', 'No Agreement'],
      description: 'Check if there is consensus among annotators'
    }
  ]);
  
  // Progress steps
  const [steps, setSteps] = useState([
    { id: 1, title: 'Input URL', completed: false },
    { id: 2, title: 'Task 1', completed: false },
    { id: 3, title: 'Task 2', completed: false },
    { id: 4, title: 'Task 3', completed: false },
    { id: 5, title: 'Summary', completed: false },
  ]);

  // Add annotator counters
  const [task1Annotators, setTask1Annotators] = useState(0);
  const [task2Annotators, setTask2Annotators] = useState(0);
  const [task3Annotators, setTask3Annotators] = useState(0);

  // Tasks for grid view
  const [tasks, setTasks] = useState([
    {
      id: 1,
      title: "Question Quality Assessment",
      description: "Evaluate the quality of the question based on relevance, learning value, clarity, and image grounding.",
      status: 'locked' as 'locked' | 'unlocked' | 'completed',
      requiredAnnotators: 3,
      currentAnnotators: 0
    },
    {
      id: 2,
      title: "Answer Quality Assessment",
      description: "Evaluate the quality of the answer based on comprehensiveness, explanation, code execution, and completeness.",
      status: 'locked' as 'locked' | 'unlocked' | 'completed',
      requiredAnnotators: 3,
      currentAnnotators: 0
    },
    {
      id: 3,
      title: "Rewrite Question and Answer",
      description: "Rewrite the question and answer to improve clarity, conciseness, and coherence.",
      status: 'locked' as 'locked' | 'unlocked' | 'completed',
      requiredAnnotators: 5,
      currentAnnotators: 0
    }
  ]);

  // Effect to update tasks status based on URL and annotator counts
  useEffect(() => {
    if (!url) return;
    
    const updatedTasks = [...tasks];
    
    // Task 1 is unlocked once URL is submitted
    updatedTasks[0].status = task1Annotators >= 3 ? 'completed' : 'unlocked';
    updatedTasks[0].currentAnnotators = task1Annotators;
    
    // Task 2 is unlocked when Task 1 is completed (3 annotators)
    if (task1Annotators >= 3) {
      updatedTasks[1].status = task2Annotators >= 3 ? 'completed' : 'unlocked';
      updatedTasks[1].currentAnnotators = task2Annotators;
    }
    
    // Task 3 is unlocked when Task 2 is completed (3 annotators)
    if (task2Annotators >= 3) {
      updatedTasks[2].status = task3Annotators >= 5 ? 'completed' : 'unlocked';
      updatedTasks[2].currentAnnotators = task3Annotators;
    }
    
    setTasks(updatedTasks);
  }, [url, task1Annotators, task2Annotators, task3Annotators]);

  const handleUrlSubmit = (url: string) => {
    setUrl(url);
    updateStepCompletionStatus(0, true);
    toast.success("URL submitted successfully", {
      description: "Tasks are now available for annotation"
    });
  };

  const handleSelectTask = (taskId: number) => {
    setSelectedTaskId(taskId);
    setViewMode('detail');
    setCurrentStep(taskId);
  };

  const handleBackToGrid = () => {
    setViewMode('grid');
    setSelectedTaskId(null);
  };

  const handleCompleteAnnotation = (taskId: number) => {
    // This simulates an annotator completing a task
    if (taskId === 1) {
      setTask1Annotators(prev => Math.min(prev + 1, 3));
      toast.success(`Task 1: Annotator ${task1Annotators + 1}/3 completed`);
    } else if (taskId === 2) {
      setTask2Annotators(prev => Math.min(prev + 1, 3));
      toast.success(`Task 2: Annotator ${task2Annotators + 1}/3 completed`);
    } else if (taskId === 3) {
      setTask3Annotators(prev => Math.min(prev + 1, 5));
      toast.success(`Task 3: Annotator ${task3Annotators + 1}/5 completed`);
    }
    
    handleBackToGrid();
  };

  const handleSubTaskChange = (taskSet: string, taskId: string, selectedOption?: string) => {
    let updated: SubTask[] = [];

    if (taskSet === 'task1') {
      updated = task1SubTasks.map(task => 
        task.id === taskId 
          ? { 
              ...task, 
              selectedOption, 
              status: selectedOption ? 'completed' : 'pending'
            } 
          : task
      );
      setTask1SubTasks(updated);
    } else if (taskSet === 'task2') {
      updated = task2SubTasks.map(task => 
        task.id === taskId 
          ? { 
              ...task, 
              selectedOption, 
              status: selectedOption ? 'completed' : 'pending'
            } 
          : task
      );
      setTask2SubTasks(updated);
    } else if (taskSet === 'task3') {
      updated = task3SubTasks.map(task => 
        task.id === taskId 
          ? { 
              ...task, 
              selectedOption, 
              status: selectedOption ? 'completed' : 'pending'
            } 
          : task
      );
      setTask3SubTasks(updated);
    }

    checkForSubtaskLogic(taskSet, taskId, selectedOption);
  };

  const checkForSubtaskLogic = (taskSet: string, taskId: string, selectedOption?: string) => {
    // Special logic for Task 1
    if (taskSet === 'task1') {
      // If relevance is No, mark the rest as N/A
      if (taskId === 'relevance' && selectedOption === 'No') {
        setTask1SubTasks(task1SubTasks.map(task => {
          if (task.id !== 'relevance') {
            return { ...task, status: 'na', selectedOption: 'N/A' };
          }
          return task;
        }));
      }
      // If learning is No, mark the rest as N/A
      if (taskId === 'learning' && selectedOption === 'No') {
        setTask1SubTasks(task1SubTasks.map(task => {
          if (task.id !== 'relevance' && task.id !== 'learning') {
            return { ...task, status: 'na', selectedOption: 'N/A' };
          }
          return task;
        }));
      }
    }
  };

  const getTask1Progress = () => {
    const completed = task1SubTasks.filter(t => t.status === 'completed' || t.status === 'na').length;
    if (completed === task1SubTasks.length) return 'completed';
    if (completed > 0) return 'inProgress';
    return 'pending';
  };

  const getTask2Progress = () => {
    const completed = task2SubTasks.filter(t => t.status === 'completed' || t.status === 'na').length;
    if (completed === task2SubTasks.length) return 'completed';
    if (completed > 0) return 'inProgress';
    return 'pending';
  };

  const getTask3Progress = () => {
    const completed = task3SubTasks.filter(t => t.status === 'completed' || t.status === 'na').length;
    if (completed === task3SubTasks.length) return 'completed';
    if (completed > 0) return 'inProgress';
    return 'pending';
  };

  const updateStepCompletionStatus = (stepIndex: number, completed: boolean) => {
    setSteps(steps.map((step, index) => 
      index === stepIndex ? { ...step, completed } : step
    ));
  };

  const handleNext = () => {
    if (currentStep < 4) {
      updateStepCompletionStatus(currentStep, true);
      
      // Simulate annotator completion
      if (currentStep === 1) {
        handleCompleteAnnotation(1);
      } else if (currentStep === 2) {
        handleCompleteAnnotation(2);
      } else if (currentStep === 3) {
        handleCompleteAnnotation(3);
      } else {
        setCurrentStep(currentStep + 1);
      }
    }
  };

  const handleBack = () => {
    if (currentStep > 0 && viewMode === 'detail') {
      handleBackToGrid();
    }
  };

  const canProceed = () => {
    if (currentStep === 0) return !!url;
    if (currentStep === 1) return getTask1Progress() === 'completed';
    if (currentStep === 2) return getTask2Progress() === 'completed';
    if (currentStep === 3) return getTask3Progress() === 'completed';
    return true;
  };

  const getSummaryData = () => {
    // Convert task data to a summary format
    const task1Results: Record<string, string | boolean> = {};
    task1SubTasks.forEach(task => {
      task1Results[task.title] = task.selectedOption || 'Not answered';
    });

    const task2Results: Record<string, string | boolean> = {};
    task2SubTasks.forEach(task => {
      task2Results[task.title] = task.selectedOption || 'Not answered';
    });

    const task3Results: Record<string, string | boolean> = {};
    task3SubTasks.forEach(task => {
      task3Results[task.title] = task.selectedOption || 'Not answered';
    });

    return {
      task1Results,
      task2Results,
      task3Results
    };
  };

  // Determine if all tasks are completed and we can show summary
  const allTasksCompleted = task1Annotators >= 3 && task2Annotators >= 3 && task3Annotators >= 5;

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <Header />
      
      <div className="container max-w-4xl mx-auto px-4 py-6 flex-grow">
        {currentStep === 0 && (
          <UrlInput onSubmit={handleUrlSubmit} />
        )}
        
        {url && currentStep > 0 && viewMode === 'grid' && (
          <>
            <div className="mb-6">
              <h2 className="text-xl font-semibold mb-2">Annotation Tasks</h2>
              <p className="text-gray-600 text-sm">
                GitHub Discussion URL: <span className="text-dashboard-blue">{url}</span>
              </p>
              <p className="text-gray-600 text-sm mt-2">
                Task 1 requires 3 annotators, Task 2 requires 3 annotators, Task 3 requires 5 annotators.
              </p>
            </div>
            <TaskGrid tasks={tasks} onSelectTask={handleSelectTask} />
            
            {allTasksCompleted && (
              <div className="mt-6 text-center">
                <Button 
                  onClick={() => setCurrentStep(4)}
                  className="bg-dashboard-blue hover:bg-blue-600"
                >
                  View Final Summary
                </Button>
              </div>
            )}
          </>
        )}
        
        {url && viewMode === 'detail' && (
          <>
            <ProgressStepper steps={steps} currentStep={currentStep} />
            
            {currentStep === 1 && (
              <TaskCard
                title="Task 1: Question Quality Assessment"
                description="Evaluate the quality of the question based on relevance, learning value, clarity, and image grounding."
                subTasks={task1SubTasks}
                status={getTask1Progress()}
                onSubTaskChange={(taskId, selectedOption) => 
                  handleSubTaskChange('task1', taskId, selectedOption)
                }
                active={true}
              />
            )}
            
            {currentStep === 2 && (
              <TaskCard
                title="Task 2: Answer Quality Assessment"
                description="Evaluate the quality of the answer based on comprehensiveness, explanation, code execution, and completeness."
                subTasks={task2SubTasks}
                status={getTask2Progress()}
                onSubTaskChange={(taskId, selectedOption) => 
                  handleSubTaskChange('task2', taskId, selectedOption)
                }
                active={true}
              />
            )}
            
            {currentStep === 3 && (
              <TaskCard
                title="Task 3: Rewrite Question and Answer"
                description="Rewrite the question and answer to improve clarity, conciseness, and coherence."
                subTasks={task3SubTasks}
                status={getTask3Progress()}
                onSubTaskChange={(taskId, selectedOption) => 
                  handleSubTaskChange('task3', taskId, selectedOption)
                }
                active={true}
              />
            )}
            
            {currentStep === 4 && (
              <Summary results={getSummaryData()} />
            )}
          </>
        )}
        
        <div className="flex justify-between mt-6">
          {viewMode === 'detail' && currentStep > 0 && (
            <Button
              onClick={handleBack}
              variant="outline"
              className="flex items-center gap-2"
            >
              <ArrowLeft className="h-4 w-4" />
              <span>Back to Grid</span>
            </Button>
          )}
          
          {viewMode === 'detail' && currentStep < 4 && currentStep > 0 && (
            <Button
              onClick={handleNext}
              disabled={!canProceed()}
              className="flex items-center gap-2 bg-dashboard-blue hover:bg-blue-600 ml-auto"
            >
              <span>Complete Annotation</span>
              <ArrowRight className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
