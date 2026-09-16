import { useMemo, useState } from "react"

/**
 * Client-side pagination helper for list tables.
 * Returns the current page's slice plus navigation state.
 */
export function usePagination<T>(items: T[], pageSize = 10) {
  const [page, setPage] = useState(1)
  const pageCount = Math.max(1, Math.ceil(items.length / pageSize))
  const current = Math.min(page, pageCount)
  const pageItems = useMemo(
    () => items.slice((current - 1) * pageSize, current * pageSize),
    [items, current, pageSize]
  )
  return { page: current, setPage, pageCount, pageItems, total: items.length, pageSize }
}
