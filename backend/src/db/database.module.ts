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

/** Token de inyección del cliente Drizzle. */
export const DRIZZLE = Symbol('DRIZZLE');

/** Token interno del cliente postgres crudo (para cerrarlo al apagar). */
const POSTGRES_CLIENT = Symbol('POSTGRES_CLIENT');

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
  ],
  exports: [DRIZZLE],
})
export class DatabaseModule implements OnApplicationShutdown {
  constructor(@Inject(POSTGRES_CLIENT) private readonly client: PgClient) {}

  /** Cierra el pool limpiamente al recibir SIGTERM (reciclado de task en Fargate). */
  async onApplicationShutdown(): Promise<void> {
    await this.client.end({ timeout: 5 });
    Logger.log('Pool de Postgres cerrado', 'DatabaseModule');
  }
}
