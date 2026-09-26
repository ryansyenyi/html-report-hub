import { describe, expect, it, vi } from 'vitest'
import { loadCatalog } from './useCatalog'

const entry = {
  id: 'a',
  title: 'A',
  description: 'd',
  project: 'P',
  category: 'C',
  tags: ['t'],
  path: 'artifacts/a.html',
  createdAt: '2026-01-01',
  updatedAt: '2026-01-02',
}

function fakeFetch(response: Response | Error): typeof fetch {
  return vi.fn(async () => {
    if (response instanceof Error) throw response
    return response
  }) as unknown as typeof fetch
}

describe('loadCatalog', () => {
  it('fetches the url without cache reuse and returns parsed artifacts', async () => {
    const fetchImpl = fakeFetch(new Response(JSON.stringify({ artifacts: [entry] })))
    await expect(loadCatalog('/base/artifacts.json', fetchImpl)).resolves.toEqual([entry])
    expect(fetchImpl).toHaveBeenCalledWith('/base/artifacts.json', { cache: 'no-cache' })
  })

  it('reports non-OK responses with the HTTP status', async () => {
    const fetchImpl = fakeFetch(new Response('nope', { status: 404, statusText: 'Not Found' }))
    await expect(loadCatalog('x', fetchImpl)).rejects.toThrow(/HTTP 404/)
  })

  it('reports network failures', async () => {
    const fetchImpl = fakeFetch(new TypeError('Failed to fetch'))
    await expect(loadCatalog('x', fetchImpl)).rejects.toThrow(/Network error.*Failed to fetch/)
  })

  it('reports invalid JSON', async () => {
    const fetchImpl = fakeFetch(new Response('{not json'))
    await expect(loadCatalog('x', fetchImpl)).rejects.toThrow(/not valid JSON/)
  })

  it('reports a bad catalog shape', async () => {
    const fetchImpl = fakeFetch(new Response(JSON.stringify({ items: [] })))
    await expect(loadCatalog('x', fetchImpl)).rejects.toThrow(/"artifacts" array/)
  })
})
