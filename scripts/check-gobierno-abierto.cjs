#!/usr/bin/env node
require('dotenv').config({ path: '.env.local' })
const { createClient } = require('@supabase/supabase-js')

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
)

async function main() {
  const lawIds = [
    { id: '5b2c4af9-1f71-4b2f-a7e7-2defd46df127', name: 'Gobierno Abierto (OCDE)' },
    { id: 'c5969699-09fa-4217-9c59-5e8a4940d6cd', name: 'I Plan (2012-2014)' },
    { id: '41af924e-96f9-4a0e-a62b-9352858f9753', name: 'II Plan (2014-2016)' },
    { id: '63cc2d50-551f-4a43-b991-9339343295be', name: 'III Plan (2017-2019)' },
    { id: '08229d82-ed33-4307-a31d-f9cbd108f340', name: 'IV Plan (2020-2024)' },
    { id: '9593d99d-3d67-4982-8625-736b25a4c71d', name: 'Orden HFP/134/2018 (Foro)' }
  ]

  console.log('Documentos de Gobierno Abierto en la BD:\n')

  for (const law of lawIds) {
    const { data: arts } = await supabase
      .from('articles')
      .select('id, article_number, title, content')
      .eq('law_id', law.id)

    if (!arts || arts.length === 0) {
      console.log(`${law.name}: Sin artículos en BD`)
      continue
    }

    const artIds = arts.map(a => a.id)
    const { data: qs } = await supabase
      .from('questions')
      .select('id, question_text')
      .eq('is_active', true)
      .in('primary_article_id', artIds)

    console.log(`${law.name}: ${qs?.length || 0} preguntas`)
    console.log(`  Artículos: ${arts.map(a => a.article_number).join(', ')}`)

    // Mostrar contenido del Art. 0 si existe
    const art0 = arts.find(a => a.article_number === '0')
    if (art0) {
      console.log(`  Art. 0 contenido: ${(art0.content || 'vacío').substring(0, 150)}...`)
    }
    console.log('')
  }

  // Mostrar algunas preguntas de ejemplo
  console.log('\n═══════════════════════════════════════════════════')
  console.log('Ejemplos de preguntas de Gobierno Abierto:')
  console.log('═══════════════════════════════════════════════════\n')

  const { data: examples } = await supabase
    .from('questions')
    .select('question_text, explanation, articles!primary_article_id(article_number, laws(short_name))')
    .eq('is_active', true)
    .ilike('question_text', '%gobierno abierto%')
    .limit(5)

  for (const q of examples || []) {
    console.log('PREGUNTA:', q.question_text.substring(0, 100))
    console.log('VINCULADO:', q.articles?.laws?.short_name, 'Art.', q.articles?.article_number)
    console.log('')
  }
}

main().catch(console.error)
