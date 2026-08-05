#!/usr/bin/env npx tsx
/**
 * sim-estimate-servido.ts — ¿el contador del configurador «por leyes» dice la verdad
 * EN EL CAMINO QUE DE VERDAD SIRVE?
 *
 * ── POR QUÉ HACE FALTA ESTA SIMULACIÓN Y NO BASTABA LA QUE YA HABÍA ──────────────────────
 *
 * `sim-estimate-por-leyes.ts` (T-326) llama a `estimateAvailableQuestions` del FRONTEND,
 * o sea a una función que producción **no ejecuta**: la familia `test-config` está enrutada
 * al backend NestJS (`x-served-by: vence-backend`). Por eso no cazó nada de esto:
 *
 *   · [T-326] la lógica vivía solo en el frontend → el backend contaba distinto.
 *   · [T-551, 04/08] la guarda de degradación estaba en el camino del TEST y no en el del
 *     CONTADOR → Félix Peña (premium) veía 0 donde su selección tenía 1.283 preguntas.
 *   · el arreglo de T-551 se aplicó OTRA VEZ solo al gemelo del frontend, así que el 05/08
 *     producción seguía devolviendo 0 con su combinación real.
 *
 * Tres veces el mismo modo de fallo, y las tres veces las capas existentes daban verde
 * porque preguntaban a la copia equivocada. Esta simulación va por HTTP, así que le da
 * igual quién responda: mide lo que ve el usuario.
 *
 * ── QUÉ COMPRUEBA ────────────────────────────────────────────────────────────────────────
 *
 *   1. DEGRADACIÓN — oposición SIN temario construido: acotar al temario NO puede dar 0.
 *      Tiene que dar lo mismo que sin acotar (no hay temario contra el que recortar).
 *   2. CONTROL — oposición CON temario: acotar SÍ tiene que recortar. Sin este caso, un
 *      "degradar siempre" pasaría la prueba y estaríamos sirviendo materia fuera de programa,
 *      que es el defecto opuesto y peor.
 *
 * El fixture NO está clavado a mano: se descubre de la BD, así que sigue valiendo cuando a
 * la oposición de Félix le construyan el temario.
 *
 * Uso:
 *   npx tsx --env-file=.env.local scripts/sim/sim-estimate-servido.ts
 *   SIM_BASE=https://www.vence.es npx tsx --env-file=.env.local scripts/sim/sim-estimate-servido.ts
 */
import postgres from 'postgres'

const BASE = process.env.SIM_BASE || 'http://localhost:3000'

type Estimacion = { count: number; servidoPor: string }

async function estimar(opts: {
  positionType: string
  leyes: string[]
  acotar: boolean
}): Promise<Estimacion> {
  const url = new URL('/api/v2/test-config/estimate', BASE)
  url.searchParams.set('selectedLaws', opts.leyes.join(','))
  url.searchParams.set('positionType', opts.positionType)
  url.searchParams.set('scopeToPosition', String(opts.acotar))
  const res = await fetch(url, { signal: AbortSignal.timeout(30_000) })
  const body = (await res.json()) as { success?: boolean; count?: number; error?: string }
  if (!res.ok || !body.success) {
    throw new Error(`HTTP ${res.status} — ${body.error ?? 'sin cuerpo'}`)
  }
  return {
    count: Number(body.count ?? 0),
    servidoPor: res.headers.get('x-served-by') ?? '(no lo dice)',
  }
}

async function main() {
  const sql = postgres(process.env.DATABASE_URL as string, {
    ssl: { rejectUnauthorized: false },
    max: 1,
  })

  // ── Fixtures descubiertos, no clavados ────────────────────────────────────────────────
  //
  // SIN temario: una oposición que la gente TIENE elegida (si no, no le duele a nadie) con
  // cero filas de topic_scope, y una ley con preguntas de sobra para que el número se note.
  const [sinTemario] = await sql<{ position_type: string; ley: string; n: number }[]>`
    WITH elegidas AS (
      SELECT target_oposicion AS pt, count(*) AS usuarios
        FROM user_profiles
       WHERE target_oposicion IS NOT NULL AND target_oposicion <> ''
       GROUP BY 1
    ),
    sin_scope AS (
      SELECT e.pt
        FROM elegidas e
       WHERE NOT EXISTS (
         SELECT 1 FROM topics t JOIN topic_scope ts ON ts.topic_id = t.id
          WHERE t.position_type = e.pt
       )
       ORDER BY e.usuarios DESC
       LIMIT 1
    )
    SELECT s.pt AS position_type, l.short_name AS ley, count(*)::int AS n
      FROM sin_scope s
      CROSS JOIN questions q
      JOIN articles a ON a.id = q.primary_article_id
      JOIN laws l ON l.id = a.law_id
     WHERE q.is_active AND l.short_name = 'CE'
     GROUP BY 1, 2`

  // CON temario: el control. Una oposición viva cuyo scope de esa ley NO sea la ley entera
  // (si `article_numbers IS NULL` el scope ES toda la ley y acotar no recorta nada — sería
  // un control que no controla).
  const [conTemario] = await sql<{ position_type: string; ley: string }[]>`
    SELECT t.position_type, l.short_name AS ley
      FROM topic_scope ts
      JOIN topics t ON t.id = ts.topic_id
      JOIN laws l ON l.id = ts.law_id
     WHERE ts.article_numbers IS NOT NULL
       AND array_length(ts.article_numbers, 1) BETWEEN 1 AND 20
       AND EXISTS (
         SELECT 1 FROM questions q JOIN articles a ON a.id = q.primary_article_id
          WHERE a.law_id = l.id AND q.is_active
       )
     ORDER BY t.position_type, l.short_name
     LIMIT 1`

  await sql.end()

  console.log(`\n🌐 base: ${BASE}\n`)
  const fallos: string[] = []

  // ── 1. Degradación ────────────────────────────────────────────────────────────────────
  if (!sinTemario) {
    console.log('⚠️  no hay ninguna oposición elegida sin temario — no se puede medir la degradación')
  } else {
    const { position_type, ley } = sinTemario
    const suelto = await estimar({ positionType: position_type, leyes: [ley], acotar: false })
    const acotado = await estimar({ positionType: position_type, leyes: [ley], acotar: true })
    console.log(`── SIN temario: ${position_type} · ley ${ley}`)
    console.log(`   sin acotar: ${suelto.count}   ·   acotado: ${acotado.count}   (sirve: ${acotado.servidoPor})`)
    if (suelto.count === 0) {
      console.log('   ⚠️  la ley no tiene preguntas: el caso no mide nada')
    } else if (acotado.count === 0) {
      fallos.push(
        `${position_type}: acotar al temario da 0 y sin acotar da ${suelto.count} — el usuario no puede lanzar el test`,
      )
      console.log('   ❌ CERO al acotar — es el defecto de T-551, vivo')
    } else if (acotado.count !== suelto.count) {
      fallos.push(
        `${position_type}: sin temario debería degradar a ${suelto.count} y da ${acotado.count}`,
      )
      console.log('   ❌ degrada a medias')
    } else {
      console.log('   ✅ degrada: acotar no recorta porque no hay temario contra el que recortar')
    }
  }

  // ── 2. Control ────────────────────────────────────────────────────────────────────────
  if (!conTemario) {
    console.log('\n⚠️  no se encontró oposición con scope acotado — sin control, el verde no vale')
    fallos.push('no hay caso de control: no se puede afirmar que el acotado siga acotando')
  } else {
    const { position_type, ley } = conTemario
    const suelto = await estimar({ positionType: position_type, leyes: [ley], acotar: false })
    const acotado = await estimar({ positionType: position_type, leyes: [ley], acotar: true })
    console.log(`\n── CON temario (control): ${position_type} · ley ${ley}`)
    console.log(`   sin acotar: ${suelto.count}   ·   acotado: ${acotado.count}   (sirve: ${acotado.servidoPor})`)
    if (acotado.count >= suelto.count && suelto.count > 0) {
      fallos.push(
        `${position_type}: acotar NO recortó (${acotado.count} de ${suelto.count}) — se estaría sirviendo materia fuera de programa`,
      )
      console.log('   ❌ acotar dejó de acotar')
    } else {
      console.log('   ✅ acotar sigue recortando al temario')
    }
  }

  console.log('')
  if (fallos.length) {
    for (const f of fallos) console.log(`❌ ${f}`)
    process.exit(1)
  }
  console.log('✅ el contador dice la verdad en el camino que de verdad sirve')
}

main().catch(e => {
  console.error('💥', e instanceof Error ? e.message : e)
  process.exit(1)
})
