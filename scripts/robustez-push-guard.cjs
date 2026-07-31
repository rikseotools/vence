#!/usr/bin/env node
/**
 * scripts/robustez-push-guard.cjs — puente git ↔ `lib/calidad/robustezPushGuard.cjs`.
 *
 * Bloquea el push cuando toca código de producción **sin una sola capa** que lo acompañe, o
 * cuando estrena una señal de observabilidad **que ninguna regla vigila**. El porqué y las
 * reglas, en el núcleo puro (testeado); aquí solo se lee git y se imprime.
 *
 * Fail-open: si algo del propio guard falla (git raro, ficheros movidos), NO se bloquea. Un
 * guardarraíl que rompe el push por sus propios fallos se desactiva en dos días.
 *
 * Escape: `ROBUSTEZ_GUARD_SKIP=1 git push …` — legítimo para un hotfix o un cambio mecánico.
 * Queda impreso, que es lo que lo mantiene honesto.
 */
const { execFileSync } = require('child_process')
const { readFileSync, existsSync } = require('fs')
const { join } = require('path')
const { evaluarPush } = require('../lib/calidad/robustezPushGuard.cjs')

const RAIZ = join(__dirname, '..')

function git(args) {
  return execFileSync('git', args, { cwd: RAIZ, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 })
}

/**
 * Rango que se empuja: **desde la base común**, no desde la punta de `origin/main`.
 *
 * Los tres puntos son la diferencia entre funcionar y no funcionar, y costó una prueba
 * negativa descubrirlo: con `origin/main..HEAD` (dos puntos) el diff compara los dos
 * extremos, así que cuando otra sesión ha pusheado mientras tanto **se cuelan sus ficheros**
 * — y como casi siempre traen algún test, el guard veía «capas» que no eran de este push y
 * dejaba pasar cualquier cosa. Con `...` se compara contra el ancestro común: exactamente lo
 * que aporta esta rama y nada más.
 */
function rango() {
  try {
    git(['rev-parse', '--verify', 'origin/main'])
    return 'origin/main...HEAD'
  } catch {
    return null
  }
}

/** Catálogos donde vive la vigilancia: si una señal aparece aquí, alguien la mira. */
function textoVigilancia(rutasDelPush) {
  const ficheros = [
    'backend/src/alerts/alert-rules.ts',
    'backend/src/alerts/benign-signals.ts',
    'lib/observability/benignSignals.ts',
  ]
  let texto = ''
  for (const f of ficheros) {
    const p = join(RAIZ, f)
    if (existsSync(p)) texto += readFileSync(p, 'utf8')
  }
  // Si el propio push toca esos catálogos, el contenido de disco YA los incluye (el hook corre
  // sobre el árbol de trabajo). No hace falta nada más: por eso «añadir la señal y su regla en
  // el mismo commit» pasa el gate, que es justo el comportamiento que se quiere premiar.
  return texto
}

function main() {
  if (process.env.ROBUSTEZ_GUARD_SKIP === '1') {
    console.log('⏭️  robustez-push-guard saltado a propósito (ROBUSTEZ_GUARD_SKIP=1).')
    return 0
  }

  const r = rango()
  if (!r) return 0

  const rutas = git(['diff', '--name-only', r]).split('\n').map((s) => s.trim()).filter(Boolean)
  if (rutas.length === 0) return 0
  const diff = git(['diff', '-U0', r])

  const { allowed, motivos } = evaluarPush(rutas, diff, textoVigilancia(rutas))
  if (allowed) return 0

  console.error('')
  console.error('🛡️  ROBUSTEZ — este push va sin red:')
  console.error('')
  for (const m of motivos) console.error(`   ❌ ${m.detalle}`)
  console.error('')
  console.error('   Antes de pushear, lo que corresponda al cambio:')
  console.error('     · test unitario del núcleo que decide algo')
  console.error('     · guardarraíl si hay un contrato que otro puede romper sin querer')
  console.error('     · simulación contra servidor real si el fallo solo aparece vivo')
  console.error('     · canary si lo que puede romperse es el sistema DESPLEGADO')
  console.error('     · y que toda señal nueva tenga quien la mire')
  console.error('')
  console.error('   Si de verdad no aplica (hotfix, cambio mecánico):')
  console.error('     ROBUSTEZ_GUARD_SKIP=1 git push …')
  console.error('')
  return 1
}

let code = 0
try {
  code = main()
} catch (e) {
  // Fail-open a propósito.
  console.error(`⚠️  robustez-push-guard no pudo evaluar (${e.message}) — se deja pasar.`)
  code = 0
}
process.exit(code)
