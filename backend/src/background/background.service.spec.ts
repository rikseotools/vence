import { BackgroundService } from './background.service';

describe('BackgroundService.runAfter', () => {
  let bg: BackgroundService;

  beforeEach(() => {
    bg = new BackgroundService();
  });

  /** Helper: espera N ticks del event loop para que setImmediate ejecute. */
  function flushImmediates(): Promise<void> {
    return new Promise((resolve) => setImmediate(resolve));
  }

  it('ejecuta el callback tras setImmediate (no bloquea sync)', async () => {
    let executed = false;
    bg.runAfter(() => {
      executed = true;
    });

    // Inmediatamente después de runAfter, el callback NO se ha ejecutado.
    expect(executed).toBe(false);

    await flushImmediates();
    expect(executed).toBe(true);
  });

  it('captura errores síncronos sin propagar', async () => {
    expect(() => {
      bg.runAfter(() => {
        throw new Error('boom sync');
      });
    }).not.toThrow();
    await flushImmediates();
    // El error fue capturado por el try/catch interno — la promesa no debe rechazar.
  });

  it('captura promesas rechazadas (async) sin crashear', async () => {
    expect(() => {
      bg.runAfter(async () => {
        throw new Error('boom async');
      });
    }).not.toThrow();
    await flushImmediates();
    // Pequeña espera adicional para que la promesa rechazada se procese.
    await new Promise((r) => setImmediate(r));
  });

  it('ejecuta callbacks async correctamente', async () => {
    let value = 0;
    bg.runAfter(async () => {
      await new Promise((r) => setImmediate(r));
      value = 42;
    });
    await flushImmediates();
    await flushImmediates();
    expect(value).toBe(42);
  });

  it('permite múltiples runAfter() encolados en mismo tick', async () => {
    const results: number[] = [];
    bg.runAfter(() => {
      results.push(1);
    });
    bg.runAfter(() => {
      results.push(2);
    });
    bg.runAfter(() => {
      results.push(3);
    });

    expect(results).toEqual([]);
    await flushImmediates();
    expect(results).toEqual([1, 2, 3]);
  });

  it('label opcional aparece en log si hay error (smoke)', async () => {
    // No assertion explícita — solo verifica que el label opcional NO crashea.
    expect(() => {
      bg.runAfter(() => {
        throw new Error('boom');
      }, 'mi-label-custom');
    }).not.toThrow();
    await flushImmediates();
  });
});
