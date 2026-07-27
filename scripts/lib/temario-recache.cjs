'use strict'
/**
 * temario-recache.cjs — invalidación de caché tras tocar el temario de una oposición.
 *
 * Vive aquí, y no dentro de un pipeline, porque son DOS los que tienen que hacerlo y
 * hacerlo IGUAL: `verify:scope apply` (cambia lo que se sirve) y `verify:epigrafe apply`
 * (cambia lo que se lee). Un cambio en BD que no llega a la página LIVE es exactamente
 * el fallo del 08/07/2026 en Cantabria: en BD correcto, en producción el listado viejo.
 *
 * Best-effort por diseño: si falla la purga o el revalidate NO se aborta el cambio ya
 * commiteado — se informa. Lo que no puede pasar es que ni se intente.
 */
/**
 * @param {string} pt     position_type
 * @param {number[]} temas  números de tema tocados
 * @param {() => import('pg').Client} db  fábrica de cliente — se INYECTA para que no
 *        existan dos definiciones de la conexión (la del pipeline y la de aquí).
 */
async function recache(pt, temas, db) {
  const results = { mv: false, purged: 0, temario: false }
  const c = db(); await c.connect()
  try {
    await c.query('REFRESH MATERIALIZED VIEW CONCURRENTLY topic_law_question_summary')
    results.mv = true
  } catch (e) {
    try { await c.query('REFRESH MATERIALIZED VIEW topic_law_question_summary'); results.mv = true }
    catch (e2) { console.error('   ⚠️ MV refresh falló:', e2.message) }
  } finally { await c.end() }
  const slug = pt.replace(/_/g, '-')
  const cron = process.env.CRON_SECRET
  if (cron && typeof fetch === 'function') {
    for (const t of temas) {
      try {
        const r = await fetch('https://www.vence.es/api/purge-cache', {
          method: 'POST', headers: { 'Content-Type': 'application/json', 'x-cron-secret': cron },
          body: JSON.stringify({ path: `/${slug}/temario/tema-${t}` }),
        })
        if (r.ok) results.purged++
      } catch {}
    }
  }
  // revalidate-temario (tag amplio) — best effort con token admin
  try {
    if (process.env.SUPABASE_SERVICE_ROLE_KEY && process.env.NEXT_PUBLIC_SUPABASE_URL) {
      const { createClient } = require('@supabase/supabase-js')
      const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
      const { data } = await admin.auth.admin.generateLink({ type: 'magiclink', email: 'manueltrader@gmail.com' })
      const anon = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)
      const { data: v } = await anon.auth.verifyOtp({ token_hash: data.properties.hashed_token, type: 'magiclink' })
      const r = await fetch('https://www.vence.es/api/admin/revalidate-temario', { method: 'POST', headers: { Authorization: 'Bearer ' + v.session.access_token } })
      results.temario = r.ok
    }
  } catch (e) { console.error('   ⚠️ revalidate-temario falló (no crítico):', e.message) }
  return results
}


module.exports = { recache }
