import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { and, eq, isNotNull, lt, ne, or, sql } from 'drizzle-orm';
import { DRIZZLE, type DrizzleDB } from '../db/database.module';
import { laws } from '../db/schema';
import {
  checkWithContentLength,
  checkWithFullDownload,
  checkWithPartialDownload,
} from './boe-fetch';
import {
  createInitialStats,
  formatBytes,
  type CheckStats,
  type DetectedChange,
  type LawForCheck,
  type LawUpdateData,
} from './boe-changes.types';

/**
 * Parsea fecha DD/MM/YYYY a Date. Devuelve null si formato inválido.
 */
export function parseDDMMYYYY(s: string | null | undefined): Date | null {
  if (!s || typeof s !== 'string' || !/^\d{2}\/\d{2}\/\d{4}$/.test(s)) return null;
  const [d, m, y] = s.split('/').map(Number);
  const date = new Date(y, m - 1, d);
  if (isNaN(date.getTime())) return null;
  return date;
}

/** Procesa la verificación BOE de todas las leyes monitorizables. */
@Injectable()
export class BoeChangesService {
  private readonly logger = new Logger(BoeChangesService.name);

  // Lotes paralelos: el tiempo de cada lote lo domina la ley más lenta,
  // no la suma. Sin presupuesto de tiempo (proceso largo) → procesa TODO.
  private readonly chunkSize = 10;

  constructor(
    @Inject(DRIZZLE) private readonly db: DrizzleDB,
    private readonly config: ConfigService,
  ) {}

  /**
   * Verifica TODAS las leyes monitorizables contra el BOE.
   *
   * Fix de causa raíz (vs el cron viejo de Vercel):
   *  1. SIN presupuesto de 50s — al ser proceso largo, procesa las ~475 leyes
   *     hasta el final. El cron viejo solo llegaba a ~150/ejecución.
   *  2. Un fallo de extracción AVANZA `last_checked` igualmente (ver processLaw)
   *     → la ley rota al final de la cola en vez de atascar el principio.
   */
  async runCheck(): Promise<CheckStats> {
    const startTime = Date.now();
    this.logger.log('Iniciando verificación BOE...');

    const lawsToCheck = await this.getLawsForBoeCheck();
    if (lawsToCheck.length === 0) {
      this.logger.log('No hay leyes pendientes de verificar hoy');
      return createInitialStats(0);
    }

    const now = new Date();
    const stats = createInitialStats(lawsToCheck.length);
    const changes: DetectedChange[] = [];

    for (let i = 0; i < lawsToCheck.length; i += this.chunkSize) {
      const chunk = lawsToCheck.slice(i, i + this.chunkSize);
      const results = await Promise.allSettled(
        chunk.map((law) => this.processLaw(law, now, stats, changes)),
      );
      for (const r of results) {
        stats.checked++;
        if (r.status === 'rejected' || r.value !== true) stats.errors++;
      }
    }

    const duration = `${((Date.now() - startTime) / 1000).toFixed(1)}s`;
    this.logger.log(
      `Verificación completada: ${stats.checked}/${lawsToCheck.length} leyes, ` +
        `${stats.changesDetected} cambios, ${duration}`,
    );
    this.logger.log(
      `Detalle: ${stats.headUnchanged} sin cambio (HEAD), ` +
        `${stats.sizeChangeDetected} por tamaño, ` +
        `${stats.partial + stats.cachedOffset} parciales, ` +
        `${stats.fullDownload} completas, ${stats.errors} errores, ` +
        `${formatBytes(stats.totalBytes)} descargados`,
    );

    if (changes.length > 0) {
      this.logger.warn(
        `${changes.length} cambios detectados: ${changes.map((c) => c.law).join(', ')}`,
      );
      await this.sendNotification(changes, stats, duration);
    }

    return stats;
  }

  /** Leyes monitorizables pendientes de verificar hoy (orden: las más antiguas primero). */
  private async getLawsForBoeCheck(): Promise<LawForCheck[]> {
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);
    const todayStr = today.toISOString();

    const rows = await this.db
      .select({
        id: laws.id,
        shortName: laws.shortName,
        name: laws.name,
        boeUrl: laws.boeUrl,
        lastUpdateBoe: laws.lastUpdateBoe,
        dateByteOffset: laws.dateByteOffset,
        boeContentLength: laws.boeContentLength,
      })
      .from(laws)
      .where(
        and(
          isNotNull(laws.boeUrl),
          ne(laws.scope, 'eu'),
          or(sql`${laws.lastChecked} IS NULL`, lt(laws.lastChecked, todayStr)),
        ),
      )
      .orderBy(sql`${laws.lastChecked} ASC NULLS FIRST`);

    // Excluir URLs doc.php: documentos puntuales sin texto consolidado ni
    // "Última actualización" → el extractor siempre falla. Solo act.php sirve.
    return rows
      .filter(
        (l) => l.boeUrl !== null && l.boeUrl.length > 0 && !l.boeUrl.includes('/doc.php'),
      )
      .map((l) => ({
        id: l.id,
        shortName: l.shortName,
        name: l.name,
        boeUrl: l.boeUrl as string,
        lastUpdateBoe: l.lastUpdateBoe ?? null,
        dateByteOffset: l.dateByteOffset ?? null,
        boeContentLength: l.boeContentLength ?? null,
      }));
  }

  /** Actualiza una ley tras verificarla. */
  private async updateLawAfterCheck(lawId: string, data: LawUpdateData): Promise<boolean> {
    try {
      await this.db
        .update(laws)
        .set({
          lastChecked: data.lastChecked,
          ...(data.lastUpdateBoe && { lastUpdateBoe: data.lastUpdateBoe }),
          ...(data.dateByteOffset && { dateByteOffset: data.dateByteOffset }),
          ...(data.boeContentLength && { boeContentLength: data.boeContentLength }),
          ...(data.changeStatus && { changeStatus: data.changeStatus }),
          ...(data.changeDetectedAt && { changeDetectedAt: data.changeDetectedAt }),
        })
        .where(eq(laws.id, lawId));
      return true;
    } catch (error) {
      this.logger.error(
        `Error actualizando ley ${lawId}: ${error instanceof Error ? error.message : String(error)}`,
      );
      return false;
    }
  }

  /** Verifica una ley en 3 fases (HEAD → parcial → completa). */
  private async processLaw(
    law: LawForCheck,
    now: Date,
    stats: CheckStats,
    changes: DetectedChange[],
  ): Promise<boolean> {
    let currentContentLength: number | null = null;

    // FASE 0 — HEAD con tolerancia de tamaño
    if (law.boeContentLength && law.lastUpdateBoe) {
      const headResult = await checkWithContentLength(law.boeUrl, law.boeContentLength);
      currentContentLength = headResult.contentLength ?? null;

      if (headResult.success && headResult.unchanged) {
        stats.headUnchanged++;
        await this.updateLawAfterCheck(law.id, { lastChecked: now.toISOString() });
        return true;
      }
      if (headResult.reason === 'size_changed' && headResult.sizeChange) {
        stats.sizeChangeDetected++;
        this.logger.log(
          `${law.shortName}: cambio de tamaño (${headResult.sizeChange} bytes), verificando fecha...`,
        );
      }
    } else if (!law.boeContentLength) {
      const headResult = await checkWithContentLength(law.boeUrl, null);
      currentContentLength = headResult.contentLength ?? null;
    }

    // FASE 1 — descarga parcial
    const partial = await checkWithPartialDownload(law.boeUrl, law.dateByteOffset);
    if (partial.success && partial.lastUpdateBOE) {
      if (partial.method === 'cached_offset') stats.cachedOffset++;
      else stats.partial++;
      stats.totalBytes += partial.bytesDownloaded ?? 0;

      // Solo marcar 'changed' si la fecha extraída es POSTERIOR a la guardada.
      // Las fechas anteriores suelen ser falsos positivos del extractor (matched
      // fecha del cuerpo: vigencia derogada, modificación antigua, etc.).
      // Incidente 2026-05-27 08:00 UTC: 9 leyes Canarias marcadas changed
      // simultáneamente por blip BOE → todas eran fechas anteriores reales.
      const currDate = parseDDMMYYYY(partial.lastUpdateBOE);
      const bdDate = parseDDMMYYYY(law.lastUpdateBoe);
      const dateChanged = !!currDate && !!bdDate && currDate.getTime() > bdDate.getTime();
      const dateRetroceded =
        !!currDate && !!bdDate && currDate.getTime() < bdDate.getTime();

      if (dateRetroceded) {
        this.logger.warn(
          `Fecha BOE ANTERIOR a BD (posible falso positivo): ${law.shortName} | BOE=${partial.lastUpdateBOE} | BD=${law.lastUpdateBoe} — NO se actualiza baseline`,
        );
      }

      if (dateChanged) {
        stats.changesDetected++;
        changes.push({
          law: law.shortName,
          name: law.name,
          oldDate: law.lastUpdateBoe,
          newDate: partial.lastUpdateBOE,
        });
        this.logger.warn(
          `CAMBIO DETECTADO: ${law.shortName} (${law.lastUpdateBoe} → ${partial.lastUpdateBOE})`,
        );
      }

      // Preservar baseline: solo actualizar lastUpdateBoe si avanza o es primera vez.
      // Si la fecha extraída es anterior (falso positivo del extractor), NO la persistimos.
      const shouldUpdateLastUpdateBoe = !dateRetroceded;

      await this.updateLawAfterCheck(law.id, {
        lastChecked: now.toISOString(),
        ...(shouldUpdateLastUpdateBoe ? { lastUpdateBoe: partial.lastUpdateBOE } : {}),
        ...(partial.dateOffset && partial.dateOffset > 0
          ? { dateByteOffset: partial.dateOffset }
          : {}),
        ...(currentContentLength && currentContentLength > 0
          ? { boeContentLength: currentContentLength }
          : {}),
        ...(dateChanged
          ? { changeStatus: 'changed' as const, changeDetectedAt: now.toISOString() }
          : {}),
      });
      return true;
    }

    // FASE 2 — descarga completa
    const full = await checkWithFullDownload(law.boeUrl);
    stats.totalBytes += full.bytesDownloaded ?? 0;
    if (full.success && full.lastUpdateBOE) {
      stats.fullDownload++;

      const currDate = parseDDMMYYYY(full.lastUpdateBOE);
      const bdDate = parseDDMMYYYY(law.lastUpdateBoe);
      const dateChanged = !!currDate && !!bdDate && currDate.getTime() > bdDate.getTime();
      const dateRetroceded =
        !!currDate && !!bdDate && currDate.getTime() < bdDate.getTime();

      if (dateRetroceded) {
        this.logger.warn(
          `Fecha BOE ANTERIOR a BD (posible falso positivo): ${law.shortName} | BOE=${full.lastUpdateBOE} | BD=${law.lastUpdateBoe} — NO se actualiza baseline`,
        );
      }

      if (dateChanged) {
        stats.changesDetected++;
        changes.push({
          law: law.shortName,
          name: law.name,
          oldDate: law.lastUpdateBoe,
          newDate: full.lastUpdateBOE,
        });
        this.logger.warn(
          `CAMBIO DETECTADO: ${law.shortName} (${law.lastUpdateBoe} → ${full.lastUpdateBOE})`,
        );
      }

      const shouldUpdateLastUpdateBoe = !dateRetroceded;

      await this.updateLawAfterCheck(law.id, {
        lastChecked: now.toISOString(),
        ...(shouldUpdateLastUpdateBoe ? { lastUpdateBoe: full.lastUpdateBOE } : {}),
        ...(full.dateOffset && full.dateOffset > 0
          ? { dateByteOffset: full.dateOffset }
          : {}),
        ...(currentContentLength && currentContentLength > 0
          ? { boeContentLength: currentContentLength }
          : {}),
        ...(dateChanged
          ? { changeStatus: 'changed' as const, changeDetectedAt: now.toISOString() }
          : {}),
      });
      return true;
    }

    // FASE 2 falló — FIX causa raíz: avanzar `last_checked` igualmente, para
    // que la ley NO se quede clavada al frente de la cola (orderBy ASC) y
    // monopolice los siguientes runs. Rota al final como cualquier otra.
    this.logger.warn(
      `No se pudo verificar ${law.shortName}: ${full.reason} — last_checked avanzado para no atascar la cola`,
    );
    await this.updateLawAfterCheck(law.id, { lastChecked: now.toISOString() });
    return false;
  }

  /** Avisa al admin de los cambios detectados (gated por BOE_NOTIFY_ENABLED). */
  private async sendNotification(
    changes: DetectedChange[],
    stats: CheckStats,
    duration: string,
  ): Promise<void> {
    const enabled = this.config.get<boolean>('BOE_NOTIFY_ENABLED') ?? false;
    if (!enabled) {
      this.logger.log(
        `Notificación desactivada (BOE_NOTIFY_ENABLED=false) — ${changes.length} cambios solo logueados`,
      );
      return;
    }

    const baseUrl = this.config.get<string>('APP_BASE_URL') ?? 'https://www.vence.es';
    const adminEmail =
      this.config.get<string>('ADMIN_EMAIL') ?? 'manueltrader@gmail.com';

    try {
      const response = await fetch(`${baseUrl}/api/emails/send-admin-notification`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'boe_change',
          adminEmail,
          data: {
            changesCount: changes.length,
            changes,
            stats: {
              checked: stats.checked,
              duration,
              totalBytesFormatted: formatBytes(stats.totalBytes),
              sizeChangeDetected: stats.sizeChangeDetected,
            },
            timestamp: new Date().toISOString(),
            adminUrl: `${baseUrl}/admin/monitoreo`,
          },
        }),
      });
      const result = (await response.json()) as { success?: boolean };
      this.logger.log(`Email de cambios BOE enviado: ${result.success ? 'OK' : 'fallo'}`);
    } catch (error) {
      this.logger.error(
        `Error enviando email de cambios BOE: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }
}
