#!/usr/bin/env npx tsx
/**
 * Valida las explicaciones estructuradas de este lote contra los gates REALES de la campaña
 * T-291 (importados, no reimplementados) + lee la pregunta viva vía VENCE_LECTOR_URL (solo
 * lectura) para comprobar nOptions y el artículo vinculado. NUNCA escribe.
 *
 *   npx tsx --env-file=.env.local data/pilotos/t291-ce-06ago/validar.ts
 */
import { readFileSync, readdirSync } from 'fs'
import { join } from 'path'
import postgres from 'postgres'
import {
  isStructuredExplanation,
  structuredNarrativeStaleLetters,
} from '@/lib/shuffle/structuredExplanation'
import { explanationReferencesLetters } from '@/lib/shuffle/classifyShuffleMode'

const { citaNoLiteral } = require(join(process.cwd(), 'scripts/impugnaciones/validar-explicacion.cjs'))

const DIR = join(__dirname, 'estructuradas')
const sql = postgres(process.env.VENCE_LECTOR_URL + '?sslmode=require', {
  ssl: { rejectUnauthorized: false },
  max: 2,
})

async function main() {
  const files = readdirSync(DIR).filter((f) => f.endsWith('.json'))
  let ok = 0,
    fail = 0
  for (const f of files) {
    const qid = f.replace('.json', '')
    const data = JSON.parse(readFileSync(join(DIR, f), 'utf8'))
    const [q] = await sql`SELECT question_text, option_a, option_b, option_c, option_d, correct_option, primary_article_id
      FROM questions WHERE id = ${qid}`
    if (!q) {
      console.log(qid, '❌ no encontrada en BD')
      fail++
      continue
    }
    const nOptions = [q.option_a, q.option_b, q.option_c, q.option_d].filter((v) => v != null && v !== '').length
    const problems: string[] = []
    if (!isStructuredExplanation(data, nOptions)) {
      problems.push(`isStructuredExplanation falla (falta razón para algún índice 0..${nOptions - 1})`)
    }
    const staleLetters = structuredNarrativeStaleLetters(data)
    if (staleLetters.length) problems.push('narrativa con letras clavadas: ' + staleLetters.join(','))
    for (const [idx, razon] of Object.entries(data.options as Record<string, string>)) {
      if (explanationReferencesLetters(razon)) {
        problems.push(`opción ${idx} referencia otra opción por letra: "${(razon as string).slice(0, 60)}"`)
      }
    }
    if (data.cita) {
      const [art] = await sql`SELECT content FROM articles WHERE id = ${q.primary_article_id}`
      const citado = data.cita.bloque || data.cita.texto || ''
      if (art && citado) {
        const noLiteral = citaNoLiteral(citado, art.content)
        if (noLiteral) problems.push('cita NO literal contra el artículo vinculado')
      }
    }
    if (problems.length) {
      console.log(qid, '❌', problems.join(' | '))
      fail++
    } else {
      console.log(qid, `✅ (nOptions=${nOptions}, frame=${data.frame})`)
      ok++
    }
  }
  console.log(`\n${ok} ok / ${fail} con problemas de ${files.length}`)
  await sql.end()
  process.exit(fail > 0 ? 1 : 0)
}

main().catch((e) => {
  console.error('❌', e)
  process.exit(1)
})
