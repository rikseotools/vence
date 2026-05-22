import { Inject, Injectable, Logger } from '@nestjs/common';
import { and, eq, gte, inArray, lt, sql } from 'drizzle-orm';
import { DRIZZLE, type DrizzleDB } from '../db/database.module';
import {
  avatarProfiles,
  notificationEvents,
  testQuestions,
  tests,
  userAvatarSettings,
  userNotificationSettings,
  userProfiles,
  userStreaks,
} from './avatar-rotation.schema';
import { determineProfile, type AvatarProfile, type BulkUserMetrics, type StudyMetrics } from './avatar-settings';

// ── Tipos internos ────────────────────────────────────────────────────────────

interface RotationStats {
  totalUsers: number;
  rotated: number;
  unchanged: number;
  errors: number;
}

interface RotatedUser {
  userId: string;
  previousProfile: string | null;
  newProfile: string;
  emoji: string;
}

interface WeekMetricsRow {
  userId: string | null;
  totalQuestions: number;
  correctQuestions: number;
  hardQuestions: number;
  hardCorrect: number;
  nightSessions: number;
  morningSessions: number;
  afternoonSessions: number;
  daysStudied: number;
}

interface LastWeekMetricsRow {
  userId: string | null;
  totalQuestions: number;
  correctQuestions: number;
}

// ── Servicio ──────────────────────────────────────────────────────────────────

/**
 * Servicio de rotación semanal de avatares automáticos.
 *
 * Portado de `app/api/cron/avatar-rotation/route.ts` (Next.js) +
 * `lib/api/avatar-settings/` del repo principal.
 *
 * Proceso:
 *  1. Obtiene usuarios activos con avatar en modo automático (RPC o fallback).
 *  2. Calcula el nuevo perfil en bulk con dos aggregate scans sobre
 *     test_questions JOIN tests.
 *  3. Actualiza `user_avatar_settings` en batches de 50.
 *  4. Registra un evento de notificación en `notification_events` por cada
 *     usuario cuyo avatar cambió (el envío push real se delega al servicio de
 *     notificaciones externo).
 */
@Injectable()
export class AvatarRotationService {
  private readonly logger = new Logger(AvatarRotationService.name);

  /** Tamaño del lote de updates a BD. */
  private readonly updateBatchSize = 50;

  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDB) {}

  // ── Punto de entrada público ──────────────────────────────────────────────

  async run(): Promise<RotationStats> {
    const startTime = Date.now();
    this.logger.log('Iniciando rotación semanal de avatares');

    // 1. Usuarios activos en modo automático
    const userIds = await this.getUsersWithAutomaticAvatar();

    if (userIds.length === 0) {
      this.logger.log('No hay usuarios en modo automático');
      return { totalUsers: 0, rotated: 0, unchanged: 0, errors: 0 };
    }

    this.logger.log(`Procesando ${userIds.length} usuarios`);

    // 2. Configuración actual de todos los usuarios
    const currentSettingsRows = await this.db
      .select({
        userId: userAvatarSettings.userId,
        currentProfile: userAvatarSettings.currentProfile,
        currentEmoji: userAvatarSettings.currentEmoji,
      })
      .from(userAvatarSettings)
      .where(inArray(userAvatarSettings.userId, userIds));

    const currentSettingsMap = new Map(
      currentSettingsRows
        .filter((r): r is typeof r & { userId: string } => r.userId !== null)
        .map((r) => [r.userId, r]),
    );

    // 3. Género de todos los usuarios (para nombre femenino/masculino)
    const genderRows = await this.db
      .select({ id: userProfiles.id, gender: userProfiles.gender })
      .from(userProfiles)
      .where(inArray(userProfiles.id, userIds));

    const genderMap = new Map<string, boolean>(
      genderRows.map((u) => [u.id, u.gender === 'female' || u.gender === 'mujer']),
    );

    // 4. Calcular perfiles en bulk
    const bulkResults = await this.calculateBulkUserProfiles(userIds);

    // 5. Catálogo de perfiles
    const allProfileRows = await this.db
      .select()
      .from(avatarProfiles)
      .orderBy(sql`${avatarProfiles.priority} DESC`);

    const profilesMap = new Map<string, AvatarProfile>(
      allProfileRows.map((p) => [
        p.id,
        {
          id: p.id,
          emoji: p.emoji,
          nameEs: p.nameEs,
          nameEsF: p.nameEsF,
          descriptionEs: p.descriptionEs,
          color: p.color,
          priority: p.priority ?? 50,
        },
      ]),
    );

    // 6. Preparar updates
    const stats: RotationStats = {
      totalUsers: userIds.length,
      rotated: 0,
      unchanged: 0,
      errors: 0,
    };

    const updates: Array<{
      userId: string;
      profileId: string;
      emoji: string;
      name: string;
      previousProfile: string | null;
      previousEmoji: string | null;
    }> = [];

    for (const result of bulkResults) {
      const current = currentSettingsMap.get(result.userId);
      const previousProfile = current?.currentProfile ?? null;
      const profile = profilesMap.get(result.profileId);

      if (!profile) {
        stats.errors++;
        continue;
      }

      if (previousProfile === result.profileId) {
        stats.unchanged++;
        continue;
      }

      const isFemale = genderMap.get(result.userId) ?? false;
      const profileName = isFemale && profile.nameEsF ? profile.nameEsF : profile.nameEs;

      updates.push({
        userId: result.userId,
        profileId: result.profileId,
        emoji: profile.emoji,
        name: profileName,
        previousProfile,
        previousEmoji: current?.currentEmoji ?? null,
      });
    }

    // 7. Aplicar updates en batches
    const rotatedUsers: RotatedUser[] = [];
    const now = new Date().toISOString();

    for (let i = 0; i < updates.length; i += this.updateBatchSize) {
      const batch = updates.slice(i, i + this.updateBatchSize);

      await Promise.all(
        batch.map(async (update) => {
          try {
            await this.db
              .update(userAvatarSettings)
              .set({
                currentProfile: update.profileId,
                currentEmoji: update.emoji,
                currentName: update.name,
                lastRotationAt: now,
                updatedAt: now,
                rotationNotificationPending: true,
                previousProfile: update.previousProfile,
                previousEmoji: update.previousEmoji,
              })
              .where(eq(userAvatarSettings.userId, update.userId));

            stats.rotated++;
            rotatedUsers.push({
              userId: update.userId,
              previousProfile: update.previousProfile,
              newProfile: update.profileId,
              emoji: update.emoji,
            });
          } catch (err) {
            this.logger.error(
              `Error actualizando usuario ${update.userId}: ${err instanceof Error ? err.message : String(err)}`,
            );
            stats.errors++;
          }
        }),
      );

      this.logger.log(
        `Updates aplicados: ${Math.min(i + this.updateBatchSize, updates.length)}/${updates.length}`,
      );
    }

    // 8. Registrar eventos de notificación
    if (rotatedUsers.length > 0) {
      await this.recordNotificationEvents(rotatedUsers, profilesMap, genderMap);
    }

    const duration = ((Date.now() - startTime) / 1000).toFixed(1);
    this.logger.log(
      `Completado en ${duration}s — rotados: ${stats.rotated}, sin cambio: ${stats.unchanged}, errores: ${stats.errors}`,
    );

    return stats;
  }

  // ── Obtener usuarios activos en modo automático ───────────────────────────

  private async getUsersWithAutomaticAvatar(daysBack = 7): Promise<string[]> {
    // Intentar con la función RPC optimizada
    try {
      const result = await this.db.execute<{ user_id: string }>(
        sql`SELECT user_id FROM get_active_users_with_automatic_avatar(${daysBack})`,
      );
      const rows = result as unknown as Array<{ user_id: string }>;
      if (rows.length >= 0) {
        this.logger.log(`Usuarios activos en modo automático (RPC): ${rows.length}`);
        return rows.map((r) => r.user_id);
      }
    } catch (rpcErr) {
      this.logger.warn(
        `RPC get_active_users_with_automatic_avatar no disponible, usando fallback: ${rpcErr instanceof Error ? rpcErr.message : String(rpcErr)}`,
      );
    }

    // Fallback: todos los usuarios en modo automático
    const rows = await this.db
      .select({ userId: userAvatarSettings.userId })
      .from(userAvatarSettings)
      .where(eq(userAvatarSettings.mode, 'automatic'));

    const ids = rows
      .filter((r): r is typeof r & { userId: string } => r.userId !== null)
      .map((r) => r.userId);

    this.logger.warn(`Fallback: ${ids.length} usuarios en modo automático`);
    return ids;
  }

  // ── Cálculo bulk de métricas ──────────────────────────────────────────────

  /**
   * Calcula el perfil de múltiples usuarios con dos aggregate scans en vez de
   * N queries individuales. Portado de `calculateBulkUserProfiles` en
   * `lib/api/avatar-settings/profiles.ts`.
   */
  private async calculateBulkUserProfiles(userIds: string[]): Promise<BulkUserMetrics[]> {
    if (userIds.length === 0) return [];

    const now = new Date();
    const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const twoWeeksAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);

    this.logger.log(`Calculando métricas bulk para ${userIds.length} usuarios`);

    try {
      // Streaks de todos los usuarios de una vez
      const streaksData = await this.db
        .select({
          userId: userStreaks.userId,
          currentStreak: userStreaks.currentStreak,
        })
        .from(userStreaks)
        .where(inArray(userStreaks.userId, userIds));

      const streaksMap = new Map(streaksData.map((s) => [s.userId, s.currentStreak ?? 0]));

      // Aggregate scan — métricas de esta semana
      const thisWeekMetrics = (await this.db
        .select({
          userId: tests.userId,
          totalQuestions: sql<number>`count(*)::int`,
          correctQuestions: sql<number>`sum(case when ${testQuestions.isCorrect} then 1 else 0 end)::int`,
          hardQuestions: sql<number>`sum(case when ${testQuestions.difficulty} in ('hard', 'extreme') then 1 else 0 end)::int`,
          hardCorrect: sql<number>`sum(case when ${testQuestions.difficulty} in ('hard', 'extreme') and ${testQuestions.isCorrect} then 1 else 0 end)::int`,
          nightSessions: sql<number>`sum(case when extract(hour from ${testQuestions.createdAt}::timestamp) >= 21 or extract(hour from ${testQuestions.createdAt}::timestamp) < 6 or extract(hour from ${testQuestions.createdAt}::timestamp) >= 18 then 1 else 0 end)::int`,
          morningSessions: sql<number>`sum(case when extract(hour from ${testQuestions.createdAt}::timestamp) >= 6 and extract(hour from ${testQuestions.createdAt}::timestamp) < 12 then 1 else 0 end)::int`,
          afternoonSessions: sql<number>`sum(case when extract(hour from ${testQuestions.createdAt}::timestamp) >= 12 and extract(hour from ${testQuestions.createdAt}::timestamp) < 18 then 1 else 0 end)::int`,
          daysStudied: sql<number>`count(distinct date(${testQuestions.createdAt}))::int`,
        })
        .from(testQuestions)
        .innerJoin(tests, eq(testQuestions.testId, tests.id))
        .where(
          and(
            inArray(tests.userId, userIds),
            gte(testQuestions.createdAt, oneWeekAgo.toISOString()),
          ),
        )
        .groupBy(tests.userId)) as WeekMetricsRow[];

      // Aggregate scan — métricas de semana anterior
      const lastWeekMetrics = (await this.db
        .select({
          userId: tests.userId,
          totalQuestions: sql<number>`count(*)::int`,
          correctQuestions: sql<number>`sum(case when ${testQuestions.isCorrect} then 1 else 0 end)::int`,
        })
        .from(testQuestions)
        .innerJoin(tests, eq(testQuestions.testId, tests.id))
        .where(
          and(
            inArray(tests.userId, userIds),
            gte(testQuestions.createdAt, twoWeeksAgo.toISOString()),
            lt(testQuestions.createdAt, oneWeekAgo.toISOString()),
          ),
        )
        .groupBy(tests.userId)) as LastWeekMetricsRow[];

      const thisWeekMap = new Map(thisWeekMetrics.map((m) => [m.userId, m]));
      const lastWeekMap = new Map(lastWeekMetrics.map((m) => [m.userId, m]));

      const results: BulkUserMetrics[] = [];

      for (const userId of userIds) {
        const thisWeek = thisWeekMap.get(userId);
        const lastWeek = lastWeekMap.get(userId);
        const streak = streaksMap.get(userId) ?? 0;

        const totalAnswers = thisWeek?.totalQuestions ?? 0;
        const totalCorrect = thisWeek?.correctQuestions ?? 0;
        const hardTotal = thisWeek?.hardQuestions ?? 0;
        const hardCorrectCount = thisWeek?.hardCorrect ?? 0;
        const nightSessions = thisWeek?.nightSessions ?? 0;
        const morningSessions = thisWeek?.morningSessions ?? 0;
        const afternoonSessions = thisWeek?.afternoonSessions ?? 0;

        const thisWeekAccuracy = totalAnswers > 0 ? (totalCorrect / totalAnswers) * 100 : 0;
        const lastWeekTotal = lastWeek?.totalQuestions ?? 0;
        const lastWeekAccuracy =
          lastWeekTotal > 0 ? ((lastWeek?.correctQuestions ?? 0) / lastWeekTotal) * 100 : 0;

        const metrics: StudyMetrics = {
          nightHoursPercentage: totalAnswers > 0 ? (nightSessions / totalAnswers) * 100 : 0,
          morningHoursPercentage: totalAnswers > 0 ? (morningSessions / totalAnswers) * 100 : 0,
          weeklyAccuracy: thisWeekAccuracy,
          accuracyImprovement: lastWeekAccuracy > 0 ? thisWeekAccuracy - lastWeekAccuracy : 0,
          hardTopicsAccuracy: hardTotal > 0 ? (hardCorrectCount / hardTotal) * 100 : 0,
          weeklyQuestionsCount: totalAnswers,
          daysStudiedThisWeek: thisWeek?.daysStudied ?? 0,
          currentStreak: streak,
          studiedMorning: morningSessions > 0,
          studiedAfternoon: afternoonSessions > 0,
          studiedNight: nightSessions > 0,
        };

        const { profileId, matchedConditions } = determineProfile(metrics);
        results.push({ userId, metrics, profileId, matchedConditions });
      }

      this.logger.log(`Métricas bulk calculadas: ${results.length} usuarios`);
      return results;
    } catch (err) {
      this.logger.error(
        `Error en calculateBulkUserProfiles: ${err instanceof Error ? err.message : String(err)}`,
      );
      // Fallback: procesar usuario a usuario en paralelo (batches de 20)
      return this.calculateBulkUserProfilesFallback(userIds);
    }
  }

  private async calculateBulkUserProfilesFallback(userIds: string[]): Promise<BulkUserMetrics[]> {
    this.logger.warn(`Usando fallback paralelo para ${userIds.length} usuarios`);
    const BATCH_SIZE = 20;
    const results: BulkUserMetrics[] = [];

    for (let i = 0; i < userIds.length; i += BATCH_SIZE) {
      const batch = userIds.slice(i, i + BATCH_SIZE);
      const batchResults = await Promise.all(
        batch.map(async (userId) => {
          try {
            const metrics = await this.getStudyMetrics(userId);
            const { profileId, matchedConditions } = determineProfile(metrics);
            return { userId, metrics, profileId, matchedConditions };
          } catch {
            const defaultMetrics: StudyMetrics = {
              nightHoursPercentage: 0,
              morningHoursPercentage: 0,
              weeklyAccuracy: 0,
              accuracyImprovement: 0,
              hardTopicsAccuracy: 0,
              weeklyQuestionsCount: 0,
              daysStudiedThisWeek: 0,
              currentStreak: 0,
              studiedMorning: false,
              studiedAfternoon: false,
              studiedNight: false,
            };
            return {
              userId,
              metrics: defaultMetrics,
              profileId: 'relaxed_koala',
              matchedConditions: ['Error calculando métricas'],
            };
          }
        }),
      );
      results.push(...batchResults);
      this.logger.log(
        `Procesados ${Math.min(i + BATCH_SIZE, userIds.length)}/${userIds.length}`,
      );
    }

    return results;
  }

  /** Métricas individuales — solo se usa en el fallback. */
  private async getStudyMetrics(userId: string): Promise<StudyMetrics> {
    const now = new Date();
    const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const twoWeeksAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);

    const defaultMetrics: StudyMetrics = {
      nightHoursPercentage: 0,
      morningHoursPercentage: 0,
      weeklyAccuracy: 0,
      accuracyImprovement: 0,
      hardTopicsAccuracy: 0,
      weeklyQuestionsCount: 0,
      daysStudiedThisWeek: 0,
      currentStreak: 0,
      studiedMorning: false,
      studiedAfternoon: false,
      studiedNight: false,
    };

    let currentStreak = 0;
    try {
      const streakResult = await this.db
        .select({ currentStreak: userStreaks.currentStreak })
        .from(userStreaks)
        .where(eq(userStreaks.userId, userId))
        .limit(1);
      currentStreak = streakResult[0]?.currentStreak ?? 0;
    } catch {
      // streak no crítico
    }

    try {
      const thisWeekAnswers = await this.db
        .select({
          isCorrect: testQuestions.isCorrect,
          difficulty: testQuestions.difficulty,
          createdAt: testQuestions.createdAt,
        })
        .from(testQuestions)
        .innerJoin(tests, eq(testQuestions.testId, tests.id))
        .where(
          and(
            eq(tests.userId, userId),
            gte(testQuestions.createdAt, oneWeekAgo.toISOString()),
          ),
        );

      if (thisWeekAnswers.length === 0) {
        return { ...defaultMetrics, currentStreak };
      }

      let nightSessions = 0;
      let morningSessions = 0;
      let afternoonSessions = 0;
      const daysWithActivity = new Set<string>();
      let totalCorrect = 0;
      let hardCorrect = 0;
      let hardTotal = 0;

      for (const answer of thisWeekAnswers) {
        const answerDate = new Date(answer.createdAt!);
        const hour = answerDate.getHours();
        daysWithActivity.add(answerDate.toISOString().split('T')[0]);

        if (hour >= 21 || hour < 6 || hour >= 18) nightSessions++;
        else if (hour >= 6 && hour < 12) morningSessions++;
        else if (hour >= 12 && hour < 18) afternoonSessions++;

        if (answer.isCorrect) totalCorrect++;
        if (answer.difficulty === 'hard' || answer.difficulty === 'extreme') {
          hardTotal++;
          if (answer.isCorrect) hardCorrect++;
        }
      }

      const totalAnswers = thisWeekAnswers.length;

      const lastWeekAnswers = await this.db
        .select({ isCorrect: testQuestions.isCorrect })
        .from(testQuestions)
        .innerJoin(tests, eq(testQuestions.testId, tests.id))
        .where(
          and(
            eq(tests.userId, userId),
            gte(testQuestions.createdAt, twoWeeksAgo.toISOString()),
            lt(testQuestions.createdAt, oneWeekAgo.toISOString()),
          ),
        );

      const lastWeekAccuracy =
        lastWeekAnswers.length > 0
          ? (lastWeekAnswers.filter((a) => a.isCorrect).length / lastWeekAnswers.length) * 100
          : 0;

      const thisWeekAccuracy = totalAnswers > 0 ? (totalCorrect / totalAnswers) * 100 : 0;

      return {
        nightHoursPercentage: totalAnswers > 0 ? (nightSessions / totalAnswers) * 100 : 0,
        morningHoursPercentage: totalAnswers > 0 ? (morningSessions / totalAnswers) * 100 : 0,
        weeklyAccuracy: thisWeekAccuracy,
        accuracyImprovement: lastWeekAccuracy > 0 ? thisWeekAccuracy - lastWeekAccuracy : 0,
        hardTopicsAccuracy: hardTotal > 0 ? (hardCorrect / hardTotal) * 100 : 0,
        weeklyQuestionsCount: totalAnswers,
        daysStudiedThisWeek: daysWithActivity.size,
        currentStreak,
        studiedMorning: morningSessions > 0,
        studiedAfternoon: afternoonSessions > 0,
        studiedNight: nightSessions > 0,
      };
    } catch (err) {
      this.logger.error(
        `Error calculando métricas para ${userId}: ${err instanceof Error ? err.message : String(err)}`,
      );
      return { ...defaultMetrics, currentStreak };
    }
  }

  // ── Notificaciones ────────────────────────────────────────────────────────

  /**
   * Registra un evento de notificación en `notification_events` por cada
   * usuario rotado que tenga push habilitado.
   *
   * El envío push real (web-push) se delega al servicio de notificaciones
   * externo — aquí solo se persiste el evento y se loguea la intención, igual
   * que hacía el cron original de Next.js.
   */
  private async recordNotificationEvents(
    rotatedUsers: RotatedUser[],
    profilesMap: Map<string, AvatarProfile>,
    genderMap: Map<string, boolean>,
  ): Promise<void> {
    for (const user of rotatedUsers) {
      try {
        const notifRows = await this.db
          .select({
            pushEnabled: userNotificationSettings.pushEnabled,
            pushSubscription: userNotificationSettings.pushSubscription,
          })
          .from(userNotificationSettings)
          .where(eq(userNotificationSettings.userId, user.userId))
          .limit(1);

        const notifSettings = notifRows[0];
        if (!notifSettings?.pushEnabled || !notifSettings?.pushSubscription) {
          continue;
        }

        const profile = profilesMap.get(user.newProfile);
        if (!profile) continue;

        const isFemale = genderMap.get(user.userId) ?? false;
        const profileName = isFemale && profile.nameEsF ? profile.nameEsF : profile.nameEs;

        const notificationPayload = {
          title: `${user.emoji} ¡Nuevo avatar esta semana!`,
          body: `Eres ${profileName}. ${profile.descriptionEs}`,
          icon: '/icons/icon-192x192.png',
          badge: '/icons/badge-72x72.png',
          tag: 'avatar-rotation',
          data: {
            type: 'avatar_rotation',
            url: '/perfil',
            newProfile: user.newProfile,
          },
        };

        await this.db.insert(notificationEvents).values({
          userId: user.userId,
          eventType: 'notification_sent',
          notificationType: 'achievement',
          notificationData: notificationPayload,
        });

        this.logger.log(
          `Notificación preparada para ${user.userId}: ${user.emoji} ${profileName}`,
        );
      } catch (notifErr) {
        this.logger.warn(
          `Error enviando notificación a ${user.userId}: ${notifErr instanceof Error ? notifErr.message : String(notifErr)}`,
        );
      }
    }
  }
}
