
import * as React from "react"

import { cn } from "@/lib/utils"

export interface TextareaProps
  extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {}

const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, ...props }, ref) => {
    // Event handlers to stop propagation
    const handleClick = (e: React.MouseEvent<HTMLTextAreaElement>) => {
      e.stopPropagation();
      if (props.onClick) props.onClick(e);
    };

    const handleFocus = (e: React.FocusEvent<HTMLTextAreaElement>) => {
      e.stopPropagation();
      if (props.onFocus) props.onFocus(e);
    };

    const handleBlur = (e: React.FocusEvent<HTMLTextAreaElement>) => {
      e.stopPropagation();
      if (props.onBlur) props.onBlur(e);
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      e.stopPropagation();
      if (props.onKeyDown) props.onKeyDown(e);
    };

    return (
      <textarea
        className={cn(
          "flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
          className
        )}
        ref={ref}
        {...props}
        onClick={handleClick}
        onFocus={handleFocus}
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
      />
    )
  }
)
Textarea.displayName = "Textarea"

export { Textarea }
