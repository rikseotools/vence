import {
  GRADUATED_LIMIT_CONFIG,
  type UserLimitProfile,
} from './daily-limit.config';
import { DailyLimitService } from './daily-limit.service';

function makeProfile(overrides?: Partial<UserLimitProfile>): UserLimitProfile {
  return {
    userId: 'u1',
    planType: 'free',
    createdAt: new Date('2026-04-01').toISOString(),
    registrationAgeDays: 30,
    totalLimitHits: 0,
    isPremium: false,
    ...overrides,
  };
}

describe('DailyLimitService.calculateDynamicLimit (helper estático puro)', () => {
  it('premium → dailyLimit 999 + isGraduated false', () => {
    const r = DailyLimitService.calculateDynamicLimit(
      makeProfile({ isPremium: true, planType: 'premium' }),
    );
    expect(r.dailyLimit).toBe(999);
    expect(r.isGraduated).toBe(false);
    expect(r.tierLabel).toBeNull();
  });

  it('free con 0 hits → defaultLimit (25) + isGraduated false', () => {
    const r = DailyLimitService.calculateDynamicLimit(makeProfile({ totalLimitHits: 0 }));
    expect(r.dailyLimit).toBe(GRADUATED_LIMIT_CONFIG.defaultLimit);
    expect(r.isGraduated).toBe(false);
    expect(r.tierLabel).toBeNull();
  });

  it('free con 2 hits (< minLimitHitsRequired=3) → todavía defaultLimit', () => {
    const r = DailyLimitService.calculateDynamicLimit(makeProfile({ totalLimitHits: 2 }));
    expect(r.dailyLimit).toBe(GRADUATED_LIMIT_CONFIG.defaultLimit);
    expect(r.isGraduated).toBe(false);
  });

  it('free con 3 hits + 10 días → tier onboarding', () => {
    const r = DailyLimitService.calculateDynamicLimit(
      makeProfile({ totalLimitHits: 3, registrationAgeDays: 10 }),
    );
    expect(r.tierLabel).toBe('onboarding');
  });

  it('free con hits + 45 días → tier established', () => {
    const r = DailyLimitService.calculateDynamicLimit(
      makeProfile({ totalLimitHits: 5, registrationAgeDays: 45 }),
    );
    expect(r.tierLabel).toBe('established');
  });

  it('free con hits + 200 días → tier veteran (último tier)', () => {
    const r = DailyLimitService.calculateDynamicLimit(
      makeProfile({ totalLimitHits: 5, registrationAgeDays: 200 }),
    );
    expect(r.tierLabel).toBe('veteran');
  });

  it('todos los tiers actualmente son 25 → isGraduated=false (no es regresión)', () => {
    // Por config actual TODOS los tiers tienen dailyLimit=25 (igual a default).
    // Si en el futuro se baja algún tier (ej. veteran=10), isGraduated pasaría
    // a true. Este test deja huella explícita del estado actual.
    const r = DailyLimitService.calculateDynamicLimit(
      makeProfile({ totalLimitHits: 5, registrationAgeDays: 200 }),
    );
    expect(r.dailyLimit).toBe(25);
    expect(r.isGraduated).toBe(false);
  });

  it('pasa registrationAgeDays + totalLimitHits al resultado', () => {
    const r = DailyLimitService.calculateDynamicLimit(
      makeProfile({ registrationAgeDays: 99, totalLimitHits: 7 }),
    );
    expect(r.registrationAgeDays).toBe(99);
    expect(r.totalLimitHits).toBe(7);
  });
});

describe('DailyLimitService — cache invalidation', () => {
  let service: DailyLimitService;

  beforeEach(() => {
    service = new DailyLimitService(undefined as never);
  });

  it('invalidateLimitCache borra la entry sin throw', () => {
    expect(() => service.invalidateLimitCache('user-123')).not.toThrow();
  });

  it('invalidateLimitCache es idempotente (user inexistente)', () => {
    expect(() => service.invalidateLimitCache('inexistente')).not.toThrow();
  });
});

describe('DailyLimitService.getDailyLimitStatus', () => {
  let service: DailyLimitService;

  beforeEach(() => {
    service = new DailyLimitService(undefined as never);
  });

  it('userId null → FAIL_OPEN allowed', async () => {
    const r = await service.getDailyLimitStatus(null);
    expect(r.allowed).toBe(true);
    expect(r.dailyLimit).toBe(GRADUATED_LIMIT_CONFIG.defaultLimit);
  });

  it('BD inaccesible (test sin db) → FAIL_OPEN documentado', async () => {
    // Sin db real, la query lanza error → catch → FAIL_OPEN.
    // Comportamiento por diseño: nunca bloquear a un user por fallo de infra.
    const r = await service.getDailyLimitStatus('user-123');
    expect(r.allowed).toBe(true);
    expect(r.isPremium).toBe(false);
  });
});

describe('DailyLimitService.checkDeviceDailyUsage', () => {
  let service: DailyLimitService;

  beforeEach(() => {
    service = new DailyLimitService(undefined as never);
  });

  it('deviceId null → null', async () => {
    expect(await service.checkDeviceDailyUsage(null)).toBeNull();
  });

  it('BD inaccesible (test sin db) → null (fail-open)', async () => {
    // Sin db real, la query lanza error → catch → null.
    // Devuelve null para que el caller no aplique el límite por device.
    const r = await service.checkDeviceDailyUsage('device-xyz');
    expect(r).toBeNull();
  });
});

describe('DailyLimitService.invalidateStatusPremiumCache', () => {
  let service: DailyLimitService;

  beforeEach(() => {
    service = new DailyLimitService(undefined as never);
  });

  it('idempotente con user inexistente', () => {
    expect(() => service.invalidateStatusPremiumCache('any')).not.toThrow();
  });
});
