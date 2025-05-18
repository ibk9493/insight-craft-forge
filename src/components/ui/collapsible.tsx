
import * as CollapsiblePrimitive from "@radix-ui/react-collapsible"

// Create a modified version that doesn't collapse when typing inside
const Collapsible = CollapsiblePrimitive.Root

const CollapsibleTrigger = CollapsiblePrimitive.CollapsibleTrigger

const CollapsibleContent = CollapsiblePrimitive.CollapsibleContent

// Export the components
export { 
  Collapsible,
  CollapsibleTrigger, 
  CollapsibleContent 
}
