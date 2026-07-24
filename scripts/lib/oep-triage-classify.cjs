'use strict'
/**
 * oep-triage-classify.cjs — CORAZÓN de la "Capa 1" del triaje de señales OEP.
 *
 * PURO (sin BD, sin IO) → testeable. Convierte el triaje manual de
 * `oep_detection_signals` (frase-gatillo "revisa señales oeps") en una
 * clasificación determinista, para que NINGUNA sesión pierda un enriquecimiento
 * real por comparar la señal contra la fila EQUIVOCADA.
 *
 * Por qué existe (24/07/2026): en una revisión, el matcher del radar enganchó una
 * señal de "Inspector de la Policía Municipal" (promoción interna) a la fila
 * `policia-local-valladolid` (turno libre). Al comparar la señal contra ESA fila
 * (más avanzada), se descartó como "no aporta" — cuando contra la fila CORRECTA
 * (`inspector-policia-municipal-valladolid`, que SÍ existía) era un avance real
 * examen_realizado→resultados. Solo se cazó porque el admin preguntó "¿seguro?".
 * Esto lo vuelve un check, no una suerte.
 *
 * FILOSOFÍA (calcada de scope-classifier / senal_cuerpo_no_cuadra): CONSERVADOR y
 * de ALTA PRECISIÓN. El clasificador NUNCA descarta ni aplica solo; produce una
 * recomendación + la evidencia. La detección de mis-link es por EVIDENCIA POSITIVA
 * (existe una fila de la MISMA entidad que SÍ identifica el cuerpo de la señal),
 * nunca por mero parecido de nombres, porque "una regla amplia de parecido sería
 * una máquina de falsos positivos, y un guardarraíl ruidoso se apaga"
 * (audit-convocatoria-completitud §5).
 */

// Orden del proceso selectivo (manual §3c). Rank mayor = fase más avanzada.
// Aplicar una señal cuyo estado tiene rank MENOR que la BD = RETROCESO.
const ESTADO_ORDER = [
  'sin_oep',
  'oep_aprobada',
  'convocada',
  'inscripcion_abierta',
  'inscripcion_cerrada',
  'lista_admitidos',
  'pendiente_examen',
  'examen_realizado',
  'resultados',
  'nombramientos',
]
const ESTADO_RANK = Object.fromEntries(ESTADO_ORDER.map((e, i) => [e, i]))

function estadoRank(e) {
  if (e == null) return null
  const r = ESTADO_RANK[String(e).trim()]
  return r == null ? null : r
}

// ── Tokens ────────────────────────────────────────────────────────────────
const STOPWORDS = new Set([
  'de', 'del', 'la', 'el', 'los', 'las', 'y', 'e', 'o', 'u', 'a', 'en', 'por',
  'para', 'con', 'al', 'un', 'una', 'the', 'of',
  // ruido de contexto que NO identifica el cuerpo
  'oposicion', 'oposiciones', 'convocatoria', 'proceso', 'selectivo', 'plazas',
  'plaza', 'turno', 'acceso', 'sistema', 'cuerpo', 'escala', 'grupo', 'subgrupo',
  'gobierno', 'ayuntamiento', 'diputacion', 'consorcio', 'servicio', 'instituto',
])

function normalize(s) {
  return String(s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // quitar acentos
    // Cualquier no-alfanumérico → espacio. IMPORTANTE: la barra "/" también, para
    // que el sufijo de género "Inspector/a", "Auxiliar/a", "Subinspector/a" NO se
    // pegue al token (si no, "subinspector/a" ≠ "subinspector" y el discriminador
    // se pierde → la señal parece "sin cuerpo" y hace mis-link falso, bug 24/07).
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function tokens(s) {
  return normalize(s)
    .split(' ')
    .filter((t) => t.length > 3 && !STOPWORDS.has(t))
}

// Tokens DISCRIMINATIVOS: rango / escala / especialidad / turno que distinguen
// cuerpos que NO son el mismo aunque compartan entidad. Lista CURADA a propósito
// (misma disciplina que la regla estrecha existente): un cuerpo que difiere en uno
// de estos NO es el mismo proceso. Ampliar solo con pares inequívocos.
const DISCRIMINATORS = new Set([
  // policía / seguridad — rango
  'inspector', 'subinspector', 'oficial', 'agente', 'comisario', 'intendente',
  'cabo', 'sargento', 'suboficial', 'superior', 'ejecutiva', 'basica',
  // administración — cuerpo
  'auxiliar', 'administrativo', 'administrativa', 'administratiu', 'administrative',
  'tecnico', 'tecnica', 'gestion', 'gestor', 'subalterno', 'ordenanza', 'ayudante',
  'facultativo', 'medio',
  // especialidades que separan procesos
  'educador', 'sanitario', 'sanitaria', 'bibliotecas', 'archivos', 'informatica',
  'juridico', 'economista', 'arquitecto', 'ingeniero', 'veterinario',
  // sanidad
  'enfermero', 'enfermera', 'medico', 'celador', 'tcae', 'matron',
  // turno (separa oposiciones paralelas, manual §4f)
  'interna', 'promocion', 'libre', 'estabilizacion',
])

// Discriminadores ESTRUCTURALES (escala/grado) que comparten TODOS los hermanos
// de una familia ("Cuerpo Facultativo de Grado Medio ...") → no identifican el
// cuerpo concreto entre ellos. No cuentan como evidencia positiva de cuerpo (si
// contaran, "empleo" y "educador" empatarían con "subinspector sanitario").
const STRUCTURAL_DISC = new Set(['facultativo', 'medio'])

function discSet(name) {
  return new Set(tokens(name).filter((t) => DISCRIMINATORS.has(t)))
}

// Discriminadores ESPECÍFICOS del cuerpo (los que de verdad lo distinguen entre
// hermanos): discSet menos los estructurales.
function specificDisc(name) {
  return new Set([...discSet(name)].filter((t) => !STRUCTURAL_DISC.has(t)))
}

// Tokens de ENTIDAD que son GENÉRICOS de rol/ámbito (se repiten en muchísimas
// entidades: "policía municipal", "administración general"…) → NO localizan a una
// entidad concreta. Si el matcher se apoya en ellos empareja Valladolid con Madrid
// o Valencia con Baleares (falsos positivos reales medidos el 24/07). Se excluyen
// del ancla de identidad: el hogar correcto de un mis-link es la MISMA entidad
// (mismo lugar/organismo) con distinto cuerpo, y eso lo fijan los tokens PROPIOS
// (topónimo/organismo), no los de rol.
const GENERIC_ENTITY = new Set([
  'administracion', 'administracio', 'general', 'generales', 'publico', 'publica',
  'publicos', 'publicas', 'comunidad', 'autonoma', 'autonomo', 'autonomica',
  'provincial', 'local', 'locales', 'estado', 'salud', 'ambito', 'region',
  'regional', 'policia', 'municipal', 'especial', 'grado', 'medio',
])

function entityTokens(name) {
  return new Set(tokens(name).filter((t) => !DISCRIMINATORS.has(t)))
}

// Tokens de entidad DISTINTIVOS (propios): entidad menos los genéricos de rol.
// Son el ancla de identidad para no cruzar entidades.
function distinctiveEntity(name) {
  return new Set([...entityTokens(name)].filter((t) => !GENERIC_ENTITY.has(t)))
}

function setDiff(a, b) {
  return [...a].filter((x) => !b.has(x))
}
function symDiffSize(a, b) {
  return setDiff(a, b).length + setDiff(b, a).length
}
function interSize(a, b) {
  return [...a].filter((x) => b.has(x)).length
}

/**
 * ¿Hay una fila que es MEJOR hogar para la señal que la enlazada?
 * ALTA PRECISIÓN por EVIDENCIA POSITIVA (no por "tiene menos cuerpo"). Solo
 * dispara cuando existe una fila de la MISMA ENTIDAD que la enlazada y que
 * comparte con la señal un discriminador ESPECÍFICO de cuerpo que la enlazada NO
 * tiene. Es decir: "en el mismo sitio hay una fila que SÍ es este cuerpo".
 *
 * Requisitos (todos, por diseño conservador):
 *   (1) la señal identifica un cuerpo específico (specificDisc no vacío); si no,
 *       no hay nada que re-enlazar con confianza → null.
 *   (2) la enlazada tiene entidad DISTINTIVA (topónimo/organismo); si no, no se
 *       puede localizar sin arriesgar un cruce de entidad → null.
 *   (3) la candidata es la MISMA entidad (contiene TODA la entidad distintiva de
 *       la enlazada) y comparte ESTRICTAMENTE más discriminadores específicos con
 *       la señal que la enlazada.
 *
 * Diseño deliberado: NO intenta cazar el patrón "hermano con un conflicto de
 * menos" (Auxiliar↔Administrativo) — eso es FP-propenso y ya lo cubre el
 * guardarraíl estrecho `senal_cuerpo_no_cuadra`. Defensa en profundidad, cada
 * capa precisa. Un mis-link no cazado aquí NO se pierde: cae en el flujo de
 * ENRIQUECIMIENTO con su delta, que el humano revisa.
 *
 * @param {string} detectedName  identidad detectada por la señal (cuerpo + entidad)
 * @param {{slug,nombre}} linked  fila actualmente enlazada (puede ser null → no aplica)
 * @param {Array<{slug,nombre}>} candidates  filas candidatas (excluida la enlazada)
 */
function findBetterHome(detectedName, linked, candidates) {
  if (!linked || !detectedName) return null

  // (1) la señal debe identificar un cuerpo específico
  const dSpec = specificDisc(detectedName)
  if (dSpec.size === 0) return null

  // (2) ancla de identidad: la entidad distintiva de la fila enlazada
  const linkDist = distinctiveEntity(linked.nombre)
  if (linkDist.size === 0) return null

  const linkShared = interSize(dSpec, specificDisc(linked.nombre))
  let best = null
  let bestShared = linkShared // la candidata debe superar ESTO
  for (const c of candidates) {
    if (!c || !c.nombre) continue
    // (3a) MISMA entidad: contiene TODA la entidad distintiva de la enlazada
    if (setDiff(linkDist, entityTokens(c.nombre)).length > 0) continue
    // (3b) comparte ESTRICTAMENTE más discriminadores específicos con la señal
    const cShared = interSize(dSpec, specificDisc(c.nombre))
    if (cShared > bestShared) {
      bestShared = cShared
      best = c
    }
  }
  return best
}

/**
 * Delta de campos COMPARABLES señal↔BD (los de tipo firme: estado, plazas, fechas).
 * boe/boc_ref se ignora para clasificar (texto de formato libre → ruidoso).
 * @returns {Array<{field, from, to, direction?}>}
 */
function fieldDelta(detected, bd) {
  const d = []
  // estado
  const dr = estadoRank(detected.estado)
  const br = estadoRank(bd.estado)
  if (detected.estado && dr != null && detected.estado !== bd.estado) {
    d.push({
      field: 'estado_proceso',
      from: bd.estado,
      to: detected.estado,
      direction: br == null ? 'unknown' : dr > br ? 'forward' : dr < br ? 'backward' : 'same',
    })
  }
  // plazas (números)
  if (detected.plazas != null && Number(detected.plazas) !== Number(bd.plazas)) {
    d.push({ field: 'plazas_libres', from: bd.plazas, to: detected.plazas })
  }
  // fechas (comparar como texto YYYY-MM-DD; el runner ya normaliza)
  if (detected.examDate && detected.examDate !== bd.examDate) {
    d.push({ field: 'exam_date', from: bd.examDate, to: detected.examDate })
  }
  if (detected.inscFin && detected.inscFin !== bd.inscFin) {
    d.push({ field: 'inscription_deadline', from: bd.inscFin, to: detected.inscFin })
  }
  return d
}

const CATEGORIES = {
  NOVEL: 'novel', // sin fila enlazada → catalogar / enlazar a mano
  MISMATCH: 'mismatch', // enganchada a la fila equivocada → re-enlazar antes de nada
  REGRESSION: 'regression', // aplicarla retrocedería el estado sin aportar → auto-descartable
  DUPLICATE: 'duplicate', // sin delta comparable → ya reflejada → auto-descartable
  ENRICHMENT: 'enrichment', // aporta dato nuevo hacia delante → REVISIÓN HUMANA
}

// Categorías que un humano DEBE mirar (nunca auto-cerrar).
const NEEDS_HUMAN = new Set([CATEGORIES.NOVEL, CATEGORIES.MISMATCH, CATEGORIES.ENRICHMENT])
// Categorías auto-cerrables con reason code (reversible; el dato queda en admin_notes).
const AUTO_CLOSEABLE = new Set([CATEGORIES.REGRESSION, CATEGORIES.DUPLICATE])

/**
 * Clasifica UNA señal ya resuelta por el runner.
 * @param {object} sig
 *   { detected:{estado,plazas,examDate,inscFin,year}, bd:{estado,plazas,examDate,inscFin,year}|null,
 *     betterHome:{slug,nombre}|null }
 * @returns {{ category, reasons:string[], delta:Array }}
 */
function classifySignal(sig) {
  const reasons = []
  // 1) sin fila → novel (catalogar/enlazar)
  if (!sig.bd) return { category: CATEGORIES.NOVEL, reasons: ['sin fila enlazada'], delta: [] }
  // 2) mis-link → prioridad máxima: la comparación contra esta fila NO es fiable
  if (sig.betterHome) {
    return {
      category: CATEGORIES.MISMATCH,
      reasons: [`enganchada a "${sig.bd.slug}" pero encaja mejor en "${sig.betterHome.slug}" (discriminador de cuerpo/turno)`],
      delta: [],
    }
  }

  const delta = fieldDelta(sig.detected, sig.bd)

  // sospecha de ciclo viejo (no decide solo, pero lo anota)
  const olderCycle =
    sig.detected.year != null && sig.bd.year != null && Number(sig.detected.year) < Number(sig.bd.year)
  if (olderCycle) reasons.push(`año señal ${sig.detected.year} < año BD ${sig.bd.year} (¿ciclo superado?)`)

  // 3) sin delta comparable → duplicado (ya reflejado)
  if (delta.length === 0) {
    reasons.unshift('sin campo comparable nuevo (estado/plazas/fechas ya reflejados)')
    return { category: CATEGORIES.DUPLICATE, reasons, delta }
  }

  const estadoChange = delta.find((x) => x.field === 'estado_proceso')
  const forwardEstado = estadoChange && estadoChange.direction === 'forward'
  const backwardEstado = estadoChange && estadoChange.direction === 'backward'
  const nonEstadoDelta = delta.filter((x) => x.field !== 'estado_proceso')

  // 4) retroceso de estado sin ningún otro campo hacia delante → regresión
  if (backwardEstado && nonEstadoDelta.length === 0) {
    reasons.unshift(`estado señal (${estadoChange.to}) anterior a BD (${estadoChange.from}) — aplicar retrocedería`)
    return { category: CATEGORIES.REGRESSION, reasons, delta }
  }

  // ciclo viejo + estado "más avanzado" pero de otro año → NO es enriquecimiento
  // real; el runner lo marca para humano igualmente (enrichment con aviso), nunca
  // auto-cerrar, porque distinguir ciclos exige leer el boletín.
  if (forwardEstado) reasons.unshift(`estado avanza ${estadoChange.from}→${estadoChange.to}`)
  else if (nonEstadoDelta.length) reasons.unshift(`${nonEstadoDelta.map((x) => x.field).join(', ')} difiere(n)`)

  return { category: CATEGORIES.ENRICHMENT, reasons, delta }
}

module.exports = {
  ESTADO_ORDER,
  ESTADO_RANK,
  estadoRank,
  normalize,
  tokens,
  discSet,
  specificDisc,
  entityTokens,
  distinctiveEntity,
  findBetterHome,
  fieldDelta,
  classifySignal,
  CATEGORIES,
  NEEDS_HUMAN,
  AUTO_CLOSEABLE,
  DISCRIMINATORS,
}
