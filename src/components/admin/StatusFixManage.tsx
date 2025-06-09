import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';
import { toast } from '@/components/ui/sonner';
import { 
  Settings, 
  Play, 
  CheckCircle, 
  AlertTriangle, 
  Eye, 
  Zap,
  RefreshCw,
  Download,
  ArrowRight,
  AlertCircle,
  Info,
  Clock,
  FileText
} from 'lucide-react';
import { api } from '@/services/api';
import { useState } from 'react';

interface StatusUpdate {
  discussion_id: string;
  discussion_title: string;
  task_id: number;
  current_status: string;
  correct_status: string;
  reason: string;
  applied: boolean;
}

interface StatusFixResult {
  success: boolean;
  dry_run: boolean;
  message: string;
  updated_discussions: number;
  total_discussions_analyzed: number;
  status_updates: StatusUpdate[];
  rework_tasks_preserved?: number;
  workflow_corrections_ignored?: number;
  summary: {
    status_changes: Record<string, number>;
    fixes_applied: Record<string, number>;
    tasks_affected: Record<string, number>;
    rework_tasks_preserved?: number;
    workflow_corrections_ignored?: number;
    rework_scenarios_preserved?: Record<string, number>;
  };
  errors?: string[];
  timestamp?: string;
  api_version?: string;
  operation?: string;
  rework_details?: Array<{
    discussion_id: string;
    discussion_title: string;
    task_id: number;
    current_status: string;
    rework_reason: string;
    workflow_scenario: string;
    flagged_by: string;
    flagged_at: string;
  }>;
}

const StatusFixManager: React.FC = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [lastResult, setLastResult] = useState<StatusFixResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Import the api object (assuming it's available)
  // import { api } from './api'; // Add this import at the top of your file

  // Alternative implementation using specific methods
  const handleStatusFixAlternative = async (dryRun: boolean) => {
    setIsLoading(true);
    setError(null);

    try {
      // Use specific methods based on dry_run parameter
      const result = dryRun 
        ? await api.statusFix.previewFixes()
        : await api.statusFix.applyFixes();
      
      setLastResult(result);

      if (result.success) {
        const successMessage = dryRun 
          ? `Analysis complete! ${result.updated_discussions} discussions would be updated.`
          : `Status fixes applied successfully! ${result.updated_discussions} discussions updated.`;
        
        toast.success(successMessage);
        
        if (result.errors && result.errors.length > 0) {
          toast.warning(`${result.errors.length} errors encountered during processing.`);
        }
      } else {
        const errorMessage = result.message || 'Status fix operation failed';
        setError(errorMessage);
        toast.error(errorMessage);
      }

    } catch (err) {
      console.error('Status fix error:', err);
      const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred';
      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const handleStatusFix = async (dryRun: boolean) => {
    setIsLoading(true);
    setError(null);

    try {
      // Use the API endpoints you provided
      const result = await api.statusFix.runStatusFix(dryRun);
      setLastResult(result);

      if (result.success) {
        const successMessage = dryRun 
          ? `Analysis complete! ${result.updated_discussions} discussions would be updated.`
          : `Status fixes applied successfully! ${result.updated_discussions} discussions updated.`;
        
        toast.success(successMessage);
        
        if (result.errors && result.errors.length > 0) {
          toast.warning(`${result.errors.length} errors encountered during processing.`);
        }
      } else {
        const errorMessage = result.message || 'Status fix operation failed';
        setError(errorMessage);
        toast.error(errorMessage);
      }

    } catch (err) {
      console.error('Status fix error:', err);
      const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred';
      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const exportResults = () => {
    if (!lastResult) return;

    try {
      const dataStr = JSON.stringify(lastResult, null, 2);
      const dataBlob = new Blob([dataStr], { type: 'application/json' });
      const url = URL.createObjectURL(dataBlob);
      const link = document.createElement('a');
      link.href = url;
      
      const timestamp = new Date().toISOString().split('T')[0];
      const filename = `status-fix-${lastResult.dry_run ? 'preview' : 'applied'}-${timestamp}.json`;
      link.download = filename;
      
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      
      toast.success(`Results exported as ${filename}`);
    } catch (err) {
      console.error('Export error:', err);
      toast.error('Failed to export results');
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'bg-green-100 text-green-800 border-green-200';
      case 'consensus_created': return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'ready_for_consensus': return 'bg-purple-100 text-purple-800 border-purple-200';
      case 'unlocked': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'locked': return 'bg-gray-100 text-gray-800 border-gray-200';
      case 'blocked': return 'bg-red-100 text-red-800 border-red-200';
      case 'rework': return 'bg-orange-100 text-orange-800 border-orange-200';
      case 'flagged': return 'bg-pink-100 text-pink-800 border-pink-200';
      case 'quality_failed': return 'bg-amber-100 text-amber-800 border-amber-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const formatStatus = (status: string) => {
    return status.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
  };

  const clearResults = () => {
    setLastResult(null);
    setError(null);
    toast.info('Results cleared');
  };

  return (
    <div className="space-y-6 p-6 max-w-7xl mx-auto">
      {/* Header */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Discussion Status Fix Manager
          </CardTitle>
          <CardDescription>
            Analyze and fix status inconsistencies across all discussions according to enhanced workflow logic.
            This tool corrects statuses based on annotation counts, consensus existence, and workflow progression rules.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-4 flex-wrap items-center">
            <Button
              onClick={() => handleStatusFix(true)}
              disabled={isLoading}
              variant="outline"
              className="flex items-center gap-2"
            >
              {isLoading ? (
                <RefreshCw className="h-4 w-4 animate-spin" />
              ) : (
                <Eye className="h-4 w-4" />
              )}
              Preview Changes
            </Button>

            <Button
              onClick={() => handleStatusFix(false)}
              disabled={isLoading || !lastResult?.status_updates?.length}
              className="flex items-center gap-2"
            >
              {isLoading ? (
                <RefreshCw className="h-4 w-4 animate-spin" />
              ) : (
                <Zap className="h-4 w-4" />
              )}
              Apply Fixes
            </Button>

            {lastResult && (
              <>
                <Button
                  onClick={exportResults}
                  variant="outline"
                  className="flex items-center gap-2"
                >
                  <Download className="h-4 w-4" />
                  Export Results
                </Button>

                <Button
                  onClick={clearResults}
                  variant="ghost"
                  className="flex items-center gap-2"
                >
                  <FileText className="h-4 w-4" />
                  Clear Results
                </Button>
              </>
            )}
          </div>

          {/* Quick Status Info */}
          {lastResult && (
            <div className="mt-4 p-3 bg-blue-50 rounded-lg">
              <div className="flex items-center gap-2 text-sm text-blue-700">
                <Info className="h-4 w-4" />
                <span>
                  Last run: {lastResult.dry_run ? 'Preview' : 'Applied'} • 
                  {lastResult.timestamp && (
                    <span className="ml-1">
                      {new Date(lastResult.timestamp).toLocaleString()}
                    </span>
                  )}
                </span>
              </div>
            </div>
          )}

          {/* No Issues Found */}
          {lastResult?.status_updates?.length === 0 && lastResult.success && (
            <Alert className="mt-4">
              <CheckCircle className="h-4 w-4" />
              <AlertTitle>No Issues Found</AlertTitle>
              <AlertDescription>
                All discussion statuses are consistent with the workflow logic. No fixes needed.
                Analyzed {lastResult.total_discussions_analyzed} discussions.
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* Error Display */}
      {error && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription className="whitespace-pre-wrap">{error}</AlertDescription>
        </Alert>
      )}

      {/* Results Display */}
      {lastResult && lastResult.status_updates && lastResult.status_updates.length > 0 && (
        <div className="space-y-4">
          {/* Summary Card */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                {lastResult.dry_run ? (
                  <Eye className="h-5 w-5 text-blue-600" />
                ) : (
                  <CheckCircle className="h-5 w-5 text-green-600" />
                )}
                {lastResult.dry_run ? 'Analysis Results' : 'Fixes Applied'}
              </CardTitle>
              <CardDescription className="flex items-center gap-2">
                {lastResult.message}
                {lastResult.timestamp && (
                  <span className="text-xs text-muted-foreground flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {new Date(lastResult.timestamp).toLocaleString()}
                  </span>
                )}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="text-center p-4 bg-blue-50 rounded-lg border border-blue-200">
                  <div className="text-2xl font-bold text-blue-600">
                    {lastResult.total_discussions_analyzed}
                  </div>
                  <div className="text-sm text-blue-700">Discussions Analyzed</div>
                </div>
                <div className="text-center p-4 bg-green-50 rounded-lg border border-green-200">
                  <div className="text-2xl font-bold text-green-600">
                    {lastResult.updated_discussions}
                  </div>
                  <div className="text-sm text-green-700">
                    {lastResult.dry_run ? 'Would Be Updated' : 'Updated'}
                  </div>
                </div>
                <div className="text-center p-4 bg-purple-50 rounded-lg border border-purple-200">
                  <div className="text-2xl font-bold text-purple-600">
                    {lastResult.status_updates?.length || 0}
                  </div>
                  <div className="text-sm text-purple-700">Total Status Changes</div>
                </div>
                <div className="text-center p-4 bg-orange-50 rounded-lg border border-orange-200">
                  <div className="text-2xl font-bold text-orange-600">
                    {lastResult.rework_tasks_preserved || 0}
                  </div>
                  <div className="text-sm text-orange-700">Rework Tasks Preserved</div>
                </div>
              </div>

              {/* Rework Preservation Alert */}
              {lastResult.rework_tasks_preserved && lastResult.rework_tasks_preserved > 0 && (
                <Alert className="mt-4">
                  <Info className="h-4 w-4" />
                  <AlertTitle>Rework Tasks Preserved</AlertTitle>
                  <AlertDescription>
                    {lastResult.rework_tasks_preserved} tasks with rework flags were preserved and not modified. 
                    These tasks require manual review due to workflow corrections.
                  </AlertDescription>
                </Alert>
              )}

              {/* Rework Scenarios Summary */}
              {lastResult.summary?.rework_scenarios_preserved && Object.keys(lastResult.summary.rework_scenarios_preserved).length > 0 && (
                <div className="mt-6">
                  <h4 className="font-medium mb-3 flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 text-orange-500" />
                    Rework Scenarios Preserved
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    {Object.entries(lastResult.summary.rework_scenarios_preserved).map(([scenario, count]) => (
                      <div key={scenario} className="flex items-center justify-between p-3 bg-orange-50 rounded border border-orange-200">
                        <span className="text-sm font-medium text-orange-800">
                          {scenario.replace(/_/g, ' ').toUpperCase()}
                        </span>
                        <Badge variant="outline" className="bg-orange-100 text-orange-800 border-orange-300">
                          {count}
                        </Badge>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Errors Display */}
              {lastResult.errors && lastResult.errors.length > 0 && (
                <Alert variant="destructive" className="mt-4">
                  <AlertCircle className="h-4 w-4" />
                  <AlertTitle>Processing Errors ({lastResult.errors.length})</AlertTitle>
                  <AlertDescription>
                    <div className="mt-2 space-y-1 max-h-32 overflow-y-auto">
                      {lastResult.errors.slice(0, 10).map((error, index) => (
                        <div key={index} className="text-xs font-mono bg-red-50 p-2 rounded border">
                          {error}
                        </div>
                      ))}
                      {lastResult.errors.length > 10 && (
                        <div className="text-xs text-muted-foreground">
                          ... and {lastResult.errors.length - 10} more errors
                        </div>
                      )}
                    </div>
                  </AlertDescription>
                </Alert>
              )}

              {/* Status Changes Summary */}
              {lastResult.summary?.status_changes && Object.keys(lastResult.summary.status_changes).length > 0 && (
                <div className="mt-6">
                  <h4 className="font-medium mb-3 flex items-center gap-2">
                    <ArrowRight className="h-4 w-4" />
                    Status Transitions
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    {Object.entries(lastResult.summary.status_changes)
                      .sort(([,a], [,b]) => b - a) // Sort by count descending
                      .map(([transition, count]) => (
                      <div key={transition} className="flex items-center justify-between p-3 bg-gray-50 rounded border hover:bg-gray-100">
                        <div className="flex items-center gap-2 text-sm">
                          <span className="font-mono">{transition}</span>
                        </div>
                        <Badge variant="outline" className="font-semibold">{count}</Badge>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Fix Types Summary */}
              {lastResult.summary?.fixes_applied && Object.keys(lastResult.summary.fixes_applied).length > 0 && (
                <div className="mt-6">
                  <h4 className="font-medium mb-3 flex items-center gap-2">
                    <Zap className="h-4 w-4" />
                    Fix Types Applied
                  </h4>
                  <div className="space-y-2">
                    {Object.entries(lastResult.summary.fixes_applied)
                      .sort(([,a], [,b]) => b - a) // Sort by count descending
                      .map(([fixType, count]) => (
                      <div key={fixType} className="flex items-center justify-between p-3 bg-gray-50 rounded border hover:bg-gray-100">
                        <span className="text-sm">{fixType}</span>
                        <Badge variant="outline" className="font-semibold">{count}</Badge>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Tasks Affected Summary */}
              {lastResult.summary?.tasks_affected && Object.keys(lastResult.summary.tasks_affected).length > 0 && (
                <div className="mt-6">
                  <h4 className="font-medium mb-3 flex items-center gap-2">
                    <Settings className="h-4 w-4" />
                    Tasks Affected
                  </h4>
                  <div className="flex gap-2 flex-wrap">
                    {Object.entries(lastResult.summary.tasks_affected)
                      .filter(([, count]) => count > 0) // Only show tasks with changes
                      .map(([task, count]) => (
                      <Badge key={task} variant="secondary" className="text-sm px-3 py-1">
                        {task.replace('_', ' ').toUpperCase()}: {count}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Rework Details Card */}
          {lastResult.rework_details && lastResult.rework_details.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span className="flex items-center gap-2">
                    <AlertTriangle className="h-5 w-5 text-orange-500" />
                    Rework Tasks Preserved
                  </span>
                  <Badge variant="outline" className="bg-orange-100 text-orange-800">
                    {lastResult.rework_details.length} preserved
                  </Badge>
                </CardTitle>
                <CardDescription>
                  Tasks that were flagged for rework and intentionally preserved to maintain workflow integrity
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3 max-h-64 overflow-y-auto">
                  {lastResult.rework_details.map((rework, index) => (
                    <div key={index} className="p-4 border border-orange-200 rounded-lg bg-orange-50">
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-sm truncate" title={rework.discussion_title}>
                            {rework.discussion_title}
                          </div>
                          <div className="text-xs text-muted-foreground mt-1">
                            ID: {rework.discussion_id} • Task {rework.task_id}
                          </div>
                        </div>
                        <div className="ml-4 text-right">
                          <Badge className="bg-orange-100 text-orange-800 border-orange-300" variant="outline">
                            {rework.workflow_scenario?.replace(/_/g, ' ').toUpperCase() || 'REWORK'}
                          </Badge>
                        </div>
                      </div>
                      
                      <div className="text-sm text-orange-700 bg-orange-100 p-3 rounded border-l-4 border-orange-300">
                        <strong>Reason:</strong> {rework.rework_reason}
                      </div>
                      
                      <div className="flex items-center justify-between mt-3 text-xs text-muted-foreground">
                        <span>Flagged by: {rework.flagged_by}</span>
                        <span>{new Date(rework.flagged_at).toLocaleDateString()}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Detailed Status Updates */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>Detailed Status Changes</span>
                <Badge variant="outline">{lastResult.status_updates.length} changes</Badge>
              </CardTitle>
              <CardDescription>
                Individual status updates {lastResult.dry_run ? 'that would be applied' : 'that were applied'}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3 max-h-96 overflow-y-auto">
                {lastResult.status_updates.map((update, index) => (
                  <div key={index} className="p-4 border rounded-lg hover:bg-gray-50 transition-colors">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-sm truncate" title={update.discussion_title}>
                          {update.discussion_title}
                        </div>
                        <div className="text-xs text-muted-foreground mt-1">
                          ID: {update.discussion_id} • Task {update.task_id}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 ml-4">
                        <Badge className={getStatusColor(update.current_status)} variant="outline">
                          {formatStatus(update.current_status)}
                        </Badge>
                        <ArrowRight className="h-3 w-3 text-muted-foreground" />
                        <Badge className={getStatusColor(update.correct_status)} variant="outline">
                          {formatStatus(update.correct_status)}
                        </Badge>
                      </div>
                    </div>
                    
                    <div className="text-sm text-muted-foreground bg-gray-100 p-3 rounded border-l-4 border-blue-200">
                      <strong className="text-gray-700">Reason:</strong> {update.reason}
                    </div>
                    
                    <div className="flex items-center justify-between mt-3">
                      {update.applied ? (
                        <div className="flex items-center gap-1">
                          <CheckCircle className="h-4 w-4 text-green-600" />
                          <span className="text-sm text-green-600 font-medium">Applied</span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1">
                          <Eye className="h-4 w-4 text-blue-600" />
                          <span className="text-sm text-blue-600 font-medium">Preview</span>
                        </div>
                      )}
                      <div className="text-xs text-muted-foreground">
                        Change #{index + 1}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
};

export default StatusFixManager;