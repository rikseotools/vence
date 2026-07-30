import {
  BACKOFF_CURVE_MIN,
  EMAIL_HISTORY_LOOKBACK_MIN,
  STREAK_RESET_MIN,
  contarRacha,
  decideEmail,
  parseEmailHistory,
  parseMinSeverity,
  pasaSeveridad,
  problemKey,
  requiredGapMin,
  type EmailHistoryRow,
} from './email-policy';

const AHORA = Date.parse('2026-07-30T12:00:00.000Z');
const min = (n: number) => n * 60_000;
const hace = (minutos: number) => AHORA - min(minutos);

describe('email-policy (T-272)', () => {
  describe('parseEmailHistory', () => {
    it('agrupa por regla+fingerprint y ordena los timestamps', () => {
      const rows: EmailHistoryRow[] = [
        {
          rule: '5xx_spike',
          fingerprint: '5xx_spike_/api/interactions',
          sentAt: ['2026-07-30T11:00:00.000Z', '2026-07-30T09:00:00.000Z'],
        },
      ];
      const out = parseEmailHistory(rows);
      expect(out.get('5xx_spike|5xx_spike_/api/interactions')).toEqual([
        Date.parse('2026-07-30T09:00:00.000Z'),
        Date.parse('2026-07-30T11:00:00.000Z'),
      ]);
    });

    it('separa dos fingerprints de la MISMA regla: son dos problemas', () => {
      const out = parseEmailHistory([
        {
          rule: '5xx_spike',
          fingerprint: '5xx_spike_/a',
          sentAt: [new Date(hace(10))],
        },
        {
          rule: '5xx_spike',
          fingerprint: '5xx_spike_/b',
          sentAt: [new Date(hace(10))],
        },
      ]);
      expect(out.size).toBe(2);
    });

    it('sin fingerprint usa la regla como clave (el fallback del cron)', () => {
      const out = parseEmailHistory([
        {
          rule: 'cron_overdue',
          fingerprint: null,
          sentAt: [new Date(hace(5))],
        },
      ]);
      expect(out.has(problemKey('cron_overdue'))).toBe(true);
    });

    it('acepta Date y string, porque el driver puede devolver cualquiera', () => {
      const out = parseEmailHistory([
        {
          rule: 'r',
          fingerprint: 'r',
          sentAt: [new Date(hace(30)), '2026-07-30T11:45:00.000Z'],
        },
      ]);
      expect(out.get('r|r')).toHaveLength(2);
    });

    it('descarta lo ilegible en vez de propagar NaN', () => {
      const out = parseEmailHistory([
        {
          rule: 'r',
          fingerprint: 'r',
          sentAt: ['no-es-fecha', null, new Date(hace(5))],
        },
        { rule: null, fingerprint: 'x', sentAt: [new Date(hace(5))] },
        { rule: 'sinNada', fingerprint: 'sinNada', sentAt: [] },
      ]);
      expect(out.get('r|r')).toEqual([hace(5)]);
      expect(out.has('sinNada|sinNada')).toBe(false);
      expect([...out.values()].flat().every(Number.isFinite)).toBe(true);
    });
  });

  describe('contarRacha', () => {
    it('sin historial la racha es 0 → el problema nuevo avisa YA', () => {
      expect(contarRacha([], AHORA)).toBe(0);
    });

    it('cuenta los correos seguidos de la racha actual', () => {
      expect(contarRacha([hace(400), hace(200), hace(30)], AHORA)).toBe(3);
    });

    it('un silencio largo REINICIA la racha: la reaparición es un suceso nuevo', () => {
      // dos correos viejos, luego el silencio de reinicio, luego uno reciente
      const stamps = [
        hace(STREAK_RESET_MIN + 200),
        hace(STREAK_RESET_MIN + 100),
        hace(30),
      ];
      expect(contarRacha(stamps, AHORA)).toBe(1);
    });

    it('si el último correo cae fuera de la ventana de reinicio, la racha está cerrada', () => {
      expect(contarRacha([hace(STREAK_RESET_MIN + 10)], AHORA)).toBe(0);
    });

    it('un timestamp en el futuro (reloj desfasado) no reabre el grifo', () => {
      expect(contarRacha([AHORA + min(5)], AHORA)).toBe(1);
    });
  });

  describe('requiredGapMin', () => {
    it('el primer correo de un problema no espera nada', () => {
      expect(requiredGapMin(0)).toBe(0);
    });

    it('escala por la curva declarada', () => {
      expect(requiredGapMin(1)).toBe(BACKOFF_CURVE_MIN[0]);
      expect(requiredGapMin(2)).toBe(BACKOFF_CURVE_MIN[1]);
      expect(requiredGapMin(3)).toBe(BACKOFF_CURVE_MIN[2]);
    });

    it('a partir del final de la curva se estabiliza (1/día, no 0)', () => {
      const ultimo = BACKOFF_CURVE_MIN[BACKOFF_CURVE_MIN.length - 1];
      expect(requiredGapMin(4)).toBe(ultimo);
      expect(requiredGapMin(50)).toBe(ultimo);
    });
  });

  describe('pasaSeveridad / parseMinSeverity', () => {
    it('con el mínimo en critical solo pasa critical', () => {
      expect(pasaSeveridad('critical', 'critical')).toBe(true);
      expect(pasaSeveridad('error', 'critical')).toBe(false);
      expect(pasaSeveridad('warn', 'critical')).toBe(false);
    });

    it('con el mínimo en warn pasa todo', () => {
      expect(pasaSeveridad('warn', 'warn')).toBe(true);
      expect(pasaSeveridad('critical', 'warn')).toBe(true);
    });

    it('un valor de env inválido cae al default, NO apaga el canal', () => {
      expect(parseMinSeverity('criticaal')).toBe('critical');
      expect(parseMinSeverity('')).toBe('critical');
      expect(parseMinSeverity(undefined)).toBe('critical');
      expect(parseMinSeverity(null)).toBe('critical');
    });

    it('normaliza mayúsculas y espacios (la env la escribe una persona)', () => {
      expect(parseMinSeverity(' ERROR ')).toBe('error');
      expect(parseMinSeverity('Warn')).toBe('warn');
    });
  });

  describe('decideEmail', () => {
    const base = { minSeverity: 'critical' as const, nowMs: AHORA };

    it('critical nuevo → correo inmediato', () => {
      expect(decideEmail({ ...base, severity: 'critical' })).toMatchObject({
        email: true,
        skippedBy: null,
        racha: 0,
      });
    });

    it('error/warn no pasan el mínimo, y queda dicho por qué', () => {
      expect(decideEmail({ ...base, severity: 'error' })).toMatchObject({
        email: false,
        skippedBy: 'severity',
      });
      expect(decideEmail({ ...base, severity: 'warn' })).toMatchObject({
        email: false,
        skippedBy: 'severity',
      });
    });

    it('emailAlways salta el mínimo (main_ci_rojo bloquea a todo el mundo)', () => {
      expect(
        decideEmail({ ...base, severity: 'error', emailAlways: true }),
      ).toMatchObject({ email: true, skippedBy: null });
    });

    it('emailAlways NO salta el backoff: la excepción es a la severidad', () => {
      expect(
        decideEmail({
          ...base,
          severity: 'error',
          emailAlways: true,
          sentAtMs: [hace(10)],
        }),
      ).toMatchObject({ email: false, skippedBy: 'backoff' });
    });

    it('la repetición temprana del mismo problema se calla y dice cuánto falta', () => {
      const d = decideEmail({
        ...base,
        severity: 'critical',
        sentAtMs: [hace(20)],
      });
      expect(d.email).toBe(false);
      expect(d.skippedBy).toBe('backoff');
      expect(d.faltanMin).toBe(BACKOFF_CURVE_MIN[0] - 20);
    });

    it('pasado el hueco vuelve a avisar', () => {
      expect(
        decideEmail({
          ...base,
          severity: 'critical',
          sentAtMs: [hace(BACKOFF_CURVE_MIN[0] + 1)],
        }),
      ).toMatchObject({ email: true, skippedBy: null });
    });

    it('el hueco crece con la racha: lo que valía al 2.º correo no vale al 4.º', () => {
      const tresCorreos = [hace(700), hace(400), hace(120)];
      // racha 3 → exige 1440 min; solo han pasado 120
      expect(
        decideEmail({ ...base, severity: 'critical', sentAtMs: tresCorreos }),
      ).toMatchObject({ email: false, skippedBy: 'backoff', racha: 3 });
    });

    it('una avería CRÓNICA converge a 1 correo/día en vez de 72', () => {
      // Simula 3 días de una regla con cooldown de 20 min disparando sin parar.
      const enviados: number[] = [];
      const t0 = Date.parse('2026-07-25T00:00:00.000Z');
      for (let m = 0; m < 3 * 24 * 60; m += 20) {
        const now = t0 + min(m);
        const d = decideEmail({
          severity: 'critical',
          minSeverity: 'critical',
          sentAtMs: enviados,
          nowMs: now,
        });
        if (d.email) enviados.push(now);
      }
      // inmediato + 1 h + 6 h + 1/día ⇒ un puñado, no 216
      expect(enviados.length).toBeLessThanOrEqual(6);
      expect(enviados.length).toBeGreaterThanOrEqual(4);
    });

    it('un problema que se arregla y vuelve pasado el reinicio avisa otra vez YA', () => {
      const viejo = [hace(STREAK_RESET_MIN + 60)];
      expect(
        decideEmail({ ...base, severity: 'critical', sentAtMs: viejo }),
      ).toMatchObject({ email: true, racha: 0 });
    });
  });

  describe('invariantes del módulo', () => {
    it('el lookback del historial cubre el hueco máximo MÁS el reinicio de racha', () => {
      const maxGap = Math.max(...BACKOFF_CURVE_MIN);
      expect(EMAIL_HISTORY_LOOKBACK_MIN).toBeGreaterThanOrEqual(
        maxGap + STREAK_RESET_MIN,
      );
    });

    it('el reinicio de racha es MAYOR que el último escalón: si no, el backoff se desarma solo', () => {
      // El defecto que cazó el test de convergencia: con los dos a 1440, el
      // propio hueco diario del backoff cuenta como "silencio", la racha se
      // reinicia y el siguiente correo vuelve a salir a la hora. La avería
      // crónica volvía a mandar 9 correos en 3 días.
      expect(STREAK_RESET_MIN).toBeGreaterThan(Math.max(...BACKOFF_CURVE_MIN));
    });

    it('la curva es creciente: un backoff que baje sería un grifo abierto', () => {
      for (let i = 1; i < BACKOFF_CURVE_MIN.length; i++) {
        expect(BACKOFF_CURVE_MIN[i]).toBeGreaterThan(BACKOFF_CURVE_MIN[i - 1]);
      }
    });
  });
});
