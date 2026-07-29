// backend/src/answer-save/answer-save.shuffle.spec.ts
//
// El barajado de opciones EN EL BACKEND (T-235). Este fichero existe porque el canary
// enruta /api/v2/answer-and-save aquí, y aquí NO había nada de barajado: el esquema Zod
// no declaraba `optionOrder` (Zod lo borraba en silencio), el schema de BD no tenía la
// columna, y la validación comparaba la posición MOSTRADA contra la clave ORIGINAL.
// Con el piloto encendido eso marcó como FALLO 56 respuestas ACERTADAS de usuarios de
// Valencia, irreparables porque la permutación nunca se guardó.
import { AnswerSaveService } from './answer-save.service';
import { answerSaveRequestSchema } from './answer-save.types';
import { displayedToOriginal, isValidOrder } from '../shuffle/permute';

describe('permute (copia backend)', () => {
  describe('isValidOrder', () => {
    it('acepta una permutación completa', () => {
      expect(isValidOrder([2, 3, 0, 1], 4)).toBe(true);
      expect(isValidOrder([0, 1, 2, 3], 4)).toBe(true);
    });

    it('rechaza lo que no es una permutación de [0..n-1]', () => {
      expect(isValidOrder([0, 1, 2], 4)).toBe(false); // longitud
      expect(isValidOrder([0, 1, 1, 2], 4)).toBe(false); // repetido
      expect(isValidOrder([0, 1, 2, 9], 4)).toBe(false); // fuera de rango
      expect(isValidOrder([0, 1, 2, -1], 4)).toBe(false);
      expect(isValidOrder(null, 4)).toBe(false);
      expect(isValidOrder('0,1,2,3', 4)).toBe(false); // serializado
      expect(isValidOrder([], 4)).toBe(false);
    });
  });

  describe('displayedToOriginal', () => {
    it('traduce la posición mostrada al índice original', () => {
      // Se mostró [C, D, A, B] → quien pulsa la 1.ª (mostrada 0) eligió la C (original 2)
      expect(displayedToOriginal([2, 3, 0, 1], 0)).toBe(2);
      expect(displayedToOriginal([2, 3, 0, 1], 3)).toBe(1);
    });

    it('sin orden es la identidad (comportamiento histórico intacto)', () => {
      expect(displayedToOriginal(null, 2)).toBe(2);
      expect(displayedToOriginal(undefined, 0)).toBe(0);
    });
  });
});

describe('contrato de entrada del backend', () => {
  const base = {
    questionId: '3bdd3565-1111-4222-8333-444444444444',
    userAnswer: 0,
    sessionId: '4ed7bbcc-2222-4333-8444-555555555555',
    questionIndex: 0,
    questionText: '¿Pregunta?',
    options: ['A', 'B', 'C', 'D'],
  };

  it('CONSERVA optionOrder — sin esto Zod lo borra y la permutación nunca llega a la BD', () => {
    const r = answerSaveRequestSchema.safeParse({ ...base, optionOrder: [2, 3, 0, 1] });
    expect(r.success).toBe(true);
    expect(r.success && r.data.optionOrder).toEqual([2, 3, 0, 1]);
  });

  it('admite null y ausente (el 100% del tráfico sin barajado)', () => {
    expect(answerSaveRequestSchema.safeParse({ ...base, optionOrder: null }).success).toBe(true);
    const sin = answerSaveRequestSchema.safeParse(base);
    expect(sin.success).toBe(true);
    expect(sin.success && sin.data.optionOrder).toBeUndefined();
  });

  it('rechaza un optionOrder que no es de enteros', () => {
    expect(answerSaveRequestSchema.safeParse({ ...base, optionOrder: ['a', 'b'] }).success).toBe(false);
  });
});

describe('AnswerSaveService.validateAndSaveAnswer — corrección con barajado', () => {
  const QUESTION_ID = '3bdd3565-1111-4222-8333-444444444444';
  const USER_ID = '79b8c727-0ed8-433c-8b64-a39e7d2b406e';

  // Pregunta cuya correcta es la B (índice 1 en BD).
  const CORRECT_OPTION = 1;

  function makeService(capturas: { save?: unknown } = {}) {
    const db = {
      select: () => ({ from: () => ({ where: () => ({ limit: async () => [] }) }) }),
      update: () => ({ set: () => ({ where: async () => undefined }) }),
    } as never;
    // El service consulta su cache de validación antes que la BD: se le da la clave
    // conocida por ahí, que es el punto de entrada real (getQuestionValidation).
    const cache = {
      getCached: async () => ({
        correctOption: CORRECT_OPTION,
        explanation: null,
        articleId: null,
        articleNumber: null,
        lawShortName: null,
        lawName: null,
      }),
      setCached: async () => undefined,
      get: async () => null,
      set: async () => undefined,
    } as never;
    const temaResolver = { resolveTemaFast: async () => null } as never;
    const testAnswers = {
      insertTestAnswer: jest.fn(async (req: unknown) => {
        capturas.save = req;
        return { success: true, action: 'saved_new', question_id: QUESTION_ID };
      }),
    } as never;
    const observability = { emit: jest.fn(async () => undefined) } as never;

    const service = new AnswerSaveService(db, cache, temaResolver, testAnswers, observability);
    return { service, testAnswers, observability, capturas };
  }

  const peticion = (userAnswer: number, optionOrder: number[] | null) => ({
    questionId: QUESTION_ID,
    userAnswer,
    sessionId: '4ed7bbcc-2222-4333-8444-555555555555',
    questionIndex: 0,
    questionText: '¿Pregunta?',
    options: ['A', 'B', 'C', 'D'],
    optionOrder,
    tema: 1,
  });

  it('SIN barajado se comporta igual que siempre (identidad)', async () => {
    const { service } = makeService();
    const res = await service.validateAndSaveAnswer(peticion(1, null) as never, USER_ID);
    expect(res.isCorrect).toBe(true);
  });

  it('CON barajado: acierto en la posición mostrada cuenta como ACIERTO', async () => {
    // Se sirvió [C, D, A, B] (order=[2,3,0,1]). La correcta (B, original 1) quedó en la
    // posición mostrada 3. El usuario pulsa la 3 → acierta.
    const { service } = makeService();
    const res = await service.validateAndSaveAnswer(peticion(3, [2, 3, 0, 1]) as never, USER_ID);
    expect(res.isCorrect).toBe(true);
  });

  it('CON barajado: el bug original — pulsar la posición 1 ya NO cuenta como acierto', async () => {
    // Antes se comparaba 1 === correctOption(1) → acierto falso. Ahora la posición 1
    // mostrada corresponde a la D (original 3) → fallo, que es lo correcto.
    const { service } = makeService();
    const res = await service.validateAndSaveAnswer(peticion(1, [2, 3, 0, 1]) as never, USER_ID);
    expect(res.isCorrect).toBe(false);
  });

  it('devuelve la correcta en coordenadas MOSTRADAS (el cliente resalta esa)', async () => {
    const { service } = makeService();
    const res = await service.validateAndSaveAnswer(peticion(0, [2, 3, 0, 1]) as never, USER_ID);
    expect(res.correctAnswer).toBe(3); // la B quedó en la posición 3
  });

  it('PERSISTE la permutación y guarda el índice ORIGINAL elegido', async () => {
    const { service, capturas } = makeService();
    await service.validateAndSaveAnswer(peticion(0, [2, 3, 0, 1]) as never, USER_ID);
    const guardado = capturas.save as { answerData: { optionOrder: number[]; selectedAnswer: number } };
    expect(guardado.answerData.optionOrder).toEqual([2, 3, 0, 1]);
    // Pulsó la posición 0, que mostraba la C → índice original 2.
    expect(guardado.answerData.selectedAnswer).toBe(2);
  });

  it('un optionOrder CORRUPTO se ignora (identidad) y deja rastro observable', async () => {
    const { service, observability } = makeService();
    const res = await service.validateAndSaveAnswer(peticion(1, [0, 0, 0, 0]) as never, USER_ID);
    expect(res.isCorrect).toBe(true); // identidad: no se corrige con basura
    expect((observability as unknown as { emit: jest.Mock }).emit).toHaveBeenCalledWith(
      expect.objectContaining({ eventType: 'shuffle_option_order_invalid' }),
    );
  });
});
