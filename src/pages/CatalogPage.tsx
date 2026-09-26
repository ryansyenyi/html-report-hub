import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { ArtifactCard } from '../components/ArtifactCard'
import { Sidebar } from '../components/Sidebar'
import { StatusMessage } from '../components/StatusMessage'
import type { Artifact } from '../types/artifact'
import { EMPTY_FILTERS, filterArtifacts, getFacets, sortArtifacts } from '../utils/filter'
import type { Filters, SortKey } from '../utils/filter'
import type { CatalogState } from '../utils/useCatalog'

interface CatalogPageProps {
  catalog: CatalogState
  onRetry: () => void
  filters: Filters
  onFiltersChange: (filters: Filters) => void
  sort: SortKey
  onSortChange: (sort: SortKey) => void
  /** Last scroll position of the catalog, kept fresh by App across the round-trip through the viewer. */
  scrollRestoreRef: { current: number }
}

const SIDEBAR_ID = 'catalog-filters'

function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  return (
    target.isContentEditable ||
    target instanceof HTMLInputElement ||
    target instanceof HTMLSelectElement ||
    target instanceof HTMLTextAreaElement
  )
}

export function CatalogPage({
  catalog,
  onRetry,
  filters,
  onFiltersChange,
  sort,
  onSortChange,
  scrollRestoreRef,
}: CatalogPageProps) {
  const searchRef = useRef<HTMLInputElement>(null)

  // Restore the catalog's previous scroll position once, right after mount (cards render
  // synchronously in the same commit whenever the catalog is already loaded, which is always
  // the case on a return trip from the viewer). Before paint, so there's no visible jump.
  // On first load scrollRestoreRef.current is still 0, so this is a no-op and stays at top.
  useLayoutEffect(() => {
    window.scrollTo(0, scrollRestoreRef.current)
  }, [scrollRestoreRef])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== '/' || event.ctrlKey || event.metaKey || event.altKey) return
      if (isTypingTarget(event.target)) return
      event.preventDefault()
      searchRef.current?.focus()
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [])

  return (
    <div className="catalog">
      <header className="app-header">
        <a className="wordmark" href="#/">
          Report Hub
        </a>
        <input
          ref={searchRef}
          className="search"
          type="search"
          aria-label="Search artifacts"
          placeholder="Search  ( / )"
          value={filters.query}
          onChange={(event) => onFiltersChange({ ...filters, query: event.target.value })}
        />
      </header>
      {catalog.status === 'loading' && (
        <main className="catalog-main is-message">
          <StatusMessage role="status" title="Loading catalog…" />
        </main>
      )}
      {catalog.status === 'error' && (
        <main className="catalog-main is-message">
          <StatusMessage
            role="alert"
            title="Could not load the catalog"
            detail={catalog.message}
            action={
              <button type="button" className="button" onClick={onRetry}>
                Retry
              </button>
            }
          />
        </main>
      )}
      {catalog.status === 'ready' && catalog.artifacts.length === 0 && (
        <main className="catalog-main is-message">
          <StatusMessage
            title="No artifacts yet"
            detail={
              <>
                Drop an HTML report into <code>public/artifacts/…</code> and register it in{' '}
                <code>public/artifacts.json</code>.
              </>
            }
          />
        </main>
      )}
      {catalog.status === 'ready' && catalog.artifacts.length > 0 && (
        <CatalogResults
          artifacts={catalog.artifacts}
          filters={filters}
          onFiltersChange={onFiltersChange}
          sort={sort}
          onSortChange={onSortChange}
        />
      )}
    </div>
  )
}

interface CatalogResultsProps {
  artifacts: Artifact[]
  filters: Filters
  onFiltersChange: (filters: Filters) => void
  sort: SortKey
  onSortChange: (sort: SortKey) => void
}

function CatalogResults({ artifacts, filters, onFiltersChange, sort, onSortChange }: CatalogResultsProps) {
  const [filtersOpen, setFiltersOpen] = useState(false)
  const facets = useMemo(() => getFacets(artifacts), [artifacts])
  const results = useMemo(
    () => sortArtifacts(filterArtifacts(artifacts, filters), sort),
    [artifacts, filters, sort],
  )

  const chips: { label: string; clear: Partial<Filters> }[] = []
  if (filters.query.trim() !== '') chips.push({ label: `Search: “${filters.query.trim()}”`, clear: { query: '' } })
  if (filters.project !== null) chips.push({ label: `Project: ${filters.project}`, clear: { project: null } })
  if (filters.category !== null) chips.push({ label: `Category: ${filters.category}`, clear: { category: null } })
  if (filters.tag !== null) chips.push({ label: `Tag: ${filters.tag}`, clear: { tag: null } })
  const facetFilterCount = [filters.project, filters.category, filters.tag].filter((v) => v !== null).length

  const clearAll = () => onFiltersChange(EMPTY_FILTERS)

  return (
    <main className="catalog-main">
      <div className="toolbar">
        <button
          type="button"
          className="button filters-toggle"
          aria-expanded={filtersOpen}
          aria-controls={SIDEBAR_ID}
          onClick={() => setFiltersOpen((open) => !open)}
        >
          Filters{facetFilterCount > 0 ? ` (${facetFilterCount})` : ''}
        </button>
        <p className="result-count" aria-live="polite">
          {results.length} of {artifacts.length} artifacts
        </p>
        {chips.length > 0 && (
          <ul className="chips" aria-label="Active filters">
            {chips.map((chip) => (
              <li key={chip.label}>
                <button
                  type="button"
                  className="chip"
                  aria-label={`Remove filter ${chip.label}`}
                  onClick={() => onFiltersChange({ ...filters, ...chip.clear })}
                >
                  {chip.label} <span aria-hidden="true">×</span>
                </button>
              </li>
            ))}
          </ul>
        )}
        {chips.length > 0 && (
          <button type="button" className="link-button" onClick={clearAll}>
            Clear all
          </button>
        )}
        <label className="sort">
          <span className="sort-label">Sort</span>
          <select value={sort} onChange={(event) => onSortChange(event.target.value as SortKey)}>
            <option value="updated">Recently updated</option>
            <option value="title">Title A–Z</option>
          </select>
        </label>
      </div>
      <Sidebar
        id={SIDEBAR_ID}
        open={filtersOpen}
        total={artifacts.length}
        facets={facets}
        filters={filters}
        onFiltersChange={onFiltersChange}
      />
      <div className="results">
        {results.length === 0 ? (
          <StatusMessage
            title="No artifacts match"
            detail="Try a different search or remove some filters."
            action={
              <button type="button" className="button" onClick={clearAll}>
                Clear filters
              </button>
            }
          />
        ) : (
          <ul className="card-grid">
            {results.map((artifact) => (
              <li key={artifact.id}>
                <ArtifactCard artifact={artifact} />
              </li>
            ))}
          </ul>
        )}
      </div>
    </main>
  )
}
