import { sql, type SQL } from 'drizzle-orm';

/**
 * Política de EMAIL del canal de alertas (T-272). Núcleo PURO: decide, para un
 * aviso que YA disparó, si además se envía por correo.
 *
 * ## El agujero que cierra (medido el 30/07/2026 sobre `alert_fired`)
 *
 * 392 correos en 7 días (56/día) para **28 problemas distintos** = 14 correos
 * por problema. El canal no estaba inundado de fallos: estaba inundado de
 * REPETICIONES del mismo fallo. El encargo era "un email cuando la app se caiga";
 * a 56/día no se lee ninguno, así que el correo de la caída real llega al mismo
 * sitio que el resto. La fatiga no es molestia: es la avería del canal.
 *
 * Causa mecánica: el único silencio era `cooldownMin`, FIJO y corto (20-60 min en
 * las ruidosas). Ante una avería CRÓNICA —que dura días— un cooldown de 20 min
 * no es un freno, es una cadencia: 72 correos/día. Y el correo nº 50 del mismo
 * problema pesaba lo mismo que el primero.
 *
 * ## Las tres capas (medidas, no estimadas: `scripts/alerts/sim-fatiga-email.cjs`)
 *
 * 1. **Backoff por problema** — el mismo `(regla, fingerprint)` exige huecos
 *    crecientes: inmediato → 1 h → 6 h → 1/día mientras siga. Es la que hace el
 *    trabajo: −312 de los 392. Avisa rápido de lo nuevo y deja de cobrar alquiler
 *    por lo ya fichado.
 * 2. **Severidad mínima** — decisión de producto (30/07): solo `critical` va por
 *    correo; `error`/`warn` quedan en `/admin/salud-sistema` (donde ya salían).
 *    Configurable por env sin tocar código.
 * 3. **Agrupación por tick** — la hace el caller: los supervivientes del mismo
 *    tick viajan en un correo (el incidente del 29/07 09:45 fueron 6 correos de
 *    6 reglas para UNA saturación de `/api/interactions`).
 *
 * Total simulado sobre los disparos reales: 392 → 40 correos/7d (**5,7/día**).
 *
 * ## Invariantes que NO se negocian
 *
 * - **Ningún problema se queda mudo.** El backoff RETRASA repeticiones, nunca
 *   silencia la primera vez que algo aparece. Un `fingerprint` nuevo avisa YA.
 * - **La supresión es del CORREO, no de la señal.** El `alert_fired` se escribe
 *   igual, con `emailed` y `emailSkipped` dentro. Si se suprimiera el disparo,
 *   el panel dejaría de ver que el problema sigue vivo — que es el modo de fallo
 *   de T-162 (una regla callada es indistinguible de una regla que no dispara).
 * - **`alert_fired` deja de ser 1:1 con la bandeja**, y eso hay que poder
 *   consultarlo: la bandeja es `alert_fired WHERE metadata->>'emailed'='true'`.
 *   El runbook (§0) se actualizó con la consulta nueva.
 * - **Fail-open**: sin historial legible se emailea (que es el comportamiento de
 *   antes). Un motor de alertas que se calla por no poder leer su propio
 *   historial sería peor que el spam que esto arregla.
 */

export type AlertSeverity = 'warn' | 'error' | 'critical';

/** Orden total de severidades. Fuera de aquí no se comparan severidades a mano. */
export const SEVERITY_ORDER: Record<AlertSeverity, number> = {
  warn: 1,
  error: 2,
  critical: 3,
};

/** Decisión de producto (30/07/2026, Manuel): al buzón solo lo `critical`. */
export const DEFAULT_MIN_EMAIL_SEVERITY: AlertSeverity = 'critical';

/**
 * Huecos exigidos al MISMO problema, en minutos, según cuántos correos lleve
 * ya mandados en la racha actual. El último valor se repite indefinidamente:
 * una avería que dura una semana acaba costando 1 correo/día, no 72.
 */
export const BACKOFF_CURVE_MIN: readonly number[] = [60, 360, 1440];

/**
 * Silencio tras el cual la racha se REINICIA: si un problema estuvo este tiempo
 * sin dar señales, su reaparición es un suceso NUEVO y merece correo inmediato.
 * Sin reinicio, un problema que se arregla y vuelve al mes seguiría castigado
 * con el hueco de 24 h — un silencio que nadie pidió.
 *
 * ⚠️ TIENE QUE SER ESTRICTAMENTE MAYOR QUE EL ÚLTIMO ESCALÓN DE LA CURVA, y por
 * eso son 48 h y no 24. Con reinicio = último escalón (los dos a 1440) el
 * backoff SE DESARMA SOLO: la avería crónica manda su correo diario, ese hueco
 * de 1440 cuenta ya como "silencio", la racha vuelve a 0 y el siguiente correo
 * sale a la hora. Lo cazó el test de convergencia (9 correos en 3 días donde
 * debían salir 4-6); a ojo, en revisión, esto no se ve. Hay test que fija la
 * relación para que no se pueda reintroducir tocando una de las dos constantes.
 */
export const STREAK_RESET_MIN = 2880;

/**
 * Ventana del historial que se consulta. Tiene que cubrir el hueco más largo de
 * la curva MÁS el reinicio de racha; si no, el último correo caería fuera y el
 * backoff se perdería EN SILENCIO (el mismo modo de fallo que `alert-cooldown`
 * documenta para su propio lookback). Hay test que lo impone.
 */
export const EMAIL_HISTORY_LOOKBACK_MIN = 4320; // 72 h

/**
 * Historial de lo que SE EMAILEÓ, por problema. Una sola query agregada por
 * tick, resuelta por el índice `idx_observable_events_event_type_ts`.
 *
 * Se filtra por `emailed = 'true'` a propósito: la racha cuenta CORREOS, no
 * disparos. Si contara disparos, el primer correo de un problema ruidoso ya
 * nacería con la racha alta y saldría con retraso.
 */
export const EMAIL_HISTORY_QUERY: SQL = sql`
  SELECT metadata->>'rule'                                    AS "rule",
         COALESCE(metadata->>'fingerprint', metadata->>'rule') AS "fingerprint",
         ARRAY_AGG(ts ORDER BY ts)                            AS "sentAt"
    FROM observable_events
   WHERE event_type = 'alert_fired'
     AND ts > NOW() - INTERVAL '4320 minutes'
     AND metadata->>'rule' IS NOT NULL
     AND metadata->>'emailed' = 'true'
   GROUP BY 1, 2
`;

/** Fila cruda de EMAIL_HISTORY_QUERY. `unknown` porque el driver da Date o string. */
export interface EmailHistoryRow {
  rule: string | null;
  fingerprint: string | null;
  sentAt: Array<string | Date | null> | null;
}

/** Clave de un problema: la regla NO basta — `5xx_spike` en dos endpoints son dos problemas. */
export function problemKey(rule: string, fingerprint?: string): string {
  return `${rule}|${fingerprint ?? rule}`;
}

/**
 * Pura: filas → Map(problema → timestamps de correo, ascendente).
 * Descarta lo ilegible en vez de propagar un NaN que envenenaría la comparación.
 */
export function parseEmailHistory(
  rows: EmailHistoryRow[],
): Map<string, number[]> {
  const out = new Map<string, number[]>();
  for (const row of rows ?? []) {
    const rule = row?.rule;
    if (!rule) continue;
    const stamps: number[] = [];
    for (const raw of row.sentAt ?? []) {
      if (raw === null || raw === undefined) continue;
      const ms = raw instanceof Date ? raw.getTime() : Date.parse(String(raw));
      if (Number.isFinite(ms)) stamps.push(ms);
    }
    if (!stamps.length) continue;
    stamps.sort((a, b) => a - b);
    out.set(problemKey(rule, row.fingerprint ?? undefined), stamps);
  }
  return out;
}

/**
 * Pura: cuántos correos lleva la racha ACTUAL de este problema.
 *
 * Se recorre del más antiguo al más nuevo y se reinicia el contador en cuanto
 * hay un silencio ≥ STREAK_RESET_MIN. El silencio final (entre el último correo
 * y `nowMs`) también reinicia: un problema que lleva un día callado vuelve a ser
 * nuevo.
 */
export function contarRacha(
  sentAtMs: readonly number[],
  nowMs: number,
): number {
  if (!sentAtMs?.length) return 0;
  const resetMs = STREAK_RESET_MIN * 60_000;
  let racha = 0;
  let previo: number | null = null;
  for (const ms of sentAtMs) {
    if (!Number.isFinite(ms)) continue;
    racha = previo !== null && ms - previo < resetMs ? racha + 1 : 1;
    previo = ms;
  }
  if (previo === null) return 0;
  // Un timestamp en el futuro (desfase de reloj BD↔proceso) NO reinicia la
  // racha: ante un reloj dudoso preferimos un correo de menos a reabrir el grifo.
  if (nowMs - previo >= resetMs) return 0;
  return racha;
}

/** Pura: hueco exigido al siguiente correo del mismo problema. */
export function requiredGapMin(racha: number): number {
  if (racha <= 0) return 0;
  const idx = Math.min(racha - 1, BACKOFF_CURVE_MIN.length - 1);
  return BACKOFF_CURVE_MIN[idx];
}

/** Pura: ¿esta severidad llega al buzón? */
export function pasaSeveridad(
  severity: AlertSeverity,
  minSeverity: AlertSeverity,
): boolean {
  return (SEVERITY_ORDER[severity] ?? 0) >= (SEVERITY_ORDER[minSeverity] ?? 0);
}

/**
 * Normaliza el valor de env. Un valor inválido NO se interpreta como "todo
 * silenciado": se cae al default declarado, porque un typo en una env var no
 * debe poder apagar el canal de avisos en silencio.
 */
export function parseMinSeverity(
  raw: string | undefined | null,
): AlertSeverity {
  const v = String(raw ?? '')
    .trim()
    .toLowerCase();
  if (v === 'warn' || v === 'error' || v === 'critical') return v;
  return DEFAULT_MIN_EMAIL_SEVERITY;
}

export interface EmailDecision {
  /** ¿Se manda correo de este aviso? */
  email: boolean;
  /** Por qué NO se manda (para que el silencio quede medido, no adivinado). */
  skippedBy: 'severity' | 'backoff' | null;
  /** Correos que este problema llevaba en su racha ANTES de esta decisión. */
  racha: number;
  /** Minutos que faltaban para que el backoff lo dejara pasar (solo si `backoff`). */
  faltanMin?: number;
}

/**
 * Pura: la decisión completa para UN aviso.
 *
 * `emailAlways` es la puerta de escape para reglas por debajo del mínimo cuyo
 * significado es "la app está rota / nadie puede desplegar": su severidad
 * declarada no siempre refleja la gravedad (`main_ci_rojo` es `error` y bloquea
 * a todo el mundo, mientras `event_loop_lag` es `critical` y era el mayor
 * spammer). Sigue pasando por el backoff: la excepción es a la severidad, no a
 * la repetición.
 */
export function decideEmail(params: {
  severity: AlertSeverity;
  minSeverity: AlertSeverity;
  emailAlways?: boolean;
  /** Timestamps de correos previos de ESTE problema (ascendente). */
  sentAtMs?: readonly number[];
  nowMs: number;
}): EmailDecision {
  const { severity, minSeverity, emailAlways, sentAtMs, nowMs } = params;

  const racha = contarRacha(sentAtMs ?? [], nowMs);

  if (!emailAlways && !pasaSeveridad(severity, minSeverity)) {
    return { email: false, skippedBy: 'severity', racha };
  }

  if (racha > 0) {
    const ultimo = (sentAtMs ?? [])[(sentAtMs ?? []).length - 1];
    const gap = requiredGapMin(racha);
    const transcurridoMin = (nowMs - ultimo) / 60_000;
    if (transcurridoMin < gap) {
      return {
        email: false,
        skippedBy: 'backoff',
        racha,
        faltanMin: Math.max(0, Math.ceil(gap - transcurridoMin)),
      };
    }
  }

  return { email: true, skippedBy: null, racha };
}
