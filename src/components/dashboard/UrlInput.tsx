
import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ArrowRight } from 'lucide-react';

interface UrlInputProps {
  onSubmit: (url: string) => void;
}

const UrlInput: React.FC<UrlInputProps> = ({ onSubmit }) => {
  const [url, setUrl] = useState('');
  const [error, setError] = useState('');

  const validateUrl = (value: string) => {
    // Basic validation for GitHub discussion URLs
    const githubUrlRegex = /^https:\/\/(github\.com)\/.*\/discussions\/\d+/;
    if (!githubUrlRegex.test(value)) {
      return "Please enter a valid GitHub discussion URL";
    }
    return "";
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const validationError = validateUrl(url);
    if (validationError) {
      setError(validationError);
      return;
    }
    
    setError('');
    onSubmit(url);
  };

  return (
    <div className="w-full max-w-2xl mx-auto bg-white rounded-lg shadow-md p-6 mb-6">
      <h2 className="text-lg font-medium mb-4">Input GitHub Discussion URL</h2>
      <form onSubmit={handleSubmit} className="flex flex-col md:flex-row gap-3">
        <Input
          type="text"
          placeholder="https://github.com/org/repo/discussions/123"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          className="flex-grow"
        />
        <Button type="submit" className="bg-dashboard-blue hover:bg-blue-600">
          <span>Submit</span>
          <ArrowRight className="ml-2 h-4 w-4" />
        </Button>
      </form>
      {error && (
        <p className="mt-2 text-sm text-red-600">{error}</p>
      )}
    </div>
  );
};

export default UrlInput;
