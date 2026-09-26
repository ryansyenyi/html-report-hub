import type { Artifact } from '../types/artifact'

const REQUIRED_STRING_FIELDS = [
  'id',
  'title',
  'description',
  'project',
  'category',
  'path',
  'createdAt',
  'updatedAt',
] as const

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'string')
}

// Path safety: a path must match this pattern AND contain no ".." segment and no "//".
// Keep this regex literal identical to PATH_PATTERN in scripts/validate-artifacts.mjs.
const PATH_PATTERN = /^artifacts\/[A-Za-z0-9._/-]+\.html$/

function isValidPath(value: string): boolean {
  return PATH_PATTERN.test(value) && !value.includes('..') && !value.includes('//')
}

function describeEntry(entry: Record<string, unknown>, index: number): string {
  const id = typeof entry.id === 'string' ? entry.id : '<unknown id>'
  return `index ${index} (id: ${id})`
}

export function parseCatalog(data: unknown): Artifact[] {
  if (
    typeof data !== 'object' ||
    data === null ||
    !('artifacts' in data) ||
    !Array.isArray((data as { artifacts: unknown }).artifacts)
  ) {
    throw new Error('artifacts.json must be an object with an "artifacts" array')
  }

  const rawArtifacts = (data as { artifacts: unknown[] }).artifacts
  const seenIds = new Set<string>()
  const artifacts: Artifact[] = []

  rawArtifacts.forEach((raw, index) => {
    if (typeof raw !== 'object' || raw === null) {
      console.warn(`Skipping catalog entry at index ${index}: not an object`)
      return
    }

    const entry = raw as Record<string, unknown>

    for (const field of REQUIRED_STRING_FIELDS) {
      if (typeof entry[field] !== 'string') {
        console.warn(
          `Skipping catalog entry ${describeEntry(entry, index)}: missing or non-string field "${field}"`,
        )
        return
      }
    }

    if (!isStringArray(entry.tags)) {
      console.warn(
        `Skipping catalog entry ${describeEntry(entry, index)}: "tags" must be a string array`,
      )
      return
    }

    if (!isValidPath(entry.path as string)) {
      console.warn(`Skipping catalog entry ${describeEntry(entry, index)}: invalid "path"`)
      return
    }

    const id = entry.id as string
    if (seenIds.has(id)) {
      console.warn(`Skipping catalog entry ${describeEntry(entry, index)}: duplicate id`)
      return
    }
    seenIds.add(id)

    artifacts.push({
      id,
      title: entry.title as string,
      description: entry.description as string,
      project: entry.project as string,
      category: entry.category as string,
      tags: entry.tags as string[],
      path: entry.path as string,
      createdAt: entry.createdAt as string,
      updatedAt: entry.updatedAt as string,
    })
  })

  return artifacts
}

export function artifactUrl(path: string, base: string = import.meta.env.BASE_URL): string {
  return base + path.replace(/^\/+/, '')
}

export function catalogUrl(base: string = import.meta.env.BASE_URL): string {
  return base + 'artifacts.json'
}
