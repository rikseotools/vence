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
  confidenceScore: number;
  isNovel: boolean;
  signalSummary: string;
  rawExtraction?: Record<string, unknown>;
  dedupeKey?: string | null;
}

export interface DetectionSourceForScan {
  id: string;
  sourceType: string;
  regionName: string;
  boletinName: string | null;
  listingUrl: string;
  searchKeywords: string[] | null;
  positionGroups: string[] | null;
  isActive: boolean;
  notes: string | null;
  lastChecked: string | null;
  lastHash: string | null;
  lastSuccessAt: string | null;
  lastError: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface OposicionForMatch {
  id: string;
  nombre: string;
  slug: string | null;
  subgrupo: string | null;
  convocatoriaNumero: string | null;
}
