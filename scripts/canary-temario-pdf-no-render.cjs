#!/usr/bin/env node
/**
 * canary-temario-pdf-no-render.cjs — ¿la ruta pública del PDF del temario sigue SIN renderizar? (T-159/T-270)
 *
 *   npm run canary:temario-pdf-no-render [-- --horas 6]
 *
 * Solo LEE. El criterio vive en `lib/temario/pdf/canaryNoRender.cjs`.
 *
 * ── POR QUÉ EXISTE ───────────────────────────────────────────────────────────────────────────
 * El 29/07/2026 la ruta pública renderizaba en línea y tumbó `answer-and-save` para todos los
 * usuarios 18 minutos. El 06/08/2026 se desplegó la Fase 2 (encola + 503, nunca renderiza) y la
 * ficha [T-270] exige verificarlo EN VIVO — pero un trabajador de la flota no tiene credenciales
 * de usuario premium con las que provocar un miss real (no hay `SUPABASE_JWT_SECRET`/`AUTH_SECRET`
 * en su entorno), así que no puede simular el incidente para comprobar que no se repite. Este
 * canario resuelve eso para siempre, sin necesitar esa credencial: lee lo que el TRÁFICO REAL de
 * usuarios premium ya deja en `observable_events`/`temario_pdf_jobs`, corra cuando corra.
 *
 * Dos aserciones:
 *   1. REGRESIÓN — ningún evento `temario_pdf_served` con `served='generated'` en la ventana. Ese
 *      valor SOLO lo podía emitir el código viejo al renderizar en línea; el código actual no
 *      tiene esa rama. Un solo caso = la ruta volvió a renderizar (rollback, fork, lo que sea).
 *   2. CICLO DE AUTOCURACIÓN — cada miss real (`served='encolado'`) se cruza con su fila en
 *      `temario_pdf_jobs`: ¿el worker lo recogió y lo completó dentro de su cadencia?
 *
 * Cero misses en la ventana NO es un fallo (falta de tráfico, no del código) — mismo principio
 * que `canary-served-rollup.cjs`. Exit 0 = verde (o sin evidencia); exit 1 = regresión o ciclo roto.
 */
const { urlLecturaNegocioConFuente } = require('../lib/db/negocioSoloLectura.cjs')
const { detectaRegresion, clasificaCicloAutocuracion, veredicto } = require('../lib/temario/pdf/canaryNoRender.cjs')

const argHoras = process.argv.indexOf('--horas')
const HORAS = argHoras >= 0 ? Number(process.argv[argHoras + 1]) : 6
const CADENCIA_MIN = Number(process.env.PDF_WORKER_CADENCIA_MIN) || 30

async function main() {
  let resuelto
  try {
    resuelto = urlLecturaNegocioConFuente()
  } catch (e) {
    console.error(`❌ ${e.message}`)
    process.exit(2)
  }
  console.log(`(credencial: ${resuelto.fuente}, ventana: ${HORAS}h)`)

  const postgres = require('postgres')
  const sql = postgres(resuelto.url, { ssl: { rejectUnauthorized: false }, max: 1, connect_timeout: 10 })

  try {
    const servidos = await sql.unsafe(
      `SELECT metadata->>'served' AS served, metadata->>'hash' AS hash, ts
         FROM observable_events
        WHERE event_type = 'temario_pdf_served' AND ts > now() - interval '${HORAS} hours'`,
    )

    const regresiones = detectaRegresion(servidos)
    console.log(`\n▸ 1. regresión (served='generated'): ${regresiones.length}`)
    if (regresiones.length) {
      regresiones.forEach((r) => console.log(`   ❌ ${r.ts} hash=${r.hash}`))
    } else {
      console.log('   ✅ ninguno — la ruta pública no ha vuelto a renderizar en línea')
    }

    const encolados = servidos.filter((s) => s.served === 'encolado')
    console.log(`\n▸ 2. misses reales (served='encolado') en la ventana: ${encolados.length}`)
    let ciclo = []
    if (encolados.length) {
      const hashes = encolados.map((e) => e.hash)
      const jobs = await sql.unsafe(
        `SELECT content_hash, status, last_error FROM temario_pdf_jobs WHERE content_hash = ANY($1)`,
        [hashes],
      )
      ciclo = clasificaCicloAutocuracion(encolados, jobs, CADENCIA_MIN, new Date())
      ciclo.forEach((c) => {
        const icono = c.estado === 'completado' ? '✅' : c.estado === 'en_curso' ? '🟡' : '❌'
        console.log(`   ${icono} hash=${String(c.hash).slice(0, 12)} → ${c.estado}${c.detalle ? ` (${c.detalle})` : ''}`)
      })
    } else {
      console.log('   (sin misses en la ventana — no hay tráfico que provoque uno, no es un fallo)')
    }

    const v = veredicto(regresiones, ciclo)
    console.log(`\n${v.ok ? '✅' : '❌'} ${v.motivo}`)
    process.exit(v.ok ? 0 : 1)
  } finally {
    await sql.end({ timeout: 5 })
  }
}

main().catch((e) => { console.error('❌', e.message); process.exit(1) })
