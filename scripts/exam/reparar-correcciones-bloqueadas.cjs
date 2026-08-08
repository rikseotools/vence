#!/usr/bin/env node
// scripts/exam/reparar-correcciones-bloqueadas.cjs
//
// Devuelve su nota a los exámenes cuya CORRECCIÓN falló, no a los que se abandonaron.
//
// ## Por qué existe ([T-671], 08/08/2026)
//
// Cuando la corrección de un examen es rechazada (el cliente llama sin token → 401/403), las
// respuestas YA están guardadas y corregidas en `test_questions`, pero la fila de `tests` se
// queda `is_completed=false` con `score=0`. El trabajo está entero en la base de datos y el
// opositor no lo puede ver por ninguna pantalla: para él, la hora que echó no existe.
//
// El criterio de qué es reparable vive en el núcleo puro `lib/exam/correccionBloqueada.ts`
// (con los ocho exámenes reales del caso como test). Aquí solo se ejecuta.
//
// ## Dos decisiones que lo hacen seguro
//
//   1. **No escribe SQL propio: llama a `completeExam()`**, el mismo escritor que usa
//      `/api/exam/complete`. Un segundo camino que marcara exámenes como completados sería la
//      tercera puerta al mismo recurso, y el día que cambie la regla de puntuación una de las
//      dos se quedaría atrás.
//   2. **Simula por defecto.** Sin `--aplicar` no toca nada; imprime a quién afectaría y con
//      qué nota. Marcar exámenes ajenos como terminados no se deshace solo.
//
// Uso:
//   node scripts/exam/reparar-correcciones-bloqueadas.cjs --email <correo>        # simula
//   node scripts/exam/reparar-correcciones-bloqueadas.cjs --email <correo> --aplicar
//   node scripts/exam/reparar-correcciones-bloqueadas.cjs --desde 2026-08-07 --hasta 2026-08-08
require('dotenv').config({ path: '.env.local' })
const { pgConfig } = require('../../lib/db/pgSsl.cjs')
const { Client } = require('pg')

require('tsx/cjs')
const { estadoDeExamen, esReparable } = require('../../lib/exam/correccionBloqueada.ts')
const { completeExam } = require('../../lib/api/exam/queries.ts')

const args = process.argv.slice(2)
const val = (f) => { const i = args.indexOf(f); return i >= 0 ? args[i + 1] : null }
const APLICAR = args.includes('--aplicar')
const EMAIL = val('--email')
const DESDE = val('--desde')
const HASTA = val('--hasta')

if (!EMAIL && !DESDE) {
  console.error('Hace falta acotar: --email <correo> o --desde <fecha> [--hasta <fecha>].')
  console.error('Sin acotar, esto recorrería el banco entero de exámenes abandonados.')
  process.exit(2)
}

;(async () => {
  const c = new Client(pgConfig(process.env.DATABASE_URL))
  await c.connect()

  // Se traen TODOS los candidatos (sin completar y con alguna respuesta) y el criterio lo pone
  // el núcleo puro, no el WHERE: así el SQL no puede divergir de lo que dicen los tests.
  const { rows } = await c.query(`
    SELECT t.id, t.user_id, u.email, t.created_at, t.tema_number, t.total_questions,
           -- OJO: user_answer se pre-crea como cadena VACIA al abrir el examen, no como NULL.
           -- Filtrar por IS NOT NULL cuenta como respondido lo que nadie toco: costo marcar
           -- 8 examenes con un 0 sobre 73/97/80 a gente que solo los habia abierto (08/08).
           count(q.id) FILTER (WHERE coalesce(q.user_answer, '') <> '')::int AS respondidas,
           count(q.id) FILTER (WHERE coalesce(q.user_answer, '') <> '' AND q.is_correct IS NOT NULL)::int AS corregidas,
           count(q.id) FILTER (WHERE q.is_correct IS TRUE)::int              AS aciertos
      FROM tests t
      JOIN user_profiles u ON u.id = t.user_id
      LEFT JOIN test_questions q ON q.test_id = t.id
     WHERE t.test_type = 'exam'
       AND t.is_completed = false
       AND ($1::text IS NULL OR u.email = $1)
       AND ($2::date IS NULL OR t.created_at >= $2::date)
       AND ($3::date IS NULL OR t.created_at < ($3::date + 1))
     GROUP BY t.id, t.user_id, u.email, t.created_at, t.tema_number, t.total_questions
     ORDER BY t.created_at`, [EMAIL, DESDE, HASTA])

  const clasificados = rows.map((r) => ({
    ...r,
    estado: estadoDeExamen({
      isCompleted: false,
      totalQuestions: r.total_questions,
      respondidas: r.respondidas,
      corregidas: r.corregidas,
    }),
  }))
  const reparables = clasificados.filter((r) => esReparable(r.estado))

  const porEstado = clasificados.reduce((a, r) => ({ ...a, [r.estado]: (a[r.estado] || 0) + 1 }), {})
  console.log(`🔎 ${clasificados.length} examen(es) sin completar — ${JSON.stringify(porEstado)}`)
  console.log(`   ▶ ${reparables.length} reparable(s): respondieron y solo faltó cerrar la corrección\n`)

  for (const r of reparables) {
    console.log(`   ${r.email} · tema ${r.tema_number ?? '?'} · ${r.created_at.toISOString().slice(0, 16)}` +
      ` → ${r.aciertos}/${r.respondidas}`)
  }
  // Lo NO reparado también se canta: un recuento que solo enseña lo que hace es un recuento
  // que oculta lo que deja fuera.
  const dejados = clasificados.filter((r) => !esReparable(r.estado))
  if (dejados.length) {
    console.log(`\n   (${dejados.length} sin tocar: ${dejados.filter(d => d.estado === 'abandonado').length} abandonados a medias,` +
      ` ${dejados.filter(d => d.estado === 'vacio').length} sin ninguna respuesta)`)
  }

  if (!APLICAR) {
    console.log('\n   ▶ SIMULACIÓN. Repite con --aplicar para devolverles su nota.')
    await c.end()
    return
  }

  let hechos = 0
  for (const r of reparables) {
    // `force: true` porque el opositor pudo entregar con alguna en blanco (23 de 25); el corte
    // de «esto es entregar y no irse» ya lo puso el núcleo puro, no se delega a este flag.
    const res = await completeExam(r.id, true)
    if (!res.success) {
      console.error(`   ⚠️ ${r.id}: ${res.error}`)
      continue
    }
    hechos++
    console.log(`   ✅ ${r.email} · tema ${r.tema_number ?? '?'} → ${res.finalScore}/${res.totalQuestions}`)
  }

  // Deja rastro: una reparación que solo existió en la terminal de quien la corrió no se puede
  // auditar después, y aquí se está tocando la nota de un examen de otra persona.
  await c.query(`
    INSERT INTO observable_events (source, severity, event_type, endpoint, metadata)
    VALUES ('gha', 'info', 'examenes_correccion_reparados', 'reparar-correcciones-bloqueadas', $1::jsonb)`,
    [JSON.stringify({
      candidatos: clasificados.length,
      reparables: reparables.length,
      reparados: hechos,
      acotado: { email: EMAIL, desde: DESDE, hasta: HASTA },
      tests: reparables.map((r) => r.id),
    })])

  console.log(`\n✅ ${hechos}/${reparables.length} examen(es) con su nota devuelta · evento emitido`)
  await c.end()
})().catch((e) => { console.error(e); process.exit(1) })
