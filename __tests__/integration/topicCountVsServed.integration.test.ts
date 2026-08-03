/**
 * @jest-environment node
 */
// __tests__/integration/topicCountVsServed.integration.test.ts
//
// [T-507] El rótulo del tema DEBE prometer lo que el test entrega.
//
// Hermano de `articleTestCount.integration.test.ts` (que ata el CTA por artículo)
// para la otra superficie: el contador del TEMA. Aquí no se compara contra una
// reimplementación del criterio, sino contra la función que sirve de verdad
// (`getFilteredQuestions`, la de /api/questions/filtered): se pide el tema entero
// y se cuenta lo que devuelve.
//
// EL FALLO QUE ATA (feedback 8b788ee0, 03/08/2026): subalterno_gva tema 3
// anunciaba 39 preguntas y el test solo podía dar 22. Las 17 restantes son de
// exámenes oficiales de `auxiliar_administrativo_valencia`, que
// `buildOfficialExamFilter` descarta SIEMPRE al servir (anti-contaminación, caso
// Laura) y que los contadores sumaban igual. La usuaria (premium) veía "las
// mismas todo el rato" y un rótulo prometiendo más: 122 respuestas suyas sobre
// esas 22 preguntas, y ni una sola oficial servida en toda su historia.
import dotenv from 'dotenv'
import { getFilteredQuestions } from '@/lib/api/filtered-questions'
import { getTopicFullData } from '@/lib/api/topic-data/queries'
import { EXCLUSIVE_QUESTION_TAGS, getOposicionByPositionType } from '@/lib/config/oposiciones'
import { getValidExamPositions } from '@/lib/config/exam-positions'
import { openTestClient } from '../helpers/db'

dotenv.config({ path: '.env.local', override: true })
// Mismo motivo que en articleTestCount: postgres-js es sensible al sslmode de la
// URL y estas funciones usan el cliente de la app, no el helper de tests.
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0'

const describeIfDb = process.env.DATABASE_URL ? describe : describe.skip

/** Lo que el test entrega de verdad para un tema (sin usuario → sin exclude-recent). */
async function servidasPorElTest(positionType: string, topicNumber: number): Promise<number> {
  const res = await getFilteredQuestions({
    topicNumber,
    positionType: positionType as never,
    numQuestions: 2000, // techo alto: queremos TODO lo servible, no una tanda
    selectedLaws: [],
    selectedArticlesByLaw: {},
    selectedSectionFilters: [],
    onlyOfficialQuestions: false,
  } as never)
  return res.questions.length
}

/** Lo que el rótulo anuncia (la misma función que alimenta la ficha del tema). */
async function anunciadas(oposicionSlug: string, topicNumber: number): Promise<number> {
  const data = await getTopicFullData(topicNumber, oposicionSlug as never)
  return data.totalQuestions ?? 0
}

/**
 * Preguntas del scope de un tema que el serve descarta POR TAG (la otra
 * divergencia contador↔serve, todavía abierta). Se cuenta con la misma
 * configuración de la que bebe `buildQuestionTagFilter`, no con una lista propia.
 */
async function excluidasPorTag(positionType: string, topicNumber: number): Promise<number> {
  const client = await openTestClient()
  try {
    const tagPropio = getOposicionByPositionType(positionType)?.questionTag ?? null
    const valid = getValidExamPositions(positionType)
    // NULL-safe a propósito: `NOT (NULL @> ARRAY['PN'])` es NULL, no TRUE, así que
    // sin el `IS NULL` se dejan de contar las preguntas SIN etiquetas — que el
    // serve sí descarta. Esa trampa costó 386 preguntas de diferencia inexplicada
    // en Policía Nacional T21 al escribir este test.
    const condicionTag = tagPropio
      ? `(q.tags IS NULL OR NOT (q.tags @> ARRAY[$3]::text[]))`
      : `q.tags && $3::text[]`
    const { rows } = await client.query(
      `WITH cand AS (
         SELECT DISTINCT q.id, q.is_official_exam, q.exam_position, q.tags
           FROM topics t
           JOIN topic_scope ts ON ts.topic_id = t.id
           JOIN articles a ON a.law_id = ts.law_id
             AND (ts.article_numbers IS NULL OR a.article_number = ANY(ts.article_numbers))
           JOIN questions q ON q.primary_article_id = a.id
          WHERE t.position_type = $1 AND t.topic_number = $2
            AND t.is_active AND q.is_active AND q.exam_case_id IS NULL)
       SELECT count(*)::int AS n FROM cand q
        WHERE NOT (q.is_official_exam AND NOT (q.exam_position = ANY($4)))
          AND ${condicionTag}`,
      [positionType, topicNumber, tagPropio ?? EXCLUSIVE_QUESTION_TAGS, valid],
    )
    return Number(rows[0]?.n ?? 0)
  } finally {
    await client.end()
  }
}

describeIfDb('Contador del tema == preguntas servidas (RDS)', () => {
  // Temas reales, elegidos por lo que cada uno EJERCITA, no al azar:
  const CASOS: Array<{ slug: string; positionType: string; topic: number; porQue: string }> = [
    {
      slug: 'subalterno-gva',
      positionType: 'subalterno_gva',
      topic: 3,
      porQue: 'el caso que lo destapó: oposición SIN oficiales propias, 17 ajenas en el scope',
    },
    {
      slug: 'subalterno-gva',
      positionType: 'subalterno_gva',
      topic: 12,
      porQue: 'contraste: mismo temario, tema SIN ninguna oficial (no debe cambiar nada)',
    },
    {
      slug: 'auxiliar-administrativo-estado',
      positionType: 'auxiliar_administrativo_estado',
      topic: 1,
      porQue: 'oposición CON oficiales propias, y con preguntas de tag ajeno en su scope',
    },
    {
      slug: 'policia-nacional',
      positionType: 'policia_nacional',
      topic: 21,
      porQue: 'el extremo del tag: sirve solo lo etiquetado como suyo',
    },
  ]

  // La brecha que queda tras el arreglo de oficiales tiene que ser EXACTAMENTE la
  // del filtro de tag: ni una pregunta más. Así este test pincha tanto si vuelve
  // el fallo de las oficiales como si aparece una tercera causa que nadie ha visto.
  for (const { slug, positionType, topic, porQue } of CASOS) {
    it(`${slug} T${topic}: lo anunciado menos lo servido es SOLO el filtro de tag (${porQue})`, async () => {
      const [anuncia, sirve, porTag] = await Promise.all([
        anunciadas(slug, topic),
        servidasPorElTest(positionType, topic),
        excluidasPorTag(positionType, topic),
      ])

      expect(sirve).toBeGreaterThan(0)
      expect(anuncia - sirve).toBe(porTag)
    }, 180000)
  }

  it('subalterno-gva T3 anuncia 22 y sirve 22 (los números exactos del caso de Neus)', async () => {
    const [anuncia, sirve] = await Promise.all([
      anunciadas('subalterno-gva', 3),
      servidasPorElTest('subalterno_gva', 3),
    ])
    expect(anuncia).toBe(22)
    expect(sirve).toBe(22)
  }, 180000)
})

// ─────────────────────────────────────────────────────────────────────────────
// DEUDA DECLARADA, no silenciada.
//
// La segunda divergencia de la MISMA clase sigue abierta: el serve aplica también
// `buildQuestionTagFilter` y ningún contador lo aplica. Afecta a 1.373 temas
// (medido el 03/08/2026) y su caso extremo es Policía Nacional, cuyo tema 21
// anuncia 2.012 y sirve 222. NO se cierra aquí porque bajar ese número es una
// decisión de producto, no un fix de contador (ficha aparte).
//
// Los tests de arriba la miden en vez de taparla: el día que se cierre, la
// diferencia pasará a ser 0 y seguirán pasando sin tocar nada.
// ─────────────────────────────────────────────────────────────────────────────
