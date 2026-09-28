#!/usr/bin/env node
// Regenerates the ALERTS data block of the Grafana alert catalog report from a
// Grafana "Export Grafana-managed rules" JSON file (file-provisioning format).
// Plain ESM, Node built-ins only — no dependencies.
//
//   node scripts/import-grafana-alerts.mjs <alert-rules-export.json> [--env staging] [--grafana https://grafana.example]
//
// Only what the export contains is carried over: owners, notification routing and
// contact points are not part of a rule export, so the report does not model them.

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const REPORT = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  '../public/artifacts/pma/observability/grafana-alerts.html',
)
const BEGIN = '/* BEGIN ALERT DATA'
const END = '/* END ALERT DATA */'

const DATASOURCE_NAMES = { mimir: 'Mimir', prometheus: 'Prometheus', loki: 'Loki' }

function parseArgs(argv) {
  const args = { env: 'staging', grafana: 'https://grafana.internal.pmadvisors.my' }
  const rest = []
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--env') args.env = argv[++i]
    else if (argv[i] === '--grafana') args.grafana = argv[++i].replace(/\/+$/, '')
    else rest.push(argv[i])
  }
  args.file = rest[0]
  return args
}

/** Split "Impact: … Do now: … Resolved when: …" into its parts. */
function parseDescription(text) {
  const out = { impact: '', doNow: '', resolvedWhen: '' }
  if (!text) return out
  const re = /(Impact|Do now|Resolved when):\s*/g
  const marks = [...text.matchAll(re)]
  if (!marks.length) return { ...out, impact: text.trim() }
  marks.forEach((m, i) => {
    const body = text.slice(m.index + m[0].length, i + 1 < marks.length ? marks[i + 1].index : undefined).trim()
    out[{ Impact: 'impact', 'Do now': 'doNow', 'Resolved when': 'resolvedWhen' }[m[1]]] = body
  })
  return out
}

/** "Check a, b; determine c." -> ["Check a, b.", "Determine c."] (split only; wording is the rule's own). */
function toSteps(text) {
  if (!text) return []
  return text
    .split(/;\s+|\.\s+(?=[A-Z])/)
    .map(s => s.trim().replace(/\.$/, ''))
    .filter(Boolean)
    .map(s => s[0].toUpperCase() + s.slice(1) + '.')
}

function expressionOf(q) {
  const m = q.model || {}
  const e = { refId: q.refId, type: m.type }
  if (m.type === 'reduce') Object.assign(e, { expression: m.expression, reducer: m.reducer, mode: m.settings?.mode })
  else if (m.type === 'threshold') Object.assign(e, { expression: m.expression, evaluator: m.conditions?.[0]?.evaluator })
  else if (m.type === 'math') Object.assign(e, { expression: m.expression })
  else Object.assign(e, { expression: m.expression })
  return e
}

function convertRule(rule, group, args) {
  const a = rule.annotations || {}
  const labels = rule.labels || {}
  const desc = parseDescription(a.description)
  const queries = rule.data
    .filter(q => q.datasourceUid !== '__expr__')
    .map(q => ({
      refId: q.refId,
      datasource: DATASOURCE_NAMES[q.datasourceUid] || q.datasourceUid,
      language: q.datasourceUid === 'loki' ? 'logql' : 'promql',
      expr: q.model?.expr || '',
      range: q.relativeTimeRange?.from ? `${q.relativeTimeRange.from}s` : '',
    }))
  const expressions = rule.data.filter(q => q.datasourceUid === '__expr__').map(expressionOf)
  const dashboard = rule.dashboardUid
    ? `${args.grafana}/d/${rule.dashboardUid}${rule.panelId ? `?viewPanel=${rule.panelId}` : ''}`
    : ''

  return {
    id: rule.uid,
    name: rule.title,
    summary: a.summary || '',
    impact: desc.impact,
    doNow: toSteps(desc.doNow),
    resolvedWhen: desc.resolvedWhen,
    enabled: !rule.isPaused,
    severity: labels.severity || '',
    service: labels.service || '',
    grafana: {
      folder: group.folder,
      group: group.name,
      uid: rule.uid,
      url: `${args.grafana}/alerting/grafana/${rule.uid}/view`,
      condition: rule.condition,
    },
    datasource: [...new Set(queries.map(q => q.datasource))].join(', '),
    queries,
    expressions,
    evaluation: {
      interval: group.interval || '',
      pendingDuration: rule.for || '0s',
      keepFiringFor: rule.keep_firing_for || '0s',
      noData: rule.noDataState || '',
      execError: rule.execErrState || '',
    },
    links: { dashboard, runbook: a.runbook_url || '' },
    labels,
    annotations: a,
    raw: { folder: group.folder, group: group.name, interval: group.interval, rule },
  }
}

function main() {
  const args = parseArgs(process.argv.slice(2))
  if (!args.file) {
    console.error('usage: node scripts/import-grafana-alerts.mjs <alert-rules-export.json> [--env staging] [--grafana URL]')
    process.exit(2)
  }
  const exp = JSON.parse(fs.readFileSync(args.file, 'utf8'))
  if (!Array.isArray(exp.groups)) throw new Error(`${args.file}: expected a Grafana rule export with a "groups" array`)

  const alerts = exp.groups.flatMap(g => (g.rules || []).map(r => convertRule(r, g, args)))
  const stamp = /(\d{13})/.exec(path.basename(args.file))
  const source = {
    kind: 'grafana-rule-export',
    environment: args.env,
    grafanaUrl: args.grafana,
    exportedAt: (stamp ? new Date(Number(stamp[1])) : fs.statSync(args.file).mtime).toISOString(),
  }

  const block =
    `${BEGIN} — generated by scripts/import-grafana-alerts.mjs from ${path.basename(args.file)}; edit by re-running the importer */\n` +
    `const DATA_SOURCE = ${JSON.stringify(source, null, 2)};\n` +
    `const ALERTS = ${JSON.stringify(alerts, null, 2)};\n` +
    END

  const html = fs.readFileSync(REPORT, 'utf8')
  const start = html.indexOf(BEGIN)
  const stop = html.indexOf(END)
  if (start < 0 || stop < start) throw new Error(`${REPORT}: data markers not found`)
  // "</script" inside a query or annotation would end the script element early.
  const safe = block.replace(/<\/(script)/gi, '<\\/$1')
  fs.writeFileSync(REPORT, html.slice(0, start) + safe + html.slice(stop + END.length))
  console.log(`Wrote ${alerts.length} alerts from ${exp.groups.length} groups to ${path.relative(process.cwd(), REPORT)}`)
}

main()
