// backend/src/answer-save/answer-save.types.ts
//
// Tipos del contrato de POST /api/v2/answer-and-save. Port de los Zod
// schemas del frontend (lib/api/v2/answer-and-save/schemas.ts) — la
// validación con Zod se hace en el Controller, no aquí.

export const VALID_CONFIDENCE = ['very_sure', 'sure', 'unsure', 'guessing', 'unknown'] as const;
export type ConfidenceLevel = (typeof VALID_CONFIDENCE)[number];

export interface AnswerSaveArticle {
  id?: string | null;
  number?: string | null;
  law_id?: string | null;
  law_short_name?: string | null;
}

export interface AnswerSaveMetadata {
  id?: string | null;
  difficulty?: string | null;
  question_type?: string | null;
  tags?: string[] | null;
}

export interface AnswerSaveDeviceInfo {
  userAgent?: string;
  screenResolution?: string;
  deviceType?: 'mobile' | 'tablet' | 'desktop' | 'unknown';
  browserLanguage?: string;
  timezone?: string;
}

export interface AnswerSaveRequest {
  questionId: string;
  /** 0..3 (A..D) o null si isBlank=true. */
  userAnswer: number | null;
  isBlank?: boolean;

  sessionId: string;
  questionIndex: number;

  questionText: string;
  options: string[];
  tema?: number;
  questionType?: 'legislative' | 'psychometric';
  article?: AnswerSaveArticle | null;
  metadata?: AnswerSaveMetadata | null;
  explanation?: string | null;

  timeSpent?: number;
  confidenceLevel?: ConfidenceLevel;
  interactionCount?: number;
  questionStartTime?: number;
  firstInteractionTime?: number;

  interactionEvents?: unknown[];
  mouseEvents?: unknown[];
  scrollEvents?: unknown[];

  deviceInfo?: AnswerSaveDeviceInfo;

  oposicionId?: string | null;
  currentScore?: number;
}

export type AnswerSaveAction = 'saved_new' | 'already_saved' | 'save_failed';

export interface AnswerSaveResponse {
  success: boolean;
  isCorrect: boolean;
  correctAnswer: number;
  explanation?: string | null;
  articleNumber?: string | null;
  lawShortName?: string | null;
  lawName?: string | null;
  newScore: number;
  saveAction: AnswerSaveAction;
  questionDbId?: string | null;
}

/** Mapeo oposicionId → position_type (snake_case en BD).
 *  El frontend convierte cualquier guion por underscore antes de pasarlo.
 *  Aquí replicamos la normalización mínima. */
export function normalizePositionType(oposicionId: string | null | undefined): string {
  if (!oposicionId) return 'auxiliar_administrativo_estado';
  return oposicionId.replace(/-/g, '_');
}
