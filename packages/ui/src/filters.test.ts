import { describe, expect, test } from 'bun:test'
import { clearFilters, countFilters, type FilterFlags, hasFilter, toggleFilter } from './filters.ts'

const NONE: FilterFlags = {
  pinned: false,
  conflicted: false,
  pending: false,
  archived: false,
}

describe('toggleFilter', () => {
  test('adds a token to an empty query', () => {
    expect(toggleFilter('', 'cluster', 'infra')).toBe('cluster:infra')
  })

  test('appends without disturbing what was already typed', () => {
    expect(toggleFilter('deploy notes', 'agent', 'claude')).toBe('deploy notes agent:claude')
  })

  test('clicking the same facet again removes it', () => {
    expect(toggleFilter('deploy cluster:infra agent:wren', 'cluster', 'infra')).toBe(
      'deploy agent:wren',
    )
  })

  test('matches case-insensitively — facet values arrive in any case', () => {
    expect(toggleFilter('Cluster:Infra', 'cluster', 'infra')).toBe('')
  })

  test('normalises the whitespace it was handed', () => {
    expect(toggleFilter('  a   b  ', 'agent', 'x')).toBe('a b agent:x')
  })
})

describe('hasFilter', () => {
  test('finds a token anywhere in the query, whatever its case', () => {
    expect(hasFilter('free text cluster:infra', 'cluster', 'infra')).toBe(true)
    expect(hasFilter('CLUSTER:INFRA', 'cluster', 'infra')).toBe(true)
  })

  test('does not match a prefix of a longer value', () => {
    expect(hasFilter('cluster:infrastructure', 'cluster', 'infra')).toBe(false)
  })

  test('false on an empty query', () => {
    expect(hasFilter('', 'agent', 'wren')).toBe(false)
  })
})

describe('clearFilters', () => {
  test('keeps the free text and drops the facets', () => {
    expect(clearFilters('deploy cluster:infra notes agent:wren')).toBe('deploy notes')
  })

  test('clearing an all-facet query leaves nothing, not whitespace', () => {
    expect(clearFilters('cluster:infra agent:wren')).toBe('')
    expect(clearFilters('   ')).toBe('')
  })
})

describe('countFilters', () => {
  test('counts facet tokens but not free text', () => {
    expect(countFilters('deploy notes', NONE)).toBe(0)
    expect(countFilters('deploy cluster:infra agent:wren', NONE)).toBe(2)
  })

  test('counts flags too — they narrow the view just as much', () => {
    expect(countFilters('', { ...NONE, pinned: true, archived: true })).toBe(2)
    expect(countFilters('cluster:infra', { ...NONE, pending: true })).toBe(2)
  })
})
