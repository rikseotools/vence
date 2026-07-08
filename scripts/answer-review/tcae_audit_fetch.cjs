// Helper para la auditoría TCAE: imprime las preguntas [start,end) del fichero piloto
// con su artículo vinculado (contenido literal). Uso: node tcae_audit_fetch.cjs <start> <end>
require('/home/manuel/Documentos/github/vence/node_modules/dotenv').config({ path: '/home/manuel/Documentos/github/vence/.env.local' })
const { createClient } = require('/home/manuel/Documentos/github/vence/node_modules/@supabase/supabase-js')
const s = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
const FILE = '/tmp/claude-1000/-home-manuel-Documentos-github-vence/61c02061-b6d4-4b33-90e2-403f855d4c26/scratchpad/tcae_pilot.json'

const start = parseInt(process.argv[2] || '0', 10)
const end = parseInt(process.argv[3] || '24', 10)

;(async () => {
  const ids = require(FILE).slice(start, end)
  for (const id of ids) {
    const { data: q } = await s.from('questions')
      .select('id,question_text,option_a,option_b,option_c,option_d,option_e,correct_option,explanation,primary_article_id')
      .eq('id', id).single()
    if (!q) continue
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
})()
