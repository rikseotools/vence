#!/usr/bin/env node
/**
 * sim-perdida-contexto.cjs — CALIBRA el detector de T-428 contra la historia real del fichero.
 *
 * Recorre todos los commits que tocan `docs/roadmap/tareas-pendientes.md`, compara cada uno con su
 * primer padre y pasa las dos versiones por el núcleo puro `lib/backlog/perdidaDeContexto.cjs`.
 * NO escribe nada: solo lee git y cuenta.
 *
 * Existe porque el umbral de «cuánto cuerpo hay que perder para que sea un borrado» no se puede
 * elegir a ojo: una reescritura legítima también encoge. Si al medirlo sobre el histórico salen
 * demasiados falsos positivos, el hook avisa en vez de bloquear.
 *
 * Uso:
 *   node scripts/backlog/sim-perdida-contexto.cjs            (resumen + los peores casos)
 *   node scripts/backlog/sim-perdida-contexto.cjs --todos    (una línea por hallazgo)
 *   node scripts/backlog/sim-perdida-contexto.cjs --commit <sha>   (solo ese commit)
 *   node scripts/backlog/sim-perdida-contexto.cjs --min 600 --ratio 0.5   (probar otro umbral)
 */
const { execFileSync } = require('child_process')
const { findPerdidaDeContexto, MIN_CHARS_PERDIDOS, RATIO_MERMA } = require('../../lib/backlog/perdidaDeContexto.cjs')

const FICHERO = 'docs/roadmap/tareas-pendientes.md'

const argv = process.argv.slice(2)
const flag = (n, def) => {
  const i = argv.indexOf(n)
  return i >= 0 && argv[i + 1] ? argv[i + 1] : def
}
const TODOS = argv.includes('--todos')
const SOLO = flag('--commit', null)
const MIN = Number(flag('--min', MIN_CHARS_PERDIDOS))
const RATIO = Number(flag('--ratio', RATIO_MERMA))

const git = (args) => execFileSync('git', args, { encoding: 'utf8', maxBuffer: 1024 * 1024 * 64 })

/** Contenido del fichero en un commit; '' si no existía. */
function leer(sha) {
  try {
    return execFileSync('git', ['show', `${sha}:${FICHERO}`], { encoding: 'utf8', maxBuffer: 1024 * 1024 * 64 })
  } catch {
    return ''
  }
}

const commits = SOLO
  ? [SOLO]
  : git(['log', '--format=%H', '--', FICHERO]).trim().split('\n').filter(Boolean)

console.log(`→ ${commits.length} commit(s) sobre ${FICHERO}`)
console.log(`→ umbral: pierde ≥${MIN} caracteres Y ≥${Math.round(RATIO * 100)}% del cuerpo\n`)

const filas = []
let sinPadre = 0

for (const sha of commits) {
  let padre
  try {
    padre = git(['rev-parse', `${sha}^1`]).trim()
  } catch {
    sinPadre++
    continue                                    // commit raíz: no hay «antes» con el que comparar
  }
  const antes = leer(padre)
  const despues = leer(sha)
  if (!antes) continue                          // el fichero nace en este commit
  const { hallazgos } = findPerdidaDeContexto(antes, despues, { minChars: MIN, ratio: RATIO })
  if (!hallazgos.length) continue
  const asunto = git(['log', '-1', '--format=%s', sha]).trim()
  const fecha = git(['log', '-1', '--format=%ad', '--date=short', sha]).trim()
  for (const h of hallazgos) filas.push({ sha: sha.slice(0, 9), fecha, asunto, ...h })
}

// ── ¿Fue un borrado ACCIDENTAL o intencionado? ──────────────────────────────────────────────
// Discriminador objetivo y sin opinión: si la ficha VOLVIÓ al fichero después (está en HEAD), es
// que alguien la echó de menos y la restauró → el detector habría acertado. Si nunca volvió, el
// borrado era a propósito (renumeración, o una entrada que no era una tarea) → falso positivo.
const enHead = new Set(
  (leer('HEAD').match(/^###\s+.*\[(T-\d+)\]/gm) || []).map((l) => /\[(T-\d+)\]/.exec(l)[1])
)
for (const f of filas) f.volvio = enHead.has(f.id)

const errores = filas.filter((f) => f.severidad === 'error')
const infos = filas.filter((f) => f.severidad === 'info')
const desaparecidas = errores.filter((f) => f.tipo === 'desaparecida')
const mermadas = errores.filter((f) => f.tipo === 'mermada')
const commitsConError = new Set(errores.map((f) => f.sha))

console.log('══ RESUMEN ' + '═'.repeat(60))
console.log(`   commits analizados      : ${commits.length - sinPadre}`)
console.log(`   commits que dispararían : ${commitsConError.size}  (${((commitsConError.size / Math.max(1, commits.length - sinPadre)) * 100).toFixed(1)}%)`)
console.log(`   hallazgos ERROR         : ${errores.length}  (${desaparecidas.length} desaparecidas · ${mermadas.length} mermadas)`)
console.log(`   hallazgos info (cierre) : ${infos.length}`)

const volvieron = errores.filter((f) => f.volvio)
console.log(`\n   de los ${errores.length} ERROR, la ficha VOLVIÓ al fichero en ${volvieron.length}`)
console.log(`   → ${((volvieron.length / Math.max(1, errores.length)) * 100).toFixed(0)}% eran pérdidas REALES que alguien tuvo que restaurar a mano`)
const noVolvieron = errores.filter((f) => !f.volvio)
if (noVolvieron.length) {
  console.log(`   → los ${noVolvieron.length} que no volvieron (borrado a propósito: renumeración / no era tarea):`)
  for (const f of noVolvieron) console.log(`        ${f.id.padEnd(6)} ${f.sha}  ${f.asunto.slice(0, 64)}`)
}

const porCommit = new Map()
for (const f of errores) porCommit.set(f.sha, (porCommit.get(f.sha) || 0) + 1)
const peores = [...porCommit.entries()].sort((a, b) => b[1] - a[1]).slice(0, 12)

console.log('\n══ COMMITS CON MÁS FICHAS AFECTADAS ' + '═'.repeat(36))
for (const [sha, n] of peores) {
  const f = errores.find((x) => x.sha === sha)
  console.log(`   ${sha}  ${f.fecha}  ${String(n).padStart(2)} ficha(s)   ${f.asunto.slice(0, 70)}`)
  for (const h of errores.filter((x) => x.sha === sha).slice(0, 6)) {
    console.log(`        · ${h.id}  ${h.tipo.padEnd(13)} ${h.charsAntes} → ${h.charsDespues} chars  (−${h.charsPerdidos}, ${Math.round(h.ratio * 100)}%)`)
  }
}

if (TODOS) {
  console.log('\n══ TODOS LOS HALLAZGOS ' + '═'.repeat(49))
  for (const f of filas) {
    console.log(`   ${f.sha} ${f.fecha} ${f.severidad.padEnd(5)} ${f.id.padEnd(6)} ${f.tipo.padEnd(13)} −${String(f.charsPerdidos).padStart(5)} (${Math.round(f.ratio * 100)}%)  ${f.asunto.slice(0, 50)}`)
  }
}

console.log('')
