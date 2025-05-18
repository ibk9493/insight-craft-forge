import React from 'react';
import { Link } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';
import {
  Breadcrumb,
  BreadcrumbList,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbSeparator,
  BreadcrumbPage,
} from '@/components/ui/breadcrumb';

// Define TaskId enum directly if there's an issue with the import
enum TaskId {
  QUESTION_QUALITY = 1,
  ANSWER_QUALITY = 2,
  REWRITE = 3,
  SUMMARY = 4
}

interface DashboardBreadcrumbProps {
  discussionId?: string;
  currentStep: number;
  discussionTitle?: string;
}

const DashboardBreadcrumb: React.FC<DashboardBreadcrumbProps> = ({
  discussionId,
  currentStep,
  discussionTitle = 'Discussion'
}) => {
  // Get the accurate task name based on the current step
  const getTaskName = (taskId: number) => {
    switch (taskId) {
      case TaskId.QUESTION_QUALITY:
        return 'Task 1: Question Quality';
      case TaskId.ANSWER_QUALITY:
        return 'Task 2: Answer Quality';
      case TaskId.REWRITE:
        return 'Task 3: Rewrite';
      case TaskId.SUMMARY:
        return 'Summary';
      default:
        return 'Tasks';
    }
  };

  return (
    <Breadcrumb className="mb-6">
      <BreadcrumbList>
        <BreadcrumbItem>
          <BreadcrumbLink asChild>
            <Link to="/discussions">Discussions</Link>
          </BreadcrumbLink>
        </BreadcrumbItem>
        
        <BreadcrumbSeparator>
          <ChevronRight className="h-4 w-4" />
        </BreadcrumbSeparator>
        
        {discussionId && (
          <>
            <BreadcrumbItem>
              <BreadcrumbLink asChild>
                <Link to={`/dashboard?discussionId=${discussionId}`}>{discussionTitle}</Link>
              </BreadcrumbLink>
            </BreadcrumbItem>
            
            <BreadcrumbSeparator>
              <ChevronRight className="h-4 w-4" />
            </BreadcrumbSeparator>
          </>
        )}
        
        {currentStep > 0 && (
          <BreadcrumbItem>
            <BreadcrumbPage>{getTaskName(currentStep)}</BreadcrumbPage>
          </BreadcrumbItem>
        )}
      </BreadcrumbList>
    </Breadcrumb>
  );
};

export default DashboardBreadcrumb;