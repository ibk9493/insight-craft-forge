import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';

import { Checkbox } from '@/components/ui/checkbox';
import { toast } from '@/components/ui/sonner';
import { Download, RefreshCw, CheckCircle, Info, AlertTriangle, Zap, Settings } from 'lucide-react';
import { api, Discussion, parseTaskStatus } from '@/services/api';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs-wrapper';
// Type definitions for annotations and discussions

interface AnnotationData {
  relevance: boolean;
  relevance_text: string;
  learning: boolean;
  learning_text: string;
  clarity: boolean;
  clarity_text: string;
  aspects: boolean;
  aspects_text: string;
  explanation: boolean;
  explanation_text: string;
  codeDownloadUrl: string;
  codeDownloadUrl_text: string;
  execution: boolean;
  execution_text: string;
  grounded: string;
}

interface Annotation {
  discussion_id: string;
  user_id: string;
  task_id: number;
  data: AnnotationData;
  id: number;
  timestamp: string;
  pod_lead_email: string | null;
}

interface ConsensusData extends AnnotationData {
  stars: number;
  comment: string;
  _last_updated: string;
}

interface Consensus {
  discussion_id: string;
  user_id: string;
  task_id: number;
  data: ConsensusData;
  id: number;
  timestamp: string;
  pod_lead_email: string;
}

interface SupportingDoc {
  link: string;
  paragraph: string;
}

interface ShortAnswer {
  claim: string;
  weight: string | number;
}

interface Form {
  formId: string;
  formName: string;
  formIndex: number;
  supporting_docs: SupportingDoc[];
  supporting_docs_options?: string;
  rewrite: string;
  rewrite_text: string;
  short_answer_list: ShortAnswer[];
  longAnswer: string;
  longAnswer_text: string;
  classify: string;
  classify_text?: string;
  doc_download_link: string;
  doc_download_link_text: string;
  question_image_links: string[];
  question_image_links_option: string;
}

interface Task3AnnotationData {
  forms: Form[];
  classify: string;
  question_image_links: string;
  question_image_links_option: string;
}

interface Task3Annotation {
  discussion_id: string;
  user_id: string;
  task_id: number;
  data: Task3AnnotationData;
  id: number;
  timestamp: string;
  pod_lead_email: string | null;
}

interface Task3ConsensusData {
  forms: Form[];
  stars: number;
  comment: string;
  _created: string;
  _last_updated: string;
}

interface Task3Consensus {
  discussion_id: string;
  user_id: string;
  task_id: number;
  data: Task3ConsensusData;
  id: number;
  timestamp: string;
  pod_lead_email: string;
}

interface TaskStatus {
  status: string;
  annotators: number;
  user_annotated: number | null;
}

interface Tasks {
  task1: TaskStatus;
  task2: TaskStatus;
  task3: TaskStatus;
}

interface Annotations {
  task1_annotations: Annotation[];
  task1_consensus: Consensus;
  task2_annotations: Annotation[];
  task2_consensus: Consensus | null;
  task3_annotations: Task3Annotation[];
  task3_consensus: Task3Consensus;
}

interface DiscussionOriginal {
  id: string;
  title: string;
  url: string;
  repository: string;
  created_at: string;
  repository_language: string;
  release_tag: string;
  release_url: string;
  release_date: string;
  question: string;
  answer: string;
  category: string;
  knowledge: string;
  code: string;
  task1_status: string;
  task1_annotators: number;
  task2_status: string;
  task2_annotators: number;
  task3_status: string;
  task3_annotators: number;
  batch_id: number;
  tasks: Tasks;
  annotations: Annotations;
}
interface ReadyForExport {
  TotalNumberOfDiscussionComplete: number;
  discussions: DiscussionOriginal[];
  totalFetched: number;
}

interface ValidationError {
  discussionId: string;
  task: 'task1' | 'task3';
  field: string;
  error: string;
  value: any;
  pod_lead?:string
}

interface ValidationResult {
  task1ReadyValid: DiscussionOriginal[];
  task1ReadyErrors: DiscussionOriginal[];
  task3ReadyValid: DiscussionOriginal[];
  task3ReadyErrors: DiscussionOriginal[];
  notExportReady: DiscussionOriginal[];
  task1and2AvailableButFailingSomeQualityParameters: DiscussionOriginal[];
  allValidationErrors: ValidationError[];
}

interface ExportOptions {
  includeTask1Valid: boolean;
  includeTask1Errors: boolean;
  includeTask3Valid: boolean;
  includeTask3Errors: boolean;
  includeNotReady: boolean;
}



const ExportManager: React.FC = () => {
  const [discussions, setDiscussions] = useState<DiscussionOriginal[]>([]);
  const [loading, setLoading] = useState(false);
  const [exportData, setExportData] = useState<ReadyForExport>();
  const [validationResult, setValidationResult] = useState<ValidationResult>();
  const [exportOptions, setExportOptions] = useState<ExportOptions>({
    includeTask1Valid: true,
    includeTask1Errors: false,
    includeTask3Valid: true,
    includeTask3Errors: false,
    includeNotReady: false,
  });

  useEffect(() => {
    fetchDiscussions();
  }, []);

  const fetchDiscussions = async () => {
    setLoading(true);
    try {
      const response = await api.discussions.getAll({ page: 1, per_page: 5 });
      setDiscussions(response.items as  DiscussionOriginal[] || []);
    } catch (error) {
      toast.error('Failed to load discussions');
    } finally {
      setLoading(false);
    }
  };
  const transformDiscussionData = (discussion: DiscussionOriginal) => {
    const transformedDiscussions: any[] = [];
  
    const {
      id,
      title,
      url,
      code,
      repository_language,
      release_date,
      question,
      answer,
      category,
      knowledge,
      annotations
    } = discussion;
  
    const {
      task1_annotations = [],
      task1_consensus = null,
      task3_annotations = [],
      task3_consensus = null
    } = annotations;
  
    const forms = task3_consensus?.data?.forms ?? [];
  
    const with_explanation_supporting_docs = forms.some(f => {
      const option = (f.supporting_docs_options ?? "").toLowerCase().trim();
      return ["not findable", "n/a", "not-findable", "notfindable"].includes(option);
    });
  
    const relevance_consensus = task1_consensus.data?.relevance ;
    const learning_consensus = task1_consensus.data?.learning ;
    const clarity_consensus = task1_consensus.data?.clarity;
  
    // Helper to get task 1+2 annotations
    const getAnnotationsTask1And2 = () =>
      task1_annotations.map((ann) => ({
        relevance: ann.data.relevance,
        relevance_text: ann.data.relevance_text,
        learning_value: ann.data.learning,
        learning_text: ann.data.learning_text,
        clarity: ann.data.clarity,
        clarity_text: ann.data.clarity_text,
        grounded: ann.data.grounded !== "N/A" ? ann.data.grounded : undefined,
        ...(relevance_consensus && learning_consensus && clarity_consensus && {
          address_all_aspects: ann.data.aspects ?? false,
          justification_for_addressing_all_aspects: ann.data.aspects_text,
          with_explanation: !with_explanation_supporting_docs ? ann.data.explanation : false,
          with_explanation_text: ann.data.explanation_text,
          code_download_link: ann.data.codeDownloadUrl_text,
          code_executable:true
        })
      }));
  
    const getAgreedAnnotationTask1And2 = () => ({
      relevance: relevance_consensus,
      relevance_text: task1_consensus.data?.relevance_text,
      learning_value: learning_consensus,
      learning_text: task1_consensus.data?.learning_text,
      clarity: clarity_consensus,
      clarity_text: task1_consensus.data?.clarity_text,
      grounded: task1_consensus.data?.grounded !== "N/A" ? task1_consensus.data?.grounded : undefined,
      ...(relevance_consensus && learning_consensus && clarity_consensus && {
        address_all_aspects: task1_consensus.data?.aspects ?? false,
        justification_for_addressing_all_aspects: task1_consensus.data?.aspects_text,
        with_explanation: !with_explanation_supporting_docs
          ? task1_consensus.data?.explanation
          : false,
        with_explanation_text: task1_consensus.data?.explanation_text,
        code_download_link: task1_consensus.data?.codeDownloadUrl_text,
        code_executable:true
      })
    });

    const getAnnotationTask3= () => 
      
       task3_annotations.map((ann) => ({
        short_answer_list: ann.data?.forms?.map(f => f.short_answer_list ?? []) ?? [],
        supporting_docs: ann.data?.forms?.map(f => f.supporting_docs ?? []) ?? [],
        long_answer: ann.data?.forms?.map(f => f.longAnswer_text ?? []) ?? [],
        question_type: ann.data?.forms?.map(f => f.classify ?? []) ?? [],
        rewrite_question: ann.data?.forms?.map(f => f.rewrite_text ?? []) ?? [],
        doc_download_link: ann.data?.forms?.map(f => f.doc_download_link_text ?? []) ?? [],
        question_image_links: ann.data?.forms?.map(f => f.question_image_links ?? []) ?? [],
      }))
    


  
    const baseTransformed = {
      title,
      url,
      lang: repository_language??"",
      code:code??"",
      createdAt: release_date,
      question,
      answer,
      category,
      knowledge,
      annotations_tasks_1_and_2: getAnnotationsTask1And2(),
      agreed_annotation_tasks_1_and_2: getAgreedAnnotationTask1And2(),
      annotations_task_3: getAnnotationTask3(),
    };
    console.log(forms.length>1?forms:"None" )
    // 🟢 Handling multiple forms based on form type
    if (forms.length > 1 && forms.some(f => f.formName?.toLowerCase().endsWith("q"))) {
      forms.forEach((form, index) => {
        transformedDiscussions.push({
          ...baseTransformed,
          id: `${id}_${index + 1}`, // microsoft_pyright_9906_1, microsoft_pyright_9906_2, ...
         agreed_annotation_task_3: {
            short_answer_list: form.short_answer_list ?? [],
            supporting_docs: form.supporting_docs ?? [],
            long_answer: form.longAnswer_text ?? [],
            question_type: form.classify ?? "",
            rewritten_question: form.rewrite_text ?? "",
            doc_download_link: form.doc_download_link_text ?? "",
            question_image_links: form.question_image_links ?? []
          }
        });
      });
    } else {
      const extractField = (forms, key) => {
        const values = forms.map(f => f[key] ?? []);
        return values.length === 1 ? values[0] : values;
      };
      // 🟢 A-Type forms or single form scenario
      transformedDiscussions.push({
        ...baseTransformed,
        id,
        annotations_task_3: canProceedToTask3(discussion) && !with_explanation_supporting_docs ? getAnnotationTask3() : [],
        agreed_annotation_task_3: canProceedToTask3(discussion) && !with_explanation_supporting_docs ? {
        short_answer_list:    extractField(forms, 'short_answer_list'),
          supporting_docs: extractField(forms, 'supporting_docs'),
          long_answer: extractField(forms, 'longAnswer_text'),
          question_type:  forms.map(f => f.classify ?? [])[0],
          rewritten_question: forms.map(f => f.rewrite_text ?? [])[0],
          doc_download_link: forms.map(f => f.doc_download_link_text ?? [])[0],
          question_image_links: forms.map(f => f.question_image_links ?? [])[0]
        } : {}
      });
    }
  
    return transformedDiscussions;
  };
  
  
  const hasValidationError = (item: DiscussionOriginal): ValidationError[] => {
    const errors: ValidationError[] = [];
    
    // Task 1 Validation
    if (item.annotations.task1_consensus) {
      const task1Data = item.annotations.task1_consensus.data;
      
      // Boolean field validations
    //   const task1BooleanFields = ['relevance', 'learning', 'clarity', 'aspects', 'explanation', 'execution'];
    //   task1BooleanFields.forEach(field => {
    //     if (typeof task1Data[field] !== 'boolean') {
    //       errors.push({
    //         discussionId: item.id,
    //         task: 'task1',
    //         field,
    //         error: 'Field must be a boolean value',
    //         value: task1Data[field]
    //       });
    //     }
    //   });
      
    //   // Text field validations
    //   const task1TextFields = ['relevance_text', 'learning_text', 'clarity_text', 'aspects_text', 'explanation_text'];
    //   task1TextFields.forEach(field => {
    //     if (!task1Data[field] || typeof task1Data[field] !== 'string' || task1Data[field].trim().length === 0) {
    //       errors.push({
    //         discussionId: item.id,
    //         task: 'task1',
    //         field,
    //         error: 'Text field is required and cannot be empty',
    //         value: task1Data[field]
    //       });
    //     }
        
    //     if (task1Data[field] && task1Data[field].length < 10) {
    //       errors.push({
    //         discussionId: item.id,
    //         task: 'task1',
    //         field,
    //         error: 'Text field must be at least 10 characters long',
    //         value: task1Data[field]
    //       });
    //     }
    //   });
      
      // Stars validation
    //   if (typeof task1Data.stars !== 'number' || task1Data.stars < 1 || task1Data.stars > 5) {
    //     errors.push({
    //       discussionId: item.id,
    //       task: 'task1',
    //       field: 'stars',
    //       error: 'Stars must be a number between 1 and 5',
    //       value: task1Data.stars
    //     });
    //   }
      
      // Code download URL validation
      const urlPattern = /^https:\/\/[a-zA-Z0-9.-]+(?:\/[a-zA-Z0-9._@-]+)+\.(zip|tar\.gz)$/;


      if (!urlPattern.test(task1Data.codeDownloadUrl_text)) {
        errors.push({
          discussionId: item.id,
          task: 'task1',
          field: 'codeDownloadUrl',
          error: 'Must be a valid URL ending with .zip or .tar',
          pod_lead: item.annotations.task1_consensus.pod_lead_email,
          value: task1Data.codeDownloadUrl_text
        });
      }
      
          
      // Comment validation
    //   if (!task1Data.comment || typeof task1Data.comment !== 'string' || task1Data.comment.trim().length === 0) {
    //     errors.push({
    //       discussionId: item.id,
    //       task: 'task1',
    //       field: 'comment',
    //       error: 'Comment field is required and cannot be empty',
    //       value: task1Data.comment
    //     });
    //   }
    }
    
    if (item.annotations.task3_consensus) {
      const task3Data = item.annotations.task3_consensus.data;
    
      // Regex to find GitHub-hosted image links in the original question
      const imageLinkPattern = /!\[image\]\((https:\/\/github\.com\/user-attachments\/assets\/[a-zA-Z0-9-]+)\)/g;
      const originalQuestionText = item.question || '';
      const urlPattern = /^https:\/\/[a-zA-Z0-9.-]+(?:\/[a-zA-Z0-9._@-]+)+\.(zip|tar\.gz)$/;
      // Extract all image URLs from the original question text
      const originalImageLinks = [];
      let match;
      while ((match = imageLinkPattern.exec(originalQuestionText)) !== null) {
        originalImageLinks.push(match[1]); // only the URL part
      }
    
      if (Array.isArray(task3Data.forms)) {
        task3Data.forms.forEach((form,formIndex) => {
          const declaredLinks = form.question_image_links || [];
          const imageLinksOption = form.question_image_links_option;
          const docsOption = form.supporting_docs_options;
          const docsArray = form.supporting_docs || [];
          if (docsOption === "Not Findable") return;
          
          const hasImageInQuestion = originalImageLinks.length > 0;
          const declaredLinksPresent = declaredLinks.length > 0;
          if (form.doc_download_link !== "Not Needed" && form.doc_download_link !== "Needed") {
            if (form.doc_download_link_text && 
                form.doc_download_link_text !== "Not Needed" &&
                !urlPattern.test(form.doc_download_link_text)) {
              errors.push({
                discussionId: item.id,
                task: 'task3',
                field: 'documentDownloadLink',
                error: 'Document download link must be a valid URL ending with .zip or .tar.gz',
                value: form.doc_download_link_text,
                pod_lead: item.annotations.task3_consensus.pod_lead_email,
              });
            }
          }

          // ✅ Image(s) present in original question, but annotation says "Not Needed"
          if (hasImageInQuestion && imageLinksOption === "Not Needed") {
            errors.push({
              discussionId: item.id,
              task: 'task3',
              field: 'questionImageLinks',
              error: 'Images found in original question but question_image_links_option is "Not Needed"',
              value: { originalImageLinks, imageLinksOption },
              pod_lead: item.annotations.task3_consensus.pod_lead_email,
            });
          }
    
          // ✅ Annotation says "Needed", but no actual links declared
          if (imageLinksOption === "Needed" && !declaredLinksPresent) {
            errors.push({
              discussionId: item.id,
              task: 'task3',
              field: 'questionImageLinks',
              error: 'question_image_links_option is "Needed" but question_image_links is empty',
              value: { imageLinksOption, declaredLinks },
              pod_lead: item.annotations.task3_consensus.pod_lead_email,
            });
          }
    
          // ✅ Image(s) found but not fully reflected in declared links
          const missingLinks = originalImageLinks.filter(link => !declaredLinks.includes(link));
          if (imageLinksOption === "Needed" && missingLinks.length > 0) {
            errors.push({
              discussionId: item.id,
              task: 'task3',
              field: 'questionImageLinks',
              error: 'Some image links found in original question are missing from question_image_links',
              value: { missingLinks, declaredLinks, originalImageLinks },
              pod_lead: item.annotations.task3_consensus.pod_lead_email,
            });
          }
              if (docsOption?.toLowerCase().trim() === "provided") {
                // Case 1: No supporting docs present despite saying "Provided"
                if (docsArray.length === 0) {
                  errors.push({
                    discussionId: item.id,
                    task: 'task3',
                    field: 'supporting_docs',
                    error: 'supporting_docs_options is "Provided" but no supporting_docs are present',
                    value: { supporting_docs_options: docsOption, supporting_docs: docsArray },
                    pod_lead: item.annotations.task3_consensus.pod_lead_email,
                  });
                }else{
              
              docsArray.forEach((doc, index) => {
                const link = doc.link;
                if (!link || !link.startsWith("downloads/")) {
                  errors.push({
                    discussionId: item.id,
                    task: 'task3',
                    field: `supporting_docs[${index}].link`,
                    error: 'Each supporting_docs link must start with "downloads/"',
                    value: link,
                    pod_lead: item.annotations.task3_consensus.pod_lead_email,
                  });
                }
              });
              }
            }
            const shortAnswers = form.short_answer_list || [];

            // Count how many items have weight === 3
            const weight3Count = shortAnswers.filter(ans => ans.weight === 3 || ans.weight === "3").length;

          if (weight3Count < 1) {
            errors.push({
              discussionId: item.id,
              task: 'task3',
              field: `short_answer_list (form index ${formIndex})`,
              error: 'Each form must have at least one short_answer_list item with weight 3',
              value: shortAnswers.map(ans => String(ans.weight)),
              pod_lead: item.annotations.task3_consensus.pod_lead_email,
            });
          }


          const consensusShortAnswers = task3Data.forms?.map(f => f.short_answer_list || []) || [];
          const consensusLongAnswers = task3Data.forms?.map(f => f.longAnswer_text || []) || [];
      
          // Check if we have multiple forms (list of lists scenario)
          if (consensusShortAnswers.length > 1) {
            // Multiple forms case: each form should have matching lengths
            consensusShortAnswers.forEach((shortAnswerList, formIndex) => {
              const correspondingLongAnswer = consensusLongAnswers[formIndex];
              
              if (Array.isArray(shortAnswerList) && Array.isArray(correspondingLongAnswer)) {
                if (shortAnswerList.length !== correspondingLongAnswer.length) {
                  errors.push({
                    discussionId: item.id,
                    task: 'task3',
                    field: `short_answer_list_length_mismatch_form_${formIndex}`,
                    error: `Form ${formIndex}: short_answer_list length (${shortAnswerList.length}) does not match long_answer length (${correspondingLongAnswer.length})`,
                    value: { 
                      shortAnswerLength: shortAnswerList.length, 
                      longAnswerLength: correspondingLongAnswer.length,
                      formIndex 
                    },
                    pod_lead: item.annotations.task3_consensus.pod_lead_email,
                  });
                }
              }
            });
          } else if (consensusShortAnswers.length === 1) {
            // Single form case: check if the single form's short_answer_list matches long_answer
            const singleShortAnswerList = consensusShortAnswers[0];
            const singleLongAnswer = consensusLongAnswers[0];
            
            if (Array.isArray(singleShortAnswerList) && Array.isArray(singleLongAnswer)) {
              if (singleShortAnswerList.length !== singleLongAnswer.length) {
                errors.push({
                  discussionId: item.id,
                  task: 'task3',
                  field: 'short_answer_list_length_mismatch',
                  error: `short_answer_list length (${singleShortAnswerList.length}) does not match long_answer length (${singleLongAnswer.length})`,
                  value: { 
                    shortAnswerLength: singleShortAnswerList.length, 
                    longAnswerLength: singleLongAnswer.length 
                  },
                  pod_lead: item.annotations.task3_consensus.pod_lead_email,
                });
              }
            }
          }
      
        });
      }

        

      }
// ... existing code ...
    
    return errors;
  };

  const canProceedToTask3 = (item: DiscussionOriginal) => {
    if (!item.annotations.task1_consensus?.data) return false;
    
    const consensusData = item.annotations.task1_consensus.data;
    console.log(consensusData)
    const booleanFlags = Object.entries(consensusData)
      .filter(([key, value]) => typeof value === 'boolean' && key !== 'grounded' && key !== 'execution' )
      .map(([_, value]) => value);
    
    return booleanFlags.length > 0 && booleanFlags.every(flag => flag === true);
  };

  const isTask1Ready = (item: DiscussionOriginal) => {
    return item.annotations.task1_annotations.length >= 3 && 
           item.annotations.task1_consensus !== null;
  };

const isTask3Ready = (item: DiscussionOriginal) => {
    return isTask1Ready(item) && 
           canProceedToTask3(item) && 
           item.annotations.task3_annotations.length >= 5 && 
           item.annotations.task3_consensus !== null;
  };

  const isTask3ReadyDummy = (item: DiscussionOriginal) => {
    return isTask1Ready(item) && 
           
           item.annotations.task3_annotations.length >= 5 && 
           item.annotations.task3_consensus !== null;
  };


  const isExportReady = (item: DiscussionOriginal) => {
    return isTask3Ready(item) || (isTask1Ready(item) && !canProceedToTask3(item));
  };




  // Data transformation function


  const runFullValidation = () => {
    if (!exportData?.discussions) {
      toast.error('No discussions to validate. Run analysis first.');
      return;
    }
  
    const task1ReadyValid: DiscussionOriginal[] = [];
    const task1ReadyErrors: DiscussionOriginal[] = [];
    const task3ReadyValid: DiscussionOriginal[] = [];
    const task3ReadyErrors: DiscussionOriginal[] = [];
    const notExportReady: DiscussionOriginal[] = [];
    const allValidationErrors: ValidationError[] = [];
    const task1and2AvailableButFailingSomeQualityParameters: DiscussionOriginal[] = [];
    exportData.discussions.forEach(discussion => {
      const errors = hasValidationError(discussion);
      allValidationErrors.push(...errors);
  
      const task1Ready = isTask1Ready(discussion);
      const task3Ready = isTask3Ready(discussion); // This now includes all Task 1 + Task 3 requirements
      const canProceed = canProceedToTask3(discussion);
      if(task1Ready && isTask3ReadyDummy(discussion) && !canProceed ){
        console.log("Failed due to validation task id",discussion.id)
        task1and2AvailableButFailingSomeQualityParameters.push(discussion)
      }
      if (!task1Ready) {
        // Not even Task 1 ready
        notExportReady.push(discussion);
      } else if (!canProceed) {
        // Task 1 ready but can't proceed to Task 3 (has false values)
        const task1Errors = errors.filter(e => e.task === 'task1');
        if (task1Errors.length === 0) {
          task1ReadyValid.push(discussion);
        } else {
          task1ReadyErrors.push(discussion);
        }
      } else if (task3Ready) {
        // Task 3 ready (includes Task 1 ready + can proceed + Task 3 complete)
        const task3Errors = errors.filter(e => e.task === 'task3');
        if (task3Errors.length === 0) {
          task3ReadyValid.push(discussion);
        } else {
          task3ReadyErrors.push(discussion);
        }
      } else {
        // Can proceed to Task 3 but Task 3 not complete yet
        notExportReady.push(discussion);
      }
    });
  
    setValidationResult({
      task1ReadyValid,
      task1ReadyErrors,
      task3ReadyValid,
      task3ReadyErrors,
      task1and2AvailableButFailingSomeQualityParameters,
      notExportReady,
      allValidationErrors
    });
  
    toast.success(
      `Validation complete! ${task1ReadyValid.length} Task1-only valid, ${task3ReadyValid.length} Task3 valid, ${task1ReadyErrors.length + task3ReadyErrors.length} with errors, ${notExportReady.length} not ready.`
    );
  };

  const transformDiscussion = async () => {
    setLoading(true);
    try {
      let allItems: DiscussionOriginal[] = [];
      let currentPage = 1;
      const maxItems = 500;

      while (allItems.length < maxItems) {
        const response = await api.discussions.getAll({ 
          page: currentPage, 
          per_page: 100
        });

        allItems = [...allItems, ...response.items as  DiscussionOriginal[]];
        
        if (currentPage >= response.pages || allItems.length >= maxItems) break;
        currentPage++;
      }

      allItems = allItems.slice(0, maxItems);
      const completeDiscussions = allItems.filter(isExportReady);

      setExportData({
        TotalNumberOfDiscussionComplete: completeDiscussions.length,
        discussions: allItems,
        totalFetched: allItems.length
      });

      toast.success(`Found ${completeDiscussions.length} discussions ready for export out of ${allItems.length} total.`);
    } catch (error) {
      toast.error('Failed to analyze discussions');
    } finally {
      setLoading(false);
    }
  };

  const downloadData = (data: any[], filename: string) => {
    const jsonString = JSON.stringify(data, null, 2);
    const blob = new Blob([jsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleExport = () => {
    if (!validationResult) {
      toast.error('Run validation first');
      return;
    }

    const discussionsToExport: DiscussionOriginal[] = [];
    
    if (exportOptions.includeTask1Valid) discussionsToExport.push(...validationResult.task1ReadyValid);
    if (exportOptions.includeTask1Errors) discussionsToExport.push(...validationResult.task1ReadyErrors);
    if (exportOptions.includeTask3Valid) discussionsToExport.push(...validationResult.task3ReadyValid);
    if (exportOptions.includeTask3Errors) discussionsToExport.push(...validationResult.task3ReadyErrors);
    if (exportOptions.includeNotReady) discussionsToExport.push(...validationResult.notExportReady);

    if (discussionsToExport.length === 0) {
      toast.error('No discussions selected for export');
      return;
    }

    // Transform data before export
    const transformedData = discussionsToExport.flatMap(discussion => 
      
      transformDiscussionData(discussion)
    );

    const timestamp = new Date().toISOString().split('T')[0];
    console.log(transformedData);
    
    downloadData(transformedData, `discussions_export_${timestamp}.json`);
    
    toast.success(`Exported ${discussionsToExport.length} discussions`);
  };

  const handleExportRaw = () => {
    if (!validationResult) {
      toast.error('Run validation first');
      return;
    }

    const discussionsToExport: DiscussionOriginal[] = [];
    
    if (exportOptions.includeTask1Valid) discussionsToExport.push(...validationResult.task1ReadyValid);
    if (exportOptions.includeTask1Errors) discussionsToExport.push(...validationResult.task1ReadyErrors);
    if (exportOptions.includeTask3Valid) discussionsToExport.push(...validationResult.task3ReadyValid);
    if (exportOptions.includeTask3Errors) discussionsToExport.push(...validationResult.task3ReadyErrors);
    if (exportOptions.includeNotReady) discussionsToExport.push(...validationResult.notExportReady);

    if (discussionsToExport.length === 0) {
      toast.error('No discussions selected for export');
      return;
    }

    const timestamp = new Date().toISOString().split('T')[0];
    downloadData(discussionsToExport, `discussions_raw_${timestamp}.json`);
    
    toast.success(`Exported ${discussionsToExport.length} raw discussions`);
  };

  const getDiscussionErrorCount = (discussionId: string) => {
    return validationResult?.allValidationErrors.filter(error => error.discussionId === discussionId).length || 0;
  };

  const getTotalSelectedCount = () => {
    if (!validationResult) return 0;
    let count = 0;
    if (exportOptions.includeTask1Valid) count += validationResult.task1ReadyValid.length;
    if (exportOptions.includeTask1Errors) count += validationResult.task1ReadyErrors.length;
    if (exportOptions.includeTask3Valid) count += validationResult.task3ReadyValid.length;
    if (exportOptions.includeTask3Errors) count += validationResult.task3ReadyErrors.length;
    if (exportOptions.includeNotReady) count += validationResult.notExportReady.length;
    return count;
  };

  return (
    <Card className="w-full shadow-md">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Download className="h-5 w-5" />
          Export Manager
        </CardTitle>
        <CardDescription>
          Manage and export discussion data with validation and transformation
        </CardDescription>
      </CardHeader>
      
      <CardContent className="space-y-6">
        {/* Action Buttons */}
        <div className="flex gap-3">
          <Button onClick={fetchDiscussions} disabled={loading} variant="outline">
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh Preview
          </Button>
          <Button onClick={transformDiscussion} disabled={loading}>
            <Zap className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Analyze All Discussions
          </Button>
          {exportData && (
            <Button onClick={runFullValidation} disabled={loading} variant="secondary">
              <CheckCircle className="h-4 w-4 mr-2" />
              Run Validation
            </Button>
          )}
        </div>

        {/* Export Summary */}
        {exportData && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <h3 className="font-semibold text-blue-800 mb-3">Analysis Results</h3>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-gray-600">Total Analyzed:</span>
                <span className="ml-2 font-medium">{exportData.totalFetched}</span>
              </div>
              <div>
                <span className="text-gray-600">Export Ready:</span>
                <span className="ml-2 font-medium text-blue-600">{exportData.TotalNumberOfDiscussionComplete}</span>
              </div>
            </div>
          </div>
        )}

        {/* Validation Results */}
        {validationResult && (
          <div className="bg-green-50 border border-green-200 rounded-lg p-4">
            <h3 className="font-semibold text-green-800 mb-3">Validation Results</h3>
            <div className="grid grid-cols-2 gap-4 text-sm mb-3">
              <div>
                <span className="text-gray-600">Task 1 Only (Valid):</span>
                <span className="ml-2 font-medium text-green-600">{validationResult.task1ReadyValid.length}</span>
              </div>
              <div>
                <span className="text-gray-600">Task 1 Only (Errors):</span>
                <span className="ml-2 font-medium text-orange-600">{validationResult.task1ReadyErrors.length}</span>
              </div>
              <div>
                <span className="text-gray-600">Task 3 Complete (Valid):</span>
                <span className="ml-2 font-medium text-green-600">{validationResult.task3ReadyValid.length}</span>
              </div>
              <div>
                <span className="text-gray-600">Task 3 Complete (Errors):</span>
                <span className="ml-2 font-medium text-orange-600">{validationResult.task3ReadyErrors.length}</span>
              </div>
              <div>
                <span className="text-gray-600">task 1 and 3 Available But Failing Some Quality Parameters:</span>
                <span className="ml-2 font-medium text-orange-600">{validationResult.task1and2AvailableButFailingSomeQualityParameters.length}</span>
              </div>
            </div>
          </div>
        )}

        {/* Export Options */}
        {validationResult && (
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
            <h3 className="font-semibold text-gray-800 mb-3 flex items-center gap-2">
              <Settings className="h-4 w-4" />
              Export Options
            </h3>
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div className="space-y-2">
                <div className="flex items-center space-x-2">
                  <Checkbox 
                    id="task1-valid"
                    checked={exportOptions.includeTask1Valid}
                    onCheckedChange={(checked) => 
                      setExportOptions(prev => ({ ...prev, includeTask1Valid: checked as boolean }))
                    }
                  />
                  <label htmlFor="task1-valid" className="text-sm">
                    Task 1 Only - Valid ({validationResult.task1ReadyValid.length})
                  </label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox 
                    id="task1-errors"
                    checked={exportOptions.includeTask1Errors}
                    onCheckedChange={(checked) => 
                      setExportOptions(prev => ({ ...prev, includeTask1Errors: checked as boolean }))
                    }
                  />
                  <label htmlFor="task1-errors" className="text-sm">
                    Task 1 Only - With Errors ({validationResult.task1ReadyErrors.length})
                  </label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox 
                    id="task3-valid"
                    checked={exportOptions.includeTask3Valid}
                    onCheckedChange={(checked) => 
                      setExportOptions(prev => ({ ...prev, includeTask3Valid: checked as boolean }))
                    }
                  />
                  <label htmlFor="task3-valid" className="text-sm">
                    Task 3 Complete - Valid ({validationResult.task3ReadyValid.length})
                  </label>
                </div>
              </div>
              <div className="space-y-2">
                <div className="flex items-center space-x-2">
                  <Checkbox 
                    id="task3-errors"
                    checked={exportOptions.includeTask3Errors}
                    onCheckedChange={(checked) => 
                      setExportOptions(prev => ({ ...prev, includeTask3Errors: checked as boolean }))
                    }
                  />
                  <label htmlFor="task3-errors" className="text-sm">
                    Task 3 Complete - With Errors ({validationResult.task3ReadyErrors.length})
                  </label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox 
                    id="not-ready"
                    checked={exportOptions.includeNotReady}
                    onCheckedChange={(checked) => 
                      setExportOptions(prev => ({ ...prev, includeNotReady: checked as boolean }))
                    }
                  />
                  <label htmlFor="not-ready" className="text-sm">
                    Not Ready for Export ({validationResult.notExportReady.length})
                  </label>
                </div>
              </div>
            </div>
            
            <div className="flex gap-3">
              <Button 
                onClick={handleExport} 
                disabled={getTotalSelectedCount() === 0}
                className="flex-1"
              >
                <Download className="h-4 w-4 mr-2" />
                Export Transformed ({getTotalSelectedCount()})
              </Button>
              <Button 
                onClick={handleExportRaw} 
                disabled={getTotalSelectedCount() === 0}
                variant="outline"
                className="flex-1"
              >
                <Download className="h-4 w-4 mr-2" />
                Export Raw ({getTotalSelectedCount()})
              </Button>
            </div>
          </div>
        )}

        {/* Tabs for different views */}
        {validationResult && (
          <Tabs defaultValue="task1-valid" className="w-full">
            <TabsList className="grid w-full grid-cols-5">
              <TabsTrigger value="task1-valid">
                Task 1 Valid ({validationResult.task1ReadyValid.length})
              </TabsTrigger>
              <TabsTrigger value="task1-errors">
                Task 1 Errors ({validationResult.task1ReadyErrors.length})
              </TabsTrigger>
              <TabsTrigger value="task3-valid">
                Task 3 Valid ({validationResult.task3ReadyValid.length})
              </TabsTrigger>
              <TabsTrigger value="task3-errors">
                Task 3 Errors ({validationResult.task3ReadyErrors.length})
              </TabsTrigger>
              <TabsTrigger value="not-ready">
                Not Ready ({validationResult.notExportReady.length})
              </TabsTrigger>
            </TabsList>

            <TabsContent value="task1-valid" className="mt-4">
              <div className="space-y-3 max-h-96 overflow-y-auto">
                {validationResult.task1ReadyValid.map((discussion) => (
                  <div key={discussion.id} className="p-4 border border-green-300 bg-green-50 rounded-lg">
                    <div className="flex items-center gap-2 mb-1">
                      <div className="font-medium">{discussion.title}</div>
                      <Badge className="bg-green-100 text-green-800">
                        <CheckCircle className="h-3 w-3 mr-1" />
                        Task 1 Only - Valid
                      </Badge>
                    </div>
                    <div className="text-sm text-gray-500">{discussion.repository}</div>
                    <div className="text-xs text-green-600 mt-1">ID: {discussion.id}</div>
                  </div>
                ))}
              </div>
            </TabsContent>

            <TabsContent value="task1-errors" className="mt-4">
              <div className="space-y-3 max-h-96 overflow-y-auto">
                {validationResult.task1ReadyErrors.map((discussion) => (
                  <div key={discussion.id} className="p-4 border border-orange-300 bg-orange-50 rounded-lg">
                    <div className="flex items-center gap-2 mb-1">
                      <div className="font-medium">{discussion.title}</div>
                      <Badge className="bg-orange-100 text-orange-800">
                        <AlertTriangle className="h-3 w-3 mr-1" />
                        Task 1 - {getDiscussionErrorCount(discussion.id)} Errors
                      </Badge>
                    </div>
                    <div className="text-sm text-gray-500">{discussion.repository}</div>
                    <div className="text-xs text-orange-600 mt-1">ID: {discussion.id}</div>
                  </div>
                ))}
              </div>
            </TabsContent>

            <TabsContent value="task3-valid" className="mt-4">
              <div className="space-y-3 max-h-96 overflow-y-auto">
                {validationResult.task3ReadyValid.map((discussion) => (
                  <div key={discussion.id} className="p-4 border border-blue-300 bg-blue-50 rounded-lg">
                    <div className="flex items-center gap-2 mb-1">
                      <div className="font-medium">{discussion.title}</div>
                      <Badge className="bg-blue-100 text-blue-800">
                        <CheckCircle className="h-3 w-3 mr-1" />
                        Task 3 Complete - Valid
                      </Badge>
                    </div>
                    <div className="text-sm text-gray-500">{discussion.repository}</div>
                    <div className="text-xs text-blue-600 mt-1">ID: {discussion.id}</div>
                  </div>
                ))}
              </div>
            </TabsContent>

            <TabsContent value="task3-errors" className="mt-4">
              <div className="space-y-3 max-h-96 overflow-y-auto">
                {validationResult.task3ReadyErrors.map((discussion) => (
                  <div key={discussion.id} className="p-4 border border-red-300 bg-red-50 rounded-lg">
                    <div className="flex items-center gap-2 mb-1">
                      <div className="font-medium">{discussion.title}</div>
                      <Badge className="bg-red-100 text-red-800">
                        <AlertTriangle className="h-3 w-3 mr-1" />
                        Task 3 - {getDiscussionErrorCount(discussion.id)} Errors
                      </Badge>
                    </div>
                    <div className="text-sm text-gray-500">{discussion.repository}</div>
                    <div className="text-xs text-red-600 mt-1">ID: {discussion.id}</div>
                  </div>
                ))}
              </div>
            </TabsContent>

            <TabsContent value="not-ready" className="mt-4">
              <div className="space-y-3 max-h-96 overflow-y-auto">
                {validationResult.notExportReady.map((discussion) => (
                  <div key={discussion.id} className="p-4 border border-gray-300 bg-gray-50 rounded-lg">
                    <div className="flex items-center gap-2 mb-1">
                      <div className="font-medium">{discussion.title}</div>
                      <Badge variant="outline">Not Ready</Badge>
                    </div>
                    <div className="text-sm text-gray-500">{discussion.repository}</div>
                    <div className="text-xs text-gray-600 mt-1">ID: {discussion.id}</div>
                    <div className="text-xs text-gray-500 mt-1">
                      Task 1: {isTask1Ready(discussion) ? '✓' : '✗'} | 
                      Task 3: {isTask3Ready(discussion) ? '✓' : '✗'} | 
                      Can proceed to Task 3: {canProceedToTask3(discussion) ? '✓' : '✗'}
                    </div>
                  </div>
                ))}
              </div>
            </TabsContent>
          </Tabs>
        )}

        {/* Validation Errors Tab */}
        {validationResult && validationResult.allValidationErrors.length > 0 && (
          <div className="mt-6">
            <h3 className="text-lg font-medium mb-3 text-red-600">
              All Validation Errors ({validationResult.allValidationErrors.length})
            </h3>
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {validationResult.allValidationErrors.map((error, index) => (
                <div key={index} className="bg-red-50 border border-red-200 rounded-lg p-3">
                  <div className="font-medium text-red-800">
                    {error.discussionId} - {error.task.toUpperCase()}
                  </div>
                  <div className="text-sm text-red-600">
                    <strong>{error.field}:</strong> {error.error}
                  </div>
                  <div className="text-xs text-gray-600 mt-1">
                    Current value: {JSON.stringify(error.value)}
                  </div>
                  <div className="text-xs text-gray-600 mt-1">
                    Podlead: {JSON.stringify(error.pod_lead)}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Data Transformation Preview */}
        {validationResult && (
          <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
            <h3 className="font-semibold text-purple-800 mb-3 flex items-center gap-2">
              <Info className="h-4 w-4" />
              Data Transformation Preview
            </h3>
            <div className="text-sm text-gray-600 mb-2">
              Sample transformation of the first valid discussion:
            </div>
            {(validationResult.task1ReadyValid.length > 0 || validationResult.task3ReadyValid.length > 0) && (
              <div className="bg-white border rounded p-3 max-h-32 overflow-y-auto">
                <pre className="text-xs">
                  {JSON.stringify(
                    transformDiscussionData(
                      validationResult.task1ReadyValid[0] || validationResult.task3ReadyValid[0]
                    ), 
                    null, 
                    2
                  ).split('\n').slice(0, 15).join('\n')}
                  {JSON.stringify(
                    transformDiscussionData(
                      validationResult.task1ReadyValid[0] || validationResult.task3ReadyValid[0]
                    ), 
                    null, 
                    2
                  ).split('\n').length > 15 && '\n...'}
                </pre>
              </div>
            )}
            <div className="text-xs text-purple-600 mt-2">
              Transformed data includes: renamed keys, metadata, export timestamps, and discussion readiness flags.
            </div>
          </div>
        )}

        {/* Recent Discussions Preview */}
        {!validationResult && (
          <div className="space-y-3">
            <h3 className="text-lg font-medium">Recent Discussions Preview</h3>
            
            {loading ? (
              <div className="text-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-2"></div>
                <div className="text-gray-500">Loading...</div>
              </div>
            ) : discussions.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                No discussions loaded. Click "Refresh Preview" to get started.
              </div>
            ) : (
              <div className="space-y-3 max-h-96 overflow-y-auto">
                {discussions.map((discussion) => (
                  <div key={discussion.id} className="p-4 border border-gray-200 rounded-lg">
                    <div className="font-medium mb-1">{discussion.title}</div>
                    <div className="text-sm text-gray-500">{discussion.repository}</div>
                    <div className="flex flex-wrap gap-2 mt-2">
                      <Badge variant={parseTaskStatus(discussion.tasks.task1.status).status === 'Complete' ? 'default' : 'outline'}>
                        Task 1: {parseTaskStatus(discussion.tasks.task1.status).status}
                      </Badge>
                      <Badge variant={parseTaskStatus(discussion.tasks.task2.status).status === 'Complete' ? 'default' : 'outline'}>
                        Task 2: {parseTaskStatus(discussion.tasks.task2.status).status}
                      </Badge>
                      <Badge variant={parseTaskStatus(discussion.tasks.task3.status).status === 'Complete' ? 'default' : 'outline'}>
                        Task 3: {parseTaskStatus(discussion.tasks.task3.status).status}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default ExportManager;