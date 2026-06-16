/**
 * Tipos y helpers portados de `lib/api/oep-signals/schemas.ts`.
 * Sin parsers Zod expuestos (Zod ya está en el backend para env),
 * pero se reusan los tipos inferidos y los helpers de score/dedupe.
 */
import { z } from 'zod';

// ============================================
// ENUMS
// ============================================

export const sensorTypeOptions = [
  'llm_semantic',
  'timeline_silence',
  'hash_change',
  'regional_scan',
  'rss',
  'boe_api',
  'google_cse',
  'manual',
  'generic_source',
] as const;

export const signalStatusOptions = [
  'pending',
  'applied',
  'dismissed',
  'auto_applied',
] as const;

export type SensorType = (typeof sensorTypeOptions)[number];
export type SignalStatus = (typeof signalStatusOptions)[number];

// ============================================
// EXTRACCIÓN LLM (lo que devuelve Claude)
// ============================================

export const llmExtractionSchema = z.object({
  hasOepInfo: z.boolean(),
  year: z.number().int().nullable(),
  plazasLibre: z.number().int().nullable(),
  plazasDiscapacidad: z.number().int().nullable(),
  plazasPromocionInterna: z.number().int().nullable(),
  bocRef: z.string().nullable(),
  fechaPublicacion: z.string().nullable(),
  fechaInscripcionFin: z.string().nullable(),
  fechaExamen: z.string().nullable(),
  estado: z
    .enum([
      'oep_aprobada',
      'convocada',
      'inscripcion_abierta',
      'inscripcion_cerrada',
      'lista_admitidos',
      'pendiente_examen',
      'examen_realizado',
      'resultados',
    ])
    .nullable(),
  // Cuerpo/puesto de la convocatoria extraída — para verificar que coincide con
  // el cuerpo de la oposición y no es otro proceso de una página multi-convocatoria.
  cuerpoDetectado: z.string().nullable().default(null),
  summary: z.string(),
});
export type LlmExtraction = z.infer<typeof llmExtractionSchema>;

// ============================================
// INSERT SIGNAL
// ============================================

export interface CreateSignalInput {
  oposicionId?: string | null;
  sourceId?: string | null;
  regionName?: string | null;
  positionCategory?: string | null;
  detectedOposicionName?: string | null;
  sensorType: SensorType;
  sourceUrl?: string | null;
  detectedYear?: number | null;
  detectedPlazasLibre?: number | null;
  detectedPlazasDiscapacidad?: number | null;
  detectedPlazasPromocionInterna?: number | null;
  detectedBocRef?: string | null;
  detectedFechaPublicacion?: string | null;
  detectedFechaInscripcionFin?: string | null;
  detectedFechaExamen?: string | null;
  detectedEstado?: string | null;
  confidenceScore: number;
  isNovel: boolean;
  signalSummary: string;
  rawExtraction?: Record<string, unknown>;
  dedupeKey?: string | null;
}

// ============================================
// REGIONAL EXTRACTOR
// ============================================

export const regionalOepSchema = z.object({
  name: z.string(),
  positionGroup: z.string().nullable(),
  year: z.number().int().nullable(),
  plazas: z.number().int().nullable(),
  bocRef: z.string().nullable(),
  fechaInscripcionFin: z.string().nullable(),
  estado: z.string().nullable(),
  url: z.string().nullable(),
});
export type RegionalOep = z.infer<typeof regionalOepSchema>;

export const regionalExtractionSchema = z.object({
  oeps: z.array(regionalOepSchema),
});
export type RegionalExtraction = z.infer<typeof regionalExtractionSchema>;

// ============================================
// GENERIC SOURCE
// ============================================

export const genericSourceExtractionSchema = z.object({
  hasRelevantChange: z.boolean(),
  items: z
    .array(
      z.object({
        title: z.string(),
        date: z.string().nullable(),
        type: z.enum([
          'rd_oep',
          'jornada',
          'instruccion',
          'circular',
          'acuerdo',
          'resolucion',
          'plan',
          'nota',
          'otro',
        ]),
        affectsTopic: z.string(),
        relevance: z.enum(['alta', 'media', 'baja']),
        url: z.string().nullable(),
      }),
    )
    .max(10),
  summary: z.string(),
});
export type GenericSourceExtraction = z.infer<
  typeof genericSourceExtractionSchema
>;

// ============================================
// HELPERS
// ============================================

/**
 * Calcula score base según el sensor que generó la señal.
 */
export function baseScoreBySensor(sensor: SensorType): number {
  switch (sensor) {
    case 'timeline_silence':
      return 70;
    case 'regional_scan':
      return 55;
    case 'llm_semantic':
      return 40;
    case 'rss':
      return 35;
    case 'hash_change':
      return 30;
    case 'boe_api':
      return 20;
    case 'google_cse':
      return 15;
    case 'manual':
      return 100;
    case 'generic_source':
      return 45;
  }
}

/**
 * Genera dedupe_key canónico.
 */
export function buildDedupeKey(params: {
  sensorType: SensorType;
  oposicionId: string;
  year?: number | null;
  bocRef?: string | null;
}): string {
  return [
    params.sensorType,
    params.oposicionId,
    params.year ?? 0,
    params.bocRef ?? 'null',
  ].join(':');
}
