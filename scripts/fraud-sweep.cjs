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
 *   - multi_account_reg_ip    : ≥N cuentas registradas desde una misma IP (granja)
 *   - device_daily_farming    : un dispositivo suma > umbral preguntas/día across cuentas
 *   - curl_scraping           : uso de API sin dispositivo Y sin navegador (page_views ~0) = script/curl
 *   - premium_sharing         : dispositivo compartido que incluye premium + ≥2 cuentas activas
 *
 * Dedup: `match_criteria = kind:subject`. Si ya hay una señal 'new' del mismo sujeto se
 * REFRESCA (no duplica); si ya fue revisada/descartada hace <REVIEW_TTL, se OMITE.
 *
 * Uso:  DATABASE_URL=... node scripts/fraud-sweep.cjs [--dry]
 * Env:  FRAUD_DEVICE_ACCOUNTS (3), FRAUD_IP_ACCOUNTS (5), FRAUD_DEVICE_DAILY_Q (60),
 *       FRAUD_SCRAPE_MIN_Q (30), FRAUD_SCRAPE_MAX_PV (5), FRAUD_WINDOW_DAYS (30),
 *       FRAUD_REVIEW_TTL_DAYS (30)
 */
const { Client } = require('pg');

const DB_URL = (process.env.DATABASE_URL || '').replace(/[?&]sslmode=require/, '');
if (!DB_URL) { console.error('❌ DATABASE_URL no configurado.'); process.exit(2); }
const DRY = process.env.DRY_RUN === '1' || process.argv.includes('--dry');

const N = (name, def) => { const v = Number(process.env[name]); return Number.isFinite(v) && v > 0 ? v : def; };
const DEVICE_ACCOUNTS = N('FRAUD_DEVICE_ACCOUNTS', 3);
const IP_ACCOUNTS     = N('FRAUD_IP_ACCOUNTS', 5);
const DEVICE_DAILY_Q  = N('FRAUD_DEVICE_DAILY_Q', 60);
const SCRAPE_MIN_Q    = N('FRAUD_SCRAPE_MIN_Q', 30);
const SCRAPE_MAX_PV   = N('FRAUD_SCRAPE_MAX_PV', 5);
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

async function upsertSignal(c, { kind, subject, userIds, details, n }) {
  const match = `${kind}:${subject}`;
  const severity = sevFor(kind, n);
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
  const d2 = await c.query(
    `SELECT registration_ip, count(*) accounts, array_agg(id) users
     FROM user_profiles WHERE registration_ip IS NOT NULL AND registration_ip <> ''
     GROUP BY registration_ip HAVING count(*) >= $1 ORDER BY 2 DESC LIMIT 200`, [IP_ACCOUNTS]);
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

  // ── D4: curl_scraping (uso sin dispositivo Y sin navegador) ───────────────
  const d4 = await c.query(
    `SELECT u.user_id, up.email, up.plan_type, sum(u.questions_answered) q,
            (SELECT count(*) FROM user_interactions ui WHERE ui.user_id=u.user_id AND ui.event_type='page_view' AND ui.created_at > now()-interval '14 days') page_views
     FROM daily_question_usage u JOIN user_profiles up ON up.id=u.user_id
     WHERE u.usage_date >= CURRENT_DATE - 7
       AND NOT EXISTS (SELECT 1 FROM user_devices d WHERE d.user_id=u.user_id)
     GROUP BY 1,2,3
     HAVING sum(u.questions_answered) >= $1
        AND (SELECT count(*) FROM user_interactions ui WHERE ui.user_id=u.user_id AND ui.event_type='page_view' AND ui.created_at > now()-interval '14 days') < $2`,
    [SCRAPE_MIN_Q, SCRAPE_MAX_PV]);
  for (const r of d4.rows) {
    found++;
    bump(await upsertSignal(c, { kind: 'curl_scraping', subject: r.user_id, userIds: [r.user_id], n: Number(r.q),
      details: { user_id: r.user_id, email: r.email, plan_type: r.plan_type, questions_7d: Number(r.q), page_views_14d: Number(r.page_views) } }));
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
      [JSON.stringify({ found, tally, pending_total: Number(pending), thresholds: { DEVICE_ACCOUNTS, IP_ACCOUNTS, DEVICE_DAILY_Q, SCRAPE_MIN_Q, SCRAPE_MAX_PV } })]
    ).catch(e => console.warn('heartbeat warn:', e.message));
  }

  console.log(`${DRY ? '[DRY] ' : ''}✅ fraud-sweep: ${found} hallazgos · ${JSON.stringify(tally)} · pendientes(new)=${pending}`);
  await c.end();
}
main().catch(e => { console.error('❌ fraud-sweep:', e.message); process.exit(1); });
