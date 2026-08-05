// lib/flota/actualizacion.cjs — el clon del trabajador, al día ANTES de cada encargo. (T-486)
//
// ── EL AGUJERO QUE CIERRA, MEDIDO ────────────────────────────────────────────────────────────
// El 05/08, con la flota ya en marcha, `w1` se quedó parado preguntando si podía leer
// `observable_events`. Tenía la credencial del rol de lectura en su entorno desde hacía horas. Lo
// que NO tenía era el código: **su clon llevaba 30 commits de retraso**, congelado en el commit con
// el que se aprovisionó la máquina. Le faltaban `canary-rol-lector.cjs` —con el que habría
// comprobado su propio permiso en diez segundos— y el comando `backlog.cjs revision`, que es
// justamente la salida que su situación pedía.
//
// El daño no es «va con una versión vieja». Es que **lo que hace segura a la flota son los
// guardarraíles**, y un clon viejo trae los de entonces: el push-guard que no contempla el commit
// parcial, el gate de tests que no corría dentro de un worktree de agente, el detector que ya se
// arregló. Un trabajador desactualizado no es uno con menos funciones — es uno **con las
// protecciones de otra fecha**, trabajando sin nadie delante.
//
// ── POR QUÉ FALLA CERRADO ────────────────────────────────────────────────────────────────────
// Si no se puede dejar el clon al día, NO se manda el encargo. Es la misma regla que [T-539]: el
// fail-open es para personas —quien está delante puede juzgar— y un trabajador autónomo sin
// supervisión tiene que pararse. Mandarle trabajo sabiendo que su código no es el vigente es
// pedirle horas que luego hay que tirar.
//
// ── Y POR QUÉ NO SE ARREGLA A LA BRAVA ───────────────────────────────────────────────────────
// Nada de `git reset --hard` ni `git clean`: un clon con cambios sin commitear puede ser lo único
// que quede de un trabajo (la lección de los worktrees huérfanos, [T-431]). Se rehúsa y se dice
// qué hay; decidir que eso se tira es de una persona.

/**
 * Lo que se le pregunta a la máquina. Una sola orden, salida determinista y fácil de leer a ojo.
 *
 * El árbol se pasa desde el registro de máquinas (`arbolDe`) porque **no es el mismo en todas**:
 * un worktree por trabajador en el portátil, un clon compartido en el VPS.
 */
const SONDA_GIT = (arbol) => [
  `cd ${arbol} 2>/dev/null || exit 90`,
  'git fetch -q origin main 2>/dev/null && echo FETCH=ok || echo FETCH=fallo',
  'echo HEAD=$(git rev-parse --short HEAD)',
  'echo ATRAS=$(git rev-list --count HEAD..origin/main 2>/dev/null || echo -1)',
  // ADELANTE mide lo que existe **en NINGÚN otro sitio**, no lo que falta en `origin/main`.
  // No es lo mismo: un trabajador trabaja en su propia rama, así que contra `origin/main` sus
  // commits salen «adelantados» para siempre aunque estén empujados y a salvo — un bloqueo que
  // no se puede satisfacer se acaba rodeando ([T-375]). Lo que de verdad hay que proteger es el
  // commit que solo vive en esa máquina, y eso es `HEAD --not --remotes`.
  'echo ADELANTE=$(git rev-list --count HEAD --not --remotes 2>/dev/null || echo -1)',
  'echo SUCIO=$(git status --porcelain | wc -l)',
].join('; ')

/** `git pull` en su versión que NO puede perder nada: si no es avance directo, falla. */
const ORDEN_ACTUALIZAR = (arbol) =>
  `cd ${arbol} && git pull --ff-only -q origin main && git rev-parse --short HEAD`

/**
 * Lee la salida de la sonda. Lo que no venga se queda en `null`, nunca en 0.
 *
 * Un campo ausente leído como 0 diría «está al día» justo cuando no se pudo mirar, que es el falso
 * verde que este repo persigue.
 */
function leerSonda(salida) {
  const s = String(salida || '')
  const campo = (nombre) => {
    const m = s.match(new RegExp('^' + nombre + '=(.*)$', 'm'))
    return m ? m[1].trim() : null
  }
  const num = (nombre) => {
    const v = campo(nombre)
    if (v === null || v === '' || !/^-?\d+$/.test(v)) return null
    const n = Number(v)
    return n < 0 ? null : n
  }
  return { fetch: campo('FETCH'), head: campo('HEAD'), atras: num('ATRAS'), adelante: num('ADELANTE'), sucio: num('SUCIO') }
}

/**
 * ¿Se le puede mandar trabajo a este clon?
 *
 * @returns {estado, puedeEncargar, hayQueActualizar, motivo}
 *
 * `estado`:
 *   · `al_dia`      — nada que hacer
 *   · `atrasado`    — limpio y se puede avanzar: se actualiza y adelante
 *   · `sucio`       — hay cambios sin commitear: podrían ser el único rastro de un trabajo
 *   · `adelantado`  — tiene commits que no están en origin: se perderían al mirar para otro lado
 *   · `divergido`   — las dos cosas a la vez
 *   · `sin_repo`    — no hay clon donde se esperaba
 *   · `sin_red`     — no pudo consultar origin: no se sabe, y no saber no es estar al día
 */
function evaluarClon(sonda, { reanuda = false } = {}) {
  const s = sonda || {}
  if (s.fetch === null && s.head === null) {
    return { estado: 'sin_repo', puedeEncargar: false, hayQueActualizar: false, motivo: 'no hay un clon del repo en ~/vence' }
  }
  if (s.fetch !== 'ok' || s.atras === null || s.adelante === null) {
    return { estado: 'sin_red', puedeEncargar: false, hayQueActualizar: false, motivo: 'no se pudo consultar origin/main: no se sabe si el código está al día' }
  }
  if (s.sucio === null) {
    return { estado: 'sin_red', puedeEncargar: false, hayQueActualizar: false, motivo: 'no se pudo leer el estado del árbol' }
  }
  // ── TRABAJO A MEDIAS: bloquea lo NUEVO, no lo SUYO ────────────────────────────────────────
  // Empezar una tarea distinta encima de un trabajo sin terminar es como se pierde ese trabajo.
  // Pero RETOMAR el suyo con el árbol a medias es lo normal —es exactamente el estado en que lo
  // dejó— y bloquearlo dejaría al trabajador encallado para siempre: un bloqueo que no se puede
  // satisfacer se acaba rodeando ([T-375]). Medido el 05/08 con `l1`: turno terminado a media
  // tarea, 11 ficheros sin commitear y ni un commit, con la única copia de ese trabajo ahí.
  const aMedias = s.sucio > 0 || s.adelante > 0
  if (aMedias && reanuda) {
    const que = [s.sucio > 0 ? `${s.sucio} fichero(s) sin commitear` : null,
      s.adelante > 0 ? `${s.adelante} commit(s) sin empujar` : null].filter(Boolean).join(' y ')
    return {
      estado: 'a_medias', puedeEncargar: true, hayQueActualizar: false,
      motivo: `retoma su tarea con ${que} en el árbol — hay que decírselo, es lo primero que tiene que asegurar`,
    }
  }
  if (s.sucio > 0 && s.adelante > 0) {
    return { estado: 'divergido', puedeEncargar: false, hayQueActualizar: false, motivo: `${s.sucio} fichero(s) sin commitear y ${s.adelante} commit(s) que solo existen en esa máquina` }
  }
  if (s.sucio > 0) {
    return { estado: 'sucio', puedeEncargar: false, hayQueActualizar: false, motivo: `${s.sucio} fichero(s) sin commitear — podrían ser el único rastro de un trabajo` }
  }
  if (s.adelante > 0) {
    return { estado: 'adelantado', puedeEncargar: false, hayQueActualizar: false, motivo: `${s.adelante} commit(s) suyos no están en NINGÚN remoto: solo existen en esa máquina` }
  }
  if (s.atras > 0) {
    return { estado: 'atrasado', puedeEncargar: true, hayQueActualizar: true, motivo: `${s.atras} commit(s) por detrás de origin/main` }
  }
  return { estado: 'al_dia', puedeEncargar: true, hayQueActualizar: false, motivo: null }
}

/**
 * Con qué severidad entra en el bus. Misma política que la autenticación: lo normal no grita.
 *
 * Un clon que no se puede poner al día es `error` — el trabajador está arrancado y no va a recibir
 * trabajo—; `atrasado` es `info` porque se arregla solo aquí mismo, y es el dato que dice cada
 * cuánto se queda atrás la flota.
 */
const severidad = (v) => (['al_dia', 'atrasado', 'a_medias'].includes(v.estado) ? 'info' : 'error')

/** La línea del panel: qué pasa y qué hacer. `null` cuando no hay nada que contar. */
function diagnostico(trabajador, v, { commits = null } = {}) {
  switch (v.estado) {
    case 'al_dia': return null
    case 'atrasado':
      return `⬆️  ${trabajador}: clon ${v.motivo} — se actualiza antes del encargo${commits ? ` (${commits})` : ''}`
    case 'a_medias':
      return `📌 ${trabajador}: ${v.motivo}`
    case 'sucio':
      return `🔴 ${trabajador}: NO se le encarga — ${v.motivo}. Míralo en la máquina antes de tirarlo (tmux attach -t ${trabajador})`
    case 'adelantado':
    case 'divergido':
      return `🔴 ${trabajador}: NO se le encarga — ${v.motivo}. Es trabajo que puede no estar en ningún otro sitio`
    case 'sin_repo':
      return `🔴 ${trabajador}: no hay clon en ~/vence — hay que aprovisionar la máquina (scripts/flota/arrancar-trabajador.sh)`
    default:
      return `🔴 ${trabajador}: ${v.motivo} — sin poder comprobarlo NO se manda encargo (un clon viejo trae los guardarraíles de otra fecha)`
  }
}

module.exports = { SONDA_GIT, ORDEN_ACTUALIZAR, leerSonda, evaluarClon, severidad, diagnostico }
