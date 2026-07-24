// lib/api/laws-configurator/transform.ts
// Lógica PURA del configurador de leyes (sin BD ni observabilidad) → testeable en
// aislamiento. Fija el CONTRATO del endpoint independientemente de la fuente de
// datos (summary pre-agregada o join directo).
import type { GetAllLawsResponse, LawData } from './schemas'

/** Fila cruda de stats por ley (de la summary o del join). */
export interface LawStatRow {
  lawShortName: string | null
  lawName: string | null
  totalQuestions: number
  articlesWithQuestions: number
}

/**
 * Filtra leyes sin preguntas (o sin short_name), mapea al shape público, ORDENA
 * desc por nº de preguntas y calcula totales. Determinista.
 */
export function buildLawsResponse(rows: LawStatRow[]): GetAllLawsResponse {
  const lawsData: LawData[] = (rows || [])
    .filter((r) => r.lawShortName && Number(r.totalQuestions) > 0)
    .map((r) => ({
      lawShortName: r.lawShortName!,
      lawName: r.lawName || r.lawShortName!,
      totalQuestions: Number(r.totalQuestions),
      articlesWithQuestions: Number(r.articlesWithQuestions) || 0,
    }))
    .sort((a, b) => b.totalQuestions - a.totalQuestions)

  const totalQuestions = lawsData.reduce((sum, law) => sum + law.totalQuestions, 0)
  return { success: true, data: lawsData, totalLaws: lawsData.length, totalQuestions }
}
