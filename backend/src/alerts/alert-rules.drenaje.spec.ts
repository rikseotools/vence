/**
 * `drenaje_atrasado` — la regla que impide que un drenador vuelva a fallar callado. (T-613)
 *
 * Lo que se fija aquí no es «detecta backlog», es la distinción que faltaba:
 * **«éxito con 0 procesadas» ≠ «no había nada que hacer»**. Sin ese par
 * (procesadas + pendientes) el sistema estuvo semanas en verde.
 */
import {
  ATRASO_TOPE_ALERTA,
  RULE_DRENAJE_ATRASADO,
  diagnosticarDrenaje,
  type DrenajeRun,
} from './alert-rules';
import { ATRASO_TOPE as TOPE_TELEMETRIA } from '../telemetry-retention/telemetry-retention.service';
import { ATRASO_TOPE as TOPE_ARCHIVO } from '../archive-interactions/archive-interactions.service';

const T0 = new Date('2026-08-06T04:10:00Z');
const dia = (n: number) => new Date(T0.getTime() - n * 24 * 3600 * 1000);

function run(p: Partial<DrenajeRun> & { endpoint: string }): DrenajeRun {
  return {
    ts: T0,
    procesadas: 0,
    remaining: {},
    ...p,
  };
}

describe('diagnosticarDrenaje (T-613)', () => {
  it('EL CASO REAL: «éxito» con 0 procesadas y 2,7 M pendientes → no_drena', () => {
    const d = diagnosticarDrenaje([
      run({
        endpoint: 'telemetry-retention',
        procesadas: 0,
        remaining: { observable_events: 200_000, validation_error_logs: 0 },
      }),
    ]);
    expect(d).toHaveLength(1);
    expect(d[0].motivo).toBe('no_drena');
    expect(d[0].tabla).toBe('observable_events');
  });

  it('0 procesadas y 0 pendientes es lo NORMAL: no dispara', () => {
    // Esta es la mitad que faltaba. Sin `remaining`, este caso y el anterior son
    // el mismo evento — y por eso nadie vio nada durante semanas.
    expect(
      diagnosticarDrenaje([
        run({
          endpoint: 'telemetry-retention',
          procesadas: 0,
          remaining: { observable_events: 0 },
        }),
      ]),
    ).toEqual([]);
  });

  it('drenaje legítimo de un backlog grande (procesa y BAJA) no dispara', () => {
    const d = diagnosticarDrenaje([
      run({
        endpoint: 'telemetry-retention',
        ts: dia(0),
        procesadas: 2_500_000,
        remaining: { observable_events: 120_000 },
      }),
      run({
        endpoint: 'telemetry-retention',
        ts: dia(1),
        procesadas: 2_500_000,
        remaining: { observable_events: ATRASO_TOPE_ALERTA },
      }),
      run({
        endpoint: 'telemetry-retention',
        ts: dia(2),
        procesadas: 2_500_000,
        remaining: { observable_events: ATRASO_TOPE_ALERTA },
      }),
    ]);
    expect(d).toEqual([]);
  });

  it('procesa pero NO alcanza: 3 pasadas pegado al tope → no_alcanza', () => {
    const pegada = (n: number) =>
      run({
        endpoint: 'archive-interactions',
        ts: dia(n),
        procesadas: 200_000,
        remaining: { user_interactions: ATRASO_TOPE_ALERTA },
      });
    const d = diagnosticarDrenaje([pegada(0), pegada(1), pegada(2)]);
    expect(d).toHaveLength(1);
    expect(d[0].motivo).toBe('no_alcanza');
  });

  it('dos pasadas pegadas al tope todavía NO disparan (podría estar drenando)', () => {
    const pegada = (n: number) =>
      run({
        endpoint: 'archive-interactions',
        ts: dia(n),
        procesadas: 200_000,
        remaining: { user_interactions: ATRASO_TOPE_ALERTA },
      });
    expect(diagnosticarDrenaje([pegada(0), pegada(1)])).toEqual([]);
  });

  it('solo juzga la ÚLTIMA pasada: un fallo de anteayer ya arreglado no dispara', () => {
    const d = diagnosticarDrenaje([
      run({
        endpoint: 'telemetry-retention',
        ts: dia(2),
        procesadas: 0,
        remaining: { observable_events: 200_000 },
      }),
      run({
        endpoint: 'telemetry-retention',
        ts: dia(0),
        procesadas: 2_500_000,
        remaining: { observable_events: 0 },
      }),
    ]);
    expect(d).toEqual([]);
  });

  it('una versión ANTERIOR al deploy (sin `remaining`) NO se juzga: callar > inventar', () => {
    expect(
      diagnosticarDrenaje([
        run({ endpoint: 'telemetry-retention', procesadas: 0, remaining: {} }),
      ]),
    ).toEqual([]);
  });

  it('ordena por atraso: primero el que peor está', () => {
    const d = diagnosticarDrenaje([
      run({
        endpoint: 'telemetry-retention',
        procesadas: 0,
        remaining: { observable_events: 1_000 },
      }),
      run({
        endpoint: 'archive-interactions',
        procesadas: 0,
        remaining: { user_interactions: 200_000 },
      }),
    ]);
    expect(d.map((x) => x.endpoint)).toEqual([
      'archive-interactions',
      'telemetry-retention',
    ]);
  });
});

describe('la regla, cableada', () => {
  it('el tope de la alerta es el MISMO que el de los dos drenadores', () => {
    // Si divergen, «pegado al tope» deja de significar nada: la alerta leería un
    // número que el emisor nunca produce.
    expect(ATRASO_TOPE_ALERTA).toBe(TOPE_TELEMETRIA);
    expect(ATRASO_TOPE_ALERTA).toBe(TOPE_ARCHIVO);
  });

  it('mira los dos drenadores y solo las pasadas con éxito', () => {
    const q = JSON.stringify(RULE_DRENAJE_ATRASADO.query);
    expect(q).toContain('telemetry-retention');
    expect(q).toContain('archive-interactions');
    expect(q).toContain('remaining');
    // Un run fallido ya lo cubre `cron_sin_exito`; esta regla es para los que
    // terminan BIEN sin hacer nada.
    expect(q).toContain('success');
  });

  it('el aviso nombra el cron, la tabla y cuánto queda', () => {
    const rows = [
      run({
        endpoint: 'telemetry-retention',
        procesadas: 0,
        remaining: { observable_events: 200_000 },
      }),
    ];
    expect(RULE_DRENAJE_ATRASADO.shouldFire(rows, undefined as never)).toBe(true);
    const n = RULE_DRENAJE_ATRASADO.buildNotification(rows, undefined as never);
    expect(n.title).toContain('drenador');
    expect(n.body).toContain('telemetry-retention');
    expect(n.body).toContain('observable_events');
    expect(n.body).toContain('200.000');
  });
  // ── EL `ts` LLEGA COMO CADENA, Y ASÍ ES COMO ESTA REGLA SE PASÓ 201 EVALUACIONES SIN VIGILAR ──
  //
  // Todos los casos de arriba construyen `new Date()`, así que la suite daba verde mientras
  // producción fallaba en CADA pasada con «b.ts.getTime is not a function» — desde el 06/08 22:30,
  // justo después del deploy que estrenó la regla. El driver entrega `ts` como cadena según la
  // columna y el camino, y el tipo declaraba `Date`, así que el compilador tampoco avisaba.
  //
  // Estos dos casos son los que de verdad protegen: mismo escenario, con el `ts` tal y como llega.
  describe('[T-613] el ts puede llegar como cadena, no solo como Date', () => {
    const comoCadena = (d: Date) => d.toISOString();

    // ⚠️ DOS filas, y no es un detalle: con UNA sola, `sort` no llama al comparador, así que el
    // `getTime()` roto nunca se ejecuta y el test pasa en verde con el defecto puesto. La primera
    // versión de este caso tenía una fila y lo comprobé revirtiendo el arreglo: seguía verde.
    it('no revienta al ordenar y detecta igual al drenador parado', () => {
      const rows = [
        run({
          endpoint: 'telemetry-retention',
          ts: comoCadena(dia(1)) as never,
          procesadas: 0,
          remaining: { observable_events: 300_000 },
        }),
        run({
          endpoint: 'telemetry-retention',
          ts: comoCadena(T0) as never,
          procesadas: 0,
          remaining: { observable_events: 200_000 },
        }),
      ];
      expect(() => RULE_DRENAJE_ATRASADO.shouldFire(rows, undefined as never)).not.toThrow();
      expect(RULE_DRENAJE_ATRASADO.shouldFire(rows, undefined as never)).toBe(true);
    });

    it('ordena bien con cadenas: se juzga la ÚLTIMA pasada, no una cualquiera', () => {
      // La más reciente está SANA (ya drenó): con el orden roto se juzgaría la vieja y saltaría
      // una alerta falsa.
      const rows = [
        run({ endpoint: 'archive-interactions', ts: comoCadena(dia(2)) as never,
              procesadas: 0, remaining: { user_interactions: 500_000 } }),
        run({ endpoint: 'archive-interactions', ts: comoCadena(dia(0)) as never,
              procesadas: 200_000, remaining: { user_interactions: 0 } }),
      ];
      expect(RULE_DRENAJE_ATRASADO.shouldFire(rows, undefined as never)).toBe(false);
    });
  });
});
