import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-1.5 whitespace-nowrap font-medium transition-colors disabled:pointer-events-none disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40",
  {
    variants: {
      variant: {
        primary:
          "bg-success hover:bg-[#1a7f37] text-white border border-[rgba(31,35,40,0.15)] rounded-[6px]",
        secondary:
          "bg-surface hover:bg-inset text-fg border border-border rounded-[6px]",
        danger:
          "bg-bg border border-border text-danger hover:bg-danger hover:text-white rounded-[6px]",
        ghost:
          "hover:bg-inset text-fg rounded-[6px]",
        link:
          "text-accent hover:underline p-0 h-auto",
      },
      size: {
        sm: "px-3 py-[3px] text-xs",
        md: "px-4 py-[5px] text-sm",
        icon: "p-1.5 w-7 h-7",
      },
    },
    defaultVariants: {
      variant: "secondary",
      size: "md",
    },
  }
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button"
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    )
  }
)
Button.displayName = "Button"

export { Button, buttonVariants }
