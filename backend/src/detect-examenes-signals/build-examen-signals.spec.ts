import {
  buildExamenSignals,
  type ExamenNotaCandidate,
} from './build-examen-signals';

function nota(over: Partial<ExamenNotaCandidate>): ExamenNotaCandidate {
  return {
    notaId: 'n1',
    oposicionId: 'opo-1',
    slug: 'una-oposicion',
    url: 'https://example.org/doc.pdf',
    fechaRaw: '2026-07-04',
    examDateActual: null,
    citas: null,
    ...over,
  };
}

const OPTS = { minYear: 2025 };

describe('buildExamenSignals', () => {
  it('emite una señal nota_examen bien formada para una fecha válida sin capturar', () => {
    const [sig, ...rest] = buildExamenSignals([nota({})], OPTS);
    expect(rest).toHaveLength(0);
    expect(sig).toMatchObject({
      oposicionId: 'opo-1',
      sensorType: 'nota_examen',
      detectedFechaExamen: '2026-07-04',
      isNovel: false,
      confidenceScore: 60,
      dedupeKey: 'nota_examen:opo-1:2026-07-04',
      sourceUrl: 'https://example.org/doc.pdf',
    });
    expect(sig.signalSummary).toContain('2026-07-04');
    // Provenance en rawExtraction.
    expect(sig.rawExtraction).toMatchObject({ notaId: 'n1', slug: 'una-oposicion' });
  });

  it('NO fija detectedYear ni detectedEstado (evita que el apply cree un ciclo nuevo)', () => {
    const [sig] = buildExamenSignals(
      [nota({ fechaRaw: '2027-01-31' })],
      OPTS,
    );
    expect(sig.detectedYear ?? null).toBeNull();
    expect(sig.detectedEstado ?? null).toBeNull();
    expect(sig.detectedFechaExamen).toBe('2027-01-31');
  });

  it('descarta fechas ambiguas (rango, varias, mes-solo, array)', () => {
    const rows = [
      nota({ notaId: 'a', fechaRaw: '19-21 de junio de 2026' }),
      nota({ notaId: 'b', fechaRaw: '14 de mayo de 2026 y 15 de marzo de 2026' }),
      nota({ notaId: 'c', fechaRaw: 'Octubre 2025' }),
      nota({ notaId: 'd', fechaRaw: '["14/07/2026", "15/07/2026"]' }),
    ];
    expect(buildExamenSignals(rows, OPTS)).toHaveLength(0);
  });

  it('descarta fechas de años anteriores al suelo (docs viejos: 15/05/2010)', () => {
    expect(
      buildExamenSignals([nota({ fechaRaw: '15/05/2010' })], OPTS),
    ).toHaveLength(0);
  });

  it('descarta si la fecha ya está capturada en convocatorias.exam_date', () => {
    const rows = [
      nota({ fechaRaw: '2026-07-04', examDateActual: '2026-07-04' }),
    ];
    expect(buildExamenSignals(rows, OPTS)).toHaveLength(0);
  });

  it('emite si la fecha difiere de la exam_date actual (fecha nueva)', () => {
    const rows = [
      nota({ fechaRaw: '2026-09-12', examDateActual: '2026-05-01' }),
    ];
    const out = buildExamenSignals(rows, OPTS);
    expect(out).toHaveLength(1);
    expect(out[0].detectedFechaExamen).toBe('2026-09-12');
  });

  it('tolera exam_date con hora (timestamp) comparando solo el día', () => {
    const rows = [
      nota({ fechaRaw: '2026-07-04', examDateActual: '2026-07-04T00:00:00.000Z' }),
    ];
    expect(buildExamenSignals(rows, OPTS)).toHaveLength(0);
  });

  it('deduplica la misma (oposición, fecha) que aparece en varios PDFs', () => {
    const rows = [
      nota({ notaId: 'p1', url: 'https://x/a.pdf', fechaRaw: '2026-07-04' }),
      nota({ notaId: 'p2', url: 'https://x/b.pdf', fechaRaw: '4 de julio de 2026' }),
    ];
    const out = buildExamenSignals(rows, OPTS);
    expect(out).toHaveLength(1);
  });

  it('NO deduplica fechas distintas ni oposiciones distintas', () => {
    const rows = [
      nota({ oposicionId: 'opo-1', fechaRaw: '2026-07-04' }),
      nota({ oposicionId: 'opo-1', fechaRaw: '2026-09-12' }),
      nota({ oposicionId: 'opo-2', fechaRaw: '2026-07-04' }),
    ];
    expect(buildExamenSignals(rows, OPTS)).toHaveLength(3);
  });
});
