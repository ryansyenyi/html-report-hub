import { describe, expect, it } from 'vitest'
import { artifactHref, parseHash } from './useHashRoute'

describe('parseHash', () => {
  it('returns the catalog view for an empty hash', () => {
    expect(parseHash('')).toEqual({ view: 'catalog' })
    expect(parseHash('#')).toEqual({ view: 'catalog' })
    expect(parseHash('#/')).toEqual({ view: 'catalog' })
  })

  it('returns the artifact view with the id for #/artifact/<id>', () => {
    expect(parseHash('#/artifact/narya-security-audit')).toEqual({
      view: 'artifact',
      id: 'narya-security-audit',
    })
  })

  it('URI-decodes the id', () => {
    expect(parseHash('#/artifact/a%20b%2Fc')).toEqual({ view: 'artifact', id: 'a b/c' })
  })

  it('keeps the raw id when it is not valid URI encoding', () => {
    expect(parseHash('#/artifact/bad%E0%A4%A')).toEqual({ view: 'artifact', id: 'bad%E0%A4%A' })
  })

  it('returns the catalog view for an artifact route without an id', () => {
    expect(parseHash('#/artifact/')).toEqual({ view: 'catalog' })
    expect(parseHash('#/artifact')).toEqual({ view: 'catalog' })
  })

  it('returns the catalog view for unknown routes', () => {
    expect(parseHash('#/something/else')).toEqual({ view: 'catalog' })
    expect(parseHash('#artifact/x')).toEqual({ view: 'catalog' })
  })
})

describe('artifactHref', () => {
  it('builds an encoded hash link', () => {
    expect(artifactHref('plain-id')).toBe('#/artifact/plain-id')
    expect(artifactHref('a b/c')).toBe('#/artifact/a%20b%2Fc')
  })

  it('round-trips through parseHash', () => {
    const id = 'weird id/with?chars#and%'
    expect(parseHash(artifactHref(id))).toEqual({ view: 'artifact', id })
  })
})
