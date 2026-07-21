import type { CreateSignalInput } from '../oep-signals/oep-signals-queries.types';
import { baseScoreBySensor } from '../oep-signals/oep-signals.schemas';
import { parseFechaExamen } from './parse-fecha-examen';

/** Fila candidata leída de `convocatoria_notas` (+ join oposición/convocatoria). */
export interface ExamenNotaCandidate {
  notaId: string;
  oposicionId: string;
  slug: string;
  url: string | null;
  /** `llm_extraction->>'fecha_examen'` tal cual (puede ser ambiguo/multi-fecha). */
  fechaRaw: string | null;
  /** `convocatorias.exam_date` del ciclo vigente en ISO (o null si no hay). */
  examDateActual: string | null;
  /** `llm_extraction->'citas'` para provenance (opcional). */
  citas?: unknown;
}

/**
 * Convierte candidatas de `convocatoria_notas` en señales `nota_examen` listas para
 * insertar. TODO el filtrado anti-ruido vive aquí (puro, testeable sin BD):
 *
 *  1. La fecha tiene que ser UNA fecha de día único inequívoca (`parseFechaExamen`).
 *  2. Se descarta lo anterior a `minYear` (docs viejos mal extraídos: "15/05/2010").
 *  3. Se descarta si ya coincide con `convocatorias.exam_date` (ya capturada).
 *  4. Dedup por (oposición, fecha): una misma fecha aparece en varios PDFs de la
 *     misma convocatoria; una sola señal.
 *
 * NO fija `detectedYear` ni `detectedEstado` a propósito: así el apply humano solo
 * escribe `exam_date` del ciclo vigente y NUNCA crea un ciclo nuevo por el año de la
 * fecha (un examen de enero-2027 sobre una convocatoria de 2026 no es un ciclo nuevo).
 */
export function buildExamenSignals(
  candidates: ExamenNotaCandidate[],
  opts: { minYear: number },
): CreateSignalInput[] {
  const score = baseScoreBySensor('nota_examen');
  const seen = new Set<string>();
  const out: CreateSignalInput[] = [];

  for (const c of candidates) {
    const fecha = parseFechaExamen(c.fechaRaw);
    if (!fecha) continue;

    const year = Number(fecha.slice(0, 4));
    if (year < opts.minYear) continue;

    // Ya capturada en el ciclo vigente → nada que avisar.
    if (c.examDateActual && c.examDateActual.slice(0, 10) === fecha) continue;

    const dedupeKey = `nota_examen:${c.oposicionId}:${fecha}`;
    if (seen.has(dedupeKey)) continue;
    seen.add(dedupeKey);

    out.push({
      oposicionId: c.oposicionId,
      sensorType: 'nota_examen',
      sourceUrl: c.url ?? null,
      detectedFechaExamen: fecha,
      confidenceScore: score,
      isNovel: false,
      signalSummary:
        `Fecha de examen detectada (${fecha}) en un documento oficial de la ` +
        `convocatoria (${c.slug}). Verificar contra la fuente y aplicar si es ` +
        `correcta — el detector puede mis-atribuir procesos hermanos de la misma página.`,
      rawExtraction: {
        notaId: c.notaId,
        slug: c.slug,
        fechaRaw: c.fechaRaw,
        citas: c.citas ?? null,
      } as Record<string, unknown>,
      dedupeKey,
    });
  }

  return out;
}
