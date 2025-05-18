
import * as React from "react"

import { cn } from "@/lib/utils"

export interface TextareaProps
  extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {}

const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, ...props }, ref) => {
    // Create event handlers that completely isolate the events
    const handleEvent = (e: React.SyntheticEvent<HTMLTextAreaElement>) => {
      e.stopPropagation();
    };

    return (
      <textarea
        className={cn(
          "flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
          className
        )}
        ref={ref}
        {...props}
        onClick={e => {
          handleEvent(e);
          if (props.onClick) props.onClick(e as React.MouseEvent<HTMLTextAreaElement>);
        }}
        onFocus={e => {
          handleEvent(e);
          if (props.onFocus) props.onFocus(e);
        }}
        onBlur={e => {
          handleEvent(e);
          if (props.onBlur) props.onBlur(e);
        }}
        onKeyDown={e => {
          handleEvent(e);
          if (props.onKeyDown) props.onKeyDown(e);
        }}
        onChange={e => {
          handleEvent(e);
          if (props.onChange) props.onChange(e);
        }}
      />
    )
  }
)
Textarea.displayName = "Textarea"

export { Textarea }
