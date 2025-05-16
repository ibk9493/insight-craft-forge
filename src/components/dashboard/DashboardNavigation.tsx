
import React from 'react';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Home, Upload, Download, ListFilter } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface DashboardNavigationProps {
  viewMode: 'grid' | 'detail' | 'consensus';
  currentStep: number;
  canProceed: boolean;
  onBackToGrid: () => void;
  onSave: () => void;
  isConsensus: boolean;
  onFileUpload?: (file: File) => void;
  codeDownloadUrl?: string;
  discussionId?: string;
}

const DashboardNavigation = ({
  viewMode,
  currentStep,
  canProceed,
  onBackToGrid,
  onSave,
  isConsensus,
  onFileUpload,
  codeDownloadUrl,
  discussionId
}: DashboardNavigationProps) => {
  const navigate = useNavigate();
  
  // Handle file input change
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0] && onFileUpload) {
      onFileUpload(e.target.files[0]);
    }
  };

  // Navigate back to discussions list
  const handleBackToDiscussions = () => {
    navigate('/discussions');
  };
  
  // Navigate to dashboard home
  const handleGoToDashboard = () => {
    navigate('/dashboard');
  };

  return (
    <div className="flex flex-col space-y-4 mt-6">
      <div className="flex justify-between items-center">
        {viewMode !== 'grid' && (
          <div className="flex gap-2">
            <Button
              onClick={onBackToGrid}
              variant="outline"
              className="flex items-center gap-2"
            >
              <ArrowLeft className="h-4 w-4" />
              <span>View All Tasks</span>
            </Button>
            
            {discussionId && (
              <Button
                onClick={handleBackToDiscussions}
                variant="outline"
                className="flex items-center gap-2"
              >
                <ListFilter className="h-4 w-4" />
                <span>Back to Discussions</span>
              </Button>
            )}
            
            <Button
              onClick={handleGoToDashboard}
              variant="outline"
              className="flex items-center gap-2"
            >
              <Home className="h-4 w-4" />
              <span>Dashboard Home</span>
            </Button>
          </div>
        )}
      </div>

      {viewMode !== 'grid' && currentStep === 2 && (
        <div className="flex flex-wrap gap-4 mt-2">
          {/* File upload button for manual code execution check */}
          <div className="flex items-center">
            <input
              type="file"
              id="file-upload"
              className="hidden"
              onChange={handleFileChange}
              accept="image/*"
            />
            <label
              htmlFor="file-upload"
              className="cursor-pointer flex items-center gap-2 bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded"
            >
              <Upload className="h-4 w-4" />
              <span>Upload Screenshot</span>
            </label>
          </div>
          
          {/* Code download link */}
          {codeDownloadUrl && (
            <a
              href={codeDownloadUrl}
              download
              className="flex items-center gap-2 bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded"
            >
              <Download className="h-4 w-4" />
              <span>Download Code</span>
            </a>
          )}
        </div>
      )}
      
      {viewMode !== 'grid' && currentStep < 4 && currentStep > 0 && (
        <div className="flex justify-end mt-2">
          <Button
            onClick={onSave}
            disabled={!canProceed}
            className="flex items-center gap-2 bg-dashboard-blue hover:bg-blue-600"
          >
            <span>Save {isConsensus ? 'Consensus' : 'Annotation'}</span>
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </div>
      )}
    </div>
  );
};

export default DashboardNavigation;
