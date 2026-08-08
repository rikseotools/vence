require('dotenv').config({ path: '.env.local' });
const sql = require('postgres')(process.env.DATABASE_URL, { prepare: false, max: 1 });
const UID='75e32f96-358b-4623-91ea-246a3a890d91', QID='0e11c464-3bbe-4203-8286-6686916b78d5';
(async () => {
  const ev = await sql`
    SELECT event_type, severity, created_at, endpoint, metadata
    FROM observable_events
    WHERE created_at > now() - interval '3 days'
      AND (event_type ILIKE '%shuffle%' OR metadata::text ILIKE ${'%'+QID+'%'} OR user_id=${UID})
    ORDER BY created_at DESC LIMIT 40`;
  console.log('EVENTOS:', ev.length);
  for (const e of ev) console.log(e.created_at.toISOString(), e.severity, e.event_type, JSON.stringify(e.metadata).slice(0,300));
  const tipos = await sql`
    SELECT event_type, severity, count(*), max(created_at) AS ult
    FROM observable_events WHERE event_type ILIKE '%shuffle%' AND created_at > now() - interval '14 days'
    GROUP BY 1,2 ORDER BY 3 DESC`;
  console.log('\nSHUFFLE 14d:', tipos);
  await sql.end();
})();
