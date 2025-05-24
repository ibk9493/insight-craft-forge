import { useCallback } from 'react';
import { SubTask } from '@/components/dashboard/TaskCard';

/* ---------- tiny helper so “undefined” never crashes .filter() ---------- */
const safe = <T,>(arr?: T[]): T[] => (Array.isArray(arr) ? arr : []);

/* ----------------------------------------------------------------------- */

export function useTaskProgress(
    task1SubTasks: SubTask[] | undefined,
    task2SubTasks: SubTask[] | undefined,
    task3SubTasks: SubTask[] | undefined,
    consensusTask1: SubTask[] | undefined,
    consensusTask2: SubTask[] | undefined,
    consensusTask3: SubTask[] | undefined,
    task3Forms: { subTasks: SubTask[] }[] = [],
    consensusTask3Forms: { subTasks: SubTask[] }[] = []
) {
  /* -------------------- TASK-1 -------------------- */
  const getTask1Progress = useCallback(
      (isConsensus = false) => {
        const tasks = safe(isConsensus ? consensusTask1 : task1SubTasks);
        const completed = tasks.filter(t => t.status === 'completed' || t.status === 'na').length;
        if (!tasks.length)           return 'pending';
        if (completed === tasks.length) return 'completed';
        if (completed > 0)           return 'inProgress';
        return 'pending';
      },
      [task1SubTasks, consensusTask1]
  );

  /* -------------------- TASK-2 -------------------- */
  const getTask2Progress = useCallback(
      (isConsensus = false) => {
        const tasks = safe(isConsensus ? consensusTask2 : task2SubTasks);
        const completed = tasks.filter(t => t.status === 'completed' || t.status === 'na').length;
        if (!tasks.length)           return 'pending';
        if (completed === tasks.length) return 'completed';
        if (completed > 0)           return 'inProgress';
        return 'pending';
      },
      [task2SubTasks, consensusTask2]
  );

  /* -------------------- TASK-3 (multi-form aware) -------------------- */
  const getTask3Progress = useCallback(
      (isConsensus = false) => {
        const forms = isConsensus ? consensusTask3Forms : task3Forms;

        /* ---- multiple forms: aggregate ---- */
        if (forms.length > 1) {
          const total      = forms.reduce((acc, f) => acc + f.subTasks.length, 0);
          const completed  = forms.reduce(
              (acc, f) => acc + f.subTasks.filter(t => t.status === 'completed' || t.status === 'na').length,
              0
          );
          if (!total)            return 'pending';
          if (completed === total) return 'completed';
          if (completed > 0)     return 'inProgress';
          return 'pending';
        }

        /* ---- single form or legacy array ---- */
        const tasks = forms.length === 1
            ? forms[0].subTasks
            : safe(isConsensus ? consensusTask3 : task3SubTasks);

        if (!tasks.length)        return 'pending';
        const completed = tasks.filter(t => t.status === 'completed' || t.status === 'na').length;
        if (completed === tasks.length) return 'completed';
        if (completed > 0)        return 'inProgress';
        return 'pending';
      },
      [task3SubTasks, consensusTask3, task3Forms, consensusTask3Forms]
  );

  /* -------------------- CAN-PROCEED -------------------- */
  const canProceed = useCallback(
      (
          currentStep: number,
          viewMode: 'grid' | 'detail' | 'consensus',
          activeTask3Form?: number,
          task3FormsData?: { subTasks: SubTask[] }[],
          activeConsensusTask3Form?: number,
          consensusTask3FormsData?: { subTasks: SubTask[] }[]
      ) => {
        const isConsensus = viewMode === 'consensus';

        if (currentStep === 1) {
          return getTask1Progress(isConsensus) === 'completed';
        }
        if (currentStep === 2) {
          return getTask2Progress(isConsensus) === 'completed';
        }
        if (currentStep === 3) {
          /* ---- when Task-3 uses tabbed forms ---- */
          if (
              isConsensus &&
              consensusTask3FormsData &&
              activeConsensusTask3Form !== undefined
          ) {
            const currentForm = consensusTask3FormsData[activeConsensusTask3Form];
            const tasks       = safe(currentForm?.subTasks);
            return tasks.length && tasks.every(t => t.status === 'completed' || t.status === 'na');
          }
          if (
              !isConsensus &&
              task3FormsData &&
              activeTask3Form !== undefined
          ) {
            const currentForm = task3FormsData[activeTask3Form];
            const tasks       = safe(currentForm?.subTasks);
            return tasks.length && tasks.every(t => t.status === 'completed' || t.status === 'na');
          }
          /* ---- fallback legacy logic ---- */
          return getTask3Progress(isConsensus) === 'completed';
        }

        return true;
      },
      [getTask1Progress, getTask2Progress, getTask3Progress]
  );

  return {
    getTask1Progress,
    getTask2Progress,
    getTask3Progress,
    canProceed
  };
}
