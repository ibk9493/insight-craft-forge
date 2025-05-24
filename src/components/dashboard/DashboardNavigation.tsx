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
  screenshotUrl?: string | null;
  onScreenshotUrlChange?: (url: string) => void;
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
                               screenshotUrl,
                               onScreenshotUrlChange,
                               codeDownloadUrl,
                               discussionId,
                               onCodeUrlChange,
                               onCodeUrlVerify,
                               currentDiscussion
                             }: DashboardNavigationProps) => {
  const navigate = useNavigate();
  const dispatch = useAppDispatch();

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

        {/* REMOVED: Screenshot and Code URL fields - these are now handled in TaskCard for Task 2 */}

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