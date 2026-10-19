import * as React from "react"
import { useHref, useNavigate } from "react-router-dom"
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

/** 행 어디를 눌러도 상세로 간다. 셀 안의 다른 링크·버튼과, 텍스트를 드래그해 복사하는 경우는 건드리지 않는다. */
export function LinkRow({ to, className, ...props }: { to: string } & React.HTMLAttributes<HTMLTableRowElement>) {
  const navigate = useNavigate()
  const href = useHref(to)
  function onClick(event: React.MouseEvent<HTMLTableRowElement>) {
    if ((event.target as HTMLElement).closest("a, button, input, select")) return
    if (window.getSelection()?.toString()) return
    if (event.metaKey || event.ctrlKey) {
      window.open(href, "_blank")
      return
    }
    navigate(to)
  }
  return <tr className={cn("cursor-pointer hover:bg-[#f9fbfc]", className)} onClick={onClick} {...props} />
}
