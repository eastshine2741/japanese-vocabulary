import { cn } from "@/lib/utils"

export function Badge({
  children,
  tone = "neutral",
}: {
  children: React.ReactNode
  tone?: "neutral" | "success" | "warning" | "danger"
}) {
  const toneClass = {
    neutral: "border-[#cbd5e1] bg-white text-[#42526b]",
    success: "border-[#99f6e4] bg-[#ccfbf1] text-[#115e59]",
    warning: "border-[#fde68a] bg-[#fef3c7] text-[#854d0e]",
    danger: "border-[#fecaca] bg-[#fee2e2] text-[#991b1b]",
  }[tone]

  return (
    <span className={cn("inline-flex rounded-md border px-2 py-0.5 text-xs font-medium", toneClass)}>
      {children}
    </span>
  )
}
