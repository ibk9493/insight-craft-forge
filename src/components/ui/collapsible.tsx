
import * as CollapsiblePrimitive from "@radix-ui/react-collapsible"
import React, { useState, useRef, useCallback } from 'react';

// Custom component that prevents collapsing when typing inside
const Collapsible = React.forwardRef<
  React.ElementRef<typeof CollapsiblePrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof CollapsiblePrimitive.Root>
>(({ children, ...props }, ref) => {
  const [isInnerInteraction, setIsInnerInteraction] = useState(false);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  // Track clicks inside the content to prevent collapsing
  const handleInnerInteraction = useCallback(() => {
    setIsInnerInteraction(true);
    
    // Clear any existing timeout
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    
    // Reset after a short delay
    timeoutRef.current = setTimeout(() => {
      setIsInnerInteraction(false);
    }, 100);
  }, []);
  
  // Clean up timeout on unmount
  React.useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);
  
  return (
    <div onClick={handleInnerInteraction}>
      <CollapsiblePrimitive.Root
        {...props}
        ref={ref}
        onOpenChange={(open) => {
          if (!isInnerInteraction && props.onOpenChange) {
            props.onOpenChange(open);
          }
        }}
      >
        {children}
      </CollapsiblePrimitive.Root>
    </div>
  );
});

Collapsible.displayName = "Collapsible";

const CollapsibleTrigger = CollapsiblePrimitive.CollapsibleTrigger;
const CollapsibleContent = CollapsiblePrimitive.CollapsibleContent;

// Export the components
export { 
  Collapsible,
  CollapsibleTrigger, 
  CollapsibleContent 
}
