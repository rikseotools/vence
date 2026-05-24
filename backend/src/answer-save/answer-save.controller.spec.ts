import { BadRequestException, ForbiddenException } from '@nestjs/common';
import type { Response } from 'express';
import { AntifraudService } from '../antifraud/antifraud.service';
import type { AuthenticatedUser } from '../auth/jwt-verifier';
import { BackgroundService } from '../background/background.service';
import type { CacheService } from '../cache/cache.service';
import { DailyLimitService } from '../daily-limit/daily-limit.service';
import { AnswerSaveController } from './answer-save.controller';
import { AnswerSaveService } from './answer-save.service';
import type { AnswerSaveRequest } from './answer-save.types';

const USER_ID = '3260627f-2018-4a5e-8234-e6f07015abb9';
const SESSION_ID = '00000000-0000-0000-0000-000000000001';
const QUESTION_ID = '11111111-1111-1111-1111-111111111111';

const USER: AuthenticatedUser = {
  userId: USER_ID,
  email: 'a@b.com',
  role: 'authenticated',
};

function makeBody(overrides?: Partial<AnswerSaveRequest>): AnswerSaveRequest {
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

function makeRes(): jest.Mocked<Response> {
  return {
    status: jest.fn().mockReturnThis(),
    setHeader: jest.fn().mockReturnThis(),
  } as unknown as jest.Mocked<Response>;
}

interface ControllerMocks {
  answerSave: jest.Mocked<AnswerSaveService>;
  antifraud: jest.Mocked<AntifraudService>;
  dailyLimit: jest.Mocked<DailyLimitService>;
  cache: jest.Mocked<CacheService>;
  bg: BackgroundService;
}

function makeController(): {
  controller: AnswerSaveController;
  mocks: ControllerMocks;
} {
  const answerSave = {
    validateAndSaveAnswer: jest.fn().mockResolvedValue({
      success: true,
      isCorrect: true,
      correctAnswer: 1,
      explanation: 'ok',
      articleNumber: '1',
      lawShortName: 'CE',
      lawName: 'Constitución Española',
      newScore: 4,
      saveAction: 'saved_new',
      questionDbId: QUESTION_ID,
    }),
    markActiveStudentIfFirst: jest.fn().mockResolvedValue(undefined),
  } as unknown as jest.Mocked<AnswerSaveService>;

  const antifraud = {
    registerAndCheckDevice: jest.fn().mockResolvedValue({
      allowed: true,
      deviceCount: 1,
      maxDevices: 2,
      isNewDevice: false,
      isPremium: false,
      existingDevices: '',
    }),
  } as unknown as jest.Mocked<AntifraudService>;

  const dailyLimit = {
    getDailyLimitStatus: jest.fn().mockResolvedValue({
      allowed: true,
      questionsToday: 5,
      questionsRemaining: 20,
      dailyLimit: 25,
      isPremium: false,
      isGraduated: false,
      tierLabel: null,
    }),
    checkDeviceDailyUsage: jest.fn().mockResolvedValue({ allowed: true, deviceTotal: 5 }),
  } as unknown as jest.Mocked<DailyLimitService>;

  const cache = {
    invalidateMany: jest.fn().mockResolvedValue(undefined),
  } as unknown as jest.Mocked<CacheService>;

  const bg = new BackgroundService();

  const controller = new AnswerSaveController(
    answerSave,
    antifraud,
    dailyLimit,
    cache,
    bg,
  );

  return { controller, mocks: { answerSave, antifraud, dailyLimit, cache, bg } };
}

describe('AnswerSaveController.post', () => {
  describe('validación body', () => {
    it('body inválido (questionId no-uuid) → BadRequestException', async () => {
      const { controller } = makeController();
      const res = makeRes();
      await expect(
        controller.post(
          { ...makeBody(), questionId: 'no-uuid' },
          USER,
          {},
          res,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('body sin questionId → BadRequestException', async () => {
      const { controller } = makeController();
      const res = makeRes();
      await expect(
        controller.post({}, USER, {}, res),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('happy path', () => {
    it('200 con saved_new + headers x-served-by + dispara background tasks', async () => {
      const { controller, mocks } = makeController();
      const res = makeRes();
      const result = await controller.post(makeBody(), USER, {}, res);

      expect(result.success).toBe(true);
      expect((result as { saveAction: string }).saveAction).toBe('saved_new');
      expect(res.setHeader).toHaveBeenCalledWith('x-served-by', 'vence-backend');
      expect(mocks.answerSave.validateAndSaveAnswer).toHaveBeenCalledWith(
        expect.objectContaining({ questionId: QUESTION_ID }),
        USER_ID,
      );

      // Background ejecuta tras tick — esperar al setImmediate
      await new Promise((r) => setImmediate(r));
      await new Promise((r) => setImmediate(r));
      expect(mocks.answerSave.markActiveStudentIfFirst).toHaveBeenCalledWith(USER_ID);
      expect(mocks.cache.invalidateMany).toHaveBeenCalled();
      const invalidatedKeys = mocks.cache.invalidateMany.mock.calls[0][0];
      expect(invalidatedKeys).toContain(`user_stats:${USER_ID}`);
      expect(invalidatedKeys).toContain(`theme_stats:${USER_ID}`);
    });
  });

  describe('antifraud blocks', () => {
    it('device limit reached → ForbiddenException', async () => {
      const { controller, mocks } = makeController();
      mocks.antifraud.registerAndCheckDevice.mockResolvedValue({
        allowed: false,
        deviceCount: 3,
        maxDevices: 2,
        isNewDevice: true,
        isPremium: false,
        existingDevices: 'Chrome/Mac, Safari/iOS',
      });
      const res = makeRes();
      await expect(
        controller.post(makeBody(), USER, {}, res),
      ).rejects.toThrow(ForbiddenException);
    });

    it('device daily usage exhausted (free user) → ForbiddenException', async () => {
      const { controller, mocks } = makeController();
      mocks.dailyLimit.checkDeviceDailyUsage.mockResolvedValue({
        allowed: false,
        deviceTotal: 25,
      });
      const res = makeRes();
      await expect(
        controller.post(makeBody(), USER, {}, res),
      ).rejects.toThrow(ForbiddenException);
    });

    it('user daily limit exhausted → ForbiddenException', async () => {
      const { controller, mocks } = makeController();
      mocks.dailyLimit.getDailyLimitStatus.mockResolvedValue({
        allowed: false,
        questionsToday: 25,
        questionsRemaining: 0,
        dailyLimit: 25,
        isPremium: false,
        isGraduated: false,
        tierLabel: null,
      });
      const res = makeRes();
      await expect(
        controller.post(makeBody(), USER, {}, res),
      ).rejects.toThrow(ForbiddenException);
    });

    it('premium ignora device daily limit', async () => {
      const { controller, mocks } = makeController();
      mocks.dailyLimit.getDailyLimitStatus.mockResolvedValue({
        allowed: true,
        questionsToday: 100,
        questionsRemaining: 899,
        dailyLimit: 999,
        isPremium: true,
        isGraduated: false,
        tierLabel: null,
      });
      mocks.dailyLimit.checkDeviceDailyUsage.mockResolvedValue({
        allowed: false,
        deviceTotal: 25,
      });
      const res = makeRes();
      // Premium debe poder seguir aunque device usage esté exhausted
      const result = await controller.post(makeBody(), USER, {}, res);
      expect(result.success).toBe(true);
    });
  });

  describe('quick-fail timeouts', () => {
    it('antifraud timeout → 503 + Retry-After', async () => {
      jest.useFakeTimers();
      const { controller, mocks } = makeController();
      // Hacer que registerAndCheckDevice nunca resuelva
      mocks.antifraud.registerAndCheckDevice.mockImplementation(
        () => new Promise(() => {}),
      );
      const res = makeRes();
      const promise = controller.post(makeBody(), USER, {}, res);
      jest.advanceTimersByTime(11_000);
      jest.useRealTimers();
      const result = await promise;
      expect((result as { error: string }).error).toContain('saturado');
      expect(res.status).toHaveBeenCalledWith(503);
      expect(res.setHeader).toHaveBeenCalledWith('Retry-After', '300');
    }, 15000);

    it('validate-and-save timeout → 503 + Retry-After', async () => {
      jest.useFakeTimers();
      const { controller, mocks } = makeController();
      mocks.answerSave.validateAndSaveAnswer.mockImplementation(
        () => new Promise(() => {}),
      );
      const res = makeRes();
      const promise = controller.post(makeBody(), USER, {}, res);
      jest.advanceTimersByTime(16_000);
      jest.useRealTimers();
      const result = await promise;
      expect((result as { error: string }).error).toContain('saturado');
      expect(res.status).toHaveBeenCalledWith(503);
    }, 20000);
  });

  describe('mapeo status codes según saveAction', () => {
    it('save_failed con correctAnswer=0 (pregunta no existe) → 404', async () => {
      const { controller, mocks } = makeController();
      mocks.answerSave.validateAndSaveAnswer.mockResolvedValue({
        success: false,
        isCorrect: false,
        correctAnswer: 0,
        explanation: null,
        newScore: 3,
        saveAction: 'save_failed',
      });
      const res = makeRes();
      await controller.post(makeBody(), USER, {}, res);
      expect(res.status).toHaveBeenCalledWith(404);
    });

    it('save_failed con correctAnswer>0 (insert error) → 500', async () => {
      const { controller, mocks } = makeController();
      mocks.answerSave.validateAndSaveAnswer.mockResolvedValue({
        success: false,
        isCorrect: false,
        correctAnswer: 2,
        explanation: 'algo',
        newScore: 3,
        saveAction: 'save_failed',
      });
      const res = makeRes();
      await controller.post(makeBody(), USER, {}, res);
      expect(res.status).toHaveBeenCalledWith(500);
    });
  });

  describe('headers anti-fraud forward', () => {
    it('extrae x-device-id + x-hw-fingerprint + user-agent y los pasa a antifraud', async () => {
      const { controller, mocks } = makeController();
      const res = makeRes();
      await controller.post(
        makeBody(),
        USER,
        {
          'x-device-id': 'device-abc',
          'x-hw-fingerprint': 'fp-xyz',
          'user-agent': 'Mozilla/5.0 Chrome/120',
        },
        res,
      );
      expect(mocks.antifraud.registerAndCheckDevice).toHaveBeenCalledWith(
        USER_ID,
        'device-abc',
        'Mozilla/5.0 Chrome/120',
        'fp-xyz',
      );
    });
  });
});
