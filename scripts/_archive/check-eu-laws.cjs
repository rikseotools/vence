#!/usr/bin/env node
require('dotenv').config({ path: '.env.local' })
const { createClient } = require('@supabase/supabase-js')

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
)

async function main() {
  // Buscar leyes europeas
  const { data: laws } = await supabase
    .from('laws')
    .select('id, short_name, name')
    .or('short_name.ilike.%TUE%,short_name.ilike.%TFUE%,short_name.ilike.%tratado%,name.ilike.%europea%,name.ilike.%europeo%')

  console.log('LEYES EUROPEAS EN LA BD:\n')
  for (const law of laws || []) {
    console.log('•', law.short_name, '-', (law.name || '').substring(0, 60))
  }

  console.log('\n\nPREGUNTAS POR LEY EUROPEA:\n')

  for (const law of laws || []) {
    const { data: arts } = await supabase
      .from('articles')
      .select('id, article_number')
      .eq('law_id', law.id)

    if (!arts || arts.length === 0) continue

    const artIds = arts.map(a => a.id)
    const { data: qs } = await supabase
      .from('questions')
      .select('id, question_text, articles!primary_article_id(article_number)')
      .eq('is_active', true)
      .in('primary_article_id', artIds)

    if (qs && qs.length > 0) {
      console.log('═'.repeat(60))
      console.log(law.short_name + ':', qs.length, 'preguntas activas')
      console.log('Artículos disponibles:', arts.map(a => a.article_number).slice(0, 20).join(', '))
      console.log('')

      // Mostrar algunas preguntas
      for (const q of qs.slice(0, 5)) {
        console.log('  •', q.question_text.substring(0, 70))
        console.log('    Vinculado: Art.', q.articles?.article_number)
      }
      if (qs.length > 5) {
        console.log('  ... y', qs.length - 5, 'más')
      }
      console.log('')
    }
  }
}

main().catch(console.error)
