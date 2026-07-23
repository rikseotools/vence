import { CanaryPdfQueueService } from './canary-pdf-queue.service';

/** Construye el servicio con un db.execute que devuelve la fila agregada dada. */
function svc(row: Record<string, unknown>) {
  const db = { execute: async () => [row] } as any;
  return new CanaryPdfQueueService(db);
}

describe('CanaryPdfQueueService — invariante de la cola de PDFs', () => {
  it('ok cuando la cola está sana (0 pending/dlq/stale)', async () => {
    const r = await svc({ pending: 0, dlq: 0, stale_running: 0, oldest_pending_sec: 0 }).execute();
    expect(r.status).toBe('ok');
    expect(r.metadata).toMatchObject({ pending: 0, dlq: 0, staleRunning: 0 });
  });

  it('failed cuando hay jobs en DLQ (failed > 0)', async () => {
    const r = await svc({ pending: 0, dlq: 3, stale_running: 0, oldest_pending_sec: 0 }).execute();
    expect(r.status).toBe('failed');
    expect(r.errorMessage).toContain('DLQ');
    expect(r.metadata).toMatchObject({ dlq: 3 });
  });

  it('failed cuando hay un running colgado (worker muerto a media renderización)', async () => {
    const r = await svc({ pending: 1, dlq: 0, stale_running: 2, oldest_pending_sec: 60 }).execute();
    expect(r.status).toBe('failed');
    expect(r.errorMessage).toContain('running');
  });

  it('failed cuando el backlog está estancado (pending más viejo que 2h)', async () => {
    const r = await svc({ pending: 5, dlq: 0, stale_running: 0, oldest_pending_sec: 9000 }).execute();
    expect(r.status).toBe('failed');
    expect(r.errorMessage).toContain('backlog');
  });

  it('ok cuando hay pending pero reciente (dentro de la ventana de 2h)', async () => {
    // El worker acaba de recibir trabajo; NO es un fallo mientras drene a tiempo.
    const r = await svc({ pending: 5, dlq: 0, stale_running: 0, oldest_pending_sec: 600 }).execute();
    expect(r.status).toBe('ok');
    expect(r.metadata).toMatchObject({ pending: 5 });
  });
});
