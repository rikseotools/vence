// T-422 — simulación: corre el SQL NUEVO del reconciliador contra RDS y pasa las filas por
// el núcleo puro, para comprobar (a) que la consulta es válida y (b) qué veredicto sale hoy.
// No escribe nada.
require('dotenv').config({ path: '.env.local' })
const { Client } = require('pg')
const { pgConfig } = require('../../lib/db/pgSsl.cjs')

// Copia LITERAL del SQL del servicio (backend/src/dispute-email-reconciliation), solo para
// validarlo; el criterio de veredicto NO se copia: se reimplementa aquí abajo igual que el
// núcleo puro para contrastar que coinciden.
const SQL = `
  WITH disputes AS (
    SELECT qd.id AS dispute_id, qd.user_id, qd.resolved_at, 'legislative'::text AS kind
    FROM question_disputes qd
    WHERE qd.status IN ('resolved', 'rejected')
      AND qd.admin_response IS NOT NULL
      AND length(btrim(qd.admin_response)) > 0
      AND qd.resolved_at >= now() - interval '24 hours'
      AND qd.resolved_at <= now() - interval '10 minutes'
    UNION ALL
    SELECT pd.id, pd.user_id, pd.resolved_at, 'psychometric'::text
    FROM psychometric_question_disputes pd
    WHERE pd.status IN ('resolved', 'rejected')
      AND pd.admin_response IS NOT NULL
      AND length(btrim(pd.admin_response)) > 0
      AND pd.resolved_at >= now() - interval '24 hours'
      AND pd.resolved_at <= now() - interval '10 minutes'
  ),
  classified AS (
    SELECT d.dispute_id, d.user_id, d.kind, d.resolved_at, up.email,
      COALESCE(ep.email_soporte_disabled, false) AS soporte_disabled,
      EXISTS (
        SELECT 1 FROM email_events ee
        WHERE ee.email_address = up.email
          AND ee.email_type = 'impugnacion_respuesta'
          AND ee.created_at >= d.resolved_at - interval '2 minutes'
      ) AS has_email_event,
      EXISTS (
        SELECT 1 FROM observable_events oe
        WHERE oe.event_type = 'dispute_email_skipped'
          AND oe.metadata->>'disputeId' = d.dispute_id::text
      ) AS has_skip_event
    FROM disputes d
    JOIN user_profiles up ON up.id = d.user_id
    LEFT JOIN email_preferences ep ON ep.user_id = d.user_id
  )
  SELECT dispute_id, user_id, kind, email, resolved_at, soporte_disabled, has_skip_event
  FROM classified
  WHERE has_email_event = false
  ORDER BY resolved_at DESC
`

// Mismo criterio que backend/src/dispute-email-reconciliation/verdict.ts
function clasificar({ email, soporteDisabled, hasEmailEvent, hasSkipEvent }) {
  if (hasEmailEvent) return 'delivered'
  if (hasSkipEvent) return 'expected_skip'
  if (email === null || email === '') return 'no_user_email'
  if (soporteDisabled) return 'expected_skip_inferred'
  return 'real_drop'
}

;(async () => {
  const c = new Client(pgConfig(process.env.DATABASE_URL))
  await c.connect()
  const t0 = Date.now()
  const { rows } = await c.query(SQL)
  console.log(`✅ el SQL nuevo corre: ${rows.length} fila(s) sin email en la ventana de 24 h (${Date.now() - t0} ms)`)

  const juzgadas = rows.map((r) => ({
    dispute: r.dispute_id.slice(0, 8),
    email: r.email,
    resolved_at: r.resolved_at,
    soporte_off: r.soporte_disabled,
    evidencia: r.has_skip_event,
    veredicto: clasificar({
      email: r.email,
      soporteDisabled: r.soporte_disabled === true,
      hasEmailEvent: false,
      hasSkipEvent: r.has_skip_event === true,
    }),
  }))
  console.table(juzgadas)

  const drops = juzgadas.filter((j) => j.veredicto === 'real_drop').length
  const inferidos = juzgadas.filter((j) => j.veredicto === 'expected_skip_inferred').length
  console.log(`\nrealDrops=${drops}  inferredSkips=${inferidos}  → la alerta ${drops > 0 ? 'DISPARA' : 'no dispara'}`)
  console.log('(hoy no hay evidencia porque el emisor aún no está desplegado: es lo esperado)')

  await c.end()
})().catch((e) => { console.error('❌ ERROR:', e.message); process.exit(1) })
