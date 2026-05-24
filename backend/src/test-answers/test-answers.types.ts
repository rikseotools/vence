// backend/src/test-answers/test-answers.types.ts
//
// Tipos del contrato de inserción de respuestas. Port de los Zod schemas
// del frontend (lib/api/test-answers/schemas.ts) — la validación con Zod
// se hace en el Controller del endpoint, no aquí. Estos tipos los usan
// los métodos puros de TestAnswersService.

export const VALID_DIFFICULTIES = ['easy', 'medium', 'hard', 'extreme'] as const;
export type ValidDifficulty = (typeof VALID_DIFFICULTIES)[number];

export interface DeviceInfo {
  userAgent?: string;
  screenResolution?: string;
  deviceType?: 'mobile' | 'tablet' | 'desktop' | 'unknown';
  browserLanguage?: string;
  timezone?: string;
}

export interface ArticleData {
  id?: string | null;
  number?: string | null;
  law_id?: string | null;
  law_short_name?: string | null;
}

export interface QuestionMetadata {
  id?: string | null;
  difficulty?: ValidDifficulty | null;
  question_type?: string | null;
  tags?: string[] | null;
}

export interface QuestionData {
  id?: string | null;
  question: string;
  options: string[];
  tema?: number | null;
  questionType?: 'legislative' | 'psychometric';
  article?: ArticleData | null;
  metadata?: QuestionMetadata | null;
  explanation?: string | null;
}

export interface AnswerData {
  questionIndex: number;
  /** -1 = sin respuesta (con wasBlank=true → blank legítimo). */
  selectedAnswer: number;
  correctAnswer: number;
  isCorrect: boolean;
  timeSpent?: number;
  /** Flag para "dejar en blanco" explícito (feature Tinokero 15/4/2026). */
  wasBlank?: boolean;
}

export interface SaveAnswerRequest {
  sessionId: string;
  questionData: QuestionData;
  answerData: AnswerData;
  tema?: number;
  confidenceLevel?: 'very_sure' | 'sure' | 'unsure' | 'guessing' | 'unknown';
  interactionCount?: number;
  questionStartTime?: number;
  firstInteractionTime?: number;
  interactionEvents?: unknown[];
  mouseEvents?: unknown[];
  scrollEvents?: unknown[];
  deviceInfo?: DeviceInfo;
  oposicionId?: string | null;
}

export type SaveAnswerAction = 'saved_new' | 'already_saved' | 'save_failed' | 'error';

export interface SaveAnswerResponse {
  success: boolean;
  question_id?: string | null;
  action: SaveAnswerAction;
  error?: string;
}

/**
 * Mapea valores legacy de difficulty (numéricos, 'auto') al enum válido.
 * Usar SOLO para migración / lectura de datos legacy, NO en requests nuevos.
 * Port literal de lib/api/shared/difficulty.ts.
 */
export function normalizeDifficulty(
  raw: string | null | undefined,
): ValidDifficulty {
  if (!raw) return 'medium';
  if ((VALID_DIFFICULTIES as readonly string[]).includes(raw)) {
    return raw as ValidDifficulty;
  }
  const numericMap: Record<string, ValidDifficulty> = {
    '1': 'easy',
    '2': 'medium',
    '3': 'hard',
    '4': 'extreme',
    '5': 'extreme',
  };
  return numericMap[raw] ?? 'medium';
}
