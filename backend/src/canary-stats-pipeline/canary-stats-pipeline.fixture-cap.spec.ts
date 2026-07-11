// Guardarrail del incidente 11/07: canary-stats-pipeline escribe 1 fila real por
// pasada en test_questions y NO limpiaba → acumuló 10.737 filas → su drift-query se
// ahogó (13,6s → statement_timeout → cron falla → alertas). El fix es auto-acotado
// (cap + prune). Este test verifica por fuente que ese blindaje sigue presente; si
// alguien lo quita, falla el build. Detalle: docs/roadmap/canary-framework.md.
import { readFileSync } from 'fs';
import { join } from 'path';

const src = readFileSync(
  join(__dirname, 'canary-stats-pipeline.service.ts'),
  'utf-8',
);

describe('canary-stats-pipeline — fixture acotado (incidente 11/07)', () => {
  it('define una cota del fixture (SMOKE_FIXTURE_CAP)', () => {
    expect(src).toMatch(/SMOKE_FIXTURE_CAP\s*=\s*\d+/);
  });

  it('pruna el fixture al inicio de cada pasada (antes de leer el estado)', () => {
    expect(src).toMatch(/pruneFixtureIfNeeded/);
    // La llamada al prune debe ir ANTES del readState (si no, el readState lento corre igual).
    const pruneCall = src.indexOf('await this.pruneFixtureIfNeeded');
    const readState = src.indexOf('await this.readState');
    expect(pruneCall).toBeGreaterThan(-1);
    expect(readState).toBeGreaterThan(-1);
    expect(pruneCall).toBeLessThan(readState);
  });

  it('el prune borra test_questions y resetea el contador materializado (baseline coherente)', () => {
    expect(src).toMatch(/DELETE FROM test_questions/);
    expect(src).toMatch(/UPDATE user_question_history_v2 SET total_attempts = 0/);
  });

  it('el prune es best-effort (no rompe la pasada si falla)', () => {
    expect(src).toMatch(/pruneFixtureIfNeeded[\s\S]{0,900}catch/);
  });
});
