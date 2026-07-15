import {
  Global,
  Inject,
  Logger,
  Module,
  type OnApplicationShutdown,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { drizzle, type PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';

/** Token de inyección del cliente Drizzle (PRIMARIO — escrituras + monitorización). */
export const DRIZZLE = Symbol('DRIZZLE');

/**
 * Token del cliente Drizzle de LECTURA (réplica si `USE_READ_REPLICA=true` +
 * `DATABASE_URL_REPLICA`, si no cae al primario — rollback-safe, mismo patrón que
 * `getReadDb()` del frontend). Inyectar SOLO en crons/servicios ANALÍTICOS read-only
 * que toleran staleness sub-segundo (agregaciones sobre observable_events/tests para
 * métricas/alertas). NUNCA para escrituras (la réplica es read-only) ni para canarios
 * que monitorizan el PRIMARIO (pg_stat_activity/replicación → verían la instancia
 * equivocada). Fix contención RDS Capa 3 (15/07).
 */
export const DRIZZLE_READ = Symbol('DRIZZLE_READ');

/** Tokens internos de los clientes postgres crudos (para cerrarlos al apagar). */
const POSTGRES_CLIENT = Symbol('POSTGRES_CLIENT');
const POSTGRES_READ_CLIENT = Symbol('POSTGRES_READ_CLIENT');

type PgClient = ReturnType<typeof postgres>;

/** Tipo del cliente Drizzle tipado con el schema. Inyectar con `@Inject(DRIZZLE)`. */
export type DrizzleDB = PostgresJsDatabase<typeof schema>;

/**
 * Módulo de base de datos. Provee un cliente Drizzle (`DRIZZLE`) sobre un
 * pool de conexiones postgres-js compartido por todo el proceso.
 *
 * A diferencia del serverless (pool max:1 por lambda), aquí hay UN pool real
 * compartido — el modelo para el que Postgres está diseñado.
 *
 * Agnóstico: `DATABASE_URL` es config; sirve cualquier Postgres.
 */
@Global()
@Module({
  providers: [
    {
      provide: POSTGRES_CLIENT,
      inject: [ConfigService],
      useFactory: (config: ConfigService): PgClient => {
        const url = config.getOrThrow<string>('DATABASE_URL');
        return postgres(url, {
          // Subido 10→25 tras incidente 30/05/2026 ~10:25 UTC:
          // 6 crons @Cron('*/5 * * * *') tickearon simultáneamente
          // (refresh-rankings 3.4s + alerts-engine 3.2s + 4 canaries) y
          // saturaron el pool de 10. Pool 25 + jitter 0-30s en cada cron
          // (jitter.helper.ts) elimina la colisión y deja margen para
          // crons daily pesados (detect-oep-llm ~2.5min).
          max: 25,
          prepare: false, // compat con pooler en transaction mode
          idle_timeout: 20,
          connect_timeout: 10,
          // ROOT CAUSE FIX (incidente worker outbox cuelgue 29/05 21:54 UTC):
          // sin statement_timeout, una query que cuelga (network glitch, pooler
          // restart, lock contention raro) bloquea el await indefinidamente.
          // Postgres mata la query en 30s, postgres-js libera el slot, y el
          // catch del worker se dispara → siguiente tick reintenta.
          // Aplicado a TODAS las connections del pool (default per-session).
          // NOTA: NO bajarlo a 5s — detect-oep-llm tarda 2.5min legítimamente.
          connection: {
            statement_timeout: 30000, // 30s — query individual
            idle_in_transaction_session_timeout: 60000, // 60s — txn ociosa
          },
        });
      },
    },
    {
      provide: DRIZZLE,
      inject: [POSTGRES_CLIENT],
      useFactory: (client: PgClient): DrizzleDB =>
        drizzle(client, { schema }),
    },
    // Cliente de LECTURA (réplica). Rollback-safe: si USE_READ_REPLICA != 'true' o falta
    // DATABASE_URL_REPLICA → reutiliza el MISMO cliente primario (cero cambio de comportamiento).
    {
      provide: POSTGRES_READ_CLIENT,
      inject: [ConfigService, POSTGRES_CLIENT],
      useFactory: (config: ConfigService, primary: PgClient): PgClient => {
        const useReplica = config.get<string>('USE_READ_REPLICA') === 'true';
        const replicaUrl = config.get<string>('DATABASE_URL_REPLICA');
        if (!useReplica || !replicaUrl) {
          Logger.log(
            `DRIZZLE_READ → PRIMARIO (useReplica=${useReplica}, replicaUrl=${replicaUrl ? 'set' : 'unset'})`,
            'DatabaseModule',
          );
          return primary; // fallback: mismo pool primario, no abre conexiones extra
        }
        Logger.log('DRIZZLE_READ → RÉPLICA de lectura', 'DatabaseModule');
        return postgres(replicaUrl, {
          max: 10, // menor que el primario (max:25): solo crons analíticos
          prepare: false,
          idle_timeout: 20,
          connect_timeout: 10,
          connection: {
            // 20s: los crons analíticos toleran cancelación; la réplica tiene
            // hot_standby_feedback=on (param group vence-postgres17-replica) que evita
            // el "conflict with recovery" en la práctica.
            statement_timeout: 20000,
            idle_in_transaction_session_timeout: 60000,
          },
        });
      },
    },
    {
      provide: DRIZZLE_READ,
      inject: [POSTGRES_READ_CLIENT],
      useFactory: (client: PgClient): DrizzleDB =>
        drizzle(client, { schema }),
    },
  ],
  exports: [DRIZZLE, DRIZZLE_READ],
})
export class DatabaseModule implements OnApplicationShutdown {
  constructor(
    @Inject(POSTGRES_CLIENT) private readonly client: PgClient,
    @Inject(POSTGRES_READ_CLIENT) private readonly readClient: PgClient,
  ) {}

  /** Cierra los pools limpiamente al recibir SIGTERM (reciclado de task en Fargate). */
  async onApplicationShutdown(): Promise<void> {
    await this.client.end({ timeout: 5 });
    // Solo cerrar el de lectura si es un cliente DISTINTO (en fallback es el mismo → ya cerrado).
    if (this.readClient !== this.client) {
      await this.readClient.end({ timeout: 5 });
    }
    Logger.log('Pools de Postgres cerrados', 'DatabaseModule');
  }
}
