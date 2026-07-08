import { AdvanceEstadoService } from './advance-estado.service';

// deriveEstado es el CORE: deriva el estado mínimo desde las fechas (SSOT del
// estado = fechas verificadas, no señal). Estos tests bloquean la lógica.
describe('AdvanceEstadoService.deriveEstado', () => {
  // deriveEstado no usa `db` → dummy en el constructor.
  const svc = new AdvanceEstadoService(null as never);
  const HOY = '2026-07-08';
  type Fechas = Parameters<AdvanceEstadoService['deriveEstado']>[1];
  const f = (o: Partial<Fechas>): Fechas =>
    ({
      inscriptionStart: null,
      inscriptionDeadline: null,
      examDate: null,
      examDateApproximate: null,
      ...o,
    }) as Fechas;

  it('inscripción en curso (start ≤ hoy ≤ deadline) → inscripcion_abierta', () => {
    expect(
      svc.deriveEstado(HOY, f({ inscriptionStart: '2026-07-01', inscriptionDeadline: '2026-07-20' })),
    ).toBe('inscripcion_abierta');
  });

  it('hoy < start → convocada', () => {
    expect(
      svc.deriveEstado(HOY, f({ inscriptionStart: '2026-08-01', inscriptionDeadline: '2026-08-20' })),
    ).toBe('convocada');
  });

  it('hoy > deadline → inscripcion_cerrada', () => {
    expect(
      svc.deriveEstado(HOY, f({ inscriptionStart: '2026-06-01', inscriptionDeadline: '2026-06-20' })),
    ).toBe('inscripcion_cerrada');
  });

  it('examen pasado FIRME → examen_realizado', () => {
    expect(svc.deriveEstado(HOY, f({ examDate: '2026-06-01', examDateApproximate: false }))).toBe(
      'examen_realizado',
    );
  });

  it('examen pasado APROXIMADO → NO afirma examen_realizado (null)', () => {
    expect(svc.deriveEstado(HOY, f({ examDate: '2026-06-01', examDateApproximate: true }))).toBeNull();
  });

  it('inscripción abierta + examen FUTURO → inscripcion_abierta (el examen no cuenta aún)', () => {
    expect(
      svc.deriveEstado(
        HOY,
        f({ inscriptionStart: '2026-07-01', inscriptionDeadline: '2026-07-20', examDate: '2026-11-01', examDateApproximate: false }),
      ),
    ).toBe('inscripcion_abierta');
  });

  it('sin fechas → null (no hay evidencia)', () => {
    expect(svc.deriveEstado(HOY, f({}))).toBeNull();
  });
});
