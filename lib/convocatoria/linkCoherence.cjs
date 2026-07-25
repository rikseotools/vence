// lib/convocatoria/linkCoherence.cjs
// GUARDARRAÍL de coherencia de los ENLACES de una convocatoria contra lo que MUESTRA.
//
// Incidente que lo motiva (25/07): la caja "Ver OEP en BOE" de una landing muestra
// "BOE-A-2026-9946 (RD 387/2026, OEP 2026)" pero el enlace (programa_url) apunta a
// BOE-A-2025-26262 (la convocatoria de 2025). El usuario pincha y no corresponde.
// Medido: 5 oposiciones vigentes con el enlace apuntando a otro documento. También el
// seguimiento_url apunta a un año anterior al de la convocatoria vigente.
//
// Núcleo PURO (sin red/DB): extrae los identificadores/años de los textos y compara.
// Lo consume el sweep de salud (kind `convocatoria_link_mismatch`).

/** Extrae el primer identificador BOE-X-YYYY-NNNNN de un texto (o null). */
function extraerIdBoe(texto) {
  if (!texto) return null
  const m = String(texto).match(/BOE-[A-Z]-\d{4}-\d+/)
  return m ? m[0] : null
}

/** Extrae el primer año 20xx de un texto/URL (o null). */
function extraerAño(texto) {
  if (!texto) return null
  const m = String(texto).match(/\b(20\d{2})\b/)
  return m ? parseInt(m[1], 10) : null
}

/**
 * Comprueba la coherencia de los enlaces de una convocatoria.
 * @param {{boeReference?:string|null, programaUrl?:string|null, seguimientoUrl?:string|null, año?:number|null}} c
 * @returns {Array<{tipo:string, severidad:'error'|'warn', detalle:string}>}
 */
function checkConvocatoriaLinks(c) {
  const issues = []
  if (!c) return issues

  // (1) El enlace del BOE (programa_url) debe apuntar al MISMO documento que la referencia
  //     que se muestra (boe_reference). Si ambos citan un BOE-… y difieren → el usuario
  //     pincha "Ver … en BOE" y aterriza en otro documento. Es un ERROR (rompe la confianza).
  const idRef = extraerIdBoe(c.boeReference)
  const idUrl = extraerIdBoe(c.programaUrl)
  if (idRef && idUrl && idRef !== idUrl) {
    issues.push({
      tipo: 'ref_url_mismatch',
      severidad: 'error',
      detalle: `muestra ${idRef} pero el enlace va a ${idUrl}`,
    })
  }

  // (2) El seguimiento del proceso no debe apuntar a un año ANTERIOR al de la convocatoria
  //     vigente (parece que vigilas el ciclo viejo). Señal a revisar (WARN: la URL puede
  //     no llevar año, o el ciclo anterior seguir vivo legítimamente).
  const añoSeg = extraerAño(c.seguimientoUrl)
  if (c.año && añoSeg && añoSeg < c.año) {
    issues.push({
      tipo: 'seguimiento_year_stale',
      severidad: 'warn',
      detalle: `el seguimiento apunta a ${añoSeg} y la convocatoria vigente es ${c.año}`,
    })
  }

  return issues
}

module.exports = { extraerIdBoe, extraerAño, checkConvocatoriaLinks }
