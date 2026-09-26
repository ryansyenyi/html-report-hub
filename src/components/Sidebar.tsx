import type { FacetCount, Filters } from '../utils/filter'

type FacetKey = 'project' | 'category' | 'tag'

interface SidebarProps {
  id: string
  open: boolean
  total: number
  facets: { projects: FacetCount[]; categories: FacetCount[]; tags: FacetCount[] }
  filters: Filters
  onFiltersChange: (filters: Filters) => void
}

export function Sidebar({ id, open, total, facets, filters, onFiltersChange }: SidebarProps) {
  const groups: { key: FacetKey; label: string; values: FacetCount[] }[] = [
    { key: 'project', label: 'Projects', values: facets.projects },
    { key: 'category', label: 'Categories', values: facets.categories },
    { key: 'tag', label: 'Tags', values: facets.tags },
  ]

  const select = (key: FacetKey, value: string | null) => {
    // Single-select per group; clicking the selected value again clears it.
    onFiltersChange({ ...filters, [key]: filters[key] === value ? null : value })
  }

  return (
    <aside id={id} className={open ? 'sidebar is-open' : 'sidebar'} aria-label="Filters">
      {groups.map((group) => (
        <section key={group.key} className="facet" aria-labelledby={`${id}-${group.key}`}>
          <h2 id={`${id}-${group.key}`} className="facet-heading">
            {group.label}
          </h2>
          <ul className="facet-list">
            <li>
              <button
                type="button"
                className="facet-option"
                aria-pressed={filters[group.key] === null}
                onClick={() => onFiltersChange({ ...filters, [group.key]: null })}
              >
                <span className="facet-label">All</span>
                <span className="facet-count">{total}</span>
              </button>
            </li>
            {group.values.map((facet) => (
              <li key={facet.value}>
                <button
                  type="button"
                  className="facet-option"
                  aria-pressed={filters[group.key] === facet.value}
                  onClick={() => select(group.key, facet.value)}
                >
                  <span className="facet-label" title={facet.value}>
                    {facet.value}
                  </span>
                  <span className="facet-count">{facet.count}</span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </aside>
  )
}
