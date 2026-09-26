export interface Artifact {
  id: string
  title: string
  description: string
  project: string
  category: string
  tags: string[]
  path: string
  createdAt: string
  updatedAt: string
}

export interface ArtifactCatalog {
  artifacts: Artifact[]
}
