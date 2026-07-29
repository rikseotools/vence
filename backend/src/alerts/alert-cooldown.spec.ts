import {
  LAST_FIRED_LOOKBACK_MIN,
  isInCooldown,
  mergeLastFired,
  parseLastFired,
  type LastFiredRow,
} from './alert-cooldown';
import { ALERT_RULES } from './alert-rules';

describe('alert-cooldown (T-258)', () => {
  const AHORA = Date.parse('2026-07-29T12:00:00.000Z');

  describe('parseLastFired', () => {
    it('convierte filas con fecha en string ISO', () => {
      const rows: LastFiredRow[] = [
        { rule: 'canary_pdf_queue_failed', lastFiredAt: '2026-07-29T11:30:00.000Z' },
      ];
      expect(parseLastFired(rows).get('canary_pdf_queue_failed')).toBe(
        Date.parse('2026-07-29T11:30:00.000Z'),
      );
    });

    it('acepta Date, porque el driver puede devolver cualquiera de los dos', () => {
      const d = new Date('2026-07-29T11:30:00.000Z');
      expect(parseLastFired([{ rule: 'r', lastFiredAt: d }]).get('r')).toBe(
        d.getTime(),
      );
    });

    it('descarta filas sin regla o con fecha ilegible en vez de propagar NaN', () => {
      // Un NaN colado aquí envenenaría la comparación de cooldown y la haría
      // siempre falsa: el grifo abierto otra vez, pero en silencio.
      const rows = [
        { rule: null, lastFiredAt: '2026-07-29T11:30:00.000Z' },
        { rule: 'r1', lastFiredAt: null },
        { rule: 'r2', lastFiredAt: 'no-es-una-fecha' },
        { rule: 'r3', lastFiredAt: '2026-07-29T11:30:00.000Z' },
      ] as LastFiredRow[];
      const out = parseLastFired(rows);
      expect([...out.keys()]).toEqual(['r3']);
    });

    it('no revienta con entrada vacía ni indefinida (fail-open del caller)', () => {
      expect(parseLastFired([]).size).toBe(0);
      expect(
        parseLastFired(undefined as unknown as LastFiredRow[]).size,
      ).toBe(0);
    });
  });

  describe('mergeLastFired', () => {
    it('se queda con el disparo MÁS RECIENTE de cada regla', () => {
      const memoria = new Map([['r', 1_000]]);
      const bd = new Map([['r', 5_000]]);
      expect(mergeLastFired(memoria, bd).get('r')).toBe(5_000);
      expect(mergeLastFired(bd, memoria).get('r')).toBe(5_000);
    });

    it('la memoria gana si va por delante de la réplica', () => {
      // `alert_fired` se escribe fire-and-forget contra la primaria y el cron
      // lee de la réplica: dentro de un mismo proceso la memoria puede ser más
      // fresca que la BD. Tomar la BD a secas reabriría el grifo un instante.
      const memoria = new Map([['r', 9_000]]);
      const bd = new Map([['r', 4_000]]);
      expect(mergeLastFired(memoria, bd).get('r')).toBe(9_000);
    });

    it('une reglas presentes en solo uno de los dos lados', () => {
      const out = mergeLastFired(new Map([['a', 1]]), new Map([['b', 2]]));
      expect(out.get('a')).toBe(1);
      expect(out.get('b')).toBe(2);
    });

    it('no muta los mapas de entrada', () => {
      const memoria = new Map([['a', 1]]);
      const bd = new Map([['b', 2]]);
      mergeLastFired(memoria, bd);
      expect([...memoria.keys()]).toEqual(['a']);
      expect([...bd.keys()]).toEqual(['b']);
    });
  });

  describe('isInCooldown', () => {
    it('sin disparo previo NO hay cooldown: una regla nueva puede avisar ya', () => {
      expect(isInCooldown(undefined, 60, AHORA)).toBe(false);
    });

    it('dentro de la ventana silencia', () => {
      expect(isInCooldown(AHORA - 30 * 60_000, 60, AHORA)).toBe(true);
    });

    it('pasada la ventana deja disparar', () => {
      expect(isInCooldown(AHORA - 61 * 60_000, 60, AHORA)).toBe(false);
    });

    it('el borde exacto NO silencia (elapsed == cooldown)', () => {
      expect(isInCooldown(AHORA - 60 * 60_000, 60, AHORA)).toBe(false);
    });

    it('un lastFired en el FUTURO se trata como cooldown activo', () => {
      // Desfase de reloj entre la BD y el proceso. Ante un reloj dudoso
      // preferimos un aviso de menos a reabrir el grifo, que es el defecto
      // que esta clase viene a cerrar.
      expect(isInCooldown(AHORA + 5 * 60_000, 60, AHORA)).toBe(true);
    });

    it('un valor no finito no silencia (no puede colarse un NaN que apague avisos)', () => {
      expect(isInCooldown(NaN, 60, AHORA)).toBe(false);
    });
  });

  describe('el caso real que motivó la tarea', () => {
    it('tras un reinicio, el cooldown persistido evita el correo que hoy sí se manda', () => {
      // 14:35:18 y 14:35:25 del 28/07: dos disparos a siete segundos, la firma
      // de dos evaluaciones que no comparten memoria.
      const disparoPrevio = AHORA - 7_000;
      const memoriaTrasReinicio = new Map<string, number>(); // vacía: proceso nuevo

      // Comportamiento viejo (solo memoria): dispara → correo.
      expect(
        isInCooldown(memoriaTrasReinicio.get('canary_pdf_queue_failed'), 60, AHORA),
      ).toBe(false);

      // Comportamiento nuevo (memoria ∪ BD): silenciado.
      const hidratado = mergeLastFired(
        memoriaTrasReinicio,
        parseLastFired([
          {
            rule: 'canary_pdf_queue_failed',
            lastFiredAt: new Date(disparoPrevio),
          },
        ]),
      );
      expect(
        isInCooldown(hidratado.get('canary_pdf_queue_failed'), 60, AHORA),
      ).toBe(true);
    });
  });

  describe('guardarraíl: la ventana de consulta cubre TODOS los cooldowns', () => {
    it('ningún cooldownMin supera LAST_FIRED_LOOKBACK_MIN', () => {
      // Si una regla tuviera un cooldown mayor que la ventana que se consulta,
      // su último disparo caería fuera del SELECT y el cooldown se perdería EN
      // SILENCIO — exactamente el modo de fallo que T-258 cierra. Que el CI se
      // ponga rojo al subir un cooldown es más barato que descubrirlo por el
      // buzón de correo.
      const excedidas = ALERT_RULES.filter(
        (r) => r.cooldownMin > LAST_FIRED_LOOKBACK_MIN,
      ).map((r) => `${r.name} (${r.cooldownMin} min)`);
      expect(excedidas).toEqual([]);
    });

    it('la ventana deja margen sobre el cooldown más largo en uso', () => {
      const maxCooldown = Math.max(...ALERT_RULES.map((r) => r.cooldownMin));
      expect(LAST_FIRED_LOOKBACK_MIN).toBeGreaterThanOrEqual(maxCooldown * 2);
    });
  });
});
