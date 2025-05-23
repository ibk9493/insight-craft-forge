
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
  const getTask3Progress = (isConsensus = false) => {
    const forms = isConsensus ? consensusTask3Forms : task3Forms;
        if (forms.length) {
      const total = forms.reduce((acc, f) => acc + f.subTasks.length, 0);
      const completed = forms.reduce(
          (acc, f) => acc +
                f.subTasks.filter(
                      (t) => t.status === 'completed' || t.status === 'na'
                ).length,
              0
            );
            return Math.round((completed / total) * 100);
          }

            return calcProgress(isConsensus ? consensusTask3 : task3SubTasks);
      };

  const canProceed = useCallback((currentStep: number, viewMode: 'grid' | 'detail' | 'consensus') => {
    const isConsensus = viewMode === 'consensus';

    if (currentStep === 1) {
      return getTask1Progress(isConsensus) === 'completed';
    } else if (currentStep === 2) {
      return getTask2Progress(isConsensus) === 'completed';
    } else if (currentStep === 3) {
      console.log("DEBUGGING:", getTask3Progress(isConsensus))
      return getTask3Progress(isConsensus) === 100;
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
