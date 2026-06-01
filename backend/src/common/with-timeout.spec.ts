import { isTimeoutError, TimeoutError, withTimeout } from './with-timeout';

const tick = (ms: number) => new Promise((r) => setTimeout(r, ms));

describe('withTimeout', () => {
  it('devuelve el valor si fn resuelve antes del timeout', async () => {
    await expect(withTimeout(async () => 'ok', 50, 'test')).resolves.toBe('ok');
  });

  it('propaga la rejection si fn rechaza antes del timeout', async () => {
    const boom = new Error('boom');
    await expect(
      withTimeout(() => Promise.reject(boom), 50, 'test'),
    ).rejects.toBe(boom);
  });

  it('rechaza con TimeoutError si fn no termina a tiempo', async () => {
    const p = withTimeout(() => tick(100).then(() => 'tarde'), 10, 'lento');
    await expect(p).rejects.toBeInstanceOf(TimeoutError);
    await expect(p).rejects.toMatchObject({ timeoutMs: 10 });
  });

  it('isTimeoutError distingue TimeoutError de otros errores', () => {
    expect(isTimeoutError(new TimeoutError(10))).toBe(true);
    expect(isTimeoutError(new Error('x'))).toBe(false);
    expect(isTimeoutError(null)).toBe(false);
  });

  // Candado de comportamiento (incidente 2026-06-01): cuando gana el timeout,
  // la promesa perdedora puede rechazar más tarde (ej. PostgresError
  // 'DbHandler exited' en un blip de BD). Esa rejection tardía NUNCA debe
  // escalar a unhandledRejection del proceso.
  it('la rejection tardía de la promesa perdedora NO queda unhandled', async () => {
    const unhandled: unknown[] = [];
    const onUnhandled = (reason: unknown) => unhandled.push(reason);
    process.on('unhandledRejection', onUnhandled);
    try {
      let rejectWork!: (e: unknown) => void;
      const work = new Promise<string>((_, rej) => {
        rejectWork = rej;
      });

      // El timeout (10ms) gana; el caller recibe TimeoutError.
      await expect(withTimeout(() => work, 10, 'test')).rejects.toBeInstanceOf(
        TimeoutError,
      );

      // La promesa perdedora rechaza DESPUÉS de perder la carrera.
      const lateErr = new Error('DbHandler exited (tardío)');
      rejectWork(lateErr);

      // Margen para que una rejection unhandled se manifieste.
      await tick(40);
      expect(unhandled).not.toContain(lateErr);
    } finally {
      process.off('unhandledRejection', onUnhandled);
    }
  });
});
