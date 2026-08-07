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

/**
 * `ts` está tipado `Date` en `DrenajeRun`, pero eso es lo que promete el TIPO, no lo
 * que entrega el DRIVER. Reproducido en producción el 07/08 con la regla YA
 * desplegada: `b.ts.getTime is not a function` mató `drenaje_atrasado` la primera
 * noche que tenía algo real que juzgar. Causa confirmada llamando a
 * `db.execute(sql\`...\`)` (drizzle-orm/postgres-js) contra RDS: a diferencia de
 * usar el cliente postgres-js directamente (que SÍ parsea a `Date`), `.execute()`
 * devuelve un `timestamptz` como STRING — `'2026-08-07 06:18:49.668061+00'`, no un
 * objeto `Date`. El resto del fichero ya sabía esto (`kindsSinEvaluarBackend` línea
 * ~1014, `asDate`/`normalizarFecha` 231/566); a `diagnosticarDrenaje` le faltaba.
 */
describe('diagnosticarDrenaje — `ts` como lo entrega el driver de VERDAD, no el tipo (T-613)', () => {
  // OJO con este tipo de test: `diagnosticarDrenaje` agrupa por `endpoint` ANTES de
  // ordenar, y `Array.prototype.sort` con 0 o 1 elemento NUNCA llama al comparador
  // (V8 lo salta). Un test con una sola fila —o con una fila por endpoint distinto—
  // pasaría igual con el bug puesto: hace falta ≥2 filas del MISMO endpoint para que
  // `.sort((a,b) => b.ts.getTime() ...)` se ejecute de verdad. Es justo el hueco por
  // el que la primera versión de este test coló en verde con el bug todavía activo.
  const filaString = (
    endpoint: string,
    isoConEspacio: string,
    remaining: number,
  ) => ({
    endpoint,
    // Formato EXACTO capturado en producción vía db.execute(sql`SELECT ts ...`):
    // un timestamptz vuelve como STRING, no como Date.
    ts: isoConEspacio as unknown as Date,
    procesadas: 0,
    remaining: { observable_events: remaining },
  });

  it('REPRODUCE el fallo real: 2 pasadas del MISMO cron con `ts` string no revientan al ordenar', () => {
    const filas = [
      filaString(
        'telemetry-retention',
        '2026-08-06 04:10:00.000000+00',
        300_000,
      ),
      filaString(
        'telemetry-retention',
        '2026-08-07 04:10:53.049061+00',
        200_000,
      ),
    ];
    expect(() => diagnosticarDrenaje(filas)).not.toThrow();
    // Y no solo «no explota»: tiene que juzgar la ÚLTIMA (07/08), no la primera que
    // encuentre — que es lo que demuestra que el string SÍ se comparó bien como fecha.
    const d = diagnosticarDrenaje(filas);
    expect(d).toHaveLength(1);
    expect(d[0].atrasado).toBe(200_000);
  });

  it('3 pasadas string en desorden temporal: sigue detectando `no_alcanza` con la más reciente', () => {
    const filas = [
      filaString(
        'archive-interactions',
        '2026-08-05 03:30:00.000000+00',
        ATRASO_TOPE_ALERTA,
      ),
      filaString(
        'archive-interactions',
        '2026-08-07 03:30:00.000000+00',
        ATRASO_TOPE_ALERTA,
      ),
      filaString(
        'archive-interactions',
        '2026-08-06 03:30:00.000000+00',
        ATRASO_TOPE_ALERTA,
      ),
    ];
    // Las tres tienen `procesadas: 0`, así que cualquiera de las tres ya dispara
    // `no_drena` sobre la última — lo que aquí se fija es que "última" se decide bien
    // (07/08, la del medio en el array) pese a llegar todas como string.
    const d = diagnosticarDrenaje(filas);
    expect(d).toHaveLength(1);
    expect(d[0].motivo).toBe('no_drena');
  });

  it('mezcla de Date real (tests/mocks antiguos) y string (driver real): la fecha MANDA, no el orden de llegada', () => {
    // Fixture a propósito discriminante: la fila VIEJA sí dispararía (no_drena) y la
    // NUEVA no (ya se resolvió, 0 pendientes). Si `.sort` comparara mal Date-vs-string
    // (p.ej. NaN en la resta) y se quedara con la vieja como "última", este test lo
    // pillaría en rojo — con la comparación correcta, manda la reciente y calla.
    const filas = [
      {
        endpoint: 'telemetry-retention',
        ts: new Date('2026-08-05T04:10:00Z'),
        procesadas: 0,
        remaining: { observable_events: 500_000 },
      },
      filaString('telemetry-retention', '2026-08-07 04:10:00.000000+00', 0),
    ];
    expect(diagnosticarDrenaje(filas)).toEqual([]);
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
    expect(RULE_DRENAJE_ATRASADO.shouldFire(rows, undefined as never)).toBe(
      true,
    );
    const n = RULE_DRENAJE_ATRASADO.buildNotification(rows, undefined);
    expect(n.title).toContain('drenador');
    expect(n.body).toContain('telemetry-retention');
    expect(n.body).toContain('observable_events');
    expect(n.body).toContain('200.000');
  });
});
