#!/usr/bin/env node
// scripts/lib/avisar-deploy-no-salido.cjs — un deploy que NO ocurre tiene que dejar rastro. [T-619]
//
// Este es el corazón del defecto que arregla T-619: el lanzador podía agotar sus 12 vueltas sin
// desplegar nada y **no daba error a nadie**. El trabajo se quedaba «hecho pero sin verificar»
// (el 06/08: 6 tareas de frontend y 3 de backend esperando) y la única forma de enterarse era
// mirar el log a mano. Un fallo que solo existe en la terminal de quien lo lanzó no existe.
//
// Emite `deploy_no_salido` con severity `error` para que lo recoja la vigilancia genérica de
// señales sin regla propia (`senal_error_sin_vigilancia`), que es justo la red para esto.
//
// FAIL-OPEN a propósito: si no hay BD, el aviso se pierde pero el deploy no cambia de resultado.
// Telemetría que tumba la operación es peor que telemetría ausente.
//
// Uso:  node scripts/lib/avisar-deploy-no-salido.cjs <superficie> <motivoCorto> "<detalle>"
require('dotenv').config({ path: '.env.local' })

const [superficie, motivo, detalle] = process.argv.slice(2)

;(async () => {
  if (!process.env.DATABASE_URL) return
  let sql
  try {
    const { pgConfig } = require('../../lib/db/pgSsl.cjs')
    const { Client } = require('pg')
    sql = new Client(pgConfig(process.env.DATABASE_URL))
    await sql.connect()
    await sql.query(
      `INSERT INTO observable_events (source, severity, event_type, metadata)
       VALUES ($1, 'error', 'deploy_no_salido', $2::jsonb)`,
      [
        'deploy-cuando-verde',
        JSON.stringify({
          superficie: superficie || 'desconocida',
          motivo: motivo || 'sin_motivo',
          detalle: (detalle || '').slice(0, 500),
          host: require('os').hostname(),
        }),
      ],
    )
    process.stdout.write('   📡 avisado: deploy_no_salido\n')
  } catch (e) {
    process.stdout.write(`   (no se pudo avisar del deploy no salido: ${e.message})\n`)
  } finally {
    try { if (sql) await sql.end() } catch { /* da igual */ }
  }
})()
