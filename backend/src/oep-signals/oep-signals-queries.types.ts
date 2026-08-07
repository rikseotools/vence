import type { SensorType } from './oep-signals.schemas';

export interface OposicionToScan {
  id: string;
  nombre: string;
  slug: string | null;
  shortName: string | null;
  seguimientoUrl: string;
  estadoProceso: string | null;
  plazasLibres: number | null;
  plazasDiscapacidad: number | null;
  oepFecha: string | null;
  convocatoriaNumero: string | null;
  // Detector "seguimiento ciego" (27/06): isActive gatea la señal de URL genérica;
  // examDate permite el cross-check con la fecha que extraiga la página.
  isActive: boolean;
  examDate: string | null;
  // Sprint 2 Lambda backend integration: tipo de fetcher según audit.
  // - 'http' (default): fetch nativo Node, rápido (~200ms).
  // - 'headless': Lambda Playwright + Chromium para JS-rendered (~3-10s).
  fetcherType: 'http' | 'headless' | 'pdf' | 'rss' | 'boe_api';
}

export interface TimelineSilenceCandidate {
  oposicionId: string;
  oposicionNombre: string;
  oposicionSlug: string | null;
  hitoId: string;
  hitoTitulo: string;
  hitoFecha: string;
  diasRetraso: number;
}

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
  detectedSistema?: string | null;
  confidenceScore: number;
  isNovel: boolean;
  signalSummary: string;
  rawExtraction?: Record<string, unknown>;
  dedupeKey?: string | null;
  /** Nota de triaje (p.ej. veredicto de frescura de inscripción). */
  adminNotes?: string | null;
}

// `DetectionSourceForScan` (sensor detect-regional-oeps) se eliminó en T-347
// (07/08/2026): el sensor está retirado desde el 01/06/2026 y este tipo se
// quedó sin ningún consumidor. Ver la nota en oep-signals-queries.service.ts.

export interface OposicionForMatch {
  id: string;
  nombre: string;
  slug: string | null;
  subgrupo: string | null;
  convocatoriaNumero: string | null;
}
