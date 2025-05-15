
import React from 'react';
import { Button } from '@/components/ui/button';
import { ArrowLeft, ArrowRight } from 'lucide-react';

interface DashboardNavigationProps {
  viewMode: 'grid' | 'detail' | 'consensus';
  currentStep: number;
  canProceed: boolean;
  onBackToGrid: () => void;
  onSave: () => void;
  isConsensus: boolean;
}

const DashboardNavigation = ({
  viewMode,
  currentStep,
  canProceed,
  onBackToGrid,
  onSave,
  isConsensus
}: DashboardNavigationProps) => {
  return (
    <div className="flex justify-between mt-6">
      {viewMode !== 'grid' && (
        <Button
          onClick={onBackToGrid}
          variant="outline"
          className="flex items-center gap-2"
        >
          <ArrowLeft className="h-4 w-4" />
          <span>Back to Tasks</span>
        </Button>
      )}
      
      {viewMode !== 'grid' && currentStep < 4 && currentStep > 0 && (
        <Button
          onClick={onSave}
          disabled={!canProceed}
          className="flex items-center gap-2 bg-dashboard-blue hover:bg-blue-600 ml-auto"
        >
          <span>Save {isConsensus ? 'Consensus' : 'Annotation'}</span>
          <ArrowRight className="h-4 w-4" />
        </Button>
      )}
    </div>
  );
};

export default DashboardNavigation;
