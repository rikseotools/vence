#!/usr/bin/env node
// scripts/fase-b-drenaje.cjs — Mide el DRENAJE de sesiones Supabase durante el soak
// de Fase B (ver docs/roadmap/fase-b-ejecucion-authjs-rs256.md §"Siguiente paso").
//
// Lee el evento `auth_token_minted` (instrumentado en app/api/auth/token/route.ts) y
// reporta, por día, cuántos usuarios DISTINTOS acuñaron token vía `bridge` (aún
// dependen de su sesión Supabase legacy) vs `authjs_session` (ya migrados a Auth.js).
//
// Criterio para el PASO 5 (retirar la rama HS256 + el bridge, punto de no retorno):
// cuando los usuarios `bridge` tiendan a ~0 durante varios días seguidos.
//
// Uso:  node scripts/fase-b-drenaje.cjs [días]     (por defecto 10)
// Requiere NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY en el entorno
// (cargar .env.local:  set -a; source .env.local; set +a).

const { createClient } = require('@supabase/supabase-js')

const DAYS = parseInt(process.argv[2] || '10', 10)

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) {
    console.error('❌ Faltan NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY (source .env.local)')
    process.exit(2)
  }
  const s = createClient(url, key)

  const since = new Date(Date.now() - DAYS * 24 * 3600 * 1000).toISOString()

  // Traemos las filas del evento (paginado por si supera el cap de 1000 de PostgREST).
  const rows = []
  const PAGE = 1000
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await s
      .from('observable_events')
      .select('user_id, metadata, created_at')
      .eq('event_type', 'auth_token_minted')
      .gte('created_at', since)
      .order('created_at', { ascending: true })
      .range(from, from + PAGE - 1)
    if (error) {
      console.error('❌ Error consultando observable_events:', error.message)
      process.exit(1)
    }
    rows.push(...(data || []))
    if (!data || data.length < PAGE) break
  }

  if (rows.length === 0) {
    console.log(`Sin eventos 'auth_token_minted' en los últimos ${DAYS} días.`)
    console.log('→ ¿Está desplegada la instrumentación (:320+)? Si el flip es de hoy, espera a que corra tráfico.')
    return
  }

  // Agregar por día → sets de usuarios distintos por vía.
  const byDay = new Map() // 'YYYY-MM-DD' → { bridge:Set, authjs:Set }
  const bridgeUsersTotal = new Set()
  for (const r of rows) {
    const day = r.created_at.slice(0, 10)
    const via = r.metadata && r.metadata.via
    if (!byDay.has(day)) byDay.set(day, { bridge: new Set(), authjs: new Set() })
    const bucket = byDay.get(day)
    if (via === 'bridge') { if (r.user_id) { bucket.bridge.add(r.user_id); bridgeUsersTotal.add(r.user_id) } }
    else if (via === 'authjs_session') { if (r.user_id) bucket.authjs.add(r.user_id) }
  }

  console.log(`\nDRENAJE de sesiones Supabase (Fase B) — usuarios DISTINTOS por día, últimos ${DAYS}d`)
  console.log('  bridge   = aún dependen de su sesión Supabase legacy (falta migrar)')
  console.log('  authjs   = ya migrados a Auth.js (cookie propia)\n')
  console.log('  día          bridge   authjs   %bridge')
  console.log('  ----------   ------   ------   -------')
  const days = [...byDay.keys()].sort()
  for (const d of days) {
    const b = byDay.get(d).bridge.size
    const a = byDay.get(d).authjs.size
    const pct = (b + a) ? Math.round((100 * b) / (b + a)) : 0
    const bar = '#'.repeat(Math.min(b, 40))
    console.log(`  ${d}   ${String(b).padStart(6)}   ${String(a).padStart(6)}   ${String(pct).padStart(5)}%  ${bar}`)
  }

  const last = byDay.get(days[days.length - 1])
  const lastBridge = last ? last.bridge.size : 0
  console.log(`\n  Usuarios únicos que usaron el bridge en la ventana: ${bridgeUsersTotal.size}`)
  console.log(`  Último día — usuarios en bridge: ${lastBridge}`)
  console.log(
    lastBridge === 0
      ? '\n  ✅ 0 usuarios en el bridge el último día → candidato al PASO 5 (retirar HS256+bridge). Confirmar varios días seguidos a 0.'
      : `\n  ⏳ Aún ${lastBridge} usuario(s) dependen del bridge → NO retirar todavía la doble-aceptación HS256.`,
  )
}

main().catch((e) => { console.error('ERR', e.message); process.exit(1) })
