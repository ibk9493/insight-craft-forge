
import { useTheme } from "next-themes"
import { Toaster as Sonner } from "sonner"
import type { ToasterProps } from "sonner"

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = "system" } = useTheme()

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      className="toaster group"
      toastOptions={{
        classNames: {
          toast:
            "group toast group-[.toaster]:bg-background group-[.toaster]:text-foreground group-[.toaster]:border-border group-[.toaster]:shadow-lg",
          description: "group-[.toast]:text-muted-foreground",
          actionButton:
            "group-[.toast]:bg-primary group-[.toast]:text-primary-foreground",
          cancelButton:
            "group-[.toast]:bg-muted group-[.toast]:text-muted-foreground",
        },
      }}
      {...props}
    />
  )
}

// Create a custom wrapper for toast to ensure objects are stringified
const customToast = (() => {
  // Import the original toast
  const { toast: originalToast } = require("sonner");
  
  // Create our wrapped version
  const wrappedToast = {
    ...originalToast,
    // Override the default methods to handle object messages
    error: (message: any, data?: any) => {
      const stringMessage = formatToastMessage(message);
      return originalToast.error(stringMessage, data);
    },
    success: (message: any, data?: any) => {
      const stringMessage = formatToastMessage(message);
      return originalToast.success(stringMessage, data);
    },
    info: (message: any, data?: any) => {
      const stringMessage = formatToastMessage(message);
      return originalToast.info(stringMessage, data);
    },
    warning: (message: any, data?: any) => {
      const stringMessage = formatToastMessage(message);
      return originalToast.warning(stringMessage, data);
    },
    // Default method
    default: (message: any, data?: any) => {
      const stringMessage = formatToastMessage(message);
      return originalToast(stringMessage, data);
    },
  };
  
  // Make the default function callable directly
  const toast = (message: any, data?: any) => wrappedToast.default(message, data);
  
  // Add all the methods to the callable function
  Object.assign(toast, wrappedToast);
  
  return toast as typeof originalToast;
})();

// Helper function to format toast messages
const formatToastMessage = (message: any): string => {
  if (message === null) return 'null';
  if (message === undefined) return 'undefined';
  
  if (typeof message === 'object') {
    try {
      return JSON.stringify(message);
    } catch (e) {
      return '[Object]';
    }
  }
  
  return String(message);
};

export { Toaster };
export { customToast as toast };
