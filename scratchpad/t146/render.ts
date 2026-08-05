import fs from 'fs'
import { renderStructuredExplanation } from '../../lib/shuffle/structuredExplanation'

const raw = JSON.parse(fs.readFileSync(__dirname + '/gen_lccsns_2026-08-05_borrador_raw.json', 'utf8'))

const out = raw.map((q: any) => {
  const explanation = renderStructuredExplanation(q.explanation_data, {
    correctOption: q.correct_option,
    nOptions: q.options.length,
  })
  return {
    law_slug: q.law_slug,
    primary_article_number: q.primary_article_number,
    primary_article_id: q.primary_article_id,
    article_label: q.article_label,
    question_text: q.question_text,
    question_type: 'single',
    option_a: q.options[0],
    option_b: q.options[1],
    option_c: q.options[2],
    option_d: q.options[3],
    options: q.options,
    correct_option: q.correct_option,
    explanation_data: q.explanation_data,
    explanation,
    tags: ['ia_generada', 'gen_lccsns_2026-08-05'],
    lifecycle_state: 'draft',
    deactivation_reason: 'Pendiente de revisión post-generación IA',
    topic_review_status: 'pending',
  }
})

fs.writeFileSync(__dirname + '/gen_lccsns_2026-08-05_borrador.json', JSON.stringify(out, null, 2))

// Checks locales (§2.2-bis longitud, §2.2-ter distribución) antes de gastar el simulador de RDS
console.log('\n=== Longitudes por pregunta (correcta vs distractores) ===')
for (const q of out) {
  const lens = q.options.map((o: string) => o.length)
  const correctLen = lens[q.correct_option]
  const others = lens.filter((_: number, i: number) => i !== q.correct_option)
  const maxOther = Math.max(...others)
  const minOther = Math.min(...others)
  const ratioMax = correctLen / minOther
  const ratioMin = correctLen / maxOther
  const flag = correctLen >= 1.3 * maxOther ? '⚠️ CORRECTA MÁS LARGA' : (minOther >= 1.3 * correctLen ? '⚠️ CORRECTA MÁS CORTA' : 'ok')
  console.log(`${q.article_label}: correcta=${correctLen}ch, distractores=[${others.join(',')}]ch → ${flag}`)
}
console.log('\n=== Distribución correct_option ===')
const dist: Record<number, number> = {}
out.forEach((q: any) => { dist[q.correct_option] = (dist[q.correct_option] || 0) + 1 })
console.log(dist)
console.log('secuencia:', out.map((q: any) => q.correct_option).join(','))
