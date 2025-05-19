import React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Annotation } from '@/services/api';
import { Button } from '@/components/ui/button';
import { Edit, Check, Star } from 'lucide-react';
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface AnnotationFeedbackData {
  rating?: number;
  comment?: string;
}

interface AnnotationFeedbackState {
  [annotationId: string]: AnnotationFeedbackData;
}

interface AnnotatorViewProps {
  discussionId: string;
  currentStep: number;
  getAnnotationsForTask: (discussionId: string, taskId: number) => Annotation[];
  onUseForConsensus?: (annotation: Annotation) => void;
  getUserEmailById?: (userId: string) => string;
  annotationFeedback?: AnnotationFeedbackState;
  onRatingChange?: (annotationId: string, rating: number) => void;
  onCommentChange?: (annotationId: string, comment: string) => void;
}

const formatKey = (key: string): string => {
  // Remove _text suffix for display
  const baseKey = key.replace('_text', '');
  
  // Convert snake_case or camelCase to Title Case with spaces
  return baseKey
    .replace(/_/g, ' ')
    .replace(/([A-Z])/g, ' $1')
    .replace(/^./, str => str.toUpperCase());
};

const formatValue = (value: any): string => {
  if (value === undefined || value === null) {
    return 'Not provided';
  }
  
  if (typeof value === 'boolean') {
    return value ? 'Yes' : 'No';
  }
  
  return String(value);
};

const AnnotatorView: React.FC<AnnotatorViewProps> = ({
  discussionId,
  currentStep,
  getAnnotationsForTask,
  onUseForConsensus,
  getUserEmailById,
  annotationFeedback,
  onRatingChange,
  onCommentChange
}) => {
  if (!discussionId) return null;
  
  const annotations = getAnnotationsForTask(discussionId, currentStep);
  
  if (annotations.length === 0) {
    return (
      <div className="mt-6">
        <div className="text-center py-8 bg-gray-50 border border-gray-200 rounded-md">
          <p className="text-gray-500">No annotations available for this task yet.</p>
        </div>
      </div>
    );
  }
  
  return (
    <div className="mt-6 space-y-4">
      <h3 className="text-lg font-medium">Annotator Submissions ({annotations.length})</h3>
      <p className="text-sm text-gray-500">
        As a pod lead, you can review individual annotator responses and use them to create the consensus.
      </p>
      
      <div className="grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
        {annotations.map((annotation, index) => {
          const currentFeedback = annotationFeedback?.[annotation.id] || {};
          const rating = currentFeedback.rating || 0;
          const comment = currentFeedback.comment || '';

          return (
            <Card key={annotation.id || index} className="text-sm flex flex-col">
              <CardHeader className="py-3">
                <CardTitle className="text-base flex justify-between">
                  <span>
                    {getUserEmailById ? getUserEmailById(annotation.user_id) : `Annotator (ID: ${annotation.user_id})`}
                  </span>
                  <span className="text-xs text-gray-500">{new Date(annotation.timestamp).toLocaleString()}</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="py-3 flex-grow">
                <div className="space-y-2">
                  {Object.entries(annotation.data || {})
                    .filter(([key]) => !key.startsWith('_')) // Filter out metadata fields
                    .map(([key, value]) => {
                      // Skip displaying text fields directly - they're shown with their parent
                      if (key.endsWith('_text')) return null;
                      
                      const textKey = `${key}_text`;
                      const hasTextValue = annotation.data[textKey] !== undefined;
                      
                      return (
                        <div key={key} className="mb-3">
                          <div className="font-medium text-xs uppercase text-gray-500">{formatKey(key)}</div>
                          <div className="text-gray-800">{formatValue(value)}</div>
                          
                          {/* Display text value if available */}
                          {hasTextValue && (
                            <div className="mt-1 bg-gray-50 p-2 rounded text-xs">
                              {formatValue(annotation.data[textKey])}
                            </div>
                          )}
                        </div>
                      );
                    })}
                </div>
                
                {/* Star Rating and Comment Section */}
                <div className="mt-4 pt-3 border-t">
                  <div className="mb-2">
                    <Label htmlFor={`rating-${annotation.id}`} className="text-xs font-medium text-gray-600">Rate this annotation:</Label>
                    <div className="flex items-center mt-1">
                      {[1, 2, 3, 4, 5].map((star) => (
                        <Button 
                          key={star} 
                          variant="ghost" 
                          size="icon" 
                          className={`h-6 w-6 p-0 ${rating >= star ? 'text-yellow-400' : 'text-gray-300'}`}
                          onClick={() => onRatingChange?.(String(annotation.id), star)}
                        >
                          <Star className="h-4 w-4 fill-current" />
                        </Button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <Label htmlFor={`comment-${annotation.id}`} className="text-xs font-medium text-gray-600">Comment:</Label>
                    <Input 
                      id={`comment-${annotation.id}`}
                      type="text" 
                      placeholder="Add a comment..."
                      value={comment}
                      onChange={(e) => onCommentChange?.(String(annotation.id), e.target.value)}
                      className="mt-1 text-xs h-8"
                    />
                  </div>
                </div>
              </CardContent>
              <CardFooter className="pt-0 pb-3 mt-auto">
                <div className="flex justify-end w-full">
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    className="text-xs"
                    onClick={() => onUseForConsensus?.(annotation)}
                  >
                    <Check className="h-3 w-3 mr-1" />
                    Use for consensus
                  </Button>
                </div>
              </CardFooter>
            </Card>
          );
        })}
      </div>
    </div>
  );
};

export default AnnotatorView;
