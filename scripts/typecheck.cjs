#!/usr/bin/env node
/**
 * typecheck.cjs — `npm run typecheck`, pero pasando por el candado de máquina. [T-708, 08/08/2026]
 *
 * ## Por qué existe: el candado cubría UNA puerta y el tráfico venía por la otra
 *
 * [T-682] serializó los typechecks porque cuatro `tsc` a la vez se comían 3,8 GB en una máquina de
 * 7,7 y dejaban al VPS con la memoria al 98,7 % de presión. Pero lo puso en el `pre-push`, y ahí
 * NO va la mayor parte del tráfico:
 *   · el método de la casa dice «corre typecheck antes de pushear» — eso es `npm run typecheck`;
 *   · quien REVISA una entrega clona el repo aparte y corre los tests y el typecheck a mano;
 *   · y los turnos de la flota lo invocan directamente.
 * Todos esos se lo saltaban. **Medido el 08/08**: dos `tsc --noEmit` simultáneos, los dos lanzados
 * como `sh -c tsc --noEmit` (o sea, `npm run typecheck`, no el hook), con la máquina a **carga 7**,
 * presión de memoria `full` al **19,6 %** y el **swap al 92 %** (3.773 MB de 4.095). El candado
 * estaba puesto y no protegía nada, porque nadie pasaba por él.
 *
 * Es el noveno principio del sistema de sesiones: **impedir en el punto de escritura**. El punto
 * aquí no es el hook, es el comando.
 *
 * ## Lo que NO cambia
 *
 * El comportamiento visible: mismo `tsc --noEmit`, misma salida, mismo código de retorno. Si no
 * hay `flock`, corre igual (fail-open). Si el candado no llega en 900 s, corre igual — un candado
 * que puede dejar a alguien sin poder trabajar es peor que el problema que arregla. Y si ya viene
 * envuelto por el `pre-push`, NO vuelve a pedirlo: `flock` no es reentrante entre procesos y el
 * hijo esperaría a su propio padre.
 *
 * En CI el candado es gratis: cada runner está solo en su máquina, así que lo coge al instante.
 */
'use strict'

const path = require('path')
const { spawnSync } = require('child_process')

const REPO = path.resolve(__dirname, '..')
const {
  conCandado, interpretarSalida, yaEstaBajoCandado, MARCA_ENTORNO,
} = require(path.join(REPO, 'lib', 'hooks', 'candadoTypecheck.cjs'))

const TSC = path.join(REPO, 'node_modules', '.bin', 'tsc')
const ARGS = ['--noEmit', ...process.argv.slice(2)]

/** ¿Está `flock` en esta máquina? En Linux siempre (util-linux); en otras, puede que no. */
function hayFlock() {
  return spawnSync('flock', ['--version'], { stdio: 'ignore' }).status === 0
}

function main() {
  // Ya envuelto por quien nos llamó (el `pre-push`): correr pelado, o nos esperaríamos a nosotros.
  if (yaEstaBajoCandado(process.env)) {
    return spawnSync(TSC, ARGS, { cwd: REPO, stdio: 'inherit' }).status ?? 1
  }

  const inv = conCandado({
    comando: TSC,
    args: ARGS,
    esperaMaxSegundos: Number(process.env.TYPECHECK_LOCK_WAIT || 900),
    hayFlock: hayFlock(),
  })

  const t0 = Date.now()
  const r = spawnSync(inv.comando, inv.args, {
    cwd: REPO,
    stdio: 'inherit',
    env: { ...process.env, [MARCA_ENTORNO]: inv.conCandado ? '1' : '' },
  })
  const seg = (Date.now() - t0) / 1000

  const veredicto = interpretarSalida(r.status, { conCandado: inv.conCandado })
  if (veredicto === 'sin_candado') {
    // No es un fallo de tipos: es que otro typecheck lleva 15 min. Se dice y se corre igual, para
    // no confundir jamás «no pude coger el candado» con «tu código no compila».
    console.error(`⚠️  typecheck: no se pudo coger el candado en ${inv.args[1]} s — se corre sin serializar.`)
    return spawnSync(TSC, ARGS, { cwd: REPO, stdio: 'inherit' }).status ?? 1
  }
  // Solo se canta la espera cuando de verdad la hubo: un aviso en cada invocación es ruido.
  if (inv.conCandado && seg > 30) {
    console.error(`ℹ️  typecheck: ${seg.toFixed(0)} s (incluye la espera al candado de máquina — T-682/T-708)`)
  }
  return r.status ?? 1
}

process.exit(main())
