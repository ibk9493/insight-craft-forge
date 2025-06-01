import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { GitBranch, Calendar, ExternalLink, AlertCircle, Search, GitCommit } from 'lucide-react';
import { toast } from 'sonner';
import { api } from '@/services/api';

interface CommitFinderModalProps {
  isOpen: boolean;
  onClose: () => void;
  discussionCreatedAt: string;
  discussionTitle: string;
  onCommitSelect?: (commit: CommitInfo) => void;
}

interface CommitInfo {
  sha: string;
  short_sha: string;
  message: string;
  author: {
    name: string;
    date: string;
  };
  url: string;
  hours_before_discussion: number;
}

const CommitFinderModal: React.FC<CommitFinderModalProps> = ({
  isOpen,
  onClose,
  discussionCreatedAt,
  discussionTitle,
  onCommitSelect
}) => {
  const [repositoryUrl, setRepositoryUrl] = useState('');
  const [commit, setCommit] = useState<CommitInfo | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const discussionDate = new Date(discussionCreatedAt);

  const fetchLatestCommit = async () => {
    if (!repositoryUrl.trim()) {
      toast.error('Please enter a repository URL');
      return;
    }

    // Basic GitHub URL validation
    if (!repositoryUrl.includes('github.com')) {
      toast.error('Please enter a valid GitHub repository URL');
      return;
    }

    setLoading(true);
    setError('');
    setCommit(null);

    try {
      // Use the new API endpoint
      const result = await api.github.getLatestCommit(
        repositoryUrl,
        discussionCreatedAt
      );

      if (!result.success) {
        throw new Error(result.message || 'Failed to fetch commit information');
      }

      if (!result.latest_commit) {
        setError('No commits found before the discussion creation date');
        return;
      }

      setCommit(result.latest_commit);

    } catch (err: any) {
      const errorMessage = err.message || 'Failed to fetch repository data';
      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleCommitSelect = (selectedCommit: CommitInfo) => {
    onCommitSelect?.(selectedCommit);
    toast.success(`Selected commit: ${selectedCommit.short_sha}`);
    onClose();
  };

  const formatRelativeTime = (hours: number) => {
    if (hours < 1) return 'Less than 1 hour before';
    if (hours < 24) return `${Math.round(hours)} hours before`;
    const days = Math.round(hours / 24);
    if (days === 1) return '1 day before';
    return `${days} days before`;
  };

  const isCloseToDiscussion = (hours: number) => {
    return hours <= 24; // Within 24 hours
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Search className="h-5 w-5 text-blue-500" />
            Find Latest Commit
          </DialogTitle>
          <DialogDescription>
            Find the latest commit before this discussion was created
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 flex-1 overflow-hidden flex flex-col">
          {/* Discussion Info */}
          <div className="p-3 bg-blue-50 rounded-lg">
            <div className="flex items-center gap-2 mb-1">
              <Badge variant="outline" className="bg-white">
                <Calendar className="h-3 w-3 mr-1" />
                {discussionDate.toLocaleDateString()} {discussionDate.toLocaleTimeString()}
              </Badge>
            </div>
            <p className="text-sm text-blue-700 font-medium">{discussionTitle}</p>
          </div>

          {/* Repository URL Input */}
          <div className="flex gap-2">
            <Input
              placeholder="https://github.com/owner/repository"
              value={repositoryUrl}
              onChange={(e) => setRepositoryUrl(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && fetchLatestCommit()}
            />
            <Button onClick={fetchLatestCommit} disabled={loading}>
              {loading ? (
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
              ) : (
                <Search className="h-4 w-4" />
              )}
            </Button>
          </div>

          {/* Loading State */}
          {loading && (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500" />
              <span className="ml-3 text-gray-600">Finding latest commit...</span>
            </div>
          )}

          {/* Error State */}
          {error && (
            <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg">
              <AlertCircle className="h-4 w-4 text-red-500" />
              <span className="text-sm text-red-700">{error}</span>
            </div>
          )}

          {/* Result */}
          {!loading && commit && (
            <div className="flex-1 overflow-y-auto">
              <h3 className="text-sm font-medium text-gray-700 mb-3">
                Latest commit before discussion:
              </h3>
              
              <Card className={`cursor-pointer transition-colors hover:bg-gray-50 ${
                isCloseToDiscussion(commit.hours_before_discussion) ? 'ring-2 ring-green-200 bg-green-50' : ''
              }`}>
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <div className="flex-shrink-0 w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center">
                      <GitBranch className="h-5 w-5 text-blue-600" />
                    </div>
                    
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-900 truncate">
                            {commit.message}
                          </p>
                          <div className="flex items-center gap-2 mt-1 flex-wrap">
                            <Badge variant="outline" className="text-xs">
                              {commit.short_sha}
                            </Badge>
                            <span className="text-xs text-gray-500">by {commit.author.name}</span>
                            {isCloseToDiscussion(commit.hours_before_discussion) && (
                              <Badge variant="default" className="bg-green-600 text-xs">
                                Close to discussion
                              </Badge>
                            )}
                          </div>
                        </div>
                        
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <span className="text-xs text-gray-500">
                            {formatRelativeTime(commit.hours_before_discussion)}
                          </span>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => window.open(commit.url, '_blank')}
                          >
                            <ExternalLink className="h-3 w-3" />
                          </Button>
                          <Button
                            size="sm"
                            onClick={() => handleCommitSelect(commit)}
                          >
                            Select
                          </Button>
                        </div>
                      </div>
                      
                      <p className="text-xs text-gray-600 mt-1">
                        {new Date(commit.author.date).toLocaleString()}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Empty State */}
          {!loading && !error && !commit && repositoryUrl && (
            <div className="text-center py-8 text-gray-500">
              <GitCommit className="h-12 w-12 mx-auto mb-4 text-gray-300" />
              <p>Enter a repository URL and click search to find the latest commit</p>
            </div>
          )}
        </div>

        <div className="flex justify-end gap-3 pt-4">
          {commit && (
            <Button 
              variant="outline"
              onClick={() => handleCommitSelect(commit)}
            >
              Use This Commit
            </Button>
          )}
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default CommitFinderModal;