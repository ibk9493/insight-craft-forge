
import { SubTask, SubTaskStatus } from '@/components/dashboard/TaskCard';
import { Annotation } from '@/services/api';
import { User } from '@/contexts/UserContext';

// Define shared types for annotation hooks
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
  overrideAnnotation?: (podLeadId: string, annotatorId: string, discussionId: string, taskId: number, data: Record<string, string | boolean>) => Promise<boolean>;
}

// Define consistent task ID types
export enum TaskId {
  URL_INPUT = 0,
  QUESTION_QUALITY = 1,
  ANSWER_QUALITY = 2,
  REWRITE = 3,
  SUMMARY = 4
}

// Define task status map type
export interface TaskStatusMap {
  [TaskId.QUESTION_QUALITY]: boolean;
  [TaskId.ANSWER_QUALITY]: boolean;
  [TaskId.REWRITE]: boolean;
}

// Helper function to check if user is pod lead
export const isPodLead = (user: User): boolean => {
  return user.role === 'pod_lead';
};
