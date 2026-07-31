// lib/sessions/indiceCompartido.cjs — dos sesiones NO pueden compartir el índice de git. (T-415)
//
// ── EL FALLO, VIVIDO ─────────────────────────────────────────────────────────────────────────
// El 31/07, construyendo justo las herramientas para que las sesiones no se pisen, **otra sesión
// commiteó mis ficheros dentro de su commit**. Mi trabajo (una migración, un núcleo puro, sus
// tests y el guardarraíl) acabó en `main` bajo un mensaje que hablaba de otra cosa. No se perdió
// nada, pero la historia miente y el `outcome` de la ficha no correspondía al commit.
//
// La causa no es descuido de nadie: **el índice de git es del REPOSITORIO, no de la sesión**. Si
// dos sesiones trabajan en el mismo directorio, `git add` de una y `git commit` de la otra son la
// misma cola. Git no puede saber quién puso qué, así que ningún guardarraíl sobre el contenido lo
// arregla — solo dejar de compartir el directorio.
//
// Es el mismo acoplamiento de T-385 (el deploy construía el árbol compartido) una capa más
// arriba, y por eso se resuelve igual: un árbol por sesión.
//
// ── POR QUÉ BLOQUEA, Y POR QUÉ ESTO SÍ PUEDE BLOQUEAR ───────────────────────────────────────
// Hoy se ha aprendido tres veces que un bloqueo IMPOSIBLE de satisfacer enseña a apagar el guard
// entero (T-375). Este es lo contrario: se satisface con **un comando**, y la alternativa —seguir
// compartiendo— corrompe el trabajo ajeno de forma irreversible en la historia.
//
// ── LO QUE NO MOLESTA, A PROPÓSITO ──────────────────────────────────────────────────────────
// UNA sola sesión en el checkout principal es lo NORMAL (la que coordina, la que despliega). El
// problema no es el sitio, es la CONCURRENCIA. Sin al menos dos sesiones vivas ahí, esto calla.

/** Cuánto silencio hace falta para no contar a una sesión. Mismo criterio que el resto. */
const VIVA_MIN = 30

/**
 * ¿Puedo commitear aquí?
 *
 * @param sesiones      filas de `worktree_sessions` ({ sid, worktree_path, last_signal_at })
 * @param sid           mi session-id
 * @param worktreePath  el directorio desde el que voy a commitear
 * @returns {permitido, compañeras:[sid], motivo}
 *
 * Fail-open por construcción: sin sesiones, sin sid o sin ruta **deja pasar**. No saber quién más
 * hay no puede impedirle a nadie commitear — sería la avería de la telemetría bloqueando trabajo,
 * que es exactamente lo que este repo evita en el latido y en el push-guard.
 */
function evaluarIndice({ sesiones, sid, worktreePath, ahora = new Date(), vivaMin = VIVA_MIN } = {}) {
  if (!sid || !worktreePath || !Array.isArray(sesiones) || !sesiones.length) {
    return { permitido: true, companeras: [], motivo: 'sin datos de sesiones: no se puede afirmar nada' }
  }
  const limite = new Date(ahora).getTime() - vivaMin * 60_000
  const companeras = sesiones
    .filter((x) => x && x.sid && x.sid !== sid && x.worktree_path === worktreePath)
    .filter((x) => x.last_signal_at && new Date(x.last_signal_at).getTime() > limite)
    .map((x) => x.sid)

  if (!companeras.length) {
    return { permitido: true, companeras: [], motivo: 'eres la única sesión viva en este directorio' }
  }
  return {
    permitido: false,
    companeras,
    motivo: `${companeras.length} sesión(es) más viva(s) en ${worktreePath}: el índice de git es compartido`,
  }
}

/** El mensaje que se imprime al bloquear. Va aquí para poder testear que DICE cómo salir. */
function mensajeBloqueo({ companeras, worktreePath }, escape = 'INDICE_COMPARTIDO_OK') {
  return [
    '',
    '⛔ COMMIT BLOQUEADO — no eres la única sesión trabajando en este directorio.',
    '',
    `   ${companeras.length} sesión(es) más dieron señal aquí hace menos de ${VIVA_MIN} min:`,
    ...companeras.map((c) => `      · ${String(c).slice(0, 16)}…`),
    '',
    '   El índice de git es del REPOSITORIO, no de tu sesión: lo que otra sesión haya hecho',
    '   `git add` entra en TU commit sin que ni tú ni git podáis saberlo. Pasó el 31/07 — el',
    '   trabajo de una sesión acabó en main bajo el mensaje de otra.',
    '',
    '   Móntate un árbol propio (30 segundos, y no vuelve a pasarte):',
    `      scripts/worktrees/crear-worktree.sh <un-nombre>`,
    '',
    `   Si de verdad tienes que commitear aquí:  ${escape}=1 git commit …`,
    '',
  ].join('\n')
}

module.exports = { evaluarIndice, mensajeBloqueo, VIVA_MIN }
