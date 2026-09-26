import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

function normalizeBase(base: string): string {
  if (base === '' || base === '/') return '/'
  let normalized = base
  if (!normalized.startsWith('/')) normalized = `/${normalized}`
  if (!normalized.endsWith('/')) normalized = `${normalized}/`
  return normalized
}

// https://vite.dev/config/
export default defineConfig({
  base: normalizeBase(process.env.BASE_PATH ?? '/html-report-hub/'),
  appType: 'mpa',
  plugins: [react()],
  test: {
    environment: 'node',
  },
})
