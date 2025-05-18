import React, { useState, useEffect } from 'react';
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
import { Filter, Calendar as CalendarIcon, Search, X, Tag, Code, Check } from 'lucide-react';
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
    batchId: initialFilters.batchId || ''
  });
  
  const [isOpen, setIsOpen] = useState(false);
  
  // Count active filters (excluding status='all' which is default)
  const activeFilterCount = [
    filters.status !== 'all',
    filters.showMyAnnotations,
    filters.repositoryLanguage.length > 0,
    filters.releaseTag.length > 0,
    filters.fromDate !== undefined,
    filters.toDate !== undefined,
    filters.batchId !== ''
  ].filter(Boolean).length;
  
  // Apply filters when they change
  useEffect(() => {
    onFilterChange(filters);
  }, [filters, onFilterChange]);
  
  const handleStatusChange = (status: string) => {
    setFilters(prev => ({ ...prev, status }));
  };
  
  const handleMyAnnotationsChange = (checked: boolean) => {
    setFilters(prev => ({ ...prev, showMyAnnotations: checked }));
  };
  
  const handleLanguageToggle = (language: string) => {
    setFilters(prev => {
      if (prev.repositoryLanguage.includes(language)) {
        return {
          ...prev,
          repositoryLanguage: prev.repositoryLanguage.filter(l => l !== language)
        };
      } else {
        return {
          ...prev,
          repositoryLanguage: [...prev.repositoryLanguage, language]
        };
      }
    });
  };
  
  const handleTagToggle = (tag: string) => {
    setFilters(prev => {
      if (prev.releaseTag.includes(tag)) {
        return {
          ...prev,
          releaseTag: prev.releaseTag.filter(t => t !== tag)
        };
      } else {
        return {
          ...prev,
          releaseTag: [...prev.releaseTag, tag]
        };
      }
    });
  };
  
  const handleBatchChange = (batchId: string) => {
    setFilters(prev => ({ ...prev, batchId }));
  };
  
  const handleFromDateChange = (date: Date | undefined) => {
    setFilters(prev => ({ ...prev, fromDate: date }));
  };
  
  const handleToDateChange = (date: Date | undefined) => {
    setFilters(prev => ({ ...prev, toDate: date }));
  };
  
  const clearFilters = () => {
    setFilters({
      status: 'all',
      showMyAnnotations: false,
      repositoryLanguage: [],
      releaseTag: [],
      fromDate: undefined,
      toDate: undefined,
      batchId: ''
    });
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
        <PopoverContent className="w-[350px] p-4" align="start">
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
              <div className="grid grid-cols-2 gap-2">
                {availableTags.length > 0 ? (
                  availableTags.map(tag => (
                    <div key={tag} className="flex items-center space-x-2">
                      <Checkbox
                        id={`tag-${tag}`}
                        checked={filters.releaseTag.includes(tag)}
                        onCheckedChange={() => handleTagToggle(tag)}
                      />
                      <Label htmlFor={`tag-${tag}`} className="text-sm flex items-center">
                        <Tag className="h-3.5 w-3.5 mr-1" />
                        {tag}
                      </Label>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-muted-foreground">No release tags available</p>
                )}
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
