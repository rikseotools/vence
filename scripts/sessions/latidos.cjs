#!/usr/bin/env node
/**
 * latidos.cjs — lee las señales de vida de las sesiones. (T-296, 30/07/2026)
 *
 * Contesta la pregunta operativa: **«¿puedo borrar este worktree?»**. Solo LEE.
 *
 * Salidas:
 *   (sin flags)          informe legible, ordenado por señal más reciente
 *   --tsv                `slug<TAB>estado<TAB>antigüedad<TAB>borrable` (lo consume el listado en bash)
 *   --slug <slug>        solo ese, y el EXIT CODE contesta: 0 = nadie la usa · 3 = está en uso
 *   --json               crudo, por si hace falta encadenarlo
 *
 * El exit code de `--slug` es lo que permite que `borrar-worktree.sh` se niegue a borrar una sesión
 * viva sin que el humano tenga que acordarse de mirar.
 */
const fs = require('fs')
const path = require('path')
const { clasificarSenal, formatearAntiguedad, etiquetaEstado, nombresCasiIdenticos } = require('../../lib/sessions/latido.js')

const REPO = path.resolve(__dirname, '../..')
const TSV = process.argv.includes('--tsv')
const JSON_OUT = process.argv.includes('--json')
const arg = (n) => { const i = process.argv.indexOf(n); const v = process.argv[i + 1]; return i >= 0 && v && !v.startsWith('--') ? v : null }
const SLUG = arg('--slug')

function url() {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL
  const m = fs.readFileSync(path.join(REPO, '.env.local'), 'utf8').match(/^DATABASE_URL=(.*)$/m)
  return m && m[1].trim()
}

/**
 * Procesos con el `cwd` dentro del worktree. Es la OTRA señal, local y sin BD, y la que no se puede
 * falsear: si hay un proceso ahí dentro, alguien está trabajando ahora mismo. No sustituye al
 * latido (una sesión entre mensajes no tiene procesos), lo complementa.
 */
function procesosDentro(dir) {
  let n = 0
  try {
    for (const pid of fs.readdirSync('/proc')) {
      if (!/^\d+$/.test(pid)) continue
      try { if (fs.readlinkSync(`/proc/${pid}/cwd`).startsWith(dir)) n++ } catch {}
    }
  } catch { return null } // no es Linux: se calla en vez de mentir
  return n
}

async function main() {
  const s = require('postgres')(url(), { ssl: { rejectUnauthorized: false }, max: 1, connect_timeout: 10 })
  let filas
  try {
    filas = await s`
      SELECT sid, slug, worktree_path, branch, last_signal_at, last_command, signals, first_signal_at
        FROM worktree_sessions ${SLUG ? s`WHERE slug = ${SLUG}` : s``}
       ORDER BY last_signal_at DESC`
  } finally {
    try { await s.end({ timeout: 5 }) } catch {}
  }

  const ahora = new Date()
  const datos = filas.map((r) => {
    const c = clasificarSenal(r.last_signal_at, ahora)
    const procs = r.worktree_path && fs.existsSync(r.worktree_path) ? procesosDentro(r.worktree_path) : null
    return {
      ...r,
      estado: c.estado,
      minutos: c.minutos,
      antiguedad: formatearAntiguedad(c.minutos),
      procesos: procs,
      // Un proceso dentro MANDA sobre la antigüedad de la señal: la señal puede ser vieja y estar
      // alguien compilando ahí ahora mismo.
      borrable: c.borrable && !procs,
      existe: r.worktree_path ? fs.existsSync(r.worktree_path) : false,
    }
  })

  if (JSON_OUT) { console.log(JSON.stringify(datos, null, 1)); return }
  if (TSV) {
    for (const d of datos) console.log([d.slug, d.estado, d.antiguedad, d.borrable ? 'borrable' : 'en-uso', d.procesos ?? ''].join('\t'))
    return
  }

  if (SLUG) {
    const d = datos[0]
    if (!d) { console.log(`⚪ ${SLUG}: sin ninguna señal registrada (nunca ha latido)`); process.exit(0) }
    console.log(`${etiquetaEstado(d.estado)}  ${d.slug}  ·  última señal ${d.antiguedad}${d.procesos ? `  ·  ${d.procesos} proceso(s) dentro` : ''}`)
    console.log(`   sid: ${d.sid} · rama: ${d.branch || '?'} · ${d.signals} señales desde ${String(d.first_signal_at).slice(0, 16)}`)
    if (!d.borrable) console.log('   ⛔ EN USO — no la borres')
    process.exit(d.borrable ? 0 : 3)
  }

  console.log(`\nSESIONES CON SEÑAL (${datos.length}):\n`)
  for (const d of datos) {
    const marca = d.existe ? '' : '  (el directorio ya no existe)'
    console.log(`  ${etiquetaEstado(d.estado).padEnd(16)} ${String(d.slug).padEnd(26)} ${d.antiguedad.padEnd(16)} ${d.procesos ? `${d.procesos} proc` : ''}${marca}`)
  }
  const pares = nombresCasiIdenticos(datos.map((d) => d.slug).filter(Boolean))
  if (pares.length) {
    console.log('\n⚠️  nombres casi idénticos (equivocarse al cerrar borra el trabajo de la otra):')
    for (const [a, b] of pares) console.log(`     ${a}  ↔  ${b}`)
  }
  const borrables = datos.filter((d) => d.borrable && d.existe)
  console.log(`\nSin señales y sin procesos (candidatas a cerrar, MIRA SI TIENEN TRABAJO SIN PUSHEAR): ${borrables.length}`)
  for (const d of borrables) console.log(`     scripts/worktrees/borrar-worktree.sh ${d.slug}`)
  console.log('\n(«sin señales» = 24 h de silencio. Una sesión que solo lee código y no toca el backlog no late:')
  console.log(' mira también `git -C <wt> status` y `git log origin/main..` antes de borrar.)\n')
}

main().catch((e) => { console.error('❌', String(e.message || e).slice(0, 200)); process.exit(1) })
