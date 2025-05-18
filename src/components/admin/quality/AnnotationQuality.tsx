
import React, { useState, useEffect } from 'react';
import { 
  Card, 
  CardContent, 
  CardDescription, 
  CardFooter, 
  CardHeader, 
  CardTitle 
} from '@/components/ui/card';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { QualityMetrics, AnnotatorPerformance } from '@/services/api/types';
import { AlertTriangle, ArrowUpDown, Search, Shield, Users } from 'lucide-react';
import { Progress } from "@/components/ui/progress";
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs-wrapper';

interface AnnotationQualityProps {
  qualityMetrics?: QualityMetrics[];
  annotatorPerformance?: AnnotatorPerformance[];
  isLoading?: boolean;
  onRefresh?: () => void;
}

// Mock data for development purposes
const mockQualityMetrics: QualityMetrics[] = [
  { 
    discussionId: 'disc-001', 
    title: 'How to implement a custom hook for API calls',
    agreementScore: 0.92, 
    annotatorCount: 3, 
    conflictAreas: ['Learning Value'] 
  },
  { 
    discussionId: 'disc-002', 
    title: 'Creating a responsive table with Tailwind CSS',
    agreementScore: 0.78, 
    annotatorCount: 3, 
    conflictAreas: ['Clarity', 'Learning Value'] 
  },
  { 
    discussionId: 'disc-003', 
    title: 'Setting up Redux with TypeScript',
    agreementScore: 0.85, 
    annotatorCount: 3, 
    conflictAreas: ['Relevance'] 
  },
  { 
    discussionId: 'disc-004', 
    title: 'Best practices for error handling in React components',
    agreementScore: 0.65, 
    annotatorCount: 3, 
    conflictAreas: ['Learning Value', 'Clarity', 'Relevance'] 
  },
  { 
    discussionId: 'disc-005', 
    title: 'Implementing dark mode with Context API',
    agreementScore: 0.96, 
    annotatorCount: 3, 
    conflictAreas: [] 
  },
];

const mockAnnotatorPerformance: AnnotatorPerformance[] = [
  { userId: 'user-001', completedTasks: 42, averageTime: 8.5, agreement: 0.91 },
  { userId: 'user-002', completedTasks: 37, averageTime: 12.2, agreement: 0.87 },
  { userId: 'user-003', completedTasks: 56, averageTime: 7.3, agreement: 0.94 },
  { userId: 'user-004', completedTasks: 23, averageTime: 15.1, agreement: 0.82 },
  { userId: 'user-005', completedTasks: 19, averageTime: 9.8, agreement: 0.89 },
];

const AnnotationQuality: React.FC<AnnotationQualityProps> = ({
  qualityMetrics = mockQualityMetrics,
  annotatorPerformance = mockAnnotatorPerformance,
  isLoading = false,
  onRefresh,
}) => {
  const [activeTab, setActiveTab] = useState('agreement');
  const [searchTerm, setSearchTerm] = useState('');
  const [sortField, setSortField] = useState<'agreementScore' | 'annotatorCount'>('agreementScore');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');

  // Sort and filter discussions
  const filteredMetrics = qualityMetrics.filter(metric => 
    metric.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
    metric.discussionId.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const sortedMetrics = [...filteredMetrics].sort((a, b) => {
    const aValue = a[sortField];
    const bValue = b[sortField];
    return sortDirection === 'asc' 
      ? (aValue > bValue ? 1 : -1) 
      : (aValue < bValue ? 1 : -1);
  });

  // Handle sort toggle
  const toggleSort = (field: 'agreementScore' | 'annotatorCount') => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  };

  // Helper function to get agreement color
  const getAgreementColor = (score: number) => {
    if (score >= 0.9) return "bg-green-500";
    if (score >= 0.75) return "bg-yellow-500";
    return "bg-red-500";
  };

  // Helper function to get agreement status
  const getAgreementStatus = (score: number) => {
    if (score >= 0.9) return "High Agreement";
    if (score >= 0.75) return "Moderate Agreement";
    return "Low Agreement";
  };

  return (
    <Card className="w-full shadow-md">
      <CardHeader>
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center">
          <div>
            <CardTitle>Annotation Quality Metrics</CardTitle>
            <CardDescription>
              Monitor inter-annotator agreement and identify potential issues
            </CardDescription>
          </div>

          <div className="mt-4 sm:mt-0">
            <Button 
              variant="outline" 
              size="sm" 
              onClick={onRefresh}
              disabled={isLoading}
            >
              Refresh Data
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <Tabs 
          defaultValue={activeTab} 
          value={activeTab} 
          onValueChange={setActiveTab} 
          className="space-y-4"
        >
          <TabsList>
            <TabsTrigger value="agreement" className="flex items-center gap-2">
              <Shield className="h-4 w-4" />
              <span>Agreement Analysis</span>
            </TabsTrigger>
            <TabsTrigger value="annotators" className="flex items-center gap-2">
              <Users className="h-4 w-4" />
              <span>Annotator Performance</span>
            </TabsTrigger>
          </TabsList>

          {/* Agreement Analysis Tab */}
          <TabsContent value="agreement">
            <div className="mb-4">
              <Input
                placeholder="Search discussions..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="max-w-md"
                leftIcon={<Search className="h-4 w-4" />}
              />
            </div>

            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="max-w-[300px]">Discussion</TableHead>
                    <TableHead className="w-[150px] cursor-pointer" onClick={() => toggleSort('agreementScore')}>
                      <div className="flex items-center">
                        Agreement
                        <ArrowUpDown className="ml-2 h-4 w-4" />
                      </div>
                    </TableHead>
                    <TableHead className="w-[120px] cursor-pointer" onClick={() => toggleSort('annotatorCount')}>
                      <div className="flex items-center">
                        Annotators
                        <ArrowUpDown className="ml-2 h-4 w-4" />
                      </div>
                    </TableHead>
                    <TableHead className="w-[200px]">Conflict Areas</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sortedMetrics.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                        No discussions found
                      </TableCell>
                    </TableRow>
                  ) : (
                    sortedMetrics.map((metric) => (
                      <TableRow key={metric.discussionId}>
                        <TableCell className="max-w-[300px] truncate">
                          {metric.title}
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-col space-y-1">
                            <div className="flex items-center justify-between">
                              <span className="text-sm font-medium">
                                {(metric.agreementScore * 100).toFixed(0)}%
                              </span>
                              <span 
                                className={`text-xs ${
                                  metric.agreementScore < 0.75 ? 'text-red-600' : 
                                  metric.agreementScore >= 0.9 ? 'text-green-600' : 'text-yellow-600'
                                }`}
                              >
                                {getAgreementStatus(metric.agreementScore)}
                              </span>
                            </div>
                            <Progress 
                              value={metric.agreementScore * 100}
                              className={`h-2 ${getAgreementColor(metric.agreementScore)}`}
                            />
                          </div>
                        </TableCell>
                        <TableCell>
                          {metric.annotatorCount}
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-1">
                            {metric.conflictAreas.length === 0 ? (
                              <span className="text-sm text-muted-foreground">None</span>
                            ) : (
                              metric.conflictAreas.map((area, i) => (
                                <Badge key={i} variant="outline" className="text-xs">
                                  {area}
                                </Badge>
                              ))
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          <Button size="sm" variant="outline">
                            Review
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </TabsContent>

          {/* Annotator Performance Tab */}
          <TabsContent value="annotators">
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Annotator</TableHead>
                    <TableHead>Completed Tasks</TableHead>
                    <TableHead>Avg. Time (min)</TableHead>
                    <TableHead>Agreement</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {annotatorPerformance.map((annotator) => (
                    <TableRow key={annotator.userId}>
                      <TableCell className="font-medium">{annotator.userId}</TableCell>
                      <TableCell>{annotator.completedTasks}</TableCell>
                      <TableCell>{annotator.averageTime.toFixed(1)}</TableCell>
                      <TableCell>
                        <div className="flex flex-col space-y-1">
                          <span className="text-sm font-medium">
                            {(annotator.agreement * 100).toFixed(0)}%
                          </span>
                          <Progress 
                            value={annotator.agreement * 100}
                            className={`h-2 ${getAgreementColor(annotator.agreement)}`}
                          />
                        </div>
                      </TableCell>
                      <TableCell>
                        {annotator.agreement < 0.75 ? (
                          <Badge variant="destructive" className="flex items-center gap-1">
                            <AlertTriangle className="h-3 w-3" />
                            Needs Review
                          </Badge>
                        ) : annotator.agreement >= 0.9 ? (
                          <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                            Excellent
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-200">
                            Good
                          </Badge>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
      <CardFooter className="text-sm text-muted-foreground">
        Note: Agreement scores below 75% may require manual review
      </CardFooter>
    </Card>
  );
};

export default AnnotationQuality;
