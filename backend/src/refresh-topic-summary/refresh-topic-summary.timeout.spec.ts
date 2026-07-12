// Guardarrail (incidente 12/07): refresh_topic_question_summary() hace REFRESH
// MATERIALIZED VIEW CONCURRENTLY ×2 y tarda 12-44s+, por encima del statement_timeout
// de 30s del pool → el cron se marcaba fallido de madrugada. Fix: conexión RESERVADA
// dedicada con statement_timeout propio (180s), restaurado a 30s al soltarla. Probado
// a ciencia cierta (completó en 35s bajo un pool a 30s). Este test verifica por fuente
// que el blindaje sigue presente. Detalle: docs/runbooks/materialization-health.md.
import { readFileSync } from 'fs';
import { join } from 'path';

const src = readFileSync(
  join(__dirname, 'refresh-topic-summary.service.ts'),
  'utf-8',
);

describe('refresh-topic-summary — statement_timeout en conexión reservada (incidente 12/07)', () => {
  it('usa una conexión RESERVADA (no el pool compartido con 30s)', () => {
    expect(src).toMatch(/\$client/);
    expect(src).toMatch(/\.reserve\(\)/);
    expect(src).toMatch(/conn\.release\(\)/);
  });

  it('le da un statement_timeout amplio a la conexión reservada', () => {
    expect(src).toMatch(/SET statement_timeout = '180000'/);
  });

  it('restaura el timeout del pool (30s) al soltar — sin fuga', () => {
    // Debe RESTAURAR explícito los 30s (no `RESET`, que puede dejar la conexión sin
    // límite al reusarse). Restaurar + reservar-timeout deben coexistir en el fichero.
    expect(src).toMatch(/SET statement_timeout = '30000'/);
    expect(src).not.toMatch(/RESET statement_timeout/);
  });
});
