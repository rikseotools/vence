/**
 * Tipos y constantes del monitoreo BOE.
 * Portado de `lib/api/boe-changes/schemas.ts` del repo principal — aquí se
 * usan tipos planos (los datos son internos, no cruzan un límite no fiable).
 */

/** Tolerancia de tamaño (bytes) para considerar que una página del BOE cambió. */
export const SIZE_TOLERANCE_BYTES = 100;

/** Timeout por defecto de los fetch al BOE. */
export const FETCH_TIMEOUT_MS = 10_000;

export interface LawForCheck {
  id: string;
  shortName: string;
  name: string;
  boeUrl: string;
  lastUpdateBoe: string | null;
  dateByteOffset: number | null;
  boeContentLength: number | null;
}

export interface HeadCheckResult {
  success: boolean;
  method?: 'head_unchanged';
  unchanged?: boolean;
  contentLength?: number | null;
  reason?: string;
  previousLength?: number | null;
  bytesDownloaded?: number;
  sizeChange?: number;
}

export interface PartialCheckResult {
  success: boolean;
  method?: 'cached_offset' | 'partial_50k' | 'partial_150k' | 'partial_300k';
  lastUpdateBOE?: string;
  bytesDownloaded?: number;
  dateOffset?: number | null;
  reason?: string;
}

export interface FullCheckResult {
  success: boolean;
  method?: 'full';
  lastUpdateBOE?: string | null;
  bytesDownloaded?: number;
  dateOffset?: number | null;
  reason?: string;
}

export interface DetectedChange {
  law: string;
  name: string;
  oldDate: string | null;
  newDate: string;
}

export interface CheckStats {
  total: number;
  checked: number;
  headUnchanged: number;
  sizeChangeDetected: number;
  cachedOffset: number;
  partial: number;
  fullDownload: number;
  changesDetected: number;
  errors: number;
  totalBytes: number;
}

export interface LawUpdateData {
  lastChecked: string;
  lastUpdateBoe?: string;
  dateByteOffset?: number;
  boeContentLength?: number;
  changeStatus?: 'changed' | 'reviewed' | 'none';
  changeDetectedAt?: string;
}

export function createInitialStats(total: number): CheckStats {
  return {
    total,
    checked: 0,
    headUnchanged: 0,
    sizeChangeDetected: 0,
    cachedOffset: 0,
    partial: 0,
    fullDownload: 0,
    changesDetected: 0,
    errors: 0,
    totalBytes: 0,
  };
}

export function formatBytes(bytes: number): string {
  if (bytes >= 1024 * 1024) {
    return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  }
  return `${(bytes / 1024).toFixed(1)} KB`;
}
