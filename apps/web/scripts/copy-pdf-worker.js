const fs = require('fs')
const path = require('path')
const { execSync } = require('child_process')

const projectRoot = path.resolve(__dirname, '..')
const publicDir = path.join(projectRoot, 'public')
const dest = path.join(publicDir, 'pdf.worker.min.mjs')

function findPnpmStoreDir(start) {
  let dir = start
  for (let i = 0; i < 6; i++) {
    const candidate = path.join(dir, 'node_modules', '.pnpm')
    if (fs.existsSync(candidate)) return candidate
    const parent = path.dirname(dir)
    if (parent === dir) break
    dir = parent
  }
  return null
}

function findWorker() {
  const direct = path.join(
    projectRoot,
    'node_modules',
    'pdfjs-dist',
    'build',
    'pdf.worker.min.mjs'
  )
  if (fs.existsSync(direct)) return direct

  const pnpmDir = findPnpmStoreDir(projectRoot)
  if (pnpmDir) {
    try {
      const found = execSync(
        `find "${pnpmDir}" -type f -name pdf.worker.min.mjs -path '*/pdfjs-dist/build/*' 2>/dev/null | head -1`,
        { encoding: 'utf8' }
      ).trim()
      if (found) return found
    } catch {}
  }

  return null
}

const src = findWorker()
if (!src) {
  console.error('[copy-pdf-worker] pdf.worker.min.mjs not found. Please run `pnpm install` first.')
  process.exit(1)
}

fs.mkdirSync(publicDir, { recursive: true })

const stat = fs.statSync(src)
const destExists = fs.existsSync(dest)
if (destExists) {
  const destStat = fs.statSync(dest)
  if (destStat.size === stat.size && destStat.mtimeMs >= stat.mtimeMs) {
    console.log('[copy-pdf-worker] up-to-date, skip.')
    process.exit(0)
  }
}

fs.copyFileSync(src, dest)
console.log(
  `[copy-pdf-worker] copied ${path.relative(projectRoot, src)} -> public/pdf.worker.min.mjs`
)
