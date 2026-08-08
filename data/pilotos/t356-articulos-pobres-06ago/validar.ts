#!/usr/bin/env npx tsx
/**
 * Valida la pregunta NUEVA de este lote (T-356) contra los gates REALES de la campaña de
 * calidad de contenido, importados sin reimplementar. Comprueba también, contra el artículo
 * vinculado real en BD, que la cita es literal. SOLO LECTURA (VENCE_LECTOR_URL). Nunca escribe.
 *
 *   npx tsx --env-file=.env.local data/pilotos/t356-articulos-pobres-06ago/validar.ts
 */
import { readFileSync } from 'fs'
import { join } from 'path'
import postgres from 'postgres'
import { isStructuredExplanation, structuredNarrativeStaleLetters } from '@/lib/shuffle/structuredExplanation'
import { explanationReferencesLetters } from '@/lib/shuffle/classifyShuffleMode'

const { citaNoLiteral } = require(join(process.cwd(), 'scripts/impugnaciones/validar-explicacion.cjs'))

const sql = postgres(process.env.VENCE_LECTOR_URL + '?sslmode=require', { ssl: { rejectUnauthorized: false }, max: 2 })

async function main() {
  const q = JSON.parse(readFileSync(join(__dirname, 'ley-39-2015-art49.json'), 'utf8'))
  const nOptions = [q.option_a, q.option_b, q.option_c, q.option_d].filter((v) => v != null && v !== '').length
  const problems: string[] = []

  if (!isStructuredExplanation(q.explanation_data, nOptions)) {
    problems.push(`isStructuredExplanation falla (nOptions=${nOptions})`)
  }
  const stale = structuredNarrativeStaleLetters(q.explanation_data)
  if (stale.length) problems.push('narrativa con letras clavadas: ' + stale.join(','))
  for (const [idx, razon] of Object.entries(q.explanation_data.options as Record<string, string>)) {
    if (explanationReferencesLetters(razon)) problems.push(`opción ${idx} referencia otra opción por letra`)
  }

  const [art] = await sql`SELECT art.content FROM articles art JOIN laws l ON l.id = art.law_id
    WHERE l.short_name = 'Ley 39/2015' AND art.article_number = '49' AND art.is_active`
  const citado = q.explanation_data.cita?.bloque || q.explanation_data.cita?.texto || ''
  if (art && citado) {
    if (citaNoLiteral(citado, art.content)) problems.push('cita NO literal contra el artículo vinculado')
  } else {
    problems.push('no se pudo leer el artículo vinculado para comprobar la cita')
  }

  // No-duplicado: comprobar que el enunciado normalizado no coincide con ninguna de las 4
  // preguntas activas existentes de este artículo (el motivo mismo de T-356: no añadir otra copia).
  const [artId] = await sql`SELECT art.id FROM articles art JOIN laws l ON l.id = art.law_id
    WHERE l.short_name = 'Ley 39/2015' AND art.article_number = '49' AND art.is_active`
  const existentes = await sql`SELECT lower(regexp_replace(question_text, '\s+', ' ', 'g')) AS norm
    FROM questions WHERE primary_article_id = ${artId.id} AND is_active`
  const normNueva = q.question_text.toLowerCase().replace(/\s+/g, ' ').trim()
  const yaExiste = existentes.some((e: { norm: string }) => e.norm.trim() === normNueva)
  if (yaExiste) problems.push('el enunciado YA EXISTE tal cual entre las preguntas activas del artículo')

  if (problems.length) {
    console.log('❌', problems.join(' | '))
    process.exit(1)
  } else {
    console.log(`✅ pregunta nueva válida (nOptions=${nOptions}), gates en verde, no duplica ninguna de las ${existentes.length} activas del artículo.`)
  }
  await sql.end()
}

main().catch((e) => {
  console.error('❌', e)
  process.exit(1)
})
