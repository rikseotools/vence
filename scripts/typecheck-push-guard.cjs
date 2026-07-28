#!/usr/bin/env node
// scripts/typecheck-push-guard.cjs — bridge del guardarraíl de tipos (lo invoca .husky/pre-push).
//
// Corre `npm run typecheck` ANTES de que el push llegue a `main`, pero SOLO si los commits que
// se empujan tocan código que el typecheck mira. La regla de relevancia es pura y vive en
// `lib/hooks/typecheckRelevance.cjs`; aquí solo se reúnen los inputs reales y se ejecuta.
//
// ## Por qué existe (T-225, 28/07/2026)
//
// El check `Typecheck` de GHA es uno de los que mira el gate de CI de los scripts de deploy:
// un `main` rojo por tipos **bloquea el despliegue de TODAS las sesiones**. El pre-commit
// corre tests, y los tests unitarios NO ven un error de tipos. Caso real de ese día:
// `scripts/backfill-explanation-data.ts` usaba un campo que el `SELECT` ya pedía pero el tipo
// no declaraba (TS2339) → `main` rojo → tres vueltas para desplegar un fix de una línea, y el
// tiempo lo perdió otra sesión.
//
// ## Filosofía de fallo (calcada del hermano `backlog-push-guard.cjs`, que ya vive en este hook)
//
//   · FAIL-CLOSED en lo único que este guard existe para cazar: si `tsc` encuentra errores de
//     tipos en código que empujas → bloquea (exit 1).
//   · FAIL-OPEN ante problemas de INFRA (no está el script, no arranca `npm`): avisa y deja
//     pasar. Bloquear pushes por un fallo del propio hook sería peor que el fallo que evita.
//   · Cortocircuito: un push que solo toca documentación no paga peaje (0 s).
//
// Escape hatch: TYPECHECK_GUARD_SKIP=1 git push … (mismo patrón que BACKLOG_GUARD_SKIP).

const path = require('path')
const { execFileSync, spawnSync } = require('child_process')
const { needsTypecheck } = require('../lib/hooks/typecheckRelevance.cjs')

const REPO = path.join(__dirname, '..')

function git(args) {
  try {
    return execFileSync('git', args, { cwd: REPO, encoding: 'utf8' }).trim()
  } catch {
    return ''
  }
}

/**
 * Ficheros que cambian los commits que se van a empujar: los que están en HEAD y no en
 * `origin/main`. Mismo rango que usa el guard del backlog para leer los mensajes, así los dos
 * hooks juzgan exactamente el mismo conjunto de commits.
 *
 * Devuelve `null` si no se puede resolver el rango → el módulo puro lo interpreta como
 * "no lo sé" y manda correr el typecheck (conservador).
 */
function changedFiles() {
  const salida = git(['diff', '--name-only', 'origin/main...HEAD'])
  if (!salida) {
    // Sin upstream resuelto (rama nueva sin fetch, repo recién clonado) no se puede acotar.
    // Distinguir "nada cambió" de "no lo sé" importa: lo primero se salta, lo segundo NO.
    const hayRango = git(['rev-parse', '--verify', '--quiet', 'origin/main'])
    return hayRango ? [] : null
  }
  return salida.split('\n').filter(Boolean)
}

function main() {
  if (process.env.TYPECHECK_GUARD_SKIP === '1') {
    console.log('⏭️  typecheck-push-guard saltado (TYPECHECK_GUARD_SKIP=1)')
    return 0
  }

  const archivos = changedFiles()
  // Rango resuelto y vacío = no hay nada que empujar. Distinto de `null` ("no lo sé"), que el
  // módulo puro convierte en "corre igualmente".
  if (archivos !== null && archivos.length === 0) {
    console.log('⏭️  typecheck: el push no trae cambios de fichero')
    return 0
  }
  const { correr, motivo, relevantes } = needsTypecheck(archivos === null ? [] : archivos)
  if (!correr) {
    console.log(`⏭️  typecheck: ${motivo} (push sin peaje)`)
    return 0
  }

  console.log(`🔎 typecheck (${motivo})… la caché incremental lo deja en ~15 s; en frío, ~70 s.`)
  const t0 = Date.now()
  const r = spawnSync('npm', ['run', 'typecheck'], { cwd: REPO, stdio: 'inherit' })
  const seg = ((Date.now() - t0) / 1000).toFixed(0)

  if (r.error) {
    console.log(`⚠️  typecheck-push-guard: no pude ejecutar npm (${r.error.message}). Push permitido (fail-open).`)
    return 0
  }
  if (r.status !== 0) {
    console.error(`\n❌ PUSH BLOQUEADO — el typecheck falla (${seg} s). Empujar esto deja el CI en ROJO,`)
    console.error('   y un `main` rojo BLOQUEA EL DEPLOY DE TODAS LAS SESIONES (gate de CI de deploy-*.sh).')
    console.error('\n   Arregla los errores de arriba y reintenta.  Ver: npm run typecheck')
    console.error('   Si es legítimo (rama de trabajo que no va a main, rehacer historia):')
    console.error('   TYPECHECK_GUARD_SKIP=1 git push …\n')
    if (relevantes.length) {
      console.error(`   Ficheros de código en este push (${relevantes.length}): ${relevantes.slice(0, 8).join(', ')}${relevantes.length > 8 ? '…' : ''}\n`)
    }
    return 1
  }

  console.log(`✅ typecheck OK (${seg} s)`)
  return 0
}

try {
  process.exit(main())
} catch (e) {
  // Bug del propio guard → fail-open: no romper el push por el hook.
  console.log(`⚠️  typecheck-push-guard error inesperado (${e.message}). Push permitido (fail-open).`)
  process.exit(0)
}
