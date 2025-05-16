
import React from 'react';
import { TabsContainer, TabList, Tab, TabPanel } from '@/components/ui/tabs';

interface TabsProps {
  defaultValue: string;
  value?: string;
  onValueChange?: (value: string) => void;
  className?: string;
  children: React.ReactNode;
}

export const Tabs: React.FC<TabsProps> = ({
  defaultValue,
  value,
  onValueChange,
  className,
  children,
}) => {
  const [internalValue, setInternalValue] = React.useState(defaultValue);
  
  const currentValue = value !== undefined ? value : internalValue;
  const handleValueChange = onValueChange || setInternalValue;
  
  return (
    <TabsContainer
      value={currentValue}
      onValueChange={handleValueChange}
      className={className}
    >
      {children}
    </TabsContainer>
  );
};

interface TabsListProps {
  className?: string;
  children: React.ReactNode;
}

export const TabsList: React.FC<TabsListProps> = ({ className, children }) => {
  return <TabList className={className}>{children}</TabList>;
};

interface TabsTriggerProps {
  value: string;
  className?: string;
  children: React.ReactNode;
}

export const TabsTrigger: React.FC<TabsTriggerProps> = ({ value, className, children }) => {
  return <Tab value={value} className={className}>{children}</Tab>;
};

interface TabsContentProps {
  value: string;
  className?: string;
  children: React.ReactNode;
}

export const TabsContent: React.FC<TabsContentProps> = ({ value, className, children }) => {
  return <TabPanel value={value} className={className}>{children}</TabPanel>;
};
