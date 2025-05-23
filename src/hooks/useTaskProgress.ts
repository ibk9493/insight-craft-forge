
import { useCallback } from 'react';
import { SubTask } from '@/components/dashboard/TaskCard';

function calcProgress(tasks: { status: 'pending' | 'completed' | 'failed' | 'na' }[]): number {
  console.log("DEBUG PROGRESS:", tasks);
  if (!tasks || tasks.length === 0) return 0;
  const completed = tasks.filter(t => t.status === 'completed' || t.status === 'na').length;
  return Math.round((completed / tasks.length) * 100);
}

export function useTaskProgress(
  task1SubTasks: SubTask[],
  task2SubTasks: SubTask[],
  task3SubTasks: SubTask[],
  consensusTask1: SubTask[],
  consensusTask2: SubTask[],
  consensusTask3: SubTask[],
  task3Forms: { subTasks: SubTask[] }[] = [],
  consensusTask3Forms: { subTasks: SubTask[] }[] = []
) {
  const getTask1Progress = useCallback((isConsensus: boolean = false) => {
    const tasks = isConsensus ? consensusTask1 : task1SubTasks;
    const completed = tasks.filter(t => t.status === 'completed' || t.status === 'na').length;
    if (completed === tasks.length) return 'completed';
    if (completed > 0) return 'inProgress';
    return 'pending';
  }, [task1SubTasks, consensusTask1]);

  const getTask2Progress = useCallback((isConsensus: boolean = false) => {
    const tasks = isConsensus ? consensusTask2 : task2SubTasks;
    const completed = tasks.filter(t => t.status === 'completed' || t.status === 'na').length;
    if (completed === tasks.length) return 'completed';
    if (completed > 0) return 'inProgress';
    return 'pending';
  }, [task2SubTasks, consensusTask2]);

  // const getTask3Progress = useCallback((isConsensus: boolean = false) => {
  //   const tasks = isConsensus ? consensusTask3 : task3SubTasks;
  //   const completed = tasks.filter(t => t.status === 'completed' || t.status === 'na').length;
  //   if (completed === tasks.length) return 'completed';
  //   if (completed > 0) return 'inProgress';
  //   return 'pending';
  // }, [task3SubTasks, consensusTask3]);
  const getTask3Progress = useCallback((isConsensus = false) => {
    const forms = isConsensus ? consensusTask3Forms : task3Forms;
    
    // If we have multiple forms, calculate based on all forms
    if (forms.length > 1) {
      const total = forms.reduce((acc, f) => acc + f.subTasks.length, 0);
      const completed = forms.reduce(
        (acc, f) => acc + f.subTasks.filter(
          (t) => t.status === 'completed' || t.status === 'na'
        ).length,
        0
      );
      
      // Make it consistent with other progress functions
      if (total === 0) return 'pending';
      if (completed === total) return 'completed';
      if (completed > 0) return 'inProgress';
      return 'pending';
    }
    
    // For single form (including when forms.length === 1), use the first form's data
    // or fall back to the original tasks
    let tasks;
    if (forms.length === 1) {
      tasks = forms[0].subTasks;
    } else {
      // Fallback to original task arrays when no forms exist
      tasks = isConsensus ? consensusTask3 : task3SubTasks;
    }
    
    if (!tasks || tasks.length === 0) return 'pending';
    
    const completed = tasks.filter(t => t.status === 'completed' || t.status === 'na').length;
    if (completed === tasks.length) return 'completed';
    if (completed > 0) return 'inProgress';
    return 'pending';
  }, [task3SubTasks, consensusTask3, task3Forms, consensusTask3Forms]);


// Update the canProceed function in useTaskProgress hook

const canProceed = useCallback((
  currentStep: number, 
  viewMode: 'grid' | 'detail' | 'consensus',
  // Add these new parameters for Task 3 form checking
  activeTask3Form?: number,
  task3FormsData?: Array<{ subTasks: SubTask[] }>,
  activeConsensusTask3Form?: number,
  consensusTask3FormsData?: Array<{ subTasks: SubTask[] }>
) => {
  const isConsensus = viewMode === 'consensus';
     
  if (currentStep === 1) {
    return getTask1Progress(isConsensus) === 'completed';
  } else if (currentStep === 2) {
    return getTask2Progress(isConsensus) === 'completed';
  } else if (currentStep === 3) {
    // Special handling for Task 3 with forms
    if (isConsensus && consensusTask3FormsData && activeConsensusTask3Form !== undefined) {
      const currentForm = consensusTask3FormsData[activeConsensusTask3Form];
      if (currentForm && currentForm.subTasks) {
        const completed = currentForm.subTasks.filter(t => 
          t.status === 'completed' || t.status === 'na'
        ).length;
        return completed === currentForm.subTasks.length;
      }
    } else if (!isConsensus && task3FormsData && activeTask3Form !== undefined) {
      const currentForm = task3FormsData[activeTask3Form];
      if (currentForm && currentForm.subTasks) {
        const completed = currentForm.subTasks.filter(t => 
          t.status === 'completed' || t.status === 'na'
        ).length;
        return completed === currentForm.subTasks.length;
      }
    }
    
    // Fallback to original logic if no form data provided
    return getTask3Progress(isConsensus) === 'completed';
  }
     
  return true;
}, [getTask1Progress, getTask2Progress, getTask3Progress]);

  return {
    getTask1Progress,
    getTask2Progress,
    getTask3Progress,
    canProceed
  };
}
