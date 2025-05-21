
import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs-wrapper';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, ResponsiveContainer, PieChart, Pie, Cell, Tooltip } from 'recharts';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Grid, List, BarChart3, PieChart as PieChartIcon, Calendar, Download } from 'lucide-react';
import { SystemSummary, AnnotationActivity, RepositoryBreakdown } from '@/services/api/types';
import { DateRange } from 'react-day-picker';
import { DateRangePicker } from '@/components/ui/date-range-picker';
import { format } from 'date-fns';
import { toast } from 'sonner';

interface AnalyticsDashboardProps {
  systemSummary: SystemSummary;
  annotationActivity?: AnnotationActivity[];
  repositoryBreakdown?: RepositoryBreakdown[];
  isLoading?: boolean;
  onDateRangeChange?: (dateRange: DateRange | undefined) => void;
  onExport?: (format: 'csv' | 'json') => void;
}

// Mock data for development purposes
const mockAnnotationActivity: AnnotationActivity[] = [
  { date: '2025-05-10', count: 12 },
  { date: '2025-05-11', count: 19 },
  { date: '2025-05-12', count: 24 },
  { date: '2025-05-13', count: 15 },
  { date: '2025-05-14', count: 28 },
  { date: '2025-05-15', count: 22 },
  { date: '2025-05-16', count: 30 },
];

const mockRepositoryBreakdown: RepositoryBreakdown[] = [
  { repository: 'react', count: 25 },
  { repository: 'typescript', count: 18 },
  { repository: 'pytorch', count: 15 },
  { repository: 'tensorflow', count: 12 },
  { repository: 'langchain', count: 10 },
];

// Colors for the pie chart
const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8'];

const AnalyticsDashboard: React.FC<AnalyticsDashboardProps> = ({
  systemSummary,
  annotationActivity = mockAnnotationActivity,
  repositoryBreakdown = mockRepositoryBreakdown,
  isLoading = false,
  onDateRangeChange,
  onExport,
}) => {
  const [activeTab, setActiveTab] = useState('overview');
  const [dateRange, setDateRange] = useState<DateRange | undefined>({
    from: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
    to: new Date()
  });
  const [chartView, setChartView] = useState<'bar' | 'pie'>('bar');
  const [isExporting, setIsExporting] = useState(false);

  // Handle date range change
  const handleDateRangeChange = (range: DateRange | undefined) => {
    setDateRange(range);
    if (onDateRangeChange) {
      onDateRangeChange(range);
    }
  };

  // Format date for display
  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return format(date, 'MMM dd');
  };

  // Handle export
  const handleExport = async (format: 'csv' | 'json'='json') => {
    setIsExporting(true);
    
    try {
      if (onExport) {
        await onExport(format);
      } else {
        // Fallback export if no handler is provided
        const data = {
          systemSummary,
          annotationActivity,
          repositoryBreakdown,
          exportedAt: new Date().toISOString(),
          dateRange
        };
        
        const blob = new Blob(
          [format === 'json' ? JSON.stringify(data, null, 2) : convertToCSV(data)], 
          { type: format === 'json' ? 'application/json' : 'text/csv' }
        );
        
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `analytics-export-${new Date().toISOString().split('T')[0]}.${format}`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
        toast.success(`Export completed as ${format.toUpperCase()}`);
      }
    } catch (error) {
      console.error('Export error:', error);
      toast.error(`Failed to export as ${format.toUpperCase()}`);
    } finally {
      setIsExporting(false);
    }
  };
  
  // Helper function to convert data to CSV format
  const convertToCSV = (data: any) => {
    // Simple CSV conversion - in a real app, this would be more sophisticated
    const replacer = (key: string, value: any) => value === null ? '' : value;
    const header = Object.keys(data.systemSummary || {});
    let csv = header.join(',') + '\n';
    
    csv += header.map(key => 
      JSON.stringify((data.systemSummary || {})[key], replacer)
    ).join(',');
    
    return csv;
  };

  // Ensure systemSummary always has valid values even if the API fails
  const safeSystemSummary = {
    totalDiscussions: systemSummary?.totalDiscussions || 0,
    task1Completed: systemSummary?.task1Completed || 0,
    task2Completed: systemSummary?.task2Completed || 0,
    task3Completed: systemSummary?.task3Completed || 0,
    totalTasksCompleted: systemSummary?.totalTasksCompleted || 0,
    totalAnnotations: systemSummary?.totalAnnotations || 0,
    uniqueAnnotators: systemSummary?.uniqueAnnotators || 0,
    batchesBreakdown: systemSummary?.batchesBreakdown || []
  };

  return (
    <Card className="w-full shadow-md">
      <CardHeader>
        <div className="flex justify-between items-center">
          <div>
            <CardTitle>Analytics Dashboard</CardTitle>
            <CardDescription>
              Monitor annotation activity and performance metrics
            </CardDescription>
          </div>
          <div className="flex items-center space-x-2">
            <DateRangePicker
              value={dateRange}
              onValueChange={handleDateRangeChange}
            />
            <div className="relative">
              <Button 
                variant="outline" 
                className="flex items-center gap-2"
                disabled={isExporting}
                onClick={() => handleExport('json')}
              >
                <Download className="h-4 w-4" />
                <span>{isExporting ? 'Exporting...' : 'Export'}</span>
              </Button>
              <Select 
                onValueChange={(value) => handleExport(value as 'csv' | 'json')}
                disabled={isExporting}
              >
                <SelectTrigger className="w-[120px] sr-only">
                  <SelectValue placeholder="Export Format" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="csv">CSV</SelectItem>
                  <SelectItem value="json">JSON</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <Tabs 
          defaultValue={activeTab}
          value={activeTab} 
          onValueChange={setActiveTab}
        >
          <TabsList className="mb-4">
            <TabsTrigger value="overview" className="flex items-center gap-2">
              <Grid className="h-4 w-4" />
              <span>Overview</span>
            </TabsTrigger>
            <TabsTrigger value="activity" className="flex items-center gap-2">
              <BarChart3 className="h-4 w-4" />
              <span>Activity</span>
            </TabsTrigger>
            <TabsTrigger value="repositories" className="flex items-center gap-2">
              <PieChartIcon className="h-4 w-4" />
              <span>Repositories</span>
            </TabsTrigger>
          </TabsList>

          {/* Overview Tab */}
          <TabsContent value="overview" className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-lg">Total Discussions</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold">
                    {safeSystemSummary.totalDiscussions}
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-lg">Total Annotations</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold">
                    {safeSystemSummary.totalAnnotations}
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-lg">Unique Annotators</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold">
                    {safeSystemSummary.uniqueAnnotators}
                  </div>
                </CardContent>
              </Card>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Tasks Completed</CardTitle>
                </CardHeader>
                <CardContent className="h-[200px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={[
                        { name: 'Task 1', value: safeSystemSummary.task1Completed },
                        { name: 'Task 2', value: safeSystemSummary.task2Completed },
                        { name: 'Task 3', value: safeSystemSummary.task3Completed }
                      ]}
                      margin={{ top: 10, right: 10, left: 0, bottom: 20 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" vertical={false} />
                      <XAxis dataKey="name" />
                      <YAxis />
                      <Tooltip 
                        content={({ active, payload }) => {
                          if (active && payload && payload.length) {
                            return (
                              <div className="bg-white border p-2 shadow-md">
                                <p className="font-medium">{`${payload[0].name}: ${payload[0].value}`}</p>
                              </div>
                            );
                          }
                          return null;
                        }}
                      />
                      <Bar dataKey="value" fill="#8884d8" />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Batch Distribution</CardTitle>
                </CardHeader>
                <CardContent className="h-[200px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={safeSystemSummary.batchesBreakdown.length > 0 ? 
                          safeSystemSummary.batchesBreakdown : 
                          [{ name: 'No Data', discussions: 1 }]
                        }
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                        outerRadius={80}
                        fill="#8884d8"
                        dataKey="discussions"
                        nameKey="name"
                      >
                        {(safeSystemSummary.batchesBreakdown.length > 0 ? 
                          safeSystemSummary.batchesBreakdown : 
                          [{ name: 'No Data', discussions: 1 }]
                        ).map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Activity Tab */}
          <TabsContent value="activity">
            <Card>
              <CardHeader>
                <div className="flex justify-between items-center">
                  <CardTitle>Annotation Activity</CardTitle>
                  <div className="flex items-center space-x-2">
                    <Button variant="outline" size="sm" onClick={() => setChartView('bar')} className={chartView === 'bar' ? 'bg-muted' : ''}>
                      <BarChart3 className="h-4 w-4" />
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => setChartView('pie')} className={chartView === 'pie' ? 'bg-muted' : ''}>
                      <PieChartIcon className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  {chartView === 'bar' ? (
                    <BarChart
                      data={annotationActivity}
                      margin={{ top: 10, right: 10, left: 10, bottom: 20 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" vertical={false} />
                      <XAxis dataKey="date" tickFormatter={formatDate} />
                      <YAxis />
                      <Tooltip
                        content={({ active, payload }) => {
                          if (active && payload && payload.length) {
                            return (
                              <div className="bg-white border p-2 shadow-md">
                                <p className="font-medium">{`Date: ${formatDate(payload[0].payload.date)}`}</p>
                                <p>{`Annotations: ${payload[0].value}`}</p>
                              </div>
                            );
                          }
                          return null;
                        }}
                      />
                      <Bar dataKey="count" fill="#0088FE" />
                    </BarChart>
                  ) : (
                    <PieChart>
                      <Pie
                        data={annotationActivity}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        label={({ date, count, percent }) => 
                          `${formatDate(date)}: ${(percent * 100).toFixed(0)}%`
                        }
                        outerRadius={80}
                        fill="#8884d8"
                        dataKey="count"
                        nameKey="date"
                      >
                        {annotationActivity.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  )}
                </ResponsiveContainer>
              </CardContent>
              <CardFooter>
                <div className="text-sm text-muted-foreground">
                  {dateRange?.from && dateRange?.to ? (
                    <p>Showing data from {format(dateRange.from, 'MMM dd, yyyy')} to {format(dateRange.to, 'MMM dd, yyyy')}</p>
                  ) : (
                    <p>Select a date range to filter data</p>
                  )}
                </div>
              </CardFooter>
            </Card>
          </TabsContent>

          {/* Repositories Tab */}
          <TabsContent value="repositories">
            <Card>
              <CardHeader>
                <CardTitle>Repository Distribution</CardTitle>
                <CardDescription>
                  Breakdown of discussions by repository
                </CardDescription>
              </CardHeader>
              <CardContent className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={repositoryBreakdown}
                    layout="vertical"
                    margin={{ top: 5, right: 30, left: 80, bottom: 5 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} />
                    <XAxis type="number" />
                    <YAxis type="category" dataKey="repository" width={80} />
                    <Tooltip
                      content={({ active, payload }) => {
                        if (active && payload && payload.length) {
                          return (
                            <div className="bg-white border p-2 shadow-md">
                              <p className="font-medium">{`${payload[0].payload.repository}`}</p>
                              <p>{`Discussions: ${payload[0].value}`}</p>
                            </div>
                          );
                        }
                        return null;
                      }}
                    />
                    <Bar dataKey="count" fill="#00C49F" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
};

export default AnalyticsDashboard;
