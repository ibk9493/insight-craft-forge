import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { GitBranch, Calendar, ExternalLink, AlertCircle, Search, GitCommit, Clock, Tag } from 'lucide-react';
import { toast } from 'sonner';
import { api } from '@/services/api';

interface CommitFinderModalProps {
  isOpen: boolean;
  onClose: () => void;
  discussionCreatedAt: string;
  discussionTitle: string;
  onCommitSelect?: (commit: CommitInfo) => void;
  onTagSelect?: (tag: TagInfo) => void;
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

interface TagInfo {
  name: string;
  sha: string;
  short_sha: string;
  url: string;
  date: string;
  hours_before_discussion: number;
  message?: string;
}

const CommitFinderModal: React.FC<CommitFinderModalProps> = ({
  isOpen,
  onClose,
  discussionCreatedAt,
  discussionTitle,
  onCommitSelect,
  onTagSelect
}) => {
  const [repositoryUrl, setRepositoryUrl] = useState('');
  const [commit, setCommit] = useState<CommitInfo | null>(null);
  const [tag, setTag] = useState<TagInfo | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [useCustomDate, setUseCustomDate] = useState(false);
  const [customDate, setCustomDate] = useState('');
  const [customTime, setCustomTime] = useState('');
  const [searchType, setSearchType] = useState<'commit' | 'tag'>('commit');

  const discussionDate = new Date(discussionCreatedAt);

  // Get the effective date to use for search
  const getEffectiveDate = () => {
    if (useCustomDate && customDate) {
      const timeValue = customTime || '23:59'; // Default to end of day if no time specified
      const dateTimeString = `${customDate}T${timeValue}:00`;
      return new Date(dateTimeString).toISOString();
    }
    return discussionCreatedAt;
  };

  // Get the display date info
  const getDateInfo = () => {
    if (useCustomDate && customDate) {
      const effectiveDate = new Date(getEffectiveDate());
      return {
        date: effectiveDate,
        label: 'Custom Date',
        description: `Find the latest ${searchType} before this custom date`
      };
    }
    return {
      date: discussionDate,
      label: 'Discussion Created',
      description: `Find the latest ${searchType} before this discussion was created`
    };
  };

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

    // Validate custom date if being used
    if (useCustomDate && customDate) {
      const effectiveDate = new Date(getEffectiveDate());
      if (isNaN(effectiveDate.getTime())) {
        toast.error('Please enter a valid date and time');
        return;
      }
    }

    setLoading(true);
    setError('');
    setCommit(null);
    setTag(null);

    try {
      // Use the effective date for the API call
      const searchDate = getEffectiveDate();
      
      let result;
      if (searchType === 'commit') {
        result = await api.github.getLatestCommit(repositoryUrl, searchDate);
      } else {
        result = await api.github.getLatestTag(repositoryUrl, searchDate);
      }

      if (!result.success) {
        throw new Error(result.message || `Failed to fetch ${searchType} information`);
      }

      if (searchType === 'commit' && !result.latest_commit) {
        const dateInfo = getDateInfo();
        setError(`No commits found before ${dateInfo.date.toLocaleDateString()} ${dateInfo.date.toLocaleTimeString()}`);
        return;
      }

      if (searchType === 'tag' && !result.latest_tag) {
        const dateInfo = getDateInfo();
        setError(`No tags found before ${dateInfo.date.toLocaleDateString()} ${dateInfo.date.toLocaleTimeString()}`);
        return;
      }

      if (searchType === 'commit') {
        setCommit(result.latest_commit);
      } else {
        setTag(result.latest_tag);
      }

    } catch (err: any) {
      const errorMessage = err.message || `Failed to fetch repository data`;
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

  const handleTagSelect = (selectedTag: TagInfo) => {
    onTagSelect?.(selectedTag);
    toast.success(`Selected tag: ${selectedTag.name}`);
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

  // Initialize custom date with discussion date when toggling
  const handleToggleCustomDate = (checked: boolean) => {
    setUseCustomDate(checked);
    if (checked && !customDate) {
      // Initialize with discussion date
      const discussionDateOnly = discussionDate.toISOString().split('T')[0];
      const discussionTimeOnly = discussionDate.toTimeString().slice(0, 5);
      setCustomDate(discussionDateOnly);
      setCustomTime(discussionTimeOnly);
    }
    // Clear any existing results when switching
    setCommit(null);
    setTag(null);
    setError('');
  };

  // Handle search type toggle
  const handleSearchTypeChange = (newType: 'commit' | 'tag') => {
    setSearchType(newType);
    // Clear any existing results when switching
    setCommit(null);
    setTag(null);
    setError('');
  };

  const dateInfo = getDateInfo();

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Search className="h-5 w-5 text-blue-500" />
            Find Latest {searchType === 'commit' ? 'Commit' : 'Tag'}
          </DialogTitle>
          <DialogDescription>
            {dateInfo.description}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 flex-1 overflow-hidden flex flex-col">
          {/* Search Type Toggle */}
          <div className="flex items-center justify-center gap-1 p-1 bg-gray-100 rounded-lg">
            <Button
              variant={searchType === 'commit' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => handleSearchTypeChange('commit')}
              className="flex items-center gap-2"
            >
              <GitCommit className="h-4 w-4" />
              Commit
            </Button>
            <Button
              variant={searchType === 'tag' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => handleSearchTypeChange('tag')}
              className="flex items-center gap-2"
            >
              <Tag className="h-4 w-4" />
              Tag
            </Button>
          </div>
          {/* Date Selection */}
          <div className="p-3 bg-blue-50 rounded-lg">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="bg-white">
                  <Calendar className="h-3 w-3 mr-1" />
                  {dateInfo.label}
                </Badge>
                <span className="text-sm text-blue-700">
                  {dateInfo.date.toLocaleDateString()} {dateInfo.date.toLocaleTimeString()}
                </span>
              </div>
              
              <div className="flex items-center gap-2">
                <label className="flex items-center gap-2 text-sm text-blue-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={useCustomDate}
                    onChange={(e) => handleToggleCustomDate(e.target.checked)}
                    className="rounded"
                  />
                  <Clock className="h-3 w-3" />
                  Use custom date
                </label>
              </div>
            </div>
            
            {/* Custom Date Inputs */}
            {useCustomDate && (
              <div className="flex gap-2 mt-2">
                <div className="flex-1">
                  <label className="block text-xs text-blue-600 mb-1">Date</label>
                  <Input
                    type="date"
                    value={customDate}
                    onChange={(e) => setCustomDate(e.target.value)}
                    className="text-sm"
                  />
                </div>
                <div className="flex-1">
                  <label className="block text-xs text-blue-600 mb-1">Time (optional)</label>
                  <Input
                    type="time"
                    value={customTime}
                    onChange={(e) => setCustomTime(e.target.value)}
                    placeholder="23:59"
                    className="text-sm"
                  />
                </div>
              </div>
            )}
            
            {!useCustomDate && (
              <p className="text-sm text-blue-700 font-medium">{discussionTitle}</p>
            )}
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
              <span className="ml-3 text-gray-600">Finding latest {searchType}...</span>
            </div>
          )}

          {/* Error State */}
          {error && (
            <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg">
              <AlertCircle className="h-4 w-4 text-red-500" />
              <span className="text-sm text-red-700">{error}</span>
            </div>
          )}

          {/* Result - Commit */}
          {!loading && commit && searchType === 'commit' && (
            <div className="flex-1 overflow-y-auto">
              <h3 className="text-sm font-medium text-gray-700 mb-3">
                Latest commit before {useCustomDate ? 'custom date' : 'discussion'}:
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
                                Close to target date
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

          {/* Result - Tag */}
          {!loading && tag && searchType === 'tag' && (
            <div className="flex-1 overflow-y-auto">
              <h3 className="text-sm font-medium text-gray-700 mb-3">
                Latest tag before {useCustomDate ? 'custom date' : 'discussion'}:
              </h3>
              
              <Card className={`cursor-pointer transition-colors hover:bg-gray-50 ${
                isCloseToDiscussion(tag.hours_before_discussion) ? 'ring-2 ring-green-200 bg-green-50' : ''
              }`}>
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <div className="flex-shrink-0 w-10 h-10 rounded-full bg-purple-100 flex items-center justify-center">
                      <Tag className="h-5 w-5 text-purple-600" />
                    </div>
                    
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-900 truncate">
                            {tag.name}
                          </p>
                          {tag.message && (
                            <p className="text-xs text-gray-600 mt-1 truncate">
                              {tag.message}
                            </p>
                          )}
                          <div className="flex items-center gap-2 mt-1 flex-wrap">
                            <Badge variant="outline" className="text-xs">
                              {tag.short_sha}
                            </Badge>
                            {isCloseToDiscussion(tag.hours_before_discussion) && (
                              <Badge variant="default" className="bg-green-600 text-xs">
                                Close to target date
                              </Badge>
                            )}
                          </div>
                        </div>
                        
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <span className="text-xs text-gray-500">
                            {formatRelativeTime(tag.hours_before_discussion)}
                          </span>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => window.open(tag.url, '_blank')}
                          >
                            <ExternalLink className="h-3 w-3" />
                          </Button>
                          <Button
                            size="sm"
                            onClick={() => handleTagSelect(tag)}
                          >
                            Select
                          </Button>
                        </div>
                      </div>
                      
                      <p className="text-xs text-gray-600 mt-1">
                        {new Date(tag.date).toLocaleString()}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Empty State */}
          {!loading && !error && !commit && !tag && repositoryUrl && (
            <div className="text-center py-8 text-gray-500">
              {searchType === 'commit' ? (
                <GitCommit className="h-12 w-12 mx-auto mb-4 text-gray-300" />
              ) : (
                <Tag className="h-12 w-12 mx-auto mb-4 text-gray-300" />
              )}
              <p>Enter a repository URL and click search to find the latest {searchType}</p>
            </div>
          )}
        </div>

        <div className="flex justify-end gap-3 pt-4">
          {commit && searchType === 'commit' && (
            <Button 
              variant="outline"
              onClick={() => handleCommitSelect(commit)}
            >
              Use This Commit
            </Button>
          )}
          {tag && searchType === 'tag' && (
            <Button 
              variant="outline"
              onClick={() => handleTagSelect(tag)}
            >
              Use This Tag
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