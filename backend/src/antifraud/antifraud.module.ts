import { Global, Module } from '@nestjs/common';
import { AntifraudService } from './antifraud.service';

/**
 * Módulo Global de anti-fraud: device registration + límite por dispositivo.
 *
 * Port de `lib/api/deviceLimit.ts` del frontend Vercel. Las funciones SQL
 * Postgres (`register_device`, `get_accounts_on_device`) ya existen — se
 * invocan vía Drizzle `db.execute(sql\`SELECT * FROM register_device(...)\`)`
 * en lugar de `supabase.rpc()`, manteniendo cero lock-in al SDK.
 *
 * Ver docs/architecture/bloque3-answer-save-plan.md §2.2.
 */
@Global()
@Module({
  providers: [AntifraudService],
  exports: [AntifraudService],
})
export class AntifraudModule {}
