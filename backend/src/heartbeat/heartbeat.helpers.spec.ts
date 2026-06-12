import {
  CronTickOpts,
  getLastTickMsAgo,
  runWithHeartbeat,
} from './heartbeat.helpers';

describe('runWithHeartbeat', () => {
  it('marca el tick tras completar con éxito', async () => {
    const host: { lastTickAtMs: number | null } = { lastTickAtMs: null };
    await runWithHeartbeat(host, 'lastTickAtMs', async () => {});
    expect(host.lastTickAtMs).not.toBeNull();
  });

  it('marca el tick AUNQUE el work lance, y propaga la excepción', async () => {
    const host: { lastTickAtMs: number | null } = { lastTickAtMs: null };
    await expect(
      runWithHeartbeat(host, 'lastTickAtMs', async () => {
        throw new Error('boom');
      }),
    ).rejects.toThrow('boom');
    // El heartbeat se marca en el finally — distinguir "vivo con errores"
    // de "muerto silencioso".
    expect(host.lastTickAtMs).not.toBeNull();
  });

  describe('señal de arranque cron_tick (opts)', () => {
    const makeSink = () => {
      const calls: unknown[] = [];
      return {
        calls,
        sink: {
          emitFireAndForget: (e: unknown) => calls.push(e),
        } as CronTickOpts['observability'],
      };
    };

    it('emite cron_tick al ARRANCAR cuando se pasan opts', async () => {
      const { calls, sink } = makeSink();
      const host: { lastTickAtMs: number | null } = { lastTickAtMs: null };
      const order: string[] = [];
      await runWithHeartbeat(
        host,
        'lastTickAtMs',
        async () => {
          order.push('work');
        },
        { name: 'detect-oep-llm', observability: sink },
      );
      expect(calls).toHaveLength(1);
      expect(calls[0]).toMatchObject({
        source: 'fargate',
        severity: 'debug',
        eventType: 'cron_tick',
        endpoint: 'detect-oep-llm',
        metadata: { phase: 'start' },
      });
    });

    it('emite el tick ANTES de ejecutar el work', async () => {
      const order: string[] = [];
      const sink = {
        emitFireAndForget: () => order.push('tick'),
      } as CronTickOpts['observability'];
      const host: { lastTickAtMs: number | null } = { lastTickAtMs: null };
      await runWithHeartbeat(
        host,
        'lastTickAtMs',
        async () => {
          order.push('work');
        },
        { name: 'x', observability: sink },
      );
      expect(order).toEqual(['tick', 'work']);
    });

    it('emite el tick aunque el work falle luego (liveness ≠ éxito)', async () => {
      const { calls, sink } = makeSink();
      const host: { lastTickAtMs: number | null } = { lastTickAtMs: null };
      await expect(
        runWithHeartbeat(
          host,
          'lastTickAtMs',
          async () => {
            throw new Error('boom');
          },
          { name: 'x', observability: sink },
        ),
      ).rejects.toThrow('boom');
      expect(calls).toHaveLength(1);
    });

    it('NO emite nada cuando se omiten opts (backward-compatible)', async () => {
      const host: { lastTickAtMs: number | null } = { lastTickAtMs: null };
      // Sin opts: comportamiento idéntico al previo, sin emisión.
      await runWithHeartbeat(host, 'lastTickAtMs', async () => {});
      expect(host.lastTickAtMs).not.toBeNull();
    });
  });
});

describe('getLastTickMsAgo', () => {
  it('null si nunca tickeó', () => {
    expect(getLastTickMsAgo({ lastTickAtMs: null }, 'lastTickAtMs')).toBeNull();
  });

  it('devuelve ms desde el último tick', () => {
    const ago = getLastTickMsAgo(
      { lastTickAtMs: Date.now() - 1000 },
      'lastTickAtMs',
    );
    expect(ago).toBeGreaterThanOrEqual(1000);
  });
});
