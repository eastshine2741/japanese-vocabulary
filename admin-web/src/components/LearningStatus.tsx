import { cn, formatDateTime, formatNumber, formatRelativeDays, recencyTone } from "@/lib/utils"

/** 앱의 단어 진행도 색: 외운 단어(teal) · 외우는 중(amber) · 새 단어(gray). */
export const masteryColor = {
  mastered: "#14b8a6",
  studying: "#f59e0b",
  new: "#d9e1ea",
} as const

export const toneText = {
  muted: "text-[#9aa5b3]",
  success: "text-[#0f766e]",
  warning: "text-[#b45309]",
  danger: "text-[#b91c1c]",
} as const

/** 마지막 저장·복습 같은 활동 시각. 최근일수록 진하게, 오래됐거나 없으면 흐리게. */
export function Recency({ value, className }: { value?: string | null; className?: string }) {
  return (
    <span className={cn("tabular-nums", toneText[recencyTone(value)], className)} title={value ? formatDateTime(value) : undefined}>
      {value ? formatRelativeDays(value) : "없음"}
    </span>
  )
}

/** 0 은 흐리게, 그 외는 진하게. `accent` 가 있으면 0 이 아닐 때 그 색으로 강조. */
export function Count({
  value,
  accent,
  className,
}: {
  value: number
  accent?: "warning" | "success"
  className?: string
}) {
  const tone = value === 0 ? toneText.muted : accent ? cn("font-semibold", toneText[accent]) : "font-medium text-[#18212f]"
  return <span className={cn("tabular-nums", tone, className)}>{formatNumber(value)}</span>
}

/** 외운 단어 / 외우는 중 / 새 단어 비율 막대. 앱 단어장 상세의 파이프라인 바와 같은 순서·색. */
export function MasteryBar({
  total,
  mastered,
  studying,
  newCount,
  legend = false,
  className,
}: {
  total: number
  mastered: number
  studying: number
  newCount: number
  legend?: boolean
  className?: string
}) {
  const safeTotal = Math.max(total, 1)
  return (
    <div className={className}>
      <div className="flex h-2 w-full overflow-hidden rounded-full bg-[#eef1f5]" role="img" aria-label={`외운 단어 ${mastered}, 외우는 중 ${studying}, 새 단어 ${newCount}`}>
        <div style={{ width: `${(mastered / safeTotal) * 100}%`, backgroundColor: masteryColor.mastered }} />
        <div style={{ width: `${(studying / safeTotal) * 100}%`, backgroundColor: masteryColor.studying }} />
        <div style={{ width: `${(newCount / safeTotal) * 100}%`, backgroundColor: masteryColor.new }} />
      </div>
      {legend ? (
        <dl className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs">
          <LegendItem color={masteryColor.mastered} label="외운 단어" value={mastered} />
          <LegendItem color={masteryColor.studying} label="외우는 중" value={studying} />
          <LegendItem color={masteryColor.new} label="새 단어" value={newCount} />
        </dl>
      ) : null}
    </div>
  )
}

function LegendItem({ color, label, value }: { color: string; label: string; value: number }) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="inline-block h-2 w-2 rounded-full" style={{ backgroundColor: color }} />
      <dt className="text-[#637083]">{label}</dt>
      <dd className="font-medium tabular-nums text-[#18212f]">{formatNumber(value)}</dd>
    </div>
  )
}
