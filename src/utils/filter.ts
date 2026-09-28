import type { Artifact } from '../types/artifact'

export interface Filters {
  query: string
  project: string | null
  category: string | null
  tag: string | null
}

export const EMPTY_FILTERS: Filters = {
  query: '',
  project: null,
  category: null,
  tag: null,
}

export type SortKey = 'updated' | 'title'

function titleCompare(a: Artifact, b: Artifact): number {
  return a.title.localeCompare(b.title, undefined, { sensitivity: 'base', numeric: true })
}

function matchesQuery(artifact: Artifact, query: string): boolean {
  const terms = query.trim().toLowerCase().split(/\s+/).filter(Boolean)
  if (terms.length === 0) return true

  const haystack = [
    artifact.title,
    artifact.description,
    artifact.project,
    artifact.category,
    ...artifact.tags,
  ]
    .join(' ')
    .toLowerCase()

  return terms.every((term) => haystack.includes(term))
}

export function filterArtifacts(artifacts: Artifact[], filters: Filters): Artifact[] {
  return artifacts.filter((artifact) => {
    if (filters.project !== null && artifact.project !== filters.project) return false
    if (filters.category !== null && artifact.category !== filters.category) return false
    if (
      filters.tag !== null &&
      !artifact.tags.some((tag) => tag.toLowerCase() === filters.tag!.toLowerCase())
    ) {
      return false
    }
    if (!matchesQuery(artifact, filters.query)) return false
    return true
  })
}

export function sortArtifacts(artifacts: Artifact[], key: SortKey): Artifact[] {
  const copy = [...artifacts]
  if (key === 'title') {
    copy.sort(titleCompare)
    return copy
  }

  copy.sort((a, b) => {
    if (a.updatedAt !== b.updatedAt) {
      return a.updatedAt < b.updatedAt ? 1 : -1
    }
    return titleCompare(a, b)
  })
  return copy
}

export interface CategoryGroup {
  category: string
  artifacts: Artifact[]
}

export function groupByCategory(artifacts: Artifact[]): CategoryGroup[] {
  const groups = new Map<string, Artifact[]>()
  for (const artifact of artifacts) {
    const group = groups.get(artifact.category)
    if (group) {
      group.push(artifact)
    } else {
      groups.set(artifact.category, [artifact])
    }
  }
  return [...groups.entries()]
    .map(([category, groupArtifacts]) => ({ category, artifacts: groupArtifacts }))
    .sort((a, b) => a.category.localeCompare(b.category, undefined, { sensitivity: 'base', numeric: true }))
}

export interface FacetCount {
  value: string
  count: number
}

function toFacetCounts(values: string[]): FacetCount[] {
  const counts = new Map<string, number>()
  for (const value of values) {
    counts.set(value, (counts.get(value) ?? 0) + 1)
  }
  return [...counts.entries()]
    .map(([value, count]) => ({ value, count }))
    .sort((a, b) => a.value.localeCompare(b.value, undefined, { sensitivity: 'base' }))
}

export function getFacets(artifacts: Artifact[]): {
  projects: FacetCount[]
  categories: FacetCount[]
  tags: FacetCount[]
} {
  return {
    projects: toFacetCounts(artifacts.map((a) => a.project)),
    categories: toFacetCounts(artifacts.map((a) => a.category)),
    tags: toFacetCounts(artifacts.flatMap((a) => a.tags.map((tag) => tag.toLowerCase()))),
  }
}
