// lib/sessions/trabajoHuerfano.cjs — ¿este worktree guarda trabajo que NO existe en ningún otro
// sitio? (T-431)
//
// ── EL PROBLEMA ──────────────────────────────────────────────────────────────────────────────
// Una sesión que muere no se despide. Su worktree se queda ahí con lo que estuviera haciendo, y
// **nadie mira**: `listar-worktrees.sh` enseña los commits sin pushear, pero solo si te acuerdas
// de ejecutarlo — y justo las sesiones que mueren no dejan a nadie que se acuerde. Medido el
// 31/07: cinco worktrees con trabajo fuera de `main`, de 3 a 9 días de antigüedad, y uno de ellos
// (`sesion-28jul-d`) con 43 líneas de documentación que nunca se subieron.
//
// ── POR QUÉ CONTAR COMMITS NO SIRVE, QUE ES TODO EL PROBLEMA ─────────────────────────────────
// De aquellos cinco, **cuatro eran ruido**:
//
//   vence-clean            47 commits sin pushear … los 47 ya estaban en `main` por contenido
//   pagos-planes            7 ficheros           … idénticos a `main`, byte a byte
//   umu-golive              2 ficheros           … versión DESFASADA de algo ya subido
//   scrape-opositatest-tai 14 ficheros           … markdown previo a los ids + limpieza a medias
//   sesion-28jul-d          3 ficheros           … ⚠️ contenido REAL, tres días perdido
//
// Un detector que cuente commits (o ficheros) da los cinco. Cuatro avisos falsos de cada cinco
// es exactamente cómo muere un aviso: se ignora, y con él se va el quinto, que es el que importa.
//
// La pregunta correcta no es «¿cuánto hay aquí?» sino **«¿qué se PERDERÍA si borro esto?»**, y
// eso es el diff del árbol de trabajo contra la rama principal —lo que existe aquí y en ningún
// otro sitio—, no el número de commits que lo produjeron. `git cherry` (equivalencia de PARCHE)
// se conserva aparte para poder EXPLICAR el caso raro: 47 commits y nada que perder.
//
// ── Y EL MISMO CRITERIO ARREGLA EL GUARD QUE YA EXISTÍA ──────────────────────────────────────
// `borrar-worktree.sh` ya se negaba a cerrar un worktree con `rev-list --count origin/main..` > 0,
// o sea contando commits. Con `vence-clean` eso son 47 commits de nada, y la salida documentada
// es `--force`… que en el mismo paso descarta también los cambios sin commitear. Un bloqueo que
// es ruido 4 de cada 5 veces enseña a usar el escape, y aquí el escape DESTRUYE (misma lección
// que T-375 y T-403, con la diferencia de que este borrado no se puede deshacer).

/** Minutos sin señal a partir de los cuales una sesión ya no se considera viva. */
const MIN_SIN_SENAL = 180

/**
 * Clasifica UN worktree a partir de datos ya recogidos (esta función no toca git ni la BD).
 *
 * @param slug            nombre del worktree
 * @param ficherosUnicos  rutas cuyo contenido difiere de la rama principal (`git diff origin/main`)
 *                        MÁS los no rastreados que no estén ignorados. Es «lo que se perdería».
 * @param commitsAhead    commits por delante de la rama principal (para explicar, no para decidir)
 * @param commitsUnicos   de esos, los que NO están ya en la principal por contenido (`git cherry +`)
 * @param minSinSenal     minutos desde la última señal de vida; `null` = nunca latió
 * @param procesos        procesos con el cwd dentro; `null` = no se pudo saber (no miente)
 *
 * @returns { slug, veredicto, gravedad, motivo, ficherosUnicos, commitsAhead, commitsUnicos }
 *
 * Veredictos:
 *  · `en_uso`          — hay señal reciente o procesos dentro. No se opina: está trabajando.
 *  · `sin_trabajo`     — nada que perder. El caso normal de un worktree recién sincronizado.
 *  · `solo_desfasado`  — tiene commits por delante pero **ninguno aporta contenido**: ya está en
 *                        la principal. Es el `vence-clean` de 47 commits. Ruido, se puede borrar.
 *  · `contenido_unico` — ⚠️ hay algo que solo existe aquí. Es el único que merece un aviso.
 */
function clasificarWorktree({
  slug,
  ficherosUnicos = [],
  commitsAhead = 0,
  commitsUnicos = 0,
  minSinSenal = null,
  procesos = null,
  // Desglose de `ficherosUnicos`: NO cambia ninguna decisión —la clasificación sigue mirando
  // `ficherosUnicos`— pero deja que el informe diga si hay que COMMITEAR o hay que EMPUJAR, que
  // son arreglos distintos. Llamar «sin commitear» a lo commiteado mandaba a mirar un árbol
  // limpio ([T-707]).
  sinCommitear = [],
  soloCommiteadoAqui = [],
} = {}) {
  const unicos = (ficherosUnicos || []).filter(Boolean)
  const base = {
    slug, ficherosUnicos: unicos, commitsAhead, commitsUnicos,
    sinCommitear: (sinCommitear || []).filter(Boolean),
    soloCommiteadoAqui: (soloCommiteadoAqui || []).filter(Boolean),
  }

  // La señal de VIDA manda sobre la antigüedad, y un proceso dentro manda sobre la señal: una
  // sesión viva puede pasar horas sin latir mientras compila.
  //
  // ── T-577: un `procesos` CONFIRMADO en 0 ya no se deja tapar por un latido fresco ──────────
  // Un `claude -p` no se despide: el turno termina y el proceso muere solo. Su último latido
  // puede tener 2 minutos y seguir estando "fresco" (< MIN_SIN_SENAL) durante las próximas casi
  // 3 horas, y en ese hueco el árbol parece "en uso" aunque no haya NADIE defendiéndolo — es
  // justo la ventana en la que a alguien de fuera (un supervisor, otra sesión) le puede parecer
  // seguro tocarlo. `sesiones:huerfanos` ya cazaba esto cuando no había BD (T-615: `minSinSenal`
  // llegaba `null` y el contenido se juzgaba); lo que faltaba era el caso con BD viva, latido
  // real y `procesos` verificado en 0 — el hueco que costó el incidente de T-577. Por eso el
  // latido SOLO cuenta cuando `procesos` no se pudo comprobar (`null`/`undefined`, típicamente
  // una máquina remota): si se pudo comprobar y dio 0, manda el 0, no la antigüedad del latido.
  const procesosConocidos = procesos !== null && procesos !== undefined
  const viva = procesos > 0 || (!procesosConocidos && minSinSenal !== null && minSinSenal < MIN_SIN_SENAL)
  if (viva) {
    return { ...base, veredicto: 'en_uso', gravedad: 'info', motivo: 'sesión viva: no se opina sobre su trabajo en curso' }
  }

  if (unicos.length === 0) {
    return commitsAhead > 0
      ? {
        ...base,
        veredicto: 'solo_desfasado',
        gravedad: 'info',
        motivo: `${commitsAhead} commit(s) por delante pero NADA que no esté ya en la principal — borrable`,
      }
      : { ...base, veredicto: 'sin_trabajo', gravedad: 'info', motivo: 'sincronizado con la principal' }
  }

  return {
    ...base,
    veredicto: 'contenido_unico',
    gravedad: 'warn',
    motivo: `${unicos.length} fichero(s) que solo existen aquí` +
      (commitsUnicos ? ` (${commitsUnicos} commit(s) con contenido propio)` : ' (sin commitear)'),
  }
}

/**
 * Resumen de una barrida. Separa lo accionable del ruido **y no calla el ruido**: saber que se
 * miraron 5 y 4 eran ruido es lo que hace creíble el aviso del quinto.
 */
function resumenBarrida(clasificados) {
  const l = clasificados || []
  const huerfanos = l.filter((c) => c.veredicto === 'contenido_unico')
  return {
    total: l.length,
    en_uso: l.filter((c) => c.veredicto === 'en_uso').length,
    sin_trabajo: l.filter((c) => c.veredicto === 'sin_trabajo').length,
    solo_desfasado: l.filter((c) => c.veredicto === 'solo_desfasado').length,
    huerfanos,
    hallazgo: huerfanos.length > 0,
  }
}

/**
 * ¿Puede `borrar-worktree.sh` cerrar este worktree sin perder nada?
 *
 * Devuelve `{ borrable, motivo }`. Es la MISMA clasificación de arriba a propósito: si el guard
 * del borrado y el barrido usaran criterios distintos, uno de los dos mentiría — y con dos puertas
 * al mismo recurso la buena no protege (lección de T-375).
 */
function puedeBorrarse(clasificacion) {
  const c = clasificacion || {}
  if (c.veredicto === 'contenido_unico') {
    return { borrable: false, motivo: c.motivo }
  }
  return { borrable: true, motivo: c.motivo || 'nada que perder' }
}

module.exports = { clasificarWorktree, resumenBarrida, puedeBorrarse, MIN_SIN_SENAL }
