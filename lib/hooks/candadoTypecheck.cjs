// lib/hooks/candadoTypecheck.cjs — UN typecheck a la vez POR MÁQUINA. (T-682, 07/08/2026)
//
// ── EL PROBLEMA, MEDIDO ──────────────────────────────────────────────────────────────────────
// El VPS de la flota llevaba horas con **carga 18 sobre 4 núcleos**, y se atribuyó a falta de CPU.
// Era falso. La medida que lo decide (PSI, `/proc/pressure`): **CPU 0,00 % · disco 0,00 % ·
// memoria `full` 98,73 %** — durante el 98,7 % del tiempo TODOS los procesos estaban parados
// esperando memoria, y nadie usaba CPU. En Linux el *load average* cuenta también a los que
// esperan; de ahí el 18.
//
// El culpable, con `ps` ordenado por RSS: **cuatro `tsc --noEmit` a la vez**, 1,3 + 1,2 + 0,7 +
// 0,6 = **3,8 GB solo en typechecks**, en una máquina de 7,7 GB donde además viven cuatro sesiones
// de Claude Code. Y no es casualidad que coincidan: **todos los turnos pasan por el mismo peaje**
// (el `pre-push`), así que se solapan por construcción.
//
// Y se realimenta: con la máquina ahogada, el typecheck que tardaba 11 s tarda minutos; al durar
// más se solapa con los siguientes; más presión, más lento. Los turnos pasaron de minutos a horas
// y los trabajadores dejaron de latir dentro de su lease (w1 llegó a 9 h 40 sin señal), o sea que
// el sistema los daba por muertos mientras trabajaban.
//
// ── POR QUÉ UN CANDADO Y NO MENOS TRABAJADORES ──────────────────────────────────────────────
// **El typecheck no es el trabajo, es el peaje.** Serializarlo no quita capacidad: cada uno tarda
// lo mismo y comprueba lo mismo; lo único que cambia es que no se pisan. Hoy los cuatro lo pagan a
// la vez y ninguno avanza. Pico de 3,8 GB → ~1,3 GB, que sí cabe.
//
// ── LAS TRES DECISIONES ──────────────────────────────────────────────────────────────────────
//
// 1. **Por MÁQUINA, no por worktree.** El recurso escaso es la RAM de la máquina, y los cuatro
//    trabajadores tienen árboles distintos: un candado por árbol no serializaría nada.
//
// 2. **MISMA CONVENCIÓN QUE EL DEPLOY, pero con el fallo al revés — y es deliberado.** El
//    cerrojo local del deploy (`scripts/deploy-frontend.sh`) usa `flock` sobre
//    `/tmp/vence-deploy.lock` y **ABORTA** si se agota la espera; éste usa `/tmp/vence-typecheck.lock`
//    y **CORRE IGUAL**. No es una incoherencia: si dos deploys se solapan se pisan dos
//    `update-service` sobre el mismo servicio de ECS y el daño es real; si dos typechecks se
//    solapan solo van lentos. Bloquear un push para siempre por no conseguir un candado sería peor
//    que el problema que arregla. **No las «armonices»: el recurso protegido no es el mismo.**
//
// 3. **FAIL-OPEN con espera acotada.** Si en `esperaMaxSegundos` no se consigue el candado, se
//    corre igual. Un candado que puede dejar a alguien sin poder pushear para siempre es peor que
//    el problema que arregla — y aquí basta con que el caso normal no se solape. Se distingue por
//    código de salida propio (`-E`), para no confundir «no pude coger el candado» con «el
//    typecheck ha fallado», que es justo lo que este guard existe para cazar.
//
// 4. **Si no hay `flock`, se corre sin candado.** Está en util-linux (todo Linux); en otro sistema
//    la ausencia no puede impedir un push.

'use strict'

/** Un solo sitio en la máquina. En `/tmp` a propósito: lo comparten usuarios distintos. */
const RUTA_CANDADO = '/tmp/vence-typecheck.lock'

/** Código con el que `flock` avisa de que se agotó la espera (elegido para no chocar con `tsc`). */
const SALIDA_SIN_CANDADO = 99

/**
 * Envuelve un comando para que solo corra uno a la vez en la máquina.
 *
 * @param {{comando:string, args:string[], esperaMaxSegundos?:number, hayFlock?:boolean, ruta?:string}} p
 * @returns {{comando:string, args:string[], conCandado:boolean, motivo:string}}
 */
function conCandado({ comando, args, esperaMaxSegundos = 900, hayFlock = true, ruta = RUTA_CANDADO } = {}) {
  if (!comando) throw new Error('conCandado: falta el comando')
  if (!hayFlock) {
    return { comando, args: args || [], conCandado: false, motivo: 'sin `flock` en esta máquina: se corre sin serializar' }
  }
  return {
    comando: 'flock',
    args: ['-w', String(esperaMaxSegundos), '-E', String(SALIDA_SIN_CANDADO), ruta, comando, ...(args || [])],
    conCandado: true,
    motivo: `un typecheck a la vez por máquina (espera hasta ${esperaMaxSegundos} s)`,
  }
}

/**
 * ¿Qué significa el código de salida?
 *
 * Separar «no conseguí el candado» de «el typecheck falló» es lo único que impide que este candado
 * se coma un fallo de tipos, que es exactamente lo que el guard existe para cazar.
 *
 * @returns {'sin_candado'|'ok'|'fallo'}
 */
function interpretarSalida(codigo, { conCandado = true } = {}) {
  if (conCandado && codigo === SALIDA_SIN_CANDADO) return 'sin_candado'
  return codigo === 0 ? 'ok' : 'fallo'
}

module.exports = { conCandado, interpretarSalida, RUTA_CANDADO, SALIDA_SIN_CANDADO }
