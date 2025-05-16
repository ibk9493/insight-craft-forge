
import React, { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';
import { api, GitHubDiscussion } from '@/services/api';
import { Upload, X, Check } from 'lucide-react';
import { Progress } from '@/components/ui/progress';

const JsonUploader: React.FC = () => {
  const [file, setFile] = useState<File | null>(null);
  const [parsedData, setParsedData] = useState<GitHubDiscussion[] | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0];
    
    if (!selectedFile) {
      return;
    }
    
    if (selectedFile.type !== 'application/json') {
      toast.error('Please select a valid JSON file');
      return;
    }
    
    setFile(selectedFile);
    
    // Read and parse the file
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const content = e.target?.result as string;
        const parsed = JSON.parse(content);
        
        // Validate the JSON structure
        if (!Array.isArray(parsed)) {
          toast.error('JSON must contain an array of discussions');
          return;
        }
        
        // Validate each discussion has required fields
        const validDiscussions = parsed.filter((item) => {
          return item.id && item.title && item.url;
        });
        
        if (validDiscussions.length === 0) {
          toast.error('No valid discussions found in JSON');
          return;
        }
        
        if (validDiscussions.length !== parsed.length) {
          toast.warning(`Found ${validDiscussions.length} valid discussions out of ${parsed.length}`);
        }
        
        setParsedData(validDiscussions);
        toast.success(`Successfully parsed ${validDiscussions.length} discussions`);
        
      } catch (error) {
        console.error('Error parsing JSON:', error);
        toast.error('Error parsing JSON file');
        setFile(null);
      }
    };
    
    reader.readAsText(selectedFile);
  };

  const handleUpload = async () => {
    if (!parsedData) {
      toast.error('No valid data to upload');
      return;
    }
    
    try {
      setIsUploading(true);
      
      // Simulate progress
      const timer = setInterval(() => {
        setUploadProgress(prev => {
          if (prev >= 95) {
            clearInterval(timer);
            return 95;
          }
          return prev + 5;
        });
      }, 100);
      
      // Upload to API
      const result = await api.admin.uploadDiscussions(parsedData);
      
      clearInterval(timer);
      setUploadProgress(100);
      
      if (result.success) {
        toast.success(result.message);
        
        // Reset the form after successful upload
        setTimeout(() => {
          setFile(null);
          setParsedData(null);
          setIsUploading(false);
          setUploadProgress(0);
          if (fileInputRef.current) {
            fileInputRef.current.value = '';
          }
        }, 1000);
      } else {
        toast.error(result.message);
        setIsUploading(false);
        setUploadProgress(0);
      }
    } catch (error) {
      console.error('Upload error:', error);
      toast.error('Failed to upload discussions');
      setIsUploading(false);
      setUploadProgress(0);
    }
  };

  const clearFile = () => {
    setFile(null);
    setParsedData(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <Card className="w-full shadow-md">
      <CardHeader>
        <CardTitle className="flex items-center">
          <Upload className="h-5 w-5 mr-2" />
          Upload JSON Discussions
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {!file ? (
            <div className="border-2 border-dashed border-gray-300 rounded-md p-8 text-center">
              <Upload className="w-8 h-8 mx-auto mb-2 text-gray-400" />
              <p className="mb-4 text-gray-500">Upload a JSON file containing GitHub discussions</p>
              <input 
                type="file" 
                accept=".json" 
                onChange={handleFileChange}
                ref={fileInputRef}
                className="hidden"
                id="json-file-input" 
              />
              <Button onClick={() => fileInputRef.current?.click()}>
                Select JSON File
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center justify-between bg-gray-50 p-3 rounded-md">
                <div className="flex items-center">
                  <div className="text-blue-600 mr-3">
                    <Upload className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="font-medium">{file.name}</p>
                    <p className="text-sm text-gray-500">
                      {(file.size / 1024).toFixed(2)} KB • {parsedData?.length || 0} discussions
                    </p>
                  </div>
                </div>
                
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={clearFile}
                  disabled={isUploading}
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>
              
              {parsedData && parsedData.length > 0 && (
                <div className="border rounded-md p-3">
                  <p className="font-medium mb-2">Preview (first 3 items):</p>
                  <div className="max-h-40 overflow-y-auto space-y-2">
                    {parsedData.slice(0, 3).map((item, index) => (
                      <div key={index} className="bg-gray-50 p-2 rounded-md text-sm">
                        <div><strong>ID:</strong> {item.id}</div>
                        <div><strong>Title:</strong> {item.title}</div>
                        <div><strong>Repository:</strong> {item.repository || extractRepositoryFromUrl(item.url)}</div>
                        <div className="truncate"><strong>URL:</strong> {item.url}</div>
                      </div>
                    ))}
                    {parsedData.length > 3 && (
                      <p className="text-sm text-gray-500">...and {parsedData.length - 3} more</p>
                    )}
                  </div>
                </div>
              )}
              
              {isUploading && (
                <div className="space-y-2">
                  <Progress value={uploadProgress} className="w-full" />
                  <p className="text-sm text-center text-gray-500">
                    {uploadProgress === 100 ? (
                      <span className="flex items-center justify-center text-green-600">
                        <Check className="w-4 h-4 mr-1" /> Upload complete
                      </span>
                    ) : (
                      `Uploading ${uploadProgress}%`
                    )}
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      </CardContent>
      <CardFooter>
        <div className="flex justify-end w-full gap-2">
          <Button variant="outline" onClick={clearFile} disabled={!file || isUploading}>
            Clear
          </Button>
          <Button 
            onClick={handleUpload} 
            disabled={!parsedData || isUploading}
          >
            {isUploading ? 'Uploading...' : 'Upload Discussions'}
          </Button>
        </div>
      </CardFooter>
    </Card>
  );
};

// Utility function to extract repository name from GitHub URL
function extractRepositoryFromUrl(url: string): string {
  try {
    const githubUrlPattern = /github\.com\/([^\/]+\/[^\/]+)/i;
    const match = url.match(githubUrlPattern);
    return match ? match[1] : 'unknown/repository';
  } catch (error) {
    console.error('Error extracting repository from URL:', error);
    return 'unknown/repository';
  }
}

export default JsonUploader;
