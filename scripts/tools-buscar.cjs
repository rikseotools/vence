#!/usr/bin/env node
// scripts/tools-buscar.cjs — "¿esto ya existe?" en cinco segundos.
//
// CÓRRELO ANTES de construir cualquier herramienta operativa. Nace de T-130 (26/07/2026): en una
// sola sesión se escribió un quinto escritor de `seguimiento_url` sin ver los otros cuatro, y se
// apuntó como "pendiente de construir" un headless-fetcher que llevaba meses desplegado.
//
// Busca en los tres sitios donde este repo guarda lo que sabe hacer:
//   1. `lib/admin/toolRegistry.ts`  — herramientas y capacidades registradas
//   2. `lib/admin/runbookRegistry.ts` — detectores de salud y su runbook
//   3. `CLAUDE.md` + `docs/runbooks/` + `docs/maintenance/` — los manuales
//
// Uso:  npm run tools:buscar -- <palabra> [palabra2 ...]
//       npm run tools:buscar -- seguimiento_url
//       npm run tools:buscar -- headless

const fs = require('fs')
const path = require('path')

const REPO = path.resolve(__dirname, '..')
const terminos = process.argv.slice(2).filter((a) => !a.startsWith('-')).map((s) => s.toLowerCase())

if (!terminos.length) {
  console.error('\nUso: npm run tools:buscar -- <palabra> [palabra2 ...]\n')
  console.error('Ejemplos:  npm run tools:buscar -- seguimiento_url')
  console.error('           npm run tools:buscar -- headless\n')
  process.exit(2)
}

const norm = (s) =>
  String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
const casa = (texto) => terminos.some((t) => norm(texto).includes(norm(t)))

function leer(rel) {
  try {
    return fs.readFileSync(path.join(REPO, rel), 'utf8')
  } catch {
    return ''
  }
}

// ── 1. Herramientas registradas ────────────────────────────────────────────────────────────
// Se parsea el fichero como TEXTO (no `require`) para no arrastrar el runtime de TS a un CLI.
function herramientas() {
  const src = leer('lib/admin/toolRegistry.ts')
  const out = []
  const re = /^\s{2}([a-z0-9_]+):\s*\{([\s\S]*?)^\s{2}\},/gm
  let m
  while ((m = re.exec(src))) {
    const [, clave, cuerpo] = m
    const campo = (n) => (cuerpo.match(new RegExp(`${n}:\\s*'([^']*)'`)) || [])[1] || ''
    const notas = (cuerpo.match(/notas:\s*([\s\S]*?)(?:,\n\s{4}\w+:|\s*$)/) || [])[1] || ''
    out.push({
      clave,
      titulo: campo('titulo'),
      ruta: campo('ruta'),
      estado: campo('estado'),
      runbook: campo('runbook'),
      escribe: ((cuerpo.match(/escribe:\s*\[([^\]]*)\]/) || [])[1] || '').replace(/['\s]/g, ''),
      notas: notas.replace(/['\n+]/g, ' ').replace(/\s+/g, ' ').trim(),
    })
  }
  return out
}

// ── 2. Detectores de salud ─────────────────────────────────────────────────────────────────
function detectores() {
  const src = leer('lib/admin/runbookRegistry.ts')
  const out = []
  const re = /^\s{2}([a-z0-9_]+):\s*\{([\s\S]*?)^\s{2}\},/gm
  let m
  while ((m = re.exec(src))) {
    const [, kind, cuerpo] = m
    const campo = (n) => (cuerpo.match(new RegExp(`${n}:\\s*'([^']*)'`)) || [])[1] || ''
    out.push({ kind, titulo: campo('title'), frase: campo('triggerPhrase'), runbook: campo('runbook') })
  }
  return out
}

// ── 3. Manuales ────────────────────────────────────────────────────────────────────────────
function manuales() {
  const dirs = ['docs/runbooks', 'docs/maintenance']
  const out = []
  for (const d of dirs) {
    let files = []
    try {
      files = fs.readdirSync(path.join(REPO, d)).filter((f) => f.endsWith('.md'))
    } catch {
      continue
    }
    for (const f of files) {
      const rel = path.join(d, f)
      const txt = leer(rel)
      if (!casa(txt) && !casa(f)) continue
      const lineas = txt.split('\n')
      const golpes = lineas.filter((l) => casa(l)).slice(0, 2).map((l) => l.trim().slice(0, 130))
      out.push({ rel, golpes, total: lineas.filter((l) => casa(l)).length })
    }
  }
  return out
}

const H = herramientas().filter((h) => casa(`${h.clave} ${h.titulo} ${h.ruta} ${h.escribe} ${h.notas}`))
const D = detectores().filter((d) => casa(`${d.kind} ${d.titulo} ${d.frase}`))
const M = manuales()

console.log(`\n🔎 "${terminos.join(' ')}"\n${'='.repeat(78)}`)

console.log(`\n▸ HERRAMIENTAS Y CAPACIDADES REGISTRADAS (${H.length})`)
if (!H.length) console.log('   (ninguna — puede que haga falta construirla, o que no esté registrada aún)')
for (const h of H) {
  const marca = h.estado === 'vivo' ? '✅ vivo' : h.estado === 'historico' ? '📦 histórico' : '⛔ deprecado'
  console.log(`\n   ${marca}  ${h.titulo}`)
  console.log(`      ${h.ruta}${h.escribe ? `   [escribe: ${h.escribe}]` : ''}`)
  if (h.runbook) console.log(`      runbook: ${h.runbook}`)
  if (h.notas) console.log(`      ${h.notas.slice(0, 220)}`)
}

console.log(`\n▸ DETECTORES DE SALUD (${D.length})`)
if (!D.length) console.log('   (ninguno)')
for (const d of D) console.log(`   · ${d.kind} — «${d.frase}» → ${d.runbook}`)

console.log(`\n▸ MANUALES QUE LO MENCIONAN (${M.length})`)
if (!M.length) console.log('   (ninguno)')
for (const m of M) {
  console.log(`   · ${m.rel}  (${m.total} menciones)`)
  m.golpes.forEach((g) => console.log(`       ${g}`))
}

console.log(
  `\n${'='.repeat(78)}\n` +
    (H.length || D.length || M.length
      ? 'Si algo de arriba ya hace lo que ibas a construir, ÚSALO o extiéndelo. No abras otra puerta.\n'
      : 'Sin coincidencias. Si construyes algo, REGÍSTRALO en lib/admin/toolRegistry.ts.\n'),
)
