import React, { useState, useEffect, useRef } from 'react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Calendar } from '@/components/ui/calendar';
import { 
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Filter, Calendar as CalendarIcon, Search, X, Tag, Code, Check, Lock, Unlock, CheckCircle } from 'lucide-react';
import { format } from 'date-fns';
import { Badge } from '@/components/ui/badge';

interface FilterValues {
  status: string;
  showMyAnnotations: boolean;
  repositoryLanguage: string[];
  releaseTag: string[];
  fromDate: Date | undefined;
  toDate: Date | undefined;
  batchId: string;
   taskStatuses: {
    task1: string; // 'all' | 'locked' | 'unlocked' | 'completed'
    task2: string;
    task3: string;
  };
}

interface DiscussionFiltersProps {
  onFilterChange: (filters: FilterValues) => void;
  availableLanguages: string[];
  availableTags: string[];
  availableBatches: { id: number, name: string }[];
  initialFilters?: Partial<FilterValues>;
}

const DiscussionFilters: React.FC<DiscussionFiltersProps> = ({
  onFilterChange,
  availableLanguages = [],
  availableTags = [],
  availableBatches = [],
  initialFilters = {}
}) => {
  const [filters, setFilters] = useState<FilterValues>({
    status: initialFilters.status || 'all',
    showMyAnnotations: initialFilters.showMyAnnotations || false,
    repositoryLanguage: initialFilters.repositoryLanguage || [],
    releaseTag: initialFilters.releaseTag || [],
    fromDate: initialFilters.fromDate,
    toDate: initialFilters.toDate,
    batchId: initialFilters.batchId || '',
    taskStatuses: {
      task1: initialFilters.taskStatuses?.task1 || 'all',
      task2: initialFilters.taskStatuses?.task2 || 'all',
      task3: initialFilters.taskStatuses?.task3 || 'all'
    }
  });
  
  const [isOpen, setIsOpen] = useState(false);
  const isInitializing = useRef(true);
  
  // Count active filters (excluding status='all' which is default)
  const activeFilterCount = [
    filters.status !== 'all',
    filters.showMyAnnotations,
    filters.repositoryLanguage.length > 0,
    filters.releaseTag.length > 0,
    filters.fromDate !== undefined,
    filters.toDate !== undefined,
    filters.batchId !== '',
    filters.taskStatuses.task1 !== 'all',
    filters.taskStatuses.task2 !== 'all',
    filters.taskStatuses.task3 !== 'all'
  ].filter(Boolean).length;
  
  // REMOVED: The problematic useEffect that calls onFilterChange on every filter change
  // This was causing the cascading API calls
  
  // Update filters when initialFilters prop changes (for browser navigation)
  // BUT only update internal state, don't call onFilterChange automatically
  useEffect(() => {
    // Only update if there are actual differences
    const shouldUpdate = 
      filters.status !== (initialFilters.status || 'all') ||
      filters.showMyAnnotations !== (initialFilters.showMyAnnotations || false) ||
      JSON.stringify(filters.repositoryLanguage) !== JSON.stringify(initialFilters.repositoryLanguage || []) ||
      JSON.stringify(filters.releaseTag) !== JSON.stringify(initialFilters.releaseTag || []) ||
      filters.fromDate !== initialFilters.fromDate ||
      filters.toDate !== initialFilters.toDate ||
      filters.batchId !== (initialFilters.batchId || '') ||
      filters.taskStatuses.task1 !== (initialFilters.taskStatuses?.task1 || 'all') ||
      filters.taskStatuses.task2 !== (initialFilters.taskStatuses?.task2 || 'all') ||
      filters.taskStatuses.task3 !== (initialFilters.taskStatuses?.task3 || 'all');

    if (shouldUpdate) {
      console.log('DiscussionFilters: Updating from initialFilters prop');
      setFilters({
        status: initialFilters.status || 'all',
        showMyAnnotations: initialFilters.showMyAnnotations || false,
        repositoryLanguage: initialFilters.repositoryLanguage || [],
        releaseTag: initialFilters.releaseTag || [],
        fromDate: initialFilters.fromDate,
        toDate: initialFilters.toDate,
        batchId: initialFilters.batchId || '',
        taskStatuses: {
          task1: initialFilters.taskStatuses?.task1 || 'all',
          task2: initialFilters.taskStatuses?.task2 || 'all',
          task3: initialFilters.taskStatuses?.task3 || 'all'
        }
      });
    }
  }, [
    initialFilters.status,
    initialFilters.showMyAnnotations,
    initialFilters.repositoryLanguage,
    initialFilters.releaseTag,
    initialFilters.fromDate,
    initialFilters.toDate,
    initialFilters.batchId,
    initialFilters.taskStatuses?.task1,
    initialFilters.taskStatuses?.task2,
    initialFilters.taskStatuses?.task3,
    filters.status,
    filters.showMyAnnotations,
    filters.repositoryLanguage,
    filters.releaseTag,
    filters.fromDate,
    filters.toDate,
    filters.batchId,
    filters.taskStatuses.task1,
    filters.taskStatuses.task2,
    filters.taskStatuses.task3
  ]);

  // Helper function to notify parent of changes
  const notifyFilterChange = (newFilters: FilterValues) => {
    console.log('DiscussionFilters: Notifying parent of filter change');
    onFilterChange(newFilters);
  };
  
  const handleStatusChange = (status: string) => {
    const newFilters = { ...filters, status };
    setFilters(newFilters);
    notifyFilterChange(newFilters);
  };
  
  const handleMyAnnotationsChange = (checked: boolean) => {
    const newFilters = { ...filters, showMyAnnotations: checked };
    setFilters(newFilters);
    notifyFilterChange(newFilters);
  };
  
  const handleLanguageToggle = (language: string) => {
    const newFilters = {
      ...filters,
      repositoryLanguage: filters.repositoryLanguage.includes(language)
        ? filters.repositoryLanguage.filter(l => l !== language)
        : [...filters.repositoryLanguage, language]
    };
    setFilters(newFilters);
    notifyFilterChange(newFilters);
  };
  
  const handleTagToggle = (tag: string) => {
    const newFilters = {
      ...filters,
      releaseTag: filters.releaseTag.includes(tag)
        ? filters.releaseTag.filter(t => t !== tag)
        : [...filters.releaseTag, tag]
    };
    setFilters(newFilters);
    notifyFilterChange(newFilters);
  };
  
  const handleBatchChange = (batchId: string) => {
    const newFilters = { ...filters, batchId };
    setFilters(newFilters);
    notifyFilterChange(newFilters);
  };
  
  const handleFromDateChange = (date: Date | undefined) => {
    const newFilters = { ...filters, fromDate: date };
    setFilters(newFilters);
    notifyFilterChange(newFilters);
  };
  
  const handleToDateChange = (date: Date | undefined) => {
    const newFilters = { ...filters, toDate: date };
    setFilters(newFilters);
    notifyFilterChange(newFilters);
  };

  // New handlers for task status filters
  const handleTaskStatusChange = (taskNumber: 1 | 2 | 3, status: string) => {
    const newFilters = {
      ...filters,
      taskStatuses: {
        ...filters.taskStatuses,
        [`task${taskNumber}`]: status
      }
    };
    setFilters(newFilters);
    notifyFilterChange(newFilters);
  };

  const getTaskStatusIcon = (status: string) => {
    switch (status) {
      case 'locked':
        return <Lock className="h-3.5 w-3.5" />;
      case 'unlocked':
        return <Unlock className="h-3.5 w-3.5" />;
      case 'completed':
        return <CheckCircle className="h-3.5 w-3.5" />;
      default:
        return null;
    }
  };

  const getTaskStatusLabel = (status: string) => {
    switch (status) {
      case 'locked':
        return 'Locked';
      case 'unlocked':
        return 'Unlocked';
      case 'completed':
        return 'Completed';
      default:
        return 'All';
    }
  };
  
  const clearFilters = () => {
    const clearedFilters = {
      status: 'all',
      showMyAnnotations: false,
      repositoryLanguage: [],
      releaseTag: [],
      fromDate: undefined,
      toDate: undefined,
      batchId: '',
      taskStatuses: {
        task1: 'all',
        task2: 'all',
        task3: 'all'
      }
    };
    setFilters(clearedFilters);
    notifyFilterChange(clearedFilters);
  };
  
  return (
    <div className="flex flex-col md:flex-row gap-2 w-full">
      {/* Status filter select */}
      <Select value={filters.status} onValueChange={handleStatusChange}>
        <SelectTrigger className="w-[180px]">
          <SelectValue placeholder="Filter by status" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Discussions</SelectItem>
          <SelectItem value="completed">Completed</SelectItem>
          <SelectItem value="unlocked">In Progress</SelectItem>
          <SelectItem value="locked">Not Started</SelectItem>
        </SelectContent>
      </Select>
      
      {/* Advanced filters popover */}
      <Popover open={isOpen} onOpenChange={setIsOpen}>
        <PopoverTrigger asChild>
          <Button variant="outline" className="relative">
            <Filter className="h-4 w-4 mr-2" />
            Advanced Filters
            {activeFilterCount > 0 && (
              <Badge variant="secondary" className="ml-2 h-5 w-5 p-0 flex items-center justify-center rounded-full">
                {activeFilterCount}
              </Badge>
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[400px] p-4 max-h-[600px] overflow-y-auto" align="start">
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <h4 className="font-medium">Filter Discussions</h4>
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={clearFilters}
                className="h-8 px-2 text-xs"
              >
                Clear All
              </Button>
            </div>
            
            <Separator />
            
            {/* My Annotations filter */}
            <div className="flex items-center space-x-2">
              <Checkbox 
                id="my-annotations" 
                checked={filters.showMyAnnotations}
                onCheckedChange={(checked) => handleMyAnnotationsChange(checked === true)}
              />
              <Label htmlFor="my-annotations">My Annotations Only</Label>
            </div>
            
            <Separator />
            
            {/* Task Status Filters */}
            <div className="space-y-3">
              <Label className="text-sm font-medium">Task Status Filters</Label>
              
              {/* Task 1 Filter */}
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">Task 1: Question Quality</Label>
                <Select 
                  value={filters.taskStatuses.task1} 
                  onValueChange={(value) => handleTaskStatusChange(1, value)}
                >
                  <SelectTrigger className="w-full h-8">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Statuses</SelectItem>
                    <SelectItem value="locked">
                      <div className="flex items-center gap-2">
                        <Lock className="h-3.5 w-3.5" />
                        Locked
                      </div>
                    </SelectItem>
                    <SelectItem value="unlocked">
                      <div className="flex items-center gap-2">
                        <Unlock className="h-3.5 w-3.5" />
                        Unlocked
                      </div>
                    </SelectItem>
                    <SelectItem value="completed">
                      <div className="flex items-center gap-2">
                        <CheckCircle className="h-3.5 w-3.5" />
                        Completed
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              {/* Task 2 Filter */}
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">Task 2: Answer Quality</Label>
                <Select 
                  value={filters.taskStatuses.task2} 
                  onValueChange={(value) => handleTaskStatusChange(2, value)}
                >
                  <SelectTrigger className="w-full h-8">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Statuses</SelectItem>
                    <SelectItem value="locked">
                      <div className="flex items-center gap-2">
                        <Lock className="h-3.5 w-3.5" />
                        Locked
                      </div>
                    </SelectItem>
                    <SelectItem value="unlocked">
                      <div className="flex items-center gap-2">
                        <Unlock className="h-3.5 w-3.5" />
                        Unlocked
                      </div>
                    </SelectItem>
                    <SelectItem value="completed">
                      <div className="flex items-center gap-2">
                        <CheckCircle className="h-3.5 w-3.5" />
                        Completed
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              {/* Task 3 Filter */}
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">Task 3: Rewrite</Label>
                <Select 
                  value={filters.taskStatuses.task3} 
                  onValueChange={(value) => handleTaskStatusChange(3, value)}
                >
                  <SelectTrigger className="w-full h-8">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Statuses</SelectItem>
                    <SelectItem value="locked">
                      <div className="flex items-center gap-2">
                        <Lock className="h-3.5 w-3.5" />
                        Locked
                      </div>
                    </SelectItem>
                    <SelectItem value="unlocked">
                      <div className="flex items-center gap-2">
                        <Unlock className="h-3.5 w-3.5" />
                        Unlocked
                      </div>
                    </SelectItem>
                    <SelectItem value="completed">
                      <div className="flex items-center gap-2">
                        <CheckCircle className="h-3.5 w-3.5" />
                        Completed
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            
            <Separator />
            
            {/* Repository Language filter */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">Repository Language</Label>
              <div className="grid grid-cols-2 gap-2">
                {availableLanguages.length > 0 ? (
                  availableLanguages.map(lang => (
                    <div key={lang} className="flex items-center space-x-2">
                      <Checkbox
                        id={`lang-${lang}`}
                        checked={filters.repositoryLanguage.includes(lang)}
                        onCheckedChange={() => handleLanguageToggle(lang)}
                      />
                      <Label htmlFor={`lang-${lang}`} className="text-sm flex items-center">
                        <Code className="h-3.5 w-3.5 mr-1" />
                        {lang}
                      </Label>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-muted-foreground">No languages available</p>
                )}
              </div>
            </div>
            
            <Separator />
            
            {/* Release Tag filter */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">Release Tags</Label>
              <div className="max-h-32 overflow-y-auto border rounded-md p-2">
                <div className="grid grid-cols-1 gap-2">
                  {availableTags.length > 0 ? (
                    availableTags.map(tag => (
                      <div key={tag} className="flex items-center space-x-2">
                        <Checkbox
                          id={`tag-${tag}`}
                          checked={filters.releaseTag.includes(tag)}
                          onCheckedChange={() => handleTagToggle(tag)}
                        />
                        <Label htmlFor={`tag-${tag}`} className="text-sm flex items-center truncate">
                          <Tag className="h-3.5 w-3.5 mr-1 flex-shrink-0" />
                          <span className="truncate" title={tag}>{tag}</span>
                        </Label>
                      </div>
                    ))
                  ) : (
                    <p className="text-sm text-muted-foreground">No release tags available</p>
                  )}
                </div>
              </div>
            </div>
            
            <Separator />
            
            {/* Date range filters */}
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-2">
                <Label className="text-sm font-medium">From Date</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant={"outline"}
                      className="w-full justify-start text-left font-normal h-9"
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {filters.fromDate ? format(filters.fromDate, "PPP") : "Select date"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0">
                    <Calendar
                      mode="single"
                      selected={filters.fromDate}
                      onSelect={handleFromDateChange}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>
              
              <div className="space-y-2">
                <Label className="text-sm font-medium">To Date</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant={"outline"}
                      className="w-full justify-start text-left font-normal h-9"
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {filters.toDate ? format(filters.toDate, "PPP") : "Select date"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0">
                    <Calendar
                      mode="single"
                      selected={filters.toDate}
                      onSelect={handleToDateChange}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>
            </div>
            
            <Separator />
            
            {/* Batch filter */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">Batch</Label>
              <Select value={filters.batchId} onValueChange={handleBatchChange}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select a batch" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all_batches">All Batches</SelectItem>
                  {availableBatches.map(batch => (
                    <SelectItem key={batch.id} value={batch.id.toString()}>
                      {batch.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div className="flex justify-between pt-2">
              <Button variant="outline" size="sm" onClick={() => setIsOpen(false)}>
                Cancel
              </Button>
              <Button onClick={() => setIsOpen(false)}>
                <Check className="mr-2 h-4 w-4" />
                Apply Filters
              </Button>
            </div>
          </div>
        </PopoverContent>
      </Popover>
      
      {/* Active filters display */}
      <div className="flex flex-wrap gap-2 mt-2">
        {activeFilterCount > 0 && (
          <div className="flex flex-wrap gap-2 mt-2">
            {filters.status !== 'all' && (
              <Badge variant="secondary" className="flex items-center gap-1">
                Status: {filters.status}
                <X className="h-3 w-3 ml-1 cursor-pointer" onClick={() => handleStatusChange('all')} />
              </Badge>
            )}
            
            {filters.showMyAnnotations && (
              <Badge variant="secondary" className="flex items-center gap-1">
                My Annotations
                <X className="h-3 w-3 ml-1 cursor-pointer" onClick={() => handleMyAnnotationsChange(false)} />
              </Badge>
            )}
            
            {/* Task Status Badges */}
            {filters.taskStatuses.task1 !== 'all' && (
              <Badge variant="secondary" className="flex items-center gap-1">
                {getTaskStatusIcon(filters.taskStatuses.task1)}
                Task 1: {getTaskStatusLabel(filters.taskStatuses.task1)}
                <X className="h-3 w-3 ml-1 cursor-pointer" onClick={() => handleTaskStatusChange(1, 'all')} />
              </Badge>
            )}
            
            {filters.taskStatuses.task2 !== 'all' && (
              <Badge variant="secondary" className="flex items-center gap-1">
                {getTaskStatusIcon(filters.taskStatuses.task2)}
                Task 2: {getTaskStatusLabel(filters.taskStatuses.task2)}
                <X className="h-3 w-3 ml-1 cursor-pointer" onClick={() => handleTaskStatusChange(2, 'all')} />
              </Badge>
            )}
            
            {filters.taskStatuses.task3 !== 'all' && (
              <Badge variant="secondary" className="flex items-center gap-1">
                {getTaskStatusIcon(filters.taskStatuses.task3)}
                Task 3: {getTaskStatusLabel(filters.taskStatuses.task3)}
                <X className="h-3 w-3 ml-1 cursor-pointer" onClick={() => handleTaskStatusChange(3, 'all')} />
              </Badge>
            )}
            
            {filters.repositoryLanguage.map(lang => (
              <Badge key={lang} variant="secondary" className="flex items-center gap-1">
                <Code className="h-3.5 w-3.5 mr-1" />
                {lang}
                <X className="h-3 w-3 ml-1 cursor-pointer" onClick={() => handleLanguageToggle(lang)} />
              </Badge>
            ))}
            
            {filters.releaseTag.map(tag => (
              <Badge key={tag} variant="secondary" className="flex items-center gap-1">
                <Tag className="h-3.5 w-3.5 mr-1" />
                {tag}
                <X className="h-3 w-3 ml-1 cursor-pointer" onClick={() => handleTagToggle(tag)} />
              </Badge>
            ))}
            
            {filters.fromDate && (
              <Badge variant="secondary" className="flex items-center gap-1">
                From: {format(filters.fromDate, "PP")}
                <X className="h-3 w-3 ml-1 cursor-pointer" onClick={() => handleFromDateChange(undefined)} />
              </Badge>
            )}
            
            {filters.toDate && (
              <Badge variant="secondary" className="flex items-center gap-1">
                To: {format(filters.toDate, "PP")}
                <X className="h-3 w-3 ml-1 cursor-pointer" onClick={() => handleToDateChange(undefined)} />
              </Badge>
            )}
            
            {filters.batchId && (
              <Badge variant="secondary" className="flex items-center gap-1">
                Batch: {availableBatches.find(b => b.id.toString() === filters.batchId)?.name || filters.batchId}
                <X className="h-3 w-3 ml-1 cursor-pointer" onClick={() => handleBatchChange('')} />
              </Badge>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default DiscussionFilters;