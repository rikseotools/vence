import type { CacheService } from '../cache/cache.service';
import type { TemaResolverService } from '../tema-resolver/tema-resolver.service';
import type { TestAnswersService } from '../test-answers/test-answers.service';
import { AnswerSaveService } from './answer-save.service';
import { normalizePositionType, type AnswerSaveRequest } from './answer-save.types';

const USER_ID = '3260627f-2018-4a5e-8234-e6f07015abb9';
const SESSION_ID = '00000000-0000-0000-0000-000000000001';
const QUESTION_ID = '11111111-1111-1111-1111-111111111111';

function makeReq(overrides?: Partial<AnswerSaveRequest>): AnswerSaveRequest {
  return {
    questionId: QUESTION_ID,
    userAnswer: 1,
    sessionId: SESSION_ID,
    questionIndex: 0,
    questionText: '¿Capital de España?',
    options: ['Madrid', 'Lisboa', 'París', 'Roma'],
    tema: 5,
    questionType: 'legislative',
    article: { number: '1', law_short_name: 'CE' },
    metadata: { difficulty: 'medium' },
    timeSpent: 12,
    confidenceLevel: 'sure',
    interactionCount: 1,
    currentScore: 3,
    ...overrides,
  };
}

// ════════════════════════════════════════════════════════════════
// Helpers para construir el service con mocks
// ════════════════════════════════════════════════════════════════

interface MockedDeps {
  cache: jest.Mocked<CacheService>;
  temaResolver: jest.Mocked<TemaResolverService>;
  testAnswers: jest.Mocked<TestAnswersService>;
  /** db mock no usado en estos tests (validateAndSaveAnswer no toca db
   *  directo cuando todos los services están mockeados — excepto el
   *  UPDATE tests.score, que mockeamos también). */
  db: unknown;
}

function makeService(): { service: AnswerSaveService; mocks: MockedDeps } {
  const cache = {
    getCached: jest.fn(),
    setCached: jest.fn(),
    invalidate: jest.fn().mockResolvedValue(undefined),
  } as unknown as jest.Mocked<CacheService>;

  const temaResolver = {
    resolveTemaByQuestionIdFast: jest.fn().mockResolvedValue(null),
  } as unknown as jest.Mocked<TemaResolverService>;

  const testAnswers = {
    insertTestAnswer: jest.fn().mockResolvedValue({
      success: true,
      question_id: QUESTION_ID,
      action: 'saved_new',
    }),
  } as unknown as jest.Mocked<TestAnswersService>;

  // db mock: encadena .update().set().where() devolviendo Promise.resolve()
  // (validateAndSaveAnswer hace UPDATE tests.score)
  const dbUpdateChain = {
    set: jest.fn().mockReturnThis(),
    where: jest.fn().mockResolvedValue(undefined),
  };
  const db = {
    select: jest.fn(),
    update: jest.fn().mockReturnValue(dbUpdateChain),
  };

  const service = new AnswerSaveService(
    db as never,
    cache,
    temaResolver,
    testAnswers,
  );

  // Stub interno: como getQuestionValidation toca db.select() complejo,
  // lo mockeamos a nivel de instancia para no recrear chain Drizzle.
  // Cada test setea su comportamiento con
  // `jest.spyOn(service, 'getQuestionValidation').mockResolvedValue(...)`.
  return { service, mocks: { cache, temaResolver, testAnswers, db } };
}

// ════════════════════════════════════════════════════════════════
// Tests
// ════════════════════════════════════════════════════════════════

describe('normalizePositionType (helper)', () => {
  it('null/undefined → auxiliar_administrativo_estado (default)', () => {
    expect(normalizePositionType(null)).toBe('auxiliar_administrativo_estado');
    expect(normalizePositionType(undefined)).toBe('auxiliar_administrativo_estado');
    expect(normalizePositionType('')).toBe('auxiliar_administrativo_estado');
  });
  it('convierte guiones a underscores', () => {
    expect(normalizePositionType('auxiliar-administrativo-estado')).toBe(
      'auxiliar_administrativo_estado',
    );
    expect(normalizePositionType('guardia-civil')).toBe('guardia_civil');
  });
  it('pasa sin cambios si ya tiene underscores', () => {
    expect(normalizePositionType('guardia_civil')).toBe('guardia_civil');
  });
});

describe('AnswerSaveService.validateAndSaveAnswer', () => {
  it('pregunta no existe (correctOption null) → success:false + saveAction save_failed + correctAnswer 0', async () => {
    const { service } = makeService();
    jest.spyOn(service, 'getQuestionValidation').mockResolvedValue(null);

    const result = await service.validateAndSaveAnswer(makeReq(), USER_ID);

    expect(result.success).toBe(false);
    expect(result.saveAction).toBe('save_failed');
    expect(result.correctAnswer).toBe(0);
    expect(result.newScore).toBe(3); // currentScore intacto
  });

  it('respuesta correcta → isCorrect true + newScore +1', async () => {
    const { service, mocks } = makeService();
    jest.spyOn(service, 'getQuestionValidation').mockResolvedValue({
      correctOption: 1,
      explanation: 'Capital es Madrid',
      articleNumber: '1',
      lawShortName: 'CE',
      lawName: 'Constitución Española',
    });

    const result = await service.validateAndSaveAnswer(makeReq(), USER_ID);

    expect(result.isCorrect).toBe(true);
    expect(result.correctAnswer).toBe(1);
    expect(result.newScore).toBe(4); // 3 + 1
    expect(result.success).toBe(true);
    expect(result.saveAction).toBe('saved_new');
    expect(result.explanation).toBe('Capital es Madrid');
    expect(result.articleNumber).toBe('1');
    expect(mocks.testAnswers.insertTestAnswer).toHaveBeenCalled();
  });

  it('respuesta incorrecta → isCorrect false + newScore intacto', async () => {
    const { service } = makeService();
    jest.spyOn(service, 'getQuestionValidation').mockResolvedValue({
      correctOption: 0, // correcta es A
      explanation: null,
      articleNumber: null,
      lawShortName: null,
      lawName: null,
    });

    const result = await service.validateAndSaveAnswer(
      makeReq({ userAnswer: 2 }), // user respondió C
      USER_ID,
    );

    expect(result.isCorrect).toBe(false);
    expect(result.correctAnswer).toBe(0);
    expect(result.newScore).toBe(3); // intacto
  });

  it('isBlank=true → isCorrect false aunque userAnswer coincida con correctOption', async () => {
    const { service } = makeService();
    jest.spyOn(service, 'getQuestionValidation').mockResolvedValue({
      correctOption: 1,
      explanation: null,
      articleNumber: null,
      lawShortName: null,
      lawName: null,
    });

    const result = await service.validateAndSaveAnswer(
      makeReq({ isBlank: true, userAnswer: null }),
      USER_ID,
    );

    expect(result.isCorrect).toBe(false);
    expect(result.newScore).toBe(3); // no suma porque isBlank
  });

  it('tema > 0 → NO llama al resolver (skip fast path)', async () => {
    const { service, mocks } = makeService();
    jest.spyOn(service, 'getQuestionValidation').mockResolvedValue({
      correctOption: 1,
      explanation: null,
      articleNumber: null,
      lawShortName: null,
      lawName: null,
    });

    await service.validateAndSaveAnswer(makeReq({ tema: 13 }), USER_ID);

    expect(mocks.temaResolver.resolveTemaByQuestionIdFast).not.toHaveBeenCalled();
  });

  it('tema=0 + legislativa + UUID → SÍ llama al resolver', async () => {
    const { service, mocks } = makeService();
    jest.spyOn(service, 'getQuestionValidation').mockResolvedValue({
      correctOption: 1,
      explanation: null,
      articleNumber: null,
      lawShortName: null,
      lawName: null,
    });
    mocks.temaResolver.resolveTemaByQuestionIdFast.mockResolvedValue(7);

    await service.validateAndSaveAnswer(makeReq({ tema: 0 }), USER_ID);

    expect(mocks.temaResolver.resolveTemaByQuestionIdFast).toHaveBeenCalledWith(
      QUESTION_ID,
      'auxiliar_administrativo_estado',
    );
  });

  it('tema=0 + psychometric → NO llama al resolver (skip)', async () => {
    const { service, mocks } = makeService();
    jest.spyOn(service, 'getQuestionValidation').mockResolvedValue({
      correctOption: 1,
      explanation: null,
      articleNumber: null,
      lawShortName: null,
      lawName: null,
    });

    await service.validateAndSaveAnswer(
      makeReq({ tema: 0, questionType: 'psychometric' }),
      USER_ID,
    );

    expect(mocks.temaResolver.resolveTemaByQuestionIdFast).not.toHaveBeenCalled();
  });

  it('questionId NO uuid (sintético) → NO llama al resolver', async () => {
    const { service, mocks } = makeService();
    jest.spyOn(service, 'getQuestionValidation').mockResolvedValue({
      correctOption: 1,
      explanation: null,
      articleNumber: null,
      lawShortName: null,
      lawName: null,
    });

    await service.validateAndSaveAnswer(
      makeReq({ tema: 0, questionId: 'tema-1-art-2-CE-abc' }),
      USER_ID,
    );

    expect(mocks.temaResolver.resolveTemaByQuestionIdFast).not.toHaveBeenCalled();
  });

  it('insert falla → saveAction save_failed + success false', async () => {
    const { service, mocks } = makeService();
    jest.spyOn(service, 'getQuestionValidation').mockResolvedValue({
      correctOption: 1,
      explanation: null,
      articleNumber: null,
      lawShortName: null,
      lawName: null,
    });
    mocks.testAnswers.insertTestAnswer.mockResolvedValue({
      success: false,
      action: 'save_failed',
      error: 'db error',
    });

    const result = await service.validateAndSaveAnswer(makeReq(), USER_ID);

    expect(result.success).toBe(false);
    expect(result.saveAction).toBe('save_failed');
    // Pero isCorrect SÍ se calculó (la validación pasó, el save es lo que falló)
    expect(result.isCorrect).toBe(true);
    expect(result.correctAnswer).toBe(1);
  });

  it('insert already_saved → success true + saveAction already_saved', async () => {
    const { service, mocks } = makeService();
    jest.spyOn(service, 'getQuestionValidation').mockResolvedValue({
      correctOption: 1,
      explanation: null,
      articleNumber: null,
      lawShortName: null,
      lawName: null,
    });
    mocks.testAnswers.insertTestAnswer.mockResolvedValue({
      success: true,
      question_id: QUESTION_ID,
      action: 'already_saved',
    });

    const result = await service.validateAndSaveAnswer(makeReq(), USER_ID);

    expect(result.success).toBe(true);
    expect(result.saveAction).toBe('already_saved');
  });

  it('UPDATE tests.score se llama tras insert OK', async () => {
    const { service, mocks } = makeService();
    jest.spyOn(service, 'getQuestionValidation').mockResolvedValue({
      correctOption: 1,
      explanation: null,
      articleNumber: null,
      lawShortName: null,
      lawName: null,
    });

    await service.validateAndSaveAnswer(makeReq(), USER_ID);
    expect((mocks.db as { update: jest.Mock }).update).toHaveBeenCalled();
  });

  it('UPDATE score que falla → log warn, NO falla la respuesta principal', async () => {
    const { service, mocks } = makeService();
    jest.spyOn(service, 'getQuestionValidation').mockResolvedValue({
      correctOption: 1,
      explanation: null,
      articleNumber: null,
      lawShortName: null,
      lawName: null,
    });
    // Forzar que el .where() lance error
    (mocks.db as { update: jest.Mock }).update.mockReturnValue({
      set: jest.fn().mockReturnThis(),
      where: jest.fn().mockRejectedValue(new Error('score update failed')),
    });

    const result = await service.validateAndSaveAnswer(makeReq(), USER_ID);

    // Pese al error de score, la respuesta principal es OK
    expect(result.success).toBe(true);
    expect(result.saveAction).toBe('saved_new');
  });
});

describe('AnswerSaveService.markActiveStudentIfFirst', () => {
  it('captura errores BD sin propagar (no crítico)', async () => {
    const db = {
      select: jest.fn().mockImplementation(() => {
        throw new Error('boom');
      }),
    };
    const service = new AnswerSaveService(
      db as never,
      {} as never,
      {} as never,
      {} as never,
    );

    await expect(
      service.markActiveStudentIfFirst(USER_ID),
    ).resolves.toBeUndefined();
  });
});
