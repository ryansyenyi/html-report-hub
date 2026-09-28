import type { Artifact } from '../types/artifact'
import { artifactHref } from '../utils/useHashRoute'

export function ArtifactCard({ artifact }: { artifact: Artifact }) {
  return (
    <a className="card" href={artifactHref(artifact.id)}>
      <h2 className="card-title" title={artifact.title}>
        {artifact.title}
      </h2>
      <p className="card-desc">{artifact.description}</p>
      <p className="card-meta">{artifact.project}</p>
      {artifact.tags.length > 0 && (
        <ul className="card-tags" aria-label="Tags">
          {artifact.tags.map((tag) => (
            <li key={tag} className="pill">
              {tag}
            </li>
          ))}
        </ul>
      )}
      <p className="card-updated">
        Updated <time dateTime={artifact.updatedAt}>{artifact.updatedAt}</time>
      </p>
    </a>
  )
}
