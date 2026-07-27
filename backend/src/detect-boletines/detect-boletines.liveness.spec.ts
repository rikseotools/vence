// backend/src/detect-boletines/detect-boletines.liveness.spec.ts
//
// Liveness POR BOLETÍN del cron legacy (T-187, 27/07/2026).
//
// El fallo que fija esto: `detect-boletines` escanea 18 boletines y solo publicaba un AGREGADO
// (`{boletines:18, signals:10, errors:0}`). Como los adapters **fallan en abierto por día**
// (`catch` → `continue`), un boletín que dejara de devolver contenido NO sumaba a `errors`: daba 0
// candidatos y el agregado seguía diciendo `success`. Medido ese día: `radar_adapter_runs` tenía 4
// adapters y 17 boletines sin liveness — por eso, para saber si el DOE miraba, hubo que descargar
// el sumario a mano.
//
// Lo único con criterio aquí es CÓMO se traduce el recuento de días a un estado, así que eso se
// extrajo a una función pura y es lo que se prueba. La emisión (tabla + evento + racha degraded) ya
// la cubre `RadarTelemetry`, que se reutiliza tal cual.

import { estadoAdapter, type AdapterTally } from './detect-boletines.service';

const tally = (p: Partial<AdapterTally> = {}): AdapterTally => ({
  diasEscaneados: 0,
  diasConTexto: 0,
  diasConError: 0,
  señalesNuevas: 0,
  ultimoError: null,
  ...p,
});

describe('estadoAdapter — distinguir "no hay nada" de "está roto"', () => {
  it('failed cuando TODOS los días fallaron (la fuente está rota)', () => {
    expect(
      estadoAdapter(tally({ diasEscaneados: 4, diasConError: 4, ultimoError: 'fetch failed' })),
    ).toBe('failed');
  });

  it('ok cuando algún día trajo texto de candidatos', () => {
    expect(estadoAdapter(tally({ diasEscaneados: 4, diasConTexto: 2 }))).toBe('ok');
  });

  it('empty cuando se leyó bien y no había nada — es INFORMACIÓN, no un fallo', () => {
    // El caso normal de un sábado: el sumario existe y no trae convocatorias.
    expect(estadoAdapter(tally({ diasEscaneados: 4 }))).toBe('empty');
  });

  it('un fallo PARCIAL con hallazgos sigue siendo ok (el boletín se lee)', () => {
    const d = tally({ diasEscaneados: 4, diasConError: 1, diasConTexto: 1, ultimoError: 'timeout' })
    expect(estadoAdapter(d)).toBe('ok')
    // …y el error del día suelto no se pierde: viaja en errorMessage.
    expect(d.ultimoError).toBe('timeout')
  })

  it('un fallo PARCIAL sin hallazgos NO se disfraza de roto: queda empty', () => {
    // Importante para la precisión de la alarma: `failed` debe significar
    // "no se pudo leer", no "se leyó regular". La racha de `failed` es lo que
    // marca un proveedor como degradado.
    expect(estadoAdapter(tally({ diasEscaneados: 4, diasConError: 2 }))).toBe('empty');
  });

  it('el adapter dateless (1 solo día) también se clasifica bien', () => {
    // Los 16 boletines CCAA son `dateless`: leen el sumario vigente 1× por pasada.
    expect(estadoAdapter(tally({ diasEscaneados: 1, diasConError: 1 }))).toBe('failed');
    expect(estadoAdapter(tally({ diasEscaneados: 1, diasConTexto: 1 }))).toBe('ok');
    expect(estadoAdapter(tally({ diasEscaneados: 1 }))).toBe('empty');
  });

  it('sin días escaneados no inventa un fallo (no se llegó a mirar)', () => {
    expect(estadoAdapter(tally())).toBe('empty');
  });
});
