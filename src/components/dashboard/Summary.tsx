
import React from 'react';
import { Button } from '@/components/ui/button';
import { Download } from 'lucide-react';

interface SummaryProps {
  results: {
    task1Results: Record<string, string | boolean>;
    task2Results: Record<string, string | boolean>;
    task3Results: Record<string, string | boolean>;
  };
}

const Summary: React.FC<SummaryProps> = ({ results }) => {
  const generateJson = () => {
    const json = JSON.stringify(results, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'evaluation-results.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-lg font-medium">Evaluation Summary</h2>
        <Button 
          onClick={generateJson} 
          variant="outline" 
          className="flex items-center gap-2"
        >
          <Download className="h-4 w-4" />
          <span>Export JSON</span>
        </Button>
      </div>
      
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
    </div>
  );
};

export default Summary;
