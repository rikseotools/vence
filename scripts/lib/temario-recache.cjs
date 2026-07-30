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
 *
 * ── QUÉ FALTABA (30/07/2026) ────────────────────────────────────────────────
 * Se purgaba la PÁGINA del temario y el tag `temario`, pero no los tags que sirven lo que
 * de verdad cambia un `topic_scope`: `test-config` (el selector «🔧 Artículos» —
 * /api/v2/test-config/{articles,sections,essential-articles}) y `test-counts` (los
 * contadores por tema). Resultado medido ese día: tras recortar el Tema 22 del SMS, la BD
 * estaba correcta y el selector seguía ofreciendo los 27 artículos viejos. El runbook
 * («revalida cache temario/test-counts») lo decía desde hacía meses; escrito en un markdown
 * no basta, que es la misma lección del fallo de Cantabria que originó este módulo.
 *
 * Los tags van por `/api/admin/revalidate` con `x-cron-secret` (el mismo secreto que ya se
 * usa para `purge-cache`), y REPETIDOS: la invalidación es por instancia de ECS, así que una
 * sola llamada deja calientes las demás.
 */

/**
 * Tags de caché que dependen del temario de una oposición. `test-config` y `test-counts`
 * tienen contraparte en el backend NestJS: su invalidador específico (lib/cache/*) cubre los
 * dos planos, y el endpoint ya lo despacha.
 */
const TAGS_TEMARIO = ['temario', 'teoria', 'test-config', 'test-counts']

/** Repeticiones por tag: la purga es POR INSTANCIA, una sola llamada no las alcanza todas. */
const REPETICIONES = 6
/**
 * @param {string} pt     position_type
 * @param {number[]} temas  números de tema tocados
 * @param {() => import('pg').Client} db  fábrica de cliente — se INYECTA para que no
 *        existan dos definiciones de la conexión (la del pipeline y la de aquí).
 */
async function recache(pt, temas, db) {
  const results = { mv: false, purged: 0, temario: false, tags: {} }
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
  // Tags que sirven lo que cambia un topic_scope. Sin esto, la BD queda bien y el usuario
  // sigue viendo el listado viejo (ver cabecera).
  if (cron && typeof fetch === 'function') {
    for (const tag of TAGS_TEMARIO) {
      let ok = 0
      for (let i = 0; i < REPETICIONES; i++) {
        try {
          const r = await fetch('https://www.vence.es/api/admin/revalidate', {
            method: 'POST', headers: { 'Content-Type': 'application/json', 'x-cron-secret': cron },
            body: JSON.stringify({ tag }),
          })
          if (r.ok) ok++
        } catch {}
      }
      results.tags[tag] = ok
      if (!ok) console.error(`   ⚠️ tag "${tag}" no se pudo invalidar — el listado viejo puede seguir sirviéndose`)
    }
  } else {
    console.error('   ⚠️ sin CRON_SECRET: NO se han invalidado los tags de caché — revalida a mano test-config y test-counts')
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


module.exports = { recache, TAGS_TEMARIO, REPETICIONES }
