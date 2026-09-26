import { useMemo, useSyncExternalStore } from 'react'

export type Route = { view: 'catalog' } | { view: 'artifact'; id: string }

const ARTIFACT_PREFIX = '#/artifact/'

export function parseHash(hash: string): Route {
  if (!hash.startsWith(ARTIFACT_PREFIX)) return { view: 'catalog' }
  const raw = hash.slice(ARTIFACT_PREFIX.length)
  if (raw === '') return { view: 'catalog' }
  let id: string
  try {
    id = decodeURIComponent(raw)
  } catch {
    id = raw
  }
  return { view: 'artifact', id }
}

export function artifactHref(id: string): string {
  return ARTIFACT_PREFIX + encodeURIComponent(id)
}

function subscribe(onChange: () => void): () => void {
  window.addEventListener('hashchange', onChange)
  return () => window.removeEventListener('hashchange', onChange)
}

function getHash(): string {
  return window.location.hash
}

export function useHashRoute(): Route {
  const hash = useSyncExternalStore(subscribe, getHash)
  return useMemo(() => parseHash(hash), [hash])
}
