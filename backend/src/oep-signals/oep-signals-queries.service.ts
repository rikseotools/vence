import { Inject, Injectable, Logger } from '@nestjs/common';
import { and, desc, eq, gte, isNotNull, lt, sql } from 'drizzle-orm';
import { DRIZZLE, type DrizzleDB } from '../db/database.module';
import { pickBestMatch } from './oep-match';
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
        // Detector "seguimiento ciego" (27/06)
        isActive: oposiciones.isActive,
        examDate: oposiciones.examDate,
        // Sprint 2: dispatch a Lambda Playwright si fetcher_type='headless'
        fetcherType: oposiciones.fetcherType,
      })
      .from(oposiciones)
      // Monitoreo on-demand-friendly (01/06/2026): vigilar CUALQUIER oposición con
      // seguimiento_url, aunque is_active=false. Esto incluye las ~100 filas
      // coverage_level='catalogada' (cuerpos C2 registrados sin landing pública aún).
      // El descubrimiento de cuerpos lo hace Claude a mano; el cron solo revisa
      // novedades sobre las URLs que ya tenemos. is_active sigue gobernando la
      // visibilidad pública en /oposiciones (no se toca).
      .where(isNotNull(oposiciones.seguimientoUrl))
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

    // Anti-falso-positivo (ventanas largas): un hito 'current' con fecha pasada
    // NO es un silencio si la misma oposición tiene OTRO hito con fecha futura —
    // significa que el timeline sigue su curso (p.ej. "Apertura inscripción"
    // sigue current durante todo el plazo, con "Cierre" futuro por delante).
    // Solo es silencio real si no hay ningún hito futuro planificado (proceso
    // realmente estancado en su último hito conocido).
    const today = new Date().toISOString().slice(0, 10);
    const futureRows = await this.db
      .select({ oposicionId: convocatoriaHitos.oposicionId })
      .from(convocatoriaHitos)
      .where(gte(convocatoriaHitos.fecha, today));
    const oposicionesConFuturo = new Set(
      futureRows.map((r) => r.oposicionId),
    );

    return rows
      .filter((r) => !oposicionesConFuturo.has(r.oposicionId))
      .map((r) => {
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

  /**
   * Segundo modo de silencio: TIMELINE AGOTADO.
   *
   * `findTimelineSilences` exige un hito en estado `current` con la fecha vencida. Eso deja
   * un punto ciego enorme, porque **el estado natural de un timeline al día es todo
   * `completed`**: nadie marca como "en curso" un hito que todavía no se ha anunciado. Medido
   * el 20/07/2026: **90 de 118 oposiciones activas (76%) no tenían NINGÚN hito `current`**, así
   * que el sensor no las miraba nunca — entre ellas `administrativo-universidad-leon`, con el
   * contenido listo y esperando una fecha de examen que ningún sensor iba a cazar.
   *
   * El hueco se agravó al retirar `hash_change` (T-050, 20/07): era el único que vigilaba la
   * página propia de cada convocatoria. Y `detect-boletines` no lo tapa: lee sumarios buscando
   * convocatorias NUEVAS, y una resolución de listas definitivas de una convocatoria ya
   * conocida no lo es.
   *
   * Aquí el disparador es el contrario: el timeline se AGOTÓ (todos los hitos completados,
   * ninguno futuro) hace más de `graceDays` días, la oposición sigue SIN fecha de examen, y su
   * `estado_proceso` implica que todavía se espera algo. Los ciclos ya cerrados
   * (`examen_realizado`, `resultados`, `nombramientos`) NO son silencio: son rollover, y tienen
   * su propio runbook.
   */
  async findExhaustedTimelines(
    graceDays = 21,
    maxDays = 365,
  ): Promise<TimelineSilenceCandidate[]> {
    const res = (await this.db.execute(sql`
      SELECT o.id                       AS "oposicionId",
             o.nombre                   AS "oposicionNombre",
             o.slug                     AS "oposicionSlug",
             ult.id                     AS "hitoId",
             ult.titulo                 AS "hitoTitulo",
             ult.fecha::text            AS "hitoFecha",
             (CURRENT_DATE - ult.fecha) AS "diasRetraso"
      FROM oposiciones o
      JOIN LATERAL (
        SELECT ch.id, ch.titulo, ch.fecha
        FROM convocatoria_hitos ch
        WHERE ch.oposicion_id = o.id
        ORDER BY ch.fecha DESC
        LIMIT 1
      ) ult ON TRUE
      WHERE o.is_active
        AND o.exam_date IS NULL
        -- oep_aprobada queda FUERA a proposito, y es la calibración que más ruido evita.
        -- Una OEP aprobada NO fija fecha de examen: falta la convocatoria, y ese hueco dura
        -- meses o años con toda normalidad. Su timeline se agota por ESTRUCTURA, no por
        -- silencio anómalo. Verificado el 20/07 drenando a mano: de 9 candidatas en ese
        -- estado, 9 estaban simplemente esperando convocatoria, ninguna tenía novedad que
        -- capturar. Eran el 44% de los candidatos (18 de 41) → 18 falsos positivos
        -- permanentes. Las OEP sin convocatoria las vigilan otros sensores (boe_api,
        -- regional_scan, pag_empleo), que es su trabajo.
        AND o.estado_proceso IN (
          'convocada', 'convocatoria_publicada', 'inscripcion_abierta',
          'inscripcion_cerrada', 'lista_admitidos', 'pendiente_examen'
        )
        AND ult.fecha < CURRENT_DATE - ${graceDays}::int
        -- Tope superior: pasado ~1 año esto ya NO es "silencio a la espera de noticias" sino
        -- un registro abandonado (había 6 así el 20/07, la más vieja de 2023 — 990 días).
        -- Mezclarlos falsearía la señal: el admin abriría la ficha esperando una novedad
        -- inminente y encontraría una convocatoria muerta. Son higiene de datos/rollover, y
        -- tienen su propio runbook. El servicio los cuenta y los loguea aparte: se excluyen,
        -- pero NO en silencio.
        AND ult.fecha >= CURRENT_DATE - ${maxDays}::int
        -- ningún hito futuro ni en curso: el timeline está REALMENTE agotado
        AND NOT EXISTS (
          SELECT 1 FROM convocatoria_hitos f
          WHERE f.oposicion_id = o.id
            AND (f.fecha >= CURRENT_DATE OR f.status = 'current')
        )
        -- MEMORIA (T-059): si ya se revisó el timeline y se confirmó sin novedad DESPUÉS del
        -- último hito, no re-avisar. Solo vuelve a ser candidata cuando aparezca un hito NUEVO
        -- (posterior a la revisión). Sin esto, el sensor grita cada noche de las mismas
        -- oposiciones ya revisadas → la bandeja ruidosa que mató a hash_change.
        AND (o.timeline_reviewed_at IS NULL OR ult.fecha > o.timeline_reviewed_at::date)
        -- FUENTE ROTA (T-059): si el monitoreo de esa oposición está en error (anti-bot,
        -- ECONNREFUSED, SPA), emitir una señal de silencio es pedirle al admin que compruebe
        -- algo INVERIFICABLE por construcción — el mismo mecanismo por el que murió hash_change.
        -- Es otro problema (URL de seguimiento caída, familia T-047), no de este sensor.
        AND (o.seguimiento_change_status IS DISTINCT FROM 'error')
      ORDER BY ult.fecha ASC
    `)) as unknown;

    const rows = Array.isArray(res)
      ? res
      : ((res as { rows?: unknown[] })?.rows ?? []);
    return (rows as TimelineSilenceCandidate[]).map((r) => ({
      ...r,
      diasRetraso: Number(r.diasRetraso),
    }));
  }

  /**
   * Cuenta las que el tope de `findExhaustedTimelines` deja fuera por ancianas (>maxDays).
   * Existe para que la exclusión NO sea silenciosa: un recorte que no se cuenta se lee como
   * "cubierto todo" cuando no lo está. Son candidatas a higiene de datos/rollover, no a señal.
   */
  async countAbandonedTimelines(maxDays = 365): Promise<number> {
    const res = (await this.db.execute(sql`
      SELECT COUNT(*)::int AS n
      FROM oposiciones o
      JOIN LATERAL (
        SELECT ch.fecha FROM convocatoria_hitos ch
        WHERE ch.oposicion_id = o.id ORDER BY ch.fecha DESC LIMIT 1
      ) ult ON TRUE
      WHERE o.is_active
        AND o.exam_date IS NULL
        AND o.estado_proceso IN (
          'convocada', 'convocatoria_publicada', 'inscripcion_abierta',
          'inscripcion_cerrada', 'lista_admitidos', 'pendiente_examen'
        )
        AND ult.fecha < CURRENT_DATE - ${maxDays}::int
        AND NOT EXISTS (
          SELECT 1 FROM convocatoria_hitos f
          WHERE f.oposicion_id = o.id
            AND (f.fecha >= CURRENT_DATE OR f.status = 'current')
        )
    `)) as unknown;
    const rows = Array.isArray(res)
      ? res
      : ((res as { rows?: unknown[] })?.rows ?? []);
    return Number((rows as Array<{ n: number }>)[0]?.n ?? 0);
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
          detectedSistema: input.detectedSistema ?? null,
          confidenceScore: input.confidenceScore,
          isNovel: input.isNovel,
          signalSummary: input.signalSummary,
          rawExtraction: (input.rawExtraction ?? {}) as Record<string, unknown>,
          dedupeKey: input.dedupeKey ?? null,
          adminNotes: input.adminNotes ?? null,
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

  /** Carga el catálogo (todas las oposiciones) para el matcher estructural.
   *  Público para poder precargarlo UNA vez por pasada (radar) y no recargarlo
   *  por señal. NO filtra is_active (las catalogadas también se vigilan, §10). */
  async loadOposicionesForMatch(): Promise<
    Array<{
      id: string;
      nombre: string;
      slug: string | null;
      shortName: string | null;
      subgrupo: string | null;
      administracion: string | null;
      inscriptionDeadline: string | null;
    }>
  > {
    // Lee la VISTA SSOT `oposiciones_ssot` (deadline resuelto COALESCE(conv,opos)),
    // NO la tabla `oposiciones` legacy — igual que el matcher de Next.js. Si no,
    // `inscription-reconcile` compara la frescura del plazo contra una fecha stale.
    // (Sin modelo Drizzle de la vista → SQL crudo, como advance-estado.)
    const res = (await this.db.execute(sql`
      SELECT id, nombre, slug, short_name AS "shortName", subgrupo, administracion,
             inscription_deadline::text AS "inscriptionDeadline"
      FROM oposiciones_ssot
    `)) as unknown;
    return (Array.isArray(res)
      ? res
      : ((res as { rows?: unknown[] }).rows ?? [])) as Array<{
      id: string;
      nombre: string;
      slug: string | null;
      shortName: string | null;
      subgrupo: string | null;
      administracion: string | null;
      inscriptionDeadline: string | null;
    }>;
  }

  async matchDetectedOepToOposicion(params: {
    /** Nombre del cuerpo SOLO (sin organismo — el organismo va aparte). */
    cuerpo: string;
    regionName: string;
    /** 'C1' | 'C2' del PAG. */
    grupo?: string | null;
    /** Estatal | Autonómica | Local | Universidad | Otra. */
    admin?: string | null;
    /** Órgano convocante (Ayuntamiento/Universidad/Consejería…). */
    organismo?: string | null;
    bocRef?: string | null;
  },
  /** Catálogo precargado (opcional): evita recargar la tabla por señal cuando
   *  se matchean muchas en una misma pasada. Si se omite, se carga aquí. */
  catalog?: Awaited<ReturnType<OepSignalsQueriesService['loadOposicionesForMatch']>>,
  ): Promise<{
    matched: boolean;
    oposicionId: string | null;
    oposicionNombre: string | null;
    /** `inscription_deadline` ('YYYY-MM-DD') de la oposición casada, para el
     *  veredicto de frescura. null si no casó o no tiene fecha. */
    inscriptionDeadline: string | null;
  }> {
    // 1) Match exacto por convocatoria_numero si hay BOC ref (máxima confianza).
    if (params.bocRef) {
      // Vista SSOT: convocatoria_numero + deadline resueltos (COALESCE conv,opos).
      const bocRes = (await this.db.execute(sql`
        SELECT id, nombre, inscription_deadline::text AS "inscriptionDeadline"
        FROM oposiciones_ssot
        WHERE convocatoria_numero = ${params.bocRef}
        LIMIT 1
      `)) as unknown;
      const byBoc = (Array.isArray(bocRes)
        ? bocRes
        : ((bocRes as { rows?: unknown[] }).rows ?? [])) as Array<{
        id: string;
        nombre: string | null;
        inscriptionDeadline: string | null;
      }>;
      if (byBoc.length > 0) {
        return {
          matched: true,
          oposicionId: byBoc[0].id,
          oposicionNombre: byBoc[0].nombre,
          inscriptionDeadline: byBoc[0].inscriptionDeadline
            ? String(byBoc[0].inscriptionDeadline)
            : null,
        };
      }
    }

    // 2) Match estructural por familia + nivel de administración + grupo
    //    (módulo puro `oep-match`, precisión > recall). Ver oep-match.ts.
    //    NO se filtra por is_active: las CATALOGADAS (is_active=false, ~83% del
    //    catálogo) también se vigilan (norma §10). Excluirlas hacía que toda
    //    señal de descubrimiento sobre una catalogada existente saliera novel →
    //    duplicados (caso UAM Escala Especial Básica, 02/07/2026).
    const all = catalog ?? (await this.loadOposicionesForMatch());

    const best = pickBestMatch(
      {
        cuerpo: params.cuerpo,
        grupo: params.grupo,
        admin: params.admin,
        ccaa: params.regionName,
        organismo: params.organismo,
      },
      all,
    );

    const matchedRow = best.oposicionId
      ? all.find((o) => o.id === best.oposicionId)
      : null;

    return {
      matched: best.matched,
      oposicionId: best.oposicionId,
      oposicionNombre: best.oposicionNombre,
      inscriptionDeadline: matchedRow?.inscriptionDeadline
        ? String(matchedRow.inscriptionDeadline)
        : null,
    };
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

  // ============================================
  // PROGRAMA NORMAS (Sensor temario_change)
  // ============================================

  /**
   * Lee el registro de norma-fuente del temario por oposición
   * (`oposicion_programa_normas`, sin mapping Drizzle → sql raw). El sensor
   * `temario_change` lo usa para auto-vincular una señal a la oposición cuya
   * Orden de programas ha sido modificada.
   */
  async getProgramaNormas(): Promise<ProgramaNormaRow[]> {
    const result = await this.db.execute(sql`
      SELECT n.oposicion_id, n.norma_ref, n.cuerpo, n.ambito, o.nombre AS oposicion_nombre
      FROM oposicion_programa_normas n
      JOIN oposiciones o ON o.id = n.oposicion_id
      WHERE n.is_active = true
    `);
    return result as unknown as ProgramaNormaRow[];
  }

  /** Lee filas activas de `generic_source_checks` (tabla sin mapping Drizzle → sql raw). */
  async getActiveGenericSources(): Promise<GenericSourceRow[]> {
    const result = await this.db.execute(sql`
      SELECT id, source_key, source_name, source_url, last_hash, last_checked_at, fetcher_type
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

  // ============================================
  // RADAR multi-capa — observabilidad (radar_adapter_runs)
  // ============================================

  /** Registra el resultado de UN adapter en una pasada del orquestador. */
  async insertRadarAdapterRun(r: {
    runId: string;
    layer: string;
    adapterKey: string;
    status: string;
    startedAt: Date;
    durationMs: number;
    itemsScanned: number;
    candidates: number;
    signalsNew: number;
    signalsDupe: number;
    httpStatus?: number | null;
    errorMessage?: string | null;
  }): Promise<void> {
    await this.db.execute(sql`
      INSERT INTO radar_adapter_runs
        (run_id, layer, adapter_key, status, started_at, duration_ms,
         items_scanned, candidates, signals_new, signals_dupe, http_status, error_message)
      VALUES (${r.runId}, ${r.layer}, ${r.adapterKey}, ${r.status},
              ${r.startedAt.toISOString()}, ${r.durationMs}, ${r.itemsScanned},
              ${r.candidates}, ${r.signalsNew}, ${r.signalsDupe},
              ${r.httpStatus ?? null}, ${r.errorMessage ?? null})
    `);
  }

  /** Nº de fallos consecutivos más recientes de un adapter (para degraded). */
  async radarAdapterFailStreak(adapterKey: string): Promise<number> {
    const rows = (await this.db.execute(sql`
      SELECT status FROM radar_adapter_runs
      WHERE adapter_key = ${adapterKey}
      ORDER BY created_at DESC
      LIMIT 10
    `)) as unknown as { status: string }[];
    let streak = 0;
    for (const row of rows) {
      if (row.status === 'failed' || row.status === 'timeout') streak++;
      else break;
    }
    return streak;
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
  /** 'headless' para las fuentes que montan su contenido con JS (La Moncloa es SharePoint y a fetch
   *  plano solo devuelve 2.4k de menús: el LLM no veía un solo resumen). Ver migración
   *  20260716_generic_source_fetcher_type.sql. */
  fetcher_type: 'http' | 'headless';
}

// ============================================
// TIPO raw para oposicion_programa_normas (sensor temario_change)
// ============================================

export interface ProgramaNormaRow {
  oposicion_id: string;
  norma_ref: string;
  cuerpo: string | null;
  ambito: string | null;
  oposicion_nombre: string;
}
