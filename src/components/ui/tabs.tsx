
import React, { createContext, useContext, useState } from 'react';
import { cn } from '@/lib/utils';

// Context to manage tab state
const TabsContext = createContext<{
  value: string;
  onValueChange: (value: string) => void;
}>({
  value: '',
  onValueChange: () => {},
});

// Main container for tabs
export interface TabsContainerProps {
  children: React.ReactNode;
  value: string;
  onValueChange: (value: string) => void;
  className?: string;
}

export const TabsContainer: React.FC<TabsContainerProps> = ({
  children,
  value,
  onValueChange,
  className,
}) => {
  return (
    <TabsContext.Provider value={{ value, onValueChange }}>
      <div className={cn('space-y-2', className)}>
        {children}
      </div>
    </TabsContext.Provider>
  );
};

// Tab list component
export interface TabListProps {
  children: React.ReactNode;
  className?: string;
}

export const TabList: React.FC<TabListProps> = ({ children, className }) => {
  return (
    <div
      className={cn(
        'flex space-x-1 rounded-lg border p-1 bg-white',
        className
      )}
    >
      {children}
    </div>
  );
};

// Individual tab
export interface TabProps {
  children: React.ReactNode;
  value: string;
  className?: string;
}

export const Tab: React.FC<TabProps> = ({ children, value, className }) => {
  const { value: selectedValue, onValueChange } = useContext(TabsContext);
  const isActive = selectedValue === value;

  return (
    <button
      className={cn(
        'px-3 py-1.5 text-sm font-medium rounded-md transition-all',
        isActive
          ? 'bg-gray-100 text-gray-900 shadow-sm'
          : 'text-gray-500 hover:text-gray-900',
        className
      )}
      onClick={() => onValueChange(value)}
    >
      {children}
    </button>
  );
};

// Tab panel component
export interface TabPanelProps {
  children: React.ReactNode;
  value: string;
  className?: string;
}

export const TabPanel: React.FC<TabPanelProps> = ({ children, value, className }) => {
  const { value: selectedValue } = useContext(TabsContext);
  
  if (selectedValue !== value) {
    return null;
  }
  
  return <div className={cn('rounded-lg', className)}>{children}</div>;
};
