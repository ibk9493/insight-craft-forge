import { SubTask } from "@/components/dashboard/TaskCard";

export const validateTask = (task: SubTask): string | null => {
    if (!task.validation) return null;
    
    const { required, minLength, maxLength, pattern, custom, dependsOn } = task.validation;
    
    // Check if field is required
    if (required) {
      if (task.id === 'question_image_links') {
        if (!task.selectedOption) return 'Please select an option';
        if (task.selectedOption === 'Provided' && (!task.imageLinks || task.imageLinks.filter(link => link.trim()).length === 0)) {
          return 'Please provide at least one image link';
        }
      } else if (task.multiline) {
        if (!task.textValues || task.textValues.filter(v => v.trim()).length === 0) {
          return 'This field is required';
        }
      } else if (task.structuredInput) {
        if (!task.supportingDocs || task.supportingDocs.filter(d => d.link.trim() && d.paragraph.trim()).length === 0) {
          return 'Please provide at least one supporting document';
        }
      } else if (!task.selectedOption && (!task.textValue || !task.textValue.trim())) {
        return 'This field is required';
      }
    }
    
    // Check text length
    if (task.textValue) {
      if (minLength && task.textValue.length < minLength) {
        return `Minimum ${minLength} characters required`;
      }
      if (maxLength && task.textValue.length > maxLength) {
        return `Maximum ${maxLength} characters allowed`;
      }
      if (pattern && !pattern.test(task.textValue)) {
        return 'Invalid format';
      }
    }
    
    // Custom validation
    if (custom) {
      return custom(task);
    }
    
    return null;
  };
  
  export const validateForm = (tasks: SubTask[]): { [taskId: string]: string } => {
    const errors: { [taskId: string]: string } = {};
    
    tasks.forEach(task => {
      const error = validateTask(task);
      if (error) {
        errors[task.id] = error;
      }
    });
    
    return errors;
  };

  export const hasValidationErrors = (tasks: SubTask[]): boolean => {
    return tasks.some(task => task.validationError);
  };

  export const getValidationErrorCount = (tasks: SubTask[]): number => {
    return tasks.filter(task => task.validationError).length;
  };

  export const validateAllTasks = (taskSets: { [key: string]: SubTask[] }): { [key: string]: { [taskId: string]: string } } => {
    const allErrors: { [key: string]: { [taskId: string]: string } } = {};
    
    Object.keys(taskSets).forEach(setKey => {
      const errors = validateForm(taskSets[setKey]);
      if (Object.keys(errors).length > 0) {
        allErrors[setKey] = errors;
      }
    });
    
    return allErrors;
  };

  // Helper function to check if a task can be marked as completed
  export const canCompleteTask = (task: SubTask): boolean => {
    const error = validateTask(task);
    return !error;
  };

  // Helper function to validate URL formats
  export const isValidUrl = (url: string): boolean => {
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  };

  // Helper function to validate GitHub URLs specifically
  export const isValidGitHubUrl = (url: string): boolean => {
    if (!isValidUrl(url)) return false;
    try {
      const urlObj = new URL(url);
      return urlObj.hostname === 'github.com' && 
             (url.includes('/archive/') || url.includes('/releases/download/'));
    } catch {
      return false;
    }
  };

  // Helper function to validate Google Drive URLs
  export const isValidGoogleDriveUrl = (url: string): boolean => {
    if (!isValidUrl(url)) return false;
    try {
      const urlObj = new URL(url);
      return urlObj.hostname === 'drive.google.com';
    } catch {
      return false;
    }
  };