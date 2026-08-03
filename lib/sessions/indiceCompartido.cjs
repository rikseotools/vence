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

// ── LA MÁQUINA IMPORTA, Y HASTA EL 02/08 NO SE MIRABA (T-484) ───────────────────────────────
// Todo lo de arriba es cierto DENTRO de una máquina. Entre máquinas es justo al revés: dos
// sesiones en `/app/vence` de dos contenedores distintos tienen discos distintos e índices de git
// distintos, así que no se pisan en nada. Comparando solo la ruta, este guard —que BLOQUEA— paraba
// el commit de una flota entera y empujaba a usar `INDICE_COMPARTIDO_OK=1` a diario, que es como
// se muere un guardarraíl (T-423): no por dejar de bloquear, por bloquear lo que no debe.
//
// La comparación es de TRES estados a propósito, no de dos:
//   · mismo sitio          → cuenta (es el caso que existe para cazar)
//   · otra máquina, SEGURO → no cuenta (los dos hosts conocidos y distintos)
//   · no se sabe           → cuenta, igual que hoy. Una fila sin `host` (sesión con la versión
//     anterior del latido) no puede afirmar «estoy en otra máquina», y ante la duda este guard
//     tiene que seguir protegiendo: lo que evita es irreversible, lo que cuesta es un comando.

/** Cuánto silencio hace falta para no contar a una sesión. Mismo criterio que el resto. */
const VIVA_MIN = 30

// La comparación de máquinas la define `sid.cjs`, que es donde vive la identidad. Aquí solo se
// decide qué hacer con su `null` (ante la duda, seguir protegiendo).
const { mismaMaquina } = require('./sid.cjs')

/**
 * ¿Puedo commitear aquí?
 *
 * @param sesiones      filas de `worktree_sessions` ({ sid, worktree_path, host, last_signal_at })
 * @param sid           mi session-id
 * @param worktreePath  el directorio desde el que voy a commitear
 * @param host          mi máquina (`maquina()` de sid.cjs). Sin él no se descarta a nadie.
 * @returns {permitido, compañeras:[sid], motivo}
 *
 * Fail-open por construcción: sin sesiones, sin sid o sin ruta **deja pasar**. No saber quién más
 * hay no puede impedirle a nadie commitear — sería la avería de la telemetría bloqueando trabajo,
 * que es exactamente lo que este repo evita en el latido y en el push-guard.
 */
function evaluarIndice({ sesiones, sid, worktreePath, host = null, ahora = new Date(), vivaMin = VIVA_MIN } = {}) {
  if (!sid || !worktreePath || !Array.isArray(sesiones) || !sesiones.length) {
    return { permitido: true, companeras: [], motivo: 'sin datos de sesiones: no se puede afirmar nada' }
  }
  const limite = new Date(ahora).getTime() - vivaMin * 60_000
  const companeras = sesiones
    .filter((x) => x && x.sid && x.sid !== sid && x.worktree_path === worktreePath)
    // Otra MÁQUINA no comparte índice. Solo se descarta cuando se puede AFIRMAR (los dos hosts
    // conocidos y distintos); con cualquiera de los dos en blanco, sigue contando.
    .filter((x) => mismaMaquina(host, x.host) !== false)
    .filter((x) => x.last_signal_at && new Date(x.last_signal_at).getTime() > limite)
    .map((x) => x.sid)

  if (!companeras.length) {
    return { permitido: true, companeras: [], motivo: 'eres la única sesión viva en este directorio' }
  }
  const donde = host ? `${host}:${worktreePath}` : worktreePath
  return {
    permitido: false,
    companeras,
    motivo: `${companeras.length} sesión(es) más viva(s) en ${donde}: el índice de git es compartido`,
  }
}

/** El mensaje que se imprime al bloquear. Va aquí para poder testear que DICE cómo salir. */
function mensajeBloqueo({ companeras, worktreePath, host = null }, escape = 'INDICE_COMPARTIDO_OK') {
  return [
    '',
    '⛔ COMMIT BLOQUEADO — no eres la única sesión trabajando en este directorio.',
    ...(host ? [`   (máquina ${host} · ${worktreePath})`] : []),
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
    // El escape pide un MOTIVO desde T-496: un «1» se copiaba de un comando a otro y dejaba a la
    // sesión sin guard para siempre (6 de 10 escapes medidos no respondían a ningún bloqueo).
    `   Si de verdad tienes que commitear aquí, di POR QUÉ (queda registrado):`,
    `      ${escape}="…tu motivo…" git commit …`,
    '',
  ].join('\n')
}

// ── EL ESCAPE PEDÍA UN «1», Y UN «1» SE ESCRIBE SIN PENSAR (T-496, 02/08/2026) ───────────────
// Medido sobre 7 días de `sesion_friccion`: el guard se rodeaba el **67%** de las veces, que en la
// escala de T-423 es la banda `muerto`. Pero al desglosarlo por sesión apareció otra cosa:
//
//   **6 de los 10 escapes NUNCA fueron precedidos de un bloqueo a esa sesión.** Dos sesiones
//   escaparon dos veces cada una **sin que el guard las hubiera parado jamás**.
//
// O sea que no es un guardarraíl que estorba y se rodea: es un escape que se ha adoptado como
// PREFIJO. `INDICE_COMPARTIDO_OK=1 git commit …` se copia de un comando anterior y ya nunca se
// quita, y a partir de ahí el guard no protege a esa sesión aunque nunca hubiera tenido que
// pararla.
//
// El arreglo NO es endurecer el criterio —el criterio acertó: la única sesión que respetó el
// bloqueo se montó un worktree y no hubo problema— sino **cobrar por el escape**: un MOTIVO, como
// ya hacen `claim --force --motivo`, `snooze --motivo` y `retirar --motivo`. Un motivo no se
// arrastra de un comando a otro sin darse cuenta, y además queda escrito.
//
// **No añade ningún bloqueo nuevo:** si el valor no es un motivo, el guard simplemente se EVALÚA.
// Cuando no hay otra sesión en el directorio —que es el caso de casi todos los escapes
// preventivos— el commit pasa igual. Solo deja de ser una llave maestra.

/** Un motivo más corto que esto es un «xx» para saltarse la comprobación. */
const MOTIVO_MIN = 12

/** Valores que NO son un motivo: lo que se teclea para quitarse de encima una comprobación. */
const NO_ES_MOTIVO = new Set(['1', 'true', 'yes', 'si', 'sí', 'ok', 'y', 'skip'])

/**
 * ¿El valor de `INDICE_COMPARTIDO_OK` justifica saltarse la comprobación?
 *
 * @returns {usa, permitido, motivo, problema}
 *   · `usa`        — se ha intentado escapar (la variable trae algo). Se cuenta aunque no valga.
 *   · `permitido`  — hay un motivo de verdad.
 *   · `problema`   — qué le falta, para poder decirlo en vez de fallar de forma muda.
 */
function evaluarEscape(valor) {
  const v = String(valor == null ? '' : valor).trim()
  if (!v) return { usa: false, permitido: false, motivo: null, problema: null }
  if (NO_ES_MOTIVO.has(v.toLowerCase())) {
    return { usa: true, permitido: false, motivo: null,
      problema: 'el escape ya no acepta un «1»: escribe POR QUÉ tienes que commitear aquí' }
  }
  if (v.length < MOTIVO_MIN) {
    return { usa: true, permitido: false, motivo: v,
      problema: `el motivo tiene ${v.length} caracteres: di qué estás haciendo, no «${v}»` }
  }
  return { usa: true, permitido: true, motivo: v, problema: null }
}

module.exports = { evaluarIndice, mensajeBloqueo, mismaMaquina, evaluarEscape, MOTIVO_MIN, VIVA_MIN }
