/**
 * Filter state that lives in the query string.
 *
 * Facets are `key:value` tokens in the same string the reader types into, so
 * the search box always spells out what is being shown — and a filter can be
 * read, edited and copied as text rather than only clicked.
 */

export type FilterFlags = {
  readonly pinned: boolean
  readonly conflicted: boolean
  readonly pending: boolean
  readonly archived: boolean
}

export type MemoryKind = 'claim' | 'chunk' | 'all'

/** Add or remove a `key:value` token. */
export const toggleFilter = (query: string, key: string, value: string): string => {
  const token = `${key}:${value}`
  const parts = query.split(/\s+/).filter(Boolean)
  const without = parts.filter((p) => p.toLowerCase() !== token.toLowerCase())
  return (without.length === parts.length ? [...parts, token] : without).join(' ')
}

export const hasFilter = (query: string, key: string, value: string): boolean =>
  query.split(/\s+/).some((p) => p.toLowerCase() === `${key}:${value}`.toLowerCase())

/** Drop every facet token, keeping the free text that was actually searched for. */
export const clearFilters = (query: string): string =>
  query
    .split(/\s+/)
    .filter((p) => p && !p.includes(':'))
    .join(' ')

/** How many filters are narrowing the view — shown on the collapsed rail. */
export const countFilters = (query: string, flags: FilterFlags): number =>
  query.split(/\s+/).filter((p) => p.includes(':')).length +
  Object.values(flags).filter(Boolean).length
