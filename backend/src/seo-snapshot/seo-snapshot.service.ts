import { Inject, Injectable, Logger } from '@nestjs/common';
import { DRIZZLE, type DrizzleDB } from '../db/database.module';
import { querySearchAnalytics } from './gsc-client';
import {
  getActiveTargetKeywords,
  upsertSnapshots,
  type SnapshotRow,
} from './seo-snapshot.queries';

export interface SeoSnapshotResult {
  capturedOn: string;
  window: string;
  total: number;
  ranking: number; // con impresiones en GSC
  notRanking: number; // sin impresiones (position null)
}

/**
 * Snapshot semanal de posición orgánica (GSC) de cada keyword objetivo activa.
 * Construye el histórico (seo_keyword_snapshots) para medir progreso SEO.
 */
@Injectable()
export class SeoSnapshotService {
  private readonly logger = new Logger(SeoSnapshotService.name);

  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDB) {}

  /** Ventana estándar de orgánico: 28 días terminando hace 3 (GSC tiene ~3d de lag). */
  private window(): { startDate: string; endDate: string; capturedOn: string } {
    const end = new Date(Date.now() - 3 * 86_400_000);
    const start = new Date(end.getTime() - 28 * 86_400_000);
    const iso = (d: Date) => d.toISOString().slice(0, 10);
    return { startDate: iso(start), endDate: iso(end), capturedOn: iso(end) };
  }

  async run(): Promise<SeoSnapshotResult> {
    const keywords = await getActiveTargetKeywords(this.db);
    const { startDate, endDate, capturedOn } = this.window();

    if (keywords.length === 0) {
      this.logger.warn('Sin keywords objetivo activas — nada que snapshotear');
      return { capturedOn, window: `${startDate}…${endDate}`, total: 0, ranking: 0, notRanking: 0 };
    }

    // Una sola query a GSC: todas las queries con impresiones en la ventana.
    const gscRows = await querySearchAnalytics({
      startDate,
      endDate,
      dimensions: ['query'],
      rowLimit: 25_000,
    });
    const byQuery = new Map(gscRows.map((r) => [r.keys[0].toLowerCase(), r]));

    const rows: SnapshotRow[] = keywords.map((keyword) => {
      const r = byQuery.get(keyword.toLowerCase());
      return {
        keyword,
        capturedOn,
        position: r ? String(r.position) : null,
        impressions: r ? Math.round(r.impressions) : 0,
        clicks: r ? Math.round(r.clicks) : 0,
        ctr: r ? String(r.ctr) : null,
      };
    });

    await upsertSnapshots(this.db, rows);

    const ranking = rows.filter((r) => r.position !== null).length;
    this.logger.log(
      `Snapshot ${capturedOn}: ${rows.length} keywords (${ranking} rankeando, ${rows.length - ranking} sin impresiones)`,
    );
    return {
      capturedOn,
      window: `${startDate}…${endDate}`,
      total: rows.length,
      ranking,
      notRanking: rows.length - ranking,
    };
  }
}
