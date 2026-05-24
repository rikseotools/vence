import { TestAnswersService } from './test-answers.service';
import type { SaveAnswerRequest } from './test-answers.types';
import { normalizeDifficulty } from './test-answers.types';

const USER_ID = '3260627f-2018-4a5e-8234-e6f07015abb9';
const SESSION_ID = '00000000-0000-0000-0000-000000000001';
const QUESTION_ID_REAL = '11111111-1111-1111-1111-111111111111';

function makeReq(overrides?: Partial<SaveAnswerRequest>): SaveAnswerRequest {
  return {
    sessionId: SESSION_ID,
    questionData: {
      id: QUESTION_ID_REAL,
      question: '¿Cuál es la capital de España?',
      options: ['Madrid', 'París', 'Berlín', 'Roma'],
      questionType: 'legislative',
      article: {
        id: '22222222-2222-2222-2222-222222222222',
        number: '1',
        law_short_name: 'CE',
      },
      metadata: { difficulty: 'medium', tags: ['geo'] },
    },
    answerData: {
      questionIndex: 0,
      selectedAnswer: 0,
      correctAnswer: 0,
      isCorrect: true,
      timeSpent: 12,
    },
    tema: 5,
    confidenceLevel: 'sure',
    interactionCount: 1,
    questionStartTime: 1000,
    firstInteractionTime: 1500,
    ...overrides,
  };
}

describe('TestAnswersService — helpers puros estáticos', () => {
  describe('mapAnswerToLetter', () => {
    it('0..3 → A..D', () => {
      expect(TestAnswersService.mapAnswerToLetter(0, 0)).toBe('A');
      expect(TestAnswersService.mapAnswerToLetter(1, 0)).toBe('B');
      expect(TestAnswersService.mapAnswerToLetter(2, 0)).toBe('C');
      expect(TestAnswersService.mapAnswerToLetter(3, 0)).toBe('D');
    });
    it('-1 con wasBlank=true → BLANK', () => {
      expect(TestAnswersService.mapAnswerToLetter(-1, 0, true)).toBe('BLANK');
      expect(TestAnswersService.mapAnswerToLetter(-1, 2, true)).toBe('BLANK');
    });
    it('-1 sin wasBlank → letra incorrecta (legacy safety-net)', () => {
      // correct=0 → respuesta sintética es letra 65 + ((0+1)%4) = B
      expect(TestAnswersService.mapAnswerToLetter(-1, 0)).toBe('B');
      // correct=3 → letra 65 + ((3+1)%4) = A
      expect(TestAnswersService.mapAnswerToLetter(-1, 3)).toBe('A');
    });
  });

  describe('generateContentHash', () => {
    it('produce string determinístico para mismas inputs', () => {
      const h1 = TestAnswersService.generateContentHash('hola', ['a', 'b']);
      const h2 = TestAnswersService.generateContentHash('hola', ['a', 'b']);
      expect(h1).toBe(h2);
    });
    it('produce hashes distintos para inputs distintas', () => {
      const h1 = TestAnswersService.generateContentHash('hola', ['a']);
      const h2 = TestAnswersService.generateContentHash('hola', ['b']);
      expect(h1).not.toBe(h2);
    });
    it('maneja string vacío sin crash', () => {
      expect(TestAnswersService.generateContentHash('', [])).toBe('0');
    });
    it('options null → trata como []', () => {
      const h = TestAnswersService.generateContentHash('x', null as unknown as string[]);
      expect(typeof h).toBe('string');
    });
  });

  describe('buildQuestionContext', () => {
    it('estructura el JSONB con article + metadata + generation_method', () => {
      const req = makeReq();
      const ctx = TestAnswersService.buildQuestionContext(req, 'qid', 'aid');
      expect(ctx).toMatchObject({
        options: ['Madrid', 'París', 'Berlín', 'Roma'],
        article_full: { id: expect.any(String), number: '1', law_short_name: 'CE' },
        generated_ids: {
          question_id: 'qid',
          article_id: 'aid',
          generation_method: 'generated', // metadata sin id → 'generated'
        },
      });
    });
    it('generation_method = "metadata" si metadata.id existe', () => {
      const req = makeReq({
        questionData: {
          ...makeReq().questionData,
          metadata: { id: 'meta-id-123' },
        },
      });
      const ctx = TestAnswersService.buildQuestionContext(req, 'qid', null);
      const ids = ctx.generated_ids as { generation_method: string };
      expect(ids.generation_method).toBe('metadata');
    });
  });

  describe('buildBehaviorData', () => {
    it('cuenta eventos correctamente + slice -10 en interaction_events', () => {
      const events = Array.from({ length: 15 }, (_, i) => ({ idx: i }));
      const req = makeReq({
        interactionEvents: events,
        mouseEvents: [{}, {}, {}],
        scrollEvents: [{}],
        interactionCount: 5,
      });
      const data = TestAnswersService.buildBehaviorData(req);
      expect(data).toMatchObject({
        mouse_activity: 3,
        scroll_activity: 1,
        confidence_evolution: 'sure',
        answer_changes: 4, // interactionCount - 1
      });
      const ie = data.interaction_events as unknown[];
      expect(ie).toHaveLength(10); // slice(-10)
      expect((ie[0] as { idx: number }).idx).toBe(5); // primeros 5 descartados
    });
    it('answer_changes >= 0 (no negativo si interactionCount<1)', () => {
      const req = makeReq({ interactionCount: 0 });
      const data = TestAnswersService.buildBehaviorData(req);
      // interactionCount 0 fallback a 1 → answer_changes = max(0, 1-1) = 0
      expect(data.answer_changes).toBe(0);
    });
  });

  describe('buildLearningAnalytics', () => {
    it('response_pattern por isCorrect', () => {
      const reqCorrect = makeReq({
        answerData: { ...makeReq().answerData, isCorrect: true },
      });
      const reqWrong = makeReq({
        answerData: { ...makeReq().answerData, isCorrect: false },
      });
      expect(
        TestAnswersService.buildLearningAnalytics(reqCorrect).response_pattern,
      ).toBe('correct');
      expect(
        TestAnswersService.buildLearningAnalytics(reqWrong).response_pattern,
      ).toBe('incorrect');
    });
    it('time_efficiency: <=30 fast, 31-60 normal, >60 slow', () => {
      const fast = makeReq({
        answerData: { ...makeReq().answerData, timeSpent: 10 },
      });
      const normal = makeReq({
        answerData: { ...makeReq().answerData, timeSpent: 45 },
      });
      const slow = makeReq({
        answerData: { ...makeReq().answerData, timeSpent: 90 },
      });
      expect(TestAnswersService.buildLearningAnalytics(fast).time_efficiency).toBe('fast');
      expect(TestAnswersService.buildLearningAnalytics(normal).time_efficiency).toBe('normal');
      expect(TestAnswersService.buildLearningAnalytics(slow).time_efficiency).toBe('slow');
    });
    it('confidence_accuracy_match: very_sure+correct → true, sure+incorrect → false', () => {
      const a = makeReq({
        confidenceLevel: 'very_sure',
        answerData: { ...makeReq().answerData, isCorrect: true },
      });
      const b = makeReq({
        confidenceLevel: 'sure',
        answerData: { ...makeReq().answerData, isCorrect: false },
      });
      expect(
        TestAnswersService.buildLearningAnalytics(a).confidence_accuracy_match,
      ).toBe(true);
      expect(
        TestAnswersService.buildLearningAnalytics(b).confidence_accuracy_match,
      ).toBe(false);
    });
    it('hesitation_pattern: 0=low, 7=medium, 15=high', () => {
      const low = makeReq({ questionStartTime: 0, firstInteractionTime: 2 });
      const medium = makeReq({ questionStartTime: 0, firstInteractionTime: 7 });
      const high = makeReq({ questionStartTime: 0, firstInteractionTime: 15 });
      expect(TestAnswersService.buildLearningAnalytics(low).hesitation_pattern).toBe('low');
      expect(TestAnswersService.buildLearningAnalytics(medium).hesitation_pattern).toBe('medium');
      expect(TestAnswersService.buildLearningAnalytics(high).hesitation_pattern).toBe('high');
    });
    it('interaction_pattern: 1=decisive, 2=normal, >2=hesitant', () => {
      expect(
        TestAnswersService.buildLearningAnalytics(makeReq({ interactionCount: 1 }))
          .interaction_pattern,
      ).toBe('decisive');
      expect(
        TestAnswersService.buildLearningAnalytics(makeReq({ interactionCount: 2 }))
          .interaction_pattern,
      ).toBe('normal');
      expect(
        TestAnswersService.buildLearningAnalytics(makeReq({ interactionCount: 5 }))
          .interaction_pattern,
      ).toBe('hesitant');
    });
  });
});

describe('TestAnswersService.buildTestAnswerRow', () => {
  let service: TestAnswersService;

  beforeEach(() => {
    // db no se usa en buildTestAnswerRow (es helper puro). Pasamos undefined.
    service = new TestAnswersService(undefined as never);
  });

  it('respeta el tema explícito (questionData.tema > req.tema)', () => {
    // questionData.tema ausente → cae a req.tema.
    const { row: rA } = service.buildTestAnswerRow(makeReq({ tema: 7 }), USER_ID);
    expect(rA.temaNumber).toBe(7);

    // questionData.tema presente → gana sobre req.tema.
    const reqWithQuestionTema = makeReq({
      questionData: { ...makeReq().questionData, tema: 9 },
      tema: 3,
    });
    const { row: rB } = service.buildTestAnswerRow(reqWithQuestionTema, USER_ID);
    expect(rB.temaNumber).toBe(9);
  });

  it('usa resolvedTema cuando tema=0 y no hay tema en questionData', () => {
    const req = makeReq({
      tema: 0,
      questionData: { ...makeReq().questionData, tema: null },
    });
    const { row } = service.buildTestAnswerRow(req, USER_ID, { resolvedTema: 13 });
    expect(row.temaNumber).toBe(13);
  });

  it('tema=0 sin resolvedTema → temaNumber=0 (graceful)', () => {
    const req = makeReq({
      tema: 0,
      questionData: { ...makeReq().questionData, tema: null },
    });
    const { row } = service.buildTestAnswerRow(req, USER_ID);
    expect(row.temaNumber).toBe(0);
  });

  it('genera questionId sintético si no hay id ni metadata.id', () => {
    const req = makeReq({
      questionData: {
        ...makeReq().questionData,
        id: null,
        metadata: null,
      },
    });
    const { questionId } = service.buildTestAnswerRow(req, USER_ID);
    expect(questionId).toMatch(/^tema-\d+-art-\d+-CE-[a-z0-9]+$/);
  });

  it('legislativa: questionId va a row.questionId, NO a psychometricQuestionId', () => {
    const { row } = service.buildTestAnswerRow(makeReq(), USER_ID);
    expect(row.questionId).toBe(QUESTION_ID_REAL);
    expect(row.psychometricQuestionId).toBeNull();
    expect(row.questionType).toBe('legislative');
  });

  it('psicotécnica: questionId va a psychometricQuestionId, NO a questionId', () => {
    const req = makeReq({
      questionData: { ...makeReq().questionData, questionType: 'psychometric' },
    });
    const { row } = service.buildTestAnswerRow(req, USER_ID);
    expect(row.psychometricQuestionId).toBe(QUESTION_ID_REAL);
    expect(row.questionId).toBeNull();
    expect(row.questionType).toBe('psychometric');
  });

  it('wasBlank=true → row.wasBlank=true + userAnswer="BLANK"', () => {
    const req = makeReq({
      answerData: {
        questionIndex: 0,
        selectedAnswer: -1,
        correctAnswer: 1,
        isCorrect: false,
        wasBlank: true,
      },
    });
    const { row } = service.buildTestAnswerRow(req, USER_ID);
    expect(row.wasBlank).toBe(true);
    expect(row.userAnswer).toBe('BLANK');
  });

  it('mapea respuesta correcta: selectedAnswer=2 + correctAnswer=2 → C/C + isCorrect=true', () => {
    const req = makeReq({
      answerData: {
        questionIndex: 0,
        selectedAnswer: 2,
        correctAnswer: 2,
        isCorrect: true,
      },
    });
    const { row } = service.buildTestAnswerRow(req, USER_ID);
    expect(row.userAnswer).toBe('C');
    expect(row.correctAnswer).toBe('C');
    expect(row.isCorrect).toBe(true);
  });

  it('campos device default cuando deviceInfo es undefined', () => {
    const { row } = service.buildTestAnswerRow(makeReq(), USER_ID);
    expect(row.userAgent).toBe('unknown');
    expect(row.timezone).toBe('Europe/Madrid');
    expect(row.browserLanguage).toBe('es');
  });

  it('questionOrder = questionIndex + 1', () => {
    const req = makeReq({
      answerData: { ...makeReq().answerData, questionIndex: 7 },
    });
    const { row } = service.buildTestAnswerRow(req, USER_ID);
    expect(row.questionOrder).toBe(8);
  });

  it('normalizeDifficulty se aplica al row', () => {
    const req = makeReq({
      questionData: {
        ...makeReq().questionData,
        metadata: { difficulty: 'hard' },
      },
    });
    const { row } = service.buildTestAnswerRow(req, USER_ID);
    expect(row.difficulty).toBe('hard');
  });
});

describe('normalizeDifficulty (helper compartido)', () => {
  it('null/undefined → "medium" (default)', () => {
    expect(normalizeDifficulty(null)).toBe('medium');
    expect(normalizeDifficulty(undefined)).toBe('medium');
    expect(normalizeDifficulty('')).toBe('medium');
  });
  it('valores válidos pasan tal cual', () => {
    expect(normalizeDifficulty('easy')).toBe('easy');
    expect(normalizeDifficulty('hard')).toBe('hard');
    expect(normalizeDifficulty('extreme')).toBe('extreme');
  });
  it('numéricos legacy 1..4 mapean al enum', () => {
    expect(normalizeDifficulty('1')).toBe('easy');
    expect(normalizeDifficulty('2')).toBe('medium');
    expect(normalizeDifficulty('3')).toBe('hard');
    expect(normalizeDifficulty('4')).toBe('extreme');
    expect(normalizeDifficulty('5')).toBe('extreme');
  });
  it('valor desconocido → "medium" fallback', () => {
    expect(normalizeDifficulty('xxx')).toBe('medium');
  });
});
