import { ChevronLeft, ChevronRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import type { PageResponse } from "@/api/types"

export function PaginationBar<T>({
  page,
  onPage,
}: {
  page: PageResponse<T>
  onPage(page: number): void
}) {
  return (
    <div className="flex h-12 items-center justify-between border-b border-[#d9e1ea] bg-white px-4 text-sm text-[#637083]">
      <span>
        Page {page.number + 1} of {Math.max(page.totalPages, 1)} · {page.totalElements} rows
      </span>
      <div className="flex gap-2">
        <Button
          variant="secondary"
          size="icon"
          aria-label="Previous page"
          title="Previous page"
          disabled={page.first}
          onClick={() => onPage(page.number - 1)}
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <Button
          variant="secondary"
          size="icon"
          aria-label="Next page"
          title="Next page"
          disabled={page.last}
          onClick={() => onPage(page.number + 1)}
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  )
}
