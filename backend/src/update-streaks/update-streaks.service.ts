import { Inject, Injectable, Logger } from '@nestjs/common';
import { and, gt, gte, inArray, sql } from 'drizzle-orm';
import { DRIZZLE, type DrizzleDB } from '../db/database.module';
import { userStreaks, userTestSessions } from './update-streaks.schema';

const BATCH_SIZE = 50;
const RESET_BATCH_SIZE = 100;
/** Días hacia atrás que cubre la ventana de actividad reciente (racha máx 60 + 2 gracia). */
const ACTIVITY_WINDOW_DAYS = 62;

export interface UpdateStreaksResult {
  activeUsers: number;
  updated: number;
  errors: number;
  resetCount: number;
}

/**
 * Calcula la racha de días consecutivos con 1 día de gracia.
 *
 * Réplica de `utils/streakCalculator.js` portada a TypeScript estricto.
 * Verifica los últimos 60 días; un hueco de 1 día se perdona, dos consecutivos
 * rompen la racha.
 */
function calculateStreak(sessions: Array<{ completed_at: string | null; created_at: string | null }>): number {
  if (!sessions || sessions.length === 0) return 0;

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Construir set de timestamps de días con actividad
  const activeDaySet = new Set<number>();
  for (const session of sessions) {
    const raw = session.completed_at ?? session.created_at;
    if (!raw) continue;
    const d = new Date(raw);
    d.setHours(0, 0, 0, 0);
    activeDaySet.add(d.getTime());
  }

  // Array de booleanos: activeDays[i] = ¿hubo actividad hace i días?
  const activeDays: boolean[] = [];
  for (let i = 0; i < 60; i++) {
    const checkDate = new Date(today);
    checkDate.setDate(today.getDate() - i);
    checkDate.setHours(0, 0, 0, 0);
    activeDays.push(activeDaySet.has(checkDate.getTime()));
  }

  // Encontrar el primer día (más reciente) con actividad
  let startIndex = -1;
  for (let i = 0; i < activeDays.length; i++) {
    if (activeDays[i]) {
      startIndex = i;
      break;
    }
  }
  if (startIndex === -1) return 0;

  // Contar racha con 1 día de gracia
  let consecutiveMisses = 0;
  let daysInStreak = 0;

  for (let i = startIndex; i < activeDays.length; i++) {
    if (activeDays[i]) {
      daysInStreak++;
      consecutiveMisses = 0;
    } else {
      consecutiveMisses++;
      daysInStreak++;
      if (consecutiveMisses >= 2) {
        daysInStreak--;
        break;
      }
    }
  }

  return daysInStreak;
}

@Injectable()
export class UpdateStreaksService {
  private readonly logger = new Logger(UpdateStreaksService.name);

  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDB) {}

  /**
   * Recalcula las rachas de todos los usuarios con actividad reciente y
   * resetea a 0 las rachas de quienes no han tenido actividad en los
   * últimos {@link ACTIVITY_WINDOW_DAYS} días.
   */
  async run(): Promise<UpdateStreaksResult> {
    this.logger.log('Actualizando rachas por batches...');

    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - ACTIVITY_WINDOW_DAYS);
    const cutoffIso = cutoffDate.toISOString();

    // 1. Obtener usuarios distintos con actividad reciente
    const activeUserRows = await this.db
      .select({ userId: userTestSessions.userId })
      .from(userTestSessions)
      .where(gte(userTestSessions.completedAt, cutoffIso))
      .orderBy(userTestSessions.userId);

    const uniqueUserIds = [...new Set(activeUserRows.map((r) => r.userId))];
    this.logger.log(`${uniqueUserIds.length} usuarios con actividad reciente`);

    let updated = 0;
    let errors = 0;

    // 2. Procesar en batches de BATCH_SIZE
    for (let i = 0; i < uniqueUserIds.length; i += BATCH_SIZE) {
      const batch = uniqueUserIds.slice(i, i + BATCH_SIZE);

      // Obtener sesiones del batch dentro de la ventana de actividad
      let sessions: Array<{
        userId: string;
        completedAt: string | null;
        createdAt: string | null;
      }>;

      try {
        sessions = await this.db
          .select({
            userId: userTestSessions.userId,
            completedAt: userTestSessions.completedAt,
            createdAt: userTestSessions.createdAt,
          })
          .from(userTestSessions)
          .where(
            and(
              inArray(userTestSessions.userId, batch),
              gte(userTestSessions.completedAt, cutoffIso),
            ),
          )
          .orderBy(sql`${userTestSessions.completedAt} DESC`);
      } catch (err) {
        this.logger.error(
          `Error obteniendo sesiones del batch ${Math.floor(i / BATCH_SIZE) + 1}: ` +
            `${err instanceof Error ? err.message : String(err)}`,
        );
        errors++;
        continue;
      }

      // Agrupar sesiones por usuario
      const sessionsByUser = new Map<
        string,
        Array<{ completed_at: string | null; created_at: string | null }>
      >();
      for (const s of sessions) {
        const entry = sessionsByUser.get(s.userId) ?? [];
        entry.push({ completed_at: s.completedAt, created_at: s.createdAt });
        sessionsByUser.set(s.userId, entry);
      }

      // Calcular racha y hacer upsert por usuario
      for (const userId of batch) {
        const userSessions = sessionsByUser.get(userId) ?? [];
        const currentStreak = calculateStreak(userSessions);
        const lastRaw = userSessions[0]?.completed_at ?? userSessions[0]?.created_at ?? null;
        // Extraer solo la parte de fecha (YYYY-MM-DD) para `last_activity_date`
        const lastActivityDate = lastRaw ? lastRaw.split('T')[0] : null;
        const now = new Date().toISOString();

        try {
          await this.db
            .insert(userStreaks)
            .values({
              userId,
              currentStreak,
              lastActivityDate,
              streakUpdatedAt: now,
            })
            .onConflictDoUpdate({
              target: userStreaks.userId,
              set: {
                currentStreak,
                lastActivityDate,
                streakUpdatedAt: now,
              },
            });
          updated++;
        } catch (err) {
          this.logger.warn(
            `Error streak user ${userId}: ${err instanceof Error ? err.message : String(err)}`,
          );
          errors++;
        }
      }
    }

    // 3. Resetear rachas de usuarios sin actividad reciente con racha > 0
    const activeUserSet = new Set(uniqueUserIds);
    let resetCount = 0;

    try {
      const streakRows = await this.db
        .select({ userId: userStreaks.userId })
        .from(userStreaks)
        .where(gt(userStreaks.currentStreak, 0));

      const usersToReset = streakRows
        .map((r) => r.userId)
        .filter((uid) => !activeUserSet.has(uid));

      if (usersToReset.length > 0) {
        const resetNow = new Date().toISOString();

        for (let i = 0; i < usersToReset.length; i += RESET_BATCH_SIZE) {
          const resetBatch = usersToReset.slice(i, i + RESET_BATCH_SIZE);
          await this.db
            .update(userStreaks)
            .set({ currentStreak: 0, streakUpdatedAt: resetNow })
            .where(inArray(userStreaks.userId, resetBatch));
          resetCount += resetBatch.length;
        }

        this.logger.log(`${resetCount} rachas inactivas reseteadas a 0`);
      }
    } catch (err) {
      this.logger.warn(
        `Error reseteando rachas inactivas: ${err instanceof Error ? err.message : String(err)}`,
      );
    }

    this.logger.log(
      `Rachas actualizadas: ${updated} OK, ${errors} errores, ${resetCount} resets`,
    );

    return { activeUsers: uniqueUserIds.length, updated, errors, resetCount };
  }
}
