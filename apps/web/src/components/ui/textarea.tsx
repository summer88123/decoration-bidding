import * as React from "react"

import { cn } from "@/lib/utils"

const Textarea = React.forwardRef<
  HTMLTextAreaElement,
  React.ComponentProps<"textarea">
>(({ className, ...props }, ref) => {
  return (
    <textarea
      className={cn(
        "flex min-h-[60px] w-full rounded-md border border-oklch(0.922 0 0) bg-transparent px-3 py-2 text-base shadow-sm placeholder:text-oklch(0.556 0 0) focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-oklch(0.708 0 0) disabled:cursor-not-allowed disabled:opacity-50 md:text-sm dark:border-oklch(1 0 0 / 10%) dark:border-oklch(1 0 0 / 15%) dark:placeholder:text-oklch(0.708 0 0) dark:focus-visible:ring-oklch(0.556 0 0)",
        className
      )}
      ref={ref}
      {...props}
    />
  )
})
Textarea.displayName = "Textarea"

export { Textarea }
