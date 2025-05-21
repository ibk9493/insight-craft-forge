// This is the main annotation handlers hook that combines the other hooks
import { useState, useCallback } from 'react';
import { SubTask } from '@/components/dashboard/TaskCard';
import { User } from '@/contexts/UserContext';
import { Annotation } from '@/services/api';
import { useAnnotationLoader } from './annotations/useAnnotationLoader';
import { useAnnotationSaver } from './annotations/useAnnotationSaver';
import { AnnotationHandlersProps, isPodLead } from './annotations/useAnnotationTypes';

export function useAnnotationHandlers({
  task1SubTasks,
  task2SubTasks,
  task3SubTasks,
  consensusTask1,
  consensusTask2,
  consensusTask3,
  user,
  saveAnnotation,
  saveConsensusAnnotation,
  getUserAnnotation,
  getAnnotationsForTask,
  getConsensusAnnotation,
  updateStepCompletionStatus,
  overrideAnnotation
}: AnnotationHandlersProps) {
  // Use the annotation loader hook
  const {
    loadUserAnnotation: _loadUserAnnotation,
    prepareConsensusView,
    loading: loaderLoading,
    setLoading: setLoaderLoading
  } = useAnnotationLoader({
    task1SubTasks,
    task2SubTasks,
    task3SubTasks,
    getUserAnnotation,
    getAnnotationsForTask,
    getConsensusAnnotation
  });

  // Use the annotation saver hook
  const {
    handleSaveAnnotation,
    handleOverrideAnnotation,
    loading: saverLoading
  } = useAnnotationSaver({
    task1SubTasks,
    task2SubTasks,
    task3SubTasks,
    consensusTask1,
    consensusTask2,
    consensusTask3,
    user,
    saveAnnotation,
    saveConsensusAnnotation,
    getUserAnnotation,
    getAnnotationsForTask,
    getConsensusAnnotation,
    updateStepCompletionStatus,
    overrideAnnotation
  });

  // Wrapper for loadUserAnnotation to use current user by default
  const loadUserAnnotation = useCallback((discussionId: string, taskId: number): SubTask[] | null => {
    if (!user) return null;
    return _loadUserAnnotation(discussionId, taskId, user.id);
  }, [_loadUserAnnotation, user]);

  // Load specific annotator's annotation (for pod leads to view/edit)
  const loadAnnotatorAnnotation = useCallback((discussionId: string, annotatorId: string, taskId: number): SubTask[] | null => {
    return _loadUserAnnotation(discussionId, taskId, annotatorId);
  }, [_loadUserAnnotation]);

  // Combine loading states
  const loading = loaderLoading || saverLoading;

  return {
    loadUserAnnotation,
    loadAnnotatorAnnotation,
    prepareConsensusView,
    handleSaveAnnotation,
    handleOverrideAnnotation,
    loading
  };
}

// Re-export isPodLead helper for convenience
export { isPodLead };
