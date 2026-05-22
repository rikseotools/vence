/**
 * Queries para el cron check-seguimiento.
 * Portado de `lib/api/seguimiento-convocatorias/queries.ts`.
 *
 * Las operaciones sobre `oposiciones` con columnas `seguimiento_*` usan
 * la tabla definida en `check-seguimiento.schema.ts` (las columnas no están
 * en el schema principal del backend). Las operaciones que necesitan INSERT
 * en `convocatoria_seguimiento_checks` y `oep_detection_signals` usan sql``
 * porque la tabla de checks no tiene mapping Drizzle, y para OEP signals se
 * usa la tabla local definida en el schema de este módulo.
 */

import { eq, isNotNull, sql } from 'drizzle-orm';
import type { DrizzleDB } from '../db/database.module';
import { oepDetectionSignals, oposiciones } from './check-seguimiento.schema';
import {
  fetchSeguimientoPage,
  getContentPreview,
  hashContent,
  isBlockedPage,
} from './seguimiento-fetch';

// ============================================
// TIPOS PÚBLICOS
// ============================================

export interface OposicionToCheck {
  id: string;
  nombre: string;
  slug: string | null;
  shortName: string | null;
  seguimientoUrl: string;
  seguimientoLastHash: string | null;
  seguimientoLastChecked: string | null;
  seguimientoChangeStatus: string | null;
}

export interface CheckResult {
  oposicionId: string;
  nombre: string;
  slug: string | null;
  hasChanged: boolean;
  newHash: string;
  oldHash: string | null;
  httpStatus: number;
  contentLength: number;
  contentPreview: string;
  error: string | null;
}

export interface SeguimientoCheckStats {
  total: number;
  checked: number;
  changed: number;
  errors: number;
  unchanged: number;
}

// ============================================
// LECTURAS
// ============================================

/** Obtiene oposiciones activas con seguimiento_url para verificar. */
export async function getOposicionesForSeguimientoCheck(
  db: DrizzleDB,
): Promise<OposicionToCheck[]> {
  const rows = await db
    .select({
      id: oposiciones.id,
      nombre: oposiciones.nombre,
      slug: oposiciones.slug,
      shortName: oposiciones.shortName,
      seguimientoUrl: oposiciones.seguimientoUrl,
      seguimientoLastHash: oposiciones.seguimientoLastHash,
      seguimientoLastChecked: oposiciones.seguimientoLastChecked,
      seguimientoChangeStatus: oposiciones.seguimientoChangeStatus,
    })
    .from(oposiciones)
    .where(
      sql`${oposiciones.isActive} = true AND ${oposiciones.seguimientoUrl} IS NOT NULL`,
    )
    .orderBy(oposiciones.nombre);

  return rows
    .filter((r) => r.seguimientoUrl !== null)
    .map((r) => ({
      id: r.id,
      nombre: r.nombre,
      slug: r.slug,
      shortName: r.shortName,
      seguimientoUrl: r.seguimientoUrl as string,
      seguimientoLastHash: r.seguimientoLastHash,
      seguimientoLastChecked: r.seguimientoLastChecked,
      seguimientoChangeStatus: r.seguimientoChangeStatus,
    }));
}

// ============================================
// VERIFICACIÓN DE URL
// ============================================

/** Verifica una URL de seguimiento y devuelve el resultado del check. */
export async function checkSeguimientoUrl(
  oposicion: OposicionToCheck,
): Promise<CheckResult> {
  const { html, httpStatus, error: fetchError } = await fetchSeguimientoPage(
    oposicion.seguimientoUrl,
  );

  if (fetchError) {
    return {
      oposicionId: oposicion.id,
      nombre: oposicion.nombre,
      slug: oposicion.slug,
      hasChanged: false,
      newHash: '',
      oldHash: oposicion.seguimientoLastHash,
      httpStatus: 0,
      contentLength: 0,
      contentPreview: '',
      error: fetchError,
    };
  }

  const httpOk = httpStatus >= 200 && httpStatus < 300;
  if (!httpOk || isBlockedPage(html)) {
    return {
      oposicionId: oposicion.id,
      nombre: oposicion.nombre,
      slug: oposicion.slug,
      hasChanged: false,
      newHash: '',
      oldHash: oposicion.seguimientoLastHash,
      httpStatus,
      contentLength: html.length,
      contentPreview: getContentPreview(html),
      error: httpOk ? 'Página de bloqueo (WAF/Access Denied)' : `HTTP ${httpStatus}`,
    };
  }

  const newHash = hashContent(html);
  const hasChanged =
    oposicion.seguimientoLastHash !== null &&
    newHash !== oposicion.seguimientoLastHash;

  return {
    oposicionId: oposicion.id,
    nombre: oposicion.nombre,
    slug: oposicion.slug,
    hasChanged,
    newHash,
    oldHash: oposicion.seguimientoLastHash,
    httpStatus,
    contentLength: html.length,
    contentPreview: getContentPreview(html),
    error: null,
  };
}

// ============================================
// ESCRITURAS
// ============================================

/**
 * Guarda el resultado de un check en BD + genera señal OEP si hay cambio.
 * Usa sql`` para la tabla `convocatoria_seguimiento_checks` (sin mapping Drizzle)
 * y Drizzle para `oep_detection_signals` y `oposiciones`.
 */
export async function saveSeguimientoCheck(
  db: DrizzleDB,
  result: CheckResult,
): Promise<void> {
  // Insertar en historial
  await db.execute(sql`
    INSERT INTO convocatoria_seguimiento_checks
      (oposicion_id, content_hash, content_length, http_status, has_changed, error_message, content_preview)
    VALUES
      (${result.oposicionId}::uuid, ${result.newHash}, ${result.contentLength},
       ${result.httpStatus}, ${result.hasChanged}, ${result.error}, ${result.contentPreview})
  `);

  // Actualizar cache en oposiciones
  if (result.error) {
    await db
      .update(oposiciones)
      .set({
        seguimientoLastChecked: sql`NOW()`,
        seguimientoChangeStatus: 'error',
      })
      .where(eq(oposiciones.id, result.oposicionId));
  } else if (result.hasChanged) {
    await db
      .update(oposiciones)
      .set({
        seguimientoLastChecked: sql`NOW()`,
        seguimientoLastHash: result.newHash,
        seguimientoChangeDetectedAt: sql`NOW()`,
        seguimientoChangeStatus: 'changed',
      })
      .where(eq(oposiciones.id, result.oposicionId));

    // Fusión con oep-signals: generar señal hash_change
    await insertHashChangeSignal(db, result);
  } else {
    await db
      .update(oposiciones)
      .set({
        seguimientoLastChecked: sql`NOW()`,
        seguimientoLastHash: result.newHash,
        seguimientoChangeStatus: 'ok',
      })
      .where(eq(oposiciones.id, result.oposicionId));
  }
}

/** Inserta señal `hash_change` en `oep_detection_signals`, ignorando duplicados. */
async function insertHashChangeSignal(db: DrizzleDB, result: CheckResult): Promise<void> {
  const today = new Date().toISOString().slice(0, 10);
  const dedupeKey = `hash_change:${result.oposicionId}:0:${today}`;

  await db
    .insert(oepDetectionSignals)
    .values({
      oposicionId: result.oposicionId,
      sensorType: 'hash_change',
      sourceUrl: null,
      confidenceScore: 30, // baseScoreBySensor('hash_change')
      isNovel: false,
      signalSummary: `Hash de página oficial cambió (${result.contentLength} bytes). Revisar manualmente vs BD. Preview: ${result.contentPreview.slice(0, 200)}`,
      rawExtraction: {
        oldHash: result.oldHash,
        newHash: result.newHash,
        contentLength: result.contentLength,
        contentPreview: result.contentPreview.slice(0, 500),
        httpStatus: result.httpStatus,
      } as Record<string, unknown>,
      dedupeKey,
    })
    .onConflictDoNothing({ target: oepDetectionSignals.dedupeKey });
}
