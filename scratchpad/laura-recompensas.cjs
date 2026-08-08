// Laura Simar: ¿por qué no le aparecieron recompensas por lo que le admitimos?
const { Client } = require('pg');
const { pgConfig } = require('../lib/db/pgSsl.cjs');
const { PAGA_RECOMPENSA } = (() => { try { return require('../lib/referrals/disputeRewardPolicy.js'); } catch { return {}; } })();

(async () => {
  const c = new Client(pgConfig(process.env.DATABASE_URL));
  await c.connect();
  const u = (await c.query("SELECT id, email, full_name, plan_type, created_at FROM user_profiles WHERE email='laurasimar@gmail.com'")).rows[0];
  console.log('USUARIA:', u.id, u.plan_type, '· alta', u.created_at.toISOString().slice(0, 10));

  console.log('\n— SUS IMPUGNACIONES —');
  const d = await c.query(`
    SELECT id, dispute_type, status, created_at, resolved_at
      FROM question_disputes WHERE user_id = $1 ORDER BY created_at`, [u.id]);
  console.table(d.rows.map((x) => ({
    id: x.id.slice(0, 8), tipo: x.dispute_type, estado: x.status,
    creada: x.created_at.toISOString().slice(0, 16),
    resuelta: x.resolved_at ? x.resolved_at.toISOString().slice(0, 16) : '-',
  })));

  console.log('\n— SUS FEEDBACKS —');
  const f = await c.query(`
    SELECT id, type, status, created_at, left(replace(message, chr(10), ' '), 70) AS msg
      FROM user_feedback WHERE user_id = $1 ORDER BY created_at`, [u.id]);
  console.table(f.rows.map((x) => ({
    id: x.id.slice(0, 8), tipo: x.type, estado: x.status,
    fecha: x.created_at.toISOString().slice(0, 16), msg: x.msg,
  })));

  console.log('\n— RECOMPENSAS QUE TIENE —');
  const r = await c.query(`
    SELECT id, type, amount, status, feedback_id, dispute_id, created_at
      FROM reward_submissions WHERE user_id = $1 ORDER BY created_at`, [u.id]);
  console.table(r.rows.length ? r.rows.map((x) => ({
    tipo: x.type, importe: x.amount, estado: x.status,
    motivo: x.dispute_id ? 'imp ' + String(x.dispute_id).slice(0, 8) : x.feedback_id ? 'fb ' + String(x.feedback_id).slice(0, 8) : '-',
    fecha: x.created_at.toISOString().slice(0, 16),
  })) : [{ '(ninguna)': '' }]);

  console.log('\n— ¿SE LE DEBÍA ALGUNA POR IMPUGNACIÓN? —');
  console.log('   (la automática existe desde el 28/07 y NO es retroactiva; solo paga tipo verificable)');
  for (const x of d.rows) {
    if (x.status !== 'resolved') continue;
    const paga = PAGA_RECOMPENSA ? PAGA_RECOMPENSA[x.dispute_type] : null;
    const resuelta = x.resolved_at;
    const posterior = resuelta && resuelta >= new Date('2026-07-28T00:00:00Z');
    const tiene = r.rows.some((z) => String(z.dispute_id) === String(x.id) && z.status !== 'rejected');
    console.log(`   ${x.id.slice(0, 8)} ${x.dispute_type.padEnd(22)} resuelta ${resuelta ? resuelta.toISOString().slice(0, 10) : '?'} · ` +
      `tipo paga: ${paga === undefined ? '?' : paga} · tras el 28/07: ${posterior} · tiene recompensa: ${tiene}` +
      `${paga && posterior && !tiene ? '   ← DEBERÍA TENERLA' : ''}`);
  }

  console.log('\n— EVENTOS de recompensa suyos —');
  const ev = await c.query(`
    SELECT event_type, ts, left(COALESCE(error_message,''), 70) AS msg, metadata
      FROM observable_events
     WHERE user_id = $1 AND (event_type LIKE 'reward%' OR event_type LIKE 'referral%')
     ORDER BY ts DESC LIMIT 15`, [u.id]);
  console.table(ev.rows.length ? ev.rows.map((x) => ({
    evento: x.event_type, cuando: new Date(x.ts).toISOString().slice(0, 16), msg: x.msg,
    meta: JSON.stringify(x.metadata ?? {}).slice(0, 60),
  })) : [{ '(ninguno)': '' }]);

  await c.end();
})().catch((e) => { console.error('ERR', e.message); process.exit(1); });
