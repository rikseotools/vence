#!/usr/bin/env node
'use strict'
// sim-desperdicio-mints.cjs — mide cuántas veces se re-acuña el access token RS256 frente a
// las que hacen falta, y deja una PREDICCIÓN falsable del efecto del arreglo.
//
// ## Por qué (T-210, mecanismo 2 — 28/07/2026)
//
// El RS256 dura 1 hora, así que un usuario necesita ~1 acuñación por hora activa. Medido:
// **45 acuñaciones reales por usuario y hora** (mediana de 7 días; rango 29-136), o sea
// 58.680/día frente a un suelo de 2.001 → **29× de desperdicio**. La causa eran 9 copias
// del patrón «`refreshSession()` y si no `getSession()`» repartidas por la app; cada una
// FORZABA la re-acuñación y se saltaba la caché del adapter. Convergieron en
// `auth.getAccessToken()` (ver `lib/auth/tokenFreshness.ts`).
//
// Por qué hace falta MEDIRLO y no basta con los tests: el guardarraíl
// `__tests__/guardrails/bearerTokenSinglePath.test.ts` impide reintroducir el PATRÓN, pero
// no puede ver el régimen de tráfico real (un caller nuevo, otra pestaña, un poll que se
// desmadre). Esto es lo que convierte "creo que lo arreglé" en un número.
//
// El suelo se calcula con las horas-usuario ACTIVAS (cualquier evento con user_id): como
// máximo se necesita 1 acuñación por usuario y hora, así que es una cota SUPERIOR de lo
// necesario — el número real post-arreglo debe quedar cerca de ella, nunca por debajo de
// forma sospechosa (eso significaría que hay usuarios sin token, no eficiencia).
//
// Correrlo ANTES y DESPUÉS del deploy. La misma señal, ya en vivo y sin intervención, es la
// alerta `auth_token_mint_waste` (backend/src/alerts/alert-rules.ts): dispara por encima de
// 8 reales/usuario/hora, y su SILENCIO tras el despliegue es la verificación continua.
//
// Uso:  node scripts/observabilidad/sim-desperdicio-mints.cjs [--dias N]
// Solo lectura.
require('dotenv').config({ path: '.env.local' })
const { Client } = require('pg')
const { pgConfig } = require('../../lib/db/pgSsl.cjs')

// El evento `auth_token_minted` se muestrea al 10% para via='authjs_session' y se emite
// SIEMPRE para via='bridge' (app/api/auth/token/route.ts, MINT_SAMPLE_RATE). Mezclarlos
// falsearía el ×10, así que se cuentan por separado.
const MUESTREO_AUTHJS = 0.1
const i = process.argv.indexOf('--dias')
const DIAS = i > 0 && process.argv[i + 1] ? parseInt(process.argv[i + 1], 10) : 1
/** Umbral de la alerta `auth_token_mint_waste` (reales por usuario y hora). */
const UMBRAL_ALERTA = 8

;(async () => {
  const c = new Client(pgConfig(process.env.DATABASE_URL))
  await c.connect()

  const { rows: [m] } = await c.query(`
    SELECT
      count(*) FILTER (WHERE metadata->>'via' = 'authjs_session')::int AS authjs_sampled,
      count(*) FILTER (WHERE metadata->>'via' = 'bridge')::int        AS bridge,
      count(DISTINCT user_id)::int                                    AS usuarios
    FROM observable_events
    WHERE event_type = 'auth_token_minted'
      AND ts >= NOW() - INTERVAL '${DIAS} days'`)

  const { rows: [s] } = await c.query(`
    SELECT count(*)::int AS horas_usuario, count(DISTINCT user_id)::int AS usuarios_activos
    FROM (SELECT DISTINCT user_id, date_trunc('hour', ts) h
          FROM observable_events
          WHERE ts >= NOW() - INTERVAL '${DIAS} days' AND user_id IS NOT NULL) x`)

  // Ratio por HORA (lo que mide la alerta), con el guardarraíl de ≥20 usuarios.
  const { rows: horas } = await c.query(`
    SELECT round((count(*) * 10.0) / greatest(count(DISTINCT user_id), 1), 1)::float AS ratio
    FROM observable_events
    WHERE event_type = 'auth_token_minted' AND metadata->>'via' = 'authjs_session'
      AND ts >= NOW() - INTERVAL '${DIAS} days'
    GROUP BY date_trunc('hour', ts)
    HAVING count(DISTINCT user_id) >= 20
    ORDER BY 1`)

  // POR QUÉ se acuña (T-210). Sin este desglose, tras el deploy del 28/07 solo se pudo decir
  // "queda un 61% sin explicar"; con él, cada punto porcentual tiene nombre y el arreglo
  // siguiente se elige con datos. `desconocido` = cliente aún sin la cabecera (bundle viejo).
  const { rows: motivos } = await c.query(`
    SELECT COALESCE(metadata->>'reason', 'sin_dato') AS motivo,
           count(*)::int AS sampled,
           count(DISTINCT user_id)::int AS usuarios
    FROM observable_events
    WHERE event_type = 'auth_token_minted' AND metadata->>'via' = 'authjs_session'
      AND ts >= NOW() - INTERVAL '${DIAS} days'
    GROUP BY 1 ORDER BY 2 DESC`)
  await c.end()

  const reales = Math.round(m.authjs_sampled / MUESTREO_AUTHJS) + m.bridge
  const suelo = s.horas_usuario
  const factor = suelo > 0 ? reales / suelo : 0
  const rs = horas.map((h) => h.ratio)
  const pct = (p) => (rs.length ? rs[Math.floor(p * (rs.length - 1))] : 0)

  console.log(`\nDESPERDICIO DE ACUÑACIÓN DE TOKEN — ${DIAS} día(s)\n`)
  console.log(`  acuñaciones reales (authjs ×10 + bridge)   : ${reales.toLocaleString('es-ES')}`)
  console.log(`     · authjs_session muestreadas            : ${m.authjs_sampled.toLocaleString('es-ES')}`)
  console.log(`     · bridge (sin muestreo, drenaje Fase B) : ${m.bridge.toLocaleString('es-ES')}`)
  console.log(`  suelo necesario (1 por usuario-hora activa): ${suelo.toLocaleString('es-ES')}`)
  console.log(`  usuarios con actividad                     : ${s.usuarios_activos.toLocaleString('es-ES')}`)
  console.log(`  FACTOR DE DESPERDICIO                      : ${factor.toFixed(1)}×`)
  if (rs.length) {
    console.log(`\n  ratio por hora (reales/usuario/hora, TTL del token = 1 h; ideal ~1):`)
    console.log(`     min ${rs[0]}  p50 ${pct(0.5)}  p95 ${pct(0.95)}  max ${rs[rs.length - 1]}`)
    console.log(`     horas por encima del umbral de alerta (>${UMBRAL_ALERTA}): ${rs.filter((r) => r > UMBRAL_ALERTA).length}/${rs.length}`)
  }

  if (motivos.length) {
    const totalM = motivos.reduce((a, m) => a + m.sampled, 0)
    console.log('\n  POR QUÉ se acuña (lo que convierte "queda un 61% sin explicar" en filas con nombre):')
    for (const m of motivos) {
      const pctM = ((m.sampled / totalM) * 100).toFixed(1).padStart(5)
      console.log(`     ${String(m.motivo).padEnd(14)} ${String(m.sampled * 10).padStart(7)} reales  ${pctM}%   ${m.usuarios} usuarios`)
    }
    const cargas = motivos.find((m) => m.motivo === 'carga_inicial')
    const sinDato = motivos.find((m) => m.motivo === 'sin_dato' || m.motivo === 'desconocido')
    if (sinDato && sinDato.sampled / totalM > 0.5) {
      console.log('     ⚠️  más de la mitad sin motivo: el bundle con la cabecera aún no ha llegado a los')
      console.log('         clientes (o un proxy la quita). Re-medir cuando `sin_dato` baje.')
    }
    if (cargas && cargas.sampled / totalM > 0.5) {
      console.log('     ℹ️  domina `carga_inicial`: el gasto es el SUELO del sistema (la caché vive en')
      console.log('         memoria y muere en cada carga de página / pestaña), no un bug de renovación.')
      console.log('         Bajarlo exige persistir el token entre cargas, que es otra decisión (seguridad).')
    }
  }

  // Veredicto: la predicción falsable.
  console.log('')
  if (factor >= 4) {
    console.log(`  ❌ DESPERDICIO VIVO: ${reales.toLocaleString('es-ES')} acuñaciones, ${factor.toFixed(1)}× el suelo por usuario-hora.`)
    console.log('')
    console.log('     ⚠️  NO tomes ese suelo como objetivo. Se probó el 28/07 y salió mal: se predijo')
    console.log('         −96,6% y el arreglo dio −39%. El suelo de "1 por usuario-hora" sale del TTL')
    console.log('         del token (1 h), pero la caché del adapter vive EN MEMORIA y muere en cada')
    console.log('         carga de página y cada pestaña → el suelo REAL es "≈1 por carga de página".')
    console.log('         Mira el desglose por MOTIVO de arriba antes de prometer un número:')
    console.log('           · domina `carga_inicial` → es el suelo del sistema, no un bug de renovación')
    console.log('           · domina `forzado`       → alguien volvió a forzar red:')
    console.log('                git grep -n "refreshSession()" -- lib utils app components hooks contexts')
    console.log('           · domina `cache_miss`    → algo está TIRANDO la caché (revisar resetCache/401)')
    process.exitCode = 1
  } else if (reales === 0) {
    console.log('  ⚠️  CERO acuñaciones en la ventana: o no hay tráfico, o el minteo está ROTO.')
    console.log('     Comprobar el canary de auth (canary_auth_ok) antes de cantar victoria.')
  } else if (suelo > 0 && reales < suelo * 0.2) {
    console.log('  ⚠️  MUY por debajo del suelo: sospechoso. Puede que usuarios activos no estén')
    console.log('     recibiendo token (401 silenciosos), no que seamos eficientes.')
  } else {
    console.log(`  ✅ SANO (${factor.toFixed(1)}× el suelo). El token se reusa hasta cerca de su expiración.`)
  }
  console.log('')
})().catch((e) => {
  console.error('ERR', e.message)
  process.exit(1)
})
