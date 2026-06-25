import { AlertCircle, Loader2 } from "lucide-react"

export function LoadingState() {
  return (
    <div className="flex h-48 items-center justify-center gap-2 text-sm text-[#637083]">
      <Loader2 className="h-4 w-4 animate-spin" />
      Loading
    </div>
  )
}

export function EmptyState({ label }: { label: string }) {
  return (
    <div className="flex h-48 items-center justify-center border-y border-[#d9e1ea] bg-white text-sm text-[#637083]">
      {label}
    </div>
  )
}

export function ErrorState({ label }: { label: string }) {
  return (
    <div className="flex h-48 items-center justify-center gap-2 border-y border-[#fecaca] bg-[#fff1f2] text-sm text-[#991b1b]">
      <AlertCircle className="h-4 w-4" />
      {label}
    </div>
  )
}
