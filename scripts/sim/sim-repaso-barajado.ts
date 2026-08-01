#!/usr/bin/env npx tsx
/**
 * ¿La pantalla de repaso señala la opción CORRECTA cuando el test se sirvió barajado? (T-472)
 *
 * No razona sobre el código: **ejecuta la misma función que sirve el endpoint**
 * (`getTestReview`) sobre los tests REALES que tienen exposiciones barajadas, y comprueba
 * la única propiedad que le importa al opositor:
 *
 *     el TEXTO de la opción que la pantalla marca como correcta
 *     === el TEXTO de la opción que `questions.correct_option` dice que es la correcta
 *
 * Comparar TEXTOS (y no letras contra letras) es lo que hace la prueba honesta: la letra es
 * justo el dato que estaba mal, así que verificarla contra sí misma no probaría nada.
 *
 * De paso mide el defecto ANTES del arreglo —aplicando a los mismos datos lo que hacía el
 * código viejo (letra guardada tal cual sobre las opciones mostradas)— para que la mejora
 * sea un número y no una impresión.
 *
 * Solo LEE. No escribe ni una fila.
 *
 * Uso:  npm run sim:repaso-barajado            (todos los tests con barajado)
 *       npm run sim:repaso-barajado -- --test <uuid>
 */
import postgres from 'postgres'
import { getTestReview } from '../../lib/api/test-review/queries'

const LETRAS = ['A', 'B', 'C', 'D', 'E']

const argTest = (() => {
  const i = process.argv.indexOf('--test')
  return i > -1 ? process.argv[i + 1] : null
})()

const sql = postgres(process.env.DATABASE_URL!, { ssl: { rejectUnauthorized: false }, max: 2 })

interface Veredicto {
  testId: string
  questionId: string
  letraServida: string
  textoServido: string | null
  textoVerdadero: string
  okAhora: boolean
  okAntes: boolean
  barajada: boolean
}

async function main() {
  console.log('🔀 SIMULACIÓN — el repaso de un test barajado señala la opción correcta\n')

  // 1. Tests con al menos una exposición barajada (el universo del defecto).
  const filas = argTest
    ? await sql<{ test_id: string }[]>`
        SELECT DISTINCT test_id FROM test_questions WHERE test_id = ${argTest}::uuid`
    : await sql<{ test_id: string }[]>`
        SELECT DISTINCT test_id
        FROM test_questions
        WHERE option_order IS NOT NULL AND option_order <> ARRAY[0,1,2,3]
        ORDER BY test_id`

  console.log(`Tests con exposiciones barajadas: ${filas.length}`)
  if (filas.length === 0) {
    console.log('⚠️  Nada que simular: no hay ni una exposición barajada en la BD.')
    console.log('   (Con el piloto apagado esto es lo esperado — no es un verde.)')
    await sql.end()
    process.exit(0)
  }

  // 2. La VERDAD del banco: qué opción es la correcta, por su TEXTO.
  const verdad = new Map<string, { texto: string; opciones: (string | null)[] }>()
  const qids = await sql<{ question_id: string }[]>`
    SELECT DISTINCT question_id FROM test_questions
    WHERE test_id = ANY(${filas.map((f) => f.test_id)}::uuid[]) AND question_id IS NOT NULL`
  const preguntas = await sql<
    { id: string; correct_option: number; a: string; b: string; c: string; d: string; e: string }[]
  >`
    SELECT id, correct_option, option_a AS a, option_b AS b, option_c AS c, option_d AS d, option_e AS e
    FROM questions WHERE id = ANY(${qids.map((q) => q.question_id)}::uuid[])`
  for (const q of preguntas) {
    const opciones = [q.a, q.b, q.c, q.d, q.e]
    const texto = opciones[q.correct_option]
    if (texto) verdad.set(q.id, { texto, opciones })
  }

  // 3. Estado guardado por fila (para reproducir el comportamiento ANTERIOR al arreglo).
  const guardado = new Map<string, { letra: string; orden: number[] | null }>()
  const crudas = await sql<
    { test_id: string; question_id: string; correct_answer: string; option_order: number[] | null }[]
  >`
    SELECT test_id, question_id, correct_answer, option_order
    FROM test_questions
    WHERE test_id = ANY(${filas.map((f) => f.test_id)}::uuid[]) AND question_id IS NOT NULL`
  for (const r of crudas) {
    guardado.set(`${r.test_id}::${r.question_id}`, {
      letra: (r.correct_answer || '').toUpperCase(),
      orden: r.option_order,
    })
  }

  // 4. EJECUTAR la query real de la pantalla de repaso, test por test.
  const veredictos: Veredicto[] = []
  let saltados = 0
  for (const { test_id } of filas) {
    const review = await getTestReview({ testId: test_id })
    if (!review.success || !review.questions?.length) {
      saltados++
      continue
    }
    for (const q of review.questions) {
      if (q.isPsychometric) continue
      const v = verdad.get(q.id)
      if (!v) continue
      const g = guardado.get(`${test_id}::${q.id}`)
      const idxServido = LETRAS.indexOf(q.correctAnswer)
      const textoServido = idxServido >= 0 ? (q.options[idxServido] ?? null) : null
      // Comportamiento ANTERIOR: la letra guardada (coords de BD) sobre las opciones mostradas.
      const idxAntes = g ? LETRAS.indexOf(g.letra) : -1
      const textoAntes = idxAntes >= 0 ? (q.options[idxAntes] ?? null) : null
      veredictos.push({
        testId: test_id,
        questionId: q.id,
        letraServida: q.correctAnswer,
        textoServido,
        textoVerdadero: v.texto,
        okAhora: textoServido === v.texto,
        okAntes: textoAntes === v.texto,
        barajada: Array.isArray(g?.orden),
      })
    }
  }

  // 5. Veredicto.
  const total = veredictos.length
  const barajadas = veredictos.filter((v) => v.barajada)
  const malAntes = veredictos.filter((v) => !v.okAntes)
  const malAhora = veredictos.filter((v) => !v.okAhora)

  console.log(`Tests no evaluables (sin completar / sin datos): ${saltados}`)
  console.log(`Preguntas comprobadas: ${total} (barajadas: ${barajadas.length})\n`)
  console.log(`ANTES del arreglo → señalaban la opción equivocada: ${malAntes.length}`)
  console.log(`AHORA             → señalan la opción equivocada:   ${malAhora.length}`)

  if (malAhora.length > 0) {
    console.log('\n❌ CASOS QUE SIGUEN MAL (primeros 10):')
    for (const v of malAhora.slice(0, 10)) {
      console.log(`   test ${v.testId.slice(0, 8)} · pregunta ${v.questionId.slice(0, 8)} · letra servida ${v.letraServida}`)
      console.log(`      pinta:  ${String(v.textoServido).slice(0, 90)}`)
      console.log(`      debía:  ${v.textoVerdadero.slice(0, 90)}`)
    }
  }

  // Un cero NO es un verde si no se ha llegado a mirar nada: distinguir "limpio" de
  // "no evaluado" es la diferencia entre una prueba y un adorno.
  if (barajadas.length === 0) {
    console.log('\n⚠️  NO CONCLUYENTE — no se ha podido comprobar ni una exposición barajada.')
    console.log('   Revisa la conexión, el shape de getTestReview o el universo de tests.')
    await sql.end()
    process.exit(2)
  }

  if (malAhora.length === 0) {
    console.log(
      `\n✅ VERDE — ${barajadas.length} exposiciones barajadas señalan la opción correcta` +
        (malAntes.length > 0 ? ` (el arreglo repara ${malAntes.length} que estaban mal).` : '.'),
    )
  }

  await sql.end()
  process.exit(malAhora.length === 0 ? 0 : 1)
}

main().catch(async (e) => {
  console.error('💥 ERROR:', e)
  await sql.end().catch(() => {})
  process.exit(2)
})
