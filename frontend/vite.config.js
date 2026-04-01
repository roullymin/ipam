import { execSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const packageJson = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8'))

const safeGit = (args, fallback = '') => {
  try {
    return execSync(`git ${args}`, { encoding: 'utf8' }).trim() || fallback
  } catch {
    return fallback
  }
}

const buildInfo = {
  version: packageJson.version || '1.0.0',
  commit: safeGit('rev-parse --short HEAD', ''),
  branch: safeGit('rev-parse --abbrev-ref HEAD', ''),
  committedAt: safeGit('log -1 --format=%cI', ''),
  builtAt: new Date().toISOString(),
}

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  define: {
    __APP_BUILD_INFO__: JSON.stringify(buildInfo),
  },
  server: {
    host: '0.0.0.0',
  }
})
