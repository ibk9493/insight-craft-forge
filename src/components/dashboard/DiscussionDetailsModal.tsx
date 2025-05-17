
import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { FileText, Code, Calendar, Tag, ExternalLink } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Discussion } from '@/services/api';

interface DiscussionDetailsModalProps {
  discussion: Discussion | null | undefined;
  trigger?: React.ReactNode;
}

const DiscussionDetailsModal: React.FC<DiscussionDetailsModalProps> = ({ 
  discussion,
  trigger
}) => {
  if (!discussion) return null;
  
  // Extract question and answer from title field if it contains JSON
  let questionData = null;
  let answerData = null;
  
  try {
    // Check if title might contain JSON data (from the JSON uploads)
    if (discussion.title && (discussion.title.includes('"question"') || discussion.title.includes('"answer"'))) {
      const parsedData = JSON.parse(discussion.title);
      questionData = parsedData.question || null;
      answerData = parsedData.answer || null;
    }
  } catch (e) {
    // If parsing fails, we'll use the regular title
    console.log("Not JSON data in title field");
  }

  return (
    <Dialog>
      <DialogTrigger asChild>
        {trigger || (
          <Button variant="outline" className="flex items-center gap-2">
            <FileText className="h-4 w-4" />
            <span>View Original Discussion</span>
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-4xl max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="text-xl">Original GitHub Discussion</DialogTitle>
        </DialogHeader>
        
        <div className="flex flex-wrap gap-2 mb-3">
          {discussion.repositoryLanguage && (
            <div className="flex items-center text-xs bg-blue-50 text-blue-700 px-2 py-1 rounded-md">
              <Code className="w-3 h-3 mr-1" />
              <span>Language: {discussion.repositoryLanguage}</span>
            </div>
          )}
          
          {discussion.releaseTag && (
            <div className="flex items-center text-xs bg-purple-50 text-purple-700 px-2 py-1 rounded-md">
              <Tag className="w-3 h-3 mr-1" />
              <span>Release: {discussion.releaseTag}</span>
            </div>
          )}
          
          {discussion.createdAt && (
            <div className="flex items-center text-xs bg-green-50 text-green-700 px-2 py-1 rounded-md">
              <Calendar className="w-3 h-3 mr-1" />
              <span>Posted: {new Date(discussion.createdAt).toLocaleDateString()}</span>
            </div>
          )}
        </div>
        
        {discussion.url && (
          <div className="mb-3">
            <a 
              href={discussion.url} 
              target="_blank" 
              rel="noopener noreferrer"
              className="text-blue-600 hover:underline flex items-center gap-1 text-sm"
            >
              <ExternalLink className="h-4 w-4" />
              Open in GitHub
            </a>
          </div>
        )}
        
        <ScrollArea className="flex-grow">
          <div className="space-y-4 p-1">
            <div>
              <h3 className="text-lg font-medium mb-2">Title</h3>
              <div className="bg-gray-50 p-3 rounded-md">
                {/* Display the actual GitHub title if we have extracted JSON data */}
                {questionData ? discussion.title.substring(0, 50) + "..." : discussion.title}
              </div>
            </div>
            
            {questionData && (
              <div>
                <h3 className="text-lg font-medium mb-2">Question</h3>
                <div className="bg-gray-50 p-3 rounded-md max-h-[30vh]">
                  <ScrollArea className="h-full max-h-[30vh]">
                    <pre className="whitespace-pre-wrap text-sm">{questionData}</pre>
                  </ScrollArea>
                </div>
              </div>
            )}
            
            {answerData && (
              <div>
                <h3 className="text-lg font-medium mb-2">Answer</h3>
                <div className="bg-gray-50 p-3 rounded-md max-h-[30vh]">
                  <ScrollArea className="h-full max-h-[30vh]">
                    <pre className="whitespace-pre-wrap text-sm">{answerData}</pre>
                  </ScrollArea>
                </div>
              </div>
            )}
            
            {/* Show raw discussion data if available */}
            <div>
              <h3 className="text-lg font-medium mb-2">Raw Data</h3>
              <div className="bg-gray-50 p-3 rounded-md max-h-[30vh]">
                <ScrollArea className="h-full max-h-[30vh]">
                  <pre className="whitespace-pre-wrap text-xs">
                    {JSON.stringify(discussion, null, 2)}
                  </pre>
                </ScrollArea>
              </div>
            </div>
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
};

export default DiscussionDetailsModal;
