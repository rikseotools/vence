#!/usr/bin/env node
/**
 * T-457 — MEDIR ANTES DE TOCAR.
 *
 * La ficha exige saber si el hueco (envío por `selectedUserIds` sin filtro de
 * preferencias) se ha USADO alguna vez antes de decidir si esto es un trinquete
 * barato o un incidente de cumplimiento.
 *
 * No se puede reconstruir el valor de la preferencia EN EL MOMENTO del envío,
 * pero sí hay dos marcas de tiempo que acotan:
 *   · `email_preferences.unsubscribed_at` — cuándo se dio de baja de TODO.
 *   · `email_preferences.updated_at` — última vez que tocó sus preferencias.
 * Un `email_events` de newsletter POSTERIOR a `unsubscribed_at` es evidencia
 * dura: se le escribió después de pedir no recibir nada.
 */
const { Client } = require('pg')
const { pgConfig } = require('../../lib/db/pgSsl.cjs')

const q = async (c, sql, params = []) => (await c.query(sql, params)).rows

;(async () => {
  const c = new Client(pgConfig(process.env.DATABASE_URL))
  await c.connect()

  const linea = (t) => console.log(`\n${'='.repeat(78)}\n${t}\n${'='.repeat(78)}`)

  linea('1) Universo: eventos de newsletter enviados')
  console.table(await q(c, `
    SELECT email_type,
           count(*)                                   AS eventos,
           count(DISTINCT user_id)                    AS usuarios,
           min(created_at)::date                      AS desde,
           max(created_at)::date                      AS hasta
      FROM email_events
     WHERE event_type = 'sent' AND email_type = 'newsletter'
     GROUP BY 1
  `))

  linea('2) EVIDENCIA DURA: newsletter enviada DESPUÉS de darse de baja de todo')
  const posteriores = await q(c, `
    SELECT ee.user_id,
           count(*)                    AS envios_posteriores,
           min(ee.created_at)          AS primer_envio_posterior,
           max(ee.created_at)          AS ultimo_envio_posterior,
           ep.unsubscribed_at
      FROM email_events ee
      JOIN email_preferences ep ON ep.user_id = ee.user_id
     WHERE ee.event_type = 'sent'
       AND ee.email_type = 'newsletter'
       AND ep.unsubscribed_all IS TRUE
       AND ep.unsubscribed_at IS NOT NULL
       AND ee.created_at > ep.unsubscribed_at
     GROUP BY ee.user_id, ep.unsubscribed_at
     ORDER BY 2 DESC
  `)
  console.log(`   → ${posteriores.length} usuario(s) con envío posterior a su baja`)
  console.table(posteriores.slice(0, 20))

  linea('3) Newsletter enviada a quien HOY tiene la newsletter desactivada')
  console.table(await q(c, `
    SELECT ep.unsubscribed_all,
           ep.email_newsletter_disabled,
           count(DISTINCT ee.user_id) AS usuarios,
           count(*)                   AS envios,
           max(ee.created_at)         AS ultimo_envio
      FROM email_events ee
      JOIN email_preferences ep ON ep.user_id = ee.user_id
     WHERE ee.event_type = 'sent'
       AND ee.email_type = 'newsletter'
       AND (ep.unsubscribed_all IS TRUE OR ep.email_newsletter_disabled IS TRUE)
     GROUP BY 1, 2
  `))

  linea('4) Los mismos, pero enviados DESPUÉS del último cambio de preferencias')
  console.table(await q(c, `
    SELECT count(DISTINCT ee.user_id) AS usuarios,
           count(*)                   AS envios,
           max(ee.created_at)         AS ultimo_envio
      FROM email_events ee
      JOIN email_preferences ep ON ep.user_id = ee.user_id
     WHERE ee.event_type = 'sent'
       AND ee.email_type = 'newsletter'
       AND (ep.unsubscribed_all IS TRUE OR ep.email_newsletter_disabled IS TRUE)
       AND ee.created_at > ep.updated_at
  `))

  linea('5) Cuánta gente hay hoy detrás del filtro (lo que el hueco puede alcanzar)')
  console.table(await q(c, `
    SELECT count(*) FILTER (WHERE unsubscribed_all IS TRUE)            AS baja_de_todo,
           count(*) FILTER (WHERE email_newsletter_disabled IS TRUE)   AS newsletter_off,
           count(*) FILTER (WHERE unsubscribed_all IS TRUE
                              OR email_newsletter_disabled IS TRUE)    AS bloqueados_total
      FROM email_preferences
  `))

  await c.end()
})().catch(e => { console.error(e); process.exit(1) })
