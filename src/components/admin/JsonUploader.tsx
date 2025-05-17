import React, { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';
import { api, GitHubDiscussion } from '@/services/api';
import { Upload, X, Check, Tag, Code, Calendar, Package } from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';

const JsonUploader: React.FC = () => {
  const [file, setFile] = useState<File | null>(null);
  const [parsedData, setParsedData] = useState<GitHubDiscussion[] | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [jsonErrors, setJsonErrors] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Batch information
  const [batchName, setBatchName] = useState<string>('');
  const [batchDescription, setBatchDescription] = useState<string>('');

  const validateJSON = (json: any): { isValid: boolean, errors: string[], validItems: any[] } => {
    const errors: string[] = [];
    const validItems: any[] = [];
    
    if (!Array.isArray(json)) {
      console.error('[JsonUploader] JSON is not an array:', typeof json);
      errors.push('JSON structure must be an array of discussions');
      return { isValid: false, errors, validItems };
    }
    
    console.log(`[JsonUploader] Validating ${json.length} items in JSON array`);
    
    // Validate each discussion object
    json.forEach((item, index) => {
      let isItemValid = true;
      const validationErrors: string[] = [];
      
      // URLs are required
      if (!item.url) {
        console.warn(`[JsonUploader] Item #${index + 1} missing URL`);
        validationErrors.push(`Item #${index + 1}: Missing required 'url' field`);
        isItemValid = false;
      }
      
      // Other field validations can be less strict since we'll auto-generate missing fields
      
      // Optional field validations (if present)
      if (item.repositoryLanguage !== undefined && typeof item.repositoryLanguage !== 'string') {
        console.warn(`[JsonUploader] Item #${index + 1} has invalid repositoryLanguage`);
        validationErrors.push(`Item #${index + 1}: repositoryLanguage must be a string`);
        isItemValid = false;
      }
      
      if (item.releaseTag !== undefined && typeof item.releaseTag !== 'string') {
        console.warn(`[JsonUploader] Item #${index + 1} has invalid releaseTag`);
        validationErrors.push(`Item #${index + 1}: releaseTag must be a string`);
        isItemValid = false;
      }
      
      if (item.releaseDate !== undefined) {
        try {
          new Date(item.releaseDate);
        } catch (e) {
          console.warn(`[JsonUploader] Item #${index + 1} has invalid releaseDate`);
          validationErrors.push(`Item #${index + 1}: releaseDate must be a valid date string`);
          isItemValid = false;
        }
      }

      // Add validation errors to the main errors array
      errors.push(...validationErrors);
      
      // If the item is valid, add it to the validItems array
      if (isItemValid) {
        validItems.push(item);
      } else {
        console.error(`[JsonUploader] Item #${index + 1} has validation errors:`, validationErrors);
      }
    });
    
    console.log(`[JsonUploader] Found ${validItems.length} valid items out of ${json.length}`);
    return { isValid: validItems.length > 0, errors, validItems };
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0];
    setJsonErrors([]);
    
    if (!selectedFile) {
      console.log('[JsonUploader] No file selected');
      return;
    }
    
    if (selectedFile.type !== 'application/json') {
      toast.error('Please select a valid JSON file');
      console.error('[JsonUploader] Invalid file type:', selectedFile.type);
      return;
    }
    
    setFile(selectedFile);
    console.log('[JsonUploader] File selected:', selectedFile.name, selectedFile.size);
    
    // Set default batch name from file name
    const fileNameWithoutExt = selectedFile.name.replace(/\.json$/, '');
    setBatchName(fileNameWithoutExt);
    
    // Read and parse the file
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        console.log('[JsonUploader] File read complete');
        const content = e.target?.result as string;
        
        try {
          console.log('[JsonUploader] Parsing JSON...');
          console.log('[JsonUploader] JSON preview:', content.substring(0, 200) + '...');
          const parsed = JSON.parse(content);
          
          // Validate the JSON structure
          const { isValid, errors, validItems } = validateJSON(parsed);
          
          if (errors.length > 0) {
            console.warn('[JsonUploader] JSON validation warnings:', errors);
            setJsonErrors(errors);
          }
          
          if (!isValid || validItems.length === 0) {
            console.error('[JsonUploader] JSON validation failed - no valid discussions found');
            toast.error(`Invalid JSON format: ${errors[0]}`, {
              description: 'Check console for complete error details'
            });
            return;
          }
          
          // Format dates consistently and ensure all required fields
          const processedDiscussions = validItems.map((disc: any) => {
            // Auto-generate missing fields where possible
            if (!disc.repository && disc.url) {
              disc.repository = extractRepositoryFromUrl(disc.url);
              console.info(`[JsonUploader] Auto-generated repository: ${disc.repository} for URL ${disc.url}`);
            }
            
            // Ensure createdAt exists
            if (!disc.createdAt) {
              disc.createdAt = new Date().toISOString();
              console.info(`[JsonUploader] Auto-generated createdAt: ${disc.createdAt}`);
            }
            
            // Process release data if available
            if (disc.releaseDate) {
              try {
                // Ensure consistent date format
                const date = new Date(disc.releaseDate);
                disc.releaseDate = date.toISOString();
              } catch (e) {
                console.warn(`[JsonUploader] Failed to parse release date for discussion ${disc.id}`);
              }
            }
            
            // Ensure task structure exists with Task 1 unlocked by default
            if (!disc.tasks) {
              disc.tasks = {
                task1: { status: 'unlocked', annotators: 0 },
                task2: { status: 'locked', annotators: 0 },
                task3: { status: 'locked', annotators: 0 }
              };
              console.info(`[JsonUploader] Auto-generated tasks structure for ID ${disc.id}`);
            } else {
              // Ensure Task 1 is unlocked by default if tasks exist but Task 1 is not specified
              if (!disc.tasks.task1) {
                disc.tasks.task1 = { status: 'unlocked', annotators: 0 };
              } else {
                disc.tasks.task1.status = 'unlocked';
              }
            }
            
            return disc;
          });
          
          setParsedData(processedDiscussions);
          console.log(`[JsonUploader] Successfully processed ${processedDiscussions.length} discussions`);
          
          if (errors.length > 0) {
            toast.warning(`Processed with ${errors.length} warnings`, {
              description: `Found ${processedDiscussions.length} valid discussions`
            });
          } else {
            toast.success(`Successfully parsed ${processedDiscussions.length} discussions`);
          }
          
        } catch (parseError) {
          console.error('[JsonUploader] Error parsing JSON:', parseError);
          toast.error('Error parsing JSON file', {
            description: 'The file contains invalid JSON syntax'
          });
          setFile(null);
        }
      } catch (error) {
        console.error('[JsonUploader] Error reading file:', error);
        toast.error('Error reading JSON file');
        setFile(null);
      }
    };
    
    reader.readAsText(selectedFile);
  };

  const handleUpload = async () => {
    if (!parsedData || parsedData.length === 0) {
      toast.error('No valid data to upload');
      return;
    }
    
    // Validate batch name
    if (!batchName.trim()) {
      toast.error('Batch name is required');
      return;
    }
    
    try {
      setIsUploading(true);
      console.log(`[JsonUploader] Starting upload of ${parsedData.length} discussions in batch: ${batchName}`);
      
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
      
      // Upload to API with batch information
      const result = await api.admin.uploadDiscussions(parsedData, batchName, batchDescription);
      
      clearInterval(timer);
      setUploadProgress(100);
      console.log('[JsonUploader] Upload result:', result);
      
      if (result.success) {
        toast.success(result.message);
        
        // Reset the form after successful upload
        setTimeout(() => {
          setFile(null);
          setParsedData(null);
          setIsUploading(false);
          setUploadProgress(0);
          setJsonErrors([]);
          setBatchName('');
          setBatchDescription('');
          if (fileInputRef.current) {
            fileInputRef.current.value = '';
          }
          console.log('[JsonUploader] Form reset after successful upload');
        }, 1000);
      } else {
        toast.error(result.message);
        console.error('[JsonUploader] Upload failed:', result);
        if (result.errors && result.errors.length > 0) {
          console.error('[JsonUploader] Upload errors:', result.errors);
        }
        setIsUploading(false);
        setUploadProgress(0);
      }
    } catch (error) {
      console.error('[JsonUploader] Upload error:', error);
      toast.error('Failed to upload discussions');
      setIsUploading(false);
      setUploadProgress(0);
    }
  };

  const clearFile = () => {
    setFile(null);
    setParsedData(null);
    setJsonErrors([]);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
    console.log('[JsonUploader] Form cleared');
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
          {/* Batch Information Section */}
          {file && (
            <div className="space-y-4 border rounded-md p-4 bg-gray-50">
              <h3 className="font-medium flex items-center">
                <Package className="h-4 w-4 mr-2" />
                Batch Information
              </h3>
              
              <div className="space-y-2">
                <div className="grid gap-1">
                  <Label htmlFor="batchName">Batch Name (required)</Label>
                  <Input 
                    id="batchName"
                    value={batchName} 
                    onChange={(e) => setBatchName(e.target.value)} 
                    placeholder="Enter batch name" 
                    disabled={isUploading}
                  />
                </div>
                
                <div className="grid gap-1">
                  <Label htmlFor="batchDescription">Description (optional)</Label>
                  <Textarea 
                    id="batchDescription"
                    value={batchDescription} 
                    onChange={(e) => setBatchDescription(e.target.value)} 
                    placeholder="Enter batch description" 
                    rows={2}
                    disabled={isUploading}
                  />
                </div>
              </div>
            </div>
          )}
          
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
              
              {jsonErrors.length > 0 && (
                <div className={`border rounded-md p-3 ${jsonErrors.some(err => err.includes('Missing required')) ? 'border-amber-300 bg-amber-50' : 'border-red-300 bg-red-50'}`}>
                  <p className={`font-medium mb-2 ${jsonErrors.some(err => err.includes('Missing required')) ? 'text-amber-700' : 'text-red-700'}`}>
                    {jsonErrors.some(err => err.includes('Missing required')) ? 'Validation Warnings:' : 'JSON Validation Errors:'}
                  </p>
                  <ul className={`list-disc pl-5 text-sm max-h-40 overflow-y-auto ${jsonErrors.some(err => err.includes('Missing required')) ? 'text-amber-700' : 'text-red-700'}`}>
                    {jsonErrors.map((error, idx) => (
                      <li key={idx}>{error}</li>
                    ))}
                  </ul>
                </div>
              )}
              
              {parsedData && parsedData.length > 0 && (
                <div className="border rounded-md p-3">
                  <p className="font-medium mb-2">Preview (first 3 items):</p>
                  <div className="max-h-40 overflow-y-auto space-y-2">
                    {parsedData.slice(0, 3).map((item, index) => (
                      <div key={index} className="bg-gray-50 p-2 rounded-md text-sm">
                        <div><strong>ID:</strong> {item.id || 'Auto-generated'}</div>
                        <div><strong>Title:</strong> {item.title || 'Auto-generated'}</div>
                        <div><strong>Repository:</strong> {item.repository || extractRepositoryFromUrl(item.url)}</div>
                        <div className="truncate"><strong>URL:</strong> {item.url}</div>
                        
                        {/* Show enhanced metadata if available */}
                        {(item.releaseTag || item.repositoryLanguage || item.releaseDate) && (
                          <div className="mt-1 pt-1 border-t border-gray-200">
                            {item.releaseTag && (
                              <div className="flex items-center text-xs text-gray-600">
                                <Tag className="w-3 h-3 mr-1" />
                                <span>Release: {item.releaseTag}</span>
                              </div>
                            )}
                            {item.repositoryLanguage && (
                              <div className="flex items-center text-xs text-gray-600">
                                <Code className="w-3 h-3 mr-1" />
                                <span>Language: {item.repositoryLanguage}</span>
                              </div>
                            )}
                            {item.releaseDate && (
                              <div className="flex items-center text-xs text-gray-600">
                                <Calendar className="w-3 h-3 mr-1" />
                                <span>Release Date: {new Date(item.releaseDate).toLocaleDateString()}</span>
                              </div>
                            )}
                          </div>
                        )}
                        
                        {/* Show task statuses */}
                        <div className="mt-1 pt-1 border-t border-gray-200">
                          <div className="text-xs text-gray-600">
                            <span className="font-medium">Task 1:</span> {item.tasks?.task1?.status || 'unlocked'}
                          </div>
                          <div className="text-xs text-gray-600">
                            <span className="font-medium">Task 2:</span> {item.tasks?.task2?.status || 'locked'}
                          </div>
                          <div className="text-xs text-gray-600">
                            <span className="font-medium">Task 3:</span> {item.tasks?.task3?.status || 'locked'}
                          </div>
                        </div>
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
            disabled={!parsedData || parsedData.length === 0 || isUploading || !batchName.trim()}
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
