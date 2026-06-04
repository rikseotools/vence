import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { sql } from 'drizzle-orm';
import { Client as PgClient } from 'pg';
import { DRIZZLE, type DrizzleDB } from '../db/database.module';
import {
  PoolerDiscoveryService,
  type PoolerInstance,
} from './pooler-discovery.service';

/** Métricas de UNA instancia del pooler en UN tick. */
export interface InstanceSample {
  instance: string;
  az: string | null;
  targetHealth: string | null;
  reachable: boolean;
  connectMs: number | null;
  select1Ms: number | null;
  clActive: number | null;
  clWaiting: number | null;
  svActive: number | null;
  svIdle: number | null;
  maxwaitUs: number | null;
  queryCount: number | null;
  avgQueryTimeUs: number | null;
  avgWaitTimeUs: number | null;
  serverCount: number | null;
  error: string | null;
}

export interface PoolerSampleRunResult {
  discovered: number;
  reachable: number;
  unreachable: number;
  samples: InstanceSample[];
}

/** Reescribe el host:port y la dbname de un DSN base para apuntar a una instancia. */
export function buildInstanceUrl(
  baseDsn: string,
  ip: string,
  dbname: 'postgres' | 'pgbouncer',
): string {
  const u = new URL(baseDsn);
  u.hostname = ip;
  u.port = '6543';
  u.pathname = `/${dbname}`;
  return u.toString();
}

/** Parsea la fila del pool postgres/postgres de SHOW POOLS. */
export function parsePoolRow(
  rows: Array<Record<string, unknown>>,
): Pick<
  InstanceSample,
  'clActive' | 'clWaiting' | 'svActive' | 'svIdle' | 'maxwaitUs'
> {
  const r =
    rows.find((x) => x.database === 'postgres' && x.user === 'postgres') ??
    rows.find((x) => x.database === 'postgres') ??
    {};
  return {
    clActive: numOrNull(r.cl_active),
    clWaiting: numOrNull(r.cl_waiting),
    svActive: numOrNull(r.sv_active),
    svIdle: numOrNull(r.sv_idle),
    maxwaitUs: numOrNull(r.maxwait_us),
  };
}

/** Parsea la fila de la base postgres de SHOW STATS_TOTALS → medias derivadas. */
export function parseStatsRow(
  rows: Array<Record<string, unknown>>,
): Pick<InstanceSample, 'queryCount' | 'avgQueryTimeUs' | 'avgWaitTimeUs'> {
  const r = rows.find((x) => x.database === 'postgres') ?? {};
  const queryCount = numOrNull(r.query_count);
  const queryTime = numOrNull(r.query_time);
  const waitTime = numOrNull(r.wait_time);
  const avg = (total: number | null) =>
    queryCount && queryCount > 0 && total != null
      ? Math.round(total / queryCount)
      : null;
  return {
    queryCount,
    avgQueryTimeUs: avg(queryTime),
    avgWaitTimeUs: avg(waitTime),
  };
}

function numOrNull(v: unknown): number | null {
  if (v == null) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

/**
 * Servicio del cron `pooler-instance-sampler`.
 *
 * Cada tick (1 min): descubre las instancias del pooler (target group del NLB)
 * y, POR CADA UNA, conecta por su IP PRIVADA y mide:
 *   - reachability + latencia de un SELECT 1 real (dbname=postgres) — la señal
 *     que el health-check TCP del NLB NO mide;
 *   - stats internas de PgBouncer (SHOW POOLS/STATS_TOTALS/SERVERS, dbname=pgbouncer).
 * Inserta una fila por instancia en `pgbouncer_instance_samples` (idempotente).
 *
 * Robustez: cada instancia se scrapea de forma aislada — un fallo en una no
 * impide muestrear la otra (se registra reachable=false + error). El admin de
 * PgBouncer requiere simple query protocol → cliente `pg` (no postgres-js),
 * igual que app/api/admin/infra-stats.
 */
@Injectable()
export class PoolerInstanceSamplerService {
  private readonly logger = new Logger(PoolerInstanceSamplerService.name);
  private static readonly RETENTION_DAYS = 14;
  private static readonly PROBE_TIMEOUT_MS = 2_000;

  constructor(
    @Inject(DRIZZLE) private readonly db: DrizzleDB,
    private readonly config: ConfigService,
    private readonly discovery: PoolerDiscoveryService,
  ) {}

  async run(): Promise<PoolerSampleRunResult> {
    if (!this.discovery.isEnabled()) {
      this.logger.debug('POOLER_TARGET_GROUP_ARN no configurado — skip.');
      return { discovered: 0, reachable: 0, unreachable: 0, samples: [] };
    }
    const baseDsn = this.config.get<string>('DATABASE_URL_SELF_POOLER') ?? '';
    if (!baseDsn) {
      this.logger.warn('DATABASE_URL_SELF_POOLER vacío — no se puede scrapear.');
      return { discovered: 0, reachable: 0, unreachable: 0, samples: [] };
    }

    const instances = await this.discovery.discover();
    // Aislamiento: una instancia colgada no bloquea a la otra.
    const samples = await Promise.all(
      instances.map((inst) => this.scrapeInstance(inst, baseDsn)),
    );

    await this.persist(samples);
    await this.prune();

    const reachable = samples.filter((s) => s.reachable).length;
    const result: PoolerSampleRunResult = {
      discovered: instances.length,
      reachable,
      unreachable: samples.length - reachable,
      samples,
    };

    for (const s of samples) {
      if (!s.reachable) {
        this.logger.warn(
          `Instancia ${s.instance} (${s.az}) NO alcanzable: ${s.error}`,
        );
      } else if (s.select1Ms != null && s.select1Ms > 1000) {
        this.logger.warn(
          `Instancia ${s.instance} lenta: SELECT1=${s.select1Ms}ms cl_waiting=${s.clWaiting} maxwait_us=${s.maxwaitUs}`,
        );
      }
    }

    return result;
  }

  private async scrapeInstance(
    inst: PoolerInstance,
    baseDsn: string,
  ): Promise<InstanceSample> {
    const base: InstanceSample = {
      instance: inst.ip,
      az: inst.az,
      targetHealth: inst.targetHealth,
      reachable: false,
      connectMs: null,
      select1Ms: null,
      clActive: null,
      clWaiting: null,
      svActive: null,
      svIdle: null,
      maxwaitUs: null,
      queryCount: null,
      avgQueryTimeUs: null,
      avgWaitTimeUs: null,
      serverCount: null,
      error: null,
    };

    // 1) Probe de servicio real: SELECT 1 a través del pool de ESA instancia.
    try {
      const t0 = Date.now();
      const real = new PgClient({
        connectionString: buildInstanceUrl(baseDsn, inst.ip, 'postgres'),
        ssl: { rejectUnauthorized: false },
        connectionTimeoutMillis: PoolerInstanceSamplerService.PROBE_TIMEOUT_MS,
        statement_timeout: PoolerInstanceSamplerService.PROBE_TIMEOUT_MS,
      });
      await real.connect();
      const connected = Date.now();
      await real.query('SELECT 1');
      base.select1Ms = Date.now() - connected;
      base.connectMs = connected - t0;
      base.reachable = true;
      await real.end();
    } catch (err) {
      base.error = err instanceof Error ? err.message.slice(0, 200) : String(err);
      return base; // sin servicio real, no tiene sentido el admin
    }

    // 2) Stats internas de PgBouncer (admin console, simple protocol).
    try {
      const admin = new PgClient({
        connectionString: buildInstanceUrl(baseDsn, inst.ip, 'pgbouncer'),
        ssl: { rejectUnauthorized: false },
        connectionTimeoutMillis: PoolerInstanceSamplerService.PROBE_TIMEOUT_MS,
        statement_timeout: PoolerInstanceSamplerService.PROBE_TIMEOUT_MS,
      });
      await admin.connect();
      const pools = (await admin.query('SHOW POOLS')).rows as Array<
        Record<string, unknown>
      >;
      const stats = (await admin.query('SHOW STATS_TOTALS')).rows as Array<
        Record<string, unknown>
      >;
      const servers = (await admin.query('SHOW SERVERS')).rows as unknown[];
      await admin.end();

      Object.assign(base, parsePoolRow(pools), parseStatsRow(stats), {
        serverCount: servers.length,
      });
    } catch (err) {
      // El SELECT 1 sí funcionó; admin opcional. Registramos el error sin
      // marcar unreachable (la instancia SÍ sirve queries).
      const adminErr =
        err instanceof Error ? err.message.slice(0, 120) : String(err);
      base.error = `admin_stats: ${adminErr}`;
    }

    return base;
  }

  private async persist(samples: InstanceSample[]): Promise<void> {
    // Insert por fila con sample_at = date_trunc('minute', now()) → PK idempotente.
    for (const s of samples) {
      await this.db.execute(sql`
        INSERT INTO public.pgbouncer_instance_samples (
          sample_at, instance, az, target_health, reachable, connect_ms,
          select1_ms, cl_active, cl_waiting, sv_active, sv_idle, maxwait_us,
          query_count, avg_query_time_us, avg_wait_time_us, server_count, error
        ) VALUES (
          date_trunc('minute', NOW()), ${s.instance}, ${s.az}, ${s.targetHealth},
          ${s.reachable}, ${s.connectMs}, ${s.select1Ms}, ${s.clActive},
          ${s.clWaiting}, ${s.svActive}, ${s.svIdle}, ${s.maxwaitUs},
          ${s.queryCount}, ${s.avgQueryTimeUs}, ${s.avgWaitTimeUs},
          ${s.serverCount}, ${s.error}
        )
        ON CONFLICT (sample_at, instance) DO NOTHING
      `);
    }
  }

  private async prune(): Promise<void> {
    await this.db.execute(
      sql`SELECT public.prune_pgbouncer_instance_samples(${PoolerInstanceSamplerService.RETENTION_DAYS}::integer)`,
    );
  }
}
