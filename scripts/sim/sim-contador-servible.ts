// scripts/sim/sim-contador-servible.ts
//
// ¿Cuánto se separa lo que ANUNCIAMOS de lo que el test puede SERVIR?
//
//   npm run sim:contador-servible                 # foto del banco entero
//   npm run sim:contador-servible -- --oposicion subalterno_gva
//
// Esto MIDE; no es la puerta. La puerta por oposición es `npm run audit:served`
// (compara contra la función de producción, tema a tema) y el trinquete en CI es
// `__tests__/integration/topicCountVsServed.integration.test.ts`.
//
// POR QUÉ EXISTE [T-507]. El serve aplica dos filtros que ningún contador aplicaba:
//   · buildOfficialExamFilter — una oficial solo se sirve si su exam_position es de
//     TU oposición (anti-contaminación, caso Laura 14/04/2026)
//   · buildQuestionTagFilter  — con tag propio solo se sirve lo etiquetado; sin él,
//     se excluye lo etiquetado como exclusivo de otras
// Resultado: la tarjeta prometía preguntas que el test no tiene. Lo cazó una usuaria
// premium (feedback 8b788ee0): tema 3 de subalterno_gva anunciaba 39 y servía 22.
//
// La brecha de OFICIALES está cerrada.
// La del TAG sigue abierta a propósito (decisión de producto, ficha aparte): aquí se
// MIDE, para que sea un número que se mira y no una sorpresa.
//
// NO reimplementa el criterio: lee `getValidExamPositions` y `questionTag` de la
// misma configuración de la que beben los filtros de producción.
//
// ⚠️ GOTCHA DE MEDICIÓN, que ya mordió una vez al escribir esto: la condición del
// tag tiene que ser NULL-SAFE. `NOT (tags @> ARRAY['PN'])` vale NULL cuando `tags`
// es NULL, así que deja de contar preguntas que el serve SÍ descarta — daban 386
// preguntas de diferencia inexplicada en Policía Nacional T21 y hacían parecer que
// la oposición servía 608 cuando sirve 222.
import 'dotenv/config'
import { Client } from 'pg'
import { EXCLUSIVE_QUESTION_TAGS, OPOSICIONES } from '../../lib/config/oposiciones'
import { getValidExamPositions } from '../../lib/config/exam-positions'
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { pgConfig } = require('../../lib/db/pgSsl.cjs')

type Fila = {
  position_type: string
  topic_number: number
  anunciado: number
  ajenas_oficiales: number
  excluidas_tag: number
  servible: number
}

const args = process.argv.slice(2)
const soloOposicion = args.includes('--oposicion') ? args[args.indexOf('--oposicion') + 1] : null

function lit(s: string) {
  return `'${String(s).replace(/'/g, "''")}'`
}

async function main() {
  const c = new Client(pgConfig(process.env.DATABASE_URL!))
  await c.connect()

  const tagPorPt = new Map<string, string | null>()
  for (const o of OPOSICIONES as Array<{ positionType: string; questionTag?: string }>) {
    tagPorPt.set(o.positionType, o.questionTag ?? null)
  }

  const { rows: pts } = await c.query<{ position_type: string }>(
    `SELECT DISTINCT position_type FROM topics WHERE is_active${soloOposicion ? ' AND position_type = $1' : ''}`,
    soloOposicion ? [soloOposicion] : [],
  )
  if (pts.length === 0) {
    console.log(`Sin temas activos${soloOposicion ? ` para ${soloOposicion}` : ''}.`)
    await c.end()
    return
  }

  // Tabla de parámetros por oposición (posiciones válidas + tag propio), para
  // resolver los dos filtros DENTRO de la consulta y no fila a fila en JS.
  const values = pts
    .map(({ position_type: pt }) => {
      const valid = getValidExamPositions(pt) || []
      const tag = tagPorPt.get(pt) ?? null
      return `(${lit(pt)}, ARRAY[${valid.map(lit).join(',')}]::text[], ${tag ? lit(tag) : 'NULL'})`
    })
    .join(',')
  const exclusivos = EXCLUSIVE_QUESTION_TAGS.map(lit).join(',') || lit('__ninguno__')

  const { rows } = await c.query<Fila>(`
    WITH par(pt, valid, tag) AS (VALUES ${values}),
    cand AS (
      SELECT DISTINCT t.position_type, t.topic_number, q.id AS qid,
             q.is_official_exam, q.exam_position, q.tags
        FROM topics t
        JOIN topic_scope ts ON ts.topic_id = t.id
        JOIN articles a ON a.law_id = ts.law_id
          AND (ts.article_numbers IS NULL OR a.article_number = ANY(ts.article_numbers))
        JOIN questions q ON q.primary_article_id = a.id
       WHERE t.is_active AND q.is_active AND q.exam_case_id IS NULL
    ),
    marcada AS (
      SELECT c.position_type, c.topic_number,
             (c.is_official_exam AND NOT (COALESCE(lower(c.exam_position), '') = ANY(p.valid))) AS es_ajena,
             (CASE WHEN p.tag IS NOT NULL
                   THEN (c.tags IS NULL OR NOT (c.tags @> ARRAY[p.tag]::text[]))
                   ELSE (c.tags && ARRAY[${exclusivos}]::text[])
              END) AS fuera_por_tag
        FROM cand c JOIN par p ON p.pt = c.position_type
    )
    SELECT position_type, topic_number,
           count(*) FILTER (WHERE NOT es_ajena)::int AS anunciado,
           count(*) FILTER (WHERE es_ajena)::int AS ajenas_oficiales,
           count(*) FILTER (WHERE NOT es_ajena AND fuera_por_tag)::int AS excluidas_tag,
           count(*) FILTER (WHERE NOT es_ajena AND NOT fuera_por_tag)::int AS servible
      FROM marcada
     GROUP BY 1, 2
     ORDER BY 1, 2`)

  const conAjenas = rows.filter((r) => r.ajenas_oficiales > 0)
  const conTag = rows.filter((r) => r.excluidas_tag > 0)
  const sumar = (xs: Fila[], k: keyof Fila) => xs.reduce((a, b) => a + Number(b[k]), 0)

  console.log(`\n━━━ contador anunciado vs servible ━━━  (${rows.length} temas activos con preguntas)\n`)
  console.log(`🏛️  oficiales de OTRA oposición  → ${conAjenas.length} temas · ${sumar(conAjenas, 'ajenas_oficiales')} preguntas`)
  console.log(`     ESTADO: descontadas del anuncio desde [T-507] — este número es cuánto se descuenta, no una brecha.`)
  console.log(`🏷️  excluidas por TAG            → ${conTag.length} temas · ${sumar(conTag, 'excluidas_tag')} preguntas`)
  console.log(`     ESTADO: DEUDA ABIERTA — el contador las sigue anunciando y el test no las da.`)

  const peores = [...conTag]
    .filter((r) => r.anunciado > 0)
    .sort((a, b) => b.excluidas_tag / b.anunciado - a.excluidas_tag / a.anunciado)
    .slice(0, 10)
  if (peores.length) {
    console.log(`\nLos 10 temas donde más se nota la deuda del tag:`)
    console.table(
      peores.map((r) => ({
        oposicion: r.position_type.slice(0, 34),
        tema: r.topic_number,
        anuncia: r.anunciado,
        sirve: r.servible,
        'de más': r.excluidas_tag,
        '%': `${Math.round((100 * r.excluidas_tag) / r.anunciado)}%`,
      })),
    )
  }

  await c.end()
}
main().catch((e) => {
  console.error(e)
  process.exit(1)
})
