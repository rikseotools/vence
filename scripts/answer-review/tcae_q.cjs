// Helper CLI para auditoría TCAE: imprime UNA pregunta + su artículo vinculado (JSON).
// Uso: node scripts/answer-review/tcae_q.cjs <question_id>
require('/home/manuel/Documentos/github/vence/node_modules/dotenv').config({ path: '/home/manuel/Documentos/github/vence/.env.local' })
const { createClient } = require('/home/manuel/Documentos/github/vence/node_modules/@supabase/supabase-js')
const s = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)

const id = process.argv[2]
;(async () => {
  const { data: q } = await s.from('questions')
    .select('id,question_text,option_a,option_b,option_c,option_d,option_e,correct_option,explanation,primary_article_id')
    .eq('id', id).single()
  if (!q) { console.log(JSON.stringify({ error: 'not_found', id })); return }
  let art = null
  if (q.primary_article_id) {
    const { data: a } = await s.from('articles').select('article_number,title,content,law_id').eq('id', q.primary_article_id).single()
    if (a) {
      const { data: l } = await s.from('laws').select('short_name,name').eq('id', a.law_id).single()
      art = { ley: l && (l.short_name || l.name), num: a.article_number, title: a.title, content: (a.content || '').slice(0, 1200) }
    }
  }
  const letra = ['A', 'B', 'C', 'D', 'E'][q.correct_option]
  console.log(JSON.stringify({
    id: q.id, pregunta: q.question_text,
    opciones: { A: q.option_a, B: q.option_b, C: q.option_c, D: q.option_d, E: q.option_e },
    clave_marcada: letra, explicacion: q.explanation, articulo: art
  }))
})()
