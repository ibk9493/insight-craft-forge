
import React from 'react';
import { CheckCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ProgressStepperProps {
  steps: {
    id: number;
    title: string;
    completed: boolean;
  }[];
  currentStep: number;
}

const ProgressStepper: React.FC<ProgressStepperProps> = ({ steps, currentStep }) => {
  return (
    <div className="py-4 mb-6">
      <ol className="flex items-center w-full">
        {steps.map((step, index) => (
          <li 
            key={step.id} 
            className={cn(
              "flex items-center",
              index < steps.length - 1 ? "w-full" : ""
            )}
          >
            <div className="flex items-center justify-center">
              <div className={cn(
                "flex items-center justify-center w-8 h-8 rounded-full",
                currentStep >= step.id 
                  ? "bg-dashboard-blue text-white" 
                  : "bg-gray-200 text-gray-500"
              )}>
                {step.completed ? (
                  <CheckCircle className="w-5 h-5" />
                ) : (
                  <span>{step.id}</span>
                )}
              </div>
              <span className={cn(
                "ml-2 text-sm font-medium",
                currentStep >= step.id
                  ? "text-dashboard-blue"
                  : "text-gray-500"
              )}>
                {step.title}
              </span>
            </div>
            
            {index < steps.length - 1 && (
              <div className={cn(
                "flex-1 h-0.5 mx-4",
                currentStep > step.id ? "bg-dashboard-blue" : "bg-gray-200"
              )}></div>
            )}
          </li>
        ))}
      </ol>
    </div>
  );
};

export default ProgressStepper;
