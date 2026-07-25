import {
  decideReanalisis,
  llmCacheTtlDays,
  LLM_CACHE_BASE_DAYS,
  LLM_CACHE_JITTER_DAYS,
  type NotaCacheada,
} from './notas-cache';

const AHORA = new Date('2026-07-25T09:30:00Z');
const OPO = '11111111-1111-1111-1111-111111111111';

function cacheada(over: Partial<NotaCacheada> = {}): NotaCacheada {
  return {
    url: 'https://x.es/nota.pdf',
    contentHash: 'h1',
    llmExtraction: { fecha_examen: '2026-09-12', confianza: 'alta' },
    confianza: 'alta',
    llmAnalyzedAt: '2026-07-24T09:30:00Z',
    ...over,
  };
}

describe('llmCacheTtlDays', () => {
  it('es determinista y cae en la banda escalonada', () => {
    const ttl = llmCacheTtlDays(OPO);
    expect(ttl).toBe(llmCacheTtlDays(OPO));
    expect(ttl).toBeGreaterThanOrEqual(LLM_CACHE_BASE_DAYS);
    expect(ttl).toBeLessThan(LLM_CACHE_BASE_DAYS + LLM_CACHE_JITTER_DAYS);
  });

  it('reparte las caducidades: distintas oposiciones no caducan todas el mismo día', () => {
    const ids = Array.from({ length: 200 }, (_, i) => `opo-${i}`);
    const distintos = new Set(ids.map(llmCacheTtlDays));
    expect(distintos.size).toBe(LLM_CACHE_JITTER_DAYS);
  });
});

describe('decideReanalisis', () => {
  it('reutiliza cuando ninguna nota ha cambiado y el análisis es reciente', () => {
    const d = decideReanalisis(
      OPO,
      [{ url: 'https://x.es/nota.pdf', hash: 'h1' }],
      [cacheada()],
      AHORA,
    );
    expect(d.reuse).toBe(true);
    if (d.reuse) {
      expect(d.llmExtraction).toEqual({
        fecha_examen: '2026-09-12',
        confianza: 'alta',
      });
      expect(d.confianza).toBe('alta');
    }
  });

  it('re-analiza si una nota cambió de contenido (mismo url, otro hash)', () => {
    const d = decideReanalisis(
      OPO,
      [{ url: 'https://x.es/nota.pdf', hash: 'h2' }],
      [cacheada()],
      AHORA,
    );
    expect(d).toEqual({ reuse: false, motivo: 'doc_nuevo_o_cambiado' });
  });

  it('re-analiza si aparece un documento nuevo', () => {
    const d = decideReanalisis(
      OPO,
      [
        { url: 'https://x.es/nota.pdf', hash: 'h1' },
        { url: 'https://x.es/anexo.pdf', hash: 'h9' },
      ],
      [cacheada()],
      AHORA,
    );
    expect(d).toEqual({ reuse: false, motivo: 'doc_nuevo_o_cambiado' });
  });

  it('NO re-analiza porque un documento haya desaparecido (la caché cubre un superconjunto)', () => {
    const d = decideReanalisis(
      OPO,
      [{ url: 'https://x.es/nota.pdf', hash: 'h1' }],
      [
        cacheada(),
        cacheada({ url: 'https://x.es/viejo.pdf', contentHash: 'h7' }),
      ],
      AHORA,
    );
    expect(d.reuse).toBe(true);
  });

  it('re-analiza si no hay caché (oposición nueva)', () => {
    const d = decideReanalisis(
      OPO,
      [{ url: 'https://x.es/nota.pdf', hash: 'h1' }],
      [],
      AHORA,
    );
    expect(d).toEqual({ reuse: false, motivo: 'sin_cache' });
  });

  it('re-analiza si la fila existe pero nunca hubo extracción (LLM falló ese día)', () => {
    const d = decideReanalisis(
      OPO,
      [{ url: 'https://x.es/nota.pdf', hash: 'h1' }],
      [cacheada({ llmExtraction: null })],
      AHORA,
    );
    expect(d).toEqual({ reuse: false, motivo: 'sin_extraccion' });
  });

  it('re-analiza si el sello de análisis falta (filas anteriores a la migración)', () => {
    const d = decideReanalisis(
      OPO,
      [{ url: 'https://x.es/nota.pdf', hash: 'h1' }],
      [cacheada({ llmAnalyzedAt: null })],
      AHORA,
    );
    expect(d).toEqual({ reuse: false, motivo: 'caducada' });
  });

  it('re-analiza cuando vence el TTL aunque nada haya cambiado', () => {
    const ttl = llmCacheTtlDays(OPO);
    const viejo = new Date(
      AHORA.getTime() - (ttl + 1) * 86_400_000,
    ).toISOString();
    const d = decideReanalisis(
      OPO,
      [{ url: 'https://x.es/nota.pdf', hash: 'h1' }],
      [cacheada({ llmAnalyzedAt: viejo })],
      AHORA,
    );
    expect(d).toEqual({ reuse: false, motivo: 'caducada' });
  });

  it('la edad la marca la nota analizada hace más tiempo, no la más reciente', () => {
    const ttl = llmCacheTtlDays(OPO);
    const viejo = new Date(
      AHORA.getTime() - (ttl + 1) * 86_400_000,
    ).toISOString();
    const d = decideReanalisis(
      OPO,
      [
        { url: 'https://x.es/nota.pdf', hash: 'h1' },
        { url: 'https://x.es/otra.pdf', hash: 'h2' },
      ],
      [
        cacheada(),
        cacheada({
          url: 'https://x.es/otra.pdf',
          contentHash: 'h2',
          llmAnalyzedAt: viejo,
        }),
      ],
      AHORA,
    );
    expect(d).toEqual({ reuse: false, motivo: 'caducada' });
  });

  it('sin notas no decide nada (el sensor sale antes)', () => {
    expect(decideReanalisis(OPO, [], [cacheada()], AHORA)).toEqual({
      reuse: false,
      motivo: 'sin_notas',
    });
  });

  it('acepta Date además de string en el sello', () => {
    const d = decideReanalisis(
      OPO,
      [{ url: 'https://x.es/nota.pdf', hash: 'h1' }],
      [cacheada({ llmAnalyzedAt: new Date('2026-07-24T09:30:00Z') })],
      AHORA,
    );
    expect(d.reuse).toBe(true);
  });
});
