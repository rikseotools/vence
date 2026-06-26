import { classifyInscriptionFreshness } from './inscription-reconcile';

describe('classifyInscriptionFreshness', () => {
  it('irrelevant cuando la señal no trae fecha usable', () => {
    expect(classifyInscriptionFreshness('2026-07-13', null).verdict).toBe('irrelevant');
    expect(classifyInscriptionFreshness(null, 'no-es-fecha').verdict).toBe('irrelevant');
    expect(classifyInscriptionFreshness(null, null).actionable).toBe(false);
  });

  it('consistent cuando catálogo y señal coinciden (caso La Rioja / IIPP)', () => {
    const r = classifyInscriptionFreshness('2026-07-08', '2026-07-08');
    expect(r.verdict).toBe('consistent');
    expect(r.actionable).toBe(false);
  });

  it('tolera timestamp completo en el lado del catálogo', () => {
    expect(
      classifyInscriptionFreshness('2026-07-16T00:00:00.000Z', '2026-07-16').verdict,
    ).toBe('consistent');
  });

  it('gap cuando el catálogo no tiene fecha (caso ULE C1 pre-fix)', () => {
    const r = classifyInscriptionFreshness(null, '2026-07-13');
    expect(r.verdict).toBe('gap');
    expect(r.actionable).toBe(true);
    expect(r.note).toContain('2026-07-13');
  });

  it('conflict cuando el catálogo tiene fecha distinta (caso Canarias: ATC ≠ cuerpo general)', () => {
    const r = classifyInscriptionFreshness('2026-04-23', '2026-07-27');
    expect(r.verdict).toBe('conflict');
    expect(r.actionable).toBe(true);
    expect(r.note).toContain('2026-04-23');
    expect(r.note).toContain('2026-07-27');
  });

  it('conflict también si la fecha del catálogo es futura pero distinta', () => {
    expect(classifyInscriptionFreshness('2026-08-01', '2026-07-13').verdict).toBe('conflict');
  });
});
