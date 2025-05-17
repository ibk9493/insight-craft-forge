
import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Home, Upload, Download, ListFilter, CheckCircle, XCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';

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
  onCodeUrlChange?: (url: string) => void;
  onCodeUrlVerify?: (url: string) => boolean;
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
  onCodeUrlVerify
}: DashboardNavigationProps) => {
  const navigate = useNavigate();
  const [codeUrl, setCodeUrl] = useState(codeDownloadUrl || '');
  const [codeUrlVerified, setCodeUrlVerified] = useState(!!codeDownloadUrl);
  
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

  // Handle code URL input change
  const handleCodeUrlChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const url = e.target.value;
    setCodeUrl(url);
    
    // If there's a handler for URL changes, call it
    if (onCodeUrlChange) {
      onCodeUrlChange(url);
    }
    
    // Check if URL is valid
    if (url) {
      const isValid = onCodeUrlVerify ? onCodeUrlVerify(url) : isValidGithubUrl(url);
      setCodeUrlVerified(isValid);
    } else {
      setCodeUrlVerified(false);
    }
  };
  
  // Simple Github URL validation
  const isValidGithubUrl = (url: string): boolean => {
    return url.includes('github.com') && 
      (url.includes('/archive/refs/tags/') || url.includes('/archive/refs/heads/'));
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
            <div className="flex items-center gap-2">
              <div className="flex-1">
                <label htmlFor="code-url" className="text-sm font-medium text-gray-700 mb-1 block">Code Download URL</label>
                <div className="flex gap-2 items-center">
                  <Input
                    id="code-url"
                    type="text"
                    value={codeUrl}
                    onChange={handleCodeUrlChange}
                    placeholder="https://github.com/owner/repo/archive/refs/tags/version.tar.gz"
                    className="flex-1"
                  />
                  {codeUrlVerified ? 
                    <CheckCircle className="h-5 w-5 text-green-500" /> : 
                    codeUrl ? <XCircle className="h-5 w-5 text-red-500" /> : null
                  }
                </div>
              </div>
              <div className="flex items-center gap-2 mt-6">
                <Checkbox 
                  id="url-verified" 
                  checked={codeUrlVerified}
                  className="data-[state=checked]:bg-green-500"
                  disabled
                />
                <label htmlFor="url-verified" className="text-sm">
                  {codeUrlVerified ? 'URL Valid' : 'URL Invalid'}
                </label>
              </div>
            </div>
            
            {codeUrl && codeUrlVerified && (
              <a
                href={codeUrl}
                download
                className="flex items-center gap-2 bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded w-fit"
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
