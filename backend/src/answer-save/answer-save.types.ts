// backend/src/answer-save/answer-save.types.ts
//
// Tipos del contrato de POST /api/v2/answer-and-save + schema Zod para
// validación del body en el Controller. Port literal de los schemas del
// frontend (lib/api/v2/answer-and-save/schemas.ts).

import { z } from 'zod';

export const VALID_CONFIDENCE = ['very_sure', 'sure', 'unsure', 'guessing', 'unknown'] as const;
export type ConfidenceLevel = (typeof VALID_CONFIDENCE)[number];

export const VALID_DIFFICULTIES_REQ = ['easy', 'medium', 'hard', 'extreme'] as const;

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

// ════════════════════════════════════════════════════════════════
// Schema Zod del body (validación en el Controller)
// Port literal de lib/api/v2/answer-and-save/schemas.ts del frontend.
// ════════════════════════════════════════════════════════════════

export const answerSaveRequestSchema = z
  .object({
    questionId: z.string().uuid('ID de pregunta inválido'),
    // userAnswer: 0=A..4=E. Puede ser null si isBlank=true (feature "Dejar en
    // blanco" 15/4/2026). Schema acepta -1 también por retrocompat (algunos
    // clientes legacy lo mandan así).
    userAnswer: z.number().int().min(-1).max(4).nullable(),
    isBlank: z.boolean().optional().default(false),

    sessionId: z.string().uuid('ID de sesión inválido'),
    questionIndex: z.number().int().min(0),

    questionText: z.string().min(1),
    options: z.array(z.string()).min(2).max(6),
    tema: z.number().int().min(0).default(0),
    questionType: z.enum(['legislative', 'psychometric']).default('legislative'),

    article: z
      .object({
        id: z.string().uuid().optional().nullable(),
        number: z.string().optional().nullable(),
        law_id: z.string().uuid().optional().nullable(),
        law_short_name: z.string().optional().nullable(),
      })
      .optional()
      .nullable(),

    metadata: z
      .object({
        id: z.string().optional().nullable(),
        difficulty: z.enum(VALID_DIFFICULTIES_REQ).nullable().optional(),
        question_type: z.string().optional().nullable(),
        tags: z.array(z.string()).optional().nullable(),
      })
      .optional()
      .nullable(),

    explanation: z.string().optional().nullable(),

    timeSpent: z.number().min(0).default(0),
    confidenceLevel: z.enum(VALID_CONFIDENCE).default('unknown'),
    interactionCount: z.number().int().min(0).default(1),
    questionStartTime: z.number().min(0).default(0),
    firstInteractionTime: z.number().min(0).default(0),

    interactionEvents: z.array(z.unknown()).max(10).default([]),
    mouseEvents: z.array(z.unknown()).max(50).default([]),
    scrollEvents: z.array(z.unknown()).max(50).default([]),

    deviceInfo: z
      .object({
        userAgent: z.string().max(1000).default('unknown'),
        screenResolution: z.string().max(50).default('unknown'),
        deviceType: z.enum(['mobile', 'tablet', 'desktop', 'unknown']).default('unknown'),
        browserLanguage: z.string().max(20).default('es'),
        timezone: z.string().max(100).default('Europe/Madrid'),
      })
      .optional(),

    oposicionId: z.string().optional().nullable(),
    currentScore: z.number().int().min(0).default(0),
  })
  .refine(
    (data) => {
      if (data.isBlank) return data.userAnswer === null;
      return data.userAnswer !== null;
    },
    {
      message:
        'isBlank=true requiere userAnswer=null; isBlank=false requiere userAnswer entre -1..4',
    },
  );

export function safeParseAnswerSaveRequest(data: unknown) {
  return answerSaveRequestSchema.safeParse(data);
}
