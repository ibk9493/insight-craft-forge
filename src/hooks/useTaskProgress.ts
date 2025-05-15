
import { useCallback } from 'react';
import { SubTask } from '@/components/dashboard/TaskCard';

export function useTaskProgress(
  task1SubTasks: SubTask[],
  task2SubTasks: SubTask[],
  task3SubTasks: SubTask[],
  consensusTask1: SubTask[],
  consensusTask2: SubTask[],
  consensusTask3: SubTask[]
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

  const getTask3Progress = useCallback((isConsensus: boolean = false) => {
    const tasks = isConsensus ? consensusTask3 : task3SubTasks;
    const completed = tasks.filter(t => t.status === 'completed' || t.status === 'na').length;
    if (completed === tasks.length) return 'completed';
    if (completed > 0) return 'inProgress';
    return 'pending';
  }, [task3SubTasks, consensusTask3]);

  const canProceed = useCallback((currentStep: number, viewMode: 'grid' | 'detail' | 'consensus') => {
    const isConsensus = viewMode === 'consensus';
    
    if (currentStep === 1) {
      return getTask1Progress(isConsensus) === 'completed';
    } else if (currentStep === 2) {
      return getTask2Progress(isConsensus) === 'completed';
    } else if (currentStep === 3) {
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
