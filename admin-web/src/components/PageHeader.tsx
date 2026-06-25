export function PageHeader({
  title,
  meta,
}: {
  title: string
  meta?: React.ReactNode
}) {
  return (
    <div className="mb-5 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 className="text-2xl font-semibold tracking-normal text-[#18212f]">{title}</h1>
      </div>
      {meta ? <div className="text-sm text-[#637083]">{meta}</div> : null}
    </div>
  )
}
