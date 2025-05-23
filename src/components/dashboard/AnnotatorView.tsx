import React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Annotation } from '@/services/api';
import { Button } from '@/components/ui/button';
import { Edit, Check, BarChart3, Users, User, Layers } from 'lucide-react';
import AnnotatorEmail from './AnnotatorEmail';
import { Badge } from '../ui/badge';

interface AnnotatorViewProps {
  discussionId: string;
  currentStep: number;
  getAnnotationsForTask: (discussionId: string, taskId: number) => Annotation[];
  onUseForConsensus?: (annotation: Annotation) => void;
  getUserEmailById?: (userId: string) => Promise<string>;
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
    <div className="mt-6 space-y-6">
      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-lg p-4">
        <h3 className="text-lg font-semibold text-gray-900 flex items-center">
          <Users className="h-5 w-5 mr-2 text-blue-600" />
          Annotator Submissions ({annotations.length})
        </h3>
        <p className="text-sm text-gray-600 mt-1">
          As a pod lead, you can review individual annotator responses and use them to create the consensus.
        </p>
      </div>
      
      <div className="grid gap-6 grid-cols-1 lg:grid-cols-2 xl:grid-cols-3">
        {annotations.map((annotation, index) => {
          const compositeKey = `${annotation.user_id}-${annotation.task_id}`;
          const isTask3 = annotation.task_id === 3;
  
          return (
            <Card key={compositeKey} className="text-sm flex flex-col hover:shadow-lg transition-shadow duration-200 border-l-4 border-l-blue-500">
              <CardHeader className="py-4 bg-gray-50">
                <CardTitle className="text-base flex justify-between items-start">
                  <div className="flex items-center">
                    <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center mr-3">
                      <User className="h-4 w-4 text-blue-600" />
                    </div>
                    <div>
                      {getUserEmailById ? (
                        <AnnotatorEmail userId={annotation.user_id} getUserEmailById={getUserEmailById} />
                      ) : (
                        <span className="font-medium">Annotator {annotation.user_id}</span>
                      )}
                      <div className="text-xs text-gray-500 mt-1">
                        {new Date(annotation.timestamp).toLocaleDateString()} at {new Date(annotation.timestamp).toLocaleTimeString()}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Badge variant="secondary" className="text-xs">
                      Task {annotation.task_id}
                    </Badge>
                  </div>
                </CardTitle>
              </CardHeader>
              
              <CardContent className="py-4 flex-grow">
                <div className="space-y-4">
                  {isTask3 ? (
                    // Special handling for Task 3 with forms and structured data
                    <div className="space-y-4">
                      {/* Show forms if available */}
                      {annotation.data.forms && Array.isArray(annotation.data.forms) && (
                        <div className="space-y-3">
                          <div className="flex items-center text-xs font-medium text-gray-600 uppercase tracking-wide">
                            <Layers className="h-3 w-3 mr-1" />
                            Multiple Forms ({annotation.data.forms.length})
                          </div>
                          {annotation.data.forms.map((form: any, formIndex: number) => (
                            <div key={formIndex} className="bg-gray-50 rounded-lg p-3 border-l-2 border-l-indigo-300">
                              <div className="font-medium text-sm text-gray-800 mb-2">
                                {form.formName || `Form ${formIndex + 1}`}
                              </div>
                              <div className="space-y-2">
                                {Object.entries(form)
                                  .filter(([key]) => !['formId', 'formName', 'formIndex'].includes(key))
                                  .map(([key, value]) => (
                                    <div key={key}>
                                      {key === 'short_answer_list' && Array.isArray(value) ? (
                                        <div>
                                          <div className="font-medium text-xs text-gray-600 mb-1">Claims & Weights</div>
                                          <div className="space-y-1">
                                            {value.map((item: any, idx: number) => (
                                              <div key={idx} className="flex items-start justify-between bg-white p-2 rounded border">
                                                <span className="text-xs flex-1">{typeof item === 'object' ? item.claim : item}</span>
                                                {typeof item === 'object' && item.weight && (
                                                  <Badge variant="outline" className="text-xs ml-2">
                                                    Weight: {item.weight}
                                                  </Badge>
                                                )}
                                              </div>
                                            ))}
                                          </div>
                                        </div>
                                      ) : key === 'supporting_docs' && Array.isArray(value) ? (
                                        <div>
                                          <div className="font-medium text-xs text-gray-600 mb-1">Supporting Docs</div>
                                          <div className="space-y-1">
                                            {value.map((doc: any, idx: number) => (
                                              <div key={idx} className="bg-white p-2 rounded border text-xs">
                                                <div className="font-medium text-blue-600 truncate">{doc.link}</div>
                                                <div className="text-gray-600 mt-1 line-clamp-2">{doc.paragraph}</div>
                                              </div>
                                            ))}
                                          </div>
                                        </div>
                                      ) : !key.endsWith('_text') ? (
                                        <div>
                                          <div className="font-medium text-xs text-gray-600">{formatKey(key)}</div>
                                          <div className="text-gray-800 text-xs">{formatValue(value)}</div>
                                          {form[`${key}_text`] && (
                                            <div className="mt-1 bg-white p-2 rounded border text-xs text-gray-600">
                                              {formatValue(form[`${key}_text`])}
                                            </div>
                                          )}
                                        </div>
                                      ) : null}
                                    </div>
                                  ))}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                      
                      {/* Show aggregated data */}
                      <div className="space-y-3">
                        <div className="flex items-center text-xs font-medium text-gray-600 uppercase tracking-wide">
                          <BarChart3 className="h-3 w-3 mr-1" />
                          Aggregated Results
                        </div>
                        
                        {/* Aggregated short answers */}
                        {annotation.data.short_answer_list && Array.isArray(annotation.data.short_answer_list) && (
                          <div className="bg-blue-50 rounded-lg p-3">
                            <div className="font-medium text-xs text-gray-800 mb-2">Short Answer Claims</div>
                            {annotation.data.short_answer_list.length > 0 && Array.isArray(annotation.data.short_answer_list[0]) ? (
                              // Multiple forms - nested array
                              <div className="space-y-2">
                                {annotation.data.short_answer_list.map((formClaims: any[], formIdx: number) => (
                                  <div key={formIdx} className="bg-white rounded p-2">
                                    <div className="text-xs font-medium text-gray-600 mb-1">Form {formIdx + 1}</div>
                                    {Array.isArray(formClaims) && formClaims.map((claim: any, idx: number) => (
                                      <div key={idx} className="flex justify-between items-center text-xs py-1">
                                        <span className="flex-1">{typeof claim === 'object' ? claim.claim : claim}</span>
                                        {typeof claim === 'object' && claim.weight && (
                                          <Badge variant="outline" className="text-xs">W: {claim.weight}</Badge>
                                        )}
                                      </div>
                                    ))}
                                  </div>
                                ))}
                              </div>
                            ) : (
                              // Single form
                              <div className="space-y-1">
                                {annotation.data.short_answer_list.map((claim: any, idx: number) => (
                                  <div key={idx} className="flex justify-between items-center bg-white p-2 rounded text-xs">
                                    <span className="flex-1">{typeof claim === 'object' ? claim.claim : claim}</span>
                                    {typeof claim === 'object' && claim.weight && (
                                      <Badge variant="outline" className="text-xs">W: {claim.weight}</Badge>
                                    )}
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        )}
                        
                        {/* Other aggregated fields */}
                        {['longAnswer_list', 'rewrite_list', 'doc_download_links'].map(key => {
                          const value = annotation.data[key];
                          if (!value || !Array.isArray(value)) return null;
                          
                          return (
                            <div key={key} className="bg-green-50 rounded-lg p-3">
                              <div className="font-medium text-xs text-gray-800 mb-2">{formatKey(key)}</div>
                              <div className="space-y-1">
                                {value.map((item: any, idx: number) => (
                                  <div key={idx} className="bg-white p-2 rounded text-xs border-l-2 border-l-green-300">
                                    {formatValue(item)}
                                  </div>
                                ))}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ) : (
                    // Regular handling for Tasks 1 & 2
                    <div className="space-y-3">
                      {Object.entries(annotation.data || {})
                        .filter(([key]) => !key.startsWith('_') && !key.endsWith('_text'))
                        .map(([key, value]) => {
                          const textKey = `${key}_text`;
                          const hasTextValue = annotation.data[textKey] !== undefined;
                          
                          return (
                            <div key={key} className="bg-gray-50 rounded-lg p-3">
                              <div className="font-medium text-xs text-gray-600 uppercase tracking-wide mb-1">
                                {formatKey(key)}
                              </div>
                              <div className="text-gray-800 font-medium">{formatValue(value)}</div>
                              
                              {hasTextValue && (
                                <div className="mt-2 bg-white p-2 rounded border text-xs text-gray-600">
                                  <div className="font-medium text-xs text-gray-500 mb-1">Details:</div>
                                  {formatValue(annotation.data[textKey])}
                                </div>
                              )}
                            </div>
                          );
                        })}
                    </div>
                  )}
                </div>
              </CardContent>
              
              <CardFooter className="pt-0 pb-4 mt-auto bg-gray-50">
                <div className="flex justify-between w-full items-center">
                  <div className="text-xs text-gray-500">
                    {Object.keys(annotation.data || {}).filter(k => !k.startsWith('_')).length} fields
                  </div>
                  <Button 
                    variant="default" 
                    size="sm" 
                    className="text-xs hover:bg-blue-600 transition-colors"
                    onClick={() => onUseForConsensus?.(annotation)}
                  >
                    <Check className="h-3 w-3 mr-1" />
                    Use for Consensus
                  </Button>
                </div>
              </CardFooter>
            </Card>
          );
        })}
      </div>
      
      {annotations.length === 0 && (
        <div className="text-center py-12">
          <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <Users className="h-8 w-8 text-gray-400" />
          </div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">No Submissions Yet</h3>
          <p className="text-gray-500 text-sm">
            Annotator submissions will appear here once they start completing their tasks.
          </p>
        </div>
      )}
    </div>
  );
};

export default AnnotatorView;
