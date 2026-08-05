#!/usr/bin/env node
// scripts/codigo-push-guard.cjs — bridge del AVISO de código suprimido en la infraestructura de
// coordinación (T-443). Lo invoca `.husky/pre-push`. Reúne los inputs de git, llama a la lógica
// PURA de `lib/backlog/codigoSuprimido.cjs` e IMPRIME si algo se sale de madre. La regla vive en
// ese fichero.
//
// ── POR QUÉ AVISA Y NO BLOQUEA (a diferencia de `contexto-push-guard.cjs`, su hermano) ────────
// El 31/07 el commit 6f3e26261 subió una copia rancia de `scripts/backlog.cjs` que borró 74
// líneas significativas del cableado de [T-427] sin que nada protestara — «un arreglo vivo pero
// inerte». `contexto-push-guard.cjs` ya bloquea este mismo patrón sobre el MARKDOWN del backlog
// (T-428); haría falta lo mismo sobre CÓDIGO.
//
// Pero medido contra los 650 commits reales de los últimos dos meses sobre este mismo alcance
// (`npm run sim:codigo-guard`), el umbral que atrapa el incidente (≥15 líneas) dispara en el
// 4,5% de los commits — 29 casos en dos meses, y **28 de los 29 eran refactors LEGÍTIMOS**
// (simplificar un auditor, consolidar tres copias en una) indistinguibles del incidente por su
// FORMA: ambos son «se borra mucho más de lo que se añade» en el mismo fichero. La única
// diferencia real es SEMÁNTICA —¿el código borrado sigue vivo en otro sitio, huérfano de quien
// lo llamaba?— y eso no se puede leer del diff.
//
// Con ese ratio (1 incidente real por cada 28 avisos), bloquear entrenaría exactamente el
// reflejo que [T-375] ya documentó: un guardarraíl que hay que saltarse casi siempre se acaba
// saltando siempre, y dos de cada tres guardarraíles imposibles de satisfacer de este backlog
// murieron así. Un AVISO, en cambio, no tiene ese coste — nunca bloquea, así que no hay fricción
// que rodear— y sí resuelve el problema real que nombra la ficha de origen: **"los cinco se
// descubrieron por casualidad, ninguno por una alerta"**. Esto es la alerta. Que la lea la propia
// sesión que está pusheando, en el momento en que aún puede parar y mirar.
//
// ── ALCANCE ─────────────────────────────────────────────────────────────────────────────────
// Solo la infraestructura de coordinación entre sesiones: es el sistema que este incidente puso
// en duda, protegiéndose primero a sí mismo. Ver RUTAS abajo.
//
// Fail-open ante infra (sin git, sin origin/main). No hay escape propio porque no hace falta:
// nunca bloquea, así que no hay nada que saltarse.

const path = require('path')
const { execFileSync, spawn } = require('child_process')
const { findCodigoSuprimido, esBloqueante } = require('../lib/backlog/codigoSuprimido.cjs')

const REPO = process.env.CODIGO_GUARD_REPO || path.join(__dirname, '..')

// Mismo alcance que `scripts/backlog/sim-codigo-guard.cjs` — mantenerlos en paridad si cambia.
const RUTAS_ESCOPADAS = [
  /^scripts\/[^/]+\.cjs$/,       // scripts/*.cjs de raíz (no subcarpetas: ahí ya no es coordinación)
  /^lib\/backlog\//,
  /^lib\/sessions\//,
  /^lib\/calidad\//,
  /^\.husky\//,
]

function enAlcance(ruta) {
  return RUTAS_ESCOPADAS.some((re) => re.test(ruta))
}

function friccion(clase, detalle) {
  try {
    const a = ['--clase', clase, '--guard', 'codigo-suprimido']
    if (detalle) a.push('--detalle', String(detalle).slice(0, 200))
    spawn(process.execPath, [path.join(REPO, 'scripts', 'friccion-emitir.cjs'), ...a],
      { detached: true, stdio: 'ignore' }).unref()
  } catch { /* la telemetría nunca estorba a un push */ }
}

function git(args) {
  try { return execFileSync('git', args, { cwd: REPO, encoding: 'utf8', maxBuffer: 1024 * 1024 * 64, stdio: ['ignore', 'pipe', 'ignore'] }) } catch { return null }
}

function main() {
  const tocadosRaw = git(['diff', '--name-only', 'origin/main...HEAD'])
  if (tocadosRaw === null) return 0
  const tocados = tocadosRaw.split('\n').map((l) => l.trim()).filter(Boolean).filter(enAlcance)
  if (!tocados.length) return 0

  // Misma garantía que `contexto-push-guard.cjs`: sin fast-forward no se puede atribuir la
  // supresión a este push (podría ser origin/main por delante, o una rama suelta).
  if (git(['merge-base', '--is-ancestor', 'origin/main', 'HEAD']) === null) return 0

  const avisos = []
  for (const ruta of tocados) {
    const origen = git(['show', `origin/main:${ruta}`])
    const propuesto = git(['show', `HEAD:${ruta}`])
    if (origen === null || propuesto === null) continue // fichero nuevo, o borrado a propósito
    const r = findCodigoSuprimido(origen, propuesto)
    if (esBloqueante(r)) avisos.push({ ruta, ...r })
  }

  if (!avisos.length) return 0

  console.log('\nℹ️  codigo-push-guard: este push suprime código que sigue en `origin/main` (aviso, no bloquea):')
  for (const a of avisos) {
    console.log(`   · ${a.ruta}: −${a.total} líneas significativas (${Math.round(a.ratio * 100)}% del fichero publicado)`)
    for (const s of a.suprimidas.slice(0, 3)) {
      console.log(`        - ${s.linea.slice(0, 90)}`)
    }
  }
  console.log('   Casi siempre es un refactor legítimo. Pero si no reconoces este borrado —o si el')
  console.log('   fichero tenía cableado hacia otro módulo (imports, llamadas)— es EXACTAMENTE el')
  console.log('   patrón del incidente de T-441/T-443: una copia vieja que pisa trabajo ya publicado.')
  console.log(`   Mira el diff real:  git diff origin/main -- ${avisos.map((a) => a.ruta).join(' ')}\n`)
  friccion('guard_aviso', avisos.map((a) => a.ruta).join(','))
  return 0 // nunca bloquea — ver cabecera
}

try {
  process.exit(main())
} catch (e) {
  console.log(`⚠️  codigo-push-guard error inesperado (${e.message}). No opina (fail-open).`)
  process.exit(0)
}
