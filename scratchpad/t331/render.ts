import { getDb } from '@/db/client'
import { sql } from 'drizzle-orm'
import { renderStructuredExplanation } from '@/lib/shuffle/structuredExplanation'
async function main() {
  const db = getDb()
  const rows: any = await db.execute(sql`SELECT id, correct_option, option_a, option_b, option_c, option_d, explanation_data FROM questions WHERE 'gen_rd203_t331_2026-07-31'=ANY(tags) ORDER BY created_at LIMIT 1`)
  const q = rows[0]
  const order = [3, 2, 1, 0]
  const txt = renderStructuredExplanation(q.explanation_data, { correctOption: q.correct_option, optionOrder: order, nOptions: 4 })
  const base = [q.option_a, q.option_b, q.option_c, q.option_d]
  console.log('opciones BARAJADAS (orden D,C,B,A):')
  order.forEach((orig, i) => console.log('  ' + 'ABCD'[i] + ') ' + base[orig].slice(0, 78)))
  console.log('\n' + txt.split('\n').slice(3).join('\n'))
  process.exit(0)
}
main()
