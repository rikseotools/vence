#!/usr/bin/env npx tsx
// sim-captura-ampliada.ts — simula el efecto de ampliar la captura de atribución (T-243)
// ANTES de que llegue a producción: qué canales aparecerían, cuánto se escribiría de más, y
// —lo que de verdad puede salir mal— si el reparto se contamina con dominios propios.
//
// ## Por qué (T-243, 28/07/2026)
//
// El toque solo se emitía con UTM o click-id, así que **solo el tráfico de pago dejaba
// rastro**: el 86% de las altas quedaba como `direct` y `organic` salía 1 vez en 12 días.
// Al ampliarlo, el riesgo no es que falte señal: es meter RUIDO (navegación interna
// contada como `referral`) o multiplicar las escrituras por cada navegación.
//
// Usa el MÓDULO REAL (`lib/attribution/*`), no una copia — si la lógica cambia, esta
// simulación cambia con ella. Es la lección de los detectores que se calibraron contra su
// propia copia y opinaban distinto que el código vivo.
//
// Uso:  npx tsx scripts/atribucion/sim-captura-ampliada.ts [--dias N]
// Solo lectura.
import { config } from 'dotenv'
import postgres from 'postgres'
// `.env.local` explícito: `dotenv/config` solo lee `.env`, y las credenciales viven en
// `.env.local` (igual que el resto de scripts del repo).
config({ path: '.env.local' })
import { deriveChannel } from '../../lib/attribution/deriveChannel'
import { shouldStoreTouch } from '../../lib/attribution/touchPolicy'

const i = process.argv.indexOf('--dias')
const DIAS = i > 0 && process.argv[i + 1] ? parseInt(process.argv[i + 1], 10) : 7

const sql = postgres(process.env.DATABASE_URL!.split('?')[0], {
  ssl: { rejectUnauthorized: false },
  max: 2,
})

async function main() {
  // 1) Reclasificar los toques que YA hay: comprueba que el clasificador no se rompe con
  //    datos reales y, sobre todo, que ningún dominio propio se cuela como `referral`.
  const toques = await sql<{ referrer: string | null; landing_path: string | null; gclid: string | null; fbclid: string | null; utm_source: string | null; utm_medium: string | null; n: number }[]>`
    SELECT referrer, landing_path, gclid, fbclid, utm_source, utm_medium, count(*)::int n
    FROM attribution_touches
    WHERE occurred_at > now() - (${DIAS} || ' days')::interval
    GROUP BY 1,2,3,4,5,6`

  const porCanal = new Map<string, number>()
  const sospechosos: { referrer: string; canal: string; n: number }[] = []
  let total = 0
  for (const t of toques) {
    const señales = {
      gclid: t.gclid, fbclid: t.fbclid,
      utmSource: t.utm_source, utmMedium: t.utm_medium,
      referrer: t.referrer,
    }
    const canal = deriveChannel(señales)
    porCanal.set(canal, (porCanal.get(canal) ?? 0) + t.n)
    total += t.n
    // El fallo que esta simulación existe para cazar: contarnos a nosotros mismos.
    if (canal === 'referral' && t.referrer && /vence\.es|localhost|stripe\.com|accounts\.google/.test(t.referrer)) {
      sospechosos.push({ referrer: t.referrer, canal, n: t.n })
    }
  }

  console.log(`\nSIMULACIÓN T-243 — captura de atribución ampliada (${DIAS} días)\n`)
  console.log(`1) Reclasificación de los ${total.toLocaleString('es-ES')} toques que YA existen:`)
  for (const [canal, n] of [...porCanal.entries()].sort((a, b) => b[1] - a[1])) {
    console.log(`     ${canal.padEnd(14)} ${String(n).padStart(6)}  ${((n / total) * 100).toFixed(1)}%`)
  }
  console.log(
    sospechosos.length === 0
      ? '   ✅ ningún dominio propio/infra clasificado como `referral`'
      : `   ❌ ${sospechosos.length} referrer(s) propios contados como referral — corregir antes de encender:`,
  )
  for (const s of sospechosos.slice(0, 5)) console.log(`      ${s.n}× ${s.referrer}`)

  // 2) Volumen: cuántos toques NUEVOS por día añade la entrada-de-sesión. Se aproxima con
  //    los devices activos (1 toque por sesión ≈ 1 por device y día, cota alta).
  // Cota ALTA de sesiones/día: devices vistos por día. `user_devices` solo cubre a los
  // usuarios REGISTRADOS, así que el visitante anónimo (que también emitirá su toque de
  // entrada) no está aquí — se dice explícitamente en la salida en vez de fingir precisión.
  const [{ devices_dia }] = await sql<{ devices_dia: number }[]>`
    SELECT round(count(DISTINCT device_id)::numeric / greatest(${DIAS}, 1))::int AS devices_dia
    FROM user_devices
    WHERE last_seen_at > now() - (${DIAS} || ' days')::interval`
  const [{ toques_dia }] = await sql<{ toques_dia: number }[]>`
    SELECT round(count(*)::numeric / greatest(${DIAS}, 1))::int AS toques_dia
    FROM attribution_touches WHERE occurred_at > now() - (${DIAS} || ' days')::interval`

  console.log(`\n2) Volumen de escritura:`)
  console.log(`     toques/día hoy (solo campaña) : ${toques_dia}`)
  console.log(`     cota ALTA de toques nuevos/día: ~${devices_dia} (1 por device activo y día)`)
  console.log(`     La cota es alta a propósito: el toque de entrada es 1 por SESIÓN, y un`)
  console.log(`     device puede tener varias. Aun en el peor caso son ~${(devices_dia / Math.max(toques_dia, 1)).toFixed(1)}× lo de hoy.`)

  // 3) La política, sobre casos reales: qué se guardaría y qué no.
  console.log('\n3) Política sobre referrers reales (muestra):')
  const muestra = await sql<{ referrer: string | null; n: number }[]>`
    SELECT referrer, count(*)::int n FROM attribution_touches
    WHERE occurred_at > now() - (${DIAS} || ' days')::interval AND referrer IS NOT NULL
    GROUP BY 1 ORDER BY 2 DESC LIMIT 8`
  for (const m of muestra) {
    const d = shouldStoreTouch({ referrer: m.referrer, landingPath: '/' })
    console.log(`     ${d.store ? '✅' : '⛔'} ${String(d.motivo).padEnd(18)} ${deriveChannel({ referrer: m.referrer }).padEnd(12)} ${m.n}×  ${String(m.referrer).slice(0, 60)}`)
  }
  console.log('')
  await sql.end()
}

main().catch((e) => {
  console.error('ERR', e.message)
  process.exit(1)
})
