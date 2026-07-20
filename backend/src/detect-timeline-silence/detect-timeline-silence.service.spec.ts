import { DetectTimelineSilenceService } from './detect-timeline-silence.service';

// El 2º modo del sensor ("timeline agotado") nace de un punto ciego medido el 20/07/2026:
// `findTimelineSilences` exige un hito `current` vencido, y 90 de 118 oposiciones activas (76%)
// no tenían NINGÚN hito `current` — el estado natural de un timeline al día es todo `completed`.
// Resultado: nadie iba a enterarse de que la ULE publicara la fecha de examen de una oposición
// con el contenido ya listo. Estos tests fijan las 4 decisiones que hacen que el modo sea útil
// en vez de ruidoso, porque las 4 son fáciles de romper sin darse cuenta.

type Candidato = {
  oposicionId: string;
  oposicionNombre: string;
  oposicionSlug: string | null;
  hitoId: string;
  hitoTitulo: string;
  hitoFecha: string;
  diasRetraso: number;
};

const cand = (over: Partial<Candidato> = {}): Candidato => ({
  oposicionId: 'op-1',
  oposicionNombre: 'Administrativo Univ. de León',
  oposicionSlug: 'administrativo-universidad-leon',
  hitoId: 'h-1',
  hitoTitulo: 'Cierre de inscripción',
  hitoFecha: '2026-07-13',
  diasRetraso: 30,
  ...over,
});

function makeSvc(current: Candidato[], exhausted: Candidato[]) {
  const insertados: Array<{ summary: string; score: number }> = [];
  const queries = {
    findTimelineSilences: jest.fn().mockResolvedValue(current),
    findExhaustedTimelines: jest.fn().mockResolvedValue(exhausted),
    countAbandonedTimelines: jest.fn().mockResolvedValue(0),
    insertSignal: jest.fn().mockImplementation((input: Record<string, unknown>) => {
      insertados.push({
        summary: String(input.signalSummary),
        score: Number(input.confidenceScore),
      });
      return Promise.resolve({ inserted: true, id: 'sig-1' });
    }),
  };
  const svc = new DetectTimelineSilenceService(queries as never);
  return { svc, queries, insertados };
}

describe('DetectTimelineSilenceService — 2º modo: timeline agotado', () => {
  const ENV = process.env.TIMELINE_EXHAUSTED_ENABLED;
  afterEach(() => {
    if (ENV === undefined) delete process.env.TIMELINE_EXHAUSTED_ENABLED;
    else process.env.TIMELINE_EXHAUSTED_ENABLED = ENV;
    jest.clearAllMocks();
  });

  it('APAGADO por defecto: no consulta siquiera los timelines agotados', async () => {
    // Encenderlo de golpe volcaría las 47 que ya cumplían la condición el día que se escribió.
    // Una bandeja que grita se aprende a ignorar: así murió `hash_change` (4% de acierto).
    delete process.env.TIMELINE_EXHAUSTED_ENABLED;
    const { svc, queries, insertados } = makeSvc([], [cand()]);
    await svc.run();
    expect(queries.findExhaustedTimelines).not.toHaveBeenCalled();
    expect(insertados).toHaveLength(0);
  });

  it('encendido con el flag, emite señal para el timeline agotado', async () => {
    process.env.TIMELINE_EXHAUSTED_ENABLED = 'true';
    const { svc, insertados } = makeSvc([], [cand()]);
    await svc.run();
    expect(insertados).toHaveLength(1);
  });

  it('NO dice "retraso" en modo agotado: no se ha incumplido ninguna fecha anunciada', async () => {
    // En `current` sí hay incumplimiento; aquí solo hay silencio. Llamarlo "retraso" mandaría
    // al admin a buscar un incumplimiento que no existe.
    process.env.TIMELINE_EXHAUSTED_ENABLED = 'true';
    const { svc, insertados } = makeSvc([], [cand()]);
    await svc.run();
    expect(insertados[0].summary).not.toMatch(/retraso/i);
    expect(insertados[0].summary).toMatch(/sin fecha de examen/i);
  });

  it('el modo `current` conserva su texto de retraso', async () => {
    process.env.TIMELINE_EXHAUSTED_ENABLED = 'true';
    const { svc, insertados } = makeSvc([cand({ diasRetraso: 5 })], []);
    await svc.run();
    expect(insertados[0].summary).toMatch(/retraso/i);
  });

  it('la urgencia del modo agotado NO satura: 3 semanas pesa menos que 6 meses', async () => {
    // Con la fórmula del modo `current` (diasRetraso * 2) TODAS saturarían el bonus, porque
    // solo entran a partir de 21 días — priorizar 47 señales idénticas es no priorizar.
    process.env.TIMELINE_EXHAUSTED_ENABLED = 'true';
    const corta = makeSvc([], [cand({ diasRetraso: 22 })]);
    await corta.svc.run();
    const larga = makeSvc([], [cand({ diasRetraso: 200 })]);
    await larga.svc.run();
    expect(larga.insertados[0].score).toBeGreaterThan(corta.insertados[0].score);
  });

  it('no emite dos señales del mismo hito si sale por los dos modos', async () => {
    process.env.TIMELINE_EXHAUSTED_ENABLED = 'true';
    const mismo = cand({ hitoId: 'h-dup' });
    const { svc, insertados } = makeSvc([mismo], [mismo]);
    await svc.run();
    expect(insertados).toHaveLength(1);
  });
});
