import { useEffect, useState } from 'react'
import { StatusMessage } from './components/StatusMessage'
import { CatalogPage } from './pages/CatalogPage'
import { ViewerPage } from './pages/ViewerPage'
import { EMPTY_FILTERS } from './utils/filter'
import type { Filters, SortKey } from './utils/filter'
import { useCatalog } from './utils/useCatalog'
import { useHashRoute } from './utils/useHashRoute'

const APP_NAME = 'Report Hub'

export function App() {
  const catalog = useCatalog()
  const route = useHashRoute()
  // Owned here (not in CatalogPage) so filters and sort survive a round-trip through the viewer.
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS)
  const [sort, setSort] = useState<SortKey>('updated')

  const artifact =
    route.view === 'artifact' && catalog.status === 'ready'
      ? catalog.artifacts.find((a) => a.id === route.id)
      : undefined

  useEffect(() => {
    document.title = artifact ? `${artifact.title} · ${APP_NAME}` : APP_NAME
  }, [artifact])

  if (route.view === 'catalog') {
    return (
      <CatalogPage
        catalog={catalog}
        onRetry={catalog.reload}
        filters={filters}
        onFiltersChange={setFilters}
        sort={sort}
        onSortChange={setSort}
      />
    )
  }

  if (catalog.status === 'loading') {
    return (
      <main className="page-message">
        <StatusMessage role="status" title="Loading catalog…" />
      </main>
    )
  }

  if (catalog.status === 'error') {
    return (
      <main className="page-message">
        <StatusMessage
          role="alert"
          title="Could not load the catalog"
          detail={catalog.message}
          action={
            <>
              <button type="button" className="button" onClick={catalog.reload}>
                Retry
              </button>{' '}
              <a href="#/">← Back to catalog</a>
            </>
          }
        />
      </main>
    )
  }

  return <ViewerPage id={route.id} artifact={artifact} />
}
