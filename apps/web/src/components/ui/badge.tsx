import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium border",
  {
    variants: {
      variant: {
        default:   "bg-inset text-fg border-border",
        success:   "bg-success-subtle text-success border-transparent",
        info:      "bg-[#ddf4ff] text-accent border-transparent",
        warning:   "bg-warning-subtle text-warning border-transparent",
        danger:    "bg-danger-subtle text-danger border-transparent",
        done:      "bg-[#fbefff] text-[#8250df] border-transparent",
        outline:   "bg-transparent text-fg border-border",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <span className={cn(badgeVariants({ variant }), className)} {...props} />
  )
}

export { Badge, badgeVariants }
