
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface AnnotatorViewProps {
  discussionId: string | null;
  currentStep: number;
  getAnnotationsForTask: (discussionId: string, taskId: number) => any[];
}

const AnnotatorView: React.FC<AnnotatorViewProps> = ({
  discussionId,
  currentStep,
  getAnnotationsForTask
}) => {
  if (!discussionId) return null;
  
  const annotations = getAnnotationsForTask(discussionId, currentStep);
  
  return (
    <div className="mt-6 space-y-4">
      <h3 className="text-lg font-medium">Annotator Submissions</h3>
      <div className="grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
        {annotations.map((annotation, index) => (
          <Card key={index} className="text-sm">
            <CardHeader className="py-3">
              <CardTitle className="text-base">Annotator {index + 1}</CardTitle>
            </CardHeader>
            <CardContent className="py-3">
              <div className="space-y-2">
                {Object.entries(annotation.data).map(([key, value]) => (
                  <div key={key} className="flex justify-between">
                    <span className="font-medium">{key}:</span>
                    <span className="text-gray-600">{value.toString()}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
};

export default AnnotatorView;
