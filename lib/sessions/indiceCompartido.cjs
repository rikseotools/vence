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

// ── EL COMMIT PARCIAL NO USA EL ÍNDICE COMPARTIDO (T-486, 04/08/2026) ───────────────────────
// Este guard bloquea porque «lo que otra sesión haya hecho `git add` entra en TU commit». Eso es
// cierto para el commit normal — y solo para él. Con `git commit -- <rutas>` git construye un
// índice TEMPORAL con las rutas que nombras y commitea desde ahí: lo que la otra sesión tenga
// preparado ni entra ni se toca. Ya no es que sea improbable, es que no puede pasar.
//
// No es una teoría: al medir los escapes de este guard, **2 de los 3 posteriores a [T-496]** (los
// primeros con motivo escrito) decían exactamente eso — *«ya estaba en el índice cuando otra
// sesión empezó a latir aquí; commiteo con rutas explícitas»*. O sea que el caso legítimo ya se
// estaba resolviendo BIEN, y el guard obligaba a apagarse para hacerlo.
//
// La señal es `GIT_INDEX_FILE`, que git exporta a los hooks, y el corte es ESTRECHO a propósito:
//
//   · `.git/index`              → commit normal. Índice compartido. BLOQUEA.
//   · `.git/next-index-<pid>`   → commit parcial. Índice propio y efímero. Deja pasar.
//   · `.git/index.lock`         → `git commit -a`. **También es un índice distinto y AUN ASÍ
//                                 arrastra lo ajeno** (barre el árbol de trabajo entero, que
//                                 también se comparte). Medido: se llevó el fichero de la otra
//                                 sesión. BLOQUEA.
//
// Por eso NO vale la regla cómoda «índice distinto del normal → deja pasar»: abriría con `-a`
// justo el agujero que este guard existe para cerrar.
//
// Y no rebaja lo que protege: la avería de [T-415] es que entra en tu commit algo que **nunca
// nombraste**. Nombrar las rutas es un acto explícito; que el árbol de trabajo se comparta es
// otro problema, y este guard nunca bloqueó por eso.

/** El índice temporal de un commit parcial. Lo nombra así git (`commit.c`), no nosotros. */
const PREFIJO_INDICE_PARCIAL = 'next-index-'

/**
 * ¿El commit en curso es PARCIAL (`git commit -- <rutas>`)?
 *
 * @param gitIndexFile  el `GIT_INDEX_FILE` que git da al hook (puede venir vacío, relativo o absoluto)
 *
 * Se mira solo el NOMBRE del fichero: git lo escribe dentro del propio `.git`, y comparar la ruta
 * entera obligaría a resolver el git-dir aquí dentro —este módulo es puro y no toca disco—.
 * Ante la duda (variable vacía o rara) devuelve `false`, que es seguir protegiendo.
 */
function esCommitParcial(gitIndexFile) {
  if (!gitIndexFile) return false
  const base = String(gitIndexFile).trim().replace(/\\/g, '/').split('/').filter(Boolean).pop() || ''
  return base.startsWith(PREFIJO_INDICE_PARCIAL)
}

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
function evaluarIndice({ sesiones, sid, worktreePath, host = null, ahora = new Date(), vivaMin = VIVA_MIN, commitParcial = false } = {}) {
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
  // Hay compañeras —la situación sigue siendo real y se sigue registrando— pero un commit parcial
  // no puede arrastrar lo suyo. Se devuelven igualmente para poder contarlo sin llamarlo bloqueo.
  if (commitParcial) {
    return {
      permitido: true,
      companeras,
      exento: 'commit_parcial',
      motivo: `${companeras.length} sesión(es) más aquí, pero es un commit parcial: no usa el índice compartido`,
    }
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
    // Tercera salida, y va ANTES del escape a propósito (T-486): es la que ya usaban los escapes
    // con motivo escrito, y no apaga nada. Un commit parcial construye su propio índice.
    '   ¿Ya tienes trabajo a medias aquí y solo quieres cerrarlo? Nombra las rutas:',
    '      git commit -m "…" -- <tus/ficheros>',
    '      (eso NO usa el índice compartido: lo de la otra sesión ni entra ni se toca)',
    '',
    // El escape pide un MOTIVO desde T-496: un «1» se copiaba de un comando a otro y dejaba a la
    // sesión sin guard para siempre (6 de 10 escapes medidos no respondían a ningún bloqueo).
    `   Si de verdad tienes que commitear aquí, di POR QUÉ (queda registrado):`,
    `      ${escape}="…tu motivo…" git commit …`,
    '',
  ].join('\n')
}

// ── EL ESCAPE PEDÍA UN «1», Y UN «1» SE ESCRIBE SIN PENSAR (T-496, 02/08/2026) ───────────────
// Medido sobre 7 días: el guard se rodeaba el 67% (banda `muerto` de T-423). Pero al desglosarlo
// por sesión, **6 de los 10 escapes NUNCA fueron precedidos de un bloqueo a esa sesión**: no es
// un guardarraíl que estorba, es un escape adoptado como PREFIJO.
//
// El criterio de qué vale como escape vive en `lib/observability/friccionSesiones.cjs`, junto a la
// medida y compartido con el push-guard (T-497): dos criterios sobre lo mismo acabarían
// divergiendo. Aquí solo se re-exporta para quien ya lo importaba de este módulo.
const { evaluarEscape, MOTIVO_MIN } = require('../observability/friccionSesiones.cjs')

module.exports = {
  evaluarIndice, mensajeBloqueo, mismaMaquina, evaluarEscape,
  esCommitParcial, PREFIJO_INDICE_PARCIAL,
  MOTIVO_MIN, VIVA_MIN,
}
