// Helper: imprime las preguntas de una lista de ids con su articulo. Uso:
//   node -e "require('./scripts/answer-review/tcae_audit_one.cjs')(['id1','id2'])"
require('/home/manuel/Documentos/github/vence/node_modules/dotenv').config({ path: '/home/manuel/Documentos/github/vence/.env.local' })
const { createClient } = require('/home/manuel/Documentos/github/vence/node_modules/@supabase/supabase-js')
const s = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)

module.exports = async function (ids) {
  for (const id of ids) {
    const { data: q } = await s.from('questions')
      .select('id,question_text,option_a,option_b,option_c,option_d,option_e,correct_option,explanation,primary_article_id')
      .eq('id', id).single()
    if (!q) { console.log(JSON.stringify({ id, error: 'not_found' })); continue }
    let art = null
    if (q.primary_article_id) {
      const { data: a } = await s.from('articles').select('article_number,title,content,law_id').eq('id', q.primary_article_id).single()
      if (a) {
        const { data: l } = await s.from('laws').select('short_name').eq('id', a.law_id).single()
        art = { ley: l && l.short_name, num: a.article_number, title: a.title, content: a.content }
      }
    }
    console.log(JSON.stringify({ q, art }))
  }
}
