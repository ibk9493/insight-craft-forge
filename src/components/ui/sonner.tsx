
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
        // Ensure objects are properly stringified before rendering
        formatToast: (toast) => {
          // Make sure toast message is a string
          if (typeof toast.message === 'object') {
            try {
              toast.message = JSON.stringify(toast.message);
            } catch (e) {
              toast.message = '[Object]';
            }
          }
          // Make sure toast description is a string
          if (toast.description && typeof toast.description === 'object') {
            try {
              toast.description = JSON.stringify(toast.description);
            } catch (e) {
              toast.description = '[Object]';
            }
          }
          return toast;
        },
      }}
      {...props}
    />
  )
}

export { Toaster }
export { toast } from "sonner"
