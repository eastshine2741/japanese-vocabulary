export function DetailGrid({ children }: { children: React.ReactNode }) {
  return <dl className="grid grid-cols-1 border-y border-[#d9e1ea] bg-white sm:grid-cols-2">{children}</dl>
}

export function DetailItem({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="min-w-0 border-b border-[#edf1f5] px-4 py-3 even:border-l sm:last:border-b-0 sm:[&:nth-last-child(2)]:border-b-0">
      <dt className="text-xs font-semibold uppercase tracking-normal text-[#637083]">{label}</dt>
      <dd className="mt-1 min-h-5 break-words text-sm text-[#18212f]">{value ?? "-"}</dd>
    </div>
  )
}
