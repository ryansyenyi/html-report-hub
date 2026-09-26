# Report Hub

A static catalog and viewer for one-off HTML reports (dashboards, audits,
diagrams, checklists — any self-contained HTML file). Reports live as plain
files under `public/artifacts/`, described by a single JSON catalog
(`public/artifacts.json`); the app is a client-side React SPA that lists,
filters, and previews them, and the whole thing is deployed as a static site
to GitHub Pages.

## Local development

```
npm ci
npm run dev
```

The dev server serves the app at `http://localhost:5173/html-report-hub/`
(the base path matches the production path so relative artifact links behave
the same locally as on Pages).

Other scripts:

```
npm test       # run the vitest suite
npm run lint   # oxlint
npm run validate  # check public/artifacts.json against the catalog rules
npm run build  # validate -> tsc -b -> vite build (output in dist/)
npm run preview   # serve the production build locally
```

## Adding a report

1. Copy the report's HTML file to:
   ```
   public/artifacts/<project>/<category>/<name>.html
   ```
   (lowercase, hyphenated directory names by convention — the validator does
   not enforce the directory shape, only the fields below.)
2. Add an entry to `public/artifacts.json`, in the `artifacts` array:
   ```json
   {
     "id": "permission-audit",
     "title": "Permission Audit",
     "description": "Role and permission review with sortable columns.",
     "project": "Narya",
     "category": "Security",
     "tags": ["iam", "rbac", "security", "audit"],
     "path": "artifacts/narya/security/permission-audit.html",
     "createdAt": "2026-08-05",
     "updatedAt": "2026-09-22"
   }
   ```
   Field rules enforced by `scripts/validate-artifacts.mjs`:
   - `id`, `title`, `project`, `category`, `path`, `createdAt`, `updatedAt`
     are required non-empty strings; `description` is a required string
     (may be empty); `tags` is a required array of strings.
   - `id` must match `^[a-z0-9]+(-[a-z0-9]+)*$` and be unique across the
     catalog.
   - `createdAt` / `updatedAt` must be valid `YYYY-MM-DD` dates, and
     `updatedAt` must not be before `createdAt`.
   - `path` must start with `artifacts/`, end with `.html`, contain no `..`
     or backslashes, have no leading `/`, be unique across the catalog, and
     point at a file that actually exists under `public/`. Beyond that, the
     whole path may only contain letters, numbers, `.`, `_`, `-`, and `/` —
     no spaces, `#`, `%`, `?`, or other non-ASCII/control characters, and no
     `//`.
   - `tags` must not contain the same tag twice, compared
     case-insensitively (e.g. `["iam", "IAM"]` is rejected).
   - An HTML file under `public/artifacts/` with no matching `path` entry in
     the catalog produces a warning (not a build failure) — it's orphaned
     and won't show up anywhere.
3. Run `npm run validate` (also runs automatically as part of `npm run
   build`) and fix any errors it reports.
4. Commit and push. Pushes to `main` deploy automatically (see below).

## Deploying to GitHub Pages

In the repo's **Settings → Pages**, set **Source** to **GitHub Actions**.
`.github/workflows/deploy.yml` then builds and deploys on every push to
`main` (and can be triggered manually via `workflow_dispatch`).

The build step sets `BASE_PATH` from the Pages environment
(`actions/configure-pages` output), so the same workflow works for any
Pages URL shape:
- **Project site** (`https://<user>.github.io/<repo>/`, the default here):
  `BASE_PATH` is `/<repo>/`.
- **User/org site** (repo named `<user>.github.io`, served at the domain
  root) or a **custom domain**: `BASE_PATH` is `/`.

`vite.config.ts` reads `BASE_PATH` (defaulting to `/html-report-hub/` when
unset, e.g. for local dev) and uses it as Vite's `base`, and the app reads
every static URL (catalog JSON, artifact files) through
`import.meta.env.BASE_URL` — nothing in `src/` hardcodes a path. For this
repo's remote (`ryansyenyi/html-report-hub`), the deployed URL is
`https://ryansyenyi.github.io/html-report-hub/`.

## Architecture notes

- **Hash routing.** The app has no router library; the URL hash alone
  selects the view — `#/artifact/<id>` for the viewer, anything else for the
  catalog. Because the hash is never sent to the server, a refresh or a
  shared deep link to `#/artifact/<id>` always works on Pages without any
  server-side rewrite rules.
- **Base path.** Every URL the app builds for a static file goes through
  `import.meta.env.BASE_URL` (set from `BASE_PATH` at build time, see
  above). The catalog is fetched from `${BASE_URL}artifacts.json`, and an
  artifact's URL is `BASE_URL` + its `path` field.
- **Iframe sandbox.** The viewer renders a report in an `<iframe>` with
  `sandbox="allow-scripts allow-forms allow-popups
  allow-popups-to-escape-sandbox allow-modals allow-downloads"` —
  deliberately **without** `allow-same-origin`. The report runs in an
  opaque origin and cannot reach the parent page, its DOM, or its storage.
  The consequence: a report that needs `localStorage`, `sessionStorage`, or
  cookies to work (e.g. to persist its own state) will not have them inside
  the embedded viewer. Use the **"Open full page"** link in the viewer
  header to open the report directly, outside the sandbox, where it behaves
  like any normal page.
- **Lazy loading.** Report content is never fetched until its viewer page is
  opened — the catalog only carries metadata, so the catalog view stays
  cheap regardless of how large individual reports are.

## Privacy note

Everything published to GitHub Pages is public on the internet, regardless
of the source repository's visibility, unless you've set up a private-Pages
or access-gated hosting arrangement yourself (this project doesn't). Never
commit secrets, credentials, internal URLs, or non-public data inside a
report file or the catalog.

## Future publishing (`reporthub publish`)

There's no CLI or MCP tool yet, but any future automated publisher (CLI or
MCP-based) must satisfy the same contract this repo enforces by hand:
1. Copy the report's HTML file under `public/artifacts/...`.
2. Upsert its entry in `public/artifacts.json` by `id` (replace if the `id`
   already exists, append otherwise).
3. Run `npm run validate` and fail the publish if it reports errors.
4. Commit and push to `main`.

## Known limitations

- Reports can't use `localStorage`, `sessionStorage`, or cookies inside the
  sandboxed viewer (no `allow-same-origin`); use "Open full page" for those.
- Everything deployed to GitHub Pages is public — see the privacy note
  above.
- The catalog (`artifacts.json`) is loaded entirely client-side on every
  visit; this is fine up to hundreds of entries but isn't paginated or
  indexed for anything larger.
- Relative asset links (images, CSS, JS) inside a report resolve relative to
  that report's own file URL, not the app's origin. A multi-file report must
  keep its assets alongside its HTML file under the same `artifacts/...`
  directory, using relative paths.
- No search/filter library — search and facet filtering are plain
  client-side string/array matching over the fields already in the catalog.
- Keyboard shortcuts: `/` focuses the search box from the catalog view, and
  `Esc` leaves the viewer back to the catalog.
- The tag list in the sidebar renders every distinct tag with no cap or
  collapsing — with hundreds of distinct tags across the catalog, that list
  gets long.
