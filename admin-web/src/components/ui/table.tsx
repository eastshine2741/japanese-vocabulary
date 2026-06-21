import * as React from "react"
import { cn } from "@/lib/utils"

export function Table({ className, ...props }: React.HTMLAttributes<HTMLTableElement>) {
  return (
    <div className="w-full overflow-x-auto border-y border-[#d9e1ea] bg-white">
      <table className={cn("w-full min-w-[760px] border-collapse text-sm", className)} {...props} />
    </div>
  )
}

export function Th({ className, ...props }: React.ThHTMLAttributes<HTMLTableCellElement>) {
  return (
    <th
      className={cn(
        "h-10 border-b border-[#d9e1ea] bg-[#f6f7f9] px-4 text-left text-xs font-semibold uppercase tracking-normal text-[#637083]",
        className,
      )}
      {...props}
    />
  )
}

export function Td({ className, ...props }: React.TdHTMLAttributes<HTMLTableCellElement>) {
  return <td className={cn("h-12 border-b border-[#edf1f5] px-4 align-middle", className)} {...props} />
}
