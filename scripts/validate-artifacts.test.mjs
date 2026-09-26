import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { validateCatalog } from './validate-artifacts.mjs'

let tmpDir

function writeArtifactFile(relPath) {
  const absolutePath = path.join(tmpDir, relPath)
  fs.mkdirSync(path.dirname(absolutePath), { recursive: true })
  fs.writeFileSync(absolutePath, '<!doctype html><title>fixture</title>')
}

function baseEntry(overrides = {}) {
  return {
    id: 'sample-report',
    title: 'Sample Report',
    description: 'A sample report for tests.',
    project: 'Narya',
    category: 'Dashboard',
    tags: ['sample', 'test'],
    path: 'artifacts/sample.html',
    createdAt: '2026-08-01',
    updatedAt: '2026-08-15',
    ...overrides,
  }
}

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'artifacts-validate-'))
  writeArtifactFile('artifacts/sample.html')
})

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true })
})

describe('validateCatalog', () => {
  it('accepts a valid catalog with no errors or warnings', () => {
    const result = validateCatalog({ artifacts: [baseEntry()] }, tmpDir)
    expect(result.errors).toEqual([])
    expect(result.warnings).toEqual([])
  })

  it('errors when the top-level value is not { artifacts: [...] }', () => {
    expect(validateCatalog(null, tmpDir).errors.length).toBeGreaterThan(0)
    expect(validateCatalog({}, tmpDir).errors.length).toBeGreaterThan(0)
    expect(validateCatalog({ artifacts: 'nope' }, tmpDir).errors.length).toBeGreaterThan(0)
    expect(validateCatalog([], tmpDir).errors.length).toBeGreaterThan(0)
  })

  it('errors when an entry is not an object', () => {
    const result = validateCatalog({ artifacts: ['not-an-object'] }, tmpDir)
    expect(result.errors.some((e) => e.includes('not an object'))).toBe(true)
  })

  it('errors on a missing required field', () => {
    const entry = baseEntry()
    delete entry.title
    const result = validateCatalog({ artifacts: [entry] }, tmpDir)
    expect(result.errors.some((e) => e.includes('"title"'))).toBe(true)
  })

  it('errors on a non-string required field', () => {
    const result = validateCatalog({ artifacts: [baseEntry({ project: 42 })] }, tmpDir)
    expect(result.errors.some((e) => e.includes('"project"'))).toBe(true)
  })

  it('allows an empty description but errors on a non-string description', () => {
    const okResult = validateCatalog({ artifacts: [baseEntry({ description: '' })] }, tmpDir)
    expect(okResult.errors).toEqual([])

    const badResult = validateCatalog({ artifacts: [baseEntry({ description: 42 })] }, tmpDir)
    expect(badResult.errors.some((e) => e.includes('"description"'))).toBe(true)
  })

  it('errors when tags is not an array of strings', () => {
    const result = validateCatalog({ artifacts: [baseEntry({ tags: ['ok', 5] })] }, tmpDir)
    expect(result.errors.some((e) => e.includes('"tags"'))).toBe(true)
  })

  it('errors on a badly formatted id', () => {
    const result = validateCatalog({ artifacts: [baseEntry({ id: 'Not_Valid!' })] }, tmpDir)
    expect(result.errors.some((e) => e.includes('"id"'))).toBe(true)
  })

  it('errors on a duplicate id', () => {
    const result = validateCatalog(
      {
        artifacts: [
          baseEntry({ path: 'artifacts/sample.html' }),
          baseEntry({ path: 'artifacts/sample.html' }),
        ],
      },
      tmpDir,
    )
    expect(result.errors.some((e) => e.includes('duplicate id'))).toBe(true)
  })

  it('errors on a duplicate path', () => {
    writeArtifactFile('artifacts/second.html')
    const result = validateCatalog(
      {
        artifacts: [
          baseEntry({ id: 'first-report', path: 'artifacts/sample.html' }),
          baseEntry({ id: 'second-report', path: 'artifacts/sample.html' }),
        ],
      },
      tmpDir,
    )
    expect(result.errors.some((e) => e.includes('duplicate path'))).toBe(true)
  })

  it('errors on a malformed date string', () => {
    const result = validateCatalog({ artifacts: [baseEntry({ createdAt: '2026/08/01' })] }, tmpDir)
    expect(result.errors.some((e) => e.includes('"createdAt"'))).toBe(true)
  })

  it('errors on a date that is not real', () => {
    const result = validateCatalog({ artifacts: [baseEntry({ updatedAt: '2026-02-30' })] }, tmpDir)
    expect(result.errors.some((e) => e.includes('"updatedAt"'))).toBe(true)
  })

  it('errors when updatedAt is before createdAt', () => {
    const result = validateCatalog(
      { artifacts: [baseEntry({ createdAt: '2026-08-15', updatedAt: '2026-08-01' })] },
      tmpDir,
    )
    expect(result.errors.some((e) => e.includes('is before'))).toBe(true)
  })

  it('errors on a path that does not start with "artifacts/"', () => {
    const result = validateCatalog({ artifacts: [baseEntry({ path: 'public/sample.html' })] }, tmpDir)
    expect(result.errors.some((e) => e.includes('invalid "path"'))).toBe(true)
  })

  it('errors on a path traversal attempt', () => {
    const result = validateCatalog(
      { artifacts: [baseEntry({ path: 'artifacts/../secrets.html' })] },
      tmpDir,
    )
    expect(result.errors.some((e) => e.includes('invalid "path"'))).toBe(true)
  })

  it('errors on a path containing a backslash', () => {
    const result = validateCatalog(
      { artifacts: [baseEntry({ path: 'artifacts\\sample.html' })] },
      tmpDir,
    )
    expect(result.errors.some((e) => e.includes('invalid "path"'))).toBe(true)
  })

  it('errors on a path with a leading slash', () => {
    const result = validateCatalog(
      { artifacts: [baseEntry({ path: '/artifacts/sample.html' })] },
      tmpDir,
    )
    expect(result.errors.some((e) => e.includes('invalid "path"'))).toBe(true)
  })

  it('errors on a path that does not end with ".html"', () => {
    const result = validateCatalog({ artifacts: [baseEntry({ path: 'artifacts/sample.htm' })] }, tmpDir)
    expect(result.errors.some((e) => e.includes('invalid "path"'))).toBe(true)
  })

  it('errors when the referenced file does not exist', () => {
    const result = validateCatalog(
      { artifacts: [baseEntry({ path: 'artifacts/missing.html' })] },
      tmpDir,
    )
    expect(result.errors.some((e) => e.includes('file not found'))).toBe(true)
  })

  it('warns about an orphan html file not registered in the catalog', () => {
    writeArtifactFile('artifacts/orphan.html')
    const result = validateCatalog({ artifacts: [baseEntry()] }, tmpDir)
    expect(result.errors).toEqual([])
    expect(result.warnings.some((w) => w.includes('artifacts/orphan.html'))).toBe(true)
  })

  it('errors on duplicate tags compared case-insensitively', () => {
    const result = validateCatalog({ artifacts: [baseEntry({ tags: ['iam', 'IAM'] })] }, tmpDir)
    expect(result.errors.some((e) => e.includes('duplicate tag'))).toBe(true)
  })

  it('allows tags that are merely similar, not duplicates', () => {
    const result = validateCatalog({ artifacts: [baseEntry({ tags: ['iam', 'iam-audit'] })] }, tmpDir)
    expect(result.errors).toEqual([])
  })

  describe('path safety pattern', () => {
    // Same cases as src/utils/catalog.test.ts's "path safety pattern" describe block.
    const cases = [
      { path: 'artifacts/narya/security/permission-audit.html', valid: true },
      { path: 'artifacts/a#b.html', valid: false },
      { path: 'artifacts/a b.html', valid: false },
      { path: 'artifacts/a%20b.html', valid: false },
      { path: '\\\\evil.com/x.html', valid: false },
      { path: '\t/evil.com/x.html', valid: false },
      { path: 'javascript:alert(1)', valid: false },
      { path: 'artifacts/../x.html', valid: false },
      { path: 'artifacts//x.html', valid: false },
      { path: 'artifacts/x.htm', valid: false },
    ]

    it.each(cases)('path $path is valid: $valid', ({ path: entryPath, valid }) => {
      if (valid) writeArtifactFile(entryPath)
      const result = validateCatalog({ artifacts: [baseEntry({ path: entryPath })] }, tmpDir)
      if (valid) {
        expect(result.errors).toEqual([])
      } else {
        expect(result.errors.some((e) => e.includes('invalid "path"'))).toBe(true)
      }
    })
  })
})
