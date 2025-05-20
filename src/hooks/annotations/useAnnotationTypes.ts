
import { SubTask } from '@/components/dashboard/TaskCard';
import { User } from '@/contexts/UserContext';
import { Annotation } from '@/services/api';

export type { Annotation };

export interface AnnotationHandlersProps {
  task1SubTasks: SubTask[];
  task2SubTasks: SubTask[];
  task3SubTasks: SubTask[];
  consensusTask1: SubTask[];
  consensusTask2: SubTask[];
  consensusTask3: SubTask[];
  user: User | null;
  saveAnnotation: (annotation: Omit<Annotation, 'timestamp'>) => Promise<boolean>;
  saveConsensusAnnotation: (annotation: Omit<Annotation, 'timestamp'>) => Promise<boolean>;
  getUserAnnotation: (discussionId: string, userId: string, taskId: number) => Annotation | undefined;
  getAnnotationsForTask: (discussionId: string, taskId: number) => Annotation[];
  getConsensusAnnotation: (discussionId: string, taskId: number) => Annotation | undefined;
  updateStepCompletionStatus: (stepIndex: number, completed: boolean) => void;
  overrideAnnotation?: (podLeadId: string, annotatorId: string, discussionId: string, taskId: number, data: Record<string, any>) => Promise<boolean>;
}

// Task IDs for clearer code
export enum TaskId {
  QUESTION_QUALITY = 1,
  ANSWER_QUALITY = 2,
  REWRITE = 3,
  SUMMARY = 4
}

// Type guard for pod lead users
export function isPodLead(user: User | null): boolean {
  return user?.role === 'pod_lead';
}
