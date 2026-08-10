import { useTheme } from "next-themes";
import { Toaster as Sonner, toast } from "sonner";

type ToasterProps = React.ComponentProps<typeof Sonner>;

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = "system" } = useTheme();

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      className="toaster group"
      toastOptions={{
        classNames: {
          toast:
            "group toast group-[.toaster]:bg-background group-[.toaster]:text-foreground group-[.toaster]:border-border group-[.toaster]:shadow-lg",
          // `whitespace-pre-line` preserves `\n` as line breaks in multi-line
          // toast messages. Without it, CSS `white-space: normal` (the default)
          // collapses newlines to spaces, so e.g. a validation toast carrying
          // `errors.join('\n')` (EnhancedFileUploader) renders several errors
          // flattened onto one line. `pre-line` is identical to `normal` for
          // single-line text, so existing toasts are visually unchanged; only
          // messages that actually contain `\n` gain line breaks. Applied to
          // BOTH title (the `toast.error(msg)` message text) and description,
          // since either may carry a multi-line string. (Sibling of the
          // iteration-18 CaptionOverlay `white-space: pre-line` fix.)
          title: "whitespace-pre-line",
          description: "group-[.toast]:text-muted-foreground whitespace-pre-line",
          actionButton: "group-[.toast]:bg-primary group-[.toast]:text-primary-foreground",
          cancelButton: "group-[.toast]:bg-muted group-[.toast]:text-muted-foreground",
        },
      }}
      {...props}
    />
  );
};

export { Toaster, toast };
