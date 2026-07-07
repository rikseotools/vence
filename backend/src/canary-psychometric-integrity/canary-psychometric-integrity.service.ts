import { Inject, Injectable, Logger } from '@nestjs/common';
import { sql } from 'drizzle-orm';
import { DRIZZLE, type DrizzleDB } from '../db/database.module';

/**
 * Canary de INTEGRIDAD de datos — sesiones psicotécnicas "fantasma".
 *
 * Una sesión fantasma = `psychometric_test_sessions` con `is_completed=true` y
 * `questions_answered>0` pero SIN ninguna fila en `psychometric_test_answers`.
 * Aparecía en "Tests recientes" con una nota (ej. 9/10) pero al pinchar "revisar"
 * abría una página en blanco → "a medias vuelve locos al usuario" (incidente
 * 07/07/2026: colisión de clave Redis → 403 a premium → las respuestas no se
 * guardaban aunque la sesión sí registraba la nota).
 *
 * El fix de raíz (clave Redis propia) + el guard de forma en getOrSet ya lo evitan,
 * y el filtro EXISTS en recentTests impide mostrarlas. Este canary es la RED de
 * seguridad: si CUALQUIER fallo futuro de guardado vuelve a crear fantasmas, las
 * detecta en la ventana y alerta — en vez de esperar a que un usuario se queje.
 *
 * Cero side-effects: solo cuenta (SELECT). No token, no writes.
 */
@Injectable()
export class CanaryPsychometricIntegrityService {
  private readonly logger = new Logger(CanaryPsychometricIntegrityService.name);
  private readonly WINDOW_MIN = 90; // ventana de detección (cubre 6 ticks de 15min)

  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDB) {}

  async run(): Promise<CanaryPsychometricIntegrityResult> {
    const startedAt = Date.now();
    try {
      const rows = (await this.db.execute(sql`
        SELECT COUNT(*)::int AS phantom
        FROM psychometric_test_sessions s
        WHERE s.is_completed = true
          AND s.questions_answered > 0
          AND s.created_at > now() - interval '90 minutes'
          AND NOT EXISTS (
            SELECT 1 FROM psychometric_test_answers a WHERE a.test_session_id = s.id
          )
      `)) as unknown as Array<{ phantom: number }>;
      const phantom = rows[0]?.phantom ?? 0;
      const base = { phantom, windowMin: this.WINDOW_MIN, durationMs: Date.now() - startedAt };
      return phantom === 0 ? { ok: true, ...base } : { ok: false, ...base };
    } catch (err) {
      return {
        ok: false,
        error: err instanceof Error ? err.message : String(err),
        durationMs: Date.now() - startedAt,
      };
    }
  }
}

export type CanaryPsychometricIntegrityResult =
  | { ok: true; phantom: number; windowMin: number; durationMs: number }
  | { ok: false; phantom: number; windowMin: number; durationMs: number }
  | { ok: false; error: string; durationMs: number };
