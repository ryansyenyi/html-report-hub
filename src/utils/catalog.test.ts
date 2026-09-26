import { describe, expect, it, vi } from 'vitest'
import { artifactUrl, catalogUrl, parseCatalog } from './catalog'

const validEntry = {
  id: 'a1',
  title: 'Permission Audit',
  description: 'Audit of IAM permissions',
  project: 'Narya',
  category: 'Security',
  tags: ['iam', 'audit'],
  path: 'artifacts/narya/security/permission-audit.html',
  createdAt: '2026-01-01',
  updatedAt: '2026-01-02',
}

describe('parseCatalog', () => {
  it('returns artifacts for a valid catalog', () => {
    const result = parseCatalog({ artifacts: [validEntry] })
    expect(result).toEqual([validEntry])
  })

  it('throws when the top-level shape is wrong', () => {
    expect(() => parseCatalog(null)).toThrow(
      'artifacts.json must be an object with an "artifacts" array',
    )
    expect(() => parseCatalog({})).toThrow(
      'artifacts.json must be an object with an "artifacts" array',
    )
    expect(() => parseCatalog({ artifacts: 'not-an-array' })).toThrow(
      'artifacts.json must be an object with an "artifacts" array',
    )
    expect(() => parseCatalog([validEntry])).toThrow(
      'artifacts.json must be an object with an "artifacts" array',
    )
  })

  it('skips an entry missing a required string field and warns', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const { title: _title, ...missingTitle } = validEntry
    const result = parseCatalog({ artifacts: [missingTitle, validEntry] })
    expect(result).toEqual([validEntry])
    expect(warn).toHaveBeenCalledTimes(1)
    expect(warn.mock.calls[0][0]).toContain('index 0')
    warn.mockRestore()
  })

  it('skips an entry with non-string-array tags and warns', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const badTags = { ...validEntry, tags: ['ok', 5] }
    const result = parseCatalog({ artifacts: [badTags] })
    expect(result).toEqual([])
    expect(warn).toHaveBeenCalledTimes(1)
    warn.mockRestore()
  })

  it('skips a duplicate id and warns', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const duplicate = { ...validEntry, title: 'Second entry with same id' }
    const result = parseCatalog({ artifacts: [validEntry, duplicate] })
    expect(result).toEqual([validEntry])
    expect(warn).toHaveBeenCalledTimes(1)
    expect(warn.mock.calls[0][0]).toContain('duplicate id')
    warn.mockRestore()
  })

  it('allows an empty description and empty tags array', () => {
    const entry = { ...validEntry, description: '', tags: [] }
    const result = parseCatalog({ artifacts: [entry] })
    expect(result).toEqual([entry])
  })

  describe('path safety pattern', () => {
    // Same cases as scripts/validate-artifacts.test.mjs's "path safety pattern" describe block.
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
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
      const entry = { ...validEntry, path: entryPath }
      const result = parseCatalog({ artifacts: [entry] })
      if (valid) {
        expect(result).toEqual([entry])
        expect(warn).not.toHaveBeenCalled()
      } else {
        expect(result).toEqual([])
        expect(warn).toHaveBeenCalledTimes(1)
        expect(warn.mock.calls[0][0]).toContain('invalid "path"')
      }
      warn.mockRestore()
    })
  })
})

describe('artifactUrl', () => {
  it('joins a base and path', () => {
    expect(artifactUrl('artifacts/narya/security/permission-audit.html', '/html-report-hub/')).toBe(
      '/html-report-hub/artifacts/narya/security/permission-audit.html',
    )
  })

  it('works with a root base', () => {
    expect(artifactUrl('artifacts/foo.html', '/')).toBe('/artifacts/foo.html')
  })

  it('strips leading slashes from the path', () => {
    expect(artifactUrl('/artifacts/foo.html', '/html-report-hub/')).toBe(
      '/html-report-hub/artifacts/foo.html',
    )
  })
})

describe('catalogUrl', () => {
  it('appends artifacts.json to the base', () => {
    expect(catalogUrl('/html-report-hub/')).toBe('/html-report-hub/artifacts.json')
    expect(catalogUrl('/')).toBe('/artifacts.json')
  })
})
