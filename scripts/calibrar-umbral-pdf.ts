#!/usr/bin/env npx tsx
/**
 * Calibración del umbral de «esto NO se renderiza en línea» para el PDF del temario (T-270).
 *
 * ## Para qué
 *
 * El incidente del 29/07 dejó una pregunta abierta: ¿cuánta CPU consume de verdad un render, y
 * cae repartido entre tasks o concentrado en una? Sin eso, elegir el umbral es opinar. Este script
 * responde con los datos que la instrumentación empezó a emitir ese día.
 *
 * **No sirve de nada hasta que el frontend esté desplegado con la instrumentación**: los campos
 * `renderMs`/`stampMs`/`instanceId` no existen en los eventos anteriores. El script lo dice en vez
 * de devolver tablas vacías que se leen como «no hay problema».
 *
 * NO ESCRIBE NADA. Solo lee `observable_events`.
 *
 * Uso:  npx tsx scripts/calibrar-umbral-pdf.ts [--dias 7]
 */
import { config } from 'dotenv'
config({ path: '.env.local' })

import postgres from 'postgres'

const i = process.argv.indexOf('--dias')
const DIAS = i >= 0 ? Number(process.argv[i + 1]) : 7

const url = process.env.DATABASE_URL
if (!url) { console.error('❌ falta DATABASE_URL'); process.exit(2) }
const sql = postgres(url, { ssl: { rejectUnauthorized: false }, max: 2 })

async function main() {
  console.log(`\n📐 Calibración del umbral de render en línea — ${DIAS} días\n`)

  const [cobertura] = await sql<Array<{ con: string; total: string }>>`
    SELECT count(*) FILTER (WHERE metadata ? 'renderMs')::text AS con,
           count(*)::text AS total
      FROM observable_events
     WHERE event_type = 'temario_pdf_stamped'
       AND created_at > now() - (${DIAS} || ' days')::interval`
  console.log(`Sellados con coste medido: ${cobertura.con} de ${cobertura.total}`)
  if (Number(cobertura.con) === 0) {
    console.log('\n⚠️  Todavía NO hay datos instrumentados.')
    console.log('    Los campos renderMs/stampMs/instanceId se emiten desde el 29/07 pero solo')
    console.log('    empiezan a producirse cuando el FRONTEND esté desplegado con ese código.')
    console.log('    Hasta entonces cualquier umbral saldría de una estimación, no de una medida.')
    await sql.end(); return
  }

  console.log('\n── Coste de CPU por tamaño del documento ──')
  const porTamano = await sql`
    SELECT CASE WHEN (metadata->>'pages')::int <= 30 THEN 'a) <=30 pag'
                WHEN (metadata->>'pages')::int <= 60 THEN 'b) 31-60'
                WHEN (metadata->>'pages')::int <= 120 THEN 'c) 61-120'
                WHEN (metadata->>'pages')::int <= 250 THEN 'd) 121-250'
                ELSE 'e) >250 pag' END AS banda,
           count(*)::int AS n,
           round(avg((metadata->>'renderMs')::int + (metadata->>'stampMs')::int))::int AS cpu_medio_ms,
           max((metadata->>'renderMs')::int + (metadata->>'stampMs')::int) AS cpu_peor_ms,
           round(avg((metadata->>'renderMs')::numeric / NULLIF((metadata->>'pages')::int, 0)))::int AS ms_por_pagina
      FROM observable_events
     WHERE event_type = 'temario_pdf_stamped'
       AND metadata ? 'renderMs' AND metadata ? 'pages'
       AND created_at > now() - (${DIAS} || ' days')::interval
     GROUP BY 1 ORDER BY 1`
  console.table(porTamano)

  console.log('\n── ¿El daño se REPARTE entre tasks o se CONCENTRA? ──')
  console.log('   (la respuesta decide si el arreglo es encolar o repartir)')
  const porTask = await sql`
    SELECT to_char(date_trunc('hour', created_at), 'MM-DD HH24:00') AS hora,
           count(DISTINCT metadata->>'instanceId')::int AS tasks_distintas,
           count(*)::int AS renders,
           max(cnt)::int AS peor_task
      FROM observable_events e,
           LATERAL (SELECT count(*) AS cnt FROM observable_events e2
                     WHERE e2.event_type = 'temario_pdf_stamped'
                       AND e2.metadata->>'instanceId' = e.metadata->>'instanceId'
                       AND date_trunc('hour', e2.created_at) = date_trunc('hour', e.created_at)) x
     WHERE e.event_type = 'temario_pdf_stamped' AND e.metadata ? 'instanceId'
       AND e.created_at > now() - (${DIAS} || ' days')::interval
     GROUP BY 1 HAVING count(*) >= 5 ORDER BY 3 DESC LIMIT 12`
  console.table(porTask)

  console.log('\n── Cuánto tiempo estuvo una task BLOQUEADA por hora ──')
  console.log('   (esto es el daño en la unidad que importa: segundos de event-loop parado)')
  const bloqueo = await sql`
    SELECT to_char(date_trunc('hour', created_at), 'MM-DD HH24:00') AS hora,
           metadata->>'instanceId' AS task,
           count(*)::int AS renders,
           round(sum((metadata->>'renderMs')::int + (metadata->>'stampMs')::int) / 1000.0)::int AS seg_bloqueada
      FROM observable_events
     WHERE event_type = 'temario_pdf_stamped' AND metadata ? 'renderMs' AND metadata ? 'instanceId'
       AND created_at > now() - (${DIAS} || ' days')::interval
     GROUP BY 1, 2 ORDER BY 4 DESC LIMIT 12`
  console.table(bloqueo)

  console.log('\n💡 Cómo leerlo: el umbral debe dejar EN LÍNEA solo lo que no llegue a bloquear la')
  console.log('   task de forma perceptible. Si una task acumula decenas de segundos bloqueada en')
  console.log('   una hora, ese tamaño va a la cola. Lo demás puede seguir sirviéndose síncrono.')

  await sql.end()
}

main().catch(e => { console.error('❌', e); process.exit(1) })
