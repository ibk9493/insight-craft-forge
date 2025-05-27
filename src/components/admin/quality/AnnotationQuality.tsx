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
import { AlertTriangle, ArrowUpDown, Search, Shield, Users, Loader, RefreshCw } from 'lucide-react';
import { Progress } from "@/components/ui/progress";
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs-wrapper';
import { api } from '@/services/api';
import { useUser } from '@/contexts/UserContext';

// Updated types based on your actual backend data
interface ConsensusCandidate {
  discussion_id: string;
  discussion_title: string;
  task_id: number;
  agreement_rate: number;
  annotator_count: number;
  required_annotators: number;
  agreement_details?: any;
}

interface UserAgreementSummary {
  user_id: string;
  total_annotations: number;
  annotations_with_consensus: number;
  agreement_rate: number;
  status: 'excellent' | 'good' | 'needs_improvement' | 'needs_training' | 'no_data' | 'error';
}

interface AllUsersOverview {
  total_users: number;
  users: UserAgreementSummary[];
  users_needing_training: UserAgreementSummary[];
  summary: {
    excellent_users: number;
    good_users: number;
    users_needing_improvement: number;
    users_needing_training: number;
    users_with_no_data: number;
    users_with_errors: number;
  };
}

interface AnnotationQualityProps {
  isLoading?: boolean;
  onRefresh?: () => void;
}

const AnnotationQuality: React.FC<AnnotationQualityProps> = ({
  isLoading: externalLoading = false,
  onRefresh,
}) => {
  const { isAdmin, isPodLead } = useUser();
  const [activeTab, setActiveTab] = useState('agreement');
  const [searchTerm, setSearchTerm] = useState('');
  const [sortField, setSortField] = useState<'agreement_rate' | 'annotator_count'>('agreement_rate');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc'); // Changed to asc to show lowest agreement first
  
  // Data state
  const [consensusCandidates, setConsensusCandidates] = useState<ConsensusCandidate[]>([]);
  const [usersOverview, setUsersOverview] = useState<AllUsersOverview | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  // Load data on component mount
  useEffect(() => {
    loadQualityData();
  }, []);

  const loadQualityData = async () => {
    setIsLoading(true);
    try {
      // Load consensus candidates with lower agreement threshold to show problem areas
      const consensusData = await api.workflow.consensusCandidates(60.0); // Lower threshold to catch disagreements
      setConsensusCandidates(consensusData.candidates || []);

      // Load user agreement overview if admin
      if (isAdmin) {
        const usersData = await api.workflow.agreementOverview();
        setUsersOverview(usersData);
      }

      setLastUpdated(new Date());
    } catch (error) {
      console.error('Error loading quality data:', error);
      toast.error('Failed to load quality metrics');
    } finally {
      setIsLoading(false);
    }
  };

  const handleRefresh = () => {
    if (onRefresh) {
      onRefresh();
    }
    loadQualityData();
  };

  // Sort and filter discussions
  const filteredMetrics = consensusCandidates.filter(metric => 
    metric.discussion_title.toLowerCase().includes(searchTerm.toLowerCase()) ||
    metric.discussion_id.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const sortedMetrics = [...filteredMetrics].sort((a, b) => {
    const aValue = a[sortField];
    const bValue = b[sortField];
    return sortDirection === 'asc' 
      ? (aValue > bValue ? 1 : -1) 
      : (aValue < bValue ? 1 : -1);
  });

  // Handle sort toggle
  const toggleSort = (field: 'agreement_rate' | 'annotator_count') => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection(field === 'agreement_rate' ? 'asc' : 'desc'); // Show lowest agreement first
    }
  };

  // Helper function to get agreement color
  const getAgreementColor = (score: number) => {
    if (score >= 90) return "bg-green-500";
    if (score >= 75) return "bg-yellow-500";
    return "bg-red-500";
  };

  // Helper function to get agreement status
  const getAgreementStatus = (score: number) => {
    if (score >= 90) return "High Agreement";
    if (score >= 75) return "Moderate Agreement";
    return "Low Agreement";
  };

  // Get conflict areas from agreement details (mock for now since your backend doesn't provide this)
  const getConflictAreas = (agreementDetails: any): string[] => {
    if (!agreementDetails?.field_agreement) return [];
    
    const conflicts: string[] = [];
    Object.entries(agreementDetails.field_agreement).forEach(([field, stats]: [string, any]) => {
      if (stats.agreement_rate < 80) { // Fields with less than 80% agreement
        conflicts.push(field);
      }
    });
    
    return conflicts;
  };

  // Helper function to get user status color
  const getUserStatusColor = (status: string) => {
    switch (status) {
      case 'excellent': return 'bg-green-50 text-green-700 border-green-200';
      case 'good': return 'bg-blue-50 text-blue-700 border-blue-200';
      case 'needs_improvement': return 'bg-yellow-50 text-yellow-700 border-yellow-200';
      case 'needs_training': return 'bg-red-50 text-red-700 border-red-200';
      default: return 'bg-gray-50 text-gray-700 border-gray-200';
    }
  };

  const isLoadingData = isLoading || externalLoading;

  return (
    <Card className="w-full shadow-md">
      <CardHeader>
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center">
          <div>
            <CardTitle>Annotation Quality Metrics</CardTitle>
            <CardDescription>
              Monitor inter-annotator agreement and identify potential issues
              {lastUpdated && (
                <span className="ml-2 text-sm">
                  • Last updated: {lastUpdated.toLocaleTimeString()}
                </span>
              )}
            </CardDescription>
          </div>

          <div className="mt-4 sm:mt-0">
            <Button 
              variant="outline" 
              size="sm" 
              onClick={handleRefresh}
              disabled={isLoadingData}
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${isLoadingData ? 'animate-spin' : ''}`} />
              Refresh Data
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {isLoadingData ? (
          <div className="flex flex-col items-center justify-center py-12">
            <Loader className="h-8 w-8 animate-spin text-blue-600 mb-4" />
            <p className="text-gray-500">Loading quality metrics...</p>
          </div>
        ) : (
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
              {isAdmin && (
                <TabsTrigger value="annotators" className="flex items-center gap-2">
                  <Users className="h-4 w-4" />
                  <span>Annotator Performance</span>
                </TabsTrigger>
              )}
            </TabsList>

            {/* Agreement Analysis Tab */}
            <TabsContent value="agreement">
              <div className="mb-4">
                <Input
                  placeholder="Search discussions..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="max-w-md"
                />
              </div>

              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="max-w-[300px]">Discussion</TableHead>
                      <TableHead className="w-[150px] cursor-pointer" onClick={() => toggleSort('agreement_rate')}>
                        <div className="flex items-center">
                          Agreement
                          <ArrowUpDown className="ml-2 h-4 w-4" />
                        </div>
                      </TableHead>
                      <TableHead className="w-[120px] cursor-pointer" onClick={() => toggleSort('annotator_count')}>
                        <div className="flex items-center">
                          Annotators
                          <ArrowUpDown className="ml-2 h-4 w-4" />
                        </div>
                      </TableHead>
                      <TableHead className="w-[100px]">Task</TableHead>
                      <TableHead className="w-[200px]">Status</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sortedMetrics.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                          {consensusCandidates.length === 0 
                            ? "No discussions with quality issues found - all discussions have good agreement!"
                            : "No discussions found matching your search"
                          }
                        </TableCell>
                      </TableRow>
                    ) : (
                      sortedMetrics.map((metric) => (
                        <TableRow key={`${metric.discussion_id}-${metric.task_id}`}>
                          <TableCell className="max-w-[300px]">
                            <div className="truncate" title={metric.discussion_title}>
                              {metric.discussion_title}
                            </div>
                            <div className="text-xs text-gray-500 truncate">
                              {metric.discussion_id}
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex flex-col space-y-1">
                              <div className="flex items-center justify-between">
                                <span className="text-sm font-medium">
                                  {metric.agreement_rate.toFixed(0)}%
                                </span>
                                <span 
                                  className={`text-xs ${
                                    metric.agreement_rate < 75 ? 'text-red-600' : 
                                    metric.agreement_rate >= 90 ? 'text-green-600' : 'text-yellow-600'
                                  }`}
                                >
                                  {getAgreementStatus(metric.agreement_rate)}
                                </span>
                              </div>
                              <Progress 
                                value={metric.agreement_rate}
                                className="h-2"
                              />
                            </div>
                          </TableCell>
                          <TableCell>
                            <span className="text-sm">
                              {metric.annotator_count}/{metric.required_annotators}
                            </span>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className="text-xs">
                              Task {metric.task_id}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            {metric.agreement_rate < 75 ? (
                              <Badge variant="destructive" className="flex items-center gap-1 w-fit">
                                <AlertTriangle className="h-3 w-3" />
                                Needs Review
                              </Badge>
                            ) : metric.agreement_rate >= 90 ? (
                              <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                                High Agreement
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-200">
                                Moderate Agreement
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell className="text-right">
                            <Button 
                              size="sm" 
                              variant="outline"
                              onClick={() => {
                                // Could navigate to discussion detail or open consensus creation
                                toast.info(`Review discussion: ${metric.discussion_id}`);
                              }}
                            >
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

            {/* Annotator Performance Tab - Admin Only */}
            {isAdmin && (
              <TabsContent value="annotators">
                {!usersOverview ? (
                  <div className="text-center py-8 text-muted-foreground">
                    No user performance data available
                  </div>
                ) : (
                  <>
                    {/* Summary Cards */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                      <Card>
                        <CardContent className="pt-6">
                          <div className="text-center">
                            <p className="text-2xl font-bold text-green-600">{usersOverview.summary.excellent_users}</p>
                            <p className="text-xs text-gray-500">Excellent</p>
                          </div>
                        </CardContent>
                      </Card>
                      <Card>
                        <CardContent className="pt-6">
                          <div className="text-center">
                            <p className="text-2xl font-bold text-blue-600">{usersOverview.summary.good_users}</p>
                            <p className="text-xs text-gray-500">Good</p>
                          </div>
                        </CardContent>
                      </Card>
                      <Card>
                        <CardContent className="pt-6">
                          <div className="text-center">
                            <p className="text-2xl font-bold text-yellow-600">{usersOverview.summary.users_needing_improvement}</p>
                            <p className="text-xs text-gray-500">Needs Improvement</p>
                          </div>
                        </CardContent>
                      </Card>
                      <Card>
                        <CardContent className="pt-6">
                          <div className="text-center">
                            <p className="text-2xl font-bold text-red-600">{usersOverview.summary.users_needing_training}</p>
                            <p className="text-xs text-gray-500">Needs Training</p>
                          </div>
                        </CardContent>
                      </Card>
                    </div>

                    {/* User Performance Table */}
                    <div className="rounded-md border">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>User ID</TableHead>
                            <TableHead>Total Annotations</TableHead>
                            <TableHead>With Consensus</TableHead>
                            <TableHead>Agreement Rate</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead className="text-right">Actions</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {usersOverview.users.map((user) => (
                            <TableRow key={user.user_id}>
                              <TableCell className="font-medium">{user.user_id}</TableCell>
                              <TableCell>{user.total_annotations}</TableCell>
                              <TableCell>{user.annotations_with_consensus}</TableCell>
                              <TableCell>
                                <div className="flex flex-col space-y-1">
                                  <span className="text-sm font-medium">
                                    {user.agreement_rate.toFixed(0)}%
                                  </span>
                                  <Progress 
                                    value={user.agreement_rate}
                                    className="h-2"
                                  />
                                </div>
                              </TableCell>
                              <TableCell>
                                <Badge 
                                  variant="outline" 
                                  className={getUserStatusColor(user.status)}
                                >
                                  {user.status.replace('_', ' ')}
                                </Badge>
                              </TableCell>
                              <TableCell className="text-right">
                                <Button 
                                  size="sm" 
                                  variant="outline"
                                  onClick={async () => {
                                    try {
                                      const analysis = await api.workflow.userAgreementAnalysis(user.user_id, null, true);
                                      toast.success(`Loaded detailed analysis for ${user.user_id}`);
                                      // Could open a modal or navigate to detail view
                                    } catch (error) {
                                      toast.error('Failed to load user analysis');
                                    }
                                  }}
                                >
                                  View Details
                                </Button>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </>
                )}
              </TabsContent>
            )}
          </Tabs>
        )}
      </CardContent>
      <CardFooter className="text-sm text-muted-foreground">
        {isAdmin ? (
          "Agreement scores below 75% may require manual review. Users needing training have been identified."
        ) : (
          "Agreement scores below 75% may require manual review"
        )}
      </CardFooter>
    </Card>
  );
};

export default AnnotationQuality;