#!/usr/bin/env node
/**
 * scripts/fraud-sweep.cjs — Barrido antifraude (F0: detección, READ-ONLY, no bloquea).
 *
 * Detecta abuso y escribe SEÑALES en `fraud_alerts` (status='new') → el badge de la
 * pestaña Fraudes las cuenta y Claude las revisa con el runbook `revisar-fraudes.md`.
 * NO bloquea ni limita a nadie: solo detecta y alerta (el enforcement es fase 1/2).
 *
 * Detectores (todos parametrizables por env):
 *   - multi_account_device   : ≥N cuentas distintas en un mismo dispositivo (farmeo/sharing)
 *   - multi_account_reg_ip    : ≥N cuentas desde una IP (excl. CDN/proxy; exige device compartido o ≥20 = granja)
 *   - device_daily_farming    : un dispositivo suma > umbral preguntas/día across cuentas
 *   - curl_scraping / harvest_* : COSECHA — servidas >> respondidas (lib/security/harvestSignals.js)
 *   - premium_sharing         : dispositivo compartido que incluye premium + ≥2 cuentas activas
 *
 * Dedup: `match_criteria = kind:subject`. Si ya hay una señal 'new' del mismo sujeto se
 * REFRESCA (no duplica); si ya fue revisada/descartada hace <REVIEW_TTL, se OMITE.
 *
 * Uso:  DATABASE_URL=... node scripts/fraud-sweep.cjs [--dry]
 * Env:  FRAUD_DEVICE_ACCOUNTS (3), FRAUD_IP_ACCOUNTS (5), FRAUD_DEVICE_DAILY_Q (60),
 *       FRAUD_SCRAPE_MIN_SERVED (300), FRAUD_WINDOW_DAYS (30),
 *       FRAUD_REVIEW_TTL_DAYS (30)
 */
const { Client } = require('pg');
// Núcleo puro compartido con el panel admin (mismo criterio en los dos lados).
const { classifyHarvest } = require('../lib/security/harvestSignals');

const DB_URL = (process.env.DATABASE_URL || '').replace(/[?&]sslmode=require/, '');
if (!DB_URL) { console.error('❌ DATABASE_URL no configurado.'); process.exit(2); }
const DRY = process.env.DRY_RUN === '1' || process.argv.includes('--dry');

const N = (name, def) => { const v = Number(process.env[name]); return Number.isFinite(v) && v > 0 ? v : def; };
const DEVICE_ACCOUNTS = N('FRAUD_DEVICE_ACCOUNTS', 3);
const IP_ACCOUNTS     = N('FRAUD_IP_ACCOUNTS', 5);
const DEVICE_DAILY_Q  = N('FRAUD_DEVICE_DAILY_Q', 60);
// Volumen mínimo de preguntas SERVIDAS para que el ratio respondidas/servidas
// signifique algo. Sustituye a FRAUD_SCRAPE_MIN_Q/MAX_PV, que medían respuestas
// guardadas y por eso eran ciegos a la cosecha (ver D4).
const SCRAPE_MIN_SERVED = N('FRAUD_SCRAPE_MIN_SERVED', 300);
const WINDOW_DAYS     = N('FRAUD_WINDOW_DAYS', 30);
const REVIEW_TTL_DAYS = N('FRAUD_REVIEW_TTL_DAYS', 30);

const sevFor = (kind, n) => {
  if (kind === 'curl_scraping') return 'critical';
  if (kind === 'multi_account_device') return n >= 6 ? 'critical' : 'high';
  if (kind === 'multi_account_reg_ip') return n >= 10 ? 'critical' : 'high';
  if (kind === 'device_daily_farming') return 'high';
  if (kind === 'premium_sharing') return 'high';
  return 'medium';
};

async function upsertSignal(c, { kind, subject, userIds, details, n, severityOverride }) {
  const match = `${kind}:${subject}`;
  // severityOverride: los detectores con núcleo puro (cosecha) ya deciden la
  // gravedad con más contexto del que tiene sevFor (ratio, navegador, huella).
  const severity = severityOverride || sevFor(kind, n);
  // ¿ya adjudicada (revisada/descartada) hace poco? → no re-levantar
  const adj = await c.query(
    `SELECT id FROM fraud_alerts WHERE match_criteria=$1 AND status IN ('reviewed','dismissed','confirmed')
       AND coalesce(reviewed_at, detected_at) > now() - ($2||' days')::interval LIMIT 1`,
    [match, String(REVIEW_TTL_DAYS)]
  );
  if (adj.rows.length) return 'skipped_adjudicated';
  // ¿ya hay una 'new' del mismo sujeto? → refrescar
  const cur = await c.query(`SELECT id FROM fraud_alerts WHERE match_criteria=$1 AND status='new' LIMIT 1`, [match]);
  if (cur.rows.length) {
    if (!DRY) await c.query(
      `UPDATE fraud_alerts SET details=$2, severity=$3, user_ids=$4, detected_at=now() WHERE id=$1`,
      [cur.rows[0].id, details, severity, userIds]
    );
    return 'refreshed';
  }
  if (!DRY) await c.query(
    `INSERT INTO fraud_alerts (alert_type, severity, status, user_ids, details, match_criteria, detected_at)
     VALUES ($1,$2,'new',$3,$4,$5,now())`,
    [kind, severity, userIds, details, match]
  );
  return 'inserted';
}

async function main() {
  const c = new Client({ connectionString: DB_URL, ssl: { rejectUnauthorized: false }, statement_timeout: 90000 });
  await c.connect();
  const tally = {};
  const bump = (r) => { tally[r] = (tally[r] || 0) + 1; };
  let found = 0;

  // ── D1: multi_account_device ──────────────────────────────────────────────
  const d1 = await c.query(
    `SELECT device_id, count(DISTINCT user_id) accounts, array_agg(DISTINCT user_id) users, max(last_seen_at) last_seen
     FROM user_devices WHERE last_seen_at >= now() - ($1||' days')::interval
     GROUP BY device_id HAVING count(DISTINCT user_id) >= $2`, [String(WINDOW_DAYS), DEVICE_ACCOUNTS]);
  for (const r of d1.rows) {
    found++;
    const emails = (await c.query(`SELECT email, plan_type, created_at::date FROM user_profiles WHERE id = ANY($1) ORDER BY created_at`, [r.users])).rows;
    bump(await upsertSignal(c, { kind: 'multi_account_device', subject: r.device_id, userIds: r.users, n: Number(r.accounts),
      details: { device_id: r.device_id, accounts: Number(r.accounts), last_seen: r.last_seen, emails: emails.map(e => e.email), plans: emails.map(e => e.plan_type), same_day_signups: emails.length && emails.every(e => String(e.created_at) === String(emails[0].created_at)) } }));
  }

  // ── D2: multi_account_reg_ip ──────────────────────────────────────────────
  // Afinado (falsos positivos 21/07): (1) excluye rangos CDN/proxy (Cloudflare) — la IP
  // capturada es la del proxy, no del usuario; (2) exige CORRELACIÓN DE DISPOSITIVO — una
  // IP solo cuenta si ≥2 de sus cuentas comparten dispositivo (firma de granja real; el
  // CGNAT/red compartida NO comparte device), con escape para lo EGREGIO (≥20 cuentas).
  const CDN_RANGES = `ARRAY['173.245.48.0/20','103.21.244.0/22','103.22.200.0/22','103.31.4.0/22','141.101.64.0/18','108.162.192.0/18','190.93.240.0/20','188.114.96.0/20','197.234.240.0/22','198.41.128.0/17','162.158.0.0/15','104.16.0.0/12','172.64.0.0/13','131.0.72.0/22']::inet[]`;
  const d2 = await c.query(
    `WITH ip_users AS (
       SELECT registration_ip, array_agg(id) users, count(*) accounts
       FROM user_profiles
       WHERE registration_ip ~ '^(\\d{1,3}\\.){3}\\d{1,3}$'
         AND NOT (registration_ip::inet <<= ANY(${CDN_RANGES}))
       GROUP BY registration_ip HAVING count(*) >= $1)
     SELECT iu.registration_ip, iu.accounts, iu.users
     FROM ip_users iu
     WHERE EXISTS (SELECT 1 FROM user_devices d WHERE d.user_id = ANY(iu.users)
                   GROUP BY d.device_id HAVING count(DISTINCT d.user_id) >= 2)
        OR iu.accounts >= 20
     ORDER BY iu.accounts DESC LIMIT 200`, [IP_ACCOUNTS]);
  for (const r of d2.rows) {
    found++;
    bump(await upsertSignal(c, { kind: 'multi_account_reg_ip', subject: r.registration_ip, userIds: r.users, n: Number(r.accounts),
      details: { registration_ip: r.registration_ip, accounts: Number(r.accounts) } }));
  }

  // ── D3: device_daily_farming (dispositivo con >umbral preguntas/día sumando cuentas) ──
  const d3 = await c.query(
    `WITH dev AS (
       SELECT device_id, array_agg(DISTINCT user_id) users FROM user_devices
       WHERE last_seen_at >= now() - ($1||' days')::interval
       GROUP BY device_id HAVING count(DISTINCT user_id) >= 2)
     SELECT d.device_id, d.users, max(day_q.q) max_dia
     FROM dev d
     JOIN LATERAL (
       SELECT du.usage_date, sum(du.questions_answered) q FROM daily_question_usage du
       WHERE du.user_id = ANY(d.users) AND du.usage_date >= (CURRENT_DATE - ($2)::int) GROUP BY du.usage_date
     ) day_q ON true
     GROUP BY d.device_id, d.users HAVING max(day_q.q) > $3`, [String(WINDOW_DAYS), WINDOW_DAYS, DEVICE_DAILY_Q]);
  for (const r of d3.rows) {
    found++;
    bump(await upsertSignal(c, { kind: 'device_daily_farming', subject: r.device_id, userIds: r.users, n: Number(r.max_dia),
      details: { device_id: r.device_id, accounts: r.users.length, max_questions_one_day: Number(r.max_dia), threshold: DEVICE_DAILY_Q } }));
  }

  // ── D4: COSECHA de preguntas (servidas vs respondidas) ────────────────────
  //
  // Reescrito 27/07/2026. La versión anterior medía el volumen con
  // `daily_question_usage` (respuestas GUARDADAS) y por eso era ciega al modo
  // real de scraping: cosechar no requiere responder. Medido en prod: el usuario
  // anferbar987 tuvo ese contador en 2 el 16/05/2026 mientras se le servían
  // 5.495 preguntas — y este detector NO disparó ni una vez en toda su vida.
  //
  // Ahora el volumen sale de `daily_questions_served` (rollup de SERVIDAS) y la
  // firma es el RATIO respondidas/servidas. La clasificación vive en un núcleo
  // puro y testeado compartido con el panel admin, para que los dos lados no
  // vuelvan a divergir: lib/security/harvestSignals.js.
  // Excluye las cuentas SINTÉTICAS (smoke/canary). Cargan preguntas para
  // comprobar endpoints y no las contestan nunca → ratio 0,00, que es
  // literalmente la firma de cosecha. Medido el 27/07: `smoke@vence.es` acumuló
  // 1.860 servidas / 0 respondidas en unas horas. El writer ya las exime por el
  // header `x-vence-canary`, pero esto es la SEGUNDA capa y es la que protege
  // aunque el writer no esté desplegado todavía: el sweep corre desde GitHub
  // Actions, así que un push basta para que esta exención esté viva.
  const servedRows = await c.query(
    `SELECT s.subject_key AS user_id, sum(s.served)::int AS served
       FROM daily_questions_served s
      WHERE s.subject_kind = 'user' AND s.usage_date >= CURRENT_DATE - ($1)::int
        AND NOT EXISTS (SELECT 1 FROM user_profiles up
                         WHERE up.id::text = s.subject_key AND up.email LIKE 'smoke@%')
      GROUP BY 1`, [WINDOW_DAYS]);

  // FALSO VERDE: si el rollup está vacío es que el writer no está desplegado o
  // dejó de escribir. Sin este aviso, "0 hallazgos" se leería como "no hay
  // scrapers" cuando en realidad es "no estamos mirando".
  if (!servedRows.rows.length) {
    console.warn('⚠️  daily_questions_served VACÍO en la ventana → detección de cosecha CIEGA (¿writer desplegado?)');
    tally.served_rollup_empty = 1;
    // Evento PROPIO y con severidad REAL. El heartbeat `fraud_sweep_completed` es
    // 'info', y el catch-all de /admin/salud-sistema solo cuenta error/warn: meter
    // la ceguera ahí dentro equivalía a construir la alarma y dejarla muda. Estar
    // ciego no es un dato del resumen, es una avería.
    if (!DRY) {
      await c.query(
        `INSERT INTO observable_events (source, severity, event_type, endpoint, error_message, metadata, created_at)
         VALUES ('fargate','warn','fraud_detection_blind','scripts/fraud-sweep.cjs',$1,$2,now())`,
        ['daily_questions_served sin filas en la ventana: la detección de cosecha no está midiendo',
         JSON.stringify({ detector: 'harvest', window_days: WINDOW_DAYS })]
      ).catch(e => console.warn('aviso de ceguera no registrado:', e.message));
    }
  }

  for (const r of servedRows.rows) {
    const uid = r.user_id;
    // El subject_key de un usuario es su uuid en crudo; si no lo es, no es un
    // usuario de verdad (defensa ante claves con formato inesperado).
    if (!/^[0-9a-f-]{36}$/i.test(uid)) continue;

    const meta = await c.query(
      `SELECT up.email, up.plan_type,
              -- Denominador desde test_questions, NO daily_question_usage: ese contador
              -- solo se incrementa por el camino del límite diario y los PREMIUM lo
              -- esquivan (77 premium con 5.598 respuestas y contador 0 el 27/07) →
              -- todo premium activo salía como cosechador. Ver runbook §cosecha.
              (SELECT count(*) FROM test_questions t
                WHERE t.user_id=up.id AND t.created_at > now() - ($2||' days')::interval
                  AND t.user_answer IS NOT NULL AND t.user_answer <> '' AND t.user_answer <> 'BLANK')::int AS answered,
              (SELECT count(*) FROM user_interactions ui
                WHERE ui.user_id=up.id AND ui.event_type='page_view'
                  AND ui.created_at > now() - ($2||' days')::interval)::int AS page_views,
              EXISTS (SELECT 1 FROM user_devices d WHERE d.user_id=up.id) AS has_device
         FROM user_profiles up WHERE up.id = $1::uuid`, [uid, WINDOW_DAYS]);
    if (!meta.rows.length) continue;
    const m = meta.rows[0];

    const verdict = classifyHarvest({
      served: Number(r.served),
      answered: Number(m.answered),
      pageViews: Number(m.page_views),
      hasDevice: Boolean(m.has_device),
    }, { minServed: SCRAPE_MIN_SERVED });
    if (!verdict) continue;

    found++;
    bump(await upsertSignal(c, {
      kind: verdict.kind, subject: uid, userIds: [uid], n: Number(r.served),
      severityOverride: verdict.severity,
      details: {
        user_id: uid, email: m.email, plan_type: m.plan_type,
        served: Number(r.served), answered: Number(m.answered),
        answer_ratio: Number(verdict.ratio.toFixed(4)),
        page_views: Number(m.page_views), has_device: Boolean(m.has_device),
        window_days: WINDOW_DAYS, reasons: verdict.reasons,
      },
    }));
  }

  // ── D5: premium_sharing (device compartido con premium + ≥2 activas) ──────
  const d5 = await c.query(
    `WITH dev AS (
       SELECT device_id, array_agg(DISTINCT user_id) users FROM user_devices
       WHERE last_seen_at >= now() - ($1||' days')::interval
       GROUP BY device_id HAVING count(DISTINCT user_id) >= 2)
     SELECT d.device_id, d.users,
            count(*) FILTER (WHERE up.plan_type = ANY(ARRAY['premium','premium_monthly','premium_quarterly','premium_semester','premium_annual','trial'])) premium_n
     FROM dev d JOIN user_profiles up ON up.id = ANY(d.users)
     GROUP BY d.device_id, d.users HAVING count(*) FILTER (WHERE up.plan_type LIKE 'premium%' OR up.plan_type='trial') >= 1 AND array_length(d.users,1) >= 2`,
    [String(WINDOW_DAYS)]);
  for (const r of d5.rows) {
    if (Number(r.premium_n) < 1) continue;
    found++;
    const emails = (await c.query(`SELECT email, plan_type FROM user_profiles WHERE id = ANY($1)`, [r.users])).rows;
    bump(await upsertSignal(c, { kind: 'premium_sharing', subject: r.device_id, userIds: r.users, n: r.users.length,
      details: { device_id: r.device_id, accounts: r.users.length, premium_accounts: Number(r.premium_n), emails: emails.map(e => e.email), plans: emails.map(e => e.plan_type) } }));
  }

  // ── Heartbeat / observabilidad ────────────────────────────────────────────
  const pending = (await c.query(`SELECT count(*) n FROM fraud_alerts WHERE status='new'`)).rows[0].n;
  if (!DRY) {
    await c.query(
      `INSERT INTO observable_events (source, severity, event_type, endpoint, error_message, metadata, created_at)
       VALUES ('fargate','info','fraud_sweep_completed','scripts/fraud-sweep.cjs',null,$1,now())`,
      [JSON.stringify({ found, tally, pending_total: Number(pending), thresholds: { DEVICE_ACCOUNTS, IP_ACCOUNTS, DEVICE_DAILY_Q, SCRAPE_MIN_SERVED } })]
    ).catch(e => console.warn('heartbeat warn:', e.message));
  }

  console.log(`${DRY ? '[DRY] ' : ''}✅ fraud-sweep: ${found} hallazgos · ${JSON.stringify(tally)} · pendientes(new)=${pending}`);
  await c.end();
}
main().catch(e => { console.error('❌ fraud-sweep:', e.message); process.exit(1); });
