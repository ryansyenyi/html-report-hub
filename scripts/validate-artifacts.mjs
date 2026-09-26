#!/usr/bin/env node
// Build-time validator for public/artifacts.json.
// Plain ESM, Node built-ins only — no dependencies.

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const REQUIRED_STRING_FIELDS = [
  'id',
  'title',
  'project',
  'category',
  'path',
  'createdAt',
  'updatedAt',
]

const ID_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/
const DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/
// Path safety: a path must match this pattern AND contain no ".." segment and no "//".
// Keep this regex literal identical to PATH_PATTERN in src/utils/catalog.ts.
const PATH_PATTERN = /^artifacts\/[A-Za-z0-9._/-]+\.html$/

function entryLabel(entry, index) {
  const id = typeof entry?.id === 'string' && entry.id.length > 0 ? entry.id : null
  return id ? `artifacts[${index}] (id: ${id})` : `artifacts[${index}]`
}

function isValidDateString(value) {
  const match = DATE_PATTERN.exec(value)
  if (!match) return false
  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  if (month < 1 || month > 12) return false
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate()
  return day >= 1 && day <= daysInMonth
}

function isStringArray(value) {
  return Array.isArray(value) && value.every((item) => typeof item === 'string')
}

function collectHtmlFiles(dir, base = dir) {
  const results = []
  let entries
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true })
  } catch {
    return results
  }
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      results.push(...collectHtmlFiles(fullPath, base))
    } else if (entry.isFile() && entry.name.endsWith('.html')) {
      results.push(path.relative(base, fullPath).split(path.sep).join('/'))
    }
  }
  return results
}

/**
 * Validate a parsed artifacts.json catalog.
 * @param {unknown} data - parsed JSON content of artifacts.json
 * @param {string} publicDir - absolute path to the `public/` directory (paths are resolved against it)
 * @returns {{ errors: string[], warnings: string[] }}
 */
export function validateCatalog(data, publicDir) {
  const errors = []
  const warnings = []

  if (
    typeof data !== 'object' ||
    data === null ||
    Array.isArray(data) ||
    !Array.isArray(data.artifacts)
  ) {
    errors.push('top-level value must be an object of the form { artifacts: [...] }')
    return { errors, warnings }
  }

  const artifacts = data.artifacts
  const seenIds = new Set()
  const seenPaths = new Set()
  const registeredPaths = new Set()

  artifacts.forEach((entry, index) => {
    if (typeof entry !== 'object' || entry === null || Array.isArray(entry)) {
      errors.push(`artifacts[${index}] is not an object`)
      return
    }

    const label = entryLabel(entry, index)

    for (const field of REQUIRED_STRING_FIELDS) {
      if (typeof entry[field] !== 'string' || entry[field].length === 0) {
        errors.push(`${label}: missing or non-string field "${field}"`)
      }
    }

    if (typeof entry.description !== 'string') {
      errors.push(`${label}: missing or non-string field "description"`)
    }

    if (!isStringArray(entry.tags)) {
      errors.push(`${label}: "tags" must be an array of strings`)
    } else {
      const seenTags = new Set()
      for (const tag of entry.tags) {
        const key = tag.toLowerCase()
        if (seenTags.has(key)) {
          errors.push(`${label}: duplicate tag "${tag}" (case-insensitive)`)
        } else {
          seenTags.add(key)
        }
      }
    }

    if (typeof entry.id === 'string' && entry.id.length > 0) {
      if (!ID_PATTERN.test(entry.id)) {
        errors.push(`${label}: "id" must match ${ID_PATTERN}`)
      } else if (seenIds.has(entry.id)) {
        errors.push(`${label}: duplicate id "${entry.id}"`)
      } else {
        seenIds.add(entry.id)
      }
    }

    const createdAt = entry.createdAt
    const updatedAt = entry.updatedAt
    const createdValid = typeof createdAt === 'string' && isValidDateString(createdAt)
    const updatedValid = typeof updatedAt === 'string' && isValidDateString(updatedAt)

    if (typeof createdAt === 'string' && createdAt.length > 0 && !createdValid) {
      errors.push(`${label}: "createdAt" must be a valid YYYY-MM-DD date`)
    }
    if (typeof updatedAt === 'string' && updatedAt.length > 0 && !updatedValid) {
      errors.push(`${label}: "updatedAt" must be a valid YYYY-MM-DD date`)
    }
    if (createdValid && updatedValid && updatedAt < createdAt) {
      errors.push(`${label}: "updatedAt" (${updatedAt}) is before "createdAt" (${createdAt})`)
    }

    if (typeof entry.path === 'string' && entry.path.length > 0) {
      const entryPath = entry.path
      const pathIssues = []
      if (!entryPath.startsWith('artifacts/')) pathIssues.push('must start with "artifacts/"')
      if (entryPath.includes('..')) pathIssues.push('must not contain ".."')
      if (entryPath.includes('//')) pathIssues.push('must not contain "//"')
      if (entryPath.includes('\\')) pathIssues.push('must not contain a backslash')
      if (entryPath.startsWith('/')) pathIssues.push('must not have a leading "/"')
      if (!entryPath.endsWith('.html')) pathIssues.push('must end with ".html"')
      if (!PATH_PATTERN.test(entryPath)) {
        pathIssues.push(
          'must contain only letters, numbers, ".", "_", "-", and "/" (no spaces, "#", "%", "?", or other non-ASCII/control characters)',
        )
      }

      if (pathIssues.length > 0) {
        errors.push(`${label}: invalid "path" "${entryPath}" (${pathIssues.join('; ')})`)
      } else {
        if (seenPaths.has(entryPath)) {
          errors.push(`${label}: duplicate path "${entryPath}"`)
        } else {
          seenPaths.add(entryPath)
        }
        registeredPaths.add(entryPath)

        const absolutePath = path.join(publicDir, entryPath)
        if (!fs.existsSync(absolutePath) || !fs.statSync(absolutePath).isFile()) {
          errors.push(`${label}: file not found at "${entryPath}"`)
        }
      }
    }
  })

  const artifactsDir = path.join(publicDir, 'artifacts')
  const htmlFiles = collectHtmlFiles(artifactsDir).map((relPath) => `artifacts/${relPath}`)
  for (const filePath of htmlFiles) {
    if (!registeredPaths.has(filePath)) {
      warnings.push(`orphan artifact file not registered in catalog: ${filePath}`)
    }
  }

  return { errors, warnings }
}

async function main() {
  const scriptDir = path.dirname(fileURLToPath(import.meta.url))
  const repoRoot = path.resolve(scriptDir, '..')
  const publicDir = path.join(repoRoot, 'public')
  const catalogPath = path.join(publicDir, 'artifacts.json')

  let raw
  try {
    raw = fs.readFileSync(catalogPath, 'utf8')
  } catch (err) {
    console.error(`error: could not read ${catalogPath}: ${err.message}`)
    process.exit(1)
    return
  }

  let data
  try {
    data = JSON.parse(raw)
  } catch (err) {
    console.error(`error: ${catalogPath} is not valid JSON: ${err.message}`)
    process.exit(1)
    return
  }

  const { errors, warnings } = validateCatalog(data, publicDir)

  for (const warning of warnings) {
    console.warn(`warning: ${warning}`)
  }
  for (const error of errors) {
    console.error(`error: ${error}`)
  }

  if (errors.length > 0) {
    process.exit(1)
  }

  const count = Array.isArray(data.artifacts) ? data.artifacts.length : 0
  console.log(`artifacts.json OK (${count} artifacts)`)
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  main()
}
