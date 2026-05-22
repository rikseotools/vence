/**
 * Helpers portados de `lib/api/avatar-settings/` del repo principal.
 *
 * Solo se porta la lógica que el cron necesita:
 *  - Tipos de dominio (AvatarProfile, StudyMetrics, BulkUserMetrics)
 *  - determineProfile() — pura, sin BD
 *
 * La lógica de BD (queries Drizzle) vive en AvatarRotationService para poder
 * inyectar el token DRIZZLE a través del contenedor NestJS.
 */

// ── Tipos de dominio ─────────────────────────────────────────────────────────

export interface AvatarProfile {
  id: string;
  emoji: string;
  nameEs: string;
  nameEsF: string | null | undefined;
  descriptionEs: string;
  color: string;
  priority: number;
}

export interface StudyMetrics {
  nightHoursPercentage: number;
  morningHoursPercentage: number;
  weeklyAccuracy: number;
  accuracyImprovement: number;
  hardTopicsAccuracy: number;
  weeklyQuestionsCount: number;
  daysStudiedThisWeek: number;
  currentStreak: number;
  studiedMorning: boolean;
  studiedAfternoon: boolean;
  studiedNight: boolean;
}

export interface BulkUserMetrics {
  userId: string;
  metrics: StudyMetrics;
  profileId: string;
  matchedConditions: string[];
}

// ── Lógica de determinación de perfil (pura) ─────────────────────────────────

interface ProfileMatch {
  profileId: string;
  priority: number;
  condition: string;
}

/**
 * Devuelve el profileId con mayor prioridad dado las métricas de la semana.
 * Lógica portada literalmente de `lib/api/avatar-settings/profiles.ts`.
 */
export function determineProfile(metrics: StudyMetrics): {
  profileId: string;
  matchedConditions: string[];
} {
  const matches: ProfileMatch[] = [];

  // Unicornio Legendario — accuracy >90% Y >150 preguntas/semana
  if (metrics.weeklyAccuracy > 90 && metrics.weeklyQuestionsCount > 150) {
    matches.push({
      profileId: 'unicorn',
      priority: 95,
      condition: `Élite: ${metrics.weeklyAccuracy.toFixed(1)}% accuracy con ${metrics.weeklyQuestionsCount} preguntas`,
    });
  }

  // León Campeón — accuracy >85% Y >150 preguntas/semana
  if (metrics.weeklyAccuracy > 85 && metrics.weeklyQuestionsCount > 150) {
    matches.push({
      profileId: 'champion',
      priority: 90,
      condition: `Accuracy ${metrics.weeklyAccuracy.toFixed(1)}% > 85% con ${metrics.weeklyQuestionsCount} preguntas`,
    });
  }

  // Tortuga Constante — streak >14 días
  if (metrics.currentStreak > 14) {
    matches.push({
      profileId: 'consistent',
      priority: 85,
      condition: `Streak ${metrics.currentStreak} > 14 días`,
    });
  }

  // Hormiga Trabajadora — estudia todos los días
  if (metrics.daysStudiedThisWeek === 7) {
    matches.push({
      profileId: 'worker_ant',
      priority: 80,
      condition: 'Estudió los 7 días de la semana',
    });
  }

  // Delfín Inteligente — mejora >10%
  if (metrics.accuracyImprovement > 10 && metrics.weeklyQuestionsCount >= 20) {
    matches.push({
      profileId: 'smart_dolphin',
      priority: 75,
      condition: `Mejoró ${metrics.accuracyImprovement.toFixed(1)}% > 10%`,
    });
  }

  // Águila Veloz — >100 preguntas/semana
  if (metrics.weeklyQuestionsCount > 100) {
    matches.push({
      profileId: 'speed_eagle',
      priority: 70,
      condition: `${metrics.weeklyQuestionsCount} preguntas > 100/semana`,
    });
  }

  // Ardilla Astuta — >70% en temas difíciles
  if (metrics.hardTopicsAccuracy > 70 && metrics.weeklyQuestionsCount >= 10) {
    matches.push({
      profileId: 'clever_squirrel',
      priority: 65,
      condition: `${metrics.hardTopicsAccuracy.toFixed(1)}% en temas difíciles > 70%`,
    });
  }

  // Búho Nocturno — >50% estudio nocturno
  if (metrics.nightHoursPercentage > 50) {
    matches.push({
      profileId: 'night_owl',
      priority: 60,
      condition: `${metrics.nightHoursPercentage.toFixed(1)}% estudio nocturno > 50%`,
    });
  }

  // Gallo Madrugador — >50% estudio matutino
  if (metrics.morningHoursPercentage > 50) {
    matches.push({
      profileId: 'early_bird',
      priority: 60,
      condition: `${metrics.morningHoursPercentage.toFixed(1)}% estudio matutino > 50%`,
    });
  }

  // Abeja Productiva — estudia mañana, tarde y noche
  if (metrics.studiedMorning && metrics.studiedAfternoon && metrics.studiedNight) {
    matches.push({
      profileId: 'busy_bee',
      priority: 55,
      condition: 'Estudió mañana, tarde y noche',
    });
  }

  // Koala Relajado — <20 preguntas/semana (solo si hay algo de actividad)
  if (metrics.weeklyQuestionsCount > 0 && metrics.weeklyQuestionsCount < 20) {
    matches.push({
      profileId: 'relaxed_koala',
      priority: 10,
      condition: `${metrics.weeklyQuestionsCount} preguntas < 20/semana`,
    });
  }

  matches.sort((a, b) => b.priority - a.priority);

  if (matches.length > 0) {
    return {
      profileId: matches[0].profileId,
      matchedConditions: matches.map((m) => `${m.profileId}: ${m.condition}`),
    };
  }

  return {
    profileId: 'relaxed_koala',
    matchedConditions: ['Sin actividad significativa esta semana'],
  };
}
