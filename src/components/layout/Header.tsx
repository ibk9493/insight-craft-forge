
import React from 'react';
import { Github } from 'lucide-react';

const Header = () => {
  return (
    <header className="bg-white border-b border-gray-200 py-4 px-6 flex justify-between items-center">
      <div className="flex items-center">
        <Github className="h-6 w-6 text-dashboard-blue mr-2" />
        <h1 className="text-xl font-semibold">GitHub Discussion Evaluator</h1>
      </div>
      <div className="flex items-center space-x-4">
        <span className="text-sm text-gray-500">Dashboard v1.0</span>
      </div>
    </header>
  );
};

export default Header;
