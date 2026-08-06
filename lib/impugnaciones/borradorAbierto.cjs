// lib/impugnaciones/borradorAbierto.cjs — «este caso ya tiene borrador esperando OK». (T-588)
//
// ── EL HUECO QUE CIERRA ──────────────────────────────────────────────────────────────────────
// `cola.cjs next` reparte la impugnación más antigua LIBRE, pero libre solo mira `claimed_by`.
// El ciclo normal del manual es: coge → analiza → escribe borrador → LIBERA la fila (nunca se
// cierra sin OK de Manuel) → la fila vuelve a estar "libre" y sigue siendo la más antigua → la
// siguiente sesión que pide trabajo se la lleva otra vez, sin saber que ya hay un borrador
// esperando aprobación en el embudo (`session_questions`).
//
// MEDIDO el 05/08/2026 sobre la impugnación 2477d39d (Outlook, Ctrl+Mayús+K vs Ctrl+T): CUATRO
// sesiones distintas la analizaron de forma independiente en 2h26min, cada una con su propia
// verificación WebFetch contra la misma fuente oficial, y dejaron TRES borradores simultáneos
// (`#21`, `#39`, `#72`) con el mismo veredicto. Ficha [T-588].
//
// ── DECISIÓN ────────────────────────────────────────────────────────────────────────────────
// **Avisa, no bloquea** (coherente con el resto del sistema: "avisar ≠ bloquear", igual que
// `fichasQueCitan.cjs`/[T-517]). La sesión decide si el borrador ya cubre el caso o si aporta algo
// nuevo (una hermana no vista, un matiz). El `draft_target` es texto libre (no hay columna
// estructurada `dispute_id`), así que se busca por substring del id — igual de frágil que
// `fichasQueCitan.cjs`, y por eso exige el mismo mínimo de longitud para no casar con cualquier cosa.

/** Escapa lo que vaya a ir dentro de una expresión regular. */
function escapar(s) {
  return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/**
 * Filtra, de una lista de filas `session_questions` (kind='borrador'), las que citan este
 * dispute id — por el uuid entero o por su prefijo corto (8 caracteres), con frontera para no
 * casar dentro de otro hash.
 *
 * @param {Array<{id, sid, status, draft_target, asked_at}>} filas  ya filtradas por kind='borrador'
 * @param {string} disputeId  uuid completo de la impugnación
 * @returns {Array<{id, sid, status, draft_target, asked_at}>}
 */
function borradoresQueCitan(filas, disputeId) {
  const idCorto = String(disputeId || '').slice(0, 8)
  const buscables = [...new Set([disputeId, idCorto].filter((x) => x && String(x).length >= 8))]
  if (!buscables.length) return []
  const re = new RegExp(`(?<![0-9a-zA-Z-])(${buscables.map(escapar).join('|')})(?![0-9a-zA-Z-])`, 'i')
  return (filas || []).filter((f) => f.status === 'open' && re.test(String(f.draft_target || '')))
}

/**
 * El bloque que se imprime en el dossier / al repartir. Corto: es un aviso, no un informe.
 */
function lineasBorradorAbierto(borradores = []) {
  if (!borradores.length) return []
  const plural = borradores.length > 1
  const l = [
    `─── 📝 YA HAY ${borradores.length} BORRADOR${plural ? 'ES' : ''} ABIERTO${plural ? 'S' : ''} EN EL EMBUDO PARA ESTE CASO ───`,
  ]
  for (const b of borradores) {
    l.push(`   #${b.id} (sesión ${String(b.sid).slice(0, 12)}…, hace ${horasDesde(b.asked_at)}h)`)
  }
  l.push('   Léelo antes de rediagnosticar: si ya cubre el caso, NO escribas otro — libera la fila.')
  if (plural) l.push('   Son duplicados del mismo trabajo (ficha [T-588]): no añadas un cuarto.')
  return l
}

function horasDesde(t) {
  if (!t) return '?'
  const ms = Date.now() - new Date(t).getTime()
  return Math.max(0, Math.round(ms / 3600000))
}

// ══════════════════════════════════════════════════════════════════════════════════════════
// LA DIRECCIÓN CONTRARIA: dada una fila del embudo, ¿de qué casos habla y siguen vivos? (T-614)
//
// ── EL FALLO QUE LO ESTRENA, MEDIDO ──────────────────────────────────────────────────────
// El 06/08 le presenté a Manuel el borrador de la réplica de `f34b88ad` (Manolo, Dip. Córdoba)
// para que lo aprobara y se enviara. La impugnación llevaba **cerrada desde la tarde anterior**
// con un `admin_response` que decía LO MISMO. A un paso de mandarle a un usuario real el mismo
// correo dos veces. Lo cazó él preguntando «¿pero no se le respondió ya?», no una comprobación
// nuestra. Al cotejar las 16 preguntas abiertas del embudo contra `question_disputes`, **10
// apuntaban a casos ya cerrados y contestados**: el embudo no estaba lleno de trabajo, estaba
// lleno de humo, y el humo tapaba lo único real que había debajo.
//
// ── POR QUÉ NO LO CUBRÍA `retirarBorrador.cjs`, QUE YA EXISTE ────────────────────────────
// Aquel (T-486, el mismo día) retira solo `kind='borrador'` y busca por la columna
// `draft_target`. Medido: los borradores están **a cero** — funciona. Las 16 filas atascadas son
// `kind='pregunta'` y **las 16 tienen `draft_target` a NULL**: el id del caso vive únicamente en
// la prosa de `question`/`context` («¿apruebo el borrador para f34b88ad?»). Un trabajador que no
// puede cerrar un caso pregunta de DOS formas —la estructurada y la de prosa— y solo la primera
// se limpiaba sola. Este bloque cubre la segunda.
//
// ── AVISA, NO RETIRA — y esto es lo que decide que sirva ─────────────────────────────────
// La tentación es cerrar la fila automáticamente, como se hace con el borrador. Sería un error:
// **citar un caso no es estar trabajando en él.** La pregunta #73 de esa misma tanda cita
// `744f0db0` y `4683e35b` para APOYAR una propuesta sobre el guardarraíl de duplicados — es una
// pregunta viva, y auto-retirarla al cerrar esos dos casos la habría borrado sin que nadie lo
// notara. Es exactamente la distinción que [T-403] tuvo que aprender en el push-guard (un id en
// el cuerpo de un commit avisa, no bloquea) y el principio «avisar ≠ bloquear» de
// `sistema-sesiones-paralelas.md`. Con el borrador sí se puede retirar porque su destinatario es
// un campo ESTRUCTURADO: no hay ambigüedad sobre de qué va. Aquí la hay, así que decide quien lee.
// ══════════════════════════════════════════════════════════════════════════════════════════

/** Estados en los que un caso YA NO espera respuesta. Espejo de los `open` de `cola.cjs`. */
const CERRADOS = ['resolved', 'rejected', 'closed', 'dismissed', 'completed']

/** Un identificador de caso dentro de prosa libre: uuid o su prefijo de 8 hex, con frontera. */
const CLAVE = /(?<![0-9a-zA-Z-])([0-9a-f]{8})(?![0-9a-zA-Z])/gi

/**
 * Las claves de caso que cita una fila del embudo, mire donde mire.
 *
 * Se leen los TRES campos porque cada uno recoge una costumbre distinta: `draft_target` es el
 * destinatario estructurado del borrador, `question` es el titular que ve Manuel, y `context` es
 * donde el trabajador pega su análisis — que es justo donde acaban los ids en las filas de prosa.
 *
 * @param {{draft_target?, question?, context?}} fila
 * @returns {string[]} claves en minúscula, sin repetir
 */
function casosCitadosEn(fila) {
  const texto = [fila?.draft_target, fila?.question, fila?.context].filter(Boolean).join(' \n ')
  return [...new Set([...String(texto).matchAll(CLAVE)].map((m) => m[1].toLowerCase()))]
}

/** Todas las claves citadas por un conjunto de filas — lo que hay que ir a buscar a la BD. */
function clavesDeCasos(filas = []) {
  return [...new Set((filas || []).flatMap((f) => casosCitadosEn(f)))]
}

/**
 * Anota cada fila con los casos que cita y que ya están CERRADOS.
 *
 * FAIL-OPEN a propósito: si no se pudo consultar el estado (`estados` vacío), ninguna fila se
 * marca. Una anotación que se inventa el estado es peor que la ausencia de anotación — haría que
 * se descartara como fantasma una pregunta viva, que es el daño que este aviso viene a evitar.
 *
 * @param {Array} filas    filas de `session_questions`
 * @param {Array<{clave, status}>} estados  lo que la BD dice de las claves citadas
 * @returns {Array} las mismas filas con `casosCerrados: [{clave, status}]` (vacío = nada que decir)
 */
function marcarCasosCerrados(filas = [], estados = []) {
  const porClave = new Map(
    (estados || [])
      .filter((e) => e && e.clave && CERRADOS.includes(String(e.status).toLowerCase()))
      .map((e) => [String(e.clave).toLowerCase(), String(e.status).toLowerCase()]),
  )
  return (filas || []).map((f) => ({
    ...f,
    casosCerrados: casosCitadosEn(f)
      .filter((c) => porClave.has(c))
      .map((c) => ({ clave: c, status: porClave.get(c) })),
  }))
}

/**
 * El SQL que resuelve el estado de un puñado de claves, en UN sitio.
 *
 * Las tres tablas son las mismas tres colas de `cola.cjs` (`DISPUTE_TBL` + `FEEDBACK_TBL`): si
 * mañana entra una cuarta cola, se añade aquí y los dos lectores la heredan. Escribir la consulta
 * en cada pantalla es como nacieron los cinco escritores de `seguimiento_url` [T-130].
 */
function sqlEstadoDeCasos() {
  return `
    SELECT left(id::text, 8) AS clave, status::text AS status
      FROM public.question_disputes              WHERE left(id::text, 8) = ANY($1)
    UNION ALL
    SELECT left(id::text, 8), status::text
      FROM public.psychometric_question_disputes WHERE left(id::text, 8) = ANY($1)
    UNION ALL
    SELECT left(id::text, 8), status::text
      FROM public.user_feedback                  WHERE left(id::text, 8) = ANY($1)`
}

/**
 * El aviso que se pinta junto a la fila. Una línea: es una anotación, no un informe.
 * Devuelve `null` cuando no hay nada que decir, para que el llamador no tenga que comprobarlo.
 *
 * ── EL TEXTO NO AFIRMA QUE LA PREGUNTA ESTÉ MUERTA, Y ES DELIBERADO ──────────────────────
 * Al estrenarlo sobre las 16 filas reales, tres de las marcadas (#38, #45, #55) eran preguntas
 * VIVAS sobre otra cosa —permisos del rol, documentar un método— que simplemente citaban un caso
 * cerrado como contexto. Un aviso que dijera «esto ya no hace falta» las habría descartado. Lo
 * que el dato sostiene es lo que se escribe: el caso está cerrado. Qué significa eso para ESTA
 * pregunta lo decide quien lee.
 */
function avisoCasoCerrado(casosCerrados = []) {
  if (!casosCerrados.length) return null
  const lista = casosCerrados.map((c) => `${c.clave} (${c.status})`).join(', ')
  const plural = casosCerrados.length > 1
  return `⚠️  cita ${plural ? 'casos ya cerrados' : 'un caso ya cerrado'} y contestado: ${lista}. `
    + 'Si lo que se pedía era aprobar un envío, comprueba que siga haciendo falta antes de decir que sí.'
}

module.exports = {
  borradoresQueCitan, lineasBorradorAbierto,
  casosCitadosEn, clavesDeCasos, marcarCasosCerrados, sqlEstadoDeCasos, avisoCasoCerrado, CERRADOS,
}
