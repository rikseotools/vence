import { necesitaLlm } from './detect-oep-llm.service';

/**
 * Embudo determinista de `detect-oep-llm` (T-166).
 *
 * Réplica del núcleo puro `lib/oep/llmInputHash.cjs` (`necesitaLlm`), testeado por
 * separado en `__tests__/lib/oep/llmInputHash.test.js` — el backend no puede
 * importar `lib/` (proyecto NestJS aparte, build separado). Estos tests protegen
 * la MISMA decisión de diseño en el lado que de verdad manda el gasto: el @Cron.
 */
describe('necesitaLlm — embudo determinista de detect-oep-llm (T-166)', () => {
  it('sin hash previo SIEMPRE llama: nunca se descarta a ciegas', () => {
    const r = necesitaLlm('abc123', null);
    expect(r.necesita).toBe(true);
    expect(r.motivo).toBe('sin_hash_previo');
  });

  it('con hash distinto llama', () => {
    const r = necesitaLlm('nuevo-hash', 'hash-anterior');
    expect(r.necesita).toBe(true);
    expect(r.motivo).toBe('cambio');
  });

  it('solo se salta la llamada con igualdad EXACTA', () => {
    const r = necesitaLlm('mismo-hash', 'mismo-hash');
    expect(r.necesita).toBe(false);
    expect(r.motivo).toBe('sin_cambios');
  });

  it('una cadena vacía como hash previo cuenta como "sin hash previo" (nunca visto)', () => {
    const r = necesitaLlm('abc123', '');
    expect(r.necesita).toBe(true);
    expect(r.motivo).toBe('sin_hash_previo');
  });
});
