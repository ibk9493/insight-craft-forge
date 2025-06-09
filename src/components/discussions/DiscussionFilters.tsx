import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
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
import { Filter, Calendar as CalendarIcon, X, Tag, Code, Check, Lock, Unlock, CheckCircle } from 'lucide-react';
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
    task1: string;
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

const DEFAULT_FILTERS: FilterValues = {
  status: 'all',
  showMyAnnotations: false,
  repositoryLanguage: [],
  releaseTag: [],
  fromDate: undefined,
  toDate: undefined,
  batchId: 'all', // Changed from '' to 'all'
  taskStatuses: {
    task1: 'all',
    task2: 'all',
    task3: 'all'
  }
};

const DiscussionFilters: React.FC<DiscussionFiltersProps> = ({
  onFilterChange,
  availableLanguages = [],
  availableTags = [],
  availableBatches = [],
  initialFilters = {}
}) => {
  // Initialize filters with defaults merged with initial values
  const [filters, setFilters] = useState<FilterValues>(() => {
    const merged = {
      ...DEFAULT_FILTERS,
      ...initialFilters,
      taskStatuses: {
        ...DEFAULT_FILTERS.taskStatuses,
        ...initialFilters.taskStatuses
      }
    };
    console.log('DiscussionFilters: Initial filters set to:', merged);
    return merged;
  });
  
  const [isOpen, setIsOpen] = useState(false);
  const prevFiltersRef = useRef<FilterValues>(filters);
  
  // Memoize active filter count calculation
  const activeFilterCount = useMemo(() => {
    const count = [
      filters.status !== 'all',
      filters.showMyAnnotations,
      filters.repositoryLanguage.length > 0,
      filters.releaseTag.length > 0,
      filters.fromDate !== undefined,
      filters.toDate !== undefined,
      filters.batchId !== 'all' && filters.batchId !== '', // Fixed batch filter check
      filters.taskStatuses.task1 !== 'all',
      filters.taskStatuses.task2 !== 'all',
      filters.taskStatuses.task3 !== 'all'
    ].filter(Boolean).length;
    
    console.log('DiscussionFilters: Active filter count:', count, filters);
    return count;
  }, [filters]);

  // Simplified deep compare for filter objects
  const filtersChanged = useCallback((newFilters: FilterValues, oldFilters: FilterValues): boolean => {
    return JSON.stringify(newFilters) !== JSON.stringify(oldFilters);
  }, []);

  // Handle filter changes and notify parent
  const handleFilterChange = useCallback((newFilters: FilterValues) => {
    console.log('DiscussionFilters: Filter change triggered:', newFilters);
    
    // Only update if filters actually changed
    if (filtersChanged(newFilters, prevFiltersRef.current)) {
      setFilters(newFilters);
      prevFiltersRef.current = newFilters;
      onFilterChange(newFilters);
      console.log('DiscussionFilters: Filters updated and parent notified');
    } else {
      console.log('DiscussionFilters: No change detected, skipping update');
    }
  }, [onFilterChange, filtersChanged]);

  // Update internal state when initialFilters prop changes (only on mount or explicit prop change)
  useEffect(() => {
    if (initialFilters && Object.keys(initialFilters).length > 0) {
      const newFilters = {
        ...DEFAULT_FILTERS,
        ...initialFilters,
        taskStatuses: {
          ...DEFAULT_FILTERS.taskStatuses,
          ...initialFilters.taskStatuses
        }
      };
      
      if (filtersChanged(newFilters, filters)) {
        console.log('DiscussionFilters: Updating from initialFilters prop change:', newFilters);
        setFilters(newFilters);
        prevFiltersRef.current = newFilters;
      }
    }
  }, []); // Only run on mount

  // Individual filter handlers with proper dependency management
  const handleStatusChange = useCallback((status: string) => {
    handleFilterChange({ ...filters, status });
  }, [filters, handleFilterChange]);
  
  const handleMyAnnotationsChange = useCallback((checked: boolean) => {
    handleFilterChange({ ...filters, showMyAnnotations: checked });
  }, [filters, handleFilterChange]);
  
  const handleLanguageToggle = useCallback((language: string) => {
    const newLanguages = filters.repositoryLanguage.includes(language)
      ? filters.repositoryLanguage.filter(l => l !== language)
      : [...filters.repositoryLanguage, language];
    
    handleFilterChange({ ...filters, repositoryLanguage: newLanguages });
  }, [filters, handleFilterChange]);
  
  const handleTagToggle = useCallback((tag: string) => {
    const newTags = filters.releaseTag.includes(tag)
      ? filters.releaseTag.filter(t => t !== tag)
      : [...filters.releaseTag, tag];
    
    handleFilterChange({ ...filters, releaseTag: newTags });
  }, [filters, handleFilterChange]);
  
  const handleBatchChange = useCallback((batchId: string) => {
    console.log('DiscussionFilters: Batch changed to:', batchId);
    handleFilterChange({ ...filters, batchId });
  }, [filters, handleFilterChange]);
  
  const handleFromDateChange = useCallback((date: Date | undefined) => {
    handleFilterChange({ ...filters, fromDate: date });
  }, [filters, handleFilterChange]);
  
  const handleToDateChange = useCallback((date: Date | undefined) => {
    handleFilterChange({ ...filters, toDate: date });
  }, [filters, handleFilterChange]);

  const handleTaskStatusChange = useCallback((taskNumber: 1 | 2 | 3, status: string) => {
    const newTaskStatuses = {
      ...filters.taskStatuses,
      [`task${taskNumber}`]: status
    };
    handleFilterChange({ ...filters, taskStatuses: newTaskStatuses });
  }, [filters, handleFilterChange]);

  // Memoized icon and label getters
  const getTaskStatusIcon = useCallback((status: string) => {
    const iconMap: Record<string, JSX.Element> = {
      locked: <Lock className="h-3.5 w-3.5" />,
      unlocked: <Unlock className="h-3.5 w-3.5" />,
      completed: <CheckCircle className="h-3.5 w-3.5" />,
      rework: <Tag className="h-3.5 w-3.5" />,
      blocked: <X className="h-3.5 w-3.5" />,
      flagged: <Filter className="h-3.5 w-3.5" />,
      ready_for_consensus: <Check className="h-3.5 w-3.5" />,
      consensus_created: <CheckCircle className="h-3.5 w-3.5" />,
      ready_for_next: <Tag className="h-3.5 w-3.5" />
    };
    return iconMap[status] || null;
  }, []);

  const getTaskStatusLabel = useCallback((status: string) => {
    const labelMap: Record<string, string> = {
      locked: 'Locked',
      unlocked: 'Unlocked',
      completed: 'Completed',
      rework: 'Needs Rework',
      blocked: 'Blocked',
      flagged: 'Flagged',
      ready_for_consensus: 'Ready for Consensus',
      consensus_created: 'Consensus Created',
      ready_for_next: 'Ready for Next'
    };
    return labelMap[status] || 'All';
  }, []);
  
  const clearFilters = useCallback(() => {
    console.log('DiscussionFilters: Clearing all filters');
    handleFilterChange(DEFAULT_FILTERS);
  }, [handleFilterChange]);

  // Clear individual filter handlers
  const clearStatusFilter = useCallback(() => handleStatusChange('all'), [handleStatusChange]);
  const clearMyAnnotationsFilter = useCallback(() => handleMyAnnotationsChange(false), [handleMyAnnotationsChange]);
  const clearBatchFilter = useCallback(() => handleBatchChange('all'), [handleBatchChange]);

  // Memoized task status options
  const taskStatusOptions = useMemo(() => [
    { value: 'all', label: 'All Statuses' },
    { value: 'locked', label: 'Locked', icon: <Lock className="h-3.5 w-3.5" /> },
    { value: 'unlocked', label: 'Unlocked', icon: <Unlock className="h-3.5 w-3.5" /> },
    { value: 'completed', label: 'Completed', icon: <CheckCircle className="h-3.5 w-3.5" /> },
    { value: 'rework', label: 'Needs Rework', icon: <Tag className="h-3.5 w-3.5" /> },
    { value: 'blocked', label: 'Blocked', icon: <X className="h-3.5 w-3.5" /> },
    { value: 'flagged', label: 'Flagged', icon: <Filter className="h-3.5 w-3.5" /> },
    { value: 'ready_for_consensus', label: 'Ready for Consensus', icon: <Check className="h-3.5 w-3.5" /> },
    { value: 'consensus_created', label: 'Consensus Created', icon: <CheckCircle className="h-3.5 w-3.5" /> },
    { value: 'ready_for_next', label: 'Ready for Next', icon: <Tag className="h-3.5 w-3.5" /> }
  ], []);

  // Memoized task status select component
  const TaskStatusSelect = useCallback(({ 
    value, 
    onValueChange, 
    options, 
    label 
  }: { 
    value: string; 
    onValueChange: (value: string) => void; 
    options: typeof taskStatusOptions;
    label: string;
  }) => (
    <div className="space-y-2">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      <Select value={value} onValueChange={onValueChange}>
        <SelectTrigger className="w-full h-8">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {options.map(option => (
            <SelectItem key={option.value} value={option.value}>
              {option.icon ? (
                <div className="flex items-center gap-2">
                  {option.icon}
                  {option.label}
                </div>
              ) : (
                option.label
              )}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  ), []);

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
              
              <TaskStatusSelect
                value={filters.taskStatuses.task1}
                onValueChange={(value) => handleTaskStatusChange(1, value)}
                options={taskStatusOptions}
                label="Task 1: Question Quality"
              />
              
              <TaskStatusSelect
                value={filters.taskStatuses.task2}
                onValueChange={(value) => handleTaskStatusChange(2, value)}
                options={taskStatusOptions}
                label="Task 2: Answer Quality"
              />
              
              <TaskStatusSelect
                value={filters.taskStatuses.task3}
                onValueChange={(value) => handleTaskStatusChange(3, value)}
                options={taskStatusOptions}
                label="Task 3: Rewrite"
              />
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
            
            {/* Batch filter - Fixed */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">Batch</Label>
              <Select value={filters.batchId} onValueChange={handleBatchChange}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select a batch" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Batches</SelectItem>
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
      
      {/* Active filters display - Fixed */}
      {activeFilterCount > 0 && (
        <div className="flex flex-wrap gap-2 mt-2">
          {filters.status !== 'all' && (
            <Badge variant="secondary" className="flex items-center gap-1">
              Status: {filters.status}
              <X className="h-3 w-3 ml-1 cursor-pointer" onClick={clearStatusFilter} />
            </Badge>
          )}
          
          {filters.showMyAnnotations && (
            <Badge variant="secondary" className="flex items-center gap-1">
              My Annotations
              <X className="h-3 w-3 ml-1 cursor-pointer" onClick={clearMyAnnotationsFilter} />
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
          
          {filters.batchId !== 'all' && filters.batchId !== '' && (
            <Badge variant="secondary" className="flex items-center gap-1">
              Batch: {availableBatches.find(b => b.id.toString() === filters.batchId)?.name || filters.batchId}
              <X className="h-3 w-3 ml-1 cursor-pointer" onClick={clearBatchFilter} />
            </Badge>
          )}
        </div>
      )}
    </div>
  );
};

export default DiscussionFilters;