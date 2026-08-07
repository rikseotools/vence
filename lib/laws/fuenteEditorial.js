// lib/laws/fuenteEditorial.js
//
// Registrar la fuente oficial de un contenedor EDITORIAL del temario (ODM, Agenda 2030,
// planes de Gobierno Abierto, Protocolos UE anexos a tratados…): documentos que no son un
// articulado tipo BOE pero SÍ tienen una fuente primaria citable (ONU, OCDE, DOUE, portal
// oficial de un ministerio). [T-144]
//
// ── POR QUÉ EXISTE ──────────────────────────────────────────────────────────────────────
//
// El Paso 1 del manual de generación (contrastar `content` contra la fuente vigente) exige
// una fuente registrada (`laws.boe_url`, repurposed como "URL de fuente oficial" — mismo uso
// que ya tienen `II Protocolo de prevención… UC3M` o `Cuerpo de Ujieres`, ninguno de los dos
// es BOE). Sin `boe_url`, `classifyLawCompleteness` (lib/laws/completeness.ts) solo puede
// devolver `no_source`: inverificable por construcción. Este módulo NO decide "verificado":
// solo valida que el PLAN de registro (qué URL, qué se comprobó) esté bien formado y sea
// HONESTO — no reclama Paso 1 completo si no se hizo.
//
// ⚠️ NUNCA usar esto para marcar `is_virtual`: eso es `contenedorInstitucional.js`, y es una
// exención DISTINTA (sin fuente citable en absoluto, un solo artículo). Estos SÍ tienen fuente
// real — el problema no era que no exista, era que nadie la había buscado y registrado.

/**
 * @typedef {Object} EntradaFuenteEditorial
 * @property {string} lawId - uuid de laws.id
 * @property {string} nombre - laws.name/short_name, solo para logging legible
 * @property {string} fuenteUrl - URL de la fuente oficial primaria (ONU/OCDE/DOUE/gob.es…)
 * @property {string} mensaje - QUÉ se comprobó hoy contra esa fuente, y qué NO (honesto)
 * @property {boolean} paso1Completo - ¿se comparó el content ENTERO artículo a artículo? (false = parcial/pendiente)
 */

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const MIN_MENSAJE = 40

/**
 * @param {EntradaFuenteEditorial} e
 * @returns {{ok:boolean, problema?:string}}
 */
function validarEntradaFuenteEditorial(e) {
  if (!e || typeof e !== 'object') return { ok: false, problema: 'entrada vacía' }
  if (!UUID_RE.test(String(e.lawId || ''))) return { ok: false, problema: `lawId no es un uuid válido: "${e.lawId}"` }
  const url = String(e.fuenteUrl || '').trim()
  if (!/^https?:\/\/.+/i.test(url)) return { ok: false, problema: `fuenteUrl no es una URL http(s): "${e.fuenteUrl}"` }
  const msg = String(e.mensaje || '').trim()
  if (msg.length < MIN_MENSAJE) {
    return { ok: false, problema: `mensaje demasiado corto (${msg.length} < ${MIN_MENSAJE}): un registro sin decir QUÉ se comprobó es un sello, no una verificación` }
  }
  if (typeof e.paso1Completo !== 'boolean') return { ok: false, problema: 'paso1Completo tiene que ser explícito (true/false), no se asume' }
  // Si se afirma Paso 1 completo, el mensaje tiene que sostenerlo (no una frase genérica).
  if (e.paso1Completo && !/verificad|comparad|coincide|cotej/i.test(msg)) {
    return { ok: false, problema: 'paso1Completo=true pero el mensaje no describe una comparación real (usa verbos como "verificado"/"comparado"/"cotejado")' }
  }
  return { ok: true }
}

/**
 * Valida un plan completo. Rechaza duplicados de lawId (dos entradas para la misma ley es
 * casi siempre un error de quien construyó el plan, no una intención real).
 * @param {EntradaFuenteEditorial[]} plan
 * @returns {{ok:boolean, problemas:string[]}}
 */
function validarPlanFuenteEditorial(plan) {
  const problemas = []
  if (!Array.isArray(plan) || plan.length === 0) return { ok: false, problemas: ['el plan está vacío'] }
  const vistos = new Set()
  for (const e of plan) {
    const v = validarEntradaFuenteEditorial(e)
    if (!v.ok) problemas.push(`${e && e.nombre ? e.nombre : '(sin nombre)'}: ${v.problema}`)
    const id = String(e && e.lawId || '')
    if (id) {
      if (vistos.has(id)) problemas.push(`lawId duplicado en el plan: ${id}`)
      vistos.add(id)
    }
  }
  return { ok: problemas.length === 0, problemas }
}

/**
 * Construye el `last_verification_summary` a escribir en `laws`, con el MISMO shape que ya
 * usan `exempt-editorial-laws.cjs` (via: 'editorial_exemption') y las filas manuales
 * existentes (Protocolo nº4, II Protocolo UC3M): is_ok / no_consolidated_text / source /
 * message / verified_at.
 *
 * DELIBERADO: si `paso1Completo` es false, `is_ok` se deja en `false` (NO `true`). Un
 * `is_ok:true` sin Paso 1 completo es exactamente el "falso verde" que
 * `lib/laws/completeness.ts` (T-395) existe para cazar — no lo vamos a recrear aquí. Con
 * `is_ok:false` el estado derivado es `never_verified` (accionable): correcto, porque hay
 * fuente pero falta terminar la comparación.
 * @param {EntradaFuenteEditorial} e
 * @param {string} nowIso
 */
function resumenFuenteEditorial(e, nowIso) {
  return {
    is_ok: e.paso1Completo === true,
    no_consolidated_text: true,
    manual_verification: true,
    via: 'fuente_editorial_registrada',
    source: e.fuenteUrl,
    message: e.mensaje,
    verified_at: nowIso,
  }
}

module.exports = { validarEntradaFuenteEditorial, validarPlanFuenteEditorial, resumenFuenteEditorial, UUID_RE, MIN_MENSAJE }
