import { useCallback, useEffect, useState } from 'react'
import type { Artifact } from '../types/artifact'
import { catalogUrl, parseCatalog } from './catalog'

export type CatalogState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; artifacts: Artifact[] }

function errorText(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

/** Fetches and parses the catalog; every failure becomes an Error with a human-readable message. */
export async function loadCatalog(url: string, fetchImpl: typeof fetch = fetch): Promise<Artifact[]> {
  let response: Response
  try {
    response = await fetchImpl(url, { cache: 'no-cache' })
  } catch (error) {
    throw new Error(`Network error while loading the catalog: ${errorText(error)}`)
  }
  if (!response.ok) {
    const statusText = response.statusText ? ` ${response.statusText}` : ''
    throw new Error(`Could not load the catalog (HTTP ${response.status}${statusText}).`)
  }
  let data: unknown
  try {
    data = await response.json()
  } catch {
    throw new Error('The catalog file is not valid JSON.')
  }
  try {
    return parseCatalog(data)
  } catch (error) {
    throw new Error(`The catalog is malformed: ${errorText(error)}`)
  }
}

export function useCatalog(): CatalogState & { reload: () => void } {
  const [state, setState] = useState<CatalogState>({ status: 'loading' })
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    let active = true
    loadCatalog(catalogUrl()).then(
      (artifacts) => {
        if (active) setState({ status: 'ready', artifacts })
      },
      (error: unknown) => {
        if (active) setState({ status: 'error', message: errorText(error) })
      },
    )
    return () => {
      active = false
    }
  }, [attempt])

  const reload = useCallback(() => {
    setState({ status: 'loading' })
    setAttempt((n) => n + 1)
  }, [])

  return { ...state, reload }
}
