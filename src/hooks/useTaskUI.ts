
import { useState } from 'react';
import { SubTask } from '@/components/dashboard/TaskCard';

interface UseTaskUIProps {
  currentStep: number;
  url: string;
  task1SubTasks: SubTask[];
  task2SubTasks: SubTask[];
  task3SubTasks: SubTask[];
  steps: { id: number; title: string; completed: boolean }[];
  setSteps: React.Dispatch<React.SetStateAction<{ id: number; title: string; completed: boolean }[]>>;
  getTask1Progress: () => 'pending' | 'inProgress' | 'completed';
  getTask2Progress: () => 'pending' | 'inProgress' | 'completed';
  getTask3Progress: () => 'pending' | 'inProgress' | 'completed';
}

export function useTaskUI({
  currentStep,
  url,
  task1SubTasks,
  task2SubTasks,
  task3SubTasks,
  steps,
  setSteps,
  getTask1Progress,
  getTask2Progress,
  getTask3Progress
}: UseTaskUIProps) {
  const updateStepCompletionStatus = (stepIndex: number, completed: boolean) => {
    setSteps(steps.map((step, index) => 
      index === stepIndex ? { ...step, completed } : step
    ));
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

  return {
    updateStepCompletionStatus,
    canProceed,
    getSummaryData
  };
}
