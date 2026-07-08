/**
 * Modelo OPORTUNIDAD — derivación CANDIDATO (no verdad).
 *
 * Dados los HECHOS de la oportunidad de delante de un cuerpo, sugiere en qué fase
 * está y si es vendible. Es un PROXY para AYUDAR al humano al verificar — NUNCA
 * sobrescribe el estado guardado ni define la cola. La verdad la fija la
 * verificación contra fuente oficial (`oposiciones.forward_verified_at`).
 *
 * Por qué candidato y no verdad: los hechos pueden faltar aunque el estado real
 * exista (examen hecho sin `exam_date` cargado → esto sugeriría 'inscripcion_cerrada'
 * y borraría el conocimiento humano). Por eso solo se MUESTRA, el humano decide.
 * Ver memoria project_modelo_oportunidad_vendibilidad.
 */

export type FaseOportunidad =
  | 'sin_oep'
  | 'oep_aprobada'
  | 'convocada'
  | 'inscripcion_abierta'
  | 'inscripcion_cerrada'
  | 'examen_realizado'

export interface OportunidadHechos {
  oepFecha?: string | null
  oepDecreto?: string | null
  plazasLibres?: number | null
  convocatoriaFecha?: string | null
  convocatoriaNumero?: string | null
  boeReference?: string | null
  inscriptionStart?: string | null // 'YYYY-MM-DD'
  inscriptionDeadline?: string | null
  examDate?: string | null
  examDateApproximate?: boolean | null
}

export interface OportunidadCandidato {
  /** Fase mínima que sugieren los hechos. Solo llega hasta examen_realizado
   *  (las fases posteriores —resultados, nombramientos— no se derivan de fechas). */
  fase: FaseOportunidad
  /** Hay oportunidad viva (OEP con plazas libres y el examen no ha pasado) → vendible. */
  vendible: boolean
  /** true si ni siquiera hay evidencia de OEP (para no confundir con verificado-vacío). */
  sinEvidenciaOep: boolean
}

function d(x?: string | null): string | null {
  return x ? x.slice(0, 10) : null
}

/**
 * Deriva el candidato. `today` = 'YYYY-MM-DD' (comparación de strings ISO válida).
 * NO decide la cola (eso es forward_verified_at IS NULL) ni escribe nada.
 */
export function deriveOportunidad(
  f: OportunidadHechos,
  today: string,
): OportunidadCandidato {
  const hasOep = !!(f.oepFecha || f.oepDecreto || f.plazasLibres)
  const hasConvocatoria = !!(f.convocatoriaFecha || f.convocatoriaNumero || f.boeReference)
  const start = d(f.inscriptionStart)
  const deadline = d(f.inscriptionDeadline)
  const exam = d(f.examDate)

  let fase: FaseOportunidad
  if (exam && exam < today && !f.examDateApproximate) fase = 'examen_realizado'
  else if (start && deadline && today >= start && today <= deadline) fase = 'inscripcion_abierta'
  else if (deadline && today > deadline) fase = 'inscripcion_cerrada'
  else if (start && today < start) fase = 'convocada'
  else if (hasConvocatoria) fase = 'convocada'
  else if (hasOep) fase = 'oep_aprobada'
  else fase = 'sin_oep'

  // Oportunidad viva = hay OEP (abre el ciclo) y el examen no ha pasado en FIRME.
  // Coherente con la fase: un examen APROXIMADO pasado no cierra (no lo sabemos).
  const examPasadoFirme = !!(exam && exam < today && !f.examDateApproximate)
  const vendible = hasOep && !examPasadoFirme

  return { fase, vendible, sinEvidenciaOep: !hasOep }
}
