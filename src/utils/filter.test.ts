import { describe, expect, it } from 'vitest'
import type { Artifact } from '../types/artifact'
import { EMPTY_FILTERS, filterArtifacts, getFacets, sortArtifacts } from './filter'

function artifact(overrides: Partial<Artifact>): Artifact {
  return {
    id: 'id',
    title: 'Title',
    description: 'Description',
    project: 'Project',
    category: 'Category',
    tags: [],
    path: 'path.html',
    createdAt: '2026-01-01',
    updatedAt: '2026-01-01',
    ...overrides,
  }
}

const permissionAudit = artifact({
  id: 'a1',
  title: 'Permission Audit',
  description: 'Reviews IAM roles and policies',
  project: 'Narya',
  category: 'Security',
  tags: ['iam', 'audit'],
  updatedAt: '2026-02-10',
})

const salesReport = artifact({
  id: 'a2',
  title: 'Sales Report',
  description: 'Quarterly sales breakdown',
  project: 'Narya',
  category: 'Finance',
  tags: ['sales'],
  updatedAt: '2026-03-01',
})

const networkScan = artifact({
  id: 'a3',
  title: 'network scan',
  description: 'Scan of internal network segments',
  project: 'Vilya',
  category: 'Security',
  tags: ['Network', 'Audit'],
  updatedAt: '2026-01-15',
})

const all = [permissionAudit, salesReport, networkScan]

describe('filterArtifacts', () => {
  it('matches everything with empty filters', () => {
    expect(filterArtifacts(all, EMPTY_FILTERS)).toEqual(all)
  })

  it('matches everything when the query is whitespace', () => {
    expect(filterArtifacts(all, { ...EMPTY_FILTERS, query: '   ' })).toEqual(all)
  })

  it('searches case-insensitively across title', () => {
    expect(filterArtifacts(all, { ...EMPTY_FILTERS, query: 'PERMISSION' })).toEqual([
      permissionAudit,
    ])
  })

  it('searches case-insensitively across description', () => {
    expect(filterArtifacts(all, { ...EMPTY_FILTERS, query: 'quarterly' })).toEqual([salesReport])
  })

  it('searches case-insensitively across project', () => {
    expect(filterArtifacts(all, { ...EMPTY_FILTERS, query: 'vilya' })).toEqual([networkScan])
  })

  it('searches case-insensitively across category', () => {
    expect(filterArtifacts(all, { ...EMPTY_FILTERS, query: 'FINANCE' })).toEqual([salesReport])
  })

  it('searches case-insensitively across tags', () => {
    expect(filterArtifacts(all, { ...EMPTY_FILTERS, query: 'SALES' })).toEqual([salesReport])
  })

  it('requires every term to match (AND) for multi-term queries', () => {
    expect(filterArtifacts(all, { ...EMPTY_FILTERS, query: 'network audit' })).toEqual([
      networkScan,
    ])
    expect(filterArtifacts(all, { ...EMPTY_FILTERS, query: 'network sales' })).toEqual([])
  })

  it('filters by exact project equality', () => {
    expect(filterArtifacts(all, { ...EMPTY_FILTERS, project: 'Narya' })).toEqual([
      permissionAudit,
      salesReport,
    ])
  })

  it('filters by exact category equality', () => {
    expect(filterArtifacts(all, { ...EMPTY_FILTERS, category: 'Security' })).toEqual([
      permissionAudit,
      networkScan,
    ])
  })

  it('filters by tag case-insensitively', () => {
    expect(filterArtifacts(all, { ...EMPTY_FILTERS, tag: 'AUDIT' })).toEqual([
      permissionAudit,
      networkScan,
    ])
  })

  it('combines project, category, and tag filters as an AND (Narya/Security/IAM example)', () => {
    expect(
      filterArtifacts(all, {
        ...EMPTY_FILTERS,
        project: 'Narya',
        category: 'Security',
        tag: 'IAM',
      }),
    ).toEqual([permissionAudit])
  })

  it('narrows results further with each additional active filter', () => {
    const byProject = filterArtifacts(all, { ...EMPTY_FILTERS, project: 'Narya' })
    expect(byProject).toHaveLength(2)

    const byProjectAndCategory = filterArtifacts(all, {
      ...EMPTY_FILTERS,
      project: 'Narya',
      category: 'Finance',
    })
    expect(byProjectAndCategory).toHaveLength(1)

    const byProjectCategoryAndTag = filterArtifacts(all, {
      ...EMPTY_FILTERS,
      project: 'Narya',
      category: 'Finance',
      tag: 'nonexistent',
    })
    expect(byProjectCategoryAndTag).toHaveLength(0)
  })
})

describe('sortArtifacts', () => {
  it('sorts by updatedAt descending', () => {
    expect(sortArtifacts(all, 'updated').map((a) => a.id)).toEqual(['a2', 'a1', 'a3'])
  })

  it('breaks updatedAt ties by title A-Z', () => {
    const tiedA = artifact({ id: 'tied-b', title: 'Beta', updatedAt: '2026-05-01' })
    const tiedB = artifact({ id: 'tied-a', title: 'Alpha', updatedAt: '2026-05-01' })
    expect(sortArtifacts([tiedA, tiedB], 'updated').map((a) => a.id)).toEqual([
      'tied-a',
      'tied-b',
    ])
  })

  it('sorts by title using locale-aware, case-insensitive, numeric comparison', () => {
    const item2 = artifact({ id: 'item2', title: 'Report 2' })
    const item10 = artifact({ id: 'item10', title: 'Report 10' })
    const lower = artifact({ id: 'lower', title: 'apple report' })
    const upper = artifact({ id: 'upper', title: 'Banana Report' })
    expect(sortArtifacts([item10, item2, upper, lower], 'title').map((a) => a.id)).toEqual([
      'lower',
      'upper',
      'item2',
      'item10',
    ])
  })

  it('does not mutate the input array', () => {
    const copy = [...all]
    sortArtifacts(all, 'title')
    expect(all).toEqual(copy)
  })
})

describe('getFacets', () => {
  it('counts and sorts projects, categories, and tags A-Z', () => {
    const facets = getFacets(all)

    expect(facets.projects).toEqual([
      { value: 'Narya', count: 2 },
      { value: 'Vilya', count: 1 },
    ])

    expect(facets.categories).toEqual([
      { value: 'Finance', count: 1 },
      { value: 'Security', count: 2 },
    ])
  })

  it('folds tag case for grouping and display', () => {
    const facets = getFacets(all)

    // "audit" and "Audit" fold into a single lowercase tag with combined count.
    expect(facets.tags).toEqual([
      { value: 'audit', count: 2 },
      { value: 'iam', count: 1 },
      { value: 'network', count: 1 },
      { value: 'sales', count: 1 },
    ])
  })
})
