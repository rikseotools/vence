#!/usr/bin/env node
/**
 * scripts/fraude/marcar-confirmadas.cjs — pasa a marca PERSISTENTE lo ya confirmado a mano.
 *
 * Las señales `confirmed` de `fraud_alerts` cuelgan de cuentas que pueden borrarse
 * (`ON DELETE CASCADE`): si el usuario pide la baja, el rastro desaparece y vuelve limpio. Este
 * script las vuelca a `fraud_confirmations`, que se ancla al DISPOSITIVO y guarda el hash de los
 * correos — así sobrevive al borrado (T-304).
 *
 * Idempotente: correrlo dos veces no duplica; acumula cuentas y correos por dispositivo.
 * Solo toca `fraud_confirmations`; no bloquea a nadie ni modifica cuentas.
 *
 * Uso:  npm run fraude:marcar-confirmadas
 */
require('dotenv').config({ path: '.env.local' })
const postgres = require('postgres')
const { createHash } = require('crypto')

const sql = postgres(process.env.DATABASE_URL, { max: 1, ssl: { rejectUnauthorized: false } })
const hash = (e) => createHash('sha256').update(String(e).trim().toLowerCase()).digest('hex')

;(async () => {
  const señales = await sql`
    SELECT details, notes FROM fraud_alerts
     WHERE status = 'confirmed' AND details->>'device_id' IS NOT NULL`

  const porDev = new Map()
  for (const s of señales) {
    const d = s.details || {}
    const dev = d.device_id
    if (!porDev.has(dev)) porDev.set(dev, { emails: new Set(), notas: new Set() })
    ;(d.emails || []).forEach((e) => porDev.get(dev).emails.add(e))
    if (s.notes) porDev.get(dev).notas.add(String(s.notes).slice(0, 100))
  }

  console.log('dispositivos confirmados a marcar:', porDev.size)
  for (const [dev, info] of porDev) {
    const emails = [...info.emails]
    const hashes = emails.map(hash)
    const us = await sql`SELECT DISTINCT user_id FROM user_devices WHERE device_id = ${dev}`
    const uids = us.map((x) => x.user_id)
    const nota = 'Confirmado por revisión manual. ' + [...info.notas].join(' | ').slice(0, 300)

    await sql`
      INSERT INTO fraud_confirmations
        (device_id, user_ids, email_hashes, first_detected_at, last_activity_at,
         session_count, status, notes, retention_until)
      VALUES (
        ${dev},
        ${uids}::uuid[],
        ${hashes}::text[],
        now(), now(), 1, 'confirmed', ${nota}, now() + interval '2 years'
      )
      ON CONFLICT (device_id) WHERE device_id IS NOT NULL DO UPDATE SET
        user_ids     = ARRAY(SELECT DISTINCT unnest(fraud_confirmations.user_ids || EXCLUDED.user_ids)),
        email_hashes = ARRAY(SELECT DISTINCT unnest(fraud_confirmations.email_hashes || EXCLUDED.email_hashes)),
        last_activity_at = now(),
        notes = EXCLUDED.notes`
    console.log(`  ✔ ${dev.slice(0, 12)}…  ${uids.length} cuentas · ${hashes.length} correos`)
  }

  const [r] = await sql`
    SELECT count(*)::int AS filas,
           COALESCE(sum(array_length(user_ids, 1)), 0)::int AS cuentas
      FROM fraud_confirmations`
  console.log('fraud_confirmations →', JSON.stringify(r))
  await sql.end()
})().catch((e) => { console.error('❌', e.message); process.exit(1) })
