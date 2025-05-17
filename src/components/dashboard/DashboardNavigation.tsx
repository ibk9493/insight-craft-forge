import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Home, Upload, Download, ListFilter, CheckCircle, XCircle, Tag, Eye } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Discussion } from '@/services/api';
import DiscussionDetailsModal from './DiscussionDetailsModal';
import { useAppDispatch } from '@/hooks';
import { openModal } from '@/store/discussionModalSlice';

interface DashboardNavigationProps {
  viewMode: 'grid' | 'detail' | 'consensus';
  currentStep: number;
  canProceed: boolean;
  onBackToGrid: () => void;
  onSave: () => void;
  isConsensus: boolean;
  onFileUpload?: (file: File) => void;
  codeDownloadUrl?: string | null;
  discussionId?: string;
  onCodeUrlChange?: (url: string) => void;
  onCodeUrlVerify?: (url: string) => boolean;
  currentDiscussion?: Discussion | null;
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
  discussionId,
  onCodeUrlChange,
  onCodeUrlVerify,
  currentDiscussion
}: DashboardNavigationProps) => {
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const [useAutomaticUrl, setUseAutomaticUrl] = useState<boolean>(true);
  
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

  // Function to open the discussion details modal
  const handleViewDiscussionDetails = () => {
    if (currentDiscussion) {
      dispatch(openModal(currentDiscussion));
    }
  };

  // Handle code URL input change
  const handleCodeUrlChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (onCodeUrlChange) {
      onCodeUrlChange(e.target.value);
      // When manually editing, disable automatic URL
      setUseAutomaticUrl(false);
    }
  };
  
  // Use repository release URL if available
  useEffect(() => {
    if (useAutomaticUrl && currentDiscussion?.releaseUrl && onCodeUrlChange) {
      onCodeUrlChange(currentDiscussion.releaseUrl);
    }
  }, [currentDiscussion, useAutomaticUrl, onCodeUrlChange]);
  
  // Toggle between automatic and manual URLs
  const toggleUrlMode = () => {
    setUseAutomaticUrl(!useAutomaticUrl);
    if (!useAutomaticUrl && currentDiscussion?.releaseUrl && onCodeUrlChange) {
      // Switching back to automatic - use the repository release URL
      onCodeUrlChange(currentDiscussion.releaseUrl);
    }
  };
  
  // Validate if URL is correct GitHub URL format
  const isValidGitHubUrl = (url: string | null | undefined): boolean => {
    if (!url) return false;
    return onCodeUrlVerify ? onCodeUrlVerify(url) : false;
  };

  return (
    <div className="flex flex-col space-y-4 mt-6">
      <div className="flex justify-between items-center">
        {viewMode !== 'grid' && (
          <div className="flex gap-2 flex-wrap">
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
            
            {/* Add Discussion Details Modal button */}
            {currentDiscussion && (
              <Button
                variant="outline"
                className="flex items-center gap-2"
                onClick={handleViewDiscussionDetails}
              >
                <Eye className="h-4 w-4" />
                <span>View Discussion</span>
              </Button>
            )}
          </div>
        )}
      </div>

      {viewMode !== 'grid' && currentStep === 2 && (
        <div className="flex flex-col gap-4 mt-2">
          {/* File upload button for screenshots */}
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
          
          {/* Code download URL input field with validation */}
          <div className="flex flex-col space-y-2 w-full">
            <div className="flex items-center gap-2 justify-between">
              <div className="flex-1">
                <label htmlFor="code-url" className="text-sm font-medium text-gray-700 mb-1 block">Code Download URL</label>
                <div className="flex gap-2 items-center">
                  <Input
                    id="code-url"
                    type="text"
                    value={codeDownloadUrl || ''}
                    onChange={handleCodeUrlChange}
                    placeholder="https://github.com/owner/repo/archive/refs/tags/version.tar.gz"
                    className="flex-1"
                    disabled={useAutomaticUrl && !!currentDiscussion?.releaseUrl}
                  />
                  {codeDownloadUrl && (
                    isValidGitHubUrl(codeDownloadUrl) ? 
                      <CheckCircle className="h-5 w-5 text-green-500" /> : 
                      <XCircle className="h-5 w-5 text-red-500" />
                  )}
                </div>
              </div>
            </div>
            
            {/* Show repository release info if available */}
            {currentDiscussion?.releaseTag && (
              <div className="flex items-center gap-2 text-sm">
                <Tag className="h-4 w-4 text-blue-500" />
                <span>
                  {useAutomaticUrl ? 
                    `Using release: ${currentDiscussion.releaseTag}` : 
                    `Repository has release: ${currentDiscussion.releaseTag}`
                  }
                </span>
                <Button 
                  variant="ghost" 
                  size="sm"
                  className="text-xs"
                  onClick={toggleUrlMode}
                >
                  {useAutomaticUrl ? 'Use custom URL' : 'Use release URL'}
                </Button>
              </div>
            )}
            
            <div className="flex items-center gap-2">
              <Checkbox 
                id="url-verified" 
                checked={isValidGitHubUrl(codeDownloadUrl)}
                className="data-[state=checked]:bg-green-500"
                disabled
              />
              <label htmlFor="url-verified" className="text-sm">
                {isValidGitHubUrl(codeDownloadUrl) ? 'URL Valid' : 'URL Invalid'}
              </label>
            </div>
            
            {codeDownloadUrl && isValidGitHubUrl(codeDownloadUrl) && (
              <a
                href={codeDownloadUrl}
                download
                className="flex items-center gap-2 bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded w-fit"
                target="_blank"
                rel="noopener noreferrer"
              >
                <Download className="h-4 w-4" />
                <span>Download Code</span>
              </a>
            )}
          </div>
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
