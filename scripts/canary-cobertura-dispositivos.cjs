#!/usr/bin/env node
// scripts/canary-cobertura-dispositivos.cjs
//
// ¿Qué porcentaje de los usuarios ACTIVOS tiene huella de dispositivo? [T-371]
//
// ## Por qué existe
//
// El antifraude por dispositivo (multicuenta, límite por cuenta, farmeo del límite gratuito y
// la comprobación anti-autoreferido de los referidos) solo ve a quien tiene fila en
// `user_devices`. Cuando NO la tiene, no falla nada: las consultas devuelven cero filas y todo
// parece tranquilo. Es la misma firma que [T-304] —un enforcement que no corta es
// indistinguible de uno apagado— y por eso el 31/07 se descubrió mirando un feedback de pago y
// no un detector: **una cobertura que baja no dispara nada por sí sola.**
//
// Medición inicial (31/07/2026, antes del arreglo): 61,3% de las altas desde el 17/04, con 405
// usuarios activos sin ninguna huella y el 52% de las cuentas free fuera.
//
// ## Qué mira, y por qué así
//
// Solo usuarios con ACTIVIDAD REAL (han respondido alguna pregunta) y dados de alta desde que
// la tabla existe. Contar todo el padrón mezclaría cuentas que nunca entraron —que no son un
// agujero de seguridad— y diluiría la señal justo cuando empeore.
//
//   node scripts/canary-cobertura-dispositivos.cjs            # últimos 30 días
//   node scripts/canary-cobertura-dispositivos.cjs --dias 7
//   node scripts/canary-cobertura-dispositivos.cjs --json

require('dotenv').config({ path: '.env.local' })
const { Client } = require('pg')
const { pgConfig } = require('../lib/db/pgSsl.cjs')

// La tabla nace el 17/04/2026: antes de esa fecha la ausencia no significa nada.
const DESDE_QUE_EXISTE = '2026-04-17'

const argv = process.argv.slice(2)
const JSON_OUT = argv.includes('--json')
const i = argv.indexOf('--dias')
const DIAS = i >= 0 && argv[i + 1] ? parseInt(argv[i + 1], 10) : 30

// Umbrales. El suelo se fija por debajo de lo medido antes del arreglo (61,3%) para que el
// canario grite si REGRESA, no por el estado heredado que la propia tarea está corrigiendo.
const ROJO = 60
const AMBAR = 80

async function main() {
  const c = new Client(pgConfig(process.env.DATABASE_URL))
  await c.connect()

  const { rows } = await c.query(
    `select
       count(*)::int activos,
       count(*) filter (where exists (select 1 from user_devices d where d.user_id = up.id))::int con_huella,
       count(*) filter (where up.plan_type = 'premium')::int premium,
       count(*) filter (where up.plan_type = 'premium'
                          and not exists (select 1 from user_devices d where d.user_id = up.id))::int premium_sin,
       count(*) filter (where up.plan_type <> 'premium')::int free,
       count(*) filter (where up.plan_type <> 'premium'
                          and not exists (select 1 from user_devices d where d.user_id = up.id))::int free_sin
     from user_profiles up
     where up.created_at >= $1::date
       and exists (select 1 from test_questions t
                    where t.user_id = up.id and t.created_at >= now() - ($2||' days')::interval)`,
    [DESDE_QUE_EXISTE, String(DIAS)],
  )
  const r = rows[0]
  const pct = r.activos ? (r.con_huella / r.activos) * 100 : 100
  // El free es donde vive el farmeo del límite gratuito: si su cobertura se hunde, da igual que
  // la media aguante gracias a los premium (que usan más la app y siempre acaban registrados).
  const pctFree = r.free ? ((r.free - r.free_sin) / r.free) * 100 : 100

  const estado = pct < ROJO ? 'ROJO' : pct < AMBAR ? 'AMBAR' : 'VERDE'

  if (JSON_OUT) {
    console.log(JSON.stringify({ estado, pct: +pct.toFixed(1), pctFree: +pctFree.toFixed(1), ...r, dias: DIAS }))
  } else {
    const icono = estado === 'ROJO' ? '🔴' : estado === 'AMBAR' ? '🟡' : '🟢'
    console.log(`\n${icono} COBERTURA DE HUELLA DE DISPOSITIVO · usuarios activos en ${DIAS} días`)
    console.log(`   ${r.con_huella}/${r.activos} tienen huella → ${pct.toFixed(1)}%`)
    console.log(`   free: ${pctFree.toFixed(1)}% (${r.free_sin} sin huella de ${r.free})`)
    console.log(`   premium: ${r.premium_sin} sin huella de ${r.premium}`)
    if (estado !== 'VERDE') {
      console.log(`\n   Quien no tiene huella es invisible para el sweep de multicuenta, para el`)
      console.log(`   límite por dispositivo y para el anti-autoreferido de referidos.`)
      console.log(`   Revisar que <DeviceIdentity /> sigue montado en el layout (T-371).`)
    }
    console.log()
  }

  await c.end()
  process.exitCode = estado === 'ROJO' ? 1 : 0
}

main().catch((e) => { console.error('❌', e.message); process.exit(1) })
