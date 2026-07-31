// lib/sessions/solape.cjs — ¿dos sesiones están tocando lo mismo? (T-400, 31/07/2026)
//
// ── EL HUECO QUE CIERRA ──────────────────────────────────────────────────────────────────────
// El claim (`backlog_tasks`) impide que dos sesiones cojan la MISMA tarea, y eso funciona. Pero
// las sesiones no chocan por el id de la tarea: chocan por los FICHEROS. Tres casos medidos en
// este repo, los tres con el claim funcionando perfectamente:
//
//   · T-361 (31/07): el mismo bug encontrado por DOS sesiones el mismo día, cada una arreglando
//     una mitad distinta. La ficha lo dice: «que dos sesiones tropiecen con lo mismo el mismo día
//     no es casualidad».
//   · T-130 (26/07): se escribió un QUINTO escritor de `seguimiento_url` sin ver los otros cuatro.
//   · 31/07: T-375 y T-382 se cogieron como tareas separadas y resultaron ser los MISMOS ficheros.
//
// Y hasta hoy eso se descubría tarde: al pushear (conflicto) o nunca.
//
// ── POR QUÉ SE OBSERVA Y NO SE DECLARA ───────────────────────────────────────────────────────
// La huella sale de git (sucio + commits sin pushear), no de que alguien anote en qué va a
// trabajar. Una intención declarada se pudre en cuanto el trabajo se desvía —y se desvía siempre—;
// el estado observado no puede mentir. Además no pide disciplina: lo publica el latido, que ya
// corre en cada comando de `backlog.cjs` y en cada `pre-push`.
//
// ── POR QUÉ AVISA Y NUNCA BLOQUEA ────────────────────────────────────────────────────────────
// Dos sesiones pueden tocar el mismo fichero por motivos perfectamente legítimos. Un guardarraíl
// que corta por solape sería insufrible y se acabaría rodeando —la misma muerte que casi se lleva
// al push-guard (T-375), donde el bloqueo imposible enseñaba a apagarlo entero—. Esto es
// INFORMACIÓN para decidir, no una puerta.

const path = require('path')

/**
 * Ficheros que TODAS las sesiones tocan por diseño: avisar de ellos es garantizar ruido, y un
 * aviso que salta siempre deja de leerse (misma lección que `visualDeixis` o el catch-all de
 * señales). No es una lista de excusas: es la lista de ficheros cuyo solape ya se sabe.
 *
 * MEDIDO el 31/07 sobre los worktrees vivos, que es lo que la hace corta y no inventada: el
 * ÚNICO fichero compartido por 3+ worktreesera `docs/roadmap/tareas-pendientes.md`. El resto de
 * solapes eran scripts `_tmp_*` de usar y tirar. O sea, **el solape real es escaso**, y por eso
 * este aviso puede permitirse ser creíble.
 */
const COMPARTIDOS_POR_DISENO = [
  'docs/roadmap/tareas-pendientes.md',  // lo escriben todas las sesiones; su problema es T-387
  'CLAUDE.md',                          // fichero de coordinación: el solape ahí es esperado
  'package-lock.json',
  'docs/runbooks/tareas-pendientes.md',
]

/** Rutas de trabajo desechable: nunca son colisión (cada sesión tiene la suya). */
const RE_DESECHABLE = /^(scratchpad|sim-reports|data\/pilotos|\.claude|node_modules|\.next|\.open-next)\//

/**
 * Filtra una lista de ficheros dejando solo los que MERECE avisar.
 * Sin esto el aviso sale en cada comando y muere de ruido en una semana.
 */
function huellaRelevante(ficheros) {
  const vistos = new Set()
  for (const f of ficheros || []) {
    const p = String(f || '').trim()
    if (!p) continue
    if (RE_DESECHABLE.test(p)) continue
    if (COMPARTIDOS_POR_DISENO.includes(p)) continue
    vistos.add(p)
  }
  return [...vistos].sort()
}

/**
 * Ventana CORTA para «¿quién comparte directorio AHORA?» (30 min).
 *
 * Compartir el índice de git es un problema del PRESENTE: una sesión que no ejecuta nada desde
 * hace una hora no está compitiendo por él. Con la ventana de 24 h que había antes se contaban
 * **filas fantasma** — y no es un caso raro, es el caso NORMAL: cuando una sesión se muda a un
 * worktree coge la identidad del `.session-id` que hay allí, así que nace una fila nueva y **la
 * vieja se queda congelada apuntando al directorio del que se fue**.
 *
 * Medido el 31/07, mudando ocho sesiones: las ocho aparecían ya trabajando desde su worktree y
 * el aviso seguía diciendo «6 en el checkout principal», que eran sus propios fantasmas. Un
 * aviso que sigue rojo después de arreglar el problema es la forma más rápida de que se ignore.
 */
const LATIDO_RECIENTE_MIN = 30

/** ¿Sigue viva esa sesión? Mismo umbral que usa el listado de latidos. */
function estaViva(sesion, ahora = new Date(), horas = 24) {
  if (!sesion || !sesion.last_signal_at) return false
  return new Date(sesion.last_signal_at).getTime() > new Date(ahora).getTime() - horas * 3600_000
}

/**
 * Solapes entre MI huella y la de las demás sesiones vivas.
 *
 * @param misFicheros  ficheros que toco yo (ya crudos: aquí se filtran).
 * @param sesiones     filas de `worktree_sessions` (sid, slug, touched_files, last_signal_at).
 * @param sid          mi session-id (me excluyo: verme a mí mismo no es un choque).
 * @returns Array<{ sid, slug, ficheros: string[], minutos: number }> ordenado por más solape.
 *
 * Una sesión SIN huella (`touched_files` null, p.ej. porque corre una versión vieja del latido)
 * no produce solape, pero tampoco se afirma que esté limpia: quien imprime debe decir "no sé".
 */
function calcularSolapes({ misFicheros, sesiones, sid, ahora = new Date(), horas = 24 }) {
  const mios = new Set(huellaRelevante(misFicheros))
  if (!mios.size) return []
  const out = []
  for (const s of sesiones || []) {
    if (!s || s.sid === sid) continue
    if (!estaViva(s, ahora, horas)) continue
    if (!Array.isArray(s.touched_files)) continue        // sin huella: no se inventa
    const suyos = huellaRelevante(s.touched_files)
    const comunes = suyos.filter((f) => mios.has(f))
    if (!comunes.length) continue
    out.push({
      sid: s.sid,
      slug: s.slug,
      worktree_path: s.worktree_path || null,
      ficheros: comunes,
      minutos: Math.round((new Date(ahora).getTime() - new Date(s.last_signal_at).getTime()) / 60_000),
    })
  }
  return out.sort((a, b) => b.ficheros.length - a.ficheros.length)
}

/**
 * Sesiones que comparten el MISMO directorio de trabajo. Es un problema DISTINTO y peor que el
 * solape de ficheros, por eso va aparte.
 *
 * Dos sesiones en worktrees distintos que tocan el mismo fichero acaban en un conflicto de git,
 * que es feo pero visible y reversible. Dos sesiones en el MISMO checkout se sobrescriben en
 * vivo, sin que git medie: no hay conflicto que resolver porque no hay dos versiones, hay una
 * que la otra ya pisó. Es el acoplamiento que describe T-385 («el deploy necesita que un recurso
 * compartido esté quieto y limpio, cosa que con 2-10 sesiones no se puede garantizar»).
 *
 * Se detecta el 31/07 en cuanto se enciende el mapa: TRES sids distintos latiendo desde el
 * checkout principal a la vez.
 *
 * @returns Array<{ worktree_path, sids: string[], slug }> solo con los compartidos por 2+.
 */
function checkoutsCompartidos(sesiones, ahora = new Date(), horas = LATIDO_RECIENTE_MIN / 60) {
  const porPath = new Map()
  for (const s of sesiones || []) {
    if (!s || !s.worktree_path || !estaViva(s, ahora, horas)) continue
    if (!porPath.has(s.worktree_path)) porPath.set(s.worktree_path, { worktree_path: s.worktree_path, slug: s.slug, sids: [] })
    porPath.get(s.worktree_path).sids.push(s.sid)
  }
  return [...porPath.values()].filter((g) => g.sids.length > 1).sort((a, b) => b.sids.length - a.sids.length)
}

/** Sesiones vivas que no publican huella: el aviso tiene que poder decir "no lo sé". */
function sesionesSinHuella(sesiones, sid, ahora = new Date(), horas = 24) {
  return (sesiones || []).filter((s) => s && s.sid !== sid && estaViva(s, ahora, horas) && !Array.isArray(s.touched_files))
}

/**
 * Ficheros donde es PROBABLE que trabaje quien coge una tarea, para poder avisar YA en el
 * `claim` —antes de escribir nada— y no cuando el choque ya existe.
 *
 * Dos fuentes, y hacen falta las dos:
 *   · los ficheros que tocaron los commits que MENCIONAN ese id (lo que la tarea ya movió);
 *   · las rutas citadas entre backticks en su ficha (lo único que hay si la tarea es nueva).
 *
 * Es una PREDICCIÓN, así que se usa solo para avisar. Se filtra por rutas verosímiles para no
 * tomar por fichero cualquier cosa entre backticks (`is_active`, `claim`, `T-042`…).
 */
const RE_RUTA = /^[\w.@-]+(?:\/[\w.@-]+)+\.\w{1,5}$/

function ficherosProbablesDeFicha(textoFicha) {
  const out = new Set()
  for (const m of String(textoFicha || '').matchAll(/`([^`\n]{3,120})`/g)) {
    const cand = m[1].trim()
    if (RE_RUTA.test(cand)) out.add(cand)
  }
  return huellaRelevante([...out])
}

module.exports = {
  huellaRelevante,
  estaViva,
  calcularSolapes,
  checkoutsCompartidos,
  sesionesSinHuella,
  ficherosProbablesDeFicha,
  COMPARTIDOS_POR_DISENO,
  RE_DESECHABLE,
}
