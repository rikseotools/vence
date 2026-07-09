import { Inject, Injectable, Logger } from '@nestjs/common';
import { sql } from 'drizzle-orm';
import { DRIZZLE, type DrizzleDB } from '../db/database.module';
import { signCanaryToken } from '../canary-shared/canary-token';

/**
 * Canary SAVE-CONTRACT — Nivel 4. Replica el flujo REAL del cliente para guardar
 * una respuesta y VERIFICA EN RDS que la fila llegó de verdad:
 *   1. POST /api/v2/tests  → crear sesión de test (el camino que rompió en el
 *      hueco C1 del 07-04: el cliente escribía por PostgREST y no se creaban).
 *   2. POST /api/test/save-answer → guardar una respuesta (endpoint real del cliente).
 *   3. SELECT en `test_questions` → confirmar que la fila EXISTE. Caza el PEOR
 *      caso: el endpoint responde 200 pero nada se guarda (clase hueco C1).
 *   4. Cleanup: borra el test + su fila (no contamina stats/ranking del user canario).
 *
 * Cierra el gap "las respuestas no se guardan" end-to-end, a cualquier tráfico
 * (la reconciliación necesita volumen; esto corre siempre). Ver memoria
 * project_deteccion_alertas_completa + project_hueco_c1_perdida_tests_recuperacion.
 */
export interface CanarySaveContractResult {
  ok?: boolean;
  skipped?: boolean;
  reason?: string;
  step?: string;
  errorMessage?: string;
  httpStatus?: number;
  durationMs: number;
}

@Injectable()
export class CanarySaveContractService {
  private readonly logger = new Logger(CanarySaveContractService.name);
  private readonly SITE = process.env.SMOKE_TARGET_URL ?? 'https://www.vence.es';
  private readonly TOKEN_TTL = 300;
  // Pregunta estable (misma que canary-answer-save): art 99 CE.
  private readonly Q = {
    id: 'b419f803-274a-4c44-8df8-1192c57ff614',
    articleId: '2c15266e-8c06-456a-a062-a5a5a0f15579',
  };
  // URL de oposición REAL para el POST de creación: reproduce el flujo del
  // cliente (window.location.pathname) y permite verificar que tests.position_type
  // se persiste. Regresión 05/07/2026 (b4ef6fc9): la migración a /api/v2/tests
  // dejó de escribir position_type y ningún canary lo cazó porque mandaban sin URL.
  private readonly TEST_URL = '/auxiliar-administrativo-estado/test/tema/1/test-personalizado';
  private readonly EXPECTED_POSITION_TYPE = 'auxiliar_administrativo_estado';

  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDB) {}

  async run(): Promise<CanarySaveContractResult> {
    const started = Date.now();
    const dur = () => Date.now() - started;

    const userId = process.env.SMOKE_USER_ID;
    const jwtSecret = process.env.SUPABASE_JWT_SECRET;
    if (!userId || !jwtSecret) {
      this.logger.warn('SMOKE_USER_ID / SUPABASE_JWT_SECRET no configurados — canary inactivo.');
      return { skipped: true, reason: 'credentials_not_configured', durationMs: dur() };
    }

    // ─── 1. Firmar token canario ───
    let token: string;
    try {
      const signed = signCanaryToken(userId, { ttlSeconds: this.TOKEN_TTL, email: 'smoke@vence.es', secret: jwtSecret });
      if (!signed) throw new Error('SUPABASE_JWT_SECRET no configurado');
      token = signed;
    } catch (err) {
      return { ok: false, step: 'sign_token', errorMessage: `Firma JWT falló: ${err instanceof Error ? err.message : String(err)}`, durationMs: dur() };
    }
    const headers = {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      'User-Agent': 'Vence-Canary-SaveContract/1.0',
      'x-vence-canary': '1',
    };

    // ─── 2. Crear test (camino cliente que rompió en C1) ───
    let testId: string;
    try {
      const res = await fetch(`${this.SITE}/api/v2/tests`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ tema: 1, testNumber: 999, totalQuestions: 1, testType: 'practice', title: 'Canary save-contract', testUrl: this.TEST_URL }),
        signal: AbortSignal.timeout(10_000),
      });
      const j = (await res.json().catch(() => ({}))) as { success?: boolean; id?: string; error?: string };
      if (res.status !== 200 || !j.success || !j.id) {
        return { ok: false, step: 'create_test', httpStatus: res.status, errorMessage: `POST /api/v2/tests: ${res.status} ${j.error ?? ''}`, durationMs: dur() };
      }
      testId = j.id;
    } catch (err) {
      return { ok: false, step: 'create_test_exc', errorMessage: err instanceof Error ? err.message : String(err), durationMs: dur() };
    }

    // ─── 3. Guardar respuesta (endpoint real del cliente) ───
    try {
      const res = await fetch(`${this.SITE}/api/test/save-answer`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          sessionId: testId,
          questionData: { id: this.Q.id, question: 'canary', options: ['a', 'b', 'c', 'd'], tema: 0, questionType: 'legislative', article: { id: this.Q.articleId, number: '99', law_short_name: 'CE' }, metadata: { tags: ['canary'] }, explanation: null },
          answerData: { questionIndex: 0, selectedAnswer: 0, correctAnswer: 0, isCorrect: true, timeSpent: 5000 },
          tema: 0, confidenceLevel: 'sure', interactionCount: 1, questionStartTime: Date.now() - 5000, firstInteractionTime: Date.now() - 3000,
          interactionEvents: [], mouseEvents: [], scrollEvents: [],
          deviceInfo: { userAgent: 'Vence-Canary-SaveContract/1.0', screenResolution: '1920x1080', deviceType: 'desktop', browserLanguage: 'es', timezone: 'Europe/Madrid' },
          oposicionId: 'auxiliar_administrativo_estado',
        }),
        signal: AbortSignal.timeout(10_000),
      });
      const j = (await res.json().catch(() => ({}))) as { success?: boolean; error?: string };
      if (res.status !== 200 || j.success === false) {
        await this.cleanup(testId);
        return { ok: false, step: 'save_answer', httpStatus: res.status, errorMessage: `POST /api/test/save-answer: ${res.status} ${j.error ?? ''}`, durationMs: dur() };
      }
    } catch (err) {
      await this.cleanup(testId);
      return { ok: false, step: 'save_answer_exc', errorMessage: err instanceof Error ? err.message : String(err), durationMs: dur() };
    }

    // ─── 4. VERIFICAR EN RDS que la fila llegó (la prueba real) ───
    let verified = false;
    let savedPositionType: string | null | undefined;
    try {
      const rows = (await this.db.execute(sql`SELECT COUNT(*)::int AS n FROM test_questions WHERE test_id = ${testId}::uuid`)) as unknown as Array<{ n: number }>;
      verified = (rows[0]?.n ?? 0) >= 1;
      // Invariante de atribución: un test creado en URL de oposición DEBE persistir
      // position_type (regresión 05/07/2026, b4ef6fc9). undefined = fila no leída.
      const ptRows = (await this.db.execute(sql`SELECT position_type FROM tests WHERE id = ${testId}::uuid`)) as unknown as Array<{ position_type: string | null }>;
      savedPositionType = ptRows.length ? ptRows[0]?.position_type ?? null : undefined;
    } catch {
      // si la verificación falla por BD, se reporta abajo; limpiamos igual.
    }

    // ─── 5. Cleanup (no contaminar stats/ranking del user canario) ───
    await this.cleanup(testId);

    if (!verified) {
      return { ok: false, step: 'db_verify', errorMessage: `El endpoint respondió OK pero la fila NO llegó a test_questions (test ${testId}) — GUARDADO ROTO (clase hueco C1)`, durationMs: dur() };
    }
    if (savedPositionType !== this.EXPECTED_POSITION_TYPE) {
      return { ok: false, step: 'db_verify_position_type', errorMessage: `El test se creó en ${this.TEST_URL} pero tests.position_type=${savedPositionType === null ? 'NULL' : savedPositionType === undefined ? '(fila no leída)' : savedPositionType} (esperado ${this.EXPECTED_POSITION_TYPE}) — ATRIBUCIÓN POR-OPOSICIÓN ROTA (regresión b4ef6fc9)`, durationMs: dur() };
    }
    return { ok: true, durationMs: dur() };
  }

  private async cleanup(testId: string): Promise<void> {
    try {
      await this.db.execute(sql`DELETE FROM test_questions WHERE test_id = ${testId}::uuid`);
      await this.db.execute(sql`DELETE FROM tests WHERE id = ${testId}::uuid`);
    } catch (err) {
      this.logger.warn(`cleanup canary test ${testId} falló: ${err instanceof Error ? err.message : String(err)}`);
    }
  }
}
