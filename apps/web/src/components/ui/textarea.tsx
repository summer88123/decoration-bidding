import * as React from "react"
import { cn } from "@/lib/utils"

const Textarea = React.forwardRef<HTMLTextAreaElement, React.ComponentProps<"textarea">>(
  ({ className, ...props }, ref) => {
    return (
      <textarea
        className={cn(
          "w-full px-3 py-[5px] border border-border rounded-[6px] text-sm bg-bg text-fg",
          "placeholder:text-muted resize-y min-h-[80px]",
          "focus:outline-none focus:border-accent focus:ring-[3px] focus:ring-accent/20",
          "disabled:cursor-not-allowed disabled:opacity-50",
          className
        )}
        ref={ref}
        {...props}
      />
    )
  }
)
Textarea.displayName = "Textarea"

export { Textarea }
