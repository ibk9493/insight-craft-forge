
import React, { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Download, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';

interface SummaryProps {
  results: {
    task1Results: Record<string, string | boolean>;
    task2Results: Record<string, string | boolean>;
    task3Results: Record<string, string | boolean>;
  };
}

const Summary: React.FC<SummaryProps> = ({ results }) => {
  const [isGenerating, setIsGenerating] = useState(false);
  
  useEffect(() => {
    // Log the results for debugging
    console.log('[Summary] Displaying results:', results);
    
    // Check if we have any data
    const hasTask1Data = Object.keys(results.task1Results).length > 0;
    const hasTask2Data = Object.keys(results.task2Results).length > 0;
    const hasTask3Data = Object.keys(results.task3Results).length > 0;
    
    if (!hasTask1Data && !hasTask2Data && !hasTask3Data) {
      console.warn('[Summary] No data available to display');
    } else {
      console.info('[Summary] Data found for display:', { 
        task1Count: Object.keys(results.task1Results).length,
        task2Count: Object.keys(results.task2Results).length,
        task3Count: Object.keys(results.task3Results).length
      });
    }
  }, [results]);
  
  const generateJson = async () => {
    try {
      console.log('[Summary] Generating JSON export');
      setIsGenerating(true);
      
      // Add timestamp and metadata to the exported file
      const exportData = {
        metadata: {
          timestamp: new Date().toISOString(),
          version: '1.0',
          exportedAt: new Date().toLocaleString()
        },
        results: {
          ...results
        }
      };
      
      const json = JSON.stringify(exportData, null, 2);
      console.log('[Summary] JSON generated successfully, size:', json.length);
      
      // Create the file for download
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const filename = `evaluation-results-${new Date().toISOString().split('T')[0]}.json`;
      
      // Create a download link and trigger the download
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
      toast.success("Export completed", {
        description: `Saved as ${filename}`
      });
      
      console.log('[Summary] Export completed, file saved as:', filename);
    } catch (error) {
      console.error('[Summary] Error generating JSON export:', error);
      toast.error("Failed to export data", {
        description: "An error occurred while generating the JSON file"
      });
    } finally {
      setIsGenerating(false);
    }
  };

  // Check if we have any data to display
  const hasNoData = Object.keys(results.task1Results).length === 0 &&
                    Object.keys(results.task2Results).length === 0 &&
                    Object.keys(results.task3Results).length === 0;

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-lg font-medium">Evaluation Summary</h2>
        <Button 
          onClick={generateJson} 
          variant="outline" 
          className="flex items-center gap-2"
          disabled={hasNoData || isGenerating}
        >
          <Download className="h-4 w-4" />
          <span>{isGenerating ? 'Generating...' : 'Export JSON'}</span>
        </Button>
      </div>
      
      {hasNoData ? (
        <div className="flex flex-col items-center justify-center py-8 text-gray-500">
          <AlertTriangle className="w-12 h-12 mb-3 text-yellow-500" />
          <p className="text-lg font-medium">No data available</p>
          <p className="text-sm text-center mt-2">
            Please complete all annotation tasks to view the summary
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="border-b pb-2">
            <h3 className="font-medium mb-2">Task 1: Question Quality Assessment</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {Object.entries(results.task1Results).map(([key, value]) => (
                <div key={key} className="flex justify-between items-center text-sm">
                  <span className="text-gray-600">{key}:</span>
                  <span className={
                    typeof value === 'boolean'
                      ? value ? 'text-dashboard-green' : 'text-dashboard-red'
                      : 'font-medium'
                  }>
                    {typeof value === 'boolean' ? (value ? 'Yes' : 'No') : value}
                  </span>
                </div>
              ))}
            </div>
          </div>
          
          <div className="border-b pb-2">
            <h3 className="font-medium mb-2">Task 2: Answer Quality Assessment</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {Object.entries(results.task2Results).map(([key, value]) => (
                <div key={key} className="flex justify-between items-center text-sm">
                  <span className="text-gray-600">{key}:</span>
                  <span className={
                    typeof value === 'boolean'
                      ? value ? 'text-dashboard-green' : 'text-dashboard-red'
                      : 'font-medium'
                  }>
                    {typeof value === 'boolean' ? (value ? 'Yes' : 'No') : value}
                  </span>
                </div>
              ))}
            </div>
          </div>
          
          <div>
            <h3 className="font-medium mb-2">Task 3: Rewrite Question and Answer</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {Object.entries(results.task3Results).map(([key, value]) => (
                <div key={key} className="flex justify-between items-center text-sm">
                  <span className="text-gray-600">{key}:</span>
                  <span className={
                    typeof value === 'boolean'
                      ? value ? 'text-dashboard-green' : 'text-dashboard-red'
                      : 'font-medium'
                  }>
                    {typeof value === 'boolean' ? (value ? 'Yes' : 'No') : value}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Summary;
