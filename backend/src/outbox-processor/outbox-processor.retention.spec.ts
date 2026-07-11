// Guardarrail del incidente 11/07: el outbox acumulaba filas ya procesadas SIN
// LÍMITE (74.540 filas / 1,68 GB) y getStats agregaba con FILTER sobre TODA la tabla
// → seq-scan → timeout en frío (cada 10s) → el cron se marcaba fallido y alertaba.
// Fix: (a) retención acotada (pruneProcessed) que borra procesadas antiguas en lotes,
// (b) getStats index-friendly (cada agregado usa el índice parcial WHERE processed_at
// IS NULL). Este test verifica por fuente que ambos siguen presentes.
import { readFileSync } from 'fs';
import { join } from 'path';

const svc = readFileSync(join(__dirname, 'outbox-processor.service.ts'), 'utf-8');
const cron = readFileSync(join(__dirname, 'outbox-processor.cron.ts'), 'utf-8');

describe('outbox-processor — retención + métricas index-friendly (incidente 11/07)', () => {
  it('getStats NO usa un agregado FILTER sobre toda la tabla (evita seq-scan)', () => {
    // La versión rota era: SELECT COUNT(*) FILTER (...) ... FROM test_questions_outbox
    // (sin WHERE processed_at IS NULL). Debe haber DOS consultas acotadas por índice parcial.
    expect(svc).toMatch(/WHERE processed_at IS NULL AND retry_count < \$\{this\.config\.maxRetries\}/);
    expect(svc).toMatch(/WHERE processed_at IS NULL AND retry_count >= \$\{this\.config\.maxRetries\}/);
  });

  it('existe la retención acotada pruneProcessed (borra procesadas antiguas en lotes)', () => {
    expect(svc).toMatch(/async pruneProcessed\(\)/);
    expect(svc).toMatch(/DELETE FROM public\.test_questions_outbox/);
    expect(svc).toMatch(/processed_at IS NOT NULL/);
    expect(svc).toMatch(/RETENTION_DAYS/);
    expect(svc).toMatch(/LIMIT \$\{OutboxProcessorService\.PRUNE_BATCH\}/);
  });

  it('el cron invoca la poda periódicamente y best-effort (no rompe el tick)', () => {
    expect(cron).toMatch(/pruneProcessed\(\)/);
    // La llamada a la poda debe ir en su propio try/catch.
    expect(cron).toMatch(/pruneProcessed[\s\S]{0,200}catch/);
  });
});
