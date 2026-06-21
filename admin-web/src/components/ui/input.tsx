import * as React from "react"
import { cn } from "@/lib/utils"

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...props }, ref) => (
    <input
      ref={ref}
      className={cn(
        "focus-ring h-9 w-full rounded-md border border-[#cbd5e1] bg-white px-3 text-sm text-[#18212f] shadow-sm placeholder:text-[#7b8798]",
        className,
      )}
      {...props}
    />
  ),
)
Input.displayName = "Input"
