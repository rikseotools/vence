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
const { needsTypecheck, needsBackendTypecheck } = require('../lib/hooks/typecheckRelevance.cjs')
const { conCandado, interpretarSalida } = require('../lib/hooks/candadoTypecheck.cjs')
const { emitirFriccion } = require('../lib/sessions/friccion.cjs')

/** ¿Existe `flock` en esta máquina? Sin él no se serializa, pero tampoco se impide nada. */
function hayFlock() {
  return spawnSync('sh', ['-c', 'command -v flock'], { stdio: 'ignore' }).status === 0
}

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
  const lista = archivos === null ? [] : archivos

  // Dos proyectos, dos tsconfig, dos comprobaciones. El de la RAÍZ excluye `backend/`, así
  // que sin la segunda un cambio de backend pasa el hook Y el CI y solo revienta al
  // desplegar — que es cuando ya bloquea a todas las sesiones (caso real del 28/07: dos
  // sesiones portaron el mismo detector y `main` quedó con el backend sin compilar).
  const proyectos = [
    { nombre: 'raíz', cwd: REPO, coste: 'con caché ~15 s; en frío ~70 s', ...needsTypecheck(lista) },
    { nombre: 'backend', cwd: `${REPO}/backend`, coste: '~9 s', ...needsBackendTypecheck(lista) },
  ]

  const aCorrer = proyectos.filter((p) => p.correr)
  if (aCorrer.length === 0) {
    console.log(`⏭️  typecheck: ${proyectos[0].motivo} (push sin peaje)`)
    return 0
  }

  let fallo = false
  for (const p of aCorrer) {
    console.log(`🔎 typecheck [${p.nombre}] (${p.motivo})… ${p.coste}.`)
    const t0 = Date.now()
    // El heap por defecto de V8 (~2GB) no basta para `tsc --noEmit` sobre este repo (185 tablas
    // de schema, cientos de `TopicContentView.tsx` casi duplicados por oposición) y revienta con
    // "JavaScript heap out of memory" — verificado el 06/08 corriendo el MISMO `tsc --noEmit` a
    // mano con más heap: 0 errores de tipos, el fallo era solo memoria. Sin este flag el guard
    // bloqueaba TODO push que tocara "código" (T-486, cualquier trabajador de la flota en una
    // máquina de 7-8GB compartida), aunque el código en sí compilase limpio.
    // ── UN TYPECHECK A LA VEZ POR MÁQUINA (T-682) ─────────────────────────────────────────
    // Cada `tsc` de este repo pide >1 GB (y el flag de arriba le PERMITE hasta 6). Cuatro turnos
    // de la flota coinciden en este peaje por construcción —todos pasan por el pre-push— y el
    // 07/08 eso dejó el VPS con la memoria al 98,7 % de presión y la CPU al 0 %: nadie calculaba,
    // todos esperaban memoria. El candado no quita capacidad, solo impide que se pisen.
    const inv = conCandado({
      comando: 'npm', args: ['run', 'typecheck'],
      esperaMaxSegundos: Number(process.env.TYPECHECK_LOCK_WAIT || 900),
      hayFlock: hayFlock(),
    })
    const r = spawnSync(inv.comando, inv.args, {
      cwd: p.cwd,
      stdio: 'inherit',
      env: { ...process.env, NODE_OPTIONS: `${process.env.NODE_OPTIONS || ''} --max-old-space-size=6144`.trim() },
    })
    const seg = ((Date.now() - t0) / 1000).toFixed(0)

    // Esperar al candado es fricción de trabajar en paralelo, igual que esperar al de deploy: va
    // al MISMO bus (`typecheck_espera`), no a un evento propio. Es lo que dirá si el candado basta
    // o si el cuello está antes. Fail-open: la telemetría no puede impedir un push.
    if (inv.conCandado && Number(seg) > 30) {
      try { emitirFriccion({ clase: 'typecheck_espera', guard: 'typecheck-push', detalle: p.nombre, segundos: Number(seg) }) } catch {}
    }
    if (interpretarSalida(r.status, { conCandado: inv.conCandado }) === 'sin_candado') {
      // No es un fallo de tipos: es que otro typecheck lleva la máquina ocupada más de lo previsto.
      // Se corre sin candado antes que dejar a nadie sin poder pushear.
      console.log(`⏳ typecheck [${p.nombre}]: el candado sigue tomado tras ${seg} s — se corre igual, sin serializar.`)
      try { emitirFriccion({ clase: 'typecheck_espera', guard: 'typecheck-push', detalle: `${p.nombre}:sin_candado`, segundos: Number(seg) }) } catch {}
      const r2 = spawnSync('npm', ['run', 'typecheck'], {
        cwd: p.cwd,
        stdio: 'inherit',
        env: { ...process.env, NODE_OPTIONS: `${process.env.NODE_OPTIONS || ''} --max-old-space-size=6144`.trim() },
      })
      r.status = r2.status
      r.error = r2.error
    }

    if (r.error) {
      console.log(`⚠️  typecheck-push-guard [${p.nombre}]: no pude ejecutar npm (${r.error.message}). Se ignora (fail-open).`)
      continue
    }
    if (r.status !== 0) {
      fallo = true
      console.error(`\n❌ PUSH BLOQUEADO — el typecheck del ${p.nombre.toUpperCase()} falla (${seg} s).`)
      if (p.nombre === 'backend') {
        console.error('   ⚠️ Ojo: el CI NO lo habría cazado (su job `typecheck` corre el tsconfig de la')
        console.error('   raíz, que EXCLUYE backend/). Esto solo se ve al desplegar, y para entonces')
        console.error('   bloquea el deploy de todas las sesiones.')
      } else {
        console.error('   Empujar esto deja el CI en ROJO, y un `main` rojo BLOQUEA EL DEPLOY DE TODAS')
        console.error('   LAS SESIONES (gate de CI de deploy-*.sh).')
      }
      console.error(`\n   Arregla los errores de arriba y reintenta.  Ver: (cd ${p.nombre === 'backend' ? 'backend && ' : ''}npm run typecheck)`)
      if (p.relevantes.length) {
        console.error(`   Ficheros en este push (${p.relevantes.length}): ${p.relevantes.slice(0, 8).join(', ')}${p.relevantes.length > 8 ? '…' : ''}`)
      }
    } else {
      console.log(`✅ typecheck [${p.nombre}] OK (${seg} s)`)
    }
  }

  if (fallo) {
    console.error('\n   Si es legítimo (rama de trabajo que no va a main, rehacer historia):')
    console.error('   TYPECHECK_GUARD_SKIP=1 git push …\n')
    return 1
  }
  return 0
}

try {
  process.exit(main())
} catch (e) {
  // Bug del propio guard → fail-open: no romper el push por el hook.
  console.log(`⚠️  typecheck-push-guard error inesperado (${e.message}). Push permitido (fail-open).`)
  process.exit(0)
}
