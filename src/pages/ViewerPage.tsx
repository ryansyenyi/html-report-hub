import { useEffect, useState } from 'react'
import { StatusMessage } from '../components/StatusMessage'
import type { Artifact } from '../types/artifact'
import { artifactUrl } from '../utils/catalog'

const CATALOG_HREF = '#/'

// Deliberately without allow-same-origin: the report runs in an opaque origin and cannot
// reach the parent window, its DOM, or its storage.
const IFRAME_SANDBOX =
  'allow-scripts allow-forms allow-popups allow-popups-to-escape-sandbox allow-modals allow-downloads'

type FileCheck = { status: 'checking' } | { status: 'ok' } | { status: 'missing'; httpStatus: number }

interface ViewerPageProps {
  id: string
  /** undefined when the id is not in the catalog. */
  artifact: Artifact | undefined
}

export function ViewerPage({ id, artifact }: ViewerPageProps) {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      // location.replace (not setting location.hash) so it doesn't push a history entry —
      // Back after Esc goes to whatever was before the viewer, not back into the viewer.
      if (event.key === 'Escape') window.location.replace(CATALOG_HREF)
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [])

  if (artifact === undefined) {
    return (
      <div className="viewer">
        <main className="viewer-body is-message">
          <StatusMessage
            role="alert"
            title={`No artifact with id “${id}”`}
            detail="It may have been removed or renamed in the catalog."
            action={<a href={CATALOG_HREF}>← Back to catalog</a>}
          />
        </main>
      </div>
    )
  }

  const url = artifactUrl(artifact.path)

  return (
    <div className="viewer">
      <header className="viewer-header">
        <div className="viewer-heading">
          <h1 className="viewer-title">
            <a href={CATALOG_HREF}>
              <span aria-hidden="true">← </span>
              <span className="visually-hidden">Back to catalog: </span>
              {artifact.title}
            </a>
          </h1>
          <p className="viewer-meta">
            {artifact.project} / {artifact.category} · Updated{' '}
            <time dateTime={artifact.updatedAt}>{artifact.updatedAt}</time>
          </p>
        </div>
        <a className="viewer-open" href={url} target="_blank" rel="noopener noreferrer">
          <span className="label-long">Open full page</span>
          <span className="label-short">Open</span> ↗
        </a>
      </header>
      <ArtifactFrame key={artifact.id} artifact={artifact} url={url} />
    </div>
  )
}

function ArtifactFrame({ artifact, url }: { artifact: Artifact; url: string }) {
  const [check, setCheck] = useState<FileCheck>({ status: 'checking' })

  useEffect(() => {
    let active = true
    fetch(url, { method: 'HEAD', cache: 'no-store' }).then(
      (response) => {
        if (!active) return
        setCheck(response.ok ? { status: 'ok' } : { status: 'missing', httpStatus: response.status })
      },
      () => {
        // HEAD can be blocked in some hosting/proxy setups; a thrown fetch is not proof the
        // file is missing, so render the iframe anyway and let it show whatever loads.
        if (active) setCheck({ status: 'ok' })
      },
    )
    return () => {
      active = false
    }
  }, [url])

  if (check.status === 'checking') {
    return (
      <main className="viewer-body is-message">
        <StatusMessage role="status" title="Loading artifact…" />
      </main>
    )
  }

  if (check.status === 'missing') {
    return (
      <main className="viewer-body is-message">
        <StatusMessage
          role="alert"
          title="Artifact file not found"
          detail={
            <>
              <code>{artifact.path}</code> returned HTTP {check.httpStatus}.
            </>
          }
          action={<a href={CATALOG_HREF}>← Back to catalog</a>}
        />
      </main>
    )
  }

  return (
    <main className="viewer-body">
      <iframe
        key={artifact.id}
        className="viewer-frame"
        src={url}
        title={artifact.title}
        sandbox={IFRAME_SANDBOX}
        referrerPolicy="no-referrer"
      />
    </main>
  )
}
