// Codemod (T-608 parte 2): migra los overlays `fixed inset-0 … z-50` a `CAPAS.modal`
// (lib/ui/capas.ts), en vez de dejarlos en `z-50` — que es justo la clase por debajo del
// banner de cookies (`z-[9999]`) y el agujero que la parte 1 ya arregló para un único modal.
//
// Solo toca el `className="…fixed inset-0…z-50…"` de la línea (todas las 60 ocurrencias
// medidas son de una sola línea, comprobado con grep antes de escribir esto: ninguna usa
// `class=` ni una plantilla con backticks). Quita el token `z-50`, añade
// `style={{ zIndex: CAPAS.modal }}` justo detrás del className y asegura el import.
//
// Uso: node scripts/ui-migrar-modales-a-capas.cjs [--apply]
const fs = require('fs')
const { execSync } = require('child_process')

const APPLY = process.argv.includes('--apply')

const files = execSync(
  `grep -rlE "fixed inset-0.*z-50" --include="*.tsx" --include="*.jsx" --include="*.js" app components 2>/dev/null`,
  { encoding: 'utf8' },
)
  .trim()
  .split('\n')
  .filter(Boolean)

const IMPORT = "import { CAPAS } from '@/lib/ui/capas'"
let filesChanged = 0
let occurrences = 0

for (const f of files) {
  const src = fs.readFileSync(f, 'utf8')
  const lines = src.split('\n')
  let fileTouched = false

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    const m = line.match(/className="([^"]*fixed inset-0[^"]*)"/)
    if (!m) continue
    const classValue = m[1]
    if (!/\bz-50\b/.test(classValue)) continue

    const newClassValue = classValue
      .replace(/\s*\bz-50\b\s*/, ' ')
      .replace(/\s+/g, ' ')
      .trim()
    const newAttr = `className="${newClassValue}" style={{ zIndex: CAPAS.modal }}`
    lines[i] = line.replace(m[0], newAttr)
    fileTouched = true
    occurrences++
  }

  if (!fileTouched) continue

  let newSrc = lines.join('\n')
  if (!/from '@\/lib\/ui\/capas'/.test(newSrc)) {
    const outLines = newSrc.split('\n')
    let idx = outLines.findIndex((l) => /^import\s/.test(l))
    if (idx === -1) idx = outLines.findIndex((l) => /^['"]use client['"]/.test(l))
    if (idx === -1) idx = 0
    outLines.splice(idx + 1, 0, IMPORT)
    newSrc = outLines.join('\n')
  }

  filesChanged++
  console.log(`  ✓ ${f}`)
  if (APPLY) fs.writeFileSync(f, newSrc)
}

console.log(
  `\n${filesChanged} fichero(s) / ${occurrences} ocurrencia(s) ${APPLY ? 'migrado(s)' : 'A MIGRAR (dry-run — repite con --apply)'}.`,
)
