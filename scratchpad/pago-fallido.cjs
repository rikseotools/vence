require('dotenv').config({ path: '.env.local' });
const { Client } = require('pg');
const { pgConfig } = require('../lib/db/pgSsl.cjs');
(async () => {
  const c = new Client(pgConfig(process.env.DATABASE_URL));
  await c.connect();

  console.log('=== falsas alarmas por día (14 días) ===');
  const r = await c.query(`
    SELECT to_char(e.created_at, 'DD/MM') dia,
           count(*)::int enviados,
           count(*) FILTER (WHERE s.status='active'
             AND abs(extract(epoch from (s.current_period_start - e.created_at))) < 600)::int falsas
      FROM email_events e
      JOIN user_profiles u ON u.id = e.user_id
      LEFT JOIN user_subscriptions s ON s.user_id = e.user_id
     WHERE e.email_type='pago_fallido' AND e.event_type='sent'
       AND e.created_at > now() - interval '14 days'
     GROUP BY 1, e.created_at::date ORDER BY e.created_at::date`);
  r.rows.forEach(x => console.log(`  ${x.dia}  enviados ${String(x.enviados).padStart(3)}   falsas ${String(x.falsas).padStart(3)}`));

  console.log('\n=== ¿el webhook está callando? (omisiones registradas) ===');
  const o = await c.query(`SELECT event_type, metadata->>'motivo' motivo, count(*)::int n, max(ts) ult
    FROM observable_events
   WHERE ts > now() - interval '7 days'
     AND (event_type ILIKE '%pago_fallido%' OR event_type ILIKE '%fallo_pago%' OR metadata->>'motivo' IN ('autenticacion_pendiente','ya_pagada'))
   GROUP BY 1,2 ORDER BY n DESC LIMIT 10`);
  if (!o.rows.length) console.log('  (ningún evento de omisión: o no calla nunca, o no lo registra)');
  o.rows.forEach(x => console.log(`  ${x.event_type} · ${x.motivo || '-'} → ${x.n}  ult ${x.ult.toISOString().slice(5,16)}`));

  console.log('\n=== las últimas 8 falsas, con detalle ===');
  const d = await c.query(`
    SELECT e.created_at, u.email,
           round(extract(epoch from (s.current_period_start - e.created_at)))::int desfase_s
      FROM email_events e
      JOIN user_profiles u ON u.id = e.user_id
      JOIN user_subscriptions s ON s.user_id = e.user_id
     WHERE e.email_type='pago_fallido' AND e.event_type='sent' AND s.status='active'
       AND abs(extract(epoch from (s.current_period_start - e.created_at))) < 600
     ORDER BY e.created_at DESC LIMIT 8`);
  d.rows.forEach(x => console.log(`  ${x.created_at.toISOString().slice(5,16)}  ${x.email.padEnd(34)} ${x.desfase_s}s`));
  await c.end();
})();
