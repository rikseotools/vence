/**
 * Definiciones de medallas de ranking.
 *
 * Copia 1:1 de `lib/api/medals/schemas.ts` del repo principal (RANKING_MEDALS).
 * Mantener sincronizado: si se añade una medalla nueva en la app, añadirla
 * aquí también para que el GET las normalice correctamente.
 */
export interface MedalDefinition {
  id: string;
  title: string;
  description: string;
  category: string;
  emailTemplate: string;
}

export const RANKING_MEDALS: Record<string, MedalDefinition> = {
  FIRST_PLACE_TODAY: {
    id: 'first_place_today',
    title: 'Lider del Dia',
    description: 'Primer lugar en el ranking diario',
    category: 'Ranking Diario',
    emailTemplate: 'daily_champion',
  },
  FIRST_PLACE_WEEK: {
    id: 'first_place_week',
    title: 'Lider Semanal',
    description: 'Primer lugar en el ranking semanal',
    category: 'Ranking Semanal',
    emailTemplate: 'weekly_champion',
  },
  FIRST_PLACE_MONTH: {
    id: 'first_place_month',
    title: 'Lider Mensual',
    description: 'Primer lugar en el ranking mensual',
    category: 'Ranking Mensual',
    emailTemplate: 'monthly_champion',
  },
  TOP_3_TODAY: {
    id: 'top_3_today',
    title: 'Podio Diario',
    description: 'Top 3 en el ranking del dia',
    category: 'Ranking Diario',
    emailTemplate: 'daily_podium',
  },
  TOP_3_WEEK: {
    id: 'top_3_week',
    title: 'Podio Semanal',
    description: 'Top 3 en el ranking semanal',
    category: 'Ranking Semanal',
    emailTemplate: 'weekly_podium',
  },
  TOP_3_MONTH: {
    id: 'top_3_month',
    title: 'Podio Mensual',
    description: 'Top 3 en el ranking mensual',
    category: 'Ranking Mensual',
    emailTemplate: 'monthly_podium',
  },
  HIGH_ACCURACY: {
    id: 'high_accuracy',
    title: 'Precision Extrema',
    description: 'Mas del 90% de aciertos en el ranking semanal',
    category: 'Rendimiento',
    emailTemplate: 'high_accuracy',
  },
  VOLUME_LEADER: {
    id: 'volume_leader',
    title: 'Maquina de Preguntas',
    description: 'Mas de 100 preguntas en una semana',
    category: 'Volumen',
    emailTemplate: 'volume_leader',
  },
};

export interface UserMedal {
  id: string;
  title: string;
  description: string;
  category: string;
  emailTemplate: string;
  unlocked: boolean;
  progress: string;
  unlockedAt: string;
  rank: number;
  period: string;
  stats: {
    userId: string;
    totalQuestions: number;
    correctAnswers: number;
    accuracy: number;
  } | null;
}

export interface GetMedalsResponse {
  success: boolean;
  medals?: UserMedal[];
  error?: string;
}

export interface CachedMedals {
  data: GetMedalsResponse;
  ts: number;
}
