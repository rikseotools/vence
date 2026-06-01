import { Inject, Injectable, Logger } from '@nestjs/common';
import { and, desc, eq, isNotNull, lt, sql } from 'drizzle-orm';
import { DRIZZLE, type DrizzleDB } from '../db/database.module';
import {
  convocatoriaHitos,
  detectionSources,
  oepDetectionSignals,
  oposiciones,
} from './oep-signals.schema';
import type {
  CreateSignalInput,
  DetectionSourceForScan,
  OposicionForMatch,
  OposicionToScan,
  TimelineSilenceCandidate,
} from './oep-signals-queries.types';

/**
 * Servicio de acceso a datos para los sensores OEP.
 * Portado de `lib/api/oep-signals/queries.ts` y `lib/api/oep-signals/sources.ts`.
 */
@Injectable()
export class OepSignalsQueriesService {
  private readonly logger = new Logger(OepSignalsQueriesService.name);

  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDB) {}

  // ============================================
  // OPOSICIONES ACTIVAS CON seguimiento_url
  // ============================================

  async getOposicionesForLlmScan(): Promise<OposicionToScan[]> {
    const rows = await this.db
      .select({
        id: oposiciones.id,
        nombre: oposiciones.nombre,
        slug: oposiciones.slug,
        shortName: oposiciones.shortName,
        seguimientoUrl: oposiciones.seguimientoUrl,
        estadoProceso: oposiciones.estadoProceso,
        plazasLibres: oposiciones.plazasLibres,
        plazasDiscapacidad: oposiciones.plazasDiscapacidad,
        oepFecha: oposiciones.oepFecha,
        convocatoriaNumero: oposiciones.convocatoriaNumero,
        // Sprint 2: dispatch a Lambda Playwright si fetcher_type='headless'
        fetcherType: oposiciones.fetcherType,
      })
      .from(oposiciones)
      .where(
        and(
          eq(oposiciones.isActive, true),
          isNotNull(oposiciones.seguimientoUrl),
        ),
      )
      .orderBy(oposiciones.nombre);

    return rows.filter((r) => r.seguimientoUrl !== null) as OposicionToScan[];
  }

  // ============================================
  // TIMELINE SILENCE (Sensor detect-timeline-silence)
  // ============================================

  async findTimelineSilences(graceDays = 3): Promise<TimelineSilenceCandidate[]> {
    const thresholdDate = new Date();
    thresholdDate.setDate(thresholdDate.getDate() - graceDays);
    const threshold = thresholdDate.toISOString().slice(0, 10);

    const rows = await this.db
      .select({
        oposicionId: convocatoriaHitos.oposicionId,
        oposicionNombre: oposiciones.nombre,
        oposicionSlug: oposiciones.slug,
        hitoId: convocatoriaHitos.id,
        hitoTitulo: convocatoriaHitos.titulo,
        hitoFecha: convocatoriaHitos.fecha,
      })
      .from(convocatoriaHitos)
      .leftJoin(oposiciones, eq(convocatoriaHitos.oposicionId, oposiciones.id))
      .where(
        and(
          eq(convocatoriaHitos.status, 'current'),
          lt(convocatoriaHitos.fecha, threshold),
          eq(oposiciones.isActive, true),
        ),
      );

    return rows.map((r) => {
      const fechaDate = new Date(r.hitoFecha);
      const hoyDate = new Date();
      const diffMs = hoyDate.getTime() - fechaDate.getTime();
      const diasRetraso = Math.floor(diffMs / (1000 * 60 * 60 * 24));
      return {
        oposicionId: r.oposicionId,
        oposicionNombre: r.oposicionNombre ?? '',
        oposicionSlug: r.oposicionSlug ?? null,
        hitoId: r.hitoId,
        hitoTitulo: r.hitoTitulo,
        hitoFecha: r.hitoFecha,
        diasRetraso,
      };
    });
  }

  // ============================================
  // INSERT SIGNAL (dedupe via ON CONFLICT)
  // ============================================

  async insertSignal(
    input: CreateSignalInput,
  ): Promise<{ inserted: boolean; id: string | null }> {
    try {
      const result = await this.db
        .insert(oepDetectionSignals)
        .values({
          oposicionId: input.oposicionId ?? null,
          sourceId: input.sourceId ?? null,
          regionName: input.regionName ?? null,
          positionCategory: input.positionCategory ?? null,
          detectedOposicionName: input.detectedOposicionName ?? null,
          sensorType: input.sensorType,
          sourceUrl: input.sourceUrl ?? null,
          detectedYear: input.detectedYear ?? null,
          detectedPlazasLibre: input.detectedPlazasLibre ?? null,
          detectedPlazasDiscapacidad: input.detectedPlazasDiscapacidad ?? null,
          detectedPlazasPromocionInterna:
            input.detectedPlazasPromocionInterna ?? null,
          detectedBocRef: input.detectedBocRef ?? null,
          detectedFechaPublicacion: input.detectedFechaPublicacion ?? null,
          detectedFechaInscripcionFin: input.detectedFechaInscripcionFin ?? null,
          detectedFechaExamen: input.detectedFechaExamen ?? null,
          detectedEstado: input.detectedEstado ?? null,
          confidenceScore: input.confidenceScore,
          isNovel: input.isNovel,
          signalSummary: input.signalSummary,
          rawExtraction: (input.rawExtraction ?? {}) as Record<string, unknown>,
          dedupeKey: input.dedupeKey ?? null,
        })
        .onConflictDoNothing({ target: oepDetectionSignals.dedupeKey })
        .returning({ id: oepDetectionSignals.id });

      if (result.length === 0) {
        return { inserted: false, id: null };
      }
      return { inserted: true, id: result[0].id };
    } catch (err) {
      this.logger.error(
        `Error insertSignal: ${err instanceof Error ? err.message : String(err)}`,
      );
      throw err;
    }
  }

  // ============================================
  // MATCH DETECTED OEP vs existing oposiciones
  // ============================================

  async matchDetectedOepToOposicion(params: {
    detectedName: string;
    regionName: string;
    bocRef?: string | null;
  }): Promise<{ matched: boolean; oposicionId: string | null; oposicionNombre: string | null }> {
    // 1) Match exacto por convocatoria_numero si hay BOC ref
    if (params.bocRef) {
      const byBoc = await this.db
        .select({ id: oposiciones.id, nombre: oposiciones.nombre })
        .from(oposiciones)
        .where(eq(oposiciones.convocatoriaNumero, params.bocRef))
        .limit(1);
      if (byBoc.length > 0) {
        return {
          matched: true,
          oposicionId: byBoc[0].id,
          oposicionNombre: byBoc[0].nombre,
        };
      }
    }

    // 2) Match fuzzy por nombre + región
    const normalize = (s: string) =>
      s
        .toLowerCase()
        .replace(/[^a-z0-9ñ]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();

    const detected = normalize(params.detectedName);
    const region = normalize(params.regionName);

    const hasAuxAdmin = /auxiliar\s*admin/.test(detected);
    const hasAdmin = /administrativ/.test(detected) && !hasAuxAdmin;

    const all = await this.db
      .select({
        id: oposiciones.id,
        nombre: oposiciones.nombre,
        slug: oposiciones.slug,
        subgrupo: oposiciones.subgrupo,
      })
      .from(oposiciones)
      .where(eq(oposiciones.isActive, true));

    for (const o of all) {
      const nomNorm = normalize(o.nombre);
      const slugNorm = normalize(o.slug ?? '');
      const regionInSlug =
        slugNorm.includes(region) || nomNorm.includes(region);
      if (!regionInSlug) continue;

      if (
        hasAuxAdmin &&
        /auxiliar|c2/.test(nomNorm + ' ' + (o.subgrupo ?? ''))
      ) {
        return {
          matched: true,
          oposicionId: o.id,
          oposicionNombre: o.nombre,
        };
      }
      if (
        hasAdmin &&
        /administrativ|c1/.test(nomNorm + ' ' + (o.subgrupo ?? ''))
      ) {
        return {
          matched: true,
          oposicionId: o.id,
          oposicionNombre: o.nombre,
        };
      }
    }

    return { matched: false, oposicionId: null, oposicionNombre: null };
  }

  // ============================================
  // DETECTION SOURCES (Sensor detect-regional-oeps)
  // ============================================

  async getActiveSources(): Promise<DetectionSourceForScan[]> {
    const rows = await this.db
      .select()
      .from(detectionSources)
      .where(eq(detectionSources.isActive, true))
      .orderBy(detectionSources.sourceType, detectionSources.regionName);

    return rows as DetectionSourceForScan[];
  }

  async updateSourceCheckResult(params: {
    sourceId: string;
    newHash: string | null;
    error: string | null;
  }): Promise<void> {
    const now = new Date().toISOString();
    await this.db
      .update(detectionSources)
      .set({
        lastChecked: now,
        ...(params.newHash !== null ? { lastHash: params.newHash } : {}),
        ...(params.error === null ? { lastSuccessAt: now } : {}),
        lastError: params.error,
        updatedAt: now,
      })
      .where(eq(detectionSources.id, params.sourceId));
  }

  // ============================================
  // GENERIC SOURCE CHECKS (Sensor detect-generic-sources)
  // ============================================

  /** Lee filas activas de `generic_source_checks` (tabla sin mapping Drizzle → sql raw). */
  async getActiveGenericSources(): Promise<GenericSourceRow[]> {
    const result = await this.db.execute(sql`
      SELECT id, source_key, source_name, source_url, last_hash, last_checked_at
      FROM generic_source_checks
      WHERE is_active = true
    `);
    // postgres-js devuelve los rows directamente como array
    return (result as unknown as GenericSourceRow[]);
  }

  async updateGenericSourceChecked(params: {
    id: string;
    now: string;
  }): Promise<void> {
    await this.db.execute(sql`
      UPDATE generic_source_checks
      SET last_checked_at = ${params.now}, updated_at = ${params.now}
      WHERE id = ${params.id}
    `);
  }

  async updateGenericSourceHash(params: {
    id: string;
    newHash: string;
    now: string;
  }): Promise<void> {
    await this.db.execute(sql`
      UPDATE generic_source_checks
      SET last_hash = ${params.newHash}, last_checked_at = ${params.now}, updated_at = ${params.now}
      WHERE id = ${params.id}
    `);
  }

  async updateGenericSourceSignal(params: {
    id: string;
    newHash: string;
    now: string;
    signalId: string | null;
  }): Promise<void> {
    await this.db.execute(sql`
      UPDATE generic_source_checks
      SET last_hash = ${params.newHash},
          last_checked_at = ${params.now},
          last_changed_at = ${params.now},
          last_signal_id = ${params.signalId},
          updated_at = ${params.now}
      WHERE id = ${params.id}
    `);
  }

  // ============================================
  // OPOSICIONES FOR MATCH (subset sin seguimientoUrl)
  // ============================================

  async getAllActiveOposicionesForMatch(): Promise<OposicionForMatch[]> {
    return this.db
      .select({
        id: oposiciones.id,
        nombre: oposiciones.nombre,
        slug: oposiciones.slug,
        subgrupo: oposiciones.subgrupo,
        convocatoriaNumero: oposiciones.convocatoriaNumero,
      })
      .from(oposiciones)
      .where(eq(oposiciones.isActive, true));
  }
}

// ============================================
// TIPO raw para generic_source_checks
// ============================================

export interface GenericSourceRow {
  id: string;
  source_key: string;
  source_name: string;
  source_url: string;
  last_hash: string | null;
  last_checked_at: string | null;
}
