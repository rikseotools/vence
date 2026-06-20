// Codemod: migra fetch('/api/admin/...') → adminFetch(...) en cliente + añade import.
// EXCLUYE app/armando/page.tsx (usa cookie armando, no Bearer; ruta exenta del guard).
const fs = require('fs')
const { execSync } = require('child_process')

const EXCLUDE = ['app/armando/page.tsx']
// Migra fetch crudo a /api/admin/* Y /api/v2/admin/* (ambos guardados por proxy.ts).
const files = execSync(`grep -rlnE "fetch\\((['\\"])/api/(v2/)?admin/" app components hooks`, { encoding: 'utf8' })
  .trim().split('\n').filter(f => f && !EXCLUDE.includes(f))

const IMPORT = "import { adminFetch } from '@/lib/api/adminFetch'"
let changed = 0
for (const f of files) {
  let src = fs.readFileSync(f, 'utf8')
  const before = src
  // swap las llamadas a /api/admin/ y /api/v2/admin/ (ambas comillas)
  src = src.replace(/\bfetch\((['"])(\/api\/(?:v2\/)?admin\/)/g, 'adminFetch($1$2')
  if (src === before) continue
  // asegurar import (una vez)
  if (!/from '@\/lib\/api\/adminFetch'/.test(src)) {
    const lines = src.split('\n')
    // insertar tras el primer import top-level
    let idx = lines.findIndex(l => /^import\s/.test(l))
    if (idx === -1) {
      // sin imports (raro): tras 'use client' o al inicio
      idx = lines.findIndex(l => /^['"]use client['"]/.test(l))
    }
    lines.splice(idx + 1, 0, IMPORT)
    src = lines.join('\n')
  }
  fs.writeFileSync(f, src)
  changed++
  console.log('  ✓', f)
}
console.log(`\n${changed} ficheros migrados.`)
