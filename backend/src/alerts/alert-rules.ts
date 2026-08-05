import { sql, type SQL } from 'drizzle-orm';
import type {
  CronJobInfo,
  CronScheduleService,
} from '../cron-schedule/cron-schedule.service';
import type { AlertNotification } from './notification-adapter';
import type { DeployWindow } from './deploy-window';
import { BENIGN_SIGNALS, CON_REGLA_PROPIA } from './benign-signals';

/**
 * Contexto inyectado a las reglas. Permite que una regla mezcle el
 * resultado de su query SQL con metadata derivada de otros servicios
 * (calendario de @Cron, etc.) sin tener que duplicar esa metadata en
 * un mapa hardcoded paralelo al código que la define.
 */
export interface AlertRuleContext {
  /**
   * Resuelve, para cada @Cron registrado en SchedulerRegistry, su tick
   * esperado anterior/siguiente a partir de la expresión declarada en el
   * decorador. Fuente única de verdad: si una regla necesita saber cuándo
   * debió ejecutarse un cron, lo pregunta aquí, no a un mapa duplicado.
   */
  cronSchedule: CronScheduleService;

  /**
   * Ventana de deploy/churn de infraestructura activa, calculada UNA vez
   * por tick por AlertsCron. Las reglas que vigilan estados transitorios
   * causados por deploys (pool_hung_clientread) la consultan para silenciar
   * falsos positivos durante un rolling, salvo señales de severidad alta.
   *
   * Opcional: si falta (tests sin ctx, callers legacy) se interpreta como
   * "sin deploy" → no se suprime nada (fail-open, alerta de más mejor que
   * silencio). NUNCA la consume `cron_overdue` — ver deploy-window.ts.
   */
  deployWindow?: DeployWindow;

  /**
   * Timestamp (ms epoch) del arranque del proceso backend. Lo usa
   * `cron_overdue` para NO marcar overdue un cron que NUNCA emitió cuyo
   * último tick esperado es ANTERIOR al arranque: un cron recién desplegado
   * (p.ej. migrado de GitHub Actions) no pudo dispararse en un tick que
   * precede a su propia existencia → falso positivo que inundaba el inbox
   * tras cada migración. Opcional (tests/legacy = sin este filtro).
   */
  processStartedAtMs?: number;
}

/**
 * Definición declarativa de una regla de alerta.
 *
 * El cron rules engine ejecuta `query` sobre la BD; si `shouldFire`
 * devuelve true para el resultado, llama `buildNotification` y dispara.
 *
 * `cooldownMin` evita spam: si una regla disparó hace <N min, se silencia.
 * Tracking del último firing en memoria del proceso (basta para Fargate
 * single-task; si crece a N tasks, mover a Redis con key `alert_lastfire:${rule}`).
 *
 * Bloque 4 Gap 8 del manual de observabilidad.
 */
export interface AlertRule<T = unknown> {
  /** Identificador estable de la regla (snake_case). */
  name: string;

  /** Severidad de la notificación que se dispararía. */
  severity: 'warn' | 'error' | 'critical';

  /**
   * Query SQL que devuelve filas. El resultado se pasa a `shouldFire` y
   * `buildNotification`. Si la query no devuelve filas, equivale a "no
   * fire" — no llama buildNotification.
   */
  query: SQL;

  /**
   * Predicado: ¿deben dispararse las notificaciones para este resultado?
   * Si devuelve false, no se envía nada. `ctx` se puede ignorar para
   * reglas SQL-only puras; las reglas que dependen de él deben validar
   * su presencia y lanzar si falta (invariante respetada por AlertsCron).
   */
  shouldFire: (rows: T[], ctx?: AlertRuleContext) => boolean;

  /** Construye el contenido de la notificación a enviar. */
  buildNotification: (
    rows: T[],
    ctx?: AlertRuleContext,
  ) => Omit<AlertNotification, 'rule' | 'severity'>;

  /**
   * Tiempo mínimo entre dos firings consecutivos de la misma regla.
   * Evita spam si la condición persiste.
   */
  cooldownMin: number;

  /**
   * Manda correo aunque su `severity` esté por debajo del mínimo del canal
   * (T-272). Puerta de escape ESTRECHA, no un "es importante": solo para reglas
   * cuyo significado es *la app está rota o el equipo está bloqueado*.
   *
   * Existe porque la severidad de este catálogo no es un buen proxy de
   * "merece correo", y el filtro por severidad a secas silenciaría cosas que sí:
   * medido el 30/07, con el mínimo en `critical` **18 de 28 problemas dejaban de
   * avisar**, entre ellos `main_ci_rojo` (`error`, y bloquea a todo el mundo)
   * mientras `event_loop_lag` (`critical`) era el mayor spammer con 180 correos.
   *
   * NO exime del backoff: la excepción es a la severidad, no a la repetición.
   * Antes de poner esto en una regla nueva, mídela con
   * `node scripts/alerts/sim-fatiga-email.cjs`.
   */
  emailAlways?: boolean;
}

/**
 * Invariante de runtime: una regla que declara que depende de `ctx`
 * (porque consume `cronSchedule` u otro servicio) DEBE recibirlo. Si el
 * caller (AlertsCron) lo omite por un bug, el fallo es ruidoso y nominal
 * (no silencioso ni difícil de diagnosticar).
 */
function assertContextualRule(
  ruleName: string,
  ctx: AlertRuleContext | undefined,
): asserts ctx is AlertRuleContext {
  if (!ctx) {
    throw new Error(
      `Regla '${ruleName}' requiere AlertRuleContext pero recibió undefined. ` +
        'Esto es un bug en el caller (alerts.cron o helper de tests); ' +
        'la regla NO debe asumir un default silencioso.',
    );
  }
}

// ────────────────────────────────────────────────────────────────
// Catálogo de reglas iniciales — extensible
// ────────────────────────────────────────────────────────────────

/** Spike de errores 5xx — alertar si >20 en últimos 5 minutos. */
export const RULE_HTTP_5XX_SPIKE: AlertRule<{
  n: number;
  topEndpoint: string | null;
}> = {
  name: '5xx_spike',
  severity: 'critical',
  query: sql`
    SELECT COUNT(*)::int AS n,
           MODE() WITHIN GROUP (ORDER BY endpoint) AS "topEndpoint"
    FROM observable_events
    WHERE event_type IN ('http_5xx', 'http_timeout')
      AND ts > NOW() - INTERVAL '5 minutes'
  `,
  shouldFire: (rows) => (rows[0]?.n ?? 0) > 20,
  buildNotification: (rows) => {
    const n = rows[0]?.n ?? 0;
    const top = rows[0]?.topEndpoint ?? '(varios)';
    return {
      title: `Spike de errores 5xx — ${n} errores en 5 min`,
      body: `Endpoint con más errores: ${top}\n\nInvestigar en /admin/salud-sistema o:\n\n  SELECT endpoint, error_type, COUNT(*) FROM observable_events\n  WHERE event_type='http_5xx' AND ts > NOW() - INTERVAL '5 minutes'\n  GROUP BY endpoint, error_type ORDER BY COUNT(*) DESC;`,
      metadata: { count: n, topEndpoint: top, windowMin: 5 },
      fingerprint: `5xx_spike_${top}`,
    };
  },
  cooldownMin: 30,
};

/**
 * Margen tras el tick esperado antes de considerar un cron overdue.
 *
 * Es proporcional al intervalo nominal del cron (next - prev) para que el
 * mismo umbral funcione tanto para crons cada 5 min como para crons
 * diarios o semanales. Un margen fijo de 30 min sería absurdamente
 * permisivo en crons frecuentes (6 ticks perdidos sin alertar) y
 * absurdamente estricto en crons semanales bajo jitter de scheduling.
 *
 * Bounded: nunca menos de 1 min (cubre la propagación a BD bajo carga) ni
 * más de 30 min.
 *
 * ⚠️ Nota (2026-06-12): el margen mide el retraso de la SEÑAL DE ARRANQUE
 * (`cron_tick`), no la duración del job. Antes el único signal era `cron_run`
 * (emitido AL COMPLETAR): un cron sano pero lento (escaneo LLM `detect-oep-llm`
 * tarda ~30 min) emitía su `cron_run` pasado el margen y aparentaba overdue
 * durante toda su ejecución → falso positivo auto-resuelto. Desde que la regla
 * lee `cron_tick` (arranque, emitido por `runWithHeartbeat` antes del work),
 * el cap de 30 min vuelve a ser correcto: mide "¿disparó el scheduler a su
 * hora?", independientemente de cuánto tarde el job. El viejo comentario decía
 * "el cron más pesado tarda ~3.4 s" — premisa rota por los crons de escaneo IA.
 */
const MIN_GRACE_MS = 60 * 1000;
const MAX_GRACE_MS = 30 * 60 * 1000;
const GRACE_FRACTION_OF_INTERVAL = 0.2;

function graceForInterval(intervalMs: number): number {
  return Math.max(
    MIN_GRACE_MS,
    Math.min(MAX_GRACE_MS, intervalMs * GRACE_FRACTION_OF_INTERVAL),
  );
}

function graceForJob(prevTick: Date, nextTick: Date): number {
  return graceForInterval(nextTick.getTime() - prevTick.getTime());
}

/**
 * Ventana mínima desde el primer tick esperado para empezar a vigilar un
 * cron que NUNCA emitió. Evita disparar durante el bootstrap (deploy
 * recién hecho, primer tick no completado todavía).
 */
const CRON_NEVER_OBSERVED_GRACE_MS = 60 * 60 * 1000;

interface OverdueEntry {
  name: string;
  expression: string;
  timeZone: string;
  /** in-process (@Cron de este proceso) vs external (contenedor programado propio). */
  origin: CronJobInfo['origin'];
  /** Con fase (tick de calendario) o por intervalo (periodo sin hora fija). */
  cadence: CronJobInfo['cadence'];
  intervalMs: number;
  prevExpectedTick: Date;
  nextExpectedTick: Date;
  lastActualRun: Date | null;
}

export function findOverdueCrons(
  rows: Array<{ endpoint: string; lastTs: Date | string | null }>,
  ctx: AlertRuleContext,
  now: Date = new Date(),
): OverdueEntry[] {
  const lastByEndpoint = new Map<string, Date | null>();
  for (const row of rows) {
    const ts = row.lastTs;
    lastByEndpoint.set(
      row.endpoint,
      ts == null ? null : ts instanceof Date ? ts : new Date(ts),
    );
  }

  const overdue: OverdueEntry[] = [];
  const nowMs = now.getTime();

  for (const job of ctx.cronSchedule.listCronJobs(now)) {
    const prevMs = job.prevExpectedTick.getTime();
    // Desde `intervalMs`, NO de restar los ticks: en una cadencia por intervalo
    // prev/next son una ventana deslizante de ±periodo, así que la resta da el
    // DOBLE del periodo real y el margen salía inflado al doble.
    const graceMs = graceForInterval(job.intervalMs);

    // ── Cadencia POR INTERVALO ───────────────────────────────────────────
    // Un job que solo promete «cada N minutos» no tiene hora de reloj que
    // cumplir, así que la pregunta de calendario («¿tickeó a las :30?») no
    // aplica: su fase deriva por diseño. Juzgarlo con ella producía un falso
    // positivo PERMANENTE — `temario-pdf-worker` tickeaba puntualmente a :20 y
    // :50 con la fase declarada en :00/:30, y con 20 min de desfase contra un
    // margen de 6 disparaba CRITICAL en cada ventana mientras drenaba la cola
    // sin un fallo (4 el 29/07). La pregunta correcta es cuánto hace del
    // último tick real, comparado con su propio periodo.
    if (job.cadence === 'interval') {
      const lastRun = lastByEndpoint.get(job.name) ?? null;
      if (lastRun === null) {
        // Nunca observado en la ventana de la query (60 días). Para un job de
        // cadencia sub-diaria eso es estar muerto, no un arranque en frío; el
        // único caso legítimo es haberlo AÑADIDO al catálogo hace un momento,
        // que se descarta esperando a que el proceso lleve vivo la ventana de
        // bootstrap. Sin esta rama, el fallo que estrenó el catálogo —worker
        // 2 días muerto sin emitir NADA— volvería a pasar en silencio.
        const startMs = ctx.processStartedAtMs ?? 0;
        if (startMs > 0 && nowMs - startMs < CRON_NEVER_OBSERVED_GRACE_MS) {
          continue;
        }
        overdue.push({
          name: job.name,
          expression: job.expression,
          timeZone: job.timeZone,
          origin: job.origin,
          cadence: job.cadence,
          intervalMs: job.intervalMs,
          prevExpectedTick: job.prevExpectedTick,
          nextExpectedTick: job.nextExpectedTick,
          lastActualRun: null,
        });
        continue;
      }
      if (nowMs - lastRun.getTime() > job.intervalMs + graceMs) {
        overdue.push({
          name: job.name,
          expression: job.expression,
          timeZone: job.timeZone,
          origin: job.origin,
          cadence: job.cadence,
          intervalMs: job.intervalMs,
          prevExpectedTick: job.prevExpectedTick,
          nextExpectedTick: job.nextExpectedTick,
          lastActualRun: lastRun,
        });
      }
      continue;
    }

    if (nowMs - prevMs < graceMs) {
      // El tick acaba de pasar; aún dentro de la propagación. No se
      // puede juzgar todavía si el cron emitió o no.
      continue;
    }

    // Un cron no puede estar overdue por un tick esperado ANTERIOR al arranque
    // del proceso: en ese instante este proceso no existía y no sabemos siquiera
    // si el cron estaba registrado en el anterior (pudo desplegarse ahora, migrarse
    // desde GitHub Actions, o estar RETIRADO por un kill-switch y reactivarse).
    // Sin esto, cada despliegue de esos inundaba el inbox hasta el primer tick real.
    //
    // ⚠️ Aplica a AMBOS casos —cron nunca observado y cron con ejecuciones viejas—.
    // Antes solo cubría el primero, y eso dejaba fuera justo el caso de la
    // REACTIVACIÓN: un cron retirado hace días conserva un `lastRun` antiguo, así
    // que no entra por la rama de "nunca observado" y se marcaba overdue por ticks
    // de cuando estaba apagado. Caso real 27/07: `check-seguimiento`, retirado el
    // 20/07 y reactivado como telemetría el 26/07, disparó 13 CRITICAL en 24 h por
    // los ticks del 21 al 24, con su primer tick legítimo aún por llegar.
    //
    // Lo que se pierde a cambio: un tick fallado JUSTO ANTES de un reinicio deja de
    // avisar. Es asumible y ya era el criterio de la regla — si el cron sigue roto,
    // su siguiente tick ocurre con el proceso vivo y ahí sí dispara.
    //
    // ⚠️ SOLO para crons in-process. Un job EXTERNO corre en su propio contenedor:
    // su vida no depende de nuestros reinicios, así que "el tick es anterior a
    // nuestro arranque" no dice nada sobre él. Aplicarle el guard lo silenciaría
    // en cada despliegue del backend — y un job diario podría esconderse un día
    // entero detrás de cada deploy, que es justo el punto ciego que este catálogo
    // viene a cerrar.
    if (job.origin === 'in-process') {
      const startMs = ctx.processStartedAtMs ?? 0;
      if (startMs > 0 && prevMs < startMs) continue;
    }

    const lastRun = lastByEndpoint.get(job.name) ?? null;
    if (lastRun === null) {
      // Nunca observado en la ventana de la query. Silenciar hasta que el primer
      // tick esperado quede lo bastante atrás como para descartar un bootstrap
      // post-deploy.
      if (nowMs - prevMs < CRON_NEVER_OBSERVED_GRACE_MS) continue;
      overdue.push({
        name: job.name,
        expression: job.expression,
        timeZone: job.timeZone,
        origin: job.origin,
        cadence: job.cadence,
        intervalMs: job.intervalMs,
        prevExpectedTick: job.prevExpectedTick,
        nextExpectedTick: job.nextExpectedTick,
        lastActualRun: null,
      });
      continue;
    }

    if (lastRun.getTime() < prevMs - graceMs) {
      overdue.push({
        name: job.name,
        expression: job.expression,
        timeZone: job.timeZone,
        origin: job.origin,
        cadence: job.cadence,
        intervalMs: job.intervalMs,
        prevExpectedTick: job.prevExpectedTick,
        nextExpectedTick: job.nextExpectedTick,
        lastActualRun: lastRun,
      });
    }
  }
  return overdue;
}

/**
 * Cron registrado en `SchedulerRegistry` que NO emitió señal de tick para su
 * tick esperado más reciente.
 *
 * Fuente de verdad del schedule: el propio decorador `@Cron(...)`, leído en
 * runtime a través de `CronScheduleService`. Cualquier cron nuevo entra en
 * la vigilancia automáticamente — sin mapas hardcoded que mantener.
 *
 * Señal de liveness (recalibrado 2026-06-12): lee `cron_tick` ∪ `cron_run`.
 *   - `cron_tick` = ARRANQUE del tick, emitido por `runWithHeartbeat` ANTES del
 *     work. Es la señal correcta: "¿disparó el scheduler?", independiente de
 *     cuánto tarde el job. Lo emiten los crons migrados a pasar opts al wrapper.
 *   - `cron_run` = COMPLETADO, fallback para crons aún no migrados (rápidos, su
 *     completado cae dentro del margen). `MAX(ts)` de ambos = el más reciente.
 *   Antes solo se leía `cron_run`: un cron lento (escaneo LLM) emitía su
 *   completado pasado el margen y falseaba overdue durante toda su ejecución.
 *
 * Cómo se evalúa cada cron:
 *   1. `cron-parser` resuelve `prevExpectedTick` (último tick que el
 *      schedule dice que debió ocurrir antes de NOW).
 *   2. La query SQL devuelve `MAX(ts)` de `cron_tick`/`cron_run` por endpoint
 *      en los últimos 60 días.
 *   3. Si `lastActualRun < prevExpectedTick - grace` → overdue.
 *   4. Si `prevExpectedTick > NOW - grace` → todavía dentro de la ventana
 *      en la que el tick podría no haberse propagado a BD.
 *   5. Si nunca tickeó en la ventana y el primer tick esperado fue hace
 *      menos de 1h → silencio (bootstrap post-deploy).
 *
 * Reemplaza al mapa `CRON_EXPECTED` + `isCronOverdue` previos, cuya
 * heurística `intervalMin * 2 + 30 min` fallaba cuando un cron se saltaba
 * dos ticks consecutivos (caso 31/05/2026: `detect-oep-llm` /
 * `detect-generic-sources` paralizados por el incidente outbox del 28-29/05,
 * lo que generaba alertas legítimas pero indistinguibles del bug de la
 * heurística).
 */
export const RULE_CRON_OVERDUE: AlertRule<{
  endpoint: string;
  lastTs: Date | string | null;
}> = {
  name: 'cron_overdue',
  severity: 'critical',
  query: sql`
    SELECT endpoint,
           MAX(ts) AS "lastTs"
    FROM observable_events
    WHERE event_type IN ('cron_tick', 'cron_run')
      AND ts > NOW() - INTERVAL '60 days'
    GROUP BY endpoint
  `,
  shouldFire: (rows, ctx) => {
    assertContextualRule('cron_overdue', ctx);
    return findOverdueCrons(rows, ctx).length > 0;
  },
  buildNotification: (rows, ctx) => {
    assertContextualRule('cron_overdue', ctx);
    const overdue = findOverdueCrons(rows, ctx);
    const lines = overdue.map((e) => {
      const lastStr = e.lastActualRun
        ? e.lastActualRun.toISOString()
        : '(never observed in last 60d)';
      const graceMin = Math.round(graceForInterval(e.intervalMs) / 60000);
      const donde =
        e.origin === 'external'
          ? '\n      ⚠️ job EXTERNO (contenedor programado propio, no este proceso)'
          : '';
      // Un job por intervalo no tiene hora de reloj que enseñar: escribir
      // «esperado: <hora>» ahí sería inventarse un compromiso que no existe y
      // mandaría a quien diagnostique a buscar un tick que nunca se prometió.
      if (e.cadence === 'interval') {
        const silencioMin = e.lastActualRun
          ? Math.round((Date.now() - e.lastActualRun.getTime()) / 60000)
          : null;
        const desde =
          silencioMin === null
            ? '(sin señal en 60d)'
            : `hace ${silencioMin}min`;
        return `  - ${e.name} [${e.expression}, margen ${graceMin}min]${donde}\n      último real: ${lastStr} ${desde}`;
      }
      return `  - ${e.name} ['${e.expression}' ${e.timeZone}, margen ${graceMin}min]${donde}\n      esperado: ${e.prevExpectedTick.toISOString()}\n      último real: ${lastStr}\n      próximo: ${e.nextExpectedTick.toISOString()}`;
    });
    // El sitio donde mirar NO es el mismo según el origen: un @Cron in-process
    // falla dentro del backend; un job externo suele ni haber arrancado (imagen
    // que ya no existe en el registry, credenciales, scheduler apagado) y en ese
    // caso no deja ni logs — el contenedor muere antes del entrypoint.
    const hayExternos = overdue.some((e) => e.origin === 'external');
    const pistas = hayExternos
      ? 'in-process: logs del backend. EXTERNOS: revisar que el contenedor programado LLEGA A ARRANCAR ' +
        '(un fallo al descargar la imagen no deja logs), su scheduler sigue activo y su cadencia no cambió. ' +
        'Catálogo: backend/src/cron-schedule/external-jobs.registry.ts'
      : 'Verificar el proceso del backend, sus logs, o BD.';
    return {
      title: `${overdue.length} cron${overdue.length > 1 ? 's' : ''} overdue`,
      body: `Los siguientes crons no emitieron señal de tick ("cron_tick" de arranque ni "cron_run" de completado) para su tick esperado más reciente (margen proporcional al intervalo):\n\n${lines.join('\n\n')}\n\n${pistas}`,
      metadata: {
        overdueCrons: overdue.map((e) => e.name),
        externalOverdue: overdue
          .filter((e) => e.origin === 'external')
          .map((e) => e.name),
      },
    };
  },
  cooldownMin: 60,
};

// ────────────────────────────────────────────────────────────────
// `cron_started_not_finished` (2026-07-27, T-162) — el complemento de
// `cron_overdue`. Aquélla pregunta "¿disparó el scheduler?"; ésta,
// "¿llegó a terminar?". Entre las dos no queda hueco.
//
// El hueco existía POR CONSTRUCCIÓN y se abrió a propósito: el 12/06
// `cron_overdue` pasó a leer `cron_tick ∪ cron_run` para callar el falso
// positivo de los crons lentos (ver nota de graceForJob). Desde entonces un
// tick basta para dar verde, así que un cron que arranca y muere a media
// ejecución es INVISIBLE. El `HeartbeatRegistry` no lo tapa: marca al
// completar, pero vive en memoria y se resetea justo con el reinicio que
// causa el fallo. Y `cron_failure_burst` lee `cron_run`: sin run, no hay burst.
//
// Caso real que lo motiva: `detect-notas-convocatoria` no completó ni el
// 25 ni el 26/07 (el contenedor se reinició dentro de su ventana de 6 h) y
// el panel de salud estuvo verde los dos días. 13 ticks huérfanos en 30 días.
// ────────────────────────────────────────────────────────────────

/**
 * Mínimo de `cron_run` históricos para que un cron sea JUZGABLE por esta regla.
 *
 * ⚠️ Esto NO es una tuerca de sensibilidad: es la guarda que decide la
 * corrección de la regla, y salió de medir, no de suponer. `cron_run` NO es una
 * señal universal de "terminé" — lo emite el `runImpl` de cada cron, y hay una
 * familia entera que en éxito calla A PROPÓSITO para no meter ruido
 * (`served-coverage.cron.ts`: «el heartbeat/tick ya registra que corrió; no
 * metemos ruido»). Medido el 27/07 sobre 30 días: 9 endpoints con ticks y CERO
 * runs (`served-coverage`, los seis `trigger-*`, `law-completeness-sweep`,
 * `annulled-vigencia-sweep`). Para ellos "tick sin run" es el estado SANO.
 * Sin esta guarda la regla nacería con 9 falsos positivos permanentes.
 *
 * Se exige un número ABSOLUTO de runs, no un ratio runs/ticks. Un ratio tiene
 * un incentivo perverso letal: cuanto más muere un cron, peor su ratio y antes
 * dejaría de vigilarse — justo al revés de lo que hace falta. (`detect-notas-
 * convocatoria`, el caso que origina la regla, arrastra un ratio de 0,57.)
 *
 * Y el umbral es 3, no 1, por un caso real que destapó la simulación:
 * `pool-capacity-sampler` lleva **1 `cron_run` en 43.308 ticks** — emite sólo
 * al fallar. Con el listón en 1 habría entrado en vigilancia y disparado de
 * forma permanente. Los dos muestreadores por minuto suman 85.220 ticks
 * huérfanos sanos: son el grueso de lo que esta guarda mantiene fuera.
 */
const STALL_MIN_RUNS_BASELINE = 3;

/**
 * Umbral de "lleva demasiado sin terminar", derivado de la propia historia del
 * cron en vez de un número fijo. Un fijo no puede servir a la vez a un cron
 * horario de 4 s y a uno diario de 6 h — ése fue exactamente el error que
 * generó el falso positivo de junio.
 *
 *   umbral = clamp(3 × p90(duración real), 15 min, 0,9 × intervalo)
 *
 * El techo por intervalo garantiza que el aviso llegue ANTES del siguiente
 * tick: si no, un cron diario roto se solaparía con su propia repetición y ya
 * no se sabría qué ejecución falló. Y se auto-afina: `detect-notas-convocatoria`
 * arrastra hoy un p90 de 5,9 h del sistema viejo (→ avisa a las ~17,6 h), pero
 * conforme entren ejecuciones del sistema nuevo (20 min) el umbral baja solo a
 * ~1 h. Ninguna constante que tocar a mano.
 */
const STALL_MIN_MS = 15 * 60 * 1000;
const STALL_DURATION_FACTOR = 3;
const STALL_INTERVAL_CAP_FRACTION = 0.9;

export function stallThresholdMs(
  p90DurationMs: number | null,
  intervalMs: number,
): number {
  const cap = Math.max(STALL_MIN_MS, intervalMs * STALL_INTERVAL_CAP_FRACTION);
  const fromDuration =
    p90DurationMs != null && p90DurationMs > 0
      ? p90DurationMs * STALL_DURATION_FACTOR
      : STALL_MIN_MS;
  return Math.min(cap, Math.max(STALL_MIN_MS, fromDuration));
}

export interface StalledCronRow {
  endpoint: string;
  ticks: number;
  runs: number;
  lastTick: Date | string | null;
  lastRun: Date | string | null;
  p90DurationMs: number | string | null;
}

export interface StalledCronEntry {
  name: string;
  lastTick: Date;
  lastRun: Date | null;
  stalledForMs: number;
  thresholdMs: number;
  p90DurationMs: number | null;
}

const toDate = (v: Date | string | null): Date | null =>
  v == null ? null : v instanceof Date ? v : new Date(v);

/**
 * Crons que emitieron su `cron_tick` de arranque y NO su `cron_run` de
 * completado, pasado el umbral propio de cada uno.
 *
 * A diferencia de `findOverdueCrons`, aquí NO se aplica el guard de
 * `processStartedAtMs`: un tick anterior al arranque del proceso es
 * precisamente la firma del fallo que buscamos (el reinicio se llevó por
 * delante la ejecución en curso). Ese es el caso que `cron_overdue` renunció
 * a cubrir el 27/07 —«se pierde a cambio el aviso de un tick fallado justo
 * antes de un reinicio»— y que esta regla recoge.
 */
export function findStalledCrons(
  rows: StalledCronRow[],
  ctx: AlertRuleContext,
  now: Date = new Date(),
): StalledCronEntry[] {
  const intervalByName = new Map<string, number>();
  for (const job of ctx.cronSchedule.listCronJobs(now)) {
    // `intervalMs` sirve a las dos cadencias; restar los ticks solo funcionaba
    // con las de fase (en las de intervalo son una ventana deslizante).
    intervalByName.set(job.name, job.intervalMs);
  }

  const stalled: StalledCronEntry[] = [];
  const nowMs = now.getTime();

  for (const row of rows) {
    // Sólo crons vivos en el SchedulerRegistry: misma fuente de verdad que
    // `cron_overdue` (el decorador @Cron). Un endpoint histórico de un cron ya
    // retirado no debe alertar para siempre.
    const intervalMs = intervalByName.get(row.endpoint);
    if (intervalMs === undefined || intervalMs <= 0) continue;

    // Sin costumbre de anunciar el completado, "tick sin run" no significa nada.
    if (row.runs < STALL_MIN_RUNS_BASELINE) continue;

    const lastTick = toDate(row.lastTick);
    // Crons aún no migrados al wrapper con opts no emiten `cron_tick` (p.ej.
    // `outbox-processor`): sin señal de arranque no hay nada que comparar.
    if (lastTick === null) continue;

    const lastRun = toDate(row.lastRun);
    if (lastRun !== null && lastRun.getTime() >= lastTick.getTime()) continue;

    const p90 =
      row.p90DurationMs == null ? null : Number(row.p90DurationMs) || null;
    const thresholdMs = stallThresholdMs(p90, intervalMs);
    const stalledForMs = nowMs - lastTick.getTime();
    if (stalledForMs < thresholdMs) continue; // aún puede estar corriendo

    stalled.push({
      name: row.endpoint,
      lastTick,
      lastRun,
      stalledForMs,
      thresholdMs,
      p90DurationMs: p90,
    });
  }

  return stalled.sort((a, b) => b.stalledForMs - a.stalledForMs);
}

const fmtMin = (ms: number) => `${Math.round(ms / 60000)} min`;

/**
 * Un cron arrancó y nunca anunció que terminara. El trabajo de ese tick se
 * perdió entero y en silencio: no hay reanudación ni reintento.
 */
export const RULE_CRON_STARTED_NOT_FINISHED: AlertRule<StalledCronRow> = {
  name: 'cron_started_not_finished',
  severity: 'error',
  query: sql`
    SELECT endpoint,
           COUNT(*) FILTER (WHERE event_type = 'cron_tick')::int AS ticks,
           COUNT(*) FILTER (WHERE event_type = 'cron_run')::int  AS runs,
           MAX(ts) FILTER (WHERE event_type = 'cron_tick') AS "lastTick",
           MAX(ts) FILTER (WHERE event_type = 'cron_run')  AS "lastRun",
           PERCENTILE_DISC(0.9) WITHIN GROUP (ORDER BY duration_ms)
             FILTER (WHERE event_type = 'cron_run' AND duration_ms IS NOT NULL)
             AS "p90DurationMs"
    FROM observable_events
    WHERE event_type IN ('cron_tick', 'cron_run')
      AND ts > NOW() - INTERVAL '30 days'
    GROUP BY endpoint
  `,
  shouldFire: (rows, ctx) => {
    assertContextualRule('cron_started_not_finished', ctx);
    return findStalledCrons(rows, ctx).length > 0;
  },
  buildNotification: (rows, ctx) => {
    assertContextualRule('cron_started_not_finished', ctx);
    const stalled = findStalledCrons(rows, ctx);
    const lines = stalled.map((e) => {
      const lastRunStr = e.lastRun
        ? e.lastRun.toISOString()
        : '(ningún completado en 30d)';
      const p90Str =
        e.p90DurationMs != null
          ? `p90 habitual ${fmtMin(e.p90DurationMs)}`
          : 'sin duración histórica';
      return `  - ${e.name}\n      arrancó: ${e.lastTick.toISOString()} (hace ${fmtMin(e.stalledForMs)})\n      último completado: ${lastRunStr}\n      umbral: ${fmtMin(e.thresholdMs)} (${p90Str})`;
    });
    return {
      title: `${stalled.length} cron${stalled.length > 1 ? 's' : ''} arrancó y no terminó`,
      body:
        `Estos crons emitieron su "cron_tick" de arranque pero NUNCA su "cron_run" de completado. ` +
        `El trabajo de ese tick se perdió entero: no hay reanudación ni reintento.\n\n${lines.join('\n\n')}\n\n` +
        `Causa más frecuente: el contenedor se reinició (deploy o rolling de ECS) dentro de la ventana de ejecución del job.\n\n` +
        `ACCIONES:\n` +
        `  1. ¿Hubo reinicio? Comparar con el arranque del proceso:\n` +
        `     SELECT MIN(ts) FROM observable_events WHERE event_type='cron_tick' AND ts > NOW() - INTERVAL '2 days';\n` +
        `  2. Ver la última ejecución completa y cuánto duró:\n` +
        `     SELECT ts, duration_ms, metadata FROM observable_events\n` +
        `     WHERE endpoint='<cron>' AND event_type='cron_run' ORDER BY ts DESC LIMIT 5;\n` +
        `  3. Si el job dura más que la ventana entre deploys, el arreglo NO es la alerta: es acortarlo o hacerlo reanudable.`,
      metadata: {
        stalledCrons: stalled.map((e) => e.name),
        worst: stalled[0]?.name,
      },
      fingerprint: `cron_started_not_finished_${stalled.map((e) => e.name).join(',')}`,
    };
  },
  // La condición persiste hasta el siguiente completado con éxito (hasta 24 h en
  // un cron diario). Un cooldown corto la convertiría en el goteo de T-160; el
  // cuerpo lista TODOS los crons parados, así que un solo email cubre el estado
  // entero y 4/día como techo es proporcionado.
  cooldownMin: 360,
};

/**
 * QUIÉN VIGILA AL VIGILANTE: una regla del motor que lleva rato reventando.
 *
 * El 27/07 se midió que `traffic_drop` (255 fallos en 24 h), `cron_overdue`
 * (132) y `materialized_stats_stale` (110) llevaban **más de un día sin
 * evaluarse** por timeout de query, y NADIE lo sabía: el `catch` del motor solo
 * escribía una línea de log. Una regla caída se ve exactamente igual que una
 * regla que no dispara, así que el panel seguía verde mientras la vigilancia
 * estaba muerta. Es el mismo patrón de fondo que T-162, un nivel más arriba.
 *
 * Umbral: ≥3 fallos de la MISMA regla en 1 h (el motor tickea cada 5 min → 12
 * intentos/h). Con 3 se descarta el fallo puntual —un pico de carga, un deploy,
 * un reinicio de la réplica— y se exige que el problema persista. `warn`, no
 * `critical`: no hay nada roto de cara al usuario, pero la red de seguridad
 * tiene un agujero y alguien debe mirarlo.
 */
export const RULE_ALERT_RULE_FAILING: AlertRule<{
  rule: string;
  fallos: number;
  ultimaCausa: string | null;
}> = {
  name: 'alert_rule_failing',
  severity: 'warn',
  query: sql`
    SELECT metadata->>'rule' AS rule,
           COUNT(*)::int AS fallos,
           (ARRAY_AGG(error_message ORDER BY ts DESC))[1] AS "ultimaCausa"
    FROM observable_events
    WHERE event_type = 'alert_rule_failed'
      AND ts > NOW() - INTERVAL '1 hour'
    GROUP BY metadata->>'rule'
    HAVING COUNT(*) >= 3
  `,
  shouldFire: (rows) => rows.length > 0,
  buildNotification: (rows) => ({
    title: `${rows.length} regla(s) de alerta reventando — la vigilancia tiene un hueco`,
    body:
      `Estas reglas del motor de alertas fallan al ejecutarse, así que NO están vigilando nada. ` +
      `Lo que cubren está sin cubrir:\n\n` +
      rows
        .map(
          (r) =>
            `  - ${r.rule}: ${r.fallos} fallos en 1 h\n      causa: ${r.ultimaCausa ?? '(sin detalle)'}`,
        )
        .join('\n\n') +
      `\n\nCausa más frecuente: la query supera el statement_timeout del pool (20 s en la réplica, ` +
      `backend/src/db/database.module.ts). Mirar el plan: si sale Seq Scan sobre observable_events, ` +
      `falta índice util o falta VACUUM (el index-only scan necesita el mapa de visibilidad marcado — ` +
      `ver supabase/migrations/20260727_observable_events_cron_covering_idx.sql).\n\n` +
      `  SELECT metadata->>'rule', count(*), max(error_message) FROM observable_events\n` +
      `  WHERE event_type='alert_rule_failed' AND ts > NOW() - INTERVAL '24 hours' GROUP BY 1 ORDER BY 2 DESC;`,
    metadata: { reglas: rows.map((r) => `${r.rule}:${r.fallos}`).join(',') },
    fingerprint: `alert_rule_failing_${rows.map((r) => r.rule).join(',')}`,
  }),
  cooldownMin: 120,
};

/** Deploy fallido — alertar inmediato si aparece event deploy_failed. */
export const RULE_DEPLOY_FAILED: AlertRule<{
  n: number;
  lastMsg: string | null;
}> = {
  name: 'deploy_failed',
  severity: 'critical',
  query: sql`
    SELECT COUNT(*)::int AS n,
           (ARRAY_AGG(error_message ORDER BY ts DESC))[1] AS "lastMsg"
    FROM observable_events
    WHERE event_type = 'deploy_failed'
      AND ts > NOW() - INTERVAL '10 minutes'
  `,
  shouldFire: (rows) => (rows[0]?.n ?? 0) > 0,
  buildNotification: (rows) => ({
    title: `${rows[0]?.n ?? 0} deploy(s) fallido(s) últimos 10 min`,
    body: `Último mensaje:\n\n${rows[0]?.lastMsg ?? '(sin detalle)'}\n\nVerificar GitHub Actions / Vercel dashboard.`,
    metadata: { count: rows[0]?.n ?? 0 },
  }),
  cooldownMin: 5,
};

/** Spike de fallos de cron — algún cron falló múltiples veces seguidas. */
export const RULE_CRON_FAILURE_BURST: AlertRule<{
  endpoint: string;
  failures: number;
}> = {
  name: 'cron_failure_burst',
  severity: 'error',
  query: sql`
    SELECT endpoint, COUNT(*)::int AS failures
    FROM observable_events
    WHERE event_type = 'cron_run'
      AND severity = 'error'
      AND ts > NOW() - INTERVAL '1 hour'
    GROUP BY endpoint
    HAVING COUNT(*) >= 3
  `,
  shouldFire: (rows) => rows.length > 0,
  buildNotification: (rows) => ({
    title: `${rows.length} cron(s) con fallos repetidos`,
    body: rows
      .map((r) => `  - ${r.endpoint}: ${r.failures} fallos en última hora`)
      .join('\n'),
    metadata: {
      burst: rows.map((r) => `${r.endpoint}:${r.failures}`).join(','),
    },
  }),
  cooldownMin: 30,
};

// ────────────────────────────────────────────────────────────────
// CORRE Y FALLA: el hueco que dejaban las tres reglas de cron (T-307, 30/07/2026)
//
// `cron_overdue` pregunta «¿disparó el scheduler?» y `cron_started_not_finished`
// «¿terminó?». Las dos se callan cuando un cron dispara, termina… y termina MAL.
// Ese caso lo cubría solo `cron_failure_burst`, que exige **3 fallos en 1 hora** —
// un listón que un cron DIARIO no puede alcanzar jamás: falla una vez al día.
//
// Caso real que lo destapa: `content-health-sweep` (diario, 07:30 UTC) falló el 29
// y el 30/07 con `cron_run` en severity `error` las dos veces. Ninguna de las
// cuatro reglas dijo nada, y como el barrido no escribía, el panel seguía
// enseñando el snapshot del 28/07 **como si fuera de hoy**: dos días de ceguera
// sobre los ~40 detectores de salud de contenido con el badge tranquilo.
//
// El criterio NO es «hubo un fallo» (un fallo aislado que se recupera al tick
// siguiente es ruido) sino **«no hay ningún ÉXITO reciente y el último intento
// falló»**, con la ventana derivada del intervalo propio de cada cron — igual que
// hacen las otras tres, para que sirva a la vez a uno de 5 min y a uno diario.
// ────────────────────────────────────────────────────────────────

export interface CronSinExitoRow {
  endpoint: string;
  lastRun: Date | string | null;
  lastRunFailed: boolean;
  lastSuccess: Date | string | null;
  successes: number;
}

export interface CronSinExitoEntry {
  name: string;
  lastRun: Date;
  lastSuccess: Date | null;
  sinExitoMs: number | null;
  thresholdMs: number;
}

/**
 * Mínimo de `cron_run` EXITOSOS en el histórico para que un cron sea juzgable.
 *
 * Misma guarda (y mismo motivo medido) que `STALL_MIN_RUNS_BASELINE`, pero sobre
 * los éxitos: hay una familia de crons que **solo emiten `cron_run` al fallar**
 * (`pool-capacity-sampler`: 1 run en 43.308 ticks). Para ellos «último run
 * fallido y ningún éxito» es el estado NORMAL, y sin esta guarda la regla nacería
 * disparando contra ellos para siempre.
 */
const SIN_EXITO_MIN_SUCCESSES = 3;

/**
 * Cuánto se tolera sin un solo éxito, en múltiplos del intervalo del propio cron.
 *
 * Dos ticks: uno puede fallar por una causa transitoria (un reinicio, un pico de
 * carga, un proveedor caído un rato) y recuperarse en el siguiente. Dos seguidos
 * ya no son casualidad — es lo que pasó con el sweep. Con suelo de 90 min para que
 * un cron de 1 min no alerte por dos fallos consecutivos de 60 segundos.
 */
const SIN_EXITO_INTERVALOS = 2;
const SIN_EXITO_MIN_MS = 90 * 60 * 1000;

export function sinExitoThresholdMs(intervalMs: number): number {
  return Math.max(SIN_EXITO_MIN_MS, intervalMs * SIN_EXITO_INTERVALOS);
}

/** Crons que están corriendo y fallando: último intento fallido y ningún éxito reciente. */
export function findCronsSinExito(
  rows: CronSinExitoRow[],
  ctx: AlertRuleContext,
  now: Date = new Date(),
): CronSinExitoEntry[] {
  const intervalByName = new Map<string, number>();
  for (const job of ctx.cronSchedule.listCronJobs(now)) {
    intervalByName.set(job.name, job.intervalMs);
  }

  const out: CronSinExitoEntry[] = [];
  const nowMs = now.getTime();

  for (const row of rows) {
    // Solo crons vivos en el registro: un endpoint de un cron ya retirado no debe
    // alertar para siempre (misma fuente de verdad que las otras tres reglas).
    const intervalMs = intervalByName.get(row.endpoint);
    if (intervalMs === undefined || intervalMs <= 0) continue;
    if (row.successes < SIN_EXITO_MIN_SUCCESSES) continue;
    if (!row.lastRunFailed) continue;

    const lastRun = toDate(row.lastRun);
    if (lastRun === null) continue;
    const lastSuccess = toDate(row.lastSuccess);
    const thresholdMs = sinExitoThresholdMs(intervalMs);
    const sinExitoMs = lastSuccess === null ? null : nowMs - lastSuccess.getTime();
    // Sin ningún éxito en la ventana consultada, el hueco es al menos la ventana:
    // se juzga por el fallo, que ya está confirmado.
    if (sinExitoMs !== null && sinExitoMs < thresholdMs) continue;

    out.push({ name: row.endpoint, lastRun, lastSuccess, sinExitoMs, thresholdMs });
  }

  return out.sort((a, b) => (b.sinExitoMs ?? Infinity) - (a.sinExitoMs ?? Infinity));
}

/**
 * Un cron que dispara, termina y termina MAL, tick tras tick. El trabajo no se
 * hace y —lo peor— lo que ese cron alimenta se queda con el último dato bueno,
 * que a ojo humano es indistinguible de un dato de hoy.
 */
export const RULE_CRON_SIN_EXITO: AlertRule<CronSinExitoRow> = {
  name: 'cron_sin_exito',
  severity: 'error',
  query: sql`
    SELECT endpoint,
           MAX(ts) AS "lastRun",
           (MAX(ts) FILTER (WHERE severity IN ('error', 'critical')) = MAX(ts)) AS "lastRunFailed",
           MAX(ts) FILTER (WHERE severity NOT IN ('error', 'critical')) AS "lastSuccess",
           COUNT(*) FILTER (WHERE severity NOT IN ('error', 'critical'))::int AS successes
    FROM observable_events
    WHERE event_type = 'cron_run'
      AND endpoint IS NOT NULL
      AND ts > NOW() - INTERVAL '30 days'
    GROUP BY endpoint
  `,
  shouldFire: (rows, ctx) => {
    assertContextualRule('cron_sin_exito', ctx);
    return findCronsSinExito(rows, ctx).length > 0;
  },
  buildNotification: (rows, ctx) => {
    assertContextualRule('cron_sin_exito', ctx);
    const malos = findCronsSinExito(rows, ctx);
    const lines = malos.map((e) => {
      const exito = e.lastSuccess
        ? `${e.lastSuccess.toISOString()} (hace ${fmtMin(e.sinExitoMs ?? 0)})`
        : '(ninguno en 30 días)';
      return `  - ${e.name}\n      último intento (FALLIDO): ${e.lastRun.toISOString()}\n      último éxito: ${exito}\n      tolerancia: ${fmtMin(e.thresholdMs)}`;
    });
    return {
      title: `${malos.length} cron${malos.length > 1 ? 's' : ''} corriendo y FALLANDO`,
      body:
        `Estos crons disparan y terminan, pero terminan MAL, y llevan más de dos ticks sin un solo éxito.\n\n${lines.join('\n\n')}\n\n` +
        `Por qué esta regla existe: "cron_failure_burst" exige 3 fallos en 1 hora, un listón que un cron DIARIO no alcanza nunca. ` +
        `content-health-sweep falló dos días seguidos (29 y 30/07/2026) sin que ninguna alerta lo dijera.\n\n` +
        `OJO al daño invisible: lo que alimenta un cron roto NO se queda vacío, se queda con el último dato bueno. ` +
        `Un panel que enseña la foto de anteayer no se distingue a ojo de uno al día.\n\n` +
        `ACCIONES:\n` +
        `  1. Ver el error concreto y desde cuándo:\n` +
        `     SELECT ts, severity, duration_ms, error_message, metadata FROM observable_events\n` +
        `     WHERE endpoint='<cron>' AND event_type='cron_run' ORDER BY ts DESC LIMIT 10;\n` +
        `  2. Si el error es un timeout de query, medir el coste con EXPLAIN (ANALYZE, BUFFERS) antes de tocar nada.\n` +
        `  3. Comprobar qué depende de ese cron y si está sirviendo datos viejos como si fueran de hoy.\n\n` +
        `Runbook: docs/runbooks/health-check.md`,
      metadata: { crons: malos.map((e) => e.name), worst: malos[0]?.name },
      fingerprint: `cron_sin_exito_${malos.map((e) => e.name).join(',')}`,
    };
  },
  // La condición persiste hasta el siguiente éxito (hasta 24 h en un cron diario).
  // Mismo razonamiento que `cron_started_not_finished`: el cuerpo lista todos, así
  // que un email cubre el estado entero y 4/día es el techo.
  cooldownMin: 360,
};

// ────────────────────────────────────────────────────────────────
// Reglas añadidas 2026-05-26 (Bloque 4 Fase 1.6 del roadmap):
// cubren los eventos nuevos capturados en esta sesión (runtime_kill
// del Gap 14, tts_error cascade, hydration mismatch tras deploy,
// workflow_failure GHA). Sin estas reglas, los eventos quedan en BD
// sin disparar alertas → defeats the purpose de la captura.
// ────────────────────────────────────────────────────────────────

/**
 * Runtime kill (504 SIGTERM) — disparo INMEDIATO. Llega vía Vercel Log
 * Drain (Gap 14). Cualquier ocurrencia merece atención: significa que
 * un endpoint excedió maxDuration y Vercel mató la lambda. Hay un user
 * mirando un 504. Sin esta regla, el evento queda silencioso en obs_events.
 */
export const RULE_RUNTIME_KILL: AlertRule<{
  n: number;
  topEndpoint: string | null;
}> = {
  name: 'runtime_kill',
  severity: 'critical',
  query: sql`
    SELECT COUNT(*)::int AS n,
           MODE() WITHIN GROUP (ORDER BY endpoint) AS "topEndpoint"
    FROM observable_events
    WHERE event_type = 'runtime_kill'
      AND ts > NOW() - INTERVAL '5 minutes'
  `,
  shouldFire: (rows) => (rows[0]?.n ?? 0) > 0,
  buildNotification: (rows) => {
    const n = rows[0]?.n ?? 0;
    const top = rows[0]?.topEndpoint ?? '(varios)';
    return {
      title: `${n} runtime kill(s) últimos 5 min — endpoint principal: ${top}`,
      body: `Vercel mató ${n} lambda(s) por SIGTERM (excedieron maxDuration). Cada runtime_kill = un usuario vio 504 sin posibilidad de retry.\n\nAcciones:\n  1. Inspeccionar el endpoint en /admin/salud-sistema.\n  2. Añadir maxDuration corto + withDbTimeout si aún no lo tiene.\n  3. Si es BD lenta, mirar pg_stat_statements del último 1h.\n\n  SELECT endpoint, COUNT(*), MAX(error_message)\n  FROM observable_events\n  WHERE event_type='runtime_kill' AND ts > NOW() - INTERVAL '15 minutes'\n  GROUP BY endpoint ORDER BY COUNT(*) DESC;`,
      metadata: { count: n, topEndpoint: top, windowMin: 5 },
      fingerprint: `runtime_kill_${top}`,
    };
  },
  cooldownMin: 10,
};

/**
 * TTS cascade — si una sola sesión emite ≥10 tts_error en 5 min, el
 * circuit breaker (lib/tts/engine.ts MAX_CONSECUTIVE_CHUNK_ERRORS=5)
 * está roto o eludido. Pre-fix (25/05) había sesiones con 100-240
 * errores; el fix corta a 5. Si vuelve a haber ≥10, hay regresión.
 */
export const RULE_TTS_ERROR_BURST: AlertRule<{
  sessionId: string;
  browser: string | null;
  isMobile: string | null;
  errors: number;
}> = {
  name: 'tts_error_burst',
  severity: 'warn',
  query: sql`
    SELECT
      metadata->>'sessionId' AS "sessionId",
      metadata->>'browser' AS browser,
      metadata->>'isMobile' AS "isMobile",
      COUNT(*)::int AS errors
    FROM observable_events
    WHERE event_type = 'tts_error'
      AND ts > NOW() - INTERVAL '5 minutes'
    GROUP BY 1, 2, 3
    HAVING COUNT(*) >= 10
  `,
  shouldFire: (rows) => rows.length > 0,
  buildNotification: (rows) => {
    const lines = rows
      .slice(0, 10)
      .map(
        (r) =>
          `  - ${r.errors} errors / sesión ${(r.sessionId ?? '?').slice(0, 8)} (${r.browser ?? '?'}, mobile=${r.isMobile ?? '?'})`,
      );
    return {
      title: `${rows.length} sesión(es) TTS con ≥10 errores en 5 min — circuit breaker eludido`,
      body: `El fix del 26/05 (lib/tts/engine.ts MAX_CONSECUTIVE_CHUNK_ERRORS=5) debería cortar tras 5 errores consecutivos. Si una sesión llega a 10+ errores, el breaker no funcionó:\n\n${lines.join('\n')}\n\nInvestigar:\n  - ¿onend OK entre errores está reseteando el contador indebidamente?\n  - ¿Hay un retry path nuevo que bypaseó el handler?\n  - ¿Cambió el shape del evento error tras refactor?`,
      metadata: {
        sessionsAffected: rows.length,
        topBrowsers: rows.map((r) => r.browser).filter(Boolean),
      },
    };
  },
  cooldownMin: 60,
};

/**
 * Hydration mismatch spike — si tras un deploy nuevo aparecen ≥5
 * hydration mismatches en 15 min agrupados por (endpoint, deploy_version),
 * hay regresión real. El test arquitectural
 * (__tests__/architecture/no-date-in-temario-client.test.ts) cubre
 * /temario/[slug]; esta regla detecta el resto del repo donde no llega
 * el guardarraíl.
 */
/**
 * LATENCIA SOSTENIDA en un endpoint de USUARIO (T-254).
 *
 * ## Por qué existe
 *
 * El 28/07/2026, entre las 09:30 y las 09:45 UTC, `/api/v2/answer-and-save` —el endpoint que
 * guarda la respuesta de cada test— estuvo a **p95 de 25.145 ms**, con 8 peticiones por encima
 * del corte de 15 s del cliente. El opositor estaba estudiando sobre una app que no le respondía.
 * No saltó ninguna alerta, y el panel de salud estaba en verde.
 *
 * No fue un fallo de umbral: el indicador `request_latency` agrega TODO el tráfico junto, y ese
 * endpoint es el 3% del volumen (1.803 peticiones de 55.919 al día). Medido a posteriori, el p95
 * global de esos mismos 15 minutos era **166 ms**. Un percentil sobre todo el tráfico no puede
 * ver la caída de un endpoint concreto, por muchos umbrales que se le pongan.
 *
 * ## Qué firma dispara, y por qué NO las dos obvias
 *
 * Los cubos reales del incidente fueron: 09:30 rojo (25.145 ms), 09:35 ámbar (4.732), 09:40 ámbar
 * (3.272), 09:45 severo pero con 6 muestras. Contra esa forma:
 *   - «≥2 endpoints en rojo a la vez» (firma de recurso compartido) LO PIERDE: los otros dos
 *     endpoints tocados no llegaban al mínimo de muestras, así que el único rojo era éste.
 *   - «≥2 cubos ROJOS seguidos» LO PIERDE también: solo un cubo pasó de 5.000 ms.
 *   - **≥2 cubos consecutivos en ámbar-o-peor con al menos uno rojo** lo caza, y con ella salen
 *     los tres incidentes que T-254 documenta (24, 27 y 28/07).
 *
 * Volumen medido sobre 7 días de producción con `scripts/sim-latencia-endpoints.ts`: **~1/día**.
 * Un detector que no caza su propio caso de origen no vale; uno que se enciende cada hora, tampoco.
 *
 * ## Paridad con el frontend
 *
 * Los umbrales, el tamaño del cubo, el mínimo de muestras y la lista de endpoints admin viven
 * también en `lib/api/admin/endpoint-latency.ts` y `lib/api/admin/endpoint-classification.ts`
 * (panel `/admin/salud-sistema`). El backend NO puede importarlos: su imagen Docker solo copia
 * `backend/src`. Esa duplicación es real y por eso está VIGILADA — `alert-rules.endpoint-latency.spec.ts`
 * lee los ficheros del frontend como texto y falla si los números divergen. Es el mismo problema
 * JS↔SQL que ya mordió en T-107 (el núcleo JS tenía una variante que RDS no, y el canary no lo
 * veía porque miraba una lista de fixtures vieja).
 */
export const RULE_ENDPOINT_LATENCY_SUSTAINED: AlertRule<{
  endpoint: string | null;
  desde: string | null;
  buckets: number;
  peorP95Ms: number;
}> = {
  name: 'endpoint_latency_sustained',
  severity: 'error',
  query: sql`
    WITH cubos AS (
      SELECT endpoint,
             to_timestamp(floor(extract(epoch FROM ts) / 300) * 300) AS cubo,
             COUNT(*)::int AS n,
             PERCENTILE_DISC(0.95) WITHIN GROUP (ORDER BY duration_ms)::int AS p95
        FROM observable_events
       WHERE event_type = 'request_completed'
         AND duration_ms IS NOT NULL
         AND endpoint IS NOT NULL
         AND ts > NOW() - INTERVAL '45 minutes'
       GROUP BY 1, 2
      HAVING COUNT(*) >= 10
    ),
    -- Solo endpoints de USUARIO. El espejo de ADMIN_ENDPOINT_PATTERNS
    -- (lib/api/admin/endpoint-classification.ts); el spec de paridad lo vigila.
    clasificados AS (
      SELECT *,
             CASE WHEN p95 >= 5000 THEN 'red'
                  WHEN p95 >= 2000 THEN 'amber'
                  ELSE 'green' END AS estado
        FROM cubos
       WHERE endpoint !~ '^/api/(admin|v2/admin|cron|debug|verify-articles|armando|health)(/|$)'
    ),
    malos AS (
      SELECT * FROM clasificados WHERE estado IN ('red', 'amber')
    ),
    -- Truco clásico de rachas: restar el nº de fila (en cubos) a la marca de tiempo deja una
    -- constante por cada tramo CONSECUTIVO, así que agrupar por ella son las rachas.
    rachas AS (
      SELECT *,
             cubo - (ROW_NUMBER() OVER (PARTITION BY endpoint ORDER BY cubo)) * INTERVAL '5 minutes'
               AS grupo
        FROM malos
    )
    SELECT endpoint,
           MIN(cubo)::text AS desde,
           COUNT(*)::int AS buckets,
           MAX(p95)::int AS "peorP95Ms"
      FROM rachas
     GROUP BY endpoint, grupo
    HAVING COUNT(*) >= 2 AND BOOL_OR(estado = 'red')
     ORDER BY MAX(p95) DESC
  `,
  shouldFire: (rows) => rows.length > 0,
  buildNotification: (rows) => {
    const lineas = rows.map(
      (r) =>
        `  - ${r.endpoint ?? '(desconocido)'}: ${r.buckets * 5} min degradado, peor p95 ${r.peorP95Ms} ms (desde ${r.desde ?? '?'})`,
    );
    const critico = rows.some((r) =>
      (r.endpoint ?? '').includes('answer-and-save'),
    );
    return {
      title: `Latencia sostenida en ${rows.length} endpoint(s) de usuario`,
      body:
        `Peticiones que TARDAN, no que fallan: son respuestas correctas que llegan tarde, así que ` +
        `el indicador de 5xx no las ve y el usuario sí.\n\n${lineas.join('\n')}\n\n` +
        (critico
          ? `⚠️ Está afectado /api/v2/answer-and-save: es el guardado de CADA respuesta de CADA test. ` +
            `El cliente corta a los 15 s, así que por encima de eso el opositor ve la app colgada.\n\n`
          : '') +
        `QUÉ MIRAR, en orden (playbook T-254 — la causa confirmada la vez anterior NO fue la BD):\n` +
        `  1. CPU del contenedor BACKEND. El 28/07 estaba al 96-100% mientras RDS iba al 8-20%: los\n` +
        `     @Cron corren en el mismo contenedor que sirve las peticiones, así que lo que se lleven\n` +
        `     ellos se lo quitan al opositor.\n` +
        `       aws --profile vence --region eu-west-2 cloudwatch get-metric-statistics \\\n` +
        `         --namespace AWS/ECS --metric-name CPUUtilization \\\n` +
        `         --dimensions Name=ClusterName,Value=vence-backend Name=ServiceName,Value=vence-backend \\\n` +
        `         --period 300 --statistics Average Maximum --start-time <T-1h> --end-time <ahora>\n` +
        `  2. ¿Coincide con una estampida de crons? El guardarraíl cron-colisiones.ts limita a 6 por\n` +
        `     minuto; si alguien añadió uno sin fase, vuelve a apilarse.\n` +
        `  3. Solo DESPUÉS, la BD: pool (max:5), pg_stat_activity, CPU/IOPS de RDS.\n` +
        `  4. Detalle por endpoint y cubo: /admin/salud-sistema → «Latencia por endpoint».\n\n` +
        `Ficha: docs/roadmap/tareas-pendientes.md [T-254]. Runbook: docs/runbooks/health-check.md.`,
      metadata: {
        endpoints: rows.length,
        peorP95Ms: Math.max(...rows.map((r) => r.peorP95Ms)),
      },
    };
  },
  cooldownMin: 60,
};

export const RULE_HYDRATION_MISMATCH_SPIKE: AlertRule<{
  endpoint: string | null;
  deployVersion: string | null;
  n: number;
}> = {
  name: 'hydration_mismatch_spike',
  severity: 'error',
  query: sql`
    SELECT endpoint,
           deploy_version AS "deployVersion",
           COUNT(*)::int AS n
    FROM observable_events
    WHERE event_type = 'react_hydration_mismatch'
      AND ts > NOW() - INTERVAL '15 minutes'
    GROUP BY endpoint, deploy_version
    HAVING COUNT(*) >= 5
  `,
  shouldFire: (rows) => rows.length > 0,
  buildNotification: (rows) => {
    const lines = rows.map(
      (r) =>
        `  - ${r.endpoint ?? '(unknown)'} [${r.deployVersion ?? '?'}]: ${r.n} mismatches`,
    );
    return {
      title: `${rows.length} ruta(s) con spike de hydration mismatch`,
      body: `React #418 / text content mismatch en producción. Suele ser un componente client que renderiza diferente en SSR vs CSR (timestamps, Date.now, Math.random, valores de localStorage sin guard SSR):\n\n${lines.join('\n')}\n\nInvestigar:\n  - grep "new Date()" en los componentes client de las rutas afectadas.\n  - Verificar que el último deploy no introdujo no-determinismo.\n  - Si es ruta /temario/[slug], el test arquitectural debería haber bloqueado; revisar coverage.`,
      metadata: { routesAffected: rows.length },
    };
  },
  cooldownMin: 60,
};

/**
 * Workflow failure burst (GHA) — ≥2 fallos del MISMO workflow en 30 min.
 * El 25/05 hubo 4 fallos seguidos de `frontend-deploy` (Bloque 5 Fase E.1)
 * que solo se vieron por email — esta regla los habría notificado
 * inmediatamente y de forma estructurada.
 */
export const RULE_WORKFLOW_FAILURE_BURST: AlertRule<{
  workflow: string | null;
  failures: number;
}> = {
  name: 'workflow_failure_burst',
  severity: 'error',
  // ⚠️ DOS NOMBRES, y el bueno no era el que se consultaba. El job de GHA
  // (.github/workflows/test.yml → «Notify failure to observable_events») emite
  // `workflow_failed`; esta regla preguntaba por `workflow_failure`. Medido el 28/07/2026:
  // **328 eventos `workflow_failed`** (el último, de ese mismo día) frente a **3
  // `workflow_failure`**, el último del 1 de julio. O sea, la regla llevaba CUATRO SEMANAS
  // escuchando un nombre muerto mientras los fallos reales de CI se apilaban sin avisar a nadie.
  // Se aceptan los dos: renombrar el emisor dejaría huérfanos los 328 ya escritos, y otros
  // emisores podrían usar cualquiera de los dos. La paridad emisor↔regla la vigila ahora
  // `__tests__/guardrails/ciAlertaCableada.test.ts`.
  query: sql`
    SELECT
      metadata->>'workflow' AS workflow,
      COUNT(*)::int AS failures
    FROM observable_events
    WHERE event_type IN ('workflow_failed', 'workflow_failure')
      AND ts > NOW() - INTERVAL '30 minutes'
    GROUP BY 1
    HAVING COUNT(*) >= 2
  `,
  shouldFire: (rows) => rows.length > 0,
  buildNotification: (rows) => {
    const lines = rows.map(
      (r) => `  - ${r.workflow ?? '(unknown)'}: ${r.failures} fallos`,
    );
    return {
      title: `${rows.length} workflow(s) GHA con fallos repetidos en 30 min`,
      body: `Probable problema persistente (no transitorio). Caso real del 25/05: 4 fallos de frontend-deploy por error en Docker build, solo nos enteramos por email:\n\n${lines.join('\n')}\n\nInvestigar en GitHub Actions o:\n\n  SELECT created_at, metadata->>'run_id' AS run, metadata->>'sha' AS sha, error_message\n  FROM observable_events\n  WHERE event_type='workflow_failure' AND ts > NOW() - INTERVAL '1 hour'\n  ORDER BY created_at DESC;`,
      metadata: { workflowsAffected: rows.length },
    };
  },
  cooldownMin: 30,
};

/**
 * Subscription drift — si el cron de reconciliación detecta usuarios con
 * subscription activa pero plan_type != premium, alertar.
 *
 * Origen: incidente 2026-05-26 — webhook Stripe roto durante horas, Andrea
 * pagó 20€ sin activarse, NADIE se enteró hasta que ella escribió al
 * soporte. El cron de reconciliación (.github/workflows/subscription-
 * reconciliation.yml, cada hora) detecta y corrige automáticamente, pero
 * queremos saberlo aunque corrija — si dispara seguido es señal de webhook
 * roto sostenidamente.
 *
 * Esta regla mira event_type='subscription_drift' emitido por el GHA wf
 * con metadata.detected = nº de inconsistencias. Si en última hora hubo
 * cualquier detection > 0, alertar.
 *
 * Limitación: no cubre el caso "Stripe tiene sub pero BD no tiene fila"
 * (caso Andrea exacto). Requiere ampliar el endpoint de reconciliación
 * para consultar Stripe API — pendiente como mejora futura.
 */
/**
 * `main` EN ROJO — un solo fallo basta, no hace falta racimo.
 *
 * La regla de racimo (2 en 30 min) está pensada para «algo falla repetido, mírrenlo». Pero un CI
 * rojo en `main` no es eso: es que **nadie puede commitear** (el pre-commit corre la misma suite
 * unit) **ni desplegar** (el gate exige CI verde de ese SHA). Un solo evento ya cuesta el trabajo de
 * todas las sesiones abiertas.
 *
 * Pasó tres veces el 28/07/2026, siempre igual: un detector entraba en el sweep CLI sin su espejo en
 * el @Cron, el guardarraíl de paridad se ponía rojo… y el aviso no salía por dos motivos a la vez —
 * el run se cancelaba por el push siguiente (arreglado en `test.yml`: `main` ya no cancela) y la
 * regla de racimo escuchaba un `event_type` muerto. Se enteraba la siguiente sesión, estrellándose.
 *
 * Solo `main`: en una rama de PR un CI rojo es normal y es asunto de quien la lleva.
 */
export const RULE_MAIN_CI_ROJO: AlertRule<{
  sha: string | null;
  workflow: string | null;
  run_url: string | null;
  cuando: string;
}> = {
  name: 'main_ci_rojo',
  severity: 'error',
  query: sql`
    SELECT
      deploy_version AS sha,
      metadata->>'workflow' AS workflow,
      metadata->>'runUrl' AS run_url,
      ts::text AS cuando
    FROM observable_events
    WHERE event_type IN ('workflow_failed', 'workflow_failure')
      AND metadata->>'ref' = 'refs/heads/main'
      AND ts > NOW() - INTERVAL '20 minutes'
    ORDER BY ts DESC
    LIMIT 5
  `,
  shouldFire: (rows) => rows.length > 0,
  buildNotification: (rows) => {
    const r = rows[0];
    return {
      title: `CI ROJO en main (${r.workflow ?? 'Tests'}) — nadie puede commitear ni desplegar`,
      body:
        `El commit ${r.sha ?? '(sha?)'} dejó \`main\` en rojo.\n\n` +
        `Consecuencia inmediata, y por eso esto avisa al primer fallo: el pre-commit de CADA sesión ` +
        `corre la misma suite unit, así que nadie puede commitear; y el gate de deploy exige CI verde ` +
        `de ese SHA, así que tampoco se puede desplegar.\n\n` +
        `Run: ${r.run_url ?? '(sin url)'}\n\n` +
        `Lo más habitual (3 veces el 28/07): un detector nuevo entra en \`scripts/health-sweep.cjs\` ` +
        `sin su espejo en \`backend/src/content-health-sweep\` y el guardarraíl de paridad lo caza. ` +
        `Se arregla añadiéndolo en los DOS sitios, no saltándose el hook.`,
      metadata: { sha: r.sha, workflow: r.workflow, runUrl: r.run_url },
    };
  },
  cooldownMin: 20,
  // Va por correo aunque el canal esté limitado a `critical` (T-272): su
  // severidad dice `error` pero su significado es "nadie puede commitear ni
  // desplegar". Coste de fatiga medido: 1 disparo en 7 días.
  emailAlways: true,
};

/**
 * T-370 (2026-07-31) — el gate de integración/perf/seguridad en rojo.
 *
 * Hermana de `main_ci_rojo`, y separada de ella A PROPÓSITO. Aquella dice «nadie puede
 * commitear ni desplegar», que es verdad para el CI de código; aquí sería mentira — este job
 * lleva `continue-on-error: true` y no bloquea nada. Una alerta que exagera se acaba ignorando,
 * y el problema que resuelve esta es justamente que **nadie miraba**.
 *
 * Por qué hacía falta: ese mismo `continue-on-error` impedía que el fallo del job hiciera
 * `failure()` en el workflow, así que `notify-failure` nunca corría y NO se emitía
 * `workflow_failed`. Resultado: la categoría estuvo ≥5 días sin verificar nada —invariantes de
 * `topic_scope`, entidad OEP, aislamiento entre usuarios, circuito de referidos (dinero),
 * guardarraíles anti-scraping— y el panel, en verde.
 *
 * Distingue las DOS causas, porque la respuesta es distinta:
 *   · `sin_base_de_datos` → no verificó NADA; se repone un secret (5 min, Settings del repo).
 *   · `tests_en_rojo`     → sí verificó y encontró cosas; hay que triarlas.
 */
export const RULE_CI_INTEGRACION_ROJO: AlertRule<{
  causa: string | null;
  sha: string | null;
  run_url: string | null;
}> = {
  name: 'ci_integracion_rojo',
  severity: 'error',
  query: sql`
    SELECT metadata->>'causa' AS causa,
           deploy_version AS sha,
           metadata->>'runUrl' AS run_url
    FROM observable_events
    WHERE event_type = 'ci_integracion_rojo'
      AND metadata->>'ref' = 'refs/heads/main'
      AND ts > NOW() - INTERVAL '90 minutes'
    ORDER BY ts DESC
    LIMIT 1
  `,
  shouldFire: (rows) => rows.length > 0,
  buildNotification: (rows) => {
    const r = rows[0];
    const sinBd = r?.causa === 'sin_base_de_datos';
    const landings = r?.causa === 'landings_incoherentes';
    const explicacion = sinBd
      ? `El job corrió SIN base de datos: el secret \`DATABASE_URL_READONLY\` no existe o está ` +
        `vacío, así que la categoría entera pasó de largo sin comprobar nada.\n\n` +
        `Se repone en Settings → Secrets and variables → Actions.\n\n`
      : landings
        ? `Falló el gate de coherencia de landings PUBLICADAS: hay alguna servida a medias, con el ` +
          `botón oficial apuntando a otro boletín, o con una cifra que no cuadra con la BD. ` +
          `Frase-gatillo: «audita la landing».\n\n`
        : `El job corrió CON base de datos y hay tests en rojo. Aquí el rojo es información: ` +
          `conviene mirar cuáles antes de suponer que son «los de siempre».\n\n`;
    return {
      title: sinBd
        ? 'El gate de integración NO está verificando nada (le falta la BD)'
        : landings
          ? 'Hay una landing publicada incoherente (gate de coherencia en rojo)'
          : 'El gate de integración/perf/seguridad está en rojo',
      body:
        explicacion +
        `Lo que deja de vigilarse mientras tanto: invariantes de \`topic_scope\`, integridad de la ` +
        `entidad OEP, aislamiento entre usuarios, el circuito de referidos (dinero) y los ` +
        `guardarraíles anti-scraping.\n\n` +
        `OJO: este job NO bloquea merges ni deploys (\`continue-on-error: true\`), así que si nadie ` +
        `lee este aviso no lo va a parar nada — es exactamente como estuvo ≥5 días en silencio.\n\n` +
        `Commit: ${r?.sha ?? '(sha?)'}\nRun: ${r?.run_url ?? '(sin url)'}`,
      metadata: { causa: r?.causa ?? null, sha: r?.sha ?? null, runUrl: r?.run_url ?? null },
    };
  },
  // 12 h: es un estado persistente (mientras el secret falte, cada push lo repite). Un aviso al
  // día basta para que no se olvide, sin convertirlo en ruido que se filtra a la papelera.
  cooldownMin: 720,
};

export const RULE_SUBSCRIPTION_DRIFT: AlertRule<{
  detected: number;
  fixed: number;
  lastRun: Date;
}> = {
  name: 'subscription_drift',
  severity: 'warn',
  query: sql`
    SELECT
      COALESCE((metadata->>'detected')::int, 0) AS detected,
      COALESCE((metadata->>'fixed')::int, 0) AS fixed,
      ts AS "lastRun"
    FROM observable_events
    WHERE event_type = 'subscription_drift'
      AND ts > NOW() - INTERVAL '1 hour'
    ORDER BY ts DESC
    LIMIT 1
  `,
  shouldFire: (rows) => rows.length > 0 && rows[0].detected > 0,
  buildNotification: (rows) => {
    const r = rows[0];
    return {
      title: `Subscription drift detectado: ${r.detected} inconsistencias (${r.fixed} corregidas auto)`,
      body: `El cron de reconciliación detectó ${r.detected} usuarios con subscription activa pero plan_type != premium. ${r.fixed} se corrigieron automáticamente.\n\nSi esto se repite cada hora, el webhook Stripe puede estar fallando — investigar Stripe Dashboard → Webhooks → /api/stripe/webhook.\n\nIncidente origen: 2026-05-26 (webhook roto silenciosamente, Andrea pagó sin activarse).`,
      metadata: { detected: r.detected, fixed: r.fixed, lastRun: r.lastRun },
    };
  },
  cooldownMin: 60,
};

/**
 * Webhook Stripe unhealthy — disparada por el cron check-webhook-health
 * (/api/cron/check-webhook-health, cada 15min). Emite evento
 * 'webhook_unhealthy' cuando >10% de eventos Stripe en última hora siguen
 * pending → indica que el webhook responde non-2xx sostenidamente.
 *
 * Origen: incidente 2026-05-26 (Andrea pagó 20€ sin activarse). Detecta
 * en <15min en vez de "cuando un usuario escriba al soporte".
 */
export const RULE_WEBHOOK_UNHEALTHY: AlertRule<{
  pendingPct: number;
  pending: number;
  total: number;
  oldestType: string | null;
  oldestAgeS: number | null;
  unhealthyAccounts: string | null;
}> = {
  name: 'webhook_unhealthy',
  severity: 'error',
  query: sql`
    SELECT
      (metadata->>'pending_pct')::numeric AS "pendingPct",
      (metadata->>'pending_events_1h')::int AS pending,
      (metadata->>'total_events_1h')::int AS total,
      metadata->>'oldest_pending_type' AS "oldestType",
      (metadata->>'oldest_pending_age_s')::int AS "oldestAgeS",
      metadata->>'unhealthy_accounts' AS "unhealthyAccounts"
    FROM observable_events
    WHERE event_type = 'webhook_unhealthy'
      AND ts > NOW() - INTERVAL '30 minutes'
    ORDER BY ts DESC
    LIMIT 1
  `,
  shouldFire: (rows) => rows.length > 0,
  buildNotification: (rows) => {
    const r = rows[0];
    // Las cuentas se evalúan por separado: el fallo puede ser de UNA sola
    // (cada cuenta tiene su propio signing secret). Nombrarla ahorra el paso
    // de adivinar en qué dashboard mirar.
    const cuentas = r.unhealthyAccounts
      ? ` [cuenta(s): ${r.unhealthyAccounts}]`
      : '';
    return {
      title: `Webhook Stripe unhealthy${cuentas}: ${r.pending}/${r.total} eventos pending (${r.pendingPct}%)`,
      body: `El cron check-webhook-health detectó que ${r.pendingPct}% de los eventos Stripe en la última hora siguen pending${cuentas}. Investigar inmediatamente:\n\n  - Evento más antiguo pending: ${r.oldestType ?? 'unknown'} (${r.oldestAgeS ?? '?'}s)\n  - Stripe Dashboard de la cuenta afectada → Webhooks → /api/stripe/webhook → tab "Webhook attempts"\n  - Cada cuenta tiene su propio webhook secret (STRIPE_WEBHOOK_SECRET / _NILA): un fallo de firma afecta solo a la suya.\n\nIncidente origen 2026-05-26: webhook respondía 400 a todos los eventos por un bug en withErrorLogging consumiendo el raw body. Andrea pagó 20€ sin activarse.`,
      metadata: {
        pendingPct: r.pendingPct,
        pending: r.pending,
        total: r.total,
      },
    };
  },
  cooldownMin: 15,
};

/**
 * Rutas donde un 5xx significa **alguien que quiso pagar y no pudo**.
 *
 * Es la lista que decide qué vigila `RULE_STRIPE_CHECKOUT_FAILED`, y está aquí arriba
 * —exportada— porque el guardarraíl `__tests__/guardrails/rutasCobroVigiladas.test.ts`
 * (frontend) la LEE de este fichero y comprueba que toda ruta de `app/api` que acaba
 * hablando con Stripe cae dentro de alguno de estos patrones. Así un endpoint de cobro
 * nuevo **nace vigilado** en vez de estrenarse mudo.
 *
 * Por qué existe la segunda entrada (T-341, 31/07/2026): el camino de pago dejó de vivir
 * solo en `/api/stripe/*`. `POST /api/v2/premium/recuperar-precio` crea price, enlace de
 * pago y oferta, y su primera versión devolvía **500 en el primer clic de cualquier
 * afectado** por un `ON CONFLICT` que no casaba con el índice parcial. Con la regla
 * mirando únicamente `/api/stripe/%`, ese fallo habría sido **invisible en producción**:
 * lo cazó una prueba manual contra datos reales, que es justo lo que no se puede repetir
 * cada día.
 */
export const PATRONES_RUTA_COBRO = ['/api/stripe/%', '/api/v2/premium/%'] as const;

/**
 * Fallos 5xx en los caminos de cobro — cada error = un cliente que
 * intentó pagar y no pudo. Threshold bajo (>=3 en 10min) porque el
 * coste por fallo es directo en ingresos.
 *
 * El nombre de la regla se conserva (`stripe_checkout_failed`) aunque ya cubra más que el
 * checkout: es el identificador con el que se casan el cooldown y las alertas históricas.
 *
 * Origen: incidente 2026-05-27 — bug del Dockerfile (ARG NEXT_PUBLIC_STRIPE_PRICE_*
 * faltante) dejó 'price_quarterly_placeholder' inlinado en el bundle JS
 * de /premium. Usuario tamalla.240@gmail.com (iPhone) intentó 8 veces
 * comprar premium quarterly entre 06:10-06:34 CEST y todas fallaron con
 * resource_missing. Detectado horas después por revisión manual de
 * observable_events. Si esta regla hubiera existido, alerta a los ~5min
 * del 3er fallo.
 */
export const RULE_STRIPE_CHECKOUT_FAILED: AlertRule<{
  n: number;
  topEndpoint: string | null;
}> = {
  name: 'stripe_checkout_failed',
  severity: 'critical',
  query: sql`
    SELECT COUNT(*)::int AS n,
           MODE() WITHIN GROUP (ORDER BY endpoint) AS "topEndpoint"
    FROM observable_events
    WHERE source = 'vercel'
      AND http_status >= 500
      AND endpoint LIKE ANY (${sql.raw(`ARRAY[${PATRONES_RUTA_COBRO.map((p) => `'${p}'`).join(', ')}]`)})
      AND ts > NOW() - INTERVAL '10 minutes'
  `,
  shouldFire: (rows) => (rows[0]?.n ?? 0) >= 3,
  buildNotification: (rows) => {
    const n = rows[0]?.n ?? 0;
    const top = rows[0]?.topEndpoint ?? '/api/stripe/*';
    return {
      title: `${n} fallos en checkout Stripe en 10min — clientes perdidos`,
      body: `Endpoint: ${top}\n\nCada 5xx en un camino de cobro (${PATRONES_RUTA_COBRO.join(', ')}) es un usuario que intentó pagar y no pudo. Investigar en:\n\n  - SELECT ts, endpoint, http_status, error_message, metadata FROM observable_events\n    WHERE endpoint LIKE ANY (ARRAY['${PATRONES_RUTA_COBRO.join("', '")}']) AND http_status >= 500\n      AND ts > NOW() - INTERVAL '15 minutes'\n    ORDER BY ts DESC LIMIT 10;\n  - CloudWatch /ecs/vence-frontend filter "Error creando" OR "Stripe"\n  - Stripe Dashboard → Logs → recent failures\n\nIncidente origen 2026-05-27: bug del Dockerfile dejó 'price_quarterly_placeholder' en el bundle. Usuario perdió 8 intentos de checkout antes de rendirse. Sin esta regla, lo detectamos horas después manualmente.`,
      metadata: { count: n, topEndpoint: top, windowMin: 10 },
      fingerprint: `stripe_checkout_failed_${top}`,
    };
  },
  cooldownMin: 30,
};

/**
 * Cliente **bloqueado** en un camino de cobro: intentó pagar y la autorización le dijo que no.
 *
 * ## Por qué NO basta con `RULE_STRIPE_CHECKOUT_FAILED`
 *
 * Aquella cuenta 5xx: el servidor se rompió. Ésta cuenta lo contrario — el servidor funcionó
 * perfectamente y **decidió no dejarle pagar**. Para el negocio son la misma pérdida, y hasta
 * hoy la segunda no la miraba nadie.
 *
 * ## El caso que la motiva (31/07/2026)
 *
 * `rdiazprados@gmail.com` intentó comprar premium **17 veces entre las 05:54 y las 06:04** y
 * recibió 403 en todas. Su sesión era válida; lo que fallaba es que su navegador mandaba en el
 * cuerpo un `userId` que **ya no existe en la base de datos**, y el contraste de identidad de
 * T-340 cortaba. Acabó pagando a las 06:10, probablemente tras recargar. **Cero alertas
 * durante esos diez minutos**: se descubrió al revisar señales a mano, un día después.
 *
 * Umbral bajo (3 en 10 min) por la misma razón que su hermana: tres rechazos seguidos en la
 * pantalla de pago ya son una persona peleándose con la aplicación, no un fallo aislado.
 */
export const RULE_COBRO_BLOQUEADO_AUTH: AlertRule<{
  n: number;
  topEndpoint: string | null;
  usuarios: number;
}> = {
  name: 'cobro_bloqueado_auth',
  severity: 'critical',
  query: sql`
    SELECT COUNT(*)::int AS n,
           COUNT(DISTINCT user_id)::int AS usuarios,
           MODE() WITHIN GROUP (ORDER BY endpoint) AS "topEndpoint"
    FROM observable_events
    WHERE event_type = 'auth_identidad_ajena_rechazada'
      AND endpoint LIKE ANY (${sql.raw(`ARRAY[${PATRONES_RUTA_COBRO.map((p) => `'${p}'`).join(', ')}]`)})
      AND ts > NOW() - INTERVAL '10 minutes'
  `,
  shouldFire: (rows) => (rows[0]?.n ?? 0) >= 3,
  buildNotification: (rows) => {
    const n = rows[0]?.n ?? 0;
    const top = rows[0]?.topEndpoint ?? '/api/stripe/*';
    const usuarios = rows[0]?.usuarios ?? 0;
    return {
      title: `${n} intentos de pago BLOQUEADOS en 10min (${usuarios} usuario/s) — no es un 5xx, es un «no»`,
      body:
        `Endpoint: ${top}\n\n` +
        `El servidor funcionó y aun así no les dejó pagar: el id que manda su navegador no coincide con el de su sesión. ` +
        `Lo normal es un cliente desincronizado (pestaña vieja, cuenta cambiada, identidad cacheada de un usuario que ya no existe), ` +
        `y se arregla recargando — pero mientras tanto NO puede comprar.\n\n` +
        `  SELECT ts, endpoint, user_id, metadata->>'afirmado' AS id_que_manda_el_cliente\n` +
        `  FROM observable_events WHERE event_type='auth_identidad_ajena_rechazada'\n` +
        `    AND ts > NOW() - INTERVAL '30 minutes' ORDER BY ts DESC;\n\n` +
        `Comprobar primero si ese id EXISTE en user_profiles: si no existe, es un cliente rancio y no un intento de abuso.\n\n` +
        `Origen 31/07/2026: 17 intentos bloqueados en 10 minutos, cero alertas, detectado a mano al día siguiente.`,
      metadata: { count: n, topEndpoint: top, usuarios, windowMin: 10 },
      fingerprint: `cobro_bloqueado_auth_${top}`,
    };
  },
  cooldownMin: 30,
};

/**
 * Caída brutal de tráfico — proxy de salud del frontend.
 *
 * Origen: incidente 2026-05-26 — entre 12:00-13:00 UTC el tráfico
 * cayó de 1272 req/h a 74 (94% caída) por OOM/crash loop ECS, y entre
 * 16:00-17:00 cayó de 1250 a 370 (70% caída) por 4 deploys frontend
 * fallidos consecutivos. Lidia y mbcapitas intentaron pagar durante
 * esos lapsos y pulsaron "Pagar" sin resultado. NADIE se enteró desde
 * la observabilidad — Andrea escribió cuando ya había pagado y no se
 * activó.
 *
 * Lógica (revisada 2026-05-27 tras 10 falsos positivos nocturnos):
 * comparar la hora previa cerrada contra la mediana de la MISMA HORA
 * DEL DÍA en los últimos 7 días (excluyendo hoy). Esto neutraliza el
 * patrón diurno — antes la regla comparaba la última hora (madrugada,
 * ~50 req) contra mediana de 6h anteriores (que incluían inicio de
 * noche con ~800 req) → 90% falsa caída cada noche entre 01:00 y 08:00
 * CEST. Spam de 10 emails CRITICAL madrugada del 27/05.
 *
 * Threshold de baseline > 30 req: si la app no tiene actividad ni
 * siquiera en su hora normal, no es un drop accionable (probable
 * apagado/maintenance ventana, no incidente).
 *
 * Excluye `/api/auth/token` de AMBAS ventanas (fix 21/07/2026): ese endpoint
 * es polling de infraestructura del cliente, NO tráfico de usuario. El fix de
 * caché del token (authjsAdapter, ~15-16/07) hizo que el cliente dejara de
 * re-acuñar en cada poll → el volumen de `/api/auth/token` cayó ~40× (de
 * ~94k/día a ~2k/día) SIN caída de tráfico real. Como ese endpoint dominaba el
 * conteo de `request_completed`, `cur` se hundía muy por debajo del baseline
 * (que aún incluía la era pre-caché) → spam "Tráfico HTTP cayó 74% — frontend
 * probablemente caído" cada hora toda la noche, con el ALB sirviendo 60k req/h.
 * Excluirlo mide tráfico de USUARIO real (el no-token cayó solo ~16% WoW, ruido
 * normal). Se excluye de las dos CTEs para no descuadrar la comparación WoW.
 *
 * Warm-up de 7 días: si el slot horario no tiene >=1 muestra histórica
 * (observable_events empezó 2026-05-26), base.median = NULL y el WHERE
 * no se cumple → no dispara. Tradeoff aceptado: durante warm-up la
 * regla queda silente pero sin falsos positivos. Otras reglas
 * (RULE_HTTP_5XX_SPIKE, RULE_RUNTIME_KILL, monitor post-deploy
 * manual) cubren detección de incidentes mientras tanto.
 *
 * Excluye localhost (dev). Excluye la hora en curso (incompleta).
 */
export const RULE_TRAFFIC_DROP: AlertRule<{
  currentN: number;
  baselineMedian: number;
  dropPct: number;
}> = {
  name: 'traffic_drop',
  severity: 'critical',
  query: sql`
    WITH cur AS (
      -- Hora previa cerrada (la que ya tenemos completa)
      SELECT COUNT(*)::int AS n
      FROM observable_events
      WHERE event_type = 'request_completed'
        AND ts >= date_trunc('hour', NOW() - INTERVAL '1 hour')
        AND ts <  date_trunc('hour', NOW())
        AND endpoint IS DISTINCT FROM '/api/auth/token'
        AND (metadata->>'host' IS NULL OR metadata->>'host' NOT LIKE 'localhost%')
    ),
    same_hour_history AS (
      -- Misma hora-del-día UTC + mismo DÍA-DE-SEMANA, últimos 28 días.
      -- Fix 30/05/2026: la versión anterior comparaba con cualquier día → en
      -- fin de semana disparaba falsos positivos "tráfico cayó 70%" porque la
      -- mediana incluía días laborables con más tráfico. Recibimos 11 alertas
      -- traffic_drop el sábado 30/05 entre 07-11 UTC. Comparar sábado vs
      -- sábados pasados elimina el ruido del weekend.
      -- REESCRITO 27/07/2026 (T-173) — MISMO RESULTADO, 950x MAS RAPIDO.
      -- Antes esto pedia 29 dias y se quedaba con las 4 horas que casaban por
      -- funciones de extraccion de hora y dia-de-semana. Esas funciones NO son
      -- indexables, asi que Postgres barria los 4.085.645 request_completed de
      -- 29 dias para devolver 4 filas: 60.718 ms, muy por encima del
      -- statement_timeout de 20 s del pool de la replica. Resultado: la regla
      -- llevaba mas de 24 h sin evaluarse (255 fallos en 24 h) y NADIE se
      -- enteraba de una caida de trafico.
      -- Ahora se piden las 4 ventanas de una hora directamente por RANGO sobre
      -- ts (hace 7, 14, 21 y 28 dias son, por definicion, el mismo dia de la
      -- semana y la misma hora), que si usa idx_observable_events_ts_desc.
      -- Medido en la replica: mediana 64 ms, peor caso en frio 1.636 ms.
      -- Equivalencia comprobada con DATOS REALES, no por razonamiento: las dos
      -- versiones devuelven las mismas 4 franjas con los mismos conteos
      -- (1638, 1199, 1132, 953).
      --
      -- De paso desaparece el FLOOR de regimen del sampling, que existia porque
      -- el baseline de 29 dias aun alcanzaba la era pre-sampling (10% de
      -- request_completed desde finales de mayo) y provocaba spam de "cayo
      -- 70-80%". Su propio comentario pedia eliminarlo pasado finales de junio;
      -- con ventanas de 7 a 28 dias ya es imposible tocar aquella era.
      SELECT date_trunc('hour', ts) AS hr, COUNT(*)::int AS n
      FROM observable_events
      WHERE event_type = 'request_completed'
        AND (
             (ts >= date_trunc('hour', NOW() - INTERVAL '1 hour') - INTERVAL '7 days'
              AND ts < date_trunc('hour', NOW()) - INTERVAL '7 days')
          OR (ts >= date_trunc('hour', NOW() - INTERVAL '1 hour') - INTERVAL '14 days'
              AND ts < date_trunc('hour', NOW()) - INTERVAL '14 days')
          OR (ts >= date_trunc('hour', NOW() - INTERVAL '1 hour') - INTERVAL '21 days'
              AND ts < date_trunc('hour', NOW()) - INTERVAL '21 days')
          OR (ts >= date_trunc('hour', NOW() - INTERVAL '1 hour') - INTERVAL '28 days'
              AND ts < date_trunc('hour', NOW()) - INTERVAL '28 days')
        )
        AND endpoint IS DISTINCT FROM '/api/auth/token'
        AND (metadata->>'host' IS NULL OR metadata->>'host' NOT LIKE 'localhost%')
      GROUP BY 1
    ),
    base AS (
      SELECT PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY n)::int AS median
      FROM same_hour_history
    )
    SELECT
      cur.n AS "currentN",
      base.median AS "baselineMedian",
      ROUND(100.0 * (1 - cur.n::numeric / NULLIF(base.median,0)))::int AS "dropPct"
    FROM cur, base
    WHERE base.median > 30
      AND cur.n < base.median * 0.4
  `,
  shouldFire: (rows) => rows.length > 0,
  buildNotification: (rows) => {
    const r = rows[0];
    return {
      title: `Tráfico HTTP cayó ${r.dropPct}% — frontend probablemente caído`,
      body: `Última hora: ${r.currentN} req. Mediana misma hora/día (28d, post-sampling): ${r.baselineMedian} req. Caída del ${r.dropPct}%.\n\nProbables causas:\n  - OOM / crash loop en frontend ECS (mirar CloudWatch ECS metrics)\n  - Deploy reciente caído (cobertura: regla 'workflow_failure_burst')\n  - Incidente Vercel o Supabase\n  - DNS / red\n\nIncidente origen 2026-05-26: dos caídas brutales (94% y 70%) durante las cuales Lidia, mbcapitas y otros intentaron pagar y los clicks "Pagar" no producían redirect a Stripe.`,
      metadata: {
        currentN: r.currentN,
        baselineMedian: r.baselineMedian,
        dropPct: r.dropPct,
      },
    };
  },
  cooldownMin: 30,
};

/**
 * Cancel-flow void invoice failed — cualquier ocurrencia de
 * `subscription_void_invoice_failed` indica que el path past_due/unpaid
 * de cancelSubscription NO pudo voidear una invoice abierta. Consecuencia
 * real: Stripe SIGUE intentando cobrar al usuario en background tras
 * "cancelar". Caso Mariangeles 21/05/2026: 7 intentos de cancel fallaron,
 * ella esperó 5 días viendo los emails de payment_failed antes de pedir
 * borrado de cuenta.
 *
 * Disparo INMEDIATO con N≥1 (no acumulamos, cada fallo es un usuario con
 * cobros activos pendientes).
 */
export const RULE_SUBSCRIPTION_VOID_FAILED: AlertRule<{
  n: number;
  topUser: string | null;
  lastError: string | null;
}> = {
  name: 'subscription_void_failed',
  severity: 'error',
  query: sql`
    SELECT COUNT(*)::int AS n,
           MODE() WITHIN GROUP (ORDER BY user_id) AS "topUser",
           (ARRAY_AGG(error_message ORDER BY ts DESC))[1] AS "lastError"
    FROM observable_events
    WHERE event_type = 'subscription_void_invoice_failed'
      AND ts > NOW() - INTERVAL '15 minutes'
  `,
  shouldFire: (rows) => (rows[0]?.n ?? 0) > 0,
  buildNotification: (rows) => {
    const r = rows[0];
    return {
      title: `${r.n} void(s) de invoice fallido(s) en 15 min — usuarios siguen recibiendo cobros`,
      body: `cancelSubscription en modo immediate intentó voidear invoices abiertas y falló. El usuario afectado tiene cancelaciones contabilizadas pero Stripe seguirá reintentando charge_automatically hasta agotar smart retries (~3 semanas).\n\nUsuario top: ${(r.topUser ?? '?').slice(0, 8)}\nÚltimo error Stripe: ${r.lastError ?? '(n/a)'}\n\nAcciones:\n  1. /admin/salud-sistema → buscar el user_id y verificar estado en Stripe Dashboard.\n  2. Void manual desde dashboard si la invoice sigue abierta.\n  3. SELECT user_id, metadata->>'subscriptionId' AS sub, metadata->>'invoiceId' AS inv\n     FROM observable_events WHERE event_type='subscription_void_invoice_failed'\n     AND ts > NOW() - INTERVAL '1 hour';`,
      metadata: { count: r.n, topUser: r.topUser, lastError: r.lastError },
      fingerprint: `void_failed_${r.topUser ?? 'any'}`,
    };
  },
  cooldownMin: 30,
};

/**
 * Cancel-flow force-cancel burst — > 5 cancelaciones inmediatas
 * (past_due/unpaid/incomplete) en 1h indica un problema sistémico de
 * cobros (gateway de pago degradado, tarjetas masivamente caducadas tras
 * cambio anual, etc.). Si la tasa diaria normal es ~1-2, un burst de 5+
 * en 1h merece investigación inmediata.
 */
export const RULE_SUBSCRIPTION_FORCE_CANCEL_BURST: AlertRule<{ n: number }> = {
  name: 'subscription_force_cancel_burst',
  severity: 'warn',
  query: sql`
    SELECT COUNT(*)::int AS n
    FROM observable_events
    WHERE event_type = 'subscription_force_canceled_past_due'
      AND ts > NOW() - INTERVAL '1 hour'
  `,
  shouldFire: (rows) => (rows[0]?.n ?? 0) >= 5,
  buildNotification: (rows) => {
    const n = rows[0]?.n ?? 0;
    return {
      title: `${n} cancelaciones forzadas (past_due/unpaid) en 1h — posible problema de cobros sistémico`,
      body: `cancelSubscription tuvo que cancelar inmediatamente ${n} subscripciones que ya estaban en past_due/unpaid/incomplete. La tasa normal es <2/h. Posibles causas:\n  - Gateway de pago Stripe degradado (mirar status.stripe.com)\n  - Caducidad masiva de tarjetas (típico inicio de año/mes)\n  - Cambio en políticas anti-fraude del banco\n\nInvestigar:\n  SELECT user_id, metadata->>'originalStatus' AS status, ts\n  FROM observable_events WHERE event_type='subscription_force_canceled_past_due'\n  AND ts > NOW() - INTERVAL '2 hours' ORDER BY ts DESC;`,
      metadata: { count: n, windowMin: 60 },
    };
  },
  cooldownMin: 60,
};

/**
 * Cancel endpoint error burst — ≥3 errores no controlados (excepciones)
 * en /api/stripe/cancel en 15 min. Cualquier excepción que escape del
 * try/catch principal de cancelSubscription emite este evento. Si pasa
 * a la vez varias veces, la API de Stripe puede estar caída o nuestro
 * código tiene un bug que afecta a varios usuarios.
 */
export const RULE_SUBSCRIPTION_CANCEL_ERROR_BURST: AlertRule<{
  n: number;
  lastMsg: string | null;
}> = {
  name: 'subscription_cancel_error_burst',
  severity: 'error',
  query: sql`
    SELECT COUNT(*)::int AS n,
           (ARRAY_AGG(error_message ORDER BY ts DESC))[1] AS "lastMsg"
    FROM observable_events
    WHERE event_type = 'subscription_cancel_error'
      AND ts > NOW() - INTERVAL '15 minutes'
  `,
  shouldFire: (rows) => (rows[0]?.n ?? 0) >= 3,
  buildNotification: (rows) => {
    const r = rows[0];
    return {
      title: `${r.n} errores en /api/stripe/cancel en 15 min`,
      body: `Excepciones no controladas en cancelSubscription. Probable: API Stripe degradada o regresión del código.\n\nÚltimo mensaje: ${r.lastMsg ?? '(n/a)'}\n\nInvestigar:\n  - status.stripe.com\n  - SELECT user_id, error_message, metadata, ts FROM observable_events\n    WHERE event_type='subscription_cancel_error' AND ts > NOW() - INTERVAL '1 hour'\n    ORDER BY ts DESC;`,
      metadata: { count: r.n, lastMsg: r.lastMsg },
    };
  },
  cooldownMin: 30,
};

/**
 * Subscription drift "missing in DB" — el caso Andrea exacto.
 *
 * El cron de reconciliation Pass-2 (post-27/05/2026) consulta Stripe directo
 * y compara contra user_subscriptions. Si encuentra suscripciones active en
 * Stripe sin fila en BD, emite este evento con `detected: N`. Eso significa
 * usuarios que han PAGADO pero NO se ha aplicado premium — probable webhook
 * roto silenciosamente.
 *
 * Disparo: detected > 0. El cron además auto-arregla (INSERT fila + UPDATE
 * profile.plan_type), por eso la severity es 'error' no 'critical' — el
 * daño está mitigado, pero el bug raíz (webhook) sigue ahí y hay que
 * investigarlo igual.
 *
 * Caso real: 27/05/2026 — STRIPE_WEBHOOK_SECRET desincronizado tras redeploy.
 * Rocío + Mercedes pagaron sin que se aplicara premium. Detectado solo por
 * feedback al chat. Con esta regla + el Pass-2 del cron: detección y auto-fix
 * en ≤1h sin intervención humana.
 */
export const RULE_SUBSCRIPTION_DRIFT_MISSING_IN_DB: AlertRule<{
  detected: number;
  fixed: number;
  affectedAccounts: string | null;
}> = {
  name: 'subscription_drift_missing_in_db',
  severity: 'error',
  query: sql`
    SELECT
      COALESCE((metadata->>'detected')::int, 0) AS detected,
      COALESCE((metadata->>'fixed')::int, 0) AS fixed,
      metadata->>'affected_accounts' AS "affectedAccounts"
    FROM observable_events
    WHERE event_type = 'subscription_drift_missing_in_db'
      AND ts > NOW() - INTERVAL '2 hours'
    ORDER BY ts DESC
    LIMIT 1
  `,
  // Sigue disparando SOLO con pagos sin sincronizar. Desde el multi-cuenta
  // (29/07/2026) el cron emite este mismo event_type con detected=0 y
  // severity=warn cuando una cuenta Stripe no se pudo reconciliar (sin key /
  // API caída): eso NO manda email — se ve en /admin/salud-sistema junto al
  // warn equivalente de check-webhook-health, que reporta la misma
  // misconfiguración. Un tercer aviso por correo cada 30min sería ruido.
  shouldFire: (rows) => (rows[0]?.detected ?? 0) > 0,
  buildNotification: (rows) => {
    const r = rows[0];
    // Cada cuenta tiene su propio webhook y su propio dashboard: nombrarla
    // ahorra el paso de adivinar dónde mirar.
    const cuentas = r.affectedAccounts
      ? ` [cuenta(s): ${r.affectedAccounts}]`
      : '';
    return {
      title: `${r.detected} pago(s) procesado(s) en Stripe sin sincronizar a BD${cuentas} (${r.fixed} auto-fix)`,
      body: `El cron de reconciliation Pass-2 detectó suscripciones active en Stripe que NO estaban en user_subscriptions de BD — significa que el WEBHOOK STRIPE está roto y usuarios pagan sin recibir premium.\n\nCuenta(s) afectada(s): ${r.affectedAccounts ?? 'sin determinar'}.\n\nLas ${r.fixed} se han auto-corregido (fila en user_subscriptions + perfil a premium con su stripe_customer_id y payment_account). El daño al usuario está mitigado.\n\nPERO el bug raíz (webhook) sigue: investigar /api/stripe/webhook URGENTE.\n\n  - Dashboard de Stripe de la cuenta afectada → Webhooks → endpoint vence-produccion → ¿% de errores?\n  - Cada cuenta tiene su propio signing secret (STRIPE_WEBHOOK_SECRET / _NILA): el fallo puede ser de una sola.\n  - Si signature failed: ver regla stripe_webhook_signature_failed (runbook para rotar secret).\n  - Si 4xx no-signature: ver stripe_webhook_4xx_burst.\n\nIncidente origen: 2026-05-27 (Rocío/Mercedes/Andrea).`,
      metadata: {
        detected: r.detected,
        fixed: r.fixed,
        accounts: r.affectedAccounts,
      },
      fingerprint: 'subscription_drift_missing_in_db',
    };
  },
  cooldownMin: 30,
};

/**
 * Premium sin respaldo de pago — la dirección que NINGUNA de las otras 8 reglas vigilaba.
 *
 * Todas las reglas de suscripciones protegen al usuario (que no se quede sin lo que pagó) o
 * vigilan la maquinaria. Ninguna miraba lo contrario. Caso real del 29/07/2026: un cliente
 * canceló desde la app el 26/05, Stripe terminó la suscripción el 27/05, la fila se quedó en
 * `active` y el perfil en premium — dos meses y 293 tests regalados. Y el Pass-1, al ver la fila
 * activa, le renovaba el premium cada hora: la auto-reparación trabajaba a favor de la fuga.
 *
 * severity=warn a propósito: aquí NO hay daño a un usuario, hay dinero escapándose. Mezclarlo con
 * los errores de pago no aplicado (que sí dejan a alguien sin lo suyo) haría que se atendieran
 * con la misma urgencia dos cosas que se arreglan de forma distinta.
 *
 * El Pass-3 solo DETECTA. Quitar premium afecta a una persona real y puede tener una razón que no
 * está en la BD (compensación, colaborador): lo confirma un humano, y si es legítimo se declara
 * con `user_profiles.premium_grant_reason`, que es justo lo que saca al caso de este listado.
 */
export const RULE_PREMIUM_SIN_RESPALDO: AlertRule<{
  detected: number;
  porMotivo: string | null;
}> = {
  name: 'premium_sin_respaldo',
  severity: 'warn',
  query: sql`
    SELECT
      COALESCE((metadata->>'detected')::int, 0) AS detected,
      metadata->'por_motivo'::text AS "porMotivo"
    FROM observable_events
    WHERE event_type = 'premium_sin_respaldo'
      AND ts > NOW() - INTERVAL '2 hours'
    ORDER BY ts DESC
    LIMIT 1
  `,
  shouldFire: (rows) => (rows[0]?.detected ?? 0) > 0,
  buildNotification: (rows) => {
    const r = rows[0];
    return {
      title: `${r.detected} usuario(s) con premium que nadie está pagando`,
      body: `El Pass-3 de reconciliation detectó premium sin respaldo de pago. Dos formas del mismo problema:\n\n  - fila_active_sin_sub_en_stripe: la BD dice que la suscripción sigue activa y en Stripe ya no lo está (webhook de cancelación perdido).\n  - premium_sin_suscripcion_ni_concesion: el perfil es premium, no hay suscripción viva y NADIE declaró que fuera una concesión.\n\nQué hacer, usuario por usuario:\n  1. Si es una concesión legítima (cuenta interna, canario, compensación) → declararla en user_profiles.premium_grant_reason y deja de aparecer aquí.\n  2. Si no lo es → alinear con Stripe (fila a 'canceled', perfil a 'free').\n\nNO se corrige solo a propósito: quitar premium afecta a una persona real.\n\nOrigen: 29/07/2026 — un cliente canceló el 26/05 y siguió con premium dos meses; ninguna de las 8 reglas de suscripciones miraba esta dirección.`,
      metadata: { detected: r.detected, porMotivo: r.porMotivo },
      fingerprint: 'premium_sin_respaldo',
    };
  },
  cooldownMin: 720, // 12 h: es dinero, no una caída; avisar cada hora sería ruido
};

/**
 * Stripe webhook signature failed — disparo INMEDIATO (≥1 en 5 min, critical).
 *
 * Cada `Webhook signature verification failed` (HTTP 400 de /api/stripe/webhook)
 * significa que Stripe envía un evento, nuestro endpoint NO puede verificar la
 * firma, lo rechaza. Causa: STRIPE_WEBHOOK_SECRET incorrecto o desincronizado
 * con el dashboard de Stripe.
 *
 * Origen: incidente 2026-05-27 — tras un redeploy, el secret en SSM no se
 * actualizó. Stripe rechazó 59 eventos en 4h (incluidas 2 nuevas suscripciones
 * de Rocío y Mercedes, que pagaron y no se activaron). Detectado solo por
 * feedback manual al chat de soporte.
 *
 * Esta regla mira directamente validation_error_logs (escritura en tiempo
 * real desde el frontend ECS Fargate) en lugar de depender del cron
 * check-webhook-health (que llevaba 5h sin ejecutarse en el incidente
 * original). Detección en ≤5min, sin depender de ningún cron externo.
 *
 * Cualquier ocurrencia = pago potencial sin procesar = P1 inmediato.
 */
export const RULE_STRIPE_WEBHOOK_SIGNATURE_FAILED: AlertRule<{
  n: number;
  lastMsg: string | null;
}> = {
  name: 'stripe_webhook_signature_failed',
  severity: 'critical',
  query: sql`
    SELECT COUNT(*)::int AS n,
           (ARRAY_AGG(error_message ORDER BY created_at DESC))[1] AS "lastMsg"
    FROM validation_error_logs
    WHERE endpoint LIKE '%stripe/webhook%'
      AND error_message ILIKE '%signature verification failed%'
      AND created_at > NOW() - INTERVAL '5 minutes'
  `,
  shouldFire: (rows) => (rows[0]?.n ?? 0) > 0,
  buildNotification: (rows) => {
    const r = rows[0];
    return {
      title: `🚨 ${r.n} signature fail(s) en /api/stripe/webhook en 5 min — pagos sin procesar`,
      body: `Stripe está rechazando eventos por firma inválida. Cada evento rechazado puede ser un pago/suscripción que NO se está aplicando en BD.\n\nCAUSA TÍPICA: STRIPE_WEBHOOK_SECRET desincronizado entre SSM y el dashboard de Stripe (tras un redeploy o rotación manual).\n\nACCIONES:\n  1. https://dashboard.stripe.com/webhooks → endpoint vence-produccion → "Reveal signing secret"\n  2. aws ssm put-parameter --profile vence --region eu-west-2 \\\n       --name /vence-frontend/STRIPE_WEBHOOK_SECRET --value 'whsec_...' --type SecureString --overwrite\n  3. aws ecs update-service --profile vence --region eu-west-2 \\\n       --cluster vence-backend --service vence-frontend --force-new-deployment\n  4. Una vez OK, reenviar eventos fallidos desde el dashboard de Stripe.\n\nÚltimo error: ${r.lastMsg ?? '(n/a)'}\n\nIncidente origen: 2026-05-27 — caso Rocío Jodar/Mercedes Martínez.`,
      metadata: { count: r.n, lastMsg: r.lastMsg, windowMin: 5 },
      fingerprint: 'stripe_webhook_signature_failed',
    };
  },
  cooldownMin: 15,
};

/**
 * Stripe webhook 4xx burst — ≥5 errores 4xx en 10 min en /api/stripe/webhook.
 *
 * Complementa a `stripe_webhook_signature_failed` para detectar OTROS bugs
 * de validación: body roto, Content-Type inválido, schema cambiado en Stripe,
 * route handler en bug, etc.
 *
 * Excluye explícitamente "signature verification failed" para no duplicar
 * alertas con la regla específica de arriba (esa es critical instant,
 * ésta es error con cooldown más alto).
 */
export const RULE_STRIPE_WEBHOOK_4XX_BURST: AlertRule<{
  n: number;
  topError: string | null;
}> = {
  name: 'stripe_webhook_4xx_burst',
  severity: 'error',
  query: sql`
    SELECT COUNT(*)::int AS n,
           (ARRAY_AGG(error_message ORDER BY created_at DESC))[1] AS "topError"
    FROM validation_error_logs
    WHERE endpoint LIKE '%stripe/webhook%'
      AND http_status >= 400 AND http_status < 500
      AND error_message NOT ILIKE '%signature verification failed%'
      AND created_at > NOW() - INTERVAL '10 minutes'
  `,
  shouldFire: (rows) => (rows[0]?.n ?? 0) >= 5,
  buildNotification: (rows) => {
    const r = rows[0];
    return {
      title: `${r.n} errores 4xx (no-signature) en /api/stripe/webhook en 10 min`,
      body: `Burst de 4xx distintos de signature failed. Probable causa: shape de evento Stripe cambiado, validación de body en bug, route handler con regresión.\n\nÚltimo error: ${r.topError ?? '(n/a)'}\n\nInvestigar:\n  SELECT created_at, http_status, error_type, error_message\n  FROM validation_error_logs\n  WHERE endpoint LIKE '%stripe/webhook%' AND created_at > NOW() - INTERVAL '30 minutes'\n  ORDER BY created_at DESC LIMIT 30;`,
      metadata: { count: r.n, topError: r.topError, windowMin: 10 },
    };
  },
  cooldownMin: 30,
};

/**
 * Un fallo de canary cuyo error es un timeout/abort de red es, con UNA sola
 * ocurrencia, indistinguible de un blip transitorio: latencia puntual de
 * Upstash / Supavisor / Fargate↔Supabase que se auto-recupera al siguiente
 * tick. Con cadencia de 5 min, exigir 2 fallos en la ventana de 10 min = 2
 * ticks consecutivos = degradación SOSTENIDA, no blip. Mismo criterio que la
 * alarma CloudWatch Synthetics (`evaluation_periods = 2` en synthetics.tf).
 *
 * Un fallo SUSTANTIVO (HTTP 4xx/5xx con cuerpo, validación incorrecta, shape
 * roto) NO es transitorio → dispara INSTANTÁNEO con 1 sola ocurrencia: es un
 * bug real, no un hipo de red.
 *
 * Recalibrado 2026-06-03: los canaries auth/webhook/redis/topic-data emitían
 * 1 email CRITICAL por cada timeout suelto (datos 24h: 4/290 stripe, 1/290
 * redis, 1/290 topic-data, 3/290 auth — TODOS auto-recuperados al tick
 * siguiente) → spam que ahogaba los CRITICAL reales (filosofía martillo,
 * observability.md §20: "alarma no accionable = ruido"). `db-pool` NO usa
 * este helper: sigue instantáneo con n≥1 porque saturación de BD = P0 y un
 * solo fallo ya es accionable.
 *
 * Recalibrado 2026-06-07: un **502/504 de gateway** (CloudFront/ALB devuelve
 * "Bad Gateway"/"Gateway Time-out" sin que la request llegue a la app) es,
 * con UNA ocurrencia, indistinguible de un blip de infra que se auto-recupera
 * al siguiente tick — misma clase que un timeout, NO un bug de la app. Datos
 * 7d: la práctica totalidad del ruido de los canaries auth (34) y topic-data
 * (30) eran 502 sueltos o timeouts. Se clasifican como transitorios → esperan
 * la confirmación del segundo tick. Un outage real persiste → n≥2 → dispara en
 * ≤5 min. `answer-save` pasa a usar este helper también: un 502 de gateway no
 * es "app inutilizable" (la request nunca llegó al handler), pero un fallo
 * sustantivo del handler (503 load-shed, 422 schema, 404 route, validate sin
 * success) sigue disparando instantáneo con n=1. 503/500 NO son transitorios:
 * 503 = load shedding real, 500 = bug del handler — ambos señal accionable.
 */
const TRANSIENT_CANARY_ERROR =
  // Añadido 11/07: un fallo de query de BD ("Failed query" es el wrapper de postgres-js;
  // "canceling statement due to statement timeout" es el statement_timeout) suele ser
  // contención de pool transitoria, NO un bug del canary → esperar confirmación (n≥2)
  // en vez de disparar a n=1. Un bug real de query falla repetido y llega a n≥2 igual.
  /timeout|abort|ETIMEDOUT|ECONNRESET|ECONNREFUSED|EAI_AGAIN|socket hang up|network|fetch failed|Bad Gateway|Gateway Time-?out|\bHTTP 50[24]\b|Failed query|canceling statement|statement timeout|Connection terminated|too many clients/i;

function canaryFailureShouldFire(
  rows: Array<{ n: number; lastError: string | null }>,
): boolean {
  const r = rows[0];
  const n = r?.n ?? 0;
  if (n === 0) return false;
  if (n >= 2) return true; // 2+ fallos = 2 ticks consecutivos = sostenido
  // n === 1: un único fallo. Si es timeout/abort de red, esperar la
  // confirmación del siguiente tick (blip transitorio). Si es sustantivo
  // (4xx/5xx, validación, shape), disparar ya — es un bug real.
  return !TRANSIENT_CANARY_ERROR.test(r?.lastError ?? '');
}

/**
 * Canary auth failed — el cron `canary-smoke-auth` (Fargate cada 5min, Nivel 3
 * del roadmap canary-y-simulaciones) ejecuta login + GET /api/profile contra
 * producción. Cualquier fallo es alarma critical inmediata.
 *
 * Hubiera cazado el incidente Rocío/Mercedes (2026-05-27) en ≤5 min,
 * sin depender del feedback humano.
 *
 * Cooldown 15 min para evitar spam si la regresión persiste. Disparo vía
 * `canaryFailureShouldFire`: un fallo sustantivo (401/403/5xx con cuerpo)
 * dispara instantáneo (P1 real); un timeout/abort suelto espera la
 * confirmación del siguiente tick (blip de red auto-recuperable).
 */
export const RULE_CANARY_AUTH_FAILED: AlertRule<{
  n: number;
  lastStep: string | null;
  lastError: string | null;
  lastStatus: number | null;
}> = {
  name: 'canary_auth_failed',
  severity: 'critical',
  query: sql`
    SELECT COUNT(*)::int AS n,
           (ARRAY_AGG(metadata->>'step' ORDER BY created_at DESC))[1] AS "lastStep",
           (ARRAY_AGG(error_message ORDER BY created_at DESC))[1] AS "lastError",
           (ARRAY_AGG(http_status ORDER BY created_at DESC))[1] AS "lastStatus"
    FROM observable_events
    WHERE event_type = 'canary_auth_failed'
      AND created_at > NOW() - INTERVAL '10 minutes'
  `,
  shouldFire: (rows) => canaryFailureShouldFire(rows),
  buildNotification: (rows) => {
    const r = rows[0];
    return {
      title: `🚨 Canary auth en producción FALLÓ (${r.n} en 10 min) — flow login+profile roto`,
      body: `El canary HTTP autenticado (cron Fargate cada 5 min) detectó que el flow crítico login → GET /api/profile NO funciona en https://www.vence.es.\n\nESTO ES P1: cualquier usuario nuevo o existente que intente loguearse/ver su perfil ahora mismo está afectado. Mismo patrón que el incidente Rocío/Mercedes (27/05/2026) donde tardamos horas en darnos cuenta por feedback humano.\n\nÚltimo fallo:\n  - step: ${r.lastStep ?? '(n/a)'}\n  - http_status: ${r.lastStatus ?? '(n/a)'}\n  - error: ${r.lastError ?? '(n/a)'}\n\nACCIONES:\n  1. Verificar /admin/salud-sistema → SLO-05 (5xx user-facing).\n  2. Ver últimos deploys: Vercel + ECS vence-frontend.\n  3. Reproducir manualmente: curl POST /api/auth/login con smoke@vence.es.\n  4. Si reciente deploy → rollback Vercel (1 click) o ECS (force-new-deployment con task def anterior).\n  5. Logs Fargate del cron canary-smoke-auth para el step exacto.\n\nRoadmap canary: docs/roadmap/canary-y-simulaciones.md §Nivel 3.`,
      metadata: {
        count: r.n,
        lastStep: r.lastStep,
        lastError: r.lastError,
        lastStatus: r.lastStatus,
        windowMin: 10,
      },
      fingerprint: 'canary_auth_failed',
    };
  },
  cooldownMin: 15,
};

/**
 * Canary Stripe webhook failed — el cron `canary-stripe-webhook` (Fargate
 * cada 5 min, variante Nivel 3) envía evento sintético firmado al endpoint
 * /api/stripe/webhook real. Cualquier fallo = handler/signature/route roto.
 *
 * Cierra el gap del incidente Rocío/Mercedes (2026-05-27): el bug del
 * webhook tardó horas en detectarse porque solo se rompía con eventos
 * reales y no había canary sintético. Ahora: ≤5 min.
 *
 * Cooldown 15 min. Disparo vía `canaryFailureShouldFire`: un fallo sustantivo
 * (400 signature, 404 route, 5xx) dispara instantáneo (pago en riesgo = P1);
 * un timeout/abort suelto espera el siguiente tick. Las firmas inválidas de
 * eventos Stripe REALES siguen cubiertas instantáneamente por la regla
 * hermana `stripe_webhook_signature_failed` (mira validation_error_logs).
 */
export const RULE_CANARY_WEBHOOK_FAILED: AlertRule<{
  n: number;
  lastStep: string | null;
  lastError: string | null;
  lastStatus: number | null;
}> = {
  name: 'canary_stripe_webhook_failed',
  severity: 'critical',
  query: sql`
    SELECT COUNT(*)::int AS n,
           (ARRAY_AGG(metadata->>'step' ORDER BY created_at DESC))[1] AS "lastStep",
           (ARRAY_AGG(error_message ORDER BY created_at DESC))[1] AS "lastError",
           (ARRAY_AGG(http_status ORDER BY created_at DESC))[1] AS "lastStatus"
    FROM observable_events
    WHERE event_type = 'canary_stripe_webhook_failed'
      AND created_at > NOW() - INTERVAL '10 minutes'
  `,
  shouldFire: (rows) => canaryFailureShouldFire(rows),
  buildNotification: (rows) => {
    const r = rows[0];
    return {
      title: `🚨 Canary Stripe webhook FALLÓ (${r.n} en 10 min) — pagos potencialmente sin procesar`,
      body: `El canary sintético detectó que /api/stripe/webhook NO procesa correctamente eventos firmados. Esto es exactamente el patrón del incidente Rocío/Mercedes (27/05/2026): si el webhook está roto, los pagos reales NO se sincronizarán en BD y los usuarios pagarán sin recibir premium.\n\nÚltimo fallo:\n  - step: ${r.lastStep ?? '(n/a)'}\n  - http_status: ${r.lastStatus ?? '(n/a)'}\n  - error: ${r.lastError ?? '(n/a)'}\n\nACCIONES:\n  1. Verificar handler vivo: curl https://www.vence.es/api/stripe/webhook → debe devolver 405 (Method Not Allowed para GET).\n  2. Si step='http' status=400: STRIPE_WEBHOOK_SECRET stale en SSM /vence-frontend/ — rotar como en el runbook stripe_webhook_signature_failed.\n  3. Si step='http' status=404: route eliminada del bundle Next.js — investigar últimos deploys del frontend.\n  4. Si step='http' status=5xx: bug en route handler — investigar logs Vercel.\n  5. Si step='sign': bug en el SDK Stripe del backend — verificar versión Stripe SDK.\n\nRoadmap: docs/roadmap/canary-y-simulaciones.md §Nivel 3 (variante webhook).`,
      metadata: {
        count: r.n,
        lastStep: r.lastStep,
        lastError: r.lastError,
        lastStatus: r.lastStatus,
        windowMin: 10,
      },
      fingerprint: 'canary_stripe_webhook_failed',
    };
  },
  cooldownMin: 15,
};

/**
 * Canary answer-save failed — el cron `canary-answer-save` ejecuta cada
 * 5 min POST sintético al endpoint más caliente de la app
 * (/api/v2/answer-and-save). Cualquier fallo = todos los users afectados
 * en este momento al responder preguntas.
 *
 * No dispara con `canary_answer_save_question_invalid` (warn — pregunta
 * canary retirada, accionable distinto).
 *
 * Cooldown 15 min. Disparo vía `canaryFailureShouldFire` (recalibrado
 * 2026-06-07): un fallo sustantivo del handler (503 load-shed, 422 schema,
 * 404 route, 5xx, validate sin success) dispara instantáneo con n=1 — endpoint
 * crítico, rotura real = P1. Un 502/504 de gateway suelto (la request nunca
 * llegó al handler) espera la confirmación del segundo tick: es un blip de
 * infra auto-recuperable, no la app rota.
 */
export const RULE_CANARY_ANSWER_SAVE_FAILED: AlertRule<{
  n: number;
  lastStep: string | null;
  lastError: string | null;
  lastStatus: number | null;
}> = {
  name: 'canary_answer_save_failed',
  severity: 'critical',
  query: sql`
    SELECT COUNT(*)::int AS n,
           (ARRAY_AGG(metadata->>'step' ORDER BY created_at DESC))[1] AS "lastStep",
           (ARRAY_AGG(error_message ORDER BY created_at DESC))[1] AS "lastError",
           (ARRAY_AGG(http_status ORDER BY created_at DESC))[1] AS "lastStatus"
    FROM observable_events
    WHERE event_type = 'canary_answer_save_failed'
      AND created_at > NOW() - INTERVAL '10 minutes'
  `,
  shouldFire: (rows) => canaryFailureShouldFire(rows),
  buildNotification: (rows) => {
    const r = rows[0];
    return {
      title: `🚨 Canary answer-save FALLÓ (${r.n} en 10 min) — app inutilizable para responder preguntas`,
      body: `El canary detectó que POST /api/v2/answer-and-save NO procesa correctamente respuestas. Esto es P1: cada respuesta de cada user en cada test pasa por aquí. Si está roto, la app está inutilizable.\n\nÚltimo fallo:\n  - step: ${r.lastStep ?? '(n/a)'}\n  - http_status: ${r.lastStatus ?? '(n/a)'}\n  - error: ${r.lastError ?? '(n/a)'}\n\nACCIONES SEGÚN STEP:\n  - sign_token: SUPABASE_JWT_SECRET roto en el backend Fargate (raro).\n  - http 401/403: JwtGuard rechaza el JWT smoke → cambio en JwtVerifier (audience, algorithm).\n  - http 422: schema del request cambió → revisar lib/api/v2/answer-and-save/schemas.ts.\n  - http 5xx: bug en /api/v2/answer-and-save handler — investigar logs Vercel.\n  - http 503: load shedding activo (saturación BD/antifraud) — investigar /admin/salud-sistema.\n  - validate_response: handler devuelve 200 pero sin success=true → bug interno silencioso (PEOR caso).\n  - validate_latency: lentitud >15s — investigar conexiones BD / antifraud cache.\n\nRoadmap: docs/roadmap/canary-y-simulaciones.md §Nivel 3.`,
      metadata: {
        count: r.n,
        lastStep: r.lastStep,
        lastError: r.lastError,
        lastStatus: r.lastStatus,
        windowMin: 10,
      },
      fingerprint: 'canary_answer_save_failed',
    };
  },
  cooldownMin: 15,
};

/**
 * Canary sintético EXTERNO fallido — 2026-07-05. Check desde fuera (home por
 * CloudFront + chunk de assets + backend health). Caza lo que los canarios
 * internos no ven: assets/S3/CloudFront rotos (clase ChunkLoadError/app congelada),
 * home no renderiza, o edge caído — pase lo que pase el tráfico (proactivo).
 */
export const RULE_CANARY_SYNTHETIC_EXTERNAL_FAILED: AlertRule<{
  n: number;
  lastStep: string | null;
  lastError: string | null;
}> = {
  name: 'canary_synthetic_external_failed',
  severity: 'critical',
  query: sql`
    SELECT COUNT(*)::int AS n,
           (ARRAY_AGG(metadata->>'step' ORDER BY created_at DESC))[1] AS "lastStep",
           (ARRAY_AGG(error_message ORDER BY created_at DESC))[1] AS "lastError"
    FROM observable_events
    WHERE event_type = 'canary_synthetic_external_failed'
      AND created_at > NOW() - INTERVAL '10 minutes'
  `,
  shouldFire: (rows) => canaryFailureShouldFire(rows),
  buildNotification: (rows) => {
    const r = rows[0];
    return {
      title: `🚨 Canary sintético EXTERNO FALLÓ (${r.n} en 10 min) — la app puede estar rota para usuarios reales`,
      body: `El check externo (desde fuera, por CloudFront) falló. Esto ve lo que los canarios internos NO: assets/CDN, render de la home, edge.\n\nÚltimo fallo:\n  - step: ${r.lastStep ?? '(n/a)'}\n  - error: ${r.lastError ?? '(n/a)'}\n\nACCIONES SEGÚN STEP:\n  - home / home_no_chunk: la home no carga o no renderiza (SSR/contenedor frontend roto). Ver /admin/infraestructura + logs ECS vence-frontend.\n  - assets: un chunk _next/static da != 200 → S3/CloudFront/origin-group roto = CLASE "app congelada / ChunkLoadError". Ver docs/runbooks/pusheo-revision-despliegue.md (assets en S3).\n  - backend_health: api.vence.es/health != 200 → backend caído. Ver ECS vence-backend.\n  - exception: el propio egress falló (NAT/DNS) o timeout.`,
      metadata: {
        count: r.n,
        lastStep: r.lastStep,
        lastError: r.lastError,
        windowMin: 10,
      },
      fingerprint: 'canary_synthetic_external_failed',
    };
  },
  cooldownMin: 15,
};

/**
 * Canary SAVE-CONTRACT fallido — 2026-07-05. Replica el flujo del cliente
 * (crear test → guardar respuesta) y VERIFICA en RDS que la fila llegó. Caza la
 * clase del hueco C1 (07-04): endpoint responde OK pero nada se guarda. P1: si
 * dispara, los usuarios no pueden guardar progreso (app inutilizable de facto).
 */
export const RULE_CANARY_SAVE_CONTRACT_FAILED: AlertRule<{
  n: number;
  lastStep: string | null;
  lastError: string | null;
  lastStatus: number | null;
}> = {
  name: 'canary_save_contract_failed',
  severity: 'critical',
  query: sql`
    SELECT COUNT(*)::int AS n,
           (ARRAY_AGG(metadata->>'step' ORDER BY created_at DESC))[1] AS "lastStep",
           (ARRAY_AGG(error_message ORDER BY created_at DESC))[1] AS "lastError",
           (ARRAY_AGG(http_status ORDER BY created_at DESC))[1] AS "lastStatus"
    FROM observable_events
    WHERE event_type = 'canary_save_contract_failed'
      AND created_at > NOW() - INTERVAL '10 minutes'
  `,
  shouldFire: (rows) => canaryFailureShouldFire(rows),
  buildNotification: (rows) => {
    const r = rows[0];
    return {
      title: `🚨 Canary save-contract FALLÓ (${r.n} en 10 min) — el guardado de respuestas está ROTO`,
      body: `El canary replicó el flujo del cliente (crear test + guardar respuesta) y verificó en RDS. Falló → los usuarios NO pueden guardar progreso. P1.\n\nÚltimo fallo:\n  - step: ${r.lastStep ?? '(n/a)'}\n  - http_status: ${r.lastStatus ?? '(n/a)'}\n  - error: ${r.lastError ?? '(n/a)'}\n\nACCIONES SEGÚN STEP:\n  - create_test: POST /api/v2/tests roto (creación de sesión — camino que rompió en C1). Ver lib/api/v2/tests + logs.\n  - save_answer: POST /api/test/save-answer roto (422 schema, 5xx handler, 503 saturación).\n  - db_verify: el endpoint respondió 200 pero la fila NO llegó a test_questions = GUARDADO SILENCIOSO ROTO (el PEOR caso, clase hueco C1). Investigar el handler de save-answer y los triggers.\n\nMemoria: project_hueco_c1_perdida_tests_recuperacion.`,
      metadata: {
        count: r.n,
        lastStep: r.lastStep,
        lastError: r.lastError,
        lastStatus: r.lastStatus,
        windowMin: 10,
      },
      fingerprint: 'canary_save_contract_failed',
    };
  },
  cooldownMin: 15,
};

/**
 * Canary database pool failed — `SELECT 1` con timeout 1s falla.
 * Significa saturación PgBouncer / max_connections agotados / BD caída.
 * Imposible cubrir en CI (es runtime puro bajo carga real).
 *
 * Cooldown 10min (más corto que los otros canarios — saturación de BD
 * es P0 y cada minuto extra de spam vale la pena para escalar).
 */
export const RULE_CANARY_DB_POOL_FAILED: AlertRule<{
  n: number;
  lastStep: string | null;
  lastError: string | null;
}> = {
  name: 'canary_db_pool_failed',
  severity: 'critical',
  query: sql`
    SELECT COUNT(*)::int AS n,
           (ARRAY_AGG(metadata->>'step' ORDER BY created_at DESC))[1] AS "lastStep",
           (ARRAY_AGG(error_message ORDER BY created_at DESC))[1] AS "lastError"
    FROM observable_events
    WHERE event_type = 'canary_db_pool_failed'
      AND created_at > NOW() - INTERVAL '10 minutes'
  `,
  // Recalibrado 13/07: era `n > 0` (1 blip → CRITICAL). El timeout se mide con
  // Promise.race+setTimeout EN EL PROCESO, así que un stall breve del event-loop
  // (GC/CPU throttle de un task) lo dispara aunque la BD esté sana (visto 13/07:
  // 1 fallo con RDS al 12% de CPU). Reusa `canaryFailureShouldFire`: un timeout
  // aislado espera confirmación del siguiente tick; ≥2 (sostenido) o un error
  // sustantivo (no-timeout) dispara ya.
  shouldFire: (rows) => canaryFailureShouldFire(rows),
  buildNotification: (rows) => {
    const r = rows[0];
    return {
      title: `🚨 Canary DB pool: SELECT 1 >1s SOSTENIDO (${r.n} en 10 min) — pool app / RDS / red`,
      body: `El canary (SELECT 1 por el pool de la app, Drizzle→RDS directo) NO completó en <1s de forma SOSTENIDA (≥2 ticks o error sustantivo). Posibles causas:\n  - Pool de la app (max:5) saturado en un task: todas las conexiones ocupadas por queries lentas → SELECT 1 espera turno.\n  - Stall breve del task ECS (GC / CPU throttle) que bloquea el event-loop.\n  - RDS sobrecargada (CPU/IO) o cerca de max_connections.\n  - Blip de red task↔RDS.\n\nÚltimo fallo:\n  - step: ${r.lastStep ?? '(n/a)'}\n  - error: ${r.lastError ?? '(n/a)'}\n\nACCIONES:\n  1. /admin/salud-sistema → latencia INSERT + 5xx.\n  2. CloudWatch RDS (vence-prod, eu-west-2): CPUUtilization, DatabaseConnections, ReadLatency en la ventana.\n  3. pg_stat_activity: conexiones 'active' + queries largas (kill idle-in-transaction).\n  4. CPU/mem de los tasks ECS por si hubo throttle.\n\nNota: un blip aislado (1 timeout) ya NO dispara; esto es sostenido → mirar en serio.`,
      metadata: {
        count: r.n,
        lastStep: r.lastStep,
        lastError: r.lastError,
        windowMin: 10,
      },
      fingerprint: 'canary_db_pool_failed',
    };
  },
  cooldownMin: 10,
};

/**
 * Canary pdf-queue failed — la cola de pre-generación de PDFs del temario
 * (`temario_pdf_jobs`) está en estado NO SANO: DLQ (jobs 'failed' tras
 * reintentos), 'running' colgado (worker muerto a media renderización) o
 * backlog 'pending' estancado (>2h → el worker no drena / no corre).
 *
 * Cierra el hueco 22-23/07: la cola se llenó (27 pending + 12 DLQ) sin aviso
 * porque `pdfQueueHealth()` no tenía consumidor en prod. El estado de la cola
 * es ESTABLE (no flappea como un timeout), así que un solo evento en la ventana
 * ya es señal real → shouldFire n>0, sin `canaryFailureShouldFire`.
 */
export const RULE_CANARY_PDF_QUEUE_FAILED: AlertRule<{
  n: number;
  lastError: string | null;
}> = {
  name: 'canary_pdf_queue_failed',
  severity: 'critical',
  query: sql`
    SELECT COUNT(*)::int AS n,
           (ARRAY_AGG(error_message ORDER BY created_at DESC))[1] AS "lastError"
    FROM observable_events
    WHERE event_type = 'canary_pdf_queue_failed'
      AND created_at > NOW() - INTERVAL '40 minutes'
  `,
  shouldFire: (rows) => (rows[0]?.n ?? 0) > 0,
  buildNotification: (rows) => {
    const r = rows[0];
    return {
      title: `🚨 Cola PDF temario degradada (${r.n} en 40 min) — DLQ / running colgado / backlog estancado`,
      body: `El canary de la cola de pre-generación de PDFs (temario_pdf_jobs) reportó estado NO SANO. Significa que algún tema NO tiene su PDF pre-generado al día:\n  - DLQ: jobs 'failed' que agotaron reintentos (un tema no se pudo renderizar).\n  - running colgado: un 'running' claimed hace >30 min → el worker murió a media renderización.\n  - backlog estancado: hay 'pending' de >2h → el worker no está drenando (o no corre).\n\nMotivo del último fallo:\n  - ${r.lastError ?? '(n/a)'}\n\nACCIONES:\n  1. Estado de la cola: SELECT status, count(*) FROM temario_pdf_jobs GROUP BY 1  (o node scripts/pdf-worker.ts stats).\n  2. ¿El worker ECS programado corrió? Revisar la tarea Fargate del worker + su cron_run.\n  3. DLQ: mirar last_error de los 'failed' (render_timeout = tema demasiado grande; oposicion_desconocida = registro OPOSICIONES desactualizado en la imagen).\n  4. Drenar tras arreglar: node scripts/pdf-worker.ts drain.`,
      metadata: { count: r.n, lastError: r.lastError, windowMin: 40 },
      fingerprint: 'canary_pdf_queue_failed',
    };
  },
  // 24 h y no 1 h (T-258, 29/07/2026): esta avería es CRÓNICA y está fichada —
  // la cola de PDFs no tiene consumidor automático ([T-159]) y la
  // pre-generación está parada por la cuota de vCPU de Fargate ([T-086]).
  // Avisar cada hora de algo que nadie puede arreglar hoy no acelera el
  // arreglo: entierra las alertas que sí importan (lección [T-047]/[T-113]).
  // Medido: 37 correos en 31 h. Sigue avisando a diario mientras dure, y
  // cuando T-159 se cierre esto vuelve a su cadencia normal.
  cooldownMin: 1440,
};

/**
 * Canary Redis Upstash failed — SET/GET/DEL ephemeral falla o devuelve
 * valor incorrecto. Significa caída de Upstash / cuota agotada / network.
 *
 * Si Redis cae, el cache compartido (user_stats, exam_pending, theme_stats)
 * deja de servir → cada user request va a BD → load 10× → 5xx cascada.
 *
 * Cooldown 10min — alta urgencia operativa. Disparo vía
 * `canaryFailureShouldFire`: corrupción/valor incorrecto (step=validate)
 * dispara instantáneo; un timeout suelto de Upstash espera el siguiente tick
 * (la app tiene fail-open en cache, 5 min extra no es catastrófico).
 */
export const RULE_CANARY_REDIS_FAILED: AlertRule<{
  n: number;
  lastStep: string | null;
  lastError: string | null;
}> = {
  name: 'canary_redis_failed',
  severity: 'critical',
  query: sql`
    SELECT COUNT(*)::int AS n,
           (ARRAY_AGG(metadata->>'step' ORDER BY created_at DESC))[1] AS "lastStep",
           (ARRAY_AGG(error_message ORDER BY created_at DESC))[1] AS "lastError"
    FROM observable_events
    WHERE event_type = 'canary_redis_failed'
      AND created_at > NOW() - INTERVAL '10 minutes'
  `,
  shouldFire: (rows) => canaryFailureShouldFire(rows),
  buildNotification: (rows) => {
    const r = rows[0];
    return {
      title: `🚨 Canary Redis FALLÓ (${r.n} en 10 min) — Upstash caído, cascada BD inminente`,
      body: `SET/GET/DEL contra Upstash falló. Si Redis está caído:\n  - Cache compartido (user_stats, exam_pending, theme_stats) deja de servir.\n  - Cada user request va a BD directa → load 10×.\n  - Cascada: BD se satura → canary-db-pool dispara → 5xx generalizado.\n\nÚltimo fallo:\n  - step: ${r.lastStep ?? '(n/a)'}\n  - error: ${r.lastError ?? '(n/a)'}\n\nACCIONES:\n  1. https://console.upstash.com — verificar Redis OK + cuota.\n  2. Si caído: status Upstash + considerar bypass temporal del cache (fail-open ya hay en CacheService TIMEOUT_SYMBOL).\n  3. Si cuota: upgrade plan o purgar keys low-priority.\n  4. NO redeploy precipitado — la app tiene fail-open en cache; solo monitorizar latencia.\n\nstep=validate significa CORRUPCIÓN (SET un valor, GET devolvió otro) → bug raro pero crítico de Upstash.`,
      metadata: {
        count: r.n,
        lastStep: r.lastStep,
        lastError: r.lastError,
        windowMin: 10,
      },
      fingerprint: 'canary_redis_failed',
    };
  },
  cooldownMin: 10,
};

/**
 * Canary del ENDPOINT de stats por tema — caza una regresión SEMÁNTICA que
 * devuelve datos incompletos/vacíos con `success:true` (sin error ni 5xx).
 *
 * Origen: incidente 19/06. La V4 del endpoint agrupaba por tema_number
 * estampado + filtraba por tests.position_type → excluía los tests "globales"
 * → un usuario con 68k respuestas veía su panel casi vacío. Silencioso (la
 * observabilidad no distingue `[]` de "usuario sin progreso"). Lo cazó un
 * usuario quejándose. Este canary compara el progreso que el endpoint DEVUELVE
 * con el ESPERADO desde BD (artículo→topic_scope) para el usuario más pesado:
 * si la suma cae <70% → regresión → critical.
 */
export const RULE_CANARY_THEME_STATS_FAILED: AlertRule<{
  n: number;
  lastStep: string | null;
  lastError: string | null;
}> = {
  name: 'canary_theme_stats_failed',
  severity: 'critical',
  query: sql`
    SELECT COUNT(*)::int AS n,
           (ARRAY_AGG(metadata->>'step' ORDER BY created_at DESC))[1] AS "lastStep",
           (ARRAY_AGG(error_message ORDER BY created_at DESC))[1] AS "lastError"
    FROM observable_events
    WHERE event_type = 'canary_theme_stats_failed'
      AND created_at > NOW() - INTERVAL '25 minutes'
  `,
  shouldFire: (rows) => canaryFailureShouldFire(rows),
  buildNotification: (rows) => {
    const r = rows[0];
    return {
      title: `🚨 Canary theme-stats FALLÓ (${r.n} en 25 min) — el panel de temas oculta progreso`,
      body: `El endpoint /api/v2/topic-progress/theme-stats devolvió un progreso INCOMPLETO para el usuario más pesado (regresión semántica tipo V4: stats por sello en vez de por artículo→topic_scope).\n\nÚltimo fallo:\n  - step: ${r.lastStep ?? '(n/a)'}\n  - detalle: ${r.lastError ?? '(n/a)'}\n\nQué significa cada step:\n  - semantic: el endpoint suma << lo esperado en BD → usuarios ven el panel casi vacío pese a haber estudiado.\n  - http/response: el endpoint devolvió error o forma inesperada.\n  - timeout/query: la verificación no completó (¿BD lenta? ¿endpoint colgado?).\n\nACCIONES:\n  1. Comparar en vivo: GET el endpoint para ese usuario vs el cálculo article→topic_scope de BD.\n  2. Revisar el último deploy del frontend (¿se tocó theme-stats/route.ts?).\n  3. Revisar la caché (clave theme_stats_*): si sirve datos viejos de una versión rota, bumpear la versión de la clave.\n  4. NO es un fallo de infra — es de lógica del endpoint; revertir el commit que rompió el modelo.`,
      metadata: {
        count: r.n,
        lastStep: r.lastStep,
        lastError: r.lastError,
        windowMin: 25,
      },
      fingerprint: 'canary_theme_stats_failed',
    };
  },
  cooldownMin: 15,
};

/**
 * Watchdog de respuesta — burst de UI congeladas en ExamLayout/TestLayout.
 *
 * El hook `useAnswerWatchdog` (12s threshold) detecta cuando `isSaving`/
 * `processingAnswer` se queda en true >12s, indica UI congelada (API
 * `/api/exam/validate` o `/api/answer` colgada, tab en background con
 * timers throttled, conexión móvil débil) y resetea el estado +
 * registra un evento.
 *
 * Caso real 30/05/2026: 9 eventos en un día durante incidente cron-coincidence
 * (8 crons cada 5 min coincidían en mismo segundo, saturaban pool BD).
 * Durations vistas: hasta 308.109ms (5 minutos) con UI bloqueada.
 *
 * Pre-fix los eventos quedaban silenciosos en validation_error_logs sin
 * disparar alerta. Esta regla cierra ese gap.
 */
export const RULE_ANSWER_WATCHDOG_BURST: AlertRule<{
  n: number;
  maxDurationMs: number;
  uniqueUsers: number;
}> = {
  name: 'answer_watchdog_burst',
  severity: 'warn',
  query: sql`
    SELECT
      COUNT(*)::int AS n,
      MAX(duration_ms)::int AS "maxDurationMs",
      COUNT(DISTINCT user_id)::int AS "uniqueUsers"
    FROM public.validation_error_logs
    WHERE error_message ILIKE '%Watchdog%'
      AND created_at > NOW() - INTERVAL '30 minutes'
  `,
  shouldFire: (rows) => (rows[0]?.n ?? 0) >= 3,
  buildNotification: (rows) => {
    const n = rows[0]?.n ?? 0;
    const maxMs = rows[0]?.maxDurationMs ?? 0;
    const users = rows[0]?.uniqueUsers ?? 0;
    const maxSec = (maxMs / 1000).toFixed(1);
    return {
      title: `${n} watchdog event${n > 1 ? 's' : ''} de UI congelada últimos 30 min`,
      body: `${users} user(s) tuvieron la UI bloqueada en ExamLayout/TestLayout. Máxima duración: ${maxSec}s.\n\nCausas típicas:\n  1. Saturación pool BD → /api/exam/validate o /api/answer cuelgan\n  2. Tab en background con timers throttled (Chrome) → watchdog dispara tarde\n  3. Conexión móvil débil → timeout cliente 10s + retries 21s superan watchdog 12s\n\nInvestigar:\n  SELECT created_at, user_id, duration_ms, deploy_version\n  FROM validation_error_logs\n  WHERE error_message ILIKE '%Watchdog%'\n    AND created_at > NOW() - INTERVAL '1 hour'\n  ORDER BY created_at DESC;\n\nSi coincide con incidente de saturación BD → mirar /admin/observability ventana 1h.`,
      metadata: {
        count: n,
        maxDurationMs: maxMs,
        uniqueUsers: users,
        windowMin: 30,
      },
      fingerprint: 'answer_watchdog_burst',
    };
  },
  cooldownMin: 30,
};

/**
 * Canary topic-data failed — el cron `canary-topic-data` (Fargate cada 5 min,
 * Nivel 3 sintético) hace GET sintético a `/api/topics/[numero]` con shape
 * assertions. Cualquier fallo = el endpoint que sirve el contenido del tema
 * está roto en producción real (caída de Redis, BD, flag MV mal configurado,
 * MV stale, regresión de shape).
 *
 * Origen: 31/05/2026, post Fase D-bis Iter 1.5. Cubre el path Next.js + Redis
 * + BD + flag TOPIC_MV_ENABLED en runtime real, que ningún test CI puede
 * cubrir (regla de oro PASS).
 *
 * Cooldown 15 min. Disparo vía `canaryFailureShouldFire`: un fallo sustantivo
 * (503/5xx, parse, shape roto) dispara instantáneo; un timeout/abort de red
 * suelto espera la confirmación del siguiente tick (blip auto-recuperable).
 */
export const RULE_CANARY_TOPIC_DATA_FAILED: AlertRule<{
  n: number;
  lastStep: string | null;
  lastError: string | null;
  lastStatus: number | null;
}> = {
  name: 'canary_topic_data_failed',
  severity: 'critical',
  query: sql`
    SELECT COUNT(*)::int AS n,
           (ARRAY_AGG(metadata->>'step' ORDER BY created_at DESC))[1] AS "lastStep",
           (ARRAY_AGG(error_message ORDER BY created_at DESC))[1] AS "lastError",
           (ARRAY_AGG((metadata->>'httpStatus')::int ORDER BY created_at DESC))[1] AS "lastStatus"
    FROM observable_events
    WHERE event_type = 'canary_topic_data_failed'
      AND created_at > NOW() - INTERVAL '10 minutes'
  `,
  shouldFire: (rows) => canaryFailureShouldFire(rows),
  buildNotification: (rows) => {
    const r = rows[0];
    return {
      title: `🚨 Canary topic-data FALLÓ (${r.n} en 10 min) — endpoint /api/topics/[numero] roto`,
      body: `El canary sintético detectó que GET /api/topics/[numero] NO responde correctamente. Esto afecta a cualquier user que abra la página de un tema (catálogo + estadísticas).\n\nÚltimo fallo:\n  - step: ${r.lastStep ?? '(n/a)'}\n  - http_status: ${r.lastStatus ?? '(n/a)'}\n  - error: ${r.lastError ?? '(n/a)'}\n\nACCIONES SEGÚN STEP:\n  - http 503: pool BD saturado o withDbTimeout disparó. Mirar /admin/infraestructura.\n  - http 5xx (no 503): excepción en handler. Logs Vercel/ECS frontend.\n  - parse: el response no es JSON. Probable middleware emitiendo HTML 500.\n  - shape: response.success != true. Bug en getTopicFullData.\n  - shape_empty: totalQuestions=0 — MV corrupta o refresh falló. Forzar refresh con POST /api/v2/admin/topic-summary/refresh.\n  - shape_no_articles: articlesByLaw vacío — bug en MV agg o en topic_scope.\n  - validate_latency: > 8s sostenido. Probable saturación pool o flag MV inactivo cuando debería estar activo.\n\nRoadmap: docs/roadmap/canary-y-simulaciones.md §Nivel 3 sintético.\nFase D-bis Iter 1.5: docs/ARCHITECTURE_ROADMAP.md.`,
      metadata: {
        count: r.n,
        lastStep: r.lastStep,
        lastError: r.lastError,
        lastStatus: r.lastStatus,
        windowMin: 10,
      },
      fingerprint: 'canary_topic_data_failed',
    };
  },
  cooldownMin: 15,
};

/**
 * Saturación del frontend (señal ÚNICA de capacidad) — detector de "storm" de canaries.
 *
 * Origen: incidente 21/07/2026. Un pico de tráfico (2×, dinámico /api/*) topó el autoscaler
 * del frontend en max=3 tasks → CPU 100% ~10 min → latencia ~3,9s → CASI TODOS los canaries
 * que llaman a vence.es/api/* abortaron por timeout A LA VEZ (auth, answer_save, topic_data,
 * stripe_webhook, stats, por_leyes, save_contract, answer_premium). La observabilidad SÍ lo
 * "vio", pero como 8 CRITICAL sueltos e ilegibles (un email por canary) — fatiga de alertas,
 * ninguna señal que dijera "es saturación de capacidad, no 8 bugs distintos".
 *
 * Esta regla convierte esa firma en UN aviso accionable: cuando ≥4 canaries DISTINTOS fallan
 * con timeout/abort en la misma ventana, la causa NO es un bug por-endpoint (eso rompe 1
 * canary), es una causa compartida = el frontend va lento (saturación de CPU/capacidad, o un
 * deploy en curso drenando tasks). Fingerprint único → un solo email, no ocho.
 *
 * Nota: si coincide con un rolling deploy del frontend (tasks drenando ~1 ciclo) puede
 * disparar una vez; el cooldown de 30 min lo acota. El body cubre ambos casos.
 */
export const RULE_FRONTEND_SATURATION: AlertRule<{
  canaries: number;
  which: string | null;
}> = {
  name: 'frontend_saturation',
  severity: 'error',
  query: sql`
    SELECT COUNT(DISTINCT event_type)::int AS "canaries",
           string_agg(DISTINCT replace(event_type, 'canary_', ''), ', ') AS "which"
    FROM observable_events
    WHERE event_type LIKE 'canary_%_failed'
      AND (error_message ILIKE '%abort%' OR error_message ILIKE '%timeout%')
      AND ts > NOW() - INTERVAL '7 minutes'
  `,
  shouldFire: (rows) => (rows[0]?.canaries ?? 0) >= 4,
  buildNotification: (rows) => {
    const r = rows[0];
    return {
      title: `Frontend saturado/lento — ${r.canaries} canaries en timeout simultáneo`,
      body: `${r.canaries} canaries DISTINTOS abortaron por timeout a la vez (${r.which ?? 'varios'}).\n\nEsto NO es un bug por-endpoint (eso rompe 1 canary): es una CAUSA COMPARTIDA = el frontend va lento. Firma de SATURACIÓN de capacidad (no caída — típicamente 0 errores 5xx en el ALB, solo latencia alta).\n\nQUÉ MIRAR (playbook, memoria project_frontend_autoscaling_capacidad_21jul):\n  1. ECS CPU frontend Average+MAXIMUM (max=100% sostenido = tasks pegados).\n  2. ¿running == max (6)? El autoscaler no puede subir más → subir max_capacity (frontend.tf).\n  3. ALB TargetResponseTime alto + HTTPCode_Target_5XX ~0 confirma "lento, no caído".\n  4. ¿Deploy del frontend en curso? (tasks drenando) → transitorio, se recupera solo.\n\nMitigación rápida (dar capacidad ya):\n  aws --profile vence --region eu-west-2 ecs update-service --cluster vence-backend --service vence-frontend --desired-count <N>\n\nOJO: métricas CloudWatch en hora Madrid; observable_events en UTC.`,
      metadata: { canaries: r.canaries, which: r.which, windowMin: 7 },
      fingerprint: 'frontend_saturation',
    };
  },
  cooldownMin: 30,
};

/**
 * Event-loop lag del frontend (T-075, Capa 5 del postmortem 21/07). El sampler
 * `startEventLoopLagSampler` (lib/observability/eventLoopLag.ts) emite
 * `event_loop_lag` a observable_events SOLO al cruzar umbral (warn: p99≥100ms o
 * max≥500ms; critical: max≥2s). Como son "flags only", CUALQUIER cluster ya es
 * señal. Esta regla cierra la mitad que faltaba —detección → NOTIFICACIÓN—: el
 * 21/07 el loop se saturó y nadie se enteró hasta la cascada de 504.
 *
 * Dispara si hay ≥1 evento critical (stall multi-segundo = health-check-killer)
 * O ≥5 warn en 15 min (loop repetidamente pegajoso = precursor de cascada).
 * `duration_ms` del evento = max lag (ms) de esa ventana del sampler.
 */
export const RULE_EVENT_LOOP_LAG: AlertRule<{
  n: number;
  crit: number;
  maxLagMs: number | null;
}> = {
  name: 'event_loop_lag',
  severity: 'critical',
  query: sql`
    SELECT COUNT(*)::int AS n,
           COUNT(*) FILTER (WHERE severity = 'critical')::int AS crit,
           MAX(duration_ms)::int AS "maxLagMs"
    FROM observable_events
    WHERE event_type = 'event_loop_lag'
      AND ts > NOW() - INTERVAL '15 minutes'
  `,
  shouldFire: (rows) => {
    const r = rows[0];
    if (!r) return false;
    // Umbral de warn subido de 5 a 12 el 28/07 (T-160). No es aflojar: es que
    // AHORA un warn significa "stall multisegundo" (antes bastaba 500 ms), asi
    // que 5 se habia quedado corto. Calibrado sobre 7 dias reales: 5 -> 5,0
    // avisos/dia; 12 -> 0,4. Se elige 12 y no 10 porque 12-15 dan el MISMO
    // resultado (meseta), asi que no se apoya en un borde.
    return (r.crit ?? 0) >= 1 || (r.n ?? 0) >= 12;
  },
  buildNotification: (rows) => {
    const r = rows[0];
    const lagS = r.maxLagMs != null ? (r.maxLagMs / 1000).toFixed(1) : '?';
    return {
      title: `Event-loop del frontend saturándose — max ${lagS}s de lag (${r.n} muestras/15m, ${r.crit} críticas)`,
      body: `El event-loop de Node del frontend lleva ${r.n} muestra(s) sobre umbral en 15 min, ${r.crit} critica(s). Pico ${lagS}s.\n\nQUE SIGNIFICA AHORA (recalibrado 28/07, T-160): una CRITICA ya no es un pico suelto — exige que el p99 este degradado TAMBIEN, o que el p99 solo ya sea severo. Es decir: el loop esta pegajoso de forma SOSTENIDA, no un bache aislado.\n\nOJO CON LA CONCLUSION FACIL: el cuerpo anterior recomendaba DAR CAPACIDAD, y eso se midio el 27/07 y era falso — CPU al 1-4% de media con las tareas ya a 2 vCPU. Antes de tocar el autoescalado, comprueba que la CPU acompana; si no, el problema NO es capacidad.\n\nQUE MIRAR, en orden:\n  1. metadata->>'instanceId' de los eventos: dice QUE tarea. Si es SIEMPRE la misma, es esa instancia (fuga de memoria, GC), no la flota.\n  2. p99Ms de los eventos: si esta en ~20ms es el SUELO DE RESOLUCION del medidor, no lag (un Node ocioso reporta eso).\n  3. CPU del servicio Average Y MAXIMUM. Solo si el maximo esta pegado al 100% sostenido es capacidad.\n  4. Pico de /api/auth/token (RS256, CPU-bound) — la firma del incidente del 21/07.\n\n  SELECT ts, severity, duration_ms, metadata->>'instanceId' AS tarea,\n         metadata->>'p99Ms' AS p99, metadata->>'maxMs' AS max\n  FROM observable_events\n  WHERE event_type='event_loop_lag' AND ts > NOW() - INTERVAL '30 minutes' ORDER BY ts DESC;`,

      metadata: {
        samples: r.n,
        critical: r.crit,
        maxLagMs: r.maxLagMs,
        windowMin: 15,
      },
      fingerprint: 'event_loop_lag',
    };
  },
  cooldownMin: 20,
};

/**
 * Watchdog wall-clock residual — detecta que el fix del 31/05/2026 (commit
 * `a4051a6b`, hook `useAnswerWatchdog` Page Visibility-aware) sigue
 * funcionando bien en TODOS los navegadores en producción.
 *
 * Pre-fix: ~80% de los watchdog events tenían duration_ms > 60s (Chrome
 * throttle setTimeout cuando la pestaña va a background; el contador wall
 * clock seguía subiendo y disparaba al volver con duraciones de 58 min).
 * Post-fix: durationMs reporta tiempo VISIBLE, debería ser <14s (12s
 * threshold + 2s grace).
 *
 * Si vemos >20% de events con dur>60s sostenido en 24h, hay una regresión
 * en algún navegador real (Safari, Firefox, mobile específico) donde la
 * Page Visibility API no se comporta como esperamos. Tests CI (JSDOM) no
 * lo detectan.
 *
 * Filtra por `deploy_version = current_deploy` para que el historial
 * pre-fix NO contamine el ratio (fix 31/05/2026 — primera versión sufría
 * falsos positivos porque la ventana 24h incluía events del hook viejo
 * de los deploys anteriores). Mismo patrón que health-check.md con 5xx.
 *
 * Severity warn (no critical) porque el fix YA mitigó el síntoma — esto
 * es trending. Cooldown 4h para no spamear.
 */
export const RULE_WATCHDOG_WALLCLOCK_RESIDUAL: AlertRule<{
  total: number;
  over60s: number;
  pctResidual: number;
}> = {
  name: 'watchdog_wallclock_residual',
  severity: 'warn',
  query: sql`
    WITH current_deploy AS (
      -- Deploy actual = el más frecuente entre eventos recientes en la
      -- misma tabla. Evita contar events de deploys anteriores donde
      -- el hook aún era wall-clock (ratio histórico siempre alto).
      SELECT deploy_version
      FROM validation_error_logs
      WHERE created_at > NOW() - INTERVAL '4 hours'
        AND deploy_version IS NOT NULL
      GROUP BY deploy_version
      ORDER BY COUNT(*) DESC
      LIMIT 1
    )
    SELECT
      COUNT(*) FILTER (WHERE vel.duration_ms > 60000)::int AS "over60s",
      COUNT(*)::int                                        AS total,
      COALESCE(
        ROUND(100.0 * COUNT(*) FILTER (WHERE vel.duration_ms > 60000) / NULLIF(COUNT(*), 0), 1),
        0
      )::numeric                                           AS "pctResidual"
    FROM public.validation_error_logs vel, current_deploy cd
    WHERE vel.error_message ILIKE '%Watchdog%'
      AND vel.created_at > NOW() - INTERVAL '24 hours'
      AND vel.deploy_version = cd.deploy_version
  `,
  shouldFire: (rows) => {
    const r = rows[0];
    if (!r) return false;
    return Number(r.total) >= 5 && Number(r.pctResidual) > 20;
  },
  buildNotification: (rows) => {
    const r = rows[0];
    return {
      title: `Watchdog residual wall-clock ${r.pctResidual}% (${r.over60s}/${r.total} > 60s)`,
      body: `El refactor 31/05/2026 (commit a4051a6b) Page Visibility-aware debía mantener este % en ~0%. Drift detectado:\n\n  - ${r.over60s} de ${r.total} watchdog events en últimas 24h reportan duration_ms > 60s.\n  - Pre-fix esto era esperado (Chrome tab-throttling). Post-fix NO debería pasar.\n\nProbables causas (en orden de frecuencia):\n  1. Safari no respeta el visibilitychange como Chrome — investigar User-Agent de los events afectados.\n  2. Mobile (iOS Safari) con suspensión agresiva del JS.\n  3. Edge case del hook donde lastTickRef no se reinicia tras un cambio de pestaña corto.\n\nInvestigar:\n  SELECT created_at, user_id, duration_ms, error_message,\n         metadata->>'userAgent' AS ua\n  FROM validation_error_logs\n  WHERE error_message ILIKE '%Watchdog%' AND duration_ms > 60000\n    AND created_at > NOW() - INTERVAL '24 hours'\n  ORDER BY duration_ms DESC LIMIT 20;`,
      metadata: {
        total: r.total,
        over60s: r.over60s,
        pctResidual: r.pctResidual,
        windowH: 24,
      },
      fingerprint: 'watchdog_wallclock_residual',
    };
  },
  // 4 horas — drift es trending, no incidente; no spamear.
  cooldownMin: 240,
};

// ════════════════════════════════════════════════════════════════════
// Pool capacity sampler (Acción 2 observability-capacity, 2026-06-01)
// ────────────────────────────────────────────────────────────────────
// El cron pool-capacity-sampler escribe en `pool_capacity_samples` cada
// minuto. Estas 4 reglas explotan esa data para detección granular de
// problemas en el pool DB ANTES de que se traduzcan en 5xx (leading
// indicator) y para garantizar que la pieza de observabilidad sigue viva.
// ════════════════════════════════════════════════════════════════════

/**
 * Zombie crítico: hay conexiones `idle in transaction` >5s desde un
 * cliente real (no autovacuum). Es la firma de Hipótesis B del roadmap
 * pool-segregation: `after()`/Stripe webhook retiene slot pool.
 *
 * Una sola muestra con esta bandera ya merece alerta — es un slot
 * perdido del pool max:8 que no se recupera hasta que el cliente cierre
 * la conexión o el `idle_in_transaction_session_timeout` (60s) actúe.
 */
export const RULE_POOL_IDLE_IN_TX_DETECTED: AlertRule<{
  n: number;
  lastAt: Date | string | null;
}> = {
  name: 'pool_idle_in_tx_detected',
  severity: 'critical',
  query: sql`
    SELECT COUNT(*)::int AS n,
           MAX(sample_at) AS "lastAt"
    FROM pool_capacity_samples
    WHERE sample_at > NOW() - INTERVAL '5 minutes'
      AND idle_in_tx_over_5s > 0
  `,
  shouldFire: (rows) => (rows[0]?.n ?? 0) >= 2,
  buildNotification: (rows) => {
    const n = rows[0]?.n ?? 0;
    return {
      title: `Pool: ${n} muestras con idle-in-transaction >5s en 5 min`,
      body:
        `Hay clientes manteniendo transacciones abiertas sin commit/rollback.\n` +
        `Firma típica de Hipótesis B (after()/Stripe webhook retiene slot).\n\n` +
        `Diagnóstico:\n` +
        `  SELECT pid, application_name, state, query, NOW()-state_change AS age\n` +
        `  FROM pg_stat_activity\n` +
        `  WHERE state='idle in transaction' AND NOW()-state_change > INTERVAL '5 seconds';\n\n` +
        `Si persiste >5 min, considerar pg_terminate_backend(pid) sobre el zombi.`,
      metadata: { samples: n, windowMin: 5 },
      fingerprint: 'pool_idle_in_tx',
    };
  },
  cooldownMin: 30,
};

/**
 * Conexiones colgadas en wait_event=ClientRead con state NO-IDLE >10s.
 * (ClientRead+idle es comportamiento normal y se excluye del filtro
 * a nivel SQL en `take_pool_capacity_sample`).
 *
 * Esto indica:
 *   - Cliente cerró TCP sin commit/abort (Supavisor blip, kill -9 del task).
 *   - O autovacuum/worker en estado raro con ClientRead — improbable
 *     porque filtramos backend_type='client backend'.
 *
 * Deploy-aware (diagnóstico 2026-06-01): en cada rolling deploy del frontend,
 * el task viejo cierra TCP sin commit al morir → 1-2 conexiones quedan en
 * ClientRead ~2-3 min → la regla disparaba un email CRITICAL por deploy
 * (ruido). Si hay ventana de deploy activa (ver `ctx.deployWindow`), se
 * silencia SALVO que el recuento de conn-min colgadas supere
 * `POOL_HUNG_DEPLOY_OVERRIDE_CONNMIN` — eso ya no es el goteo de un rolling
 * sino saturación real (ej. el pico de 14 conn-min visto el 2026-06-01
 * 07:49) y debe alertar aunque haya deploy.
 *
 * Piso de conn-min siempre-activo (recalibrado 2026-06-03): incluso FUERA de
 * deploy hay un goteo permanente de 1-2 conexiones hung en ClientRead, con
 * `frontend_active_conns = 0` — NO es el pool postgres-js del frontend, sino
 * el residual del path `getDb()` (escritura/auth) que aún cuelga del Supavisor
 * regional (raíz conocida en [[project_supavisor_zombie_conn_root_cause]],
 * Capa 2 pendiente, se cierra del todo con RDS). A 1-2 conns es inofensivo,
 * pero disparaba un email CRITICAL cada 30 min (cooldown) → spam que ahogaba
 * los CRITICAL reales. El piso exige acumulación real: una cascada (caso
 * 27/05) satura múltiples conns durante minutos = decenas de conn-min, muy por
 * encima del piso, y además la cubren en paralelo `canary_db_pool` (SELECT 1
 * timeout, instantáneo), `pool_frontend_saturation` y `5xx_spike`.
 *
 * Gate de pico simultáneo (recalibrado 2026-06-12, post alert-fatigue): el piso
 * de conn-min por sí solo NO bastaba. El goteo residual creció a 2-3 conns
 * sostenidas (no 1-2), y `SUM(conn-min)` confunde "pocas conns mucho rato"
 * (residual: 2-3 conns × 5 muestras ≈ 10-15 conn-min) con "muchas conns un
 * instante" (cascada real). En 24h reales el pico simultáneo (`maxHung`) NUNCA
 * pasó de 3 y el pool frontend nunca rozó su techo, pero el email CRITICAL
 * disparaba cada 30 min igual. La señal que discrimina de verdad es el PICO
 * simultáneo: el residual es ≤3, una saturación real satura muchas conns a la
 * vez. Exigimos `maxHung >= POOL_HUNG_MIN_PEAK` además del piso de conn-min.
 * La cascada real sigue cubierta por `canary_db_pool` + `pool_frontend_saturation`
 * + `5xx_spike`, así que silenciar el goteo NO deja punto ciego.
 */
const POOL_HUNG_DEPLOY_OVERRIDE_CONNMIN = 5;
const POOL_HUNG_MIN_CONNMIN = 10;
const POOL_HUNG_MIN_PEAK = 5;

export const RULE_POOL_HUNG_CLIENTREAD_DETECTED: AlertRule<{
  n: number;
  totalHung: number;
  maxHung: number;
}> = {
  name: 'pool_hung_clientread_detected',
  severity: 'critical',
  query: sql`
    SELECT COUNT(*)::int AS n,
           COALESCE(SUM(hung_clientread_over_10s), 0)::int AS "totalHung",
           COALESCE(MAX(hung_clientread_over_10s), 0)::int AS "maxHung"
    FROM pool_capacity_samples
    WHERE sample_at > NOW() - INTERVAL '5 minutes'
      AND hung_clientread_over_10s > 0
  `,
  shouldFire: (rows, ctx) => {
    const n = rows[0]?.n ?? 0;
    const totalHung = rows[0]?.totalHung ?? 0;
    const maxHung = rows[0]?.maxHung ?? 0;
    if (n < 2) return false;
    // Gate de pico simultáneo (recalibrado 2026-06-12): el goteo residual del
    // path getDb()/Supavisor es SIEMPRE <=3 conns simultáneas; una saturación
    // real satura muchas conns a la vez. Exigir pico alto filtra el goteo
    // crónico que disparaba un CRITICAL cada 30 min (alert-fatigue). Ver doc.
    if (maxHung < POOL_HUNG_MIN_PEAK) return false;
    // Piso siempre-activo: por debajo de POOL_HUNG_MIN_CONNMIN es el goteo
    // residual del path getDb() (front_active=0), no accionable. Ver doc arriba.
    if (totalHung < POOL_HUNG_MIN_CONNMIN) return false;
    // Durante un deploy, el goteo de 1-2 conexiones colgadas es ruido
    // esperado del rolling. Se silencia salvo recuento alto (saturación
    // real). Sin ventana de deploy (o ctx ausente) → siempre alerta.
    if (
      ctx?.deployWindow?.active &&
      totalHung < POOL_HUNG_DEPLOY_OVERRIDE_CONNMIN
    ) {
      return false;
    }
    return true;
  },
  buildNotification: (rows, ctx) => {
    const n = rows[0]?.n ?? 0;
    const total = rows[0]?.totalHung ?? 0;
    const peak = rows[0]?.maxHung ?? 0;
    const deployNote = ctx?.deployWindow?.active
      ? `\n\n⚠️ Deploy/churn en curso (${ctx.deployWindow.reasons.join('; ')}), ` +
        `pero ${total} conn-min colgadas supera el umbral ` +
        `${POOL_HUNG_DEPLOY_OVERRIDE_CONNMIN} → no es solo goteo del rolling.`
      : '';
    return {
      title: `Pool: ${n} muestras con conexiones colgadas en ClientRead (${total} conn-min, pico ${peak} simultáneas)`,
      body:
        `Conexiones cliente en estado active/idle-in-tx con wait_event=ClientRead\n` +
        `durante >10s. Firma típica de cliente que cerró TCP sin\n` +
        `commit/abort, o Supavisor blip (Hipótesis A pool-segregation).\n\n` +
        `Diagnóstico:\n` +
        `  SELECT pid, application_name, state, wait_event, NOW()-state_change AS age\n` +
        `  FROM pg_stat_activity\n` +
        `  WHERE wait_event='ClientRead' AND state IN ('active','idle in transaction')\n` +
        `    AND NOW()-state_change > INTERVAL '10 seconds';` +
        deployNote,
      metadata: {
        samples: n,
        totalHungConnMin: total,
        peakHungConns: peak,
        windowMin: 5,
        deployWindowActive: ctx?.deployWindow?.active ?? false,
      },
      fingerprint: 'pool_hung_clientread',
    };
  },
  cooldownMin: 30,
};

/**
 * Saturación alta del pool del frontend. Con 2 tasks Fargate × max:8
 * en createPoolerDbClient (post-Fase 1), el techo lógico es 16. Si
 * sostenidamente vemos >=13 conexiones activas (~81%), estamos cerca
 * del techo y el siguiente burst puede tirar el endpoint.
 *
 * Cooldown 15 min — saturación sostenida es un patrón que justifica
 * notificar más rápido que zombis ocasionales.
 */
export const RULE_POOL_FRONTEND_SATURATION_HIGH: AlertRule<{
  maxActive: number;
  samples: number;
}> = {
  name: 'pool_frontend_saturation_high',
  severity: 'warn',
  query: sql`
    SELECT
      COALESCE(MAX(frontend_active_conns), 0)::int AS "maxActive",
      COUNT(*)::int AS samples
    FROM pool_capacity_samples
    WHERE sample_at > NOW() - INTERVAL '5 minutes'
      AND frontend_active_conns >= 13
  `,
  shouldFire: (rows) => (rows[0]?.samples ?? 0) >= 3,
  buildNotification: (rows) => {
    const samples = rows[0]?.samples ?? 0;
    const max = rows[0]?.maxActive ?? 0;
    return {
      title: `Pool frontend saturación alta: ${samples} muestras con ≥13 conns activas (pico ${max})`,
      body:
        `El pool postgres-js del frontend (2 tasks × max:8 = 16 techo)\n` +
        `lleva ${samples} muestras de los últimos 5 min cerca del techo.\n` +
        `Si sube más, próximo burst de tráfico = 503 cascada.\n\n` +
        `Considerar:\n` +
        `  - Subir desiredCount: 2 → 3 (escalar horizontal).\n` +
        `  - Investigar qué endpoint consume conexiones más tiempo:\n` +
        `    SELECT endpoint, AVG(duration_ms), COUNT(*)\n` +
        `    FROM observable_events\n` +
        `    WHERE event_type='request_completed' AND ts > NOW()-INTERVAL '15 min'\n` +
        `    GROUP BY endpoint ORDER BY 2 DESC LIMIT 10;`,
      metadata: { samples, peakActiveConns: max, ceilingEstimate: 16 },
      fingerprint: 'pool_saturation',
    };
  },
  cooldownMin: 15,
};

/**
 * El cron pool-capacity-sampler NO ha emitido muestra en >3 min.
 * Sin sampler vivo, perdemos el leading indicator → ceguera operativa.
 *
 * Esta regla es meta-observabilidad: vigila al vigilante.
 */
export const RULE_POOL_SAMPLER_STALE: AlertRule<{
  lastAt: Date | string | null;
  ageMin: number;
}> = {
  name: 'pool_sampler_stale',
  severity: 'critical',
  query: sql`
    SELECT
      MAX(sample_at) AS "lastAt",
      EXTRACT(EPOCH FROM (NOW() - MAX(sample_at)))::int / 60 AS "ageMin"
    FROM pool_capacity_samples
  `,
  shouldFire: (rows) => {
    const ageMin = Number(rows[0]?.ageMin ?? 0);
    return ageMin > 3 || rows[0]?.lastAt == null;
  },
  buildNotification: (rows) => {
    const lastAt = rows[0]?.lastAt;
    const ageMin = Number(rows[0]?.ageMin ?? 0);
    return {
      title: `Pool capacity sampler MUERTO: última muestra hace ${ageMin} min`,
      body:
        `El cron pool-capacity-sampler debería emitir cada 1 min pero NO\n` +
        // `lastAt` es Date|string|null segun venga del driver; interpolar un Date
        // directamente es lo que marca restrict-template-expressions. Se formatea
        // explicito para que el aviso diga una fecha legible y no [object Object].
        `lo hace desde ${lastAt instanceof Date ? lastAt.toISOString() : (lastAt ?? '(nunca)')}.\n\n` +
        `Pérdida de leading indicator del pool. Investigar:\n` +
        `  - Logs CloudWatch del backend Fargate (¿cron crasheó?)\n` +
        `  - /health/crons (¿registrado?)\n` +
        `  - Si el container está vivo: reiniciar el service ECS.\n\n` +
        `Mientras tanto: vuelta al script ad-hoc capture-pool-pressure.cjs.`,
      metadata: { lastAt: lastAt ? String(lastAt) : null, ageMin },
      fingerprint: 'pool_sampler_stale',
    };
  },
  cooldownMin: 60,
};

/**
 * Una instancia del pooler PgBouncer NO responde a un SELECT 1 real (reachable=false)
 * en ≥2 de los últimos samples, mientras sigue registrada en el NLB. Es el caso
 * que el health-check TCP del NLB NO caza: acepta TCP pero cuelga queries → 504.
 * Datos del cron pooler-instance-sampler (tabla pgbouncer_instance_samples).
 */
export const RULE_POOLER_INSTANCE_UNREACHABLE: AlertRule<{
  instance: string;
  az: string | null;
  badSamples: number;
  lastError: string | null;
}> = {
  name: 'pooler_instance_unreachable',
  severity: 'critical',
  query: sql`
    SELECT
      instance,
      MAX(az)                                   AS az,
      COUNT(*) FILTER (WHERE NOT reachable)::int AS "badSamples",
      (ARRAY_AGG(error ORDER BY sample_at DESC) FILTER (WHERE error IS NOT NULL))[1] AS "lastError"
    FROM pgbouncer_instance_samples
    WHERE sample_at > NOW() - INTERVAL '5 minutes'
    GROUP BY instance
    HAVING COUNT(*) FILTER (WHERE NOT reachable) >= 2
  `,
  shouldFire: (rows) => rows.length > 0,
  buildNotification: (rows) => {
    const lines = rows
      .map(
        (r) =>
          `  - ${r.instance} (${r.az ?? '?'}): ${r.badSamples} fallos · ${r.lastError ?? ''}`,
      )
      .join('\n');
    return {
      title: `Pooler: ${rows.length} instancia(s) cuelga(n) queries (TCP vivo, SELECT 1 muerto)`,
      body:
        `Una o más VMs del PgBouncer aceptan TCP (el NLB las cree healthy) pero\n` +
        `NO responden a un SELECT 1 real → 504 para el % de tráfico que el NLB les manda.\n\n` +
        `${lines}\n\n` +
        `Acción inmediata:\n` +
        `  - Considerar sacarla del NLB: aws elbv2 deregister-targets --target-group-arn <tg> --targets Id=<ip>\n` +
        `  - Revisar la VM (pgbouncer atascado / upstream Supabase): SHOW POOLS por su IP privada.\n` +
        `  - Fase 2 (auto-eviction L7) eliminaría este paso manual.`,
      metadata: { instances: rows.map((r) => r.instance) },
      fingerprint: 'pooler_instance_unreachable',
    };
  },
  cooldownMin: 10,
};

/**
 * Una instancia del pooler está DEGRADADA (no caída): SELECT 1 lento, clientes
 * en cola (cl_waiting) o el cliente más antiguo esperando (maxwait) — leading
 * indicator ANTES de que cuelgue del todo. Por instancia, para distinguir cuál.
 */
export const RULE_POOLER_INSTANCE_DEGRADED: AlertRule<{
  instance: string;
  az: string | null;
  maxSelect1Ms: number | null;
  maxClWaiting: number | null;
  maxMaxwaitMs: number | null;
  badSamples: number;
}> = {
  name: 'pooler_instance_degraded',
  severity: 'error',
  query: sql`
    SELECT
      instance,
      MAX(az)               AS az,
      MAX(select1_ms)::int  AS "maxSelect1Ms",
      MAX(cl_waiting)::int  AS "maxClWaiting",
      (MAX(maxwait_us) / 1000)::int AS "maxMaxwaitMs",
      COUNT(*) FILTER (
        WHERE reachable AND (select1_ms > 1500 OR cl_waiting > 5 OR maxwait_us > 1000000)
      )::int AS "badSamples"
    FROM pgbouncer_instance_samples
    WHERE sample_at > NOW() - INTERVAL '5 minutes'
    GROUP BY instance
    HAVING COUNT(*) FILTER (
      WHERE reachable AND (select1_ms > 1500 OR cl_waiting > 5 OR maxwait_us > 1000000)
    ) >= 2
  `,
  shouldFire: (rows) => rows.length > 0,
  buildNotification: (rows) => {
    const lines = rows
      .map(
        (r) =>
          `  - ${r.instance} (${r.az ?? '?'}): SELECT1≤${r.maxSelect1Ms}ms · cl_waiting≤${r.maxClWaiting} · maxwait≤${r.maxMaxwaitMs}ms (${r.badSamples} samples)`,
      )
      .join('\n');
    return {
      title: `Pooler: ${rows.length} instancia(s) degradada(s) (leading indicator)`,
      body:
        `Una o más VMs del PgBouncer muestran latencia/cola alta (aún sirven, pero\n` +
        `si empeora → cuelgues → 504). Por instancia:\n\n` +
        `${lines}\n\n` +
        `Investigar:\n` +
        `  - SELECT * FROM v_pgbouncer_instances_last_15min;\n` +
        `  - ¿es UNA instancia o ambas? UNA → problema de esa VM (reiniciar pgbouncer / sacar del NLB).\n` +
        `  - Ambas → upstream Supabase lento (pg_stat_statements / query lenta).`,
      metadata: { instances: rows.map((r) => r.instance) },
      fingerprint: 'pooler_instance_degraded',
    };
  },
  cooldownMin: 15,
};

/**
 * Canary del GATE anti-scraping (Turnstile). Se dispara post-deploy vía
 * POST /api/v2/canary/run-questions-gate. Si el gate retara a un usuario normal
 * (regresión en la policy/contador Redis), el canary emite este evento.
 */
export const RULE_CANARY_QUESTIONS_GATE_FAILED: AlertRule<{
  n: number;
  lastStep: string | null;
  lastError: string | null;
  lastStatus: number | null;
}> = {
  name: 'canary_questions_gate_failed',
  severity: 'critical',
  query: sql`
    SELECT COUNT(*)::int AS n,
           (ARRAY_AGG(metadata->>'step' ORDER BY created_at DESC))[1] AS "lastStep",
           (ARRAY_AGG(error_message ORDER BY created_at DESC))[1] AS "lastError",
           (ARRAY_AGG(http_status ORDER BY created_at DESC))[1] AS "lastStatus"
    FROM observable_events
    WHERE event_type = 'canary_questions_gate_failed'
      AND created_at > NOW() - INTERVAL '15 minutes'
  `,
  shouldFire: (rows) => (rows[0]?.n ?? 0) > 0,
  buildNotification: (rows) => {
    const r = rows[0];
    return {
      title: `🚨 Canary gate anti-scraping FALLÓ (${r.n}) — cargar preguntas roto`,
      body:
        `El canary post-deploy detectó que cargar preguntas como usuario NORMAL no ` +
        `funciona correctamente. Esto afecta al estudio de todos los usuarios.\n\n` +
        `Último fallo:\n  - step: ${r.lastStep ?? '(n/a)'}\n  - http_status: ${r.lastStatus ?? '(n/a)'}\n  - error: ${r.lastError ?? '(n/a)'}\n\n` +
        `ACCIONES SEGÚN STEP:\n` +
        `  - gate_disabled: el gate está APAGADO en prod (enabled=false). Causa típica:\n` +
        `    site key NO horneada (build-arg sin ARG/ENV en Dockerfile) o CAPTCHA_ENABLED\n` +
        `    /secret ausente en SSM. El banco NO está protegido. Revisar /api/security/captcha/status.\n` +
        `  - gate_false_positive (403): el gate Turnstile reta a usuarios que NO superan el umbral.\n` +
        `    Regresión en lib/security/challengePolicy/questionsServed o verifyHumanChallenge.\n` +
        `    MITIGACIÓN INMEDIATA: SSM /vence-frontend/CAPTCHA_ENABLED=false + redeploy frontend.\n` +
        `  - request (5xx): el endpoint /api/questions/filtered cae. Logs frontend ECS.\n` +
        `  - validate_body: 200 pero sin preguntas. Fetcher/BD/scope roto.\n` +
        `  - validate_latency: >12s. Pool BD saturado.\n\n` +
        `Contexto: gate anti-scraping (caso Ana Fernández 02/06). Doc reembolsos.md.`,
      metadata: {
        count: r.n,
        lastStep: r.lastStep,
        lastError: r.lastError,
        lastStatus: r.lastStatus,
        windowMin: 15,
      },
      fingerprint: 'canary_questions_gate_failed',
    };
  },
  cooldownMin: 15,
};

/**
 * El canary de la política de identidad en los pagos falló (31/07/2026).
 *
 * Prueba en vivo, tras cada deploy, las DOS mitades de esa política: que el checkout **no**
 * corta cuando el cliente manda un id desincronizado, y que cancelar **sí** corta. Por
 * separado no prueban nada —una pasaría con todo abierto y la otra con todo cerrado—, así que
 * cualquiera de las dos en rojo es una regresión real.
 *
 * Nace del caso del 31/07: alguien intentó comprar premium 17 veces en 10 minutos y recibió
 * 403 en todas, y no se enteró nadie hasta el día siguiente.
 */
export const RULE_CANARY_IDENTIDAD_PAGO_FAILED: AlertRule<{
  n: number;
  lastStep: string | null;
  lastError: string | null;
  lastStatus: number | null;
}> = {
  name: 'canary_identidad_pago_failed',
  severity: 'critical',
  query: sql`
    SELECT COUNT(*)::int AS n,
           (ARRAY_AGG(metadata->>'step' ORDER BY created_at DESC))[1] AS "lastStep",
           (ARRAY_AGG(error_message ORDER BY created_at DESC))[1] AS "lastError",
           (ARRAY_AGG(http_status ORDER BY created_at DESC))[1] AS "lastStatus"
    FROM observable_events
    WHERE event_type = 'canary_identidad_pago_failed'
      AND created_at > NOW() - INTERVAL '15 minutes'
  `,
  shouldFire: (rows) => (rows[0]?.n ?? 0) > 0,
  buildNotification: (rows) => {
    const r = rows[0];
    return {
      title: `🚨 Canary de identidad en pagos FALLÓ (${r.n}) — o no se puede pagar, o se cancela de más`,
      body:
        `El canary post-deploy probó la política de identidad de /api/stripe y algo cambió.\n\n` +
        `Último fallo:\n  - step: ${r.lastStep ?? '(n/a)'}\n  - http_status: ${r.lastStatus ?? '(n/a)'}\n  - error: ${r.lastError ?? '(n/a)'}\n\n` +
        `ACCIONES SEGÚN STEP:\n` +
        `  - checkout_cerrado (403): el checkout volvió a cortar por identidad. Un cliente con la\n` +
        `    sesión desincronizada NO PUEDE PAGAR — es el caso del 31/07 (17 intentos bloqueados).\n` +
        `    Mirar \`alDiscrepar\` en app/api/stripe/create-checkout/route.js: debe ser\n` +
        `    'seguir-con-el-token'.\n` +
        `  - cancel_abierto: PEOR. Cancelar aceptó un userId ajeno; con una pantalla desincronizada\n` +
        `    se cancelaría la suscripción de quien tiene el token, en silencio. Debe ser 'cortar'.\n` +
        `  - sesion_inutil: el canary no pudo ni leer lo suyo. No dice nada de la política: mirar\n` +
        `    SMOKE_USER_ID / SUPABASE_JWT_SECRET y verifyAuth antes de tocar los pagos.\n\n` +
        `Contexto: T-340. La política y su porqué, en lib/api/shared/auth.ts.`,
      metadata: {
        count: r.n,
        lastStep: r.lastStep,
        lastError: r.lastError,
        lastStatus: r.lastStatus,
        windowMin: 15,
      },
      fingerprint: 'canary_identidad_pago_failed',
    };
  },
  cooldownMin: 15,
};

/**
 * Scraping / barrido del banco de preguntas.
 *
 * Detecta cuentas (incluido premium, que NO tiene límite diario) que se sirven
 * cientos de preguntas en una ventana corta SIN responderlas — la firma del que
 * usa la plataforma para descargar el banco, no para estudiar.
 *
 * Discriminador empírico (30d, ventana 2h): un alumno intenso real responde lo
 * que se le sirve (ratio respondidas 25-100%); el scraper deja ~0%. El umbral
 * cruza p999 de servidas (454) con un ratio bajo para no marcar estudiones:
 *   - servidas >= 300 en 2h  (p99=227, p999=454)
 *   - Y ratio respondidas < 15%  (legítimos >25%, scraper <5%)
 * Se excluyen admins (user_roles). Caso origen: Ana Fernández 02/06/2026
 * (617 tests/18d, picos de 2.500 servidas/2h al 0% respondidas, "scrape & refund").
 *
 * Detecta sobre `test_questions` directamente (una fila por pregunta servida con
 * user_id+created_at+user_answer) → sin instrumentación nueva. 'BLANK' es el valor
 * literal que escribe el modo examen para una pregunta saltada (no cuenta como respondida).
 */
export const RULE_SCRAPING_SWEEP: AlertRule<{
  userId: string;
  email: string | null;
  planType: string | null;
  served: number;
  answered: number;
}> = {
  name: 'scraping_sweep',
  severity: 'critical',
  query: sql`
    WITH sweep AS (
      SELECT
        tq.user_id,
        COUNT(*)::int AS served,
        COUNT(*) FILTER (
          WHERE tq.user_answer IS NOT NULL
            AND tq.user_answer <> ''
            AND tq.user_answer <> 'BLANK'
        )::int AS answered
      FROM public.test_questions tq
      WHERE tq.created_at > NOW() - INTERVAL '2 hours'
        AND tq.user_id IS NOT NULL
        AND tq.user_id NOT IN (
          SELECT user_id FROM public.user_roles
          WHERE role = 'admin' AND is_active = true
        )
      GROUP BY tq.user_id
      HAVING COUNT(*) >= 300
         AND COUNT(*) FILTER (
               WHERE tq.user_answer IS NOT NULL
                 AND tq.user_answer <> ''
                 AND tq.user_answer <> 'BLANK'
             )::float / NULLIF(COUNT(*), 0) < 0.15
    )
    SELECT
      s.user_id AS "userId",
      s.served,
      s.answered,
      p.email,
      p.plan_type AS "planType"
    FROM sweep s
    LEFT JOIN public.user_profiles p ON p.id = s.user_id
    ORDER BY s.served DESC
  `,
  shouldFire: (rows) => rows.length > 0,
  buildNotification: (rows) => {
    const lines = rows.map((r) => {
      const pct =
        r.served > 0 ? ((r.answered / r.served) * 100).toFixed(1) : '0.0';
      const who = r.email ?? (r.userId ?? '?').slice(0, 8);
      return `  - ${who} [${r.planType ?? '?'}]: ${r.served} servidas / ${r.answered} respondidas (${pct}%)`;
    });
    return {
      title: `Posible scraping del banco: ${rows.length} cuenta(s) con barrido masivo`,
      body:
        `${rows.length} cuenta(s) se han servido >=300 preguntas en 2h respondiendo <15% ` +
        `— firma de descarga del banco, no de estudio:\n\n` +
        `${lines.join('\n')}\n\n` +
        `Premium NO tiene límite diario, así que esto es la única red. Revisar en\n` +
        `/admin/fraudes y decidir (denegar reembolso de garantía, marcar admin_notes,\n` +
        `degradar/limitar). Procedimiento: docs/procedures/reembolsos.md + caso Ana 02/06.`,
      metadata: {
        userIds: rows.map((r) => r.userId),
        topServed: rows[0]?.served ?? 0,
        count: rows.length,
      },
      fingerprint: `scraping_sweep:${rows
        .map((r) => r.userId)
        .sort()
        .join(',')}`,
    };
  },
  // ≈ cada 2 horas: el engine corre cada 5 min, pero tras disparar se silencia 120 min.
  cooldownMin: 120,
};

/**
 * Gap 17 (2026-06-03, post-incidente email de Eva) — fallo silencioso de
 * notificación de impugnación. Lee el evento `invariant_violation` que emite el
 * cron `dispute-email-reconciliation` cuando una impugnación quedó resuelta pero
 * el email al usuario NO se envió (ni se intentó). Hace accionable lo que antes
 * era invisible: el usuario cree que le ignoramos.
 */
export const RULE_DISPUTE_EMAIL_DROP: AlertRule<{ realDrops: number }> = {
  name: 'dispute_email_drop',
  severity: 'error',
  query: sql`
    SELECT COALESCE(MAX((metadata->>'realDrops')::int), 0) AS "realDrops"
    FROM observable_events
    WHERE event_type = 'invariant_violation'
      AND metadata->>'invariant' = 'dispute_resolved_without_email'
      AND ts > NOW() - INTERVAL '90 minutes'
  `,
  shouldFire: (rows) => (rows[0]?.realDrops ?? 0) > 0,
  buildNotification: (rows) => ({
    title: `${rows[0]?.realDrops ?? 0} impugnación(es) resuelta(s) SIN email al usuario`,
    body:
      'El reconciliador detectó impugnaciones cerradas con respuesta cuyo email ' +
      'nunca salió (el usuario cree que le ignoramos). Revisar observable_events ' +
      "con event_type='invariant_violation' (sample con disputeId). ANTES de reenviar, " +
      'descartar que fuera un salto legítimo por preferencia: si el usuario tenía el ' +
      'soporte apagado AL CERRARSE y se le restauró después, el envío se decidió bien ' +
      'y no hay nada que reenviar (T-422). Señal de eso: 0 filas en email_events Y 0 en ' +
      'email_unsubscribe_tokens para esa impugnación — el token se crea antes de enviar, ' +
      'así que su ausencia dice que se salió por el gate de preferencias, no que Resend ' +
      'fallara. Triaje completo en docs/runbooks/health-check.md §0.',
    metadata: { realDrops: rows[0]?.realDrops ?? 0 },
  }),
  cooldownMin: 60,
};

/**
 * Gemela de la anterior para el OTRO canal por el que contestamos a una persona:
 * respuestas a feedback ([T-501]). El cron `feedback-email-reconciliation` la
 * levanta cuando una respuesta de admin se escribió, se guardó y su email nunca
 * salió — el usuario cree que le ignoramos exactamente igual que en el caso Eva.
 *
 * Por qué es una regla APARTE y no un `OR` en la de impugnaciones: son dos
 * caminos de código distintos (`resolveDispute` / `respondFeedback`), con
 * saltos legítimos distintos, y mezclarlas haría que el cooldown de una
 * silenciara a la otra. Fingerprint propio por el mismo motivo.
 *
 * Calibración con datos reales (90 días, medidos el 03/08/2026 antes de
 * construir nada): 532 respuestas de admin, 43 sin email — y de esas, **42 son
 * saltos legítimos y 1 un drop real**. O sea que el criterio del reconciliador
 * (evidencia del momento + token de baja) deja pasar ~0,2 avisos al mes: una
 * ocurrencia es señal, no ruido, y no hace falta umbral de ráfaga.
 */
export const RULE_FEEDBACK_EMAIL_DROP: AlertRule<{ realDrops: number }> = {
  name: 'feedback_email_drop',
  severity: 'error',
  query: sql`
    SELECT COALESCE(MAX((metadata->>'realDrops')::int), 0) AS "realDrops"
    FROM observable_events
    WHERE event_type = 'invariant_violation'
      AND metadata->>'invariant' = 'feedback_responded_without_email'
      AND ts > NOW() - INTERVAL '90 minutes'
  `,
  shouldFire: (rows) => (rows[0]?.realDrops ?? 0) > 0,
  buildNotification: (rows) => ({
    title: `${rows[0]?.realDrops ?? 0} respuesta(s) a feedback SIN email al usuario`,
    body:
      'El reconciliador detectó respuestas de admin escritas y guardadas cuyo email ' +
      "nunca salió. Revisar observable_events con event_type='invariant_violation' e " +
      "invariant='feedback_responded_without_email' (el sample trae messageId y feedbackId). " +
      'Cada caso del sample con `conToken:true` es CERTEZA, no sospecha: el token de baja se ' +
      'crea dentro de sendEmailV2, así que su presencia prueba que el envío pasó el gate de ' +
      'preferencias y aun así no hay fila en email_events. NO reenviar sin más: si el ' +
      'hallazgo tiene ya semanas, reenviar es peor que no hacerlo (decisión de Manuel, ' +
      '03/08) — la persona tiene la respuesta en la campana y en /soporte. Lo que sí toca ' +
      'es mirar por qué se perdió. Triaje completo en docs/runbooks/health-check.md §0.',
    metadata: { realDrops: rows[0]?.realDrops ?? 0 },
  }),
  cooldownMin: 60,
};

/**
 * Email transaccional que SÍ se intentó y el proveedor RECHAZÓ (`email_events`
 * con `event_type='failed'`). Complementa a `dispute_email_drop`, que cubre el
 * caso opuesto (el envío nunca se llegó a intentar, 0 filas).
 *
 * ⚠️ Origen — el hueco entre las dos (26/07/2026, cabo de T-116): el
 * reconciliador de Gap 17 se construyó dando por hecho que el "intentado y
 * fallido" YA estaba vigilado (así lo dice literalmente su comentario de
 * cabecera). NO lo estaba: no había ninguna regla mirando `email_events`. Por
 * eso una `idempotencyKey` fija por impugnación estuvo **2 meses** haciendo que
 * Resend rechazara toda respuesta corregida —"idempotency key has been used…
 * but the request body was modified"— con 8 usuarias afectadas, y lo destapó
 * una de ellas (Sara, 25/07) en vez de la observabilidad. Filosofía martillo:
 * si un usuario nos reporta lo que la observabilidad podía haber capturado,
 * hemos fallado.
 *
 * Calibración con datos reales (180 días de `email_events`): 13.375 `sent` y
 * solo **9 `failed`**, repartidos en 7 días distintos y con un máximo de 2 en
 * un mismo día. Es decir, un fallo de envío es RARO → **cualquier ocurrencia es
 * señal, no ruido**, y no hace falta umbral de ráfaga. Ventana de 15 min (el
 * engine corre cada 5) para que un tick perdido no se trague el único evento.
 * `fingerprint` por `email_type`: un problema de impugnaciones no debe silenciar
 * el de un recordatorio de pago durante el cooldown.
 */
export const RULE_EMAIL_SEND_FAILED: AlertRule<{
  n: number;
  emailType: string | null;
  lastError: string | null;
  lastTo: string | null;
}> = {
  name: 'email_send_failed',
  severity: 'error',
  query: sql`
    SELECT COUNT(*)::int AS n,
           (ARRAY_AGG(email_type ORDER BY created_at DESC))[1] AS "emailType",
           (ARRAY_AGG(error_details ORDER BY created_at DESC))[1] AS "lastError",
           (ARRAY_AGG(email_address ORDER BY created_at DESC))[1] AS "lastTo"
    FROM email_events
    WHERE event_type = 'failed'
      AND created_at > NOW() - INTERVAL '15 minutes'
  `,
  shouldFire: (rows) => (rows[0]?.n ?? 0) > 0,
  buildNotification: (rows) => {
    const r = rows[0];
    const tipo = r?.emailType ?? '(desconocido)';
    return {
      title: `${r?.n ?? 0} email(s) transaccional(es) RECHAZADO(s) por el proveedor — ${tipo}`,
      body:
        `Se intentó enviar y Resend lo rechazó: el usuario NO ha recibido nada, ` +
        `pero la app pudo darlo por bueno (la campana y el estado in-app sí se ` +
        `actualizan). Es un fallo SILENCIOSO de cara al usuario.\n\n` +
        `Último destinatario: ${r?.lastTo ?? '(n/a)'}\n` +
        `Último error: ${r?.lastError ?? '(n/a)'}\n\n` +
        `Si el error menciona "idempotency key … request body was modified", la clave ` +
        `de idempotencia se está reusando con un cuerpo distinto: debe derivarse del ` +
        `CONTENIDO (ver lib/api/v2/dispute/idempotency.ts, T-116).\n\n` +
        `Investigar:\n` +
        `  SELECT created_at, email_type, email_address, error_details\n` +
        `  FROM email_events WHERE event_type='failed'\n` +
        `  AND created_at > NOW() - INTERVAL '24 hours' ORDER BY created_at DESC;`,
      metadata: {
        count: r?.n ?? 0,
        emailType: tipo,
        lastError: r?.lastError ?? null,
        windowMin: 15,
      },
      fingerprint: `email_send_failed:${tipo}`,
    };
  },
  cooldownMin: 60,
};

/**
 * Lista canónica de reglas activas. Añadir nuevas reglas aquí.
 * El cron las ejecuta TODAS cada 5 min.
 */
/**
 * Conversiones de venta que NO llegaron a Google Ads: filas en DLQ (status
 * 'failed', agotaron 5 reintentos) o atascadas en 'pending' más de 6h. Señal
 * típica: refresh token de Google Ads caducado, API de Ads caída, o config rota.
 * Es dinero de atribución que se pierde EN SILENCIO si nadie lo ve — sin esto,
 * el sistema de conversiones podría dejar de subir ventas durante días sin que
 * nos enteremos. F1 trackeo-conversiones-ventas (03/06/2026).
 */
export const RULE_CONVERSION_DELIVERY_FAILED: AlertRule<{
  failed: number;
  stuck: number;
  lostEur: number;
}> = {
  name: 'conversion_delivery_failed',
  severity: 'error',
  query: sql`
    SELECT
      COUNT(*) FILTER (WHERE status = 'failed' AND created_at > NOW() - INTERVAL '48 hours')::int AS failed,
      COUNT(*) FILTER (WHERE status = 'pending' AND created_at < NOW() - INTERVAL '6 hours')::int AS stuck,
      COALESCE(SUM(value_cents) FILTER (WHERE status = 'failed' AND created_at > NOW() - INTERVAL '48 hours'), 0)::float / 100 AS "lostEur"
    FROM conversion_outbox
  `,
  shouldFire: (rows) => (rows[0]?.failed ?? 0) > 0 || (rows[0]?.stuck ?? 0) > 0,
  buildNotification: (rows) => {
    const failed = rows[0]?.failed ?? 0;
    const stuck = rows[0]?.stuck ?? 0;
    const lost = rows[0]?.lostEur ?? 0;
    return {
      title: `Conversiones sin llegar a Google Ads — ${failed} en DLQ, ${stuck} atascadas`,
      body:
        `${failed} conversiones agotaron reintentos (DLQ, ~${lost}€ de atribución perdida) ` +
        `y ${stuck} llevan >6h pendientes.\n\n` +
        `Causa típica: refresh token de Google Ads caducado, API caída, o credenciales rotas.\n\n` +
        `  SELECT id, status, retry_count, last_error FROM conversion_outbox\n` +
        `  WHERE status IN ('failed','pending') ORDER BY created_at;`,
      metadata: { failed, stuck, lostEur: lost },
      fingerprint: 'conversion_delivery_failed',
    };
  },
  cooldownMin: 120,
};

/**
 * Cobertura de atribución — tras el fix de fila base (05/06), todo usuario nuevo
 * debe quedar con fila en user_acquisition (canal). Si la cobertura de las
 * últimas 24h cae, la captura (AttributionCapture → /api/acquisition) se rompió
 * y dejamos de saber de dónde vienen los usuarios (orgánico vs ads). Umbral
 * conservador (<50%, ≥30 altas) para no falsar durante la rampa post-fix; subir
 * a ~80% cuando el estado estable confirme ~95%+. Detalle en v_attribution_coverage.
 */
export const RULE_ATTRIBUTION_COVERAGE_LOW: AlertRule<{
  altas: number;
  conCanal: number;
  pct: number;
}> = {
  name: 'attribution_coverage_low',
  severity: 'warn',
  query: sql`
    SELECT count(*)::int AS altas,
           count(ua.user_id)::int AS "conCanal",
           CASE WHEN count(*) > 0 THEN round(100.0 * count(ua.user_id) / count(*), 1) ELSE 100 END::float AS pct
    FROM user_profiles u
    LEFT JOIN user_acquisition ua ON ua.user_id = u.id
    WHERE u.created_at > NOW() - INTERVAL '24 hours'
  `,
  shouldFire: (rows) =>
    (rows[0]?.altas ?? 0) >= 30 && (rows[0]?.pct ?? 100) < 50,
  buildNotification: (rows) => {
    const r = rows[0];
    return {
      title: `Cobertura de atribución baja — ${r?.pct ?? 0}% (${r?.conCanal ?? 0}/${r?.altas ?? 0} altas con canal)`,
      body:
        `En las últimas 24h solo ${r?.conCanal ?? 0}/${r?.altas ?? 0} altas tienen canal en user_acquisition.\n\n` +
        `Causa típica: AttributionCapture (app/layout) o POST /api/acquisition rotos → dejamos de\n` +
        `saber de dónde vienen los usuarios (orgánico vs ads), y las ventas no se atan a campaña.\n\n` +
        `  SELECT * FROM v_attribution_coverage ORDER BY dia DESC LIMIT 7;`,
      metadata: {
        altas: r?.altas ?? 0,
        conCanal: r?.conCanal ?? 0,
        pct: r?.pct ?? 0,
      },
      fingerprint: 'attribution_coverage_low',
    };
  },
  cooldownMin: 720,
};

/**
 * Canary del pipeline de stats — el cron `canary-stats-pipeline` inyecta una
 * respuesta sintética cada 5 min y verifica que propaga e2e a uqh_v2. Si NO
 * propaga (step='propagation') el pipeline outbox→handler está roto/parado.
 * A diferencia de las reglas de frescura/paridad (que dependen de tráfico
 * real), este canary cubre 24/7, INCLUIDO el valle nocturno → cierra ese punto
 * ciego. Disparo con **2 fallos en 10 min** (= 2 ticks consecutivos, el canary
 * corre cada 5 min): una congelación real falla TODOS los ticks; un fallo
 * suelto (propagación >12s puntual bajo carga, o el reinicio del worker justo
 * tras un deploy) NO es freeze y no debe paginar → evita falsos positivos /
 * fatiga de alertas. Mismo criterio que la alarma CloudWatch (evaluation_periods=2).
 */
export const RULE_CANARY_STATS_PIPELINE_FAILED: AlertRule<{
  n: number;
  lastStep: string | null;
  lastError: string | null;
}> = {
  name: 'canary_stats_pipeline_failed',
  severity: 'critical',
  // CROSS-CHECK con la señal REAL (incidente 11/07): el canary usa un fixture
  // sintético (smoke user) que puede fallar por sí mismo (backlog del propio
  // fixture, reset, flood de eventos) SIN que el pipeline real esté roto. Esa
  // noche gritó CRITICAL "materialización no propaga" cuando los usuarios reales
  // materializaban perfectamente (uqh_v2.updated_at fresco). Fix: la regla SOLO
  // dispara si el canary falla Y NO hay materialización real reciente. Si un
  // usuario real materializó en los últimos 5 min, el pipeline está PROBADAMENTE
  // vivo → el fallo del canary es un artefacto del fixture, NO un incidente →
  // no paginar. RULE_MATERIALIZED_STATS_STALE (SLI directo) cubre el fallo real.
  query: sql`
    SELECT COUNT(*)::int AS n,
           (ARRAY_AGG(metadata->>'step' ORDER BY created_at DESC))[1] AS "lastStep",
           (ARRAY_AGG(error_message ORDER BY created_at DESC))[1] AS "lastError"
    FROM observable_events
    WHERE event_type = 'canary_stats_pipeline_failed'
      AND created_at > NOW() - INTERVAL '10 minutes'
      AND NOT EXISTS (
        SELECT 1 FROM user_question_history_v2
        WHERE updated_at > NOW() - INTERVAL '5 minutes'
      )
  `,
  shouldFire: (rows) => (rows[0]?.n ?? 0) >= 2,
  buildNotification: (rows) => {
    const r = rows[0];
    return {
      title: `🚨 Canary stats-pipeline FALLÓ y NO hay materialización real reciente`,
      body:
        `El canary sintético NO materializó Y ningún usuario real ha materializado\n` +
        `en los últimos 5 min → señal fuerte de que el pipeline outbox→handler→uqh_v2\n` +
        `está roto o parado (la regla ya excluye el caso "solo falla el fixture").\n\n` +
        `Último step: ${r?.lastStep ?? '(n/a)'}\n` +
        `Último error: ${r?.lastError ?? '(n/a)'}\n\n` +
        `Verifica en este orden:\n` +
        `  1. SLI directo: ¿disparó RULE_MATERIALIZED_STATS_STALE? (fuente de verdad).\n` +
        `  2. Frescura real: SELECT MAX(updated_at) FROM user_question_history_v2;\n` +
        `  3. Flags del task def vence-backend (CUTOVER_DONE / SHADOW_HANDLERS_ENABLED).\n` +
        `  4. test_questions_outbox: pending / DLQ / error_message.\n` +
        `  (Runbook: docs/runbooks/materialization-health.md.)`,
      metadata: {
        count: r?.n ?? 0,
        lastStep: r?.lastStep,
        lastError: r?.lastError,
      },
      fingerprint: 'canary_stats_pipeline_failed',
    };
  },
  cooldownMin: 15,
};

/**
 * Materialized-stats freshness — detecta que el pipeline outbox→tablas
 * materializadas se ha PARADO EN SILENCIO mientras sigue entrando tráfico.
 *
 * Caso origen 2026-06-03: el cutover de outbox se aplicó a medias (RENAME
 * shadow→canónica hecho ~02:03, pero los flags CUTOVER_DONE/SHADOW_HANDLERS_
 * ENABLED nunca se desplegaron al task def). Resultado: 5 tablas materializadas
 * (uqh_v2, article/difficulty/daily/hourly stats) dejaron de escribirse durante
 * 14h SIN una sola alerta, mientras test_questions seguía llenándose. Lo reportó
 * una usuaria ("el histórico de intentos está fallando"), no la observabilidad.
 * Esta regla cierra ese gap: habría disparado a los ~20 min.
 *
 * Lógica: si hay volumen real de respuestas recientes (pipeline claramente
 * activo) pero la última escritura de una tabla materializada es más vieja que
 * su SLO de lag → CRITICAL. El umbral de volumen (≥30 en 30 min) evita falsos
 * positivos en valle nocturno. ESCALABLE: añadir una tabla materializada nueva
 * = una línea en el VALUES del registro `reg` + una en el UNION de `mat`.
 */
export const RULE_MATERIALIZED_STATS_STALE: AlertRule<{
  table: string;
  lagMin: number;
}> = {
  name: 'materialized_stats_stale',
  severity: 'critical',
  query: sql`
    WITH src AS (
      SELECT COUNT(*)::int AS n, MAX(created_at) AS last_answer
      FROM test_questions
      WHERE created_at > NOW() - INTERVAL '30 minutes'
    ),
    reg(tbl, max_lag_min) AS (
      VALUES
        ('user_question_history_v2', 20),
        ('user_article_stats', 20),
        ('user_difficulty_stats', 20),
        ('user_daily_stats', 20),
        ('user_hourly_stats', 20),
        ('user_stats_summary', 20)
    ),
    mat AS (
      SELECT 'user_question_history_v2' AS tbl, MAX(updated_at) AS last_upd FROM user_question_history_v2
      UNION ALL SELECT 'user_article_stats', MAX(updated_at) FROM user_article_stats
      UNION ALL SELECT 'user_difficulty_stats', MAX(updated_at) FROM user_difficulty_stats
      UNION ALL SELECT 'user_daily_stats', MAX(updated_at) FROM user_daily_stats
      UNION ALL SELECT 'user_hourly_stats', MAX(updated_at) FROM user_hourly_stats
      UNION ALL SELECT 'user_stats_summary', MAX(updated_at) FROM user_stats_summary
    )
    SELECT r.tbl AS table,
           ROUND(EXTRACT(EPOCH FROM (NOW() - m.last_upd)) / 60)::int AS "lagMin"
    FROM reg r
    JOIN mat m ON m.tbl = r.tbl
    CROSS JOIN src
    WHERE src.n >= 30
      AND m.last_upd < NOW() - (r.max_lag_min * INTERVAL '1 minute')
    ORDER BY "lagMin" DESC
  `,
  shouldFire: (rows) => rows.length > 0,
  buildNotification: (rows) => {
    const lines = rows.map(
      (r) => `  - ${r.table}: ${r.lagMin} min sin actualizar`,
    );
    return {
      title: `${rows.length} tabla(s) materializada(s) congelada(s) — pipeline de stats parado`,
      body:
        `Entra volumen real de respuestas en test_questions pero estas tablas\n` +
        `materializadas no se actualizan (lag > 20 min):\n\n${lines.join('\n')}\n\n` +
        `El pipeline outbox→handlers se ha parado. Causas típicas:\n` +
        `  - Flags del cutover sin desplegar tras un task def nuevo\n` +
        `    (SHADOW_HANDLERS_ENABLED / CUTOVER_DONE ausentes en vence-backend).\n` +
        `  - Handlers del outbox-processor erroring (DLQ con error_message).\n` +
        `  - Triggers analíticos desactivados sin escritor de relevo.\n\n` +
        `Diagnóstico:\n` +
        `  SELECT COUNT(*) FILTER (WHERE processed_at IS NULL) AS pending,\n` +
        `         COUNT(*) FILTER (WHERE retry_count>=3 AND processed_at IS NULL) AS dlq\n` +
        `  FROM test_questions_outbox;\n` +
        `  aws ecs describe-task-definition ... | grep -E 'CUTOVER_DONE|SHADOW_HANDLERS'\n\n` +
        `Incidente origen 2026-06-03: cutover outbox a medias, 5 tablas congeladas\n` +
        `14h sin alerta (lo reportó una usuaria, no la observabilidad).`,
      metadata: {
        staleTables: rows.map((r) => r.table),
        maxLagMin: Math.max(...rows.map((r) => r.lagMin)),
      },
      fingerprint: `materialized_stats_stale_${rows
        .map((r) => r.table)
        .sort()
        .join(',')}`,
    };
  },
  cooldownMin: 30,
};

/**
 * Materialized-stats CORRECTNESS — complementa a la regla de frescura. La
 * frescura caza "la tabla no se escribe"; ésta caza "se escribe MAL" (valores
 * incorrectos / propagación incompleta), que es un fallo distinto y más sutil.
 *
 * Por qué hace falta además del cron de drift existente: durante el incidente
 * del 03/06 el `check_stats_drift` NO registró NADA en 7 días pese a 14h de
 * valores congelados → su detección de correctitud tiene un punto ciego. Esta
 * regla es una paridad EN VIVO y barata (36ms): para las claves (user,pregunta)
 * respondidas hace 5-20 min (margen suficiente para que el handler async
 * propague), `uqh_v2.total_attempts` DEBE igualar el conteo real en
 * test_questions. Si no, la propagación está rota o escribe mal.
 *
 * uqh_v2 es el proxy (sin claves NULL, el más visible al usuario — fue lo que
 * reportó Nila). Si propaga bien, el resto del pipeline también; si diverge,
 * es señal de fallo del handler. Umbral ≥5 para absorber fuzz de lag puntual.
 */
export const RULE_STATS_PARIDAD_DIVERGENCE: AlertRule<{ divergent: number }> = {
  name: 'stats_paridad_divergence',
  severity: 'error',
  // Recalibrado 13/07 (anti falso-positivo transitorio): el bug estaba en que
  // real_total contaba TODAS las filas de la clave —incluidas respuestas <5min
  // aún EN VUELO— pero solo exigía que la clave tuviera UNA respuesta de 5-20min.
  // Un user re-respondiendo la misma pregunta en <5min inflaba real_total y uqh
  // aún no lo había propagado → divergencia transitoria (visto 13/07: 5 divergen-
  // cias con outbox 0 pendientes y uqh fresco 2s después). Fix: (1) real_total solo
  // cuenta filas YA propagables (>5min); (2) solo marca cuando uqh va POR DETRÁS
  // (u.total_attempts < real_total) — que uqh vaya adelantada (propagó una <5min
  // rápido) NO es bug.
  query: sql`
    WITH recent_keys AS (
      SELECT DISTINCT user_id, question_id
      FROM test_questions
      WHERE created_at BETWEEN NOW() - INTERVAL '30 minutes' AND NOW() - INTERVAL '5 minutes'
        AND question_id IS NOT NULL AND is_correct IS NOT NULL
    ),
    expected AS (
      SELECT k.user_id, k.question_id, COUNT(*)::int AS real_total
      FROM recent_keys k
      JOIN test_questions tq
        ON tq.user_id = k.user_id AND tq.question_id = k.question_id
       AND tq.is_correct IS NOT NULL
       AND tq.created_at < NOW() - INTERVAL '5 minutes'
      WHERE EXISTS (SELECT 1 FROM questions q WHERE q.id = k.question_id)
      GROUP BY k.user_id, k.question_id
    )
    SELECT COUNT(*) FILTER (
             WHERE u.user_id IS NULL OR u.total_attempts < e.real_total
           )::int AS divergent
    FROM expected e
    LEFT JOIN user_question_history_v2 u USING (user_id, question_id)
  `,
  shouldFire: (rows) => (rows[0]?.divergent ?? 0) >= 5,
  buildNotification: (rows) => {
    const n = rows[0]?.divergent ?? 0;
    return {
      title: `${n} divergencias uqh_v2 vs test_questions — el pipeline de stats escribe MAL`,
      body:
        `Hay ${n} claves (user,pregunta) respondidas hace 5-20 min cuyo\n` +
        `user_question_history_v2.total_attempts NO coincide con el conteo real\n` +
        `en test_questions. Con 5 min de margen la propagación async ya debería\n` +
        `estar hecha → o el handler no propaga o calcula mal.\n\n` +
        `A diferencia de la frescura (tabla parada), esto es "escribe valores\n` +
        `incorrectos". El cron de drift no lo cazó (punto ciego, incidente 03/06).\n\n` +
        `Diagnóstico:\n` +
        `  - test_questions_outbox: ¿DLQ o errores de handler?\n` +
        `  - Comparar un user concreto: COUNT(test_questions) por pregunta vs\n` +
        `    su fila en user_question_history_v2.\n` +
        `  - Revisar deploys recientes del outbox-processor / handlers.`,
      metadata: {
        divergent: n,
        windowMin: '5-30',
        table: 'user_question_history_v2',
      },
      fingerprint: 'stats_paridad_divergence',
    };
  },
  cooldownMin: 30,
};

/**
 * Materialized-stats CORRECTNESS para `user_daily_stats` — hermana de
 * RULE_STATS_PARIDAD_DIVERGENCE (que cubre uqh_v2). Añadida 25/06/2026 al migrar
 * `refresh_ranking_cache()` a leer de `user_daily_stats` en vez de escanear
 * test_questions: el leaderboard ahora DEPENDE de esta tabla, así que su
 * correctitud de VALOR debe vigilarse (la frescura ya la cubre
 * RULE_MATERIALIZED_STATS_STALE). Cierra el hueco detectado el 25/06: la paridad
 * en vivo solo miraba uqh_v2, no user_daily_stats.
 *
 * Para usuarios que respondieron hace 5-20 min (margen de propagación async), su
 * `user_daily_stats.total_questions` de HOY (día Europe/Madrid, igual que la
 * tabla) debe igualar el conteo real en test_questions de hoy. Tolerancia ±2
 * para absorber lag de borrados/timing puntual; >2 de diferencia en ≥5 usuarios
 * = el handler del outbox escribe mal y el ranking se corrompe.
 */
export const RULE_USER_DAILY_STATS_PARIDAD: AlertRule<{ divergent: number }> = {
  name: 'user_daily_stats_paridad_divergence',
  severity: 'error',
  query: sql`
    WITH madrid_today AS (
      SELECT (NOW() AT TIME ZONE 'Europe/Madrid')::date AS d
    ),
    recent_users AS (
      SELECT DISTINCT user_id
      FROM test_questions
      WHERE created_at BETWEEN NOW() - INTERVAL '20 minutes' AND NOW() - INTERVAL '5 minutes'
        AND user_id IS NOT NULL
    ),
    expected AS (
      SELECT r.user_id, COUNT(*)::int AS real_total
      FROM recent_users r
      JOIN test_questions tq ON tq.user_id = r.user_id
      WHERE (tq.created_at AT TIME ZONE 'Europe/Madrid')::date = (SELECT d FROM madrid_today)
      GROUP BY r.user_id
    )
    SELECT COUNT(*) FILTER (
             WHERE ABS(COALESCE(u.total_questions, 0) - e.real_total) > 2
           )::int AS divergent
    FROM expected e
    LEFT JOIN user_daily_stats u
      ON u.user_id = e.user_id AND u.day = (SELECT d FROM madrid_today)
  `,
  shouldFire: (rows) => (rows[0]?.divergent ?? 0) >= 5,
  buildNotification: (rows) => {
    const n = rows[0]?.divergent ?? 0;
    return {
      title: `${n} divergencias user_daily_stats vs test_questions — el rollup del ranking escribe MAL`,
      body:
        `Hay ${n} usuarios activos hace 5-20 min cuyo user_daily_stats.total_questions\n` +
        `de hoy (día Europe/Madrid) difiere en >2 del conteo real en test_questions.\n` +
        `El leaderboard lee de esta tabla (refresh_ranking_cache, migración 25/06),\n` +
        `así que un fallo aquí corrompe el ranking.\n\n` +
        `Diagnóstico:\n` +
        `  - test_questions_outbox: ¿DLQ o errores del handler user-daily-stats?\n` +
        `  - Comparar un user: COUNT(test_questions hoy, día Madrid) vs su fila en\n` +
        `    user_daily_stats (day = hoy Madrid).\n` +
        `  - Revisar deploys recientes del outbox-processor / user-daily-stats.handler.`,
      metadata: {
        divergent: n,
        windowMin: '5-20',
        table: 'user_daily_stats',
      },
      fingerprint: 'user_daily_stats_paridad_divergence',
    };
  },
  cooldownMin: 30,
};

/**
 * Integridad de exámenes — disparada por el cron check-exam-integrity
 * (/api/cron/check-exam-integrity, 04:30 UTC diario). Emite
 * 'exam_integrity_drift' cuando hay exámenes is_completed (test_type='exam')
 * a los que les faltan >5% de filas en test_questions respecto a
 * total_questions.
 *
 * Origen: caso Rosa (07/06/2026). El examen se marca completado con score/
 * total correctos pero el detalle por-pregunta no se persistió (saves
 * fire-and-forget perdidos bajo carga) → /revisar sale vacío EN SILENCIO.
 * Sin esta regla, solo se ve mirando /admin/salud-sistema activamente; con
 * ella, llega email proactivo — que es el punto, porque la clase de bug es
 * "pérdida silenciosa de datos".
 *
 * severity 'error': pérdida de datos de usuario confirmada y NO recuperable
 * (el detalle por-pregunta no se puede reconstruir), pero no es un outage.
 *
 * Baseline post-deploy del fix (e52b91fa, 08/06): el histórico pre-fix tarda
 * ~24h en salir de la ventana de 24h del cron. Un email el primer día con
 * histórico es esperado; tras eso, cualquier afectado = el bulk-write de
 * /api/exam/validate se rompió. cooldownMin 24h: el cron corre 1×/día, no
 * tiene sentido reenviar el mismo run.
 */
export const RULE_EXAM_INTEGRITY_DRIFT: AlertRule<{
  affected: number;
  empty: number;
  worstMissing: number;
  lastRun: Date;
}> = {
  name: 'exam_integrity_drift',
  severity: 'error',
  query: sql`
    SELECT
      COALESCE((metadata->>'affected')::int, 0) AS affected,
      COALESCE((metadata->>'empty')::int, 0) AS empty,
      COALESCE((metadata->>'worst_missing')::int, 0) AS "worstMissing",
      ts AS "lastRun"
    FROM observable_events
    WHERE event_type = 'exam_integrity_drift'
      AND ts > NOW() - INTERVAL '25 hours'
    ORDER BY ts DESC
    LIMIT 1
  `,
  shouldFire: (rows) => rows.length > 0 && rows[0].affected >= 1,
  buildNotification: (rows) => {
    const r = rows[0];
    return {
      title: `Integridad exámenes: ${r.affected} exámenes con filas perdidas${r.empty > 0 ? ` (${r.empty} vacíos)` : ''}`,
      body:
        `El cron check-exam-integrity detectó ${r.affected} examen(es) is_completed\n` +
        `con filas de test_questions faltantes (>5%). ${r.empty} totalmente vacíos.\n` +
        `Peor caso: faltan ${r.worstMissing} preguntas en un examen.\n\n` +
        `Clase de bug Rosa (07/06): la nota se guarda pero el detalle por-pregunta\n` +
        `NO → /revisar sale vacío. El fix (e52b91fa) hace bulk-write en validate.\n\n` +
        `⚠️ Primer día tras el deploy del 08/06: histórico pre-fix esperado. Tras\n` +
        `24h, cualquier afectado = el bulk-write de /api/exam/validate se rompió.\n\n` +
        `Investigar en /admin/salud-sistema o:\n\n` +
        `  SELECT t.id, t.total_questions, count(tq.id) AS filas\n` +
        `  FROM tests t LEFT JOIN test_questions tq ON tq.test_id=t.id\n` +
        `  WHERE t.test_type='exam' AND t.is_completed\n` +
        `    AND t.completed_at >= NOW()-INTERVAL '24 hours' AND t.total_questions>0\n` +
        `  GROUP BY t.id HAVING count(tq.id) < t.total_questions*0.95\n` +
        `  ORDER BY (t.total_questions-count(tq.id)) DESC;`,
      metadata: {
        affected: r.affected,
        empty: r.empty,
        worstMissing: r.worstMissing,
        lastRun: r.lastRun,
      },
      fingerprint: 'exam_integrity_drift',
    };
  },
  cooldownMin: 1440,
};

/**
 * Spike de errores JS de CLIENTE (2026-07-05, tras retirar Sentry → captura
 * in-house en lib/observability/client.ts). Antes estos errores iban a Sentry;
 * ahora `unhandled_error` / `unhandled_rejection` / `react_error_boundary` /
 * `client_error` (source='frontend') caen en observable_events. Un spike por
 * ruta+deploy suele ser una regresión del último deploy (componente que revienta
 * en cliente). El 5xx de cliente ya lo cubre RULE_HTTP_5XX_SPIKE.
 */
export const RULE_CLIENT_ERROR_SPIKE: AlertRule<{
  endpoint: string | null;
  deployVersion: string | null;
  n: number;
}> = {
  name: 'client_error_spike',
  severity: 'error',
  query: sql`
    SELECT endpoint,
           deploy_version AS "deployVersion",
           COUNT(*)::int AS n
    FROM observable_events
    WHERE source = 'frontend'
      AND event_type IN ('unhandled_error', 'unhandled_rejection', 'react_error_boundary', 'client_error')
      AND ts > NOW() - INTERVAL '15 minutes'
    GROUP BY endpoint, deploy_version
    HAVING COUNT(*) >= 10
  `,
  shouldFire: (rows) => rows.length > 0,
  buildNotification: (rows) => {
    const lines = rows.map(
      (r) =>
        `  - ${r.endpoint ?? '(unknown)'} [${r.deployVersion ?? '?'}]: ${r.n} errores`,
    );
    return {
      title: `${rows.length} ruta(s) con spike de errores JS de cliente`,
      body: `Errores de cliente no capturados (excepción JS / promesa rechazada / error boundary) en 15 min:\n\n${lines.join('\n')}\n\nInvestigar:\n  SELECT event_type, error_message, COUNT(*) FROM observable_events\n  WHERE source='frontend' AND event_type IN ('unhandled_error','unhandled_rejection','react_error_boundary','client_error')\n    AND ts > NOW() - INTERVAL '15 minutes'\n  GROUP BY 1,2 ORDER BY 3 DESC;\n\nSuele ser una regresión del último deploy en la ruta afectada.`,
      metadata: { routesAffected: rows.length },
      fingerprint: `client_error_spike_${rows[0]?.deployVersion ?? 'unknown'}`,
    };
  },
  cooldownMin: 30,
};

/**
 * Spike de 4xx INESPERADOS de cliente (2026-07-05). `http_4xx` excluye ya los
 * esperados (401/403/404/409/429) en el wrapper de fetch, así que un pico
 * indica al cliente mandando peticiones mal formadas (400/422) — normalmente
 * un bug de front. Ruidoso por naturaleza → umbral alto y severity warn.
 */
export const RULE_CLIENT_HTTP_4XX_SPIKE: AlertRule<{
  endpoint: string | null;
  n: number;
}> = {
  name: 'client_http_4xx_spike',
  severity: 'warn',
  query: sql`
    SELECT endpoint, COUNT(*)::int AS n
    FROM observable_events
    WHERE source = 'frontend'
      AND event_type = 'http_4xx'
      AND ts > NOW() - INTERVAL '15 minutes'
    GROUP BY endpoint
    HAVING COUNT(*) >= 30
  `,
  shouldFire: (rows) => rows.length > 0,
  buildNotification: (rows) => {
    const lines = rows.map(
      (r) => `  - ${r.endpoint ?? '(unknown)'}: ${r.n} respuestas 4xx`,
    );
    return {
      title: `${rows.length} endpoint(s) con spike de 4xx inesperados de cliente`,
      body: `El cliente recibe 4xx inesperados (400/422…, ya excluidos 401/403/404/409/429) en 15 min:\n\n${lines.join('\n')}\n\nSuele ser el front mandando payloads/params mal formados. Investigar el fetcher del endpoint.`,
      metadata: { endpointsAffected: rows.length },
      fingerprint: `client_http_4xx_spike_${rows[0]?.endpoint ?? 'unknown'}`,
    };
  },
  cooldownMin: 60,
};

/**
 * NADIE SINCRONIZA TRAS PAGAR — la activación inmediata está muerta (2026-07-30).
 *
 * Al volver de Stripe, `/premium/success` llama a `/api/stripe/checkout-sync` para activar el
 * premium **en el acto**. Si esa llamada deja de producirse, el premium se sigue activando
 * por el webhook (nadie pierde dinero) pero la persona ve *«Hemos tenido un problema
 * técnico»* justo después de pagar, y eso es lo último que se lleva de la compra.
 *
 * Es una avería de las que no rompen nada medible: sin 5xx, sin errores, sin latencia. El
 * síntoma es una AUSENCIA — el endpoint deja de llamarse — y por eso hay que vigilarla al
 * revés que las demás: comparando **pagos** contra **sincronizaciones**.
 *
 * Caso real: la pantalla pedía el token a Supabase cuando las sesiones ya las emitía Auth.js
 * desde el 03/07. Salía por `no_token` sin llegar a llamar. **Cero llamadas en 30 días**, y
 * se descubrió porque una usuaria escribió «ya lo he pagado pero no se termina de activar».
 *
 * Umbral: hubo pagos en la última hora y NINGUNO sincronizó. Con un solo pago basta para
 * sospechar; el ruido es nulo porque la ventana solo cuenta si hubo pagos de verdad.
 */
export const RULE_CHECKOUT_SYNC_MUDO: AlertRule<{
  pagos: number;
  sincronizaciones: number;
}> = {
  name: 'checkout_sync_mudo',
  severity: 'critical',
  query: sql`
    SELECT
      (SELECT COUNT(*)::int FROM observable_events
        WHERE event_type = 'conversion' AND endpoint = '/api/stripe/webhook'
          AND ts > NOW() - INTERVAL '60 minutes') AS pagos,
      (SELECT COUNT(*)::int FROM observable_events
        WHERE endpoint = '/api/stripe/checkout-sync'
          AND ts > NOW() - INTERVAL '60 minutes') AS sincronizaciones
  `,
  shouldFire: (rows) => (rows[0]?.pagos ?? 0) > 0 && (rows[0]?.sincronizaciones ?? 0) === 0,
  buildNotification: (rows) => {
    const p = rows[0]?.pagos ?? 0;
    return {
      title: `${p} pago(s) en la última hora y NINGUNA activación inmediata`,
      body: `Quien acaba de pagar está viendo «Hemos tenido un problema técnico» en /premium/success en vez de su Premium activo. El webhook lo activa igual (no se pierde dinero), pero el último paso de la compra es un mensaje de error.\n\nQué mirar:\n\n  - ¿Llega la llamada?  SELECT ts, http_status, error_message FROM observable_events\n      WHERE endpoint='/api/stripe/checkout-sync' ORDER BY ts DESC LIMIT 20;\n  - ¿Falla por token?   Buscar 'no_token' con metadata->>'pagina'='/premium/success'.\n  - Causa del 30/07: la pantalla pedía el token a Supabase (proveedor legacy) en vez de al\n    puerto (getAuthHeaders). Cero llamadas durante 30 días sin una sola señal.\n\nEs una avería SIN 5xx: el síntoma es la ausencia de llamadas, no un error.`,
      metadata: { pagos: p, sincronizaciones: rows[0]?.sincronizaciones ?? 0, windowMin: 60 },
      fingerprint: 'checkout_sync_mudo',
    };
  },
  cooldownMin: 180,
};

/**
 * MÉTODO NO PERMITIDO (405) — el cliente y el servidor no se entienden (2026-07-30).
 *
 * Un 405 no es "un usuario haciendo algo raro": significa que NUESTRO propio JavaScript
 * está llamando a NUESTRO propio endpoint con un método que no existe. Siempre es un bug
 * de contrato, y siempre deja una función entera inservible para todo el que pase por ahí.
 *
 * Origen: la página de precio de fidelidad llamaba con POST a un endpoint GET (las opciones
 * de `apiFetch` iban en la posición del cuerpo, así que se aplicaba el método por defecto).
 * Una usuaria estuvo TRES DÍAS sin poder pagar, con la página diciéndole «no tienes precio
 * activo». Los 405 quedaron registrados desde el primer intento y nadie los miró: la regla
 * de 4xx de cliente exige 30 en 15 minutos por endpoint, y aquí fueron 7 en dos días.
 *
 * Por eso el umbral es 1. Medido antes de escribirla: en 14 días de producción hubo
 * EXACTAMENTE 7 respuestas 405 en toda la plataforma, y las 7 eran este fallo. Una señal
 * sin ruido de fondo no necesita un umbral que la esconda.
 */
export const RULE_CLIENT_METHOD_NOT_ALLOWED: AlertRule<{
  endpoint: string | null;
  metodo: string | null;
  n: number;
}> = {
  name: 'client_method_not_allowed',
  severity: 'critical',
  query: sql`
    SELECT endpoint,
           MODE() WITHIN GROUP (ORDER BY metadata->>'method') AS metodo,
           COUNT(*)::int AS n
    FROM observable_events
    WHERE source = 'frontend'
      AND event_type = 'http_4xx'
      AND metadata->>'status' IN ('405', '501')
      AND ts > NOW() - INTERVAL '30 minutes'
    GROUP BY endpoint
  `,
  shouldFire: (rows) => rows.length > 0,
  buildNotification: (rows) => {
    const lineas = rows.map(
      (r) =>
        `  - ${r.endpoint ?? '(desconocido)'}: ${r.n} llamada(s) con ${r.metodo ?? 'método desconocido'}`,
    );
    return {
      title: `Cliente llamando con un método que el endpoint no acepta (405)`,
      body: `Nuestro propio front está llamando a nuestro propio endpoint con un método inexistente, así que esa función NO funciona para nadie que pase por ahí:\n\n${lineas.join('\n')}\n\nQué mirar:\n\n  - El fetcher de ese endpoint. Ojo con \`apiFetch(url, body, options)\`: si las opciones se escriben en la posición del cuerpo, \`options\` queda undefined y sale POST por defecto (causa del incidente del 30/07).\n  - SELECT ts, endpoint, metadata FROM observable_events\n      WHERE event_type='http_4xx' AND metadata->>'status'='405'\n        AND ts > NOW() - INTERVAL '2 hours' ORDER BY ts DESC;\n\nContexto: esto tuvo a una usuaria tres días sin poder pagar, viendo «no tienes precio activo». En 14 días de producción no hubo ningún otro 405, así que esta alerta no debería sonar salvo que algo esté realmente roto.`,
      metadata: { endpointsAffected: rows.length, total: rows.reduce((s, r) => s + r.n, 0) },
      fingerprint: `client_method_not_allowed_${rows[0]?.endpoint ?? 'unknown'}`,
    };
  },
  cooldownMin: 120,
};

/**
 * GUARDADO DE RESPUESTAS ROTO (reconciliación) — 2026-07-05. El hueco C1 (07-04):
 * el cliente respondía pero los tests NO se creaban (PostgREST roto tras el flip)
 * → 168 respondidas / 0 guardadas, INVISIBLE para el canary answer-save (que pega
 * al endpoint de servidor sano, no al camino del cliente). Este detector compara
 * respuestas de CLIENTE (`test_answer_selected`) vs GUARDADAS (`test_questions`):
 * si hay volumen y <50% se guarda, el pipeline de guardado está roto. Cazaría el
 * C1 de inmediato. Ver memoria project_hueco_c1_perdida_tests_recuperacion.
 */
export const RULE_SAVE_RECONCILIATION: AlertRule<{
  answered: number;
  saved: number;
}> = {
  name: 'save_reconciliation',
  severity: 'critical',
  // Recalibrado 13/07 (anti falso-positivo): era ventana 15 min + ratio <50%.
  // En operación normal `saved` sigue a `answered` y a veces lo SUPERA (examen en
  // batch, eventos duplicados) — el ratio hora a hora observado es 70-100%. En
  // ventanas cortas de 15 min bajaba de 50% por lag de la cola async / 403 de
  // límite de dispositivo (respondida pero no guardada = esperado) / horas
  // nocturnas de poco tráfico → CRITICAL falsos que inundaban la bandeja. La
  // ventana de 60 min promedia ese ruido; el hueco C1 (0 guardadas = 0%) sigue
  // disparando de sobra con el umbral <25%.
  query: sql`
    SELECT
      (SELECT COUNT(*)::int FROM user_interactions WHERE event_type='test_answer_selected' AND created_at > NOW() - INTERVAL '60 minutes') AS answered,
      (SELECT COUNT(*)::int FROM test_questions WHERE created_at > NOW() - INTERVAL '60 minutes') AS saved
  `,
  shouldFire: (rows) => {
    const a = rows[0]?.answered ?? 0;
    const s = rows[0]?.saved ?? 0;
    return a > 60 && s < a * 0.25;
  },
  buildNotification: (rows) => {
    const a = rows[0]?.answered ?? 0;
    const s = rows[0]?.saved ?? 0;
    const pct = a > 0 ? Math.round((s / a) * 100) : 0;
    return {
      title: `⚠️ Las respuestas NO se guardan — ${a} respondidas, solo ${s} guardadas en 60 min (${pct}%)`,
      body: `Pipeline de guardado ROTO: en 60 min hubo ${a} eventos test_answer_selected (cliente responde) pero solo ${s} filas llegaron a test_questions (${pct}%). En operación normal ese ratio es 70-100%; un ${pct}% sostenido durante 1h es la clase de bug del hueco C1 (07-04, tests no creados) — NO ruido de ventana corta. Investigar creación de tests (client → /api/v2/tests) y /api/v2/answer-and-save. Verificar que el cliente NO usa supabase.from directo. Memoria: project_hueco_c1_perdida_tests_recuperacion.`,
      metadata: { answered: a, saved: s, windowMin: 60 },
      fingerprint: 'save_reconciliation',
    };
  },
  cooldownMin: 30,
};

/**
 * ERRORES DE CLIENTE SOSTENIDOS (edge) — 2026-07-05, RECALIBRADO 2026-07-08.
 *
 * El 502 keep-alive era ~3/5min CONTINUO → por debajo del umbral de spike
 * (>20/5min) de RULE_HTTP_5XX_SPIKE → NO alertaba. Esta mira volumen SOSTENIDO
 * a 1h de errores de EDGE de cliente (que el servidor no registra).
 *
 * RECALIBRACIÓN 08/07: la versión original sumaba `http_5xx + http_network_error
 * + http_timeout` con un único umbral de 80/h. Problema: `http_network_error`
 * tiene un baseline BENIGNO alto (~100-120/h) de móviles que cierran pestaña o
 * pasan a background — el fetch en vuelo revienta con "Failed to fetch" (no es
 * AbortError). Ese ruido cruzaba solo el umbral de 80 y disparaba la alerta
 * CADA HORA (cooldown 60m), ahogando el signal real y llenando la bandeja de
 * Manuel (alert-fatigue, runbook §1.bis). El 502 accionable (~8/h residual)
 * quedaba enterrado.
 *
 * Diseño nuevo — separar el signal accionable del ruido de conectividad:
 *   - edge5xx (http_5xx + http_timeout): respuestas de EDGE con status ≥500 /
 *     timeout. Es el signal ACCIONABLE (keep-alive 502, saturación). Umbral
 *     bajo (30/h) — el incidente keep-alive era ~36/h; el residual post-fix ~8/h
 *     no dispara.
 *   - netErr (http_network_error): conectividad de cliente, ruidoso. Solo
 *     dispara ante una AVALANCHA (500/h) muy por encima del baseline benigno =
 *     outage real de red/edge (ALB caído → todo revienta). (La raíz del ruido
 *     se ataca además en el cliente: lib/observability/client.ts suprime el
 *     network_error durante unload/background.)
 */
export const RULE_CLIENT_EDGE_SUSTAINED: AlertRule<{
  edge5xx: number;
  netErr: number;
  topEndpoint: string | null;
}> = {
  name: 'client_edge_sustained',
  severity: 'error',
  query: sql`
    SELECT
      COUNT(*) FILTER (WHERE event_type IN ('http_5xx', 'http_timeout'))::int AS "edge5xx",
      COUNT(*) FILTER (WHERE event_type = 'http_network_error')::int AS "netErr",
      MODE() WITHIN GROUP (ORDER BY endpoint) AS "topEndpoint"
    FROM observable_events
    WHERE source='frontend' AND event_type IN ('http_5xx', 'http_network_error', 'http_timeout')
      AND ts > NOW() - INTERVAL '1 hour'
  `,
  shouldFire: (rows) =>
    (rows[0]?.edge5xx ?? 0) >= 30 || (rows[0]?.netErr ?? 0) >= 500,
  buildNotification: (rows) => {
    const edge5xx = rows[0]?.edge5xx ?? 0;
    const netErr = rows[0]?.netErr ?? 0;
    const top = rows[0]?.topEndpoint ?? '(varios)';
    const byEdge = edge5xx >= 30;
    const n = byEdge ? edge5xx : netErr;
    const kind = byEdge ? 'edge 5xx/timeout' : 'errores de red';
    return {
      title: `Errores de cliente sostenidos — ${n}/h (${kind}) en ${top}`,
      body: byEdge
        ? `El cliente ve respuestas de EDGE 5xx/timeout SOSTENIDAS (${edge5xx} en 1h) que el servidor NO registra. Si es 502 en /api/auth/* → el 502 keep-alive (runbook §502): verificar keepAliveTimeout=65s en los contenedores. Breakdown en /admin/infraestructura → "Errores de cliente".`
        : `AVALANCHA de errores de red de cliente (${netErr} en 1h, muy por encima del baseline benigno ~100/h) — probable outage de red/edge (ALB/CloudFront). Verificar salud del ALB y de los contenedores. Breakdown en /admin/infraestructura → "Errores de cliente".`,
      metadata: {
        edge5xx,
        netErr,
        topEndpoint: top,
        windowMin: 60,
        trigger: byEdge ? 'edge5xx' : 'netErr',
      },
      fingerprint: `client_edge_sustained_${byEdge ? 'edge' : 'net'}_${top}`,
    };
  },
  cooldownMin: 60,
};

/**
 * Guardarraíl anti-flood del log de errores (meta-observabilidad).
 *
 * Caza la CLASE de problema que tumbó el panel admin el 11/07/2026: un único
 * (endpoint, error_type) escribiéndose en `validation_error_logs` a un ritmo
 * absurdo (el 401 anónimo de `/api/auth/token` iba a ~14k/hora → 2,3 M filas /
 * ~1 GB → su GROUP BY tardaba 112 s → 500). La causa concreta se arregló en
 * origen (`withErrorLogging` ya no loguea el 401 anónimo) + retención diaria,
 * pero esto cierra el bucle: si MAÑANA otro endpoint empieza a inundar el log
 * (benigno mal-clasificado o error real en masa), se detecta en la hora, no
 * cuando un humano nota el inbox lleno. Un solo bucket a ≥5000/hora (=120k/día)
 * es inequívocamente anómalo; el ruido normal de 4xx/5xx por bucket son cientos.
 */
export const RULE_VALIDATION_LOG_FLOOD: AlertRule<{
  endpoint: string | null;
  errorType: string | null;
  n: number;
}> = {
  name: 'validation_log_flood',
  severity: 'warn',
  query: sql`
    SELECT endpoint,
           error_type AS "errorType",
           COUNT(*)::int AS n
    FROM validation_error_logs
    WHERE created_at > NOW() - INTERVAL '1 hour'
    GROUP BY endpoint, error_type
    HAVING COUNT(*) >= 5000
    ORDER BY COUNT(*) DESC
  `,
  shouldFire: (rows) => rows.length > 0,
  buildNotification: (rows) => {
    const lines = rows
      .slice(0, 10)
      .map(
        (r) =>
          `  - ${r.n}/h  ${r.endpoint ?? '(unknown)'} / ${r.errorType ?? '?'}`,
      );
    return {
      title: `${rows.length} bucket(s) inundando validation_error_logs (≥5000/h)`,
      body: `Un (endpoint, error_type) se está escribiendo en el log de errores a un ritmo anómalo (≥5000/hora). Esto infla la tabla y ahoga las alertas reales — la clase de fallo que tumbó el panel admin el 11/07:\n\n${lines.join('\n')}\n\nInvestigar:\n  - ¿Es un 4xx BENIGNO mal-clasificado como error? → marcarlo esperado en withErrorLogging (como el 401 anónimo).\n  - ¿Es un error REAL en masa (endpoint roto, 500 storm)? → arreglar el endpoint.\n  - Query: SELECT error_message, http_status, COUNT(*) FROM validation_error_logs WHERE endpoint='…' AND created_at>NOW()-INTERVAL '1 hour' GROUP BY 1,2 ORDER BY 3 DESC;`,
      metadata: {
        bucketsAffected: rows.length,
        topBucket: rows[0]
          ? `${rows[0].endpoint} / ${rows[0].errorType}`
          : null,
        topRate: rows[0]?.n ?? 0,
      },
    };
  },
  cooldownMin: 180,
};

/**
 * RETIRADA 21/07/2026 — RULE_AUTH_MINT_DROP (antes 'auth_mint_drop', crítica).
 *
 * Qué hacía: comparaba el volumen de mint OK de /api/auth/token (request_completed 200,
 * sampleado 10%) de la última hora contra la MISMA hora hace 7 días; disparaba si el
 * baseline era ≥500 sampled y ahora caía <20%. Se creó el 11/07 como señal POSITIVA de
 * auth (porque el 401 de ese endpoint es contrato y está silenciado) para no quedar
 * ciegos ante "sesiones válidas reciben 401, nadie mintea".
 *
 * Por qué se retira: su premisa (volumen de mint alto y estable, ~5k reales/h) MURIÓ con
 * el fix de caché del token (authjsAdapter, ~15-16/07): el cliente dejó de re-acuñar en
 * cada poll → el mint OK cayó ~40× (de ~94k/día a ~2k/día). Consecuencias:
 *   1. Falso positivo de TRANSICIÓN: durante la semana en que el baseline (7d atrás) aún
 *      era pre-fix, la regla disparó CRÍTICO cada 30 min toda la noche del 20-21/07
 *      ("Minteo de tokens caído: 185/h, era 3740/h, 5%") con la auth perfectamente sana
 *      (canary_auth verde, 53 usuarios autenticados guardando). Puro artefacto de baseline.
 *   2. Y DESPUÉS de la transición se vuelve inútil: con el volumen post-fix (~pico <100
 *      sampled/h) el guardarraíl `base >= 500` nunca se cumple → la regla no vuelve a
 *      disparar jamás. Quedaría como código muerto simulando cobertura.
 *
 * Sucesor (cobertura REAL e independiente del régimen de volumen): RULE_CANARY_AUTH_FAILED
 * — el canary sintético hace login → GET /api/profile con cuenta premium cada 5 min y
 * verifica end-to-end que una sesión válida SÍ se autentica. Detecta directamente el fallo
 * que auth_mint_drop solo aproximaba por volumen, sin depender de cuánto mintee el tráfico
 * real. El flood de re-acuñación (el bug opuesto) lo sigue cazando RULE_AUTH_TOKEN_MINT_FLOOD.
 */

/**
 * Pico de rechazos de validación en /api/questions/filtered (incidente Alfonso,
 * 11/07/2026). Un schema demasiado estricto (positionType z.enum) devolvía 400 a
 * 726 usuarios y NADIE lo veía: el 400 se persistía como "Parámetros inválidos"
 * pelado. Ahora el endpoint emite `filtered_questions_validation_rejected` con el
 * campo que falló; esta regla convierte un pico SISTÉMICO en aviso en <1h. Un
 * usuario reintentando no llega a 30/h; 30+/h = un contrato roto que afecta a
 * muchos (regresión de schema, cliente que manda un campo nuevo mal, etc.).
 */
export const RULE_FILTERED_VALIDATION_REJECTED_SPIKE: AlertRule<{
  n: number;
  topReason: string | null;
}> = {
  name: 'filtered_validation_rejected_spike',
  severity: 'warn',
  query: sql`
    SELECT COUNT(*)::int AS n,
           MODE() WITHIN GROUP (ORDER BY error_message) AS "topReason"
    FROM observable_events
    WHERE event_type = 'filtered_questions_validation_rejected'
      AND ts > NOW() - INTERVAL '60 minutes'
  `,
  shouldFire: (rows) => (rows[0]?.n ?? 0) > 30,
  buildNotification: (rows) => {
    const n = rows[0]?.n ?? 0;
    const reason = rows[0]?.topReason ?? '(varios)';
    return {
      title: `Tests bloqueados por validación — ${n} rechazos en 1h`,
      body: `Muchos usuarios NO pueden crear tests en /api/questions/filtered (400 de schema).\nCampo/causa más frecuente: ${reason}\n\nProbable contrato de schema roto (regresión o campo nuevo mal). Investigar:\n\n  SELECT metadata->>'positionType' pt, metadata->'fields' fields, COUNT(*)\n  FROM observable_events\n  WHERE event_type='filtered_questions_validation_rejected'\n    AND ts > NOW() - INTERVAL '60 minutes'\n  GROUP BY 1,2 ORDER BY COUNT(*) DESC;`,
      metadata: { count: n, topReason: reason, windowMin: 60 },
      fingerprint: `filtered_validation_rejected`,
    };
  },
  cooldownMin: 60,
};

/**
 * Flood de re-acuñación de token (bug de caché del poll del cliente). El adapter Auth.js
 * sondea la sesión cada 5s; si re-acuña el RS256 en CADA tick (en vez de cachearlo su
 * hora de TTL) genera cientos de miles de req/día a /api/auth/token — el bug del
 * 04-15/07 que desloguea premium (caso Natalia). `auth_token_minted` está muestreado al
 * 10% (commit 3b5c1c5c): un usuario normal CON la caché mintea ~1-2/hora reales → ~0
 * muestreados/10min; el flood da >5 muestreados/usuario/10min. Guardarraíl RUNTIME que lo
 * caza (además del test de regresión en __tests__/lib/auth/authjsAdapter.test.ts).
 *
 * Lección (por qué no se detectó antes sin que escribiera el usuario): la observabilidad
 * SÍ lo veía (93% del firehose eran estos tokens), pero se interpretó como "reducir
 * telemetría" (muestrear) en vez de "bug del cliente". Esta regla convierte esa señal en
 * alerta: un endpoint que domina la telemetría con ratio anómalo por usuario ES un bug.
 */
export const RULE_AUTH_TOKEN_MINT_FLOOD: AlertRule<{
  minted: number;
  users: number;
  perUser: number;
}> = {
  name: 'auth_token_mint_flood',
  severity: 'warn',
  query: sql`
    SELECT COUNT(*)::int AS minted,
           COUNT(DISTINCT user_id)::int AS users,
           ROUND(COUNT(*)::numeric / GREATEST(COUNT(DISTINCT user_id), 1), 1)::float AS "perUser"
    FROM observable_events
    WHERE event_type = 'auth_token_minted'
      AND ts > NOW() - INTERVAL '10 minutes'
  `,
  // ≥20 usuarios para que la media sea fiable; >5 tokens muestreados/usuario/10min
  // (≈ >50 reales) = el cliente re-acuña sin cachear → flood → deslogueos.
  shouldFire: (rows) =>
    (rows[0]?.users ?? 0) >= 20 && (rows[0]?.perUser ?? 0) > 5,
  buildNotification: (rows) => {
    const minted = rows[0]?.minted ?? 0;
    const users = rows[0]?.users ?? 0;
    const perUser = rows[0]?.perUser ?? 0;
    return {
      title: `Flood de acuñación de token — ${perUser} tokens/usuario en 10 min (muestreado 10%)`,
      body: `El cliente re-acuña el RS256 sin cachearlo (el poll martillea /api/auth/token). ${minted} mints muestreados de ${users} usuarios en 10 min ≈ ${Math.round(perUser * 10)} reales/usuario. Genera 401 intermitentes que deslogean (el bug del 04-15/07, caso Natalia).\n\nRevisar la caché del token en lib/auth/adapters/authjsAdapter.ts y su test __tests__/lib/auth/authjsAdapter.test.ts.`,
      metadata: {
        mintedSampled: minted,
        users,
        perUserSampled: perUser,
        windowMin: 10,
      },
      fingerprint: 'auth_token_mint_flood',
    };
  },
  cooldownMin: 60,
};

/**
 * DESPERDICIO de acuñación de token — el hermano FINO Y ANCHO de la regla de arriba (T-210,
 * 28/07/2026).
 *
 * `auth_token_mint_flood` caza el flood CATASTRÓFICO por usuario (el poll de 5s del
 * 04-15/07: >50 acuñaciones reales por usuario y 10 min). Es ciego a un régimen distinto:
 * pocas acuñaciones por usuario y minuto, pero repartidas entre CIENTOS de usuarios, todo
 * el día. Medido el 28/07 antes del arreglo: **45 acuñaciones reales por usuario y HORA**
 * (mediana de 7 días; rango 29-136) de un token cuyo TTL es 1 h. El umbral de la otra
 * regla (>5 muestreados/usuario/10 min ≈ 300 reales/hora) exigía que fuese ~7× peor →
 * nunca disparó, y por eso «nadie lo estaba mirando».
 *
 * Causa que lo produjo: 9 copias del patrón «`refreshSession()` y si no `getSession()`»
 * repartidas por la app (authHeaders, cinco clientes de /api/v2, answerSaveQueue,
 * psychometricSaveQueue, testAnswers). `refreshSession()` FUERZA la re-acuñación, así que
 * cada copia se saltaba la caché del adapter. Convergieron en `auth.getAccessToken()`;
 * el guardarraíl estático es `__tests__/guardrails/bearerTokenSinglePath.test.ts`, pero
 * eso solo impide reintroducir el PATRÓN — el régimen de tráfico lo vigila esta regla.
 *
 * Calibración (simulación sobre 7 días de datos reales, no a ojo): con TTL de 1 h el ideal
 * es ~1 acuñación por usuario y hora, y el suelo teórico medido eran 2.001/día frente a
 * 58.680 reales (29× de desperdicio). Umbral en **8 reales por usuario y hora**: deja 4-8×
 * de margen sobre el régimen sano y queda 3,7× por debajo del PEOR régimen bueno observado
 * (min 29,4), así que no puede confundirse con tráfico normal. `warn`, no `critical`: es
 * derroche y riesgo de 401 intermitentes, no una caída.
 *
 * ⚠️ Nota de transición: hasta que el arreglo esté DESPLEGADO esta regla dispara — y hace
 * bien, el defecto está vivo. Su silencio posterior es la verificación de que el arreglo
 * funcionó (lo contrario del falso positivo de baseline que retiró `auth_mint_drop`: esta
 * no compara contra el pasado, mide el ratio absoluto).
 */
export const RULE_AUTH_TOKEN_MINT_WASTE: AlertRule<{
  mintedSampled: number;
  users: number;
  perUserHour: number;
}> = {
  name: 'auth_token_mint_waste',
  severity: 'warn',
  // Solo `via=authjs_session`, que es el muestreado al 10% (el `bridge` se emite SIEMPRE:
  // mezclarlos inflaría el ratio y la alerta mentiría durante el drenaje del bridge).
  query: sql`
    SELECT COUNT(*)::int AS "mintedSampled",
           COUNT(DISTINCT user_id)::int AS users,
           ROUND((COUNT(*) * 10.0) / GREATEST(COUNT(DISTINCT user_id), 1), 1)::float AS "perUserHour"
    FROM observable_events
    WHERE event_type = 'auth_token_minted'
      AND metadata->>'via' = 'authjs_session'
      AND ts > NOW() - INTERVAL '60 minutes'
  `,
  // ≥20 usuarios para que la media signifique algo (mismo criterio que la regla hermana).
  shouldFire: (rows) =>
    (rows[0]?.users ?? 0) >= 20 && (rows[0]?.perUserHour ?? 0) > 8,
  buildNotification: (rows) => {
    const mintedSampled = rows[0]?.mintedSampled ?? 0;
    const users = rows[0]?.users ?? 0;
    const perUserHour = rows[0]?.perUserHour ?? 0;
    return {
      title: `Desperdicio de acuñación de token — ${perUserHour} tokens/usuario/hora (TTL 1h, ideal ~1)`,
      body: `Se está re-acuñando el RS256 muchas más veces de lo que dura. ${mintedSampled} mints muestreados (10%) de ${users} usuarios en 1 h ≈ ${Math.round(perUserHour * users)} reales.\n\nEMPIEZA POR EL MOTIVO, no por la hipótesis (28/07: la conjetura mejor fundada la refutaron los datos):\n\n  SELECT metadata->>'reason' motivo, count(*)*10 reales, count(DISTINCT user_id) usuarios\n  FROM observable_events\n  WHERE event_type='auth_token_minted' AND metadata->>'via'='authjs_session'\n    AND ts > NOW() - INTERVAL '2 hours'\n  GROUP BY 1 ORDER BY 2 DESC;\n\n  · forzado       → alguien volvió a pedir el Bearer con auth.refreshSession() en vez de\n                    auth.getAccessToken() (el patrón de las 9 copias de T-210):\n                    git grep -n "refreshSession()" -- lib utils app components hooks contexts\n  · cache_miss    → algo está TIRANDO la caché del adapter (resetCache / 401 / logout).\n  · carga_inicial → es el SUELO del sistema: la caché vive en memoria y muere en cada carga\n                    de página y cada pestaña. Bajarlo exige persistir el token (otra decisión).\n\nVer lib/auth/mintReason.ts, lib/auth/tokenFreshness.ts y __tests__/guardrails/bearerTokenSinglePath.test.ts.`,
      metadata: { mintedSampled, users, perUserHour, windowMin: 60 },
      fingerprint: 'auth_token_mint_waste',
    };
  },
  cooldownMin: 180,
};

// ── Reglas de fallo de canary (fábrica) ─────────────────────────────────────
// Estos canaries emitían `canary_<x>_failed` SIN regla → un fallo suyo pasaba
// desapercibido (hueco de observabilidad cerrado 20/07, canary-framework.md P3).
// El eventType se pasa LITERAL a propósito: así aparece como string en el fuente y
// el guardarraíl canary-registry.spec (que grepea alert-rules.ts) lo detecta.
function canaryFailedRule(
  eventType: string,
  opts: { title: string; body: string; windowMin: number; cooldownMin: number },
): AlertRule<{ n: number; lastStep: string | null; lastError: string | null }> {
  return {
    name: eventType,
    severity: 'critical',
    query: sql`
      SELECT COUNT(*)::int AS n,
             (ARRAY_AGG(metadata->>'step' ORDER BY created_at DESC))[1] AS "lastStep",
             (ARRAY_AGG(error_message ORDER BY created_at DESC))[1] AS "lastError"
      FROM observable_events
      WHERE event_type = ${eventType}
        AND created_at > NOW() - make_interval(mins => ${opts.windowMin})
    `,
    // Mismo criterio que el resto de canaries: tolera 1 blip transitorio (timeout/
    // abort), dispara a ≥2 sostenidos o ante un error sustantivo (no-timeout).
    shouldFire: (rows) => canaryFailureShouldFire(rows),
    buildNotification: (rows) => {
      const r = rows[0];
      return {
        title: `${opts.title} (${r.n} en ${opts.windowMin} min)`,
        body: `${opts.body}\n\nÚltimo fallo:\n  - step: ${r.lastStep ?? '(n/a)'}\n  - error: ${r.lastError ?? '(n/a)'}`,
        metadata: {
          count: r.n,
          lastStep: r.lastStep,
          lastError: r.lastError,
          windowMin: opts.windowMin,
        },
        fingerprint: eventType,
      };
    },
    cooldownMin: opts.cooldownMin,
  };
}

export const RULE_CANARY_AI_MODEL_FAILED = canaryFailedRule(
  'canary_ai_model_failed',
  {
    title: '🚨 Canary AI-model: un proveedor LLM activo NO responde',
    body: 'El ping al proveedor LLM configurado (ai_api_config activo) falló de forma sostenida → el chat IA / generación puede estar caído. Revisar credenciales del proveedor + su status page.',
    windowMin: 20,
    cooldownMin: 20,
  },
);

export const RULE_CANARY_ANSWER_PREMIUM_FAILED = canaryFailedRule(
  'canary_answer_premium_failed',
  {
    title: '🚨 Canary answer-premium: el canary de límites premium falló',
    body: 'El canary que verifica que un usuario premium NO topa con el límite diario (y que los endpoints de respuesta se comportan) falló. Riesgo: regresión de gating premium. Revisar /api/daily-limit + los endpoints de answer.',
    windowMin: 10,
    cooldownMin: 10,
  },
);

export const RULE_CANARY_COMPETITOR_MENTION_FAILED = canaryFailedRule(
  'canary_competitor_mention_failed',
  {
    title: '⚠️ Canary competitor-mention: el chequeo de menciones falló',
    body: 'El canary que cuenta menciones activas a competidores en contenido publicado no pudo ejecutar su query (fallo del propio canary, NO una mención detectada). Revisar la conexión/consulta.',
    windowMin: 90,
    cooldownMin: 60,
  },
);

export const RULE_CANARY_POR_LEYES_SCOPE_FAILED = canaryFailedRule(
  'canary_por_leyes_scope_failed',
  {
    title:
      '🚨 Canary por-leyes-scope: fallo de scope (posible fuga o endpoint roto)',
    body: 'El canary del filtro "por leyes" falló: puede ser una FUGA de scope (scopeToPosition devolviendo artículos de fuera del tema), 0 preguntas donde debería haber, o el endpoint /api/questions/filtered caído. Verificar el paso reportado.',
    windowMin: 10,
    cooldownMin: 10,
  },
);

export const RULE_CANARY_PSYCHOMETRIC_INTEGRITY_FAILED = canaryFailedRule(
  'canary_psychometric_integrity_failed',
  {
    title: '⚠️ Canary psychometric-integrity: el chequeo de integridad falló',
    body: 'El canary que vigila sesiones psicotécnicas fantasma no pudo ejecutar su query (fallo del propio canary, NO fantasmas detectados). Revisar la conexión/consulta.',
    windowMin: 30,
    cooldownMin: 30,
  },
);

/**
 * Spike de `network_retry` EXHAUSTED — el wrapper de fetch resiliente
 * (lib/api/fetchWithChallenge.ts, fix 24/07/2026) reintenta los `Failed to
 * fetch` transitorios; emite `network_retry outcome:'exhausted'` cuando sigue
 * cayendo tras los reintentos (offline sostenido del usuario).
 *
 * En condiciones normales esto es RARO y disperso (algún usuario con mala
 * cobertura). Un SPIKE concentrado NO es red de un usuario: es una regresión
 * NUESTRA que hace fallar los fetch a todos a la vez (CORS roto tras deploy,
 * endpoint caído, edge/DNS). Lo que un usuario reportaría como "no me carga
 * nada / no genera el test" — justo el tipo de bug que la observabilidad debe
 * cazar antes que el primer feedback (caso David Couceiro, 24/07). Warn, no
 * critical: puede ser un incidente de red externo (operadora), no siempre culpa
 * nuestra; el endpoint del `metadata` desambigua (si es UNO solo → es nuestro).
 */
export const RULE_NETWORK_RETRY_EXHAUSTED_SPIKE: AlertRule<{
  n: number;
  topEndpoint: string | null;
}> = {
  name: 'network_retry_exhausted_spike',
  severity: 'warn',
  query: sql`
    SELECT COUNT(*)::int AS n,
           MODE() WITHIN GROUP (ORDER BY endpoint) AS "topEndpoint"
    FROM observable_events
    WHERE event_type = 'network_retry'
      AND metadata->>'outcome' = 'exhausted'
      AND ts > NOW() - INTERVAL '10 minutes'
  `,
  shouldFire: (rows) => (rows[0]?.n ?? 0) > 30,
  buildNotification: (rows) => {
    const n = rows[0]?.n ?? 0;
    const top = rows[0]?.topEndpoint ?? '(varios)';
    return {
      title: `Spike de fetch agotados (network_retry) — ${n} en 10 min`,
      body: `Muchos clientes agotan los reintentos de red sin conectar. Si es UN endpoint (${top}) casi seguro es regresión nuestra (CORS/edge/endpoint caído), no la red del usuario.\n\n  SELECT endpoint, COUNT(*) FROM observable_events\n  WHERE event_type='network_retry' AND metadata->>'outcome'='exhausted'\n    AND ts > NOW() - INTERVAL '10 minutes'\n  GROUP BY endpoint ORDER BY COUNT(*) DESC;`,
      metadata: { count: n, topEndpoint: top, windowMin: 10 },
      fingerprint: `network_retry_exhausted_${top}`,
    };
  },
  cooldownMin: 30,
};

/**
 * Configurador de leyes DEGRADADO — el endpoint /api/laws-configurator (la página
 * "Test combinando leyes") emite `laws_configurator_stats` (con `durationMs`) y
 * `laws_configurator_error`. Antes, la query de stats acotada a oposición (EXISTS
 * correlado + array-ANY sobre todas las preguntas) degeneraba a 30s → statement
 * timeout → 500 → el usuario veía "Error al generar test" (caso David/Galicia
 * 24/07). El fix (CTE + timeout 8s + caché) lo resolvió; esta regla vigila que NO
 * reaparezca: dispara si hay errores o cómputos lentos (>5s) sostenidos en 10 min
 * — señal precoz ANTES de que un usuario tope el timeout y reporte. Warn, no
 * critical: es una página de configuración (no bloquea el estudio) y con caché el
 * usuario suele ver el último valor bueno; pero un repunte = plan lento de vuelta.
 */
export const RULE_LAWS_CONFIGURATOR_DEGRADED: AlertRule<{
  errors: number;
  slow: number;
}> = {
  name: 'laws_configurator_degraded',
  severity: 'warn',
  query: sql`
    SELECT
      COUNT(*) FILTER (WHERE event_type = 'laws_configurator_error')::int AS errors,
      COUNT(*) FILTER (WHERE event_type = 'laws_configurator_stats'
        AND (metadata->>'durationMs')::int > 5000)::int AS slow
    FROM observable_events
    WHERE event_type IN ('laws_configurator_error', 'laws_configurator_stats')
      AND ts > NOW() - INTERVAL '10 minutes'
  `,
  shouldFire: (rows) =>
    (rows[0]?.errors ?? 0) >= 3 || (rows[0]?.slow ?? 0) >= 3,
  buildNotification: (rows) => {
    const errors = rows[0]?.errors ?? 0;
    const slow = rows[0]?.slow ?? 0;
    return {
      title: `Configurador de leyes degradado — ${errors} error(es), ${slow} cómputo(s) >5s en 10 min`,
      body: `La query de /api/laws-configurator (página "Test combinando leyes") vuelve a ir lenta o falla. Es el patrón del bug David/Galicia (query de stats que timeouteaba a 30s → 500).\n\n  SELECT metadata->>'positionType' pt, metadata->>'source' src, avg((metadata->>'durationMs')::int) avg_ms, count(*)\n  FROM observable_events WHERE event_type IN ('laws_configurator_stats','laws_configurator_error')\n    AND ts > NOW() - INTERVAL '30 minutes' GROUP BY 1,2 ORDER BY avg_ms DESC NULLS LAST;`,
      metadata: { errors, slow, windowMin: 10 },
      fingerprint: 'laws_configurator_degraded',
    };
  },
  cooldownMin: 30,
};

/**
 * Cupo del plan gratuito cobrado DE MÁS — usuarios free que llegan al tope diario
 * habiendo respondido bastantes menos preguntas de las que el contador les cobró.
 *
 * Nace del incidente del 29/07/2026 (caso Sergio): el contador lo incrementaba solo
 * el cliente, desacoplado del guardado y sin idempotencia; Sergio respondió 15 y le
 * cobraron 25. Medido entonces sobre 14 días: 41 usuarios free en esa situación.
 * El arreglo movió el cobro al servidor (`debeConsumirCupo`, solo `saved_new`);
 * esta regla vigila que no vuelva a desviarse — por una regresión del cobro, por un
 * camino nuevo que cuente sin guardar, o por respuestas que dejen de persistirse.
 *
 * NO usa `observable_events` (muestreado al 10% en peticiones OK) sino las TABLAS
 * DE NEGOCIO, que están completas: contador (`daily_question_usage`) contra respuestas
 * reales de las tres modalidades (test, psicotécnicos, ortografía).
 *
 * Fecha en `Europe/Madrid` porque así la calcula `increment_daily_questions`; en UTC
 * la comparación produce falsos positivos con las respuestas de última hora.
 */
export const RULE_DAILY_QUOTA_OVERCHARGE: AlertRule<{
  afectados: number;
  respondidasMedia: number;
  desfaseMedio: number;
}> = {
  name: 'daily_quota_overcharge',
  severity: 'warn',
  query: sql`
    WITH topados AS (
      SELECT d.user_id, d.usage_date, d.questions_answered AS contador
      FROM daily_question_usage d
      JOIN user_profiles p ON p.id = d.user_id
      WHERE p.plan_type <> 'premium'
        -- Solo el día CERRADO de ayer, nunca el de hoy (31/07/2026).
        --
        -- Antes miraba >= hoy - 1, o sea también el día en curso, y ahí el dato TODAVÍA SE
        -- ESTÁ ASENTANDO: medido en producción, esta regla disparó 4 veces en 48 h con 12-18
        -- «afectados»… y al volver a medir esos mismos días después salían 0 y 1. Es decir,
        -- mandaba correos por gente que no estaba cobrada de más — y una alerta que grita sin
        -- motivo se acaba ignorando, que es la forma lenta de quedarse sin vigilancia.
        --
        -- El desfase intradía no está explicado del todo (la sospecha es la cola asíncrona de
        -- guardado: el contador va por delante de las filas de test_questions hasta que la
        -- cola drena). Se acota el síntoma midiendo solo días cerrados, que además es lo
        -- correcto para esta regla: detectar la regresión con 24 h de retraso vale, porque no
        -- es un fuego, es un cobro que hay que corregir.
        AND d.usage_date = (NOW() AT TIME ZONE 'Europe/Madrid')::date - 1
        AND d.questions_answered >= 25
    ),
    con_respuestas AS (
      SELECT
        t.*,
        (SELECT COUNT(*) FROM test_questions q
          WHERE q.user_id = t.user_id
            AND (q.created_at AT TIME ZONE 'Europe/Madrid')::date = t.usage_date)
        + (SELECT COUNT(*) FROM psychometric_test_answers pa
            WHERE pa.user_id = t.user_id
              AND (pa.created_at AT TIME ZONE 'Europe/Madrid')::date = t.usage_date)
        + (SELECT COUNT(*) FROM spelling_test_answers sa
            WHERE sa.user_id = t.user_id
              AND (sa.answered_at AT TIME ZONE 'Europe/Madrid')::date = t.usage_date)
        AS respondidas
      FROM topados t
    )
    SELECT
      COUNT(*)::int AS afectados,
      COALESCE(ROUND(AVG(respondidas))::int, 0) AS "respondidasMedia",
      COALESCE(ROUND(AVG(contador - respondidas))::int, 0) AS "desfaseMedio"
    FROM con_respuestas
    WHERE respondidas < 20
  `,
  // Umbral: el ruido normal es de unos pocos casos al día (sesiones a caballo entre
  // dos días, respuestas que el cliente no llega a enviar). Un salto por encima de
  // 10 en 48 h es señal de regresión, no de cola larga.
  shouldFire: (rows) => (rows[0]?.afectados ?? 0) > 10,
  buildNotification: (rows) => {
    const n = rows[0]?.afectados ?? 0;
    const media = rows[0]?.respondidasMedia ?? 0;
    const desfase = rows[0]?.desfaseMedio ?? 0;
    return {
      title: `${n} usuarios free agotaron el cupo con ~${media} respuestas reales`,
      body: `El contador diario está cobrando de más (desfase medio: ${desfase} preguntas).\n\nDesde el 29/07/2026 el cupo lo cobra el SERVIDOR y solo si la respuesta se guarda (\`debeConsumirCupo\`, lib/api/dailyLimit.ts + backend/src/daily-limit/daily-limit.service.ts). Si esta regla dispara, comprobar por ese orden:\n\n  1. ¿Alguien volvió a cobrar desde el cliente? → guardarraíl __tests__/guardrails/dailyQuotaServerSide.test.ts\n  2. ¿Hay respuestas que dejaron de persistirse en test_questions? (cola de guardado, sesión sin crear)\n  3. ¿Un camino nuevo (modalidad nueva) cobra sin guardar?\n\nQuiénes son:\n\n  SELECT d.user_id, d.usage_date, d.questions_answered\n  FROM daily_question_usage d JOIN user_profiles p ON p.id=d.user_id\n  WHERE p.plan_type <> 'premium' AND d.questions_answered >= 25\n    AND d.usage_date = (NOW() AT TIME ZONE 'Europe/Madrid')::date - 1;`,
      metadata: {
        afectados: n,
        respondidasMedia: media,
        desfaseMedio: desfase,
      },
      fingerprint: 'daily_quota_overcharge',
    };
  },
  cooldownMin: 720,
};

/**
 * Impugnaciones que el usuario CREE haber enviado y no se guardaron.
 *
 * Nace del caso Pilar (28/07/2026): pulsó impugnar, el POST murió con "Load failed"
 * (Safari) y la impugnación nunca llegó a existir. Ella se enteró al no verla en su
 * historial, y lo supimos porque escribió. El único rastro era un `http_network_error`
 * genérico entre miles de otros endpoints: imposible contar impugnaciones perdidas.
 *
 * Desde el 29/07 el envío REINTENTA (`apiFetch`) y, si aun así se pierde, el cliente
 * emite `dispute_submit_failed` SIN muestreo. Esta regla lo vigila: cada evento es un
 * usuario que quiso reportar un fallo de contenido y no pudo.
 *
 * Umbral bajo a propósito: el baseline sano es ~0 (2 fallos de red en 30 días antes del
 * arreglo, y ahora encima hay reintentos). 3 en una hora ya es señal de algo roto
 * (deploy, CORS, endpoint caído), no de mala cobertura puntual.
 */
export const RULE_DISPUTE_SUBMIT_FAILED: AlertRule<{
  n: number;
  usuarios: number;
  motivo: string | null;
}> = {
  name: 'dispute_submit_failed',
  severity: 'warn',
  query: sql`
    SELECT COUNT(*)::int AS n,
           COUNT(DISTINCT user_id)::int AS usuarios,
           MODE() WITHIN GROUP (ORDER BY error_message) AS motivo
    FROM observable_events
    WHERE event_type = 'dispute_submit_failed'
      AND ts > NOW() - INTERVAL '1 hour'
  `,
  shouldFire: (rows) => (rows[0]?.n ?? 0) >= 3,
  buildNotification: (rows) => {
    const n = rows[0]?.n ?? 0;
    const usuarios = rows[0]?.usuarios ?? 0;
    const motivo = rows[0]?.motivo ?? '(sin motivo)';
    return {
      title: `${n} impugnación(es) perdidas en 1 h — ${usuarios} usuario(s)`,
      body: `Alguien pulsó "impugnar", el envío falló incluso tras los reintentos y la impugnación NO se guardó. El usuario ve el aviso, pero ha perdido el reporte.\n\nMotivo más repetido: ${motivo}\n\nMirar:\n\n  SELECT ts, user_id, error_message, metadata->>'questionId' AS pregunta\n  FROM observable_events WHERE event_type='dispute_submit_failed'\n    AND ts > NOW() - INTERVAL '6 hours' ORDER BY ts DESC;\n\nSi el motivo es el mismo para todos, sospechar de deploy/CORS/endpoint caído, no de la conexión del usuario.`,
      metadata: { count: n, usuarios, motivo },
      fingerprint: 'dispute_submit_failed',
    };
  },
  cooldownMin: 120,
};

/**
 * BARAJADO SERVIDO QUE NO SE GUARDA — la firma exacta del incidente T-235.
 *
 * El serve emite `shuffle_options_request_active` cuando sirve preguntas permutadas.
 * Si eso ocurre y NINGUNA respuesta de la misma ventana guarda `option_order`, la
 * permutación no está volviendo: el servidor corrige la posición MOSTRADA contra la
 * clave ORIGINAL y marca como FALLO respuestas ACERTADAS. Así se perdieron 56 aciertos
 * de 8 usuarios de Valencia el 28/07, y NADIE se enteró: no había ninguna regla que
 * mirase esto (152 reglas y ni una del barajado). Lo descubrió una usuaria.
 *
 * Es la condición que la propia ficha T-235 exige comprobar "en la primera hora" tras
 * encender el piloto — aquí queda automatizada en vez de depender de que alguien mire.
 */
export const RULE_SHUFFLE_ORDER_NOT_PERSISTED: AlertRule<{
  servidas: number;
  guardadas: number;
}> = {
  name: 'shuffle_order_not_persisted',
  severity: 'critical',
  query: sql`
    SELECT
      (SELECT COUNT(*)::int FROM observable_events
        WHERE event_type = 'shuffle_options_request_active'
          AND ts > NOW() - INTERVAL '1 hour') AS servidas,
      (SELECT COUNT(*)::int FROM test_questions
        WHERE option_order IS NOT NULL
          AND created_at > NOW() - INTERVAL '1 hour') AS guardadas
  `,
  // Con barajado activo (≥5 peticiones para no saltar por una suelta) tiene que haber
  // ALGUNA respuesta con la permutación guardada. Cero es la señal de que se pierde.
  shouldFire: (rows) =>
    (rows[0]?.servidas ?? 0) >= 5 && (rows[0]?.guardadas ?? 0) === 0,
  buildNotification: (rows) => {
    const servidas = rows[0]?.servidas ?? 0;
    return {
      title: `Barajado ACTIVO y la permutación NO se guarda (${servidas} peticiones, 0 respuestas con option_order)`,
      body: `El servidor está sirviendo preguntas barajadas pero \`test_questions.option_order\` sigue vacío. Eso significa que la corrección compara la posición MOSTRADA contra la clave ORIGINAL: se están marcando FALLOS a quien acierta, y las filas quedan coherentes consigo mismas (no se pueden reparar después).\n\nACCIÓN INMEDIATA: apagar el flag.\n\n  aws --profile vence --region eu-west-2 ssm put-parameter --name /vence-frontend/FEATURE_SHUFFLE_OPTIONS --value false --overwrite\n  (+ force-new-deployment del servicio: los secretos se leen al arrancar la tarea)\n\nDespués, comprobar la PARIDAD de las dos implementaciones del endpoint (frontend y backend NestJS): el incidente del 28/07 fue que el backend no declaraba \`optionOrder\` en su Zod y lo borraba en silencio. Guardarraíl: __tests__/guardrails/shuffleOrderParidad.test.ts`,
      metadata: { servidas, guardadas: rows[0]?.guardadas ?? 0 },
      fingerprint: 'shuffle_order_not_persisted',
    };
  },
  cooldownMin: 60,
};

/**
 * CLAVE ROTA — el cliente devolvió un `option_order` que no es una permutación válida.
 * La ficha T-235 lo dice sin matices: «cualquier cosa distinta de 0 es motivo de apagar
 * y diagnosticar antes que seguir». Por eso el umbral es 1.
 */
export const RULE_SHUFFLE_ORDER_INVALID: AlertRule<{
  n: number;
  usuarios: number;
}> = {
  name: 'shuffle_option_order_invalid',
  severity: 'critical',
  query: sql`
    SELECT COUNT(*)::int AS n, COUNT(DISTINCT user_id)::int AS usuarios
    FROM observable_events
    WHERE event_type = 'shuffle_option_order_invalid'
      AND ts > NOW() - INTERVAL '1 hour'
  `,
  shouldFire: (rows) => (rows[0]?.n ?? 0) >= 1,
  buildNotification: (rows) => {
    const n = rows[0]?.n ?? 0;
    return {
      title: `Barajado: ${n} orden(es) de opciones inválido(s) — posible clave rota`,
      body: `El cliente devolvió un \`option_order\` que no es una permutación válida de las opciones. Se ha tratado como identidad (seguro), pero es señal de desincronía entre lo que se sirve y lo que se guarda, o de manipulación.\n\nCriterio de la ficha T-235: cualquier cosa distinta de 0 es motivo de APAGAR y diagnosticar.\n\n  SELECT ts, user_id, metadata FROM observable_events\n  WHERE event_type='shuffle_option_order_invalid' ORDER BY ts DESC LIMIT 20;`,
      metadata: { count: n, usuarios: rows[0]?.usuarios ?? 0 },
      fingerprint: 'shuffle_option_order_invalid',
    };
  },
  cooldownMin: 60,
};

/**
 * CATCH-ALL DE VIGILANCIA — la red que impide que un tipo de evento nuevo pase
 * desapercibido por no tener regla propia.
 *
 * Auditoría 29/07/2026: 216 `event_type` distintos emitiéndose contra 154 reglas. Trece
 * tipos GRAVES no aparecían en ninguna: `server_render_error` (991 en 24 h),
 * `pre_hydration_error` (277), `cron_error` (24), `cron_http_trigger_failed`,
 * `question_image_error`, `estado_proceso_drift`, `e2e_smoke_failed`… El panel los
 * agregaba (indicador `error_signals`) pero no los pintaba, y ninguna regla mandaba
 * email: estaban en la BD y nadie los miraba.
 *
 * Escribir una regla por tipo no cierra el hueco — el hueco lo abre precisamente el
 * tipo que AÚN no existe. Esta regla invierte el criterio: **dispara ante cualquier
 * señal `error` que supere el umbral y NO esté en la lista de benignos conocidos**
 * (`benign-signals.ts`, copia paritaria de la del frontend). Un evento nuevo nace
 * vigilado; para silenciarlo hay que declararlo benigno a propósito.
 *
 * Excluye dos cosas, cada una por su motivo:
 *  · los BENIGNOS (`benign-signals.ts`): esperados por diseño;
 *  · los que YA tienen regla propia y fina (`CON_REGLA_PROPIA`): su umbral decide mejor
 *    —3/h para impugnaciones perdidas, 1 para una clave rota— y contarlos aquí mandaría
 *    dos correos del mismo incidente tapando el fino con el grueso.
 *
 * UMBRAL 150/h, calibrado contra el tráfico real del 29/07/2026 y NO al revés (elegir
 * un número redondo y luego descubrir que suena solo). Medido ese día: el ruido crónico
 * más alto que queda tras las exclusiones es `console_error` a ~75/h, y dentro hay daño
 * de verdad (`answerSaveQueue Sin token`, timeouts de 15 s, callbacks de login sin
 * sesión) que merece ficha propia, no un correo cada tres horas. 150/h es el doble de
 * ese suelo: por debajo se tría en el panel, por encima es una avería.
 *
 * Severidad `critical` a propósito: esto es el "errores muy fuertes" del correo, no la
 * bandeja de triaje fino. El triaje detallado —incluidas las señales por debajo del
 * umbral— se hace en `/admin/salud-sistema` → "Todas las señales (24h)", runbook §1.ter.a.
 */
export const RULE_SENAL_ERROR_SIN_VIGILANCIA: AlertRule<{
  event_type: string;
  n: number;
  fuente: string;
  top_endpoint: string | null;
}> = {
  name: 'senal_error_sin_vigilancia',
  severity: 'critical',
  query: sql`
    SELECT event_type,
           COUNT(*)::int AS n,
           MODE() WITHIN GROUP (ORDER BY source) AS fuente,
           MODE() WITHIN GROUP (ORDER BY COALESCE(endpoint, '')) AS top_endpoint
    FROM observable_events
    WHERE severity = 'error'
      AND ts > NOW() - INTERVAL '1 hour'
      AND event_type <> ALL(${sql.raw(
        `ARRAY[${[...BENIGN_SIGNALS, ...CON_REGLA_PROPIA].map((t) => `'${t}'`).join(',')}]::text[]`,
      )})
    GROUP BY event_type
    HAVING COUNT(*) >= 150
    ORDER BY 2 DESC
  `,
  shouldFire: (rows) => rows.length > 0,
  buildNotification: (rows) => {
    const top = rows[0];
    const lista = rows
      .slice(0, 8)
      .map(
        (r) =>
          `  ${String(r.n).padStart(5)}  ${r.event_type}  (${r.fuente}${r.top_endpoint ? ` · ${r.top_endpoint}` : ''})`,
      )
      .join('\n');
    return {
      title: `Errores en volumen: ${top?.n ?? 0}× ${top?.event_type ?? '?'} en 1 h`,
      body: `Señales de severidad \`error\` por encima de 50/h que NO son ruido conocido:\n\n${lista}\n\nEsta alerta es el catch-all: salta aunque el tipo de evento no tenga regla propia, para que un fallo nuevo no pase desapercibido.\n\nTriaje completo (todas las señales, también por debajo del umbral): /admin/salud-sistema → "Todas las señales (24h)". Runbook: docs/runbooks/health-check.md §1.ter.\n\n  SELECT ts, source, event_type, endpoint, error_message, metadata\n  FROM observable_events WHERE event_type='${top?.event_type ?? ''}'\n    AND ts > NOW() - INTERVAL '2 hours' ORDER BY ts DESC LIMIT 20;\n\nSi es ruido esperado por diseño, declararlo benigno en lib/observability/benignSignals.ts (y su copia del backend) — nunca subir el umbral para callarlo.`,
      metadata: {
        tipos: rows.length,
        top: top?.event_type ?? null,
        count: top?.n ?? 0,
      },
      fingerprint: `senal_error_sin_vigilancia:${top?.event_type ?? 'na'}`,
    };
  },
  cooldownMin: 180,
};


/**
 * El límite por dispositivo NO está cortando aunque haya dispositivos pasándose del tope.
 *
 * ── POR QUÉ EXISTE (T-304, 30/07/2026) ──────────────────────────────────────
 * El enforcement por dispositivo se construyó el 17/04/2026 —frontend, backend, tests y pantalla
 * de bloqueo incluidos— y estuvo **tres meses sin cortar ni una sola vez**, mientras 3 a 11
 * dispositivos al día se pasaban del tope rotando cuentas. Nadie se enteró porque un bloqueo que
 * no ocurre no genera ninguna señal: el fallo era la AUSENCIA, y la ausencia no dispara nada.
 *
 * La causa fue el ancla (el `device_id` de localStorage, que se borra en dos clics), pero la
 * lección que deja esta regla es otra: **un enforcement sin telemetría de sus bloqueos es
 * indistinguible de un enforcement apagado**. Esta regla compara las dos mitades —hay farmeo / se
 * está bloqueando— y grita cuando la segunda es cero y la primera no.
 *
 * Umbral deliberadamente laxo (3 días) para no confundir un día tranquilo con una avería: lo que
 * se persigue es el silencio SOSTENIDO, que es la firma del bug de tres meses.
 */
export const RULE_DEVICE_LIMIT_MUDO: AlertRule<{
  deviceDias: number;
  bloqueos: number;
  peor: number;
}> = {
  name: 'device_limit_mudo',
  severity: 'error',
  query: sql`
    WITH uso AS (
      SELECT ud.device_id, dqu.usage_date, SUM(dqu.questions_answered)::int AS total
        FROM daily_question_usage dqu
        JOIN user_devices ud ON ud.user_id = dqu.user_id
        JOIN user_profiles up ON up.id = dqu.user_id
       WHERE dqu.usage_date >= (NOW() AT TIME ZONE 'Europe/Madrid')::date - 3
         AND dqu.questions_answered > 0
         AND COALESCE(up.plan_type, 'free') NOT IN
             ('premium', 'trial', 'legacy_free', 'premium_semester', 'admin')
       GROUP BY 1, 2
      HAVING COUNT(DISTINCT dqu.user_id) >= 2 AND SUM(dqu.questions_answered) > 25
    )
    SELECT
      (SELECT COUNT(*)::int FROM uso) AS "deviceDias",
      (SELECT COALESCE(MAX(total), 0)::int FROM uso) AS "peor",
      (SELECT COUNT(*)::int FROM observable_events
        WHERE event_type = 'device_daily_limit_blocked'
          AND ts >= NOW() - INTERVAL '3 days') AS "bloqueos"
  `,
  // Hay farmeo sostenido Y ni un solo bloqueo: el enforcement está mudo.
  shouldFire: (rows) =>
    (rows[0]?.deviceDias ?? 0) >= 3 && (rows[0]?.bloqueos ?? 0) === 0,
  buildNotification: (rows) => {
    const d = rows[0]?.deviceDias ?? 0;
    const peor = rows[0]?.peor ?? 0;
    return {
      title: `Límite por dispositivo MUDO: ${d} device-días por encima del tope y 0 bloqueos`,
      body:
        `En los últimos 3 días hubo ${d} device-días con 2+ cuentas pasando del tope ` +
        `(el peor, ${peor} preguntas) y el enforcement no ha bloqueado NI UNA vez.\n\n` +
        `Esto ya pasó del 17/04 al 30/07/2026: el bloqueo existía y estaba cableado, pero se ` +
        `anclaba al device_id de localStorage, que el usuario borra en dos clics.\n\n` +
        `Comprobar por este orden:\n` +
        `  1. ¿Llega la huella v2? → SELECT count(*) FROM user_devices WHERE hw_fingerprint LIKE 'fp2\\_%';\n` +
        `     Si es 0 o casi, el cliente no la está mandando (revisar getFingerprintHeader).\n` +
        `  2. ¿La función agrupa? → SELECT get_device_daily_usage_v2('<device>', '<fp2_...>');\n` +
        `  3. ¿El camino que sirve tráfico comprueba? Frontend y backend deben pasar la huella a ` +
        `checkDeviceDailyUsage — el proxy al backend se salta el antifraude LOCAL.\n\n` +
        `Runbook: docs/runbooks/revisar-fraudes.md §límite por dispositivo.`,
      metadata: { deviceDias: d, bloqueos: rows[0]?.bloqueos ?? 0, peor },
      fingerprint: 'device_limit_mudo',
    };
  },
  cooldownMin: 1440,
};


/**
 * El registro de IP de sesión se ha caído: un WRITER que deja de escribir.
 *
 * ── POR QUÉ EXISTE (T-314, 30/07/2026) ──────────────────────────────────────
 * El 03/07 se flipeó a Auth.js y el registro de IP pasó del **80% al 1%** de las sesiones. Estuvo
 * **27 días roto sin una sola señal**, porque el fallo era una AUSENCIA: el endpoint no daba
 * errores, simplemente casi nadie lo llamaba. La IP es la que desempata los casos dudosos del
 * antifraude (misma huella + IP distinta = probablemente otra persona; misma IP = la misma casa),
 * así que perderla degrada en silencio todo lo que se apoya en ella.
 *
 * Es el mismo patrón que `device_limit_mudo`: **nadie vigila que un writer DEJE de escribir**.
 * Esta regla mira la COBERTURA, no los errores.
 *
 * Umbral en 40%: el histórico sano ronda el 70-85% (nunca fue 100%, siempre hubo sesiones sin IP),
 * y durante el fallo estuvo en 1-6%. 40% deja holgura para un día raro sin tragarse una caída real.
 */
export const RULE_SESSION_IP_COVERAGE_DROP: AlertRule<{
  sesiones: number;
  conIp: number;
  pct: number;
}> = {
  name: 'session_ip_coverage_drop',
  severity: 'error',
  query: sql`
    SELECT COUNT(*)::int AS sesiones,
           COUNT(ip_address)::int AS "conIp",
           COALESCE(ROUND(100.0 * COUNT(ip_address) / NULLIF(COUNT(*), 0))::int, 0) AS pct
      FROM user_sessions
     WHERE created_at >= NOW() - INTERVAL '24 hours'
  `,
  // Con pocas sesiones el porcentaje es ruido: se exige volumen para opinar.
  shouldFire: (rows) =>
    (rows[0]?.sesiones ?? 0) >= 200 && (rows[0]?.pct ?? 100) < 40,
  buildNotification: (rows) => {
    const pct = rows[0]?.pct ?? 0;
    const n = rows[0]?.sesiones ?? 0;
    return {
      title: `Solo el ${pct}% de las sesiones registra IP (histórico sano: 70-85%)`,
      body:
        `De ${n} sesiones en 24 h, solo ${rows[0]?.conIp ?? 0} tienen IP.\n\n` +
        `La IP es lo que desempata los casos dudosos del antifraude: misma huella de hardware con ` +
        `IP distinta es probablemente otra persona con el mismo modelo de móvil; misma IP es la ` +
        `misma casa. Sin ella, el análisis por dispositivo trabaja a ciegas.\n\n` +
        `Esto ya pasó del 03/07 al 30/07/2026 (80% → 1%): el disparador colgaba del evento ` +
        `SIGNED_IN y, al cambiar de proveedor de auth, ese evento dejó de llegar. El endpoint ` +
        `estaba bien; nadie lo llamaba.\n\n` +
        `Comprobar por este orden:\n` +
        `  1. ¿Se llama al endpoint? → observable_events WHERE endpoint LIKE '%track-session-ip%'\n` +
        `     (si son unas pocas al día con miles de sesiones, el disparador está roto)\n` +
        `  2. ¿Falla el endpoint? → validation_error_logs del mismo endpoint\n` +
        `  3. ¿Cambió algo en el flujo de auth? El disparador NO puede depender de un evento de ` +
        `proveedor: guardarraíl __tests__/guardrails/sessionIpNoColgarDeEvento.test.ts\n\n` +
        `Runbook: docs/runbooks/revisar-fraudes.md`,
      metadata: { pct, sesiones: n, conIp: rows[0]?.conIp ?? 0 },
      fingerprint: 'session_ip_coverage_drop',
    };
  },
  cooldownMin: 1440,
};


/**
 * Señales de fraude SIN TRIAR: las que esperan la única acción que existe.
 *
 * ── POR QUÉ NACIÓ, Y POR QUÉ MIDE OTRA COSA DESDE EL 31/07 ──────────────────
 * Nació el 30/07 vigilando las **confirmadas**: el badge 🚨 cuenta las `new`, así que al confirmar
 * una **desaparece del badge** y el trabajo de detectarla acababa enterrándolo. El razonamiento
 * era bueno y el dato, cierto (20 confirmadas, la más antigua de 9 días).
 *
 * El problema es lo que PEDÍA. Con F0 —solo detección y revisión—, confirmar era el último paso
 * que existía: la alerta reclamaba «decidir qué hacer» con algo que no tenía remediación, así que
 * solo podía acumularse y volver a sonar. Y una alerta que no se puede atender no es ruido
 * inofensivo: **enseña a ignorar el buzón**, y esa costumbre se contagia a las reglas que sí
 * importan.
 *
 * Dos cosas cambiaron para reformularla (medido el 31/07, [T-426]):
 *   · El **límite por dispositivo ya está en `enforce`** en producción ([T-304], 30/07) y corta de
 *     verdad: 1.127 bloqueos en 7 días. El farmeo multicuenta sobre un mismo equipo —que son 18 de
 *     las 23 confirmadas— **ya se mitiga solo**. Confirmar dejó de ser un callejón.
 *   · Lo medido pone el abuso en perspectiva: 69 cuentas implicadas, **todas free**, 1.216
 *     respuestas en 7 días = **1,6 %** del total de la plataforma. No es una emergencia que
 *     justifique bloquear por IP de registro, donde una academia o un CGNAT son indistinguibles
 *     de una granja.
 *
 * Así que ahora vigila **lo que sí tiene acción**: señales `new` que nadie ha triado. Triar es el
 * paso que existe, lo hace una sesión con el runbook, y termina en `confirmed`/`dismissed`.
 *
 * Lo que NO cubre el enforcement por dispositivo —`multi_account_reg_ip`, altas masivas desde una
 * misma IP— sigue sin remediación automática, y ésa es la decisión de producto que queda abierta
 * en [T-426]. Pero es una DECISIÓN, no una deuda de triaje: no se pide por alerta.
 *
 * Umbral en 3 días: triar es cuestión de minutos, y el vigía ya canta las nuevas en el momento;
 * esto es la red por si nadie estuvo mirando.
 */
/**
 * Un alta que NO consigue perfil: el usuario nace sin poder pagar ni quejarse.
 *
 * ── POR QUÉ (T-434, 31/07/2026) ─────────────────────────────────────────────
 * Cuando `resolveAppUserId` no puede resolver ni crear el perfil, el callback `jwt` de
 * Auth.js **firma la sesión igual** y `session.user.id` se queda con el id por defecto, que
 * no existe en `user_profiles`. A partir de ahí, todo lo que se indexa por ese id rebota:
 * las estadísticas («Usuario no existe»), el checkout (`404 · User not found in database`)
 * y **el propio formulario de soporte** — o sea que el afectado tampoco puede avisarnos.
 *
 * Hasta hoy eso ocurría **en silencio absoluto**: la única huella era un `console.warn` que
 * no se persiste (medido: 0 eventos en `observable_events` y en `validation_error_logs`),
 * mientras 29-31 usuarios AL DÍA navegaban rotos, algunos desde el 7 de julio y uno con 16
 * intentos de compra rechazados.
 *
 * Umbral en 1: no hay volumen mínimo aceptable. Un solo usuario en este estado es alguien
 * que quiso pagar y no pudo, y que no tiene forma de decírnoslo.
 */
export const RULE_ALTA_SIN_PERFIL: AlertRule<{ usuarios: number; veces: number }> = {
  name: 'alta_sin_perfil',
  severity: 'error',
  query: sql`
    SELECT COUNT(DISTINCT metadata->>'emailPrefijo')::int AS usuarios,
           COUNT(*)::int AS veces
      FROM observable_events
     WHERE event_type = 'auth_alta_sin_perfil'
       AND ts >= now() - interval '24 hours'
  `,
  shouldFire: (rows) => (rows[0]?.veces ?? 0) > 0,
  buildNotification: (rows) => ({
    title: `${rows[0]?.usuarios ?? 0} alta(s) sin perfil en 24 h: nacen sin poder pagar`,
    body:
      `El alta se completó y la sesión se firmó, pero NO hay fila en user_profiles para ese ` +
      `usuario. Consecuencia inmediata: sus estadísticas fallan, el checkout le devuelve ` +
      `«User not found in database» y el formulario de soporte también, así que no puede ni ` +
      `avisarnos.\n\n` +
      `Quiénes son (el email va troceado a propósito: prefijo + dominio):\n` +
      `  SELECT metadata->>'emailPrefijo', metadata->>'dominio', count(*)\n` +
      `    FROM observable_events WHERE event_type='auth_alta_sin_perfil'\n` +
      `   AND ts >= now() - interval '24 hours' GROUP BY 1,2;\n\n` +
      `Si el dominio se repite, sospecha del proveedor de identidad; si son sueltos, mira ` +
      `create_organic_user. Ficha con el diagnóstico completo: T-434.`,
    metadata: { usuarios: rows[0]?.usuarios ?? 0, veces: rows[0]?.veces ?? 0 },
    fingerprint: 'alta_sin_perfil',
  }),
  cooldownMin: 1440,
};

export const RULE_FRAUDE_SIN_TRIAR: AlertRule<{
  total: number;
  masAntiguaDias: number;
}> = {
  name: 'fraude_sin_triar',
  severity: 'warn',
  query: sql`
    SELECT COUNT(*)::int AS total,
           COALESCE(MAX(EXTRACT(DAY FROM now() - detected_at))::int, 0) AS "masAntiguaDias"
      FROM fraud_alerts
     WHERE status = 'new'
  `,
  shouldFire: (rows) =>
    (rows[0]?.total ?? 0) > 0 && (rows[0]?.masAntiguaDias ?? 0) >= 3,
  buildNotification: (rows) => ({
    title: `${rows[0]?.total ?? 0} señales de fraude SIN TRIAR (la más antigua, ${rows[0]?.masAntiguaDias ?? 0} días)`,
    body:
      `Nadie las ha mirado todavía. Triarlas es el paso que existe: se verifica cada una contra ` +
      `los datos y acaba en 'confirmed' o 'dismissed'.\n\n` +
      `Expediente de cada una — quién es, qué consume, si sigue activa:\n` +
      `  npm run fraude:dossier\n\n` +
      `Contexto para no alarmarse de más: el límite por dispositivo está en enforce y ya corta el ` +
      `farmeo multicuenta sin intervención. Lo que sigue sin remediación automática son las altas ` +
      `masivas desde una misma IP de registro, y eso es una decisión de producto abierta (T-426), ` +
      `no trabajo pendiente de triaje.\n\n` +
      `Runbook: docs/runbooks/revisar-fraudes.md`,
    metadata: { total: rows[0]?.total ?? 0, masAntiguaDias: rows[0]?.masAntiguaDias ?? 0 },
    fingerprint: 'fraude_sin_triar',
  }),
  // 24 h. Se intentó semanal (10080) y el guardarraíl de [T-258] lo tumbó con razón: el cooldown
  // persistido se hidrata desde una ventana de 48 h (`LAST_FIRED_LOOKBACK_MIN`), así que cualquier
  // valor mayor se perdería tras un reinicio y la alerta acabaría disparando más de lo previsto —
  // silenciosamente. Diario es suficiente para una deuda y cabe holgado en la ventana.
  cooldownMin: 1440,
};

/**
 * Cuentas ya marcadas que aparecen bajo un dispositivo NUEVO: evasión en marcha.
 *
 * ── POR QUÉ (30/07/2026) ────────────────────────────────────────────────────
 * Al cerrar el salto del tope por cuenta, Manuel preguntó lo obvio: *"cogerá el móvil de su pareja
 * y luego el de su hijo"*. Cierto — pero eso deja MÁS rastro, no menos: las mismas cuentas
 * apareciendo bajo huellas de hardware distintas es una firma más clara que quedarse quieto.
 *
 * Esta regla convierte esa evasión en una señal en vez de en un punto ciego. No mide "una cuenta
 * en dos equipos" (eso es normal: móvil y portátil), sino cuentas **ya marcadas** estrenando
 * equipo — que es otra cosa.
 */
export const RULE_EVASION_MULTIDISPOSITIVO: AlertRule<{
  cuentas: number;
  equipos: number;
}> = {
  name: 'evasion_multidispositivo',
  severity: 'warn',
  query: sql`
    WITH marcadas AS (
      SELECT DISTINCT unnest(user_ids) AS user_id, device_id AS device_marcado
        FROM fraud_confirmations
       WHERE retention_until > now()
    )
    SELECT COUNT(DISTINCT m.user_id)::int AS cuentas,
           COUNT(DISTINCT ud.device_id)::int AS equipos
      FROM marcadas m
      JOIN user_devices ud ON ud.user_id = m.user_id
     WHERE ud.device_id IS DISTINCT FROM m.device_marcado
       AND ud.last_seen_at > now() - INTERVAL '3 days'
  `,
  // Un equipo nuevo suelto no dice nada (cambio de móvil). Dos cuentas marcadas estrenando
  // equipo a la vez, sí.
  shouldFire: (rows) => (rows[0]?.cuentas ?? 0) >= 2,
  buildNotification: (rows) => ({
    title: `${rows[0]?.cuentas ?? 0} cuentas ya marcadas usando ${rows[0]?.equipos ?? 0} dispositivos NUEVOS`,
    body:
      `Cuentas con marca de multicuenta viva que en los últimos 3 días han aparecido en equipos ` +
      `distintos del que tenían marcado. Es el patrón de quien, al toparse con el límite del ` +
      `dispositivo, prueba con otro (el móvil de la pareja, el del hijo).\n\n` +
      `No es concluyente por sí solo —cambiar de móvil es legítimo— pero en cuentas YA marcadas ` +
      `merece una mirada. Contexto completo:  npm run fraude:dossier`,
    metadata: { cuentas: rows[0]?.cuentas ?? 0, equipos: rows[0]?.equipos ?? 0 },
    fingerprint: 'evasion_multidispositivo',
  }),
  cooldownMin: 1440,
};


/**
 * La fuente oficial de una ley que servimos ha CAMBIADO. [T-380]
 *
 * Regla PROPIA y no el catch-all a propósito: `senal_error_sin_vigilancia` está calibrado
 * para inundaciones (≥150 eventos/h de un tipo), y esto son uno o dos avisos al día — nacería
 * invisible justo por ser poco frecuente, que es lo contrario de lo que interesa. Un cambio en
 * el BOJA o en un boletín autonómico puede dejar desactualizadas decenas de preguntas.
 *
 * No dispara con `law_source_unreachable`: una descarga fallida NO es un cambio (el BORM
 * devuelve captchas), y mezclarlas quemaría la señal.
 */
export const RULE_LAW_SOURCE_CHANGED: AlertRule = {
  name: 'law_source_changed',
  severity: 'warn',
  emailAlways: true,
  query: sql`
    SELECT metadata->>'short_name' AS ley,
           metadata->>'url' AS url,
           (metadata->>'preguntas')::int AS preguntas,
           MAX(ts) AS "lastTs"
    FROM observable_events
    WHERE event_type = 'law_source_changed'
      AND ts > NOW() - INTERVAL '24 hours'
    GROUP BY 1, 2, 3
    ORDER BY preguntas DESC NULLS LAST
  `,
  shouldFire: (rows) => rows.length > 0,
  buildNotification: (rows) => {
    const total = rows.reduce<number>(
      (n, r) => n + (Number((r as { preguntas?: number }).preguntas) || 0),
      0,
    );
    const lineas = rows
      .slice(0, 10)
      .map((r) => {
        const x = r as { ley?: string; url?: string; preguntas?: number };
        return `   · ${x.ley ?? '?'} (${x.preguntas ?? 0} preguntas)\n     ${x.url ?? ''}`;
      })
      .join('\n');
    return {
      title: `📜 La fuente oficial de ${rows.length} ley(es) ha cambiado (${total} preguntas afectadas)`,
      body:
        `La vigilancia por hash ha detectado que el documento oficial ya no es el que teníamos ` +
        `verificado. El hash dice QUE cambió, no QUÉ cambió:\n\n${lineas}\n\n` +
        `Para revisarlo, dile a Claude: «revisa los cambios de fuentes legales».\n` +
        `NO re-verificar sin abrir el documento: pisar la línea base silencia el aviso sin ` +
        `haber mirado nada.`,
      fingerprint: `law_source_changed:${rows.map((r) => (r as { ley?: string }).ley).join(',')}`,
    };
  },
  // 12 h: el aviso se repite una vez al día como mucho. Un cambio de fuente no se resuelve en
  // minutos (hay que abrir el documento y comparar articulado), así que insistir antes solo
  // enseña a ignorarlo.
  cooldownMin: 720,
};

/**
 * A una tarea VIVA del backlog le han borrado la ficha de `origin/main`. [T-427]
 *
 * ── POR QUÉ EXISTE ──────────────────────────────────────────────────────────
 * `docs/roadmap/tareas-pendientes.md` lo tocan las 2-10 sesiones a la vez y las fichas nuevas se
 * insertan todas en el mismo sitio, así que el conflicto es lo normal. Resolverlo quedándose con
 * «mi lado» borra el contexto que otra sesión acababa de escribir — pasó el 29/07 (T-251, T-254)
 * y otra vez el 31/07 (cinco fichas de dos sesiones distintas, commit `a9797ae3a`).
 *
 * El CLI ya lo grita al correr `sync`, y aun así hace falta esto: **quien borra la ficha no es
 * quien corre el `sync` después**, y la sesión víctima puede haber muerto ya. Las dos veces se
 * descubrió por casualidad, al volver a abrir la ficha por otro motivo. Un daño que solo se ve si
 * alguien pasa por delante es un daño invisible.
 *
 * Regla PROPIA y no el catch-all, por el mismo motivo que `law_source_changed`:
 * `senal_error_sin_vigilancia` está calibrado para inundaciones (≥150/h) y esto son uno o dos
 * avisos por semana — nacería invisible justo por ser poco frecuente.
 */
export const RULE_BACKLOG_FICHA_BORRADA: AlertRule = {
  name: 'backlog_ficha_borrada',
  severity: 'warn',
  emailAlways: true,
  query: sql`
    SELECT metadata->>'tarea' AS tarea,
           metadata->>'commit' AS commit,
           metadata->>'detectada_por' AS sesion,
           MAX(ts) AS "lastTs"
    FROM observable_events
    WHERE event_type = 'backlog_ficha_borrada'
      AND ts > NOW() - INTERVAL '24 hours'
    GROUP BY 1, 2, 3
    ORDER BY "lastTs" DESC
  `,
  shouldFire: (rows) => rows.length > 0,
  buildNotification: (rows) => {
    const lineas = rows
      .slice(0, 10)
      .map((r) => {
        const x = r as { tarea?: string; commit?: string };
        return `   · ${x.tarea ?? '?'}${x.commit ? `\n     la quitó: ${x.commit}` : ''}`;
      })
      .join('\n');
    return {
      title: `🗑️ ${rows.length} ficha(s) del backlog borradas de main con la tarea aún VIVA`,
      body:
        `Una tarea sigue abierta en \`backlog_tasks\` y su ficha ya no está en el markdown de ` +
        `\`origin/main\`. \`list\` la seguirá ofreciendo por su título y detrás no habrá nada que ` +
        `leer, así que quien la coja empieza sin contexto:\n\n${lineas}\n\n` +
        `Recuperarla (el contenido NO se ha perdido, está en el historial):\n` +
        `  git log -S'### [T-NNN]' -- docs/roadmap/tareas-pendientes.md\n\n` +
        `Causa habitual: resolver un conflicto de \`tareas-pendientes.md\` quedándose con un solo ` +
        `lado. Son fichas independientes, no versiones de la misma: se conservan LAS DOS. ` +
        `Runbook: docs/runbooks/tareas-pendientes.md.`,
      metadata: { fichas: rows.length },
      fingerprint: `backlog_ficha_borrada:${rows
        .map((r) => (r as { tarea?: string }).tarea)
        .join(',')}`,
    };
  },
  // 12 h: recuperar la ficha es un `git log` y un pegado, pero si nadie está delante no sirve de
  // nada repetirlo cada hora. Que insista una vez al día hasta que se arregle.
  cooldownMin: 720,
};

/**
 * Una campaña de email PROGRAMADA encontró destinatarios y no envió a ninguno. (T-448)
 *
 * Cubre las dos que existen —el recordatorio de cobro y el aviso de fin de suscripción— porque el
 * fallo es idéntico y la respuesta también: el cron dice 200, el heartbeat está verde, y nadie se
 * entera hasta que alguien reclama. Es el punto ciego que ya tenían documentado en el código
 * (`renewal_reminders_zero_sent`) y que, medido al añadir la campaña nueva, resultó que **no
 * vigilaba ninguna regla**: llevaba emitiéndose para nadie.
 *
 * Cualquier ocurrencia es señal: estas campañas corren una vez al día, así que no hay ráfaga que
 * filtrar. Ventana de 26 h para que un tick perdido no se trague el único evento del día.
 */
export const RULE_CAMPANA_EMAIL_ZERO_SENT: AlertRule<{ n: number; ultimo: string | null }> = {
  name: 'campana_email_zero_sent',
  severity: 'error',
  query: sql`
    SELECT count(*)::int AS n, MAX(error_message) AS ultimo
    FROM observable_events
    WHERE event_type IN ('renewal_reminders_zero_sent', 'fin_suscripcion_aviso_zero_sent')
      AND ts > NOW() - INTERVAL '26 hours'
  `,
  shouldFire: (rows) => (rows[0]?.n ?? 0) > 0,
  buildNotification: (rows) => ({
    title: 'Una campaña de email no envió a NADIE teniendo a quien avisar',
    body:
      (rows[0]?.ultimo ?? 'sin detalle') +
      '. El cron respondió bien y el heartbeat está verde, así que esto no se ve por ningún otro ' +
      'sitio. Mirar la query de selección, el dedup de email_logs y si Resend responde.',
    metadata: { n: rows[0]?.n ?? 0 },
  }),
  cooldownMin: 720,
};

/**
 * El barrido que anula precios de fidelidad se paró solo por el tope de seguridad. (T-448)
 *
 * Anular 50+ ofertas de golpe no es un trámite: significa que el criterio del mes se rompió (una
 * fecha mal leída, un cambio de columna) y que estábamos a punto de quitarle a mucha gente un
 * precio que se le prometió por email. El barrido NO toca nada cuando esto pasa; hay que mirarlo
 * a mano antes de dejarlo correr.
 */
export const RULE_ANULACION_PRECIO_ABORTADA: AlertRule<{ n: number; detalle: string | null }> = {
  name: 'anulacion_precio_fidelidad_abortada',
  severity: 'critical',
  query: sql`
    SELECT count(*)::int AS n, MAX(error_message) AS detalle
    FROM observable_events
    WHERE event_type = 'anulacion_precio_fidelidad_abortada'
      AND ts > NOW() - INTERVAL '26 hours'
  `,
  shouldFire: (rows) => (rows[0]?.n ?? 0) > 0,
  buildNotification: (rows) => ({
    title: 'El barrido de precios de fidelidad se ABORTÓ por el tope de seguridad',
    body:
      (rows[0]?.detalle ?? 'sin detalle') +
      '. No se ha anulado ninguna oferta. Revisar el criterio del mes antes de desbloquearlo: ' +
      'quitar un precio prometido por email a decenas de personas no se deshace con un revert.',
    metadata: { n: rows[0]?.n ?? 0 },
  }),
  cooldownMin: 720,
};

/**
 * [T-434] LA SESIÓN SE FIRMA SIN EMAIL — el caso que el reintento NO puede curar.
 *
 * El reintento de `authjs.ts` repara al usuario cuyo perfil no se resolvió, porque el email viaja
 * en el token y con él se puede volver a buscar. Si NO hay email, no hay por dónde: esa persona
 * quedará rota para siempre por mucho que recargue.
 *
 * Se vigila aparte, y no mezclado con `alta_sin_perfil`, justamente porque **la respuesta es
 * distinta**: aquello se arregla mirando `create_organic_user`; esto se arregla mirando qué
 * proveedor de identidad está firmando sesiones sin email. Confundirlos manda a investigar al
 * sitio equivocado, que es lo que ya pasó una vez en esta ficha.
 *
 * Nace en CERO a propósito: si habla, es un caso nuevo que nadie había visto.
 */
export const RULE_SESION_SIN_EMAIL: AlertRule<{ veces: number }> = {
  name: 'sesion_sin_email',
  severity: 'error',
  query: sql`
    SELECT COUNT(*)::int AS veces
      FROM observable_events
     WHERE event_type = 'auth_sesion_sin_email'
       AND coalesce(metadata->>'simulacion', 'false') <> 'true'
       AND ts >= now() - interval '24 hours'
  `,
  shouldFire: (rows) => (rows[0]?.veces ?? 0) > 0,
  buildNotification: (rows) => ({
    title: `${rows[0]?.veces ?? 0} sesión(es) firmadas SIN email en 24 h`,
    body:
      `Auth.js firmó una sesión sin email, así que no hay forma de resolver su perfil: ni en el ` +
      `alta ni reintentando. Esa persona no puede pagar ni escribir a soporte, y a diferencia de ` +
      `los demás casos NO se curará sola al recargar.\n\n` +
      `Esto NO se investiga en create_organic_user: se investiga en el PROVEEDOR. Mira qué ` +
      `provider firmó esas sesiones (Google redirect, One Tap) y si dejó de devolver el email.\n\n` +
      `Ficha: T-434.`,
    metadata: { veces: rows[0]?.veces ?? 0 },
    fingerprint: 'sesion_sin_email',
  }),
  cooldownMin: 1440,
};

/**
 * [T-434] EL ATASCO DE PERFILES ROTOS NO SE DRENA.
 *
 * `auth_perfil_recuperado` es la métrica de la REPARACIÓN: cada evento es un usuario que estaba
 * roto y acaba de curarse solo al recargar. Es una señal BUENA, y por eso su alerta no es «que
 * ocurra» sino **que no deje de ocurrir**.
 *
 * Los 235 rotos que había el 01/08/2026 se curan la primera vez que cargan una página, así que
 * esto debe subir unos días y **caer a cero**. Si sigue habiendo curaciones TODOS los días de una
 * semana, es que **siguen naciendo rotos** — el reintento estaría tapando el goteo en vez de
 * dejarlo ver, que es exactamente cómo un arreglo se convierte en un anestésico.
 *
 * Se mide en DÍAS DISTINTOS con eventos, no en volumen: un pico grande el primer día es lo
 * esperado; siete días seguidos, por pocos que sean, es un goteo.
 */
/**
 * [T-434] EL NAVEGADOR ARRASTRA OTRA IDENTIDAD — y sigue pasando después del drenaje.
 *
 * El cliente resucita de `localStorage` el id de una sesión Supabase legacy y lo manda como
 * `?userId=` a los endpoints que reciben el id por parámetro; el servidor, con su token
 * perfectamente sano, contesta 401 «Usuario no existe». Medido el 05/08/2026: **182 personas en
 * 14 días, 180 de ellas con sesión verificada y NINGUNA con fila en `user_profiles` bajo el id
 * que rebotaba** — o sea, gente sana con dos nombres en el navegador.
 *
 * Ahora se suelta ese rastro en cuanto el servidor dice el nombre bueno, y cada vez que ocurre
 * se emite `auth_identidad_ajena_descartada`. Es una métrica de DRENAJE: un pico los primeros
 * días es lo esperado (cada navegador afectado se limpia la primera vez que vuelve).
 *
 * Por eso NO dispara por volumen sino por PERSISTENCIA: siete días seguidos significa que
 * siguen NACIENDO navegadores con identidad legacy —alguien vuelve a escribir ese rastro— y el
 * descarte estaría tapando el goteo en vez de dejarlo ver. Mismo criterio, y a propósito, que
 * `perfil_roto_no_drena`: el arreglo que calla el síntoma es el que hay que vigilar.
 */
export const RULE_IDENTIDAD_AJENA_NO_DRENA: AlertRule<{ dias: number; veces: number }> = {
  name: 'identidad_ajena_no_drena',
  severity: 'warn',
  query: sql`
    SELECT COUNT(DISTINCT date_trunc('day', ts))::int AS dias,
           COUNT(*)::int AS veces
      FROM observable_events
     WHERE event_type = 'auth_identidad_ajena_descartada'
       AND ts >= now() - interval '7 days'
  `,
  shouldFire: (rows) => (rows[0]?.dias ?? 0) >= 7,
  buildNotification: (rows) => ({
    title: `Identidad ajena en el navegador: 7 días seguidos descartando (${rows[0]?.veces ?? 0} veces)`,
    body:
      `El cliente sigue llegando con el id de una sesión Supabase legacy distinto del de su ` +
      `sesión real. El atasco inicial (182 personas en 14 días, 05/08/2026) debería haberse ` +
      `drenado ya: cada navegador afectado se limpia la primera vez que vuelve. Si sigue a ` +
      `diario, es que ALGO VUELVE A ESCRIBIR ese rastro.\n\n` +
      `Dónde mirar, en este orden:\n` +
      `  1. Quién escribe la sesión legacy hoy (lib/auth/adapters/supabaseAdapter.ts la escribe ` +
      `en el callback de OAuth).\n` +
      `  2. El gemelo del SERVIDOR, que ve el mismo hecho desde el otro lado:\n` +
      `     SELECT count(*), count(DISTINCT user_id) FROM observable_events\n` +
      `      WHERE metadata->>'identityMismatch'='true' AND ts >= now() - interval '7 days';\n\n` +
      `Ficha: T-434.`,
    metadata: { dias: rows[0]?.dias ?? 0, veces: rows[0]?.veces ?? 0 },
    fingerprint: 'identidad_ajena_no_drena',
  }),
  cooldownMin: 1440,
};

export const RULE_PERFIL_ROTO_NO_DRENA: AlertRule<{ dias: number; usuarios: number }> = {
  name: 'perfil_roto_no_drena',
  severity: 'warn',
  query: sql`
    SELECT COUNT(DISTINCT date_trunc('day', ts))::int AS dias,
           COUNT(DISTINCT metadata->>'emailPrefijo')::int AS usuarios
      FROM observable_events
     WHERE event_type = 'auth_perfil_recuperado'
       AND coalesce(metadata->>'simulacion', 'false') <> 'true'
       AND ts >= now() - interval '7 days'
  `,
  shouldFire: (rows) => (rows[0]?.dias ?? 0) >= 7,
  buildNotification: (rows) => ({
    title: `Perfiles rotos: 7 días seguidos curando (${rows[0]?.usuarios ?? 0} usuarios)`,
    body:
      `El reintento de T-434 lleva una semana entera reparando sesiones sin perfil. El atasco ` +
      `inicial (235 usuarios el 01/08/2026) debería haberse drenado ya, así que si sigue ` +
      `curando a diario es que SIGUEN NACIENDO ROTOS y el reintento está tapando el goteo.\n\n` +
      `Mira auth_alta_sin_perfil en la misma ventana: ahí está el motivo del fallo original.\n\n` +
      `Ficha: T-434.`,
    metadata: { dias: rows[0]?.dias ?? 0, usuarios: rows[0]?.usuarios ?? 0 },
    fingerprint: 'perfil_roto_no_drena',
  }),
  cooldownMin: 1440,
};

/**
 * [T-434] EL REINTENTO SE ROMPIÓ — no «no encontró perfil», sino que reventó.
 *
 * El reintento vive en el callback `jwt`, o sea en **cada carga de página de cada usuario**. Va
 * envuelto en `try` justo para que un fallo suyo no tumbe la sesión de nadie: si algo revienta,
 * la persona se queda como estaba (rota, pero dentro) y esta señal es lo único que lo cuenta.
 *
 * Es decir: **el guardarraíl que impide el desastre también lo vuelve silencioso**, y por eso la
 * alerta no es opcional. Sin ella, el reintento podría estar sin funcionar semanas mientras el
 * canario dice «0 curaciones» y alguien concluye que no hay nadie a quien curar.
 *
 * Dispara a la PRIMERA y es de infraestructura, no de usuario: BD sin configurar en el deploy,
 * o un fallo inesperado. Nace en cero.
 */
export const RULE_REINTENTO_PERFIL_ROTO: AlertRule<{ veces: number; muestra: string }> = {
  name: 'reintento_perfil_roto',
  severity: 'error',
  query: sql`
    SELECT COUNT(*)::int AS veces,
           COALESCE(MAX(metadata->>'detalle'), '') AS muestra
      FROM observable_events
     WHERE event_type = 'auth_reintento_roto'
       AND coalesce(metadata->>'simulacion', 'false') <> 'true'
       AND ts >= now() - interval '24 hours'
  `,
  shouldFire: (rows) => (rows[0]?.veces ?? 0) > 0,
  buildNotification: (rows) => ({
    title: `El reintento de perfil REVENTÓ ${rows[0]?.veces ?? 0} vez/veces en 24 h`,
    body:
      `No es «no se encontró el perfil»: es que el propio reintento lanzó una excepción. Está ` +
      `envuelto en try para no tumbar la sesión, así que el usuario sigue entrando —roto— y ` +
      `esto es lo ÚNICO que lo delata.\n\n` +
      `Ojo con leer el canario mientras esto suena: diría «0 curaciones», que se parece mucho a ` +
      `«no hay nadie a quien curar» y significa lo contrario.\n\n` +
      `Se investiga en la INFRAESTRUCTURA (¿DATABASE_URL en el deploy? ¿pool agotado?), no en el ` +
      `usuario. Detalle: ${rows[0]?.muestra || '(sin detalle)'}\n\n` +
      `Ficha: T-434.`,
    metadata: { veces: rows[0]?.veces ?? 0, muestra: rows[0]?.muestra ?? '' },
    fingerprint: 'reintento_perfil_roto',
  }),
  cooldownMin: 720,
};

/**
 * [T-327] SE PIERDE UN TEMARIO QUE ALGUIEN ACABA DE ARMAR.
 *
 * Guardar una oposición personalizada es el final de un trabajo LARGO: buscar leyes, elegir
 * artículos uno a uno y repartirlos en temas son muchos minutos. Si la escritura falla, ese
 * trabajo **no se puede recuperar** —vive solo en la pantalla— y la persona se queda sin nada
 * después de habérselo currado. Eso no se perdona: no vuelve.
 *
 * Y no hay forma de que nos enteremos por otro lado. No es un 5xx de una ruta que alguien vigile
 * (la petición responde 500 pero el usuario no siempre escribe), ni deja rastro en `topic_scope`
 * —justamente porque la transacción se revierte entera—. Sin esta señal, el fallo es invisible.
 *
 * Dispara a la PRIMERA a propósito: no es un umbral de volumen, es que **una sola pérdida ya es
 * un usuario perdido**. Se investiga en la BD (¿restricción nueva en `topics`? ¿un `law_id` que
 * ya no existe?), no en el usuario.
 */
export const RULE_TEMARIO_PROPIO_PERDIDO: AlertRule<{
  veces: number
  detalle: string
  ultima: Date | string | null
}> = {
  name: 'temario_propio_perdido',
  severity: 'error',
  // `ultima` (MAX(ts)) NO es adorno: la ventana es de 24 h, así que una pérdida ya
  // ARREGLADA hace horas se sigue anunciando como si estuviera pasando ahora. El 02/08
  // costó media hora reconstruir a mano que la pérdida (13:47) era anterior al arreglo
  // (15:56 del mismo día, commit d6bb20af0) — el aviso no daba ni la hora. Con el sello
  // temporal, comparar contra el último deploy es inmediato.
  query: sql`
    SELECT COUNT(*)::int AS veces,
           COALESCE(MAX(metadata->>'detalle'), '') AS detalle,
           MAX(ts) AS ultima
      FROM observable_events
     WHERE event_type = 'oposicion_personalizada_no_guardada'
       AND coalesce(metadata->>'simulacion', 'false') <> 'true'
       AND ts >= now() - interval '24 hours'
  `,
  shouldFire: (rows) => (rows[0]?.veces ?? 0) > 0,
  buildNotification: (rows) => ({
    title:
      `${rows[0]?.veces ?? 0} temario(s) propios PERDIDOS al guardar en 24 h` +
      (rows[0]?.ultima ? ` (última: ${new Date(rows[0]!.ultima!).toISOString()})` : ''),
    body:
      `Alguien armó su oposición entera (buscar leyes, elegir artículos, repartirlos en temas) y ` +
      `al guardar se perdió. Ese trabajo vivía solo en su pantalla: no se puede recuperar ni ` +
      `reconstruir desde la BD, porque la transacción se revierte entera.\n\n` +
      `Se investiga en la BASE DE DATOS, no en el usuario: ¿una restricción nueva en topics o ` +
      `topic_scope? ¿un law_id que ya no existe? Reproduce con: npm run sim:oposicion-personalizada\n\n` +
      `⏱ Última pérdida: ${rows[0]?.ultima ? new Date(rows[0]!.ultima!).toISOString() : '(sin fecha)'}. ` +
      `COMPARA esa hora con el último deploy antes de investigar: la ventana es de 24 h, así que ` +
      `una pérdida ya arreglada se sigue anunciando hasta que caduca.\n\n` +
      `Detalle: ${rows[0]?.detalle || '(sin detalle)'}\n\nFicha: T-327.`,
    metadata: {
      veces: rows[0]?.veces ?? 0,
      detalle: rows[0]?.detalle ?? '',
      ultima: rows[0]?.ultima ? new Date(rows[0]!.ultima!).toISOString() : null,
    },
    fingerprint: 'temario_propio_perdido',
  }),
  cooldownMin: 720,
};

/**
 * El barrido de rutas encontró una página ROTA. (T-487, 02/08/2026)
 *
 * ── Por qué hace falta la regla, y no basta con emitir ──────────────────────────────────────
 * Vence Sim ya escribía en `observable_events` desde que existe… y **ninguna regla miraba sus
 * eventos**: `sim_journey_result` no aparecía ni aquí ni en las señales benignas. O sea que una
 * simulación podía estar en rojo y el único sitio donde se veía era la terminal de quien la
 * ejecutó. El catch-all (`senal_error_sin_vigilancia`) tampoco lo cubría: exige 150 del mismo
 * tipo en una hora, y una pasada del barrido produce unidades.
 *
 * Una comprobación continua cuyo resultado no llega a Salud del sistema no es una comprobación:
 * es una anécdota. Mismo modo de fallo que el gate de creación de oposiciones, que revisaba diez
 * fases y no escribía una sola fila (T-455).
 *
 * ── Qué dispara, y qué NO ───────────────────────────────────────────────────────────────────
 * Solo `error`, o sea rutas ROTAS: 5xx, la pantalla de error de la app, un 200 que no pinta nada,
 * o una subpetición con 5xx. Las `sospechosas` (404 en una ruta que existe, hidratación, consola)
 * entran en el bus como `warn` y se leen en el panel — meterlas aquí llenaría el correo de cosas
 * que hay que mirar sin prisa, y un aviso que grita se deja de leer.
 *
 * El PUNTO CIEGO va destacado a propósito: una ruta rota que además no generó ni una señal
 * significa que, sin este barrido, nos habríamos enterado por un usuario.
 */
export const RULE_SIM_RUTA_ROTA: AlertRule<{
  rutas: number
  ciegas: number
  muestra: string
  motivo: string
  ultima: Date | string | null
}> = {
  name: 'sim_ruta_rota',
  severity: 'error',
  query: sql`
    SELECT COUNT(DISTINCT endpoint)::int AS rutas,
           COUNT(DISTINCT endpoint) FILTER (WHERE (metadata->>'puntoCiego')::boolean)::int AS ciegas,
           COALESCE(MIN(endpoint), '') AS muestra,
           COALESCE(MIN(error_message), '') AS motivo,
           MAX(ts) AS ultima
      FROM observable_events
     WHERE event_type = 'sim_ruta_rota'
       AND severity = 'error'
       AND ts >= now() - interval '6 hours'
  `,
  shouldFire: (rows) => (rows[0]?.rutas ?? 0) > 0,
  buildNotification: (rows) => {
    const r = rows[0];
    return {
      title: `${r?.rutas ?? 0} ruta(s) ROTAS en el barrido${(r?.ciegas ?? 0) > 0 ? ` · ${r!.ciegas} sin señal propia` : ''}`,
      body:
        `El barrido de rutas recorre la app como un usuario y ha encontrado páginas que no se ` +
        `pueden usar (5xx, pantalla de error, o un 200 que no pinta nada).\n\n` +
        `Ejemplo: ${r?.muestra || '(sin ruta)'} — ${r?.motivo || '(sin motivo)'}\n` +
        `Última: ${r?.ultima ? new Date(r.ultima).toISOString() : '(sin fecha)'}\n\n` +
        ((r?.ciegas ?? 0) > 0
          ? `⚠️  ${r!.ciegas} de ellas NO generaron ninguna señal de observabilidad: son PUNTOS ` +
            `CIEGOS. Sin este barrido nos habríamos enterado por un usuario, y eso es un fallo ` +
            `de la observabilidad además del de la página.\n\n`
          : '') +
        `Reproducir una ruta concreta:  npm run sim:rutas -- --presupuesto 5\n` +
        `Ver todas las de la ventana (incluidas las «sospechosas», que no disparan correo):\n\n` +
        `  SELECT ts, severity, endpoint, error_message FROM observable_events\n` +
        `   WHERE event_type='sim_ruta_rota' AND ts > now() - interval '6 hours' ORDER BY ts DESC;\n\n` +
        `Runbook: docs/runbooks/vence-sim.md (sección «Barrido continuo de rutas»). Ficha: T-487.`,
      metadata: {
        rutas: r?.rutas ?? 0,
        ciegas: r?.ciegas ?? 0,
        muestra: r?.muestra ?? '',
        ultima: r?.ultima ? new Date(r.ultima).toISOString() : null,
      },
      fingerprint: `sim_ruta_rota:${r?.muestra ?? 'na'}`,
    };
  },
  cooldownMin: 360,
};


/**
 * Un JOURNEY de Vence Sim ha fallado. (T-491, 03/08/2026)
 *
 * ── EL HUECO, que llevaba abierto desde que existe Vence Sim ────────────────────────────────
 * `lib/sim/report.ts` construye este evento con severidad `error` cuando cae un journey
 * `critical`/`high`, y lo emite desde el primer día. Pero `sim_journey_result` **no aparecía en
 * ninguna regla ni en las señales benignas**: nadie lo miraba y nadie lo había declarado ruido.
 *
 * El catch-all tampoco lo cubría: `senal_error_sin_vigilancia` exige **150 eventos del mismo tipo
 * en una hora**, y una corrida de Vence Sim produce unidades. Así que un journey en rojo se veía
 * en la tarjeta «Todas las señales (24h)» si alguien entraba a mirarla, y no avisaba a nadie.
 *
 * ── DÓNDE DUELE ────────────────────────────────────────────────────────────────────────────
 * Los journeys marcados `postDeploy: true` corren **en cada despliegue**. Si uno se pone rojo
 * justo después de publicar, el aviso moría en el log del deploy — y esa es precisamente la clase
 * de fallo (pintado, oclusión, un control que no recibe el clic) que solo ve un navegador.
 *
 * ── VENTANA CORTA A PROPÓSITO ──────────────────────────────────────────────────────────────
 * 3 horas, no 24: estos journeys corren atados a un deploy o a alguien reproduciendo un bug, así
 * que un fallo viejo ya no dice nada del estado actual y solo serviría para repetir un aviso ya
 * atendido — el defecto que a `temario_propio_perdido` hubo que corregirle con la hora delante.
 */
export const RULE_SIM_JOURNEY_FALLIDO: AlertRule<{
  journeys: number
  corridas: number
  muestra: string
  invariante: string
  ultima: Date | string | null
}> = {
  name: 'sim_journey_fallido',
  severity: 'error',
  query: sql`
    SELECT COUNT(DISTINCT metadata->>'journey')::int AS journeys,
           COUNT(*)::int AS corridas,
           COALESCE(MIN(metadata->>'journey'), '') AS muestra,
           COALESCE(MIN(metadata->>'firstFailure'), '') AS invariante,
           MAX(ts) AS ultima
      FROM observable_events
     WHERE event_type = 'sim_journey_result'
       AND severity = 'error'
       AND ts >= now() - interval '3 hours'
  `,
  shouldFire: (rows) => (rows[0]?.journeys ?? 0) > 0,
  buildNotification: (rows) => {
    const r = rows[0];
    return {
      title: `${r?.journeys ?? 0} journey(s) de Vence Sim en ROJO: ${r?.muestra || '?'}`,
      body:
        `Un escenario de usuario reproducible ha dejado de pasar. Estos journeys corren en cada ` +
        `despliegue (los marcados postDeploy), así que lo primero es mirar si acaba de publicarse algo.\n\n` +
        `Journey: ${r?.muestra || '(sin nombre)'}\n` +
        `Invariante que cayó: ${r?.invariante || '(sin detalle)'}\n` +
        `Corridas fallidas en 3 h: ${r?.corridas ?? 0}\n` +
        `Última: ${r?.ultima ? new Date(r.ultima).toISOString() : '(sin fecha)'}\n\n` +
        `Reproducir en local, con navegador y capturas por paso:\n\n` +
        `  npm run sim -- ${r?.muestra || '<journey>'}\n\n` +
        `Ver todas las de la ventana:\n\n` +
        `  SELECT ts, endpoint, error_message, metadata->>'failedInvariants' AS fallaron\n` +
        `   FROM observable_events WHERE event_type='sim_journey_result' AND severity='error'\n` +
        `   AND ts > now() - interval '6 hours' ORDER BY ts DESC;\n\n` +
        `Un rojo puede ser del entorno (contenedor frío, límite de peticiones): si se repite en dos ` +
        `corridas seguidas, es del app. Runbook: docs/runbooks/vence-sim.md. Ficha: T-491.`,
      metadata: {
        journeys: r?.journeys ?? 0,
        corridas: r?.corridas ?? 0,
        journey: r?.muestra ?? '',
        ultima: r?.ultima ? new Date(r.ultima).toISOString() : null,
      },
      fingerprint: `sim_journey_fallido:${r?.muestra ?? 'na'}`,
    };
  },
  cooldownMin: 180,
};


/**
 * Un TRABAJADOR de la flota está arrancado y latiendo pero NO PUEDE trabajar. (T-486)
 *
 * El latido demuestra que la máquina vive y alcanza la base de datos — es node hablando con
 * Postgres. No demuestra nada sobre Claude Code, que puede llevar horas parado en la pantalla de
 * login mientras el panel lo pinta 🟢.
 *
 * Pasó en el primer arranque real de la flota (05/08): los dos trabajadores latiendo, con rol y
 * preflight en verde, y ninguno autenticado. Sin esta regla, un trabajador puede quedarse así
 * indefinidamente: ocupa su sitio en el reparto, no coge tareas, y lo único que se ve por fuera es
 * que «no está haciendo nada» — indistinguible de estar entre tareas.
 *
 * Dispara con UNO: no es un blip. O tiene credencial o no la tiene.
 */
export const RULE_FLOTA_AUTENTICACION: AlertRule<{
  n: number;
  trabajadores: string | null;
  ultimoEstado: string | null;
}> = {
  name: 'flota_autenticacion',
  severity: 'critical',
  query: sql`
    SELECT COUNT(*)::int AS n,
           STRING_AGG(DISTINCT metadata->>'trabajador', ', ') AS trabajadores,
           (ARRAY_AGG(metadata->>'estado' ORDER BY created_at DESC))[1] AS "ultimoEstado"
    FROM observable_events
    WHERE event_type = 'flota_autenticacion'
      AND severity = 'error'
      AND created_at > NOW() - INTERVAL '60 minutes'
  `,
  shouldFire: (rows) => (rows[0]?.n ?? 0) >= 1,
  buildNotification: (rows) => {
    const r = rows[0];
    return {
      title: `🔑 Flota: ${r.trabajadores ?? '?'} no puede trabajar (${r.ultimoEstado})`,
      body:
        `Uno o más trabajadores de la flota están arrancados y latiendo pero NO pueden usar Claude Code.\n\n` +
        `Estado: ${r.ultimoEstado}\n` +
        `Trabajadores: ${r.trabajadores ?? '(n/a)'}\n\n` +
        `Si es "token_invalido", hay que acuñar otro con "claude setup-token" (el bueno empieza por ` +
        `sk-ant-oat01-) y volver a correr scripts/flota/arrancar-trabajador.sh, que es idempotente.\n` +
        `Diagnóstico completo: npm run flota -- --probar`,
      metadata: { count: r.n, trabajadores: r.trabajadores, estado: r.ultimoEstado },
      fingerprint: 'flota_autenticacion',
    };
  },
  cooldownMin: 120,
};

// ────────────────────────────────────────────────────────────────
// LEY SIN RESOLVER (T-559, 2026-08-05)
//
// `test_questions.law_name` guardaba el literal 'unknown' cuando el cliente no mandaba la
// ley. Un relleno así no es un hueco: es un dato que MIENTE, y aguas abajo el sistema lo
// trataba como una ley más — la notificación de artículos problemáticos publicaba
// «2 Artículos Problemáticos: unknown», su botón de teoría llevaba a /teoria/unknown (404)
// y su test intensivo acababa sirviendo otra materia.
//
// 15.109 filas, 253 usuarios, **seis meses, CERO eventos**. Lo destapó una usuaria
// escribiendo a soporte. Esta regla existe para que la próxima vez lo diga la máquina.
//
// Vigila las DOS señales que estrena el arreglo, porque su remedio es el mismo (ir al
// escritor) y separarlas en dos reglas solo repartiría el mismo hecho en dos correos:
//   · `law_name_sin_resolver`         — un escritor tenía `article_id` y aun así no sacó la
//     ley. Por construcción debería ser ~0: si sube, hay artículos huérfanos, una ley
//     borrada o el lookup caído.
//   · `notificacion_ley_no_resoluble` — el escudo tuvo que DESCARTAR tarjetas. Tras el
//     backfill debe ser 0; si repunta, es que algún escritor volvió a rellenar.
//
// Umbral por USUARIOS distintos y no por eventos: un usuario haciendo un test de 40
// preguntas puede generar 40 eventos del mismo defecto y eso es UN caso, no cuarenta.
// ────────────────────────────────────────────────────────────────

export interface LeySinResolverRow {
  eventType: string;
  eventos: number;
  usuarios: number;
}

/** Usuarios distintos afectados en 24 h a partir de los cuales esto es un defecto y no un blip. */
export const LEY_SIN_RESOLVER_MIN_USUARIOS = 3;

export const RULE_LEY_SIN_RESOLVER: AlertRule<LeySinResolverRow> = {
  name: 'ley_sin_resolver',
  severity: 'warn',
  query: sql`
    SELECT event_type AS "eventType",
           COUNT(*)::int AS eventos,
           COUNT(DISTINCT user_id)::int AS usuarios
    FROM observable_events
    WHERE event_type IN ('law_name_sin_resolver', 'notificacion_ley_no_resoluble')
      AND ts > NOW() - INTERVAL '24 hours'
    GROUP BY event_type
  `,
  shouldFire: (rows) =>
    rows.some((r) => r.usuarios >= LEY_SIN_RESOLVER_MIN_USUARIOS),
  buildNotification: (rows) => {
    const afectadas = rows.filter(
      (r) => r.usuarios >= LEY_SIN_RESOLVER_MIN_USUARIOS,
    );
    return {
      title: `Ley sin resolver en ${afectadas.length} superficie(s)`,
      body:
        afectadas
          .map(
            (r) =>
              `  - ${r.eventType}: ${r.eventos} evento(s), ${r.usuarios} usuario(s) en 24 h`,
          )
          .join('\n') +
        `\n\nQué mirar: quién escribe \`test_questions.law_name\` sin pasar por ` +
        `\`decidirLawNamePersistida\` (lib/laws/lawNameResuelta + su copia del backend). ` +
        `Regresión de T-559.`,
      metadata: {
        tipos: afectadas.map((r) => `${r.eventType}:${r.usuarios}`).join(','),
      },
    };
  },
  cooldownMin: 720, // 12 h: no es una avería que haya que atender al minuto
};

// ────────────────────────────────────────────────────────────────
// TRINQUETE: nadie vuelve a ESCRIBIR un relleno por ley (T-559)
//
// La regla de arriba mira los EVENTOS que emiten los escritores. Esta mira la TABLA.
// No es redundancia: son dos instrumentos con modos de fallo distintos, y el que importa
// es el segundo. Si mañana aparece un escritor NUEVO que no pasa por el núcleo —otro
// gemelo, un backfill a mano, una migración— no emitirá nada, la regla de eventos seguirá
// en silencio y ese silencio se leería como salud. Que es exactamente cómo este defecto
// sobrevivió seis meses.
//
// Se comprueba el INVARIANTE donde vive el daño: ninguna fila escrita en las últimas 24 h
// puede tener un relleno por `law_name`. Después del arreglo + backfill esto es 0 por
// construcción, así que cualquier fila es una regresión demostrable, no una cuestión de umbral.
//
// No se monta como módulo de canario aparte a propósito: el motor de alertas ya corre SQL
// contra RDS cada ciclo, y añadir un @Cron nuevo para una consulta sería un mecanismo en
// paralelo al que ya juzga invariantes.
//
// La lista de rellenos está replicada en SQL (aquí y en el backfill) porque el filtro tiene
// que correr dentro de la consulta; `__tests__/guardrails/lawNameResueltaParidad.test.ts`
// vigila que el criterio no diverja del núcleo.
// ────────────────────────────────────────────────────────────────

export interface LawNameRellenoRow {
  filas: number;
  usuarios: number;
  ejemploArticleId: string | null;
}

export const RULE_LAW_NAME_RELLENO_ESCRITO: AlertRule<LawNameRellenoRow> = {
  name: 'law_name_relleno_escrito',
  severity: 'error',
  query: sql`
    SELECT COUNT(*)::int                       AS filas,
           COUNT(DISTINCT user_id)::int        AS usuarios,
           MAX(article_id::text)               AS "ejemploArticleId"
    FROM test_questions
    WHERE created_at > NOW() - INTERVAL '24 hours'
      AND lower(btrim(law_name)) IN ('unknown', 'undefined', 'null', 'nan')
  `,
  // Cero tolerancia: tras el arreglo esto no puede pasar ni una vez.
  shouldFire: (rows) => (rows[0]?.filas ?? 0) > 0,
  buildNotification: (rows) => {
    const r = rows[0];
    return {
      title: `Alguien volvió a escribir una ley de relleno (${r.filas} fila(s))`,
      body:
        `${r.filas} fila(s) de test_questions escritas en las últimas 24 h llevan un relleno ` +
        `por law_name, afectando a ${r.usuarios} usuario(s).\n\n` +
        `Esto debería ser IMPOSIBLE desde T-559: todo escritor pasa por ` +
        `\`decidirLawNamePersistida\`. Que haya filas significa que hay un escritor nuevo ` +
        `saltándoselo (otro gemelo, un backfill a mano, una migración).\n\n` +
        `Ejemplo de article_id afectado: ${r.ejemploArticleId ?? '(sin artículo)'}\n` +
        `Reparar con: node scripts/calidad/backfill-law-name-unknown.cjs --apply`,
      metadata: { filas: r.filas, usuarios: r.usuarios },
    };
  },
  cooldownMin: 720,
};

export const ALERT_RULES: AlertRule[] = [
  // Trinquete de T-559: la tabla no puede volver a tener una ley de relleno. Mira la BD y no
  // los eventos a propósito — un escritor nuevo que se salte el núcleo tampoco emitiría.
  RULE_LAW_NAME_RELLENO_ESCRITO as AlertRule,
  // Ley sin resolver (2026-08-05, T-559): el escritor guardaba una ley inventada y
  // NINGUNA regla lo miraba — 15.109 filas y 253 usuarios en seis meses de silencio.
  RULE_LEY_SIN_RESOLVER as AlertRule,
  // El barrido de rutas encontró una página que un usuario no puede usar (T-487). Vence Sim
  // emitía desde siempre y NINGUNA regla miraba sus eventos: el resultado moría en la terminal.
  // Un trabajador de la flota latiendo pero sin poder autenticar (T-486): el latido no puede
  // verlo, porque es node hablando con Postgres y eso funciona igual con la sesión en el login.
  RULE_FLOTA_AUTENTICACION as AlertRule,
  RULE_SIM_RUTA_ROTA as AlertRule,
  // Y el evento VIEJO de Vence Sim, sin vigilancia desde que existe el harness (T-491): el
  // catch-all tampoco lo cubría, porque exige 150 del mismo tipo en una hora.
  RULE_SIM_JOURNEY_FALLIDO as AlertRule,
  // Campaña de email que no envió a nadie teniendo a quien (2026-08-01, T-448). El hueco existía
  // desde antes: `renewal_reminders_zero_sent` se emitía y NINGUNA regla lo miraba.
  RULE_CAMPANA_EMAIL_ZERO_SENT as AlertRule,
  // Barrido de precios de fidelidad abortado por el tope (2026-08-01, T-448).
  RULE_ANULACION_PRECIO_ABORTADA as AlertRule,
  // Ficha de tarea viva borrada de main (2026-07-31, T-427): el contexto de trabajo se destruye en
  // silencio al resolver conflictos, y las dos veces que pasó se descubrió por casualidad.
  RULE_BACKLOG_FICHA_BORRADA,
  // Fuente legal cambiada (2026-07-31, T-380): regla propia porque el catch-all solo ve
  // inundaciones y esto son uno o dos avisos al día.
  RULE_LAW_SOURCE_CHANGED,
  // Fraude confirmado que nadie resuelve (2026-07-30): confirmar una señal la saca del badge,
  // así que el trabajo bien hecho acababa enterrado. 20 llevaban hasta 9 días.
  RULE_FRAUDE_SIN_TRIAR as AlertRule,
  RULE_ALTA_SIN_PERFIL as AlertRule,
  RULE_SESION_SIN_EMAIL as AlertRule,
  RULE_PERFIL_ROTO_NO_DRENA as AlertRule,
  // El navegador con DOS identidades (2026-08-05, T-434): el camino del token está sano, así que
  // ninguna señal del servidor lo veía. Vigila la persistencia, no el pico del drenaje.
  RULE_IDENTIDAD_AJENA_NO_DRENA as AlertRule,
  RULE_REINTENTO_PERFIL_ROTO as AlertRule,
  RULE_TEMARIO_PROPIO_PERDIDO as AlertRule,
  // Evasión por cambio de equipo (2026-07-30): rotar dispositivos deja MÁS rastro, y aquí se
  // convierte en señal en vez de en punto ciego.
  RULE_EVASION_MULTIDISPOSITIVO as AlertRule,
  // Cobertura de IP de sesión (2026-07-30, T-314): un writer que deja de escribir no da error,
  // da silencio. 27 días sin IP y nadie se enteró.
  RULE_SESSION_IP_COVERAGE_DROP as AlertRule,
  // Enforcement por dispositivo mudo (2026-07-30, T-304): un bloqueo que no ocurre no emite
  // nada, así que el silencio hay que vigilarlo a propósito. Tres meses sin cortar.
  RULE_DEVICE_LIMIT_MUDO as AlertRule,
  RULE_HTTP_5XX_SPIKE as AlertRule,
  // Catch-all (2026-07-29): cualquier señal `error` con volumen manda email aunque
  // nadie le haya escrito una regla. Cierra el hueco estructural de "1 regla por tipo".
  RULE_SENAL_ERROR_SIN_VIGILANCIA as AlertRule,
  // Barajado de opciones (2026-07-29, tras el incidente del piloto): sin estas dos, 152
  // reglas y ninguna miraba si el barajado corrompía los resultados.
  RULE_SHUFFLE_ORDER_NOT_PERSISTED as AlertRule,
  RULE_SHUFFLE_ORDER_INVALID as AlertRule,
  // Impugnaciones perdidas en el envío (2026-07-29, caso Pilar): el usuario cree que
  // ha reportado un fallo de contenido y no ha quedado nada.
  RULE_DISPUTE_SUBMIT_FAILED as AlertRule,
  // Cupo free cobrado de más (2026-07-29, caso Sergio): el contador debe seguir a
  // las respuestas GUARDADAS, no a los eventos del cliente.
  RULE_DAILY_QUOTA_OVERCHARGE as AlertRule,
  RULE_NETWORK_RETRY_EXHAUSTED_SPIKE as AlertRule,
  RULE_LAWS_CONFIGURATOR_DEGRADED as AlertRule,
  // Flood de acuñación de token (bug caché del poll cliente, 15/07 caso Natalia)
  RULE_AUTH_TOKEN_MINT_FLOOD as AlertRule,
  // Su hermano FINO Y ANCHO (28/07, T-210): pocas acuñaciones por usuario pero
  // repartidas entre cientos → 45 reales/usuario/hora con TTL de 1 h, invisibles
  // para el umbral por-usuario de la regla de arriba.
  RULE_AUTH_TOKEN_MINT_WASTE as AlertRule,
  // Tests bloqueados por rechazo de validación (2026-07-11, incidente Alfonso)
  RULE_FILTERED_VALIDATION_REJECTED_SPIKE as AlertRule,
  // Errores de cliente in-house (2026-07-05, tras retirar Sentry)
  RULE_CLIENT_ERROR_SPIKE as AlertRule,
  RULE_CLIENT_HTTP_4XX_SPIKE as AlertRule,
  // Su hermano SILENCIOSO (2026-07-30, caso Rocío): un 405 significa que nuestro front
  // llama a nuestro endpoint con un método que no existe, y basta UNO para dejar la
  // función inservible. La regla de arriba pide 30 en 15 min y nunca los ve.
  RULE_CLIENT_METHOD_NOT_ALLOWED as AlertRule,
  // Avería SIN error (2026-07-30): el endpoint de activación inmediata deja de LLAMARSE.
  // Se vigila comparando pagos contra sincronizaciones, porque el síntoma es una ausencia.
  RULE_CHECKOUT_SYNC_MUDO as AlertRule,
  // Guardado roto (reconciliación) + edge sostenido (2026-07-05, huecos del día)
  RULE_SAVE_RECONCILIATION as AlertRule,
  RULE_CLIENT_EDGE_SUSTAINED as AlertRule,
  RULE_CRON_OVERDUE as AlertRule,
  // Complemento de la anterior (2026-07-27, T-162): `cron_overdue` vigila el
  // ARRANQUE y da verde con un solo tick; ésta vigila el COMPLETADO.
  RULE_CRON_STARTED_NOT_FINISHED as AlertRule,
  // Quién vigila al vigilante (2026-07-27): una regla que revienta no vigila
  // nada, y hasta hoy eso solo se veía en los logs.
  RULE_ALERT_RULE_FAILING as AlertRule,
  RULE_DEPLOY_FAILED as AlertRule,
  RULE_CRON_FAILURE_BURST as AlertRule,
  // T-307: el cron que corre y FALLA tick tras tick. `cron_failure_burst` exige 3 fallos
  // en 1 h, así que un cron diario roto no alertaba nunca (el sweep de contenido estuvo
  // dos días muerto con el panel en verde).
  RULE_CRON_SIN_EXITO as AlertRule,
  // Reglas Fase 1.6 (2026-05-26) — cierran loop de eventos nuevos
  RULE_RUNTIME_KILL as AlertRule,
  RULE_TTS_ERROR_BURST as AlertRule,
  RULE_HYDRATION_MISMATCH_SPIKE as AlertRule,
  // Latencia SOSTENIDA por endpoint de usuario (T-254): respuestas correctas que
  // llegan tarde — el indicador de 5xx no las ve y el opositor sí.
  RULE_ENDPOINT_LATENCY_SUSTAINED as AlertRule,
  RULE_WORKFLOW_FAILURE_BURST as AlertRule,
  // Un CI rojo en `main` bloquea a TODAS las sesiones (commit y deploy): avisa al primer fallo,
  // sin esperar racimo. 28/07/2026.
  RULE_MAIN_CI_ROJO as AlertRule,
  // Su hermana muda (31/07/2026, T-370): el gate de integración lleva `continue-on-error`,
  // así que su rojo NO hacía `failure()`, no emitía `workflow_failed` y `main_ci_rojo` no
  // podía verlo. Estuvo ≥5 días sin verificar nada con el panel en verde.
  RULE_CI_INTEGRACION_ROJO as AlertRule,
  // Subscription health (2026-05-26 post-incidente Andrea/Lidia)
  RULE_SUBSCRIPTION_DRIFT as AlertRule,
  RULE_WEBHOOK_UNHEALTHY as AlertRule,
  RULE_STRIPE_CHECKOUT_FAILED as AlertRule,
  // Su reverso (31/07/2026): el servidor NO se rompió, simplemente no le dejó pagar. La de
  // arriba cuenta 5xx y no ve un 403; para el negocio son la misma venta perdida.
  RULE_COBRO_BLOQUEADO_AUTH as AlertRule,
  // Cancel flow robusto (2026-05-27 post-caso Mariangeles)
  RULE_SUBSCRIPTION_VOID_FAILED as AlertRule,
  RULE_SUBSCRIPTION_FORCE_CANCEL_BURST as AlertRule,
  RULE_SUBSCRIPTION_CANCEL_ERROR_BURST as AlertRule,
  // Webhook entrante robusto (2026-05-27 post-caso Rocío/Mercedes)
  RULE_STRIPE_WEBHOOK_SIGNATURE_FAILED as AlertRule,
  RULE_STRIPE_WEBHOOK_4XX_BURST as AlertRule,
  RULE_SUBSCRIPTION_DRIFT_MISSING_IN_DB as AlertRule,
  // La dirección contraria (29/07/2026): premium que NADIE paga. Las 8 reglas de
  // suscripciones protegían al usuario; ninguna al negocio.
  RULE_PREMIUM_SIN_RESPALDO as AlertRule,
  // Gap 17 (2026-06-03 post-incidente Eva) — impugnación resuelta sin email al usuario
  RULE_DISPUTE_EMAIL_DROP as AlertRule,
  // Su gemela para el otro canal (T-501, 03/08/2026): respuesta a feedback sin email.
  // Ese lado no tenía reconciliador NI regla, así que el drop era invisible por completo.
  RULE_FEEDBACK_EMAIL_DROP as AlertRule,
  // Pareja de la anterior: aquella cubre "el email nunca se intentó";
  // ésta, "se intentó y el proveedor lo rechazó" (el hueco de T-116).
  RULE_EMAIL_SEND_FAILED as AlertRule,
  // Conversiones de venta que no llegan a Google Ads (03/06/2026, F1 trackeo-
  // conversiones-ventas) — red de seguridad ante token Ads caducado / DLQ.
  RULE_CONVERSION_DELIVERY_FAILED as AlertRule,
  // Cobertura de atribución (05/06/2026) — avisa si dejamos de capturar el canal
  // de las altas (orgánico vs ads). Detalle en v_attribution_coverage.
  RULE_ATTRIBUTION_COVERAGE_LOW as AlertRule,
  // Salud del frontend desde server-side metrics (no depende del cliente)
  RULE_TRAFFIC_DROP as AlertRule,
  // Watchdog de UI congelada (2026-05-31, cierra gap detectado en incidente 30/05)
  RULE_ANSWER_WATCHDOG_BURST as AlertRule,
  // Canary HTTP autenticado (2026-05-27, Nivel 3 sistema canary+simulaciones)
  RULE_CANARY_AUTH_FAILED as AlertRule,
  // Canary Stripe webhook sintético (2026-05-27, cierra gap incidente Rocío/Mercedes)
  RULE_CANARY_WEBHOOK_FAILED as AlertRule,
  // Canary endpoint más caliente (2026-05-27, POST /api/v2/answer-and-save)
  RULE_CANARY_ANSWER_SAVE_FAILED as AlertRule,
  RULE_CANARY_SYNTHETIC_EXTERNAL_FAILED as AlertRule,
  RULE_CANARY_SAVE_CONTRACT_FAILED as AlertRule,
  // Canarios de INFRA externa (Sprint 5, 27/05/2026) — únicos no duplicados con CI
  RULE_CANARY_DB_POOL_FAILED as AlertRule,
  RULE_CANARY_REDIS_FAILED as AlertRule,
  // Cola de pre-generación de PDFs del temario (23/07) — cierra el punto ciego que
  // dejó acumular 27 pending + 12 DLQ sin aviso (pdfQueueHealth sin consumidor).
  RULE_CANARY_PDF_QUEUE_FAILED as AlertRule,
  // Canaries que emitían _failed SIN regla (hueco cerrado 20/07, canary-framework P3)
  RULE_CANARY_AI_MODEL_FAILED as AlertRule,
  RULE_CANARY_ANSWER_PREMIUM_FAILED as AlertRule,
  RULE_CANARY_COMPETITOR_MENTION_FAILED as AlertRule,
  RULE_CANARY_POR_LEYES_SCOPE_FAILED as AlertRule,
  RULE_CANARY_PSYCHOMETRIC_INTEGRITY_FAILED as AlertRule,
  // Canary endpoint topic-data (31/05/2026, post Fase D-bis Iter 1.5)
  RULE_CANARY_TOPIC_DATA_FAILED as AlertRule,
  // Saturación del frontend (21/07/2026) — 1 aviso legible en vez del storm de N
  // canaries en timeout; firma de capacidad/lentitud (ver incidente autoscaling).
  RULE_FRONTEND_SATURATION as AlertRule,
  // Event-loop lag del frontend (T-075, 24/07) — cierra la NOTIFICACIÓN que
  // faltaba al sensor de Capa 5: avisa del precursor de la cascada de 504 (21/07).
  RULE_EVENT_LOOP_LAG as AlertRule,
  // Canary SEMÁNTICO del endpoint theme-stats (19/06/2026, post incidente V4):
  // el panel de temas refleja el progreso real (artículo→topic_scope).
  RULE_CANARY_THEME_STATS_FAILED as AlertRule,
  // Watchdog drift detector — confirma que Page Visibility fix (a4051a6b) sigue ok
  RULE_WATCHDOG_WALLCLOCK_RESIDUAL as AlertRule,
  // Pool capacity sampler (01/06/2026, Acción 2 observability-capacity):
  // leading indicators del pool DB ANTES de que se traduzcan en 5xx.
  RULE_POOL_IDLE_IN_TX_DETECTED as AlertRule,
  RULE_POOL_HUNG_CLIENTREAD_DETECTED as AlertRule,
  RULE_POOL_FRONTEND_SATURATION_HIGH as AlertRule,
  // Meta-observabilidad: vigila al vigilante (cron sampler vivo).
  RULE_POOL_SAMPLER_STALE as AlertRule,
  // Observabilidad POR INSTANCIA del self-hosted PgBouncer (lo que el health-check
  // TCP del NLB no caza): instancia que acepta TCP pero cuelga queries, y degradación.
  RULE_POOLER_INSTANCE_UNREACHABLE as AlertRule,
  RULE_POOLER_INSTANCE_DEGRADED as AlertRule,
  // Canary e2e del pipeline de stats (cobertura 24/7, cierra punto ciego off-peak)
  RULE_CANARY_STATS_PIPELINE_FAILED as AlertRule,
  // Pipeline de stats materializadas congelado (2026-06-03 post-cutover outbox a medias)
  RULE_MATERIALIZED_STATS_STALE as AlertRule,
  // Pipeline de stats escribe valores incorrectos (paridad en vivo uqh_v2 vs test_questions)
  RULE_STATS_PARIDAD_DIVERGENCE as AlertRule,
  // Paridad de user_daily_stats (del que ahora depende el leaderboard, migración 25/06)
  RULE_USER_DAILY_STATS_PARIDAD as AlertRule,
  // Integridad de exámenes (08/06/2026 post-caso Rosa) — exámenes is_completed
  // con filas test_questions perdidas (pérdida silenciosa de datos por-pregunta).
  RULE_EXAM_INTEGRITY_DRIFT as AlertRule,
  // Anti-scraping: barrido masivo del banco de preguntas (02/06/2026, caso Ana
  // Fernández "scrape & refund"). Premium no tiene límite diario → única red.
  RULE_SCRAPING_SWEEP as AlertRule,
  // Canary post-deploy del gate anti-scraping: que NO bloquee a usuarios normales.
  RULE_CANARY_QUESTIONS_GATE_FAILED as AlertRule,
  // Su gemelo para la política de identidad en los pagos (31/07/2026).
  RULE_CANARY_IDENTIDAD_PAGO_FAILED as AlertRule,
  // Meta-observabilidad: guardarraíl anti-flood del log de errores (11/07/2026,
  // tras el flood de 401 anónimos que tumbó el panel admin). Auto-detecta el
  // próximo bucket que inunde validation_error_logs antes de que sea un problema.
  RULE_VALIDATION_LOG_FLOOD as AlertRule,
  // RULE_AUTH_MINT_DROP retirada 21/07/2026 (premisa de volumen muerta tras el fix de
  // caché del token; sucesor = RULE_CANARY_AUTH_FAILED). Ver nota en su antigua ubicación.
];
