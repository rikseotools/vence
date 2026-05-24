import { Global, Module } from '@nestjs/common';
import { MedalEmailService } from './medal-email.service';

/**
 * Módulo Global de emails transaccionales.
 *
 * Usa Resend SDK directo (proveedor estándar, agnóstico). Las plantillas
 * HTML viven en cada Service específico. La lectura de email del usuario
 * es vía Drizzle a tablas Postgres estándar (user_profiles.email con
 * fallback a auth.users.email) — cero dependencia a Supabase Auth SDK.
 *
 * Ver docs/architecture/bloque3-backend-url-pattern.md §1 (prioridad
 * agnóstico de proveedor).
 */
@Global()
@Module({
  providers: [MedalEmailService],
  exports: [MedalEmailService],
})
export class EmailModule {}
