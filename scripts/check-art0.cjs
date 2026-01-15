#!/usr/bin/env node
/**
 * check-art0.cjs
 * Revisa preguntas vinculadas a artículos "0" (comodín)
 */

require('dotenv').config({ path: '.env.local' })
const { createClient } = require('@supabase/supabase-js')

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
)

async function main() {
  const { data, error } = await supabase
    .from('questions')
    .select('id, question_text, explanation, articles!primary_article_id(id, article_number, laws(short_name))')
    .eq('is_active', true)
    .not('primary_article_id', 'is', null)

  if (error) {
    console.error('Error:', error)
    return
  }

  const art0Questions = data.filter(q => q.articles?.article_number === '0')

  console.log('Total preguntas con Art. 0:', art0Questions.length)
  console.log('')

  // Agrupar por ley
  const byLaw = {}
  for (const q of art0Questions) {
    const law = q.articles?.laws?.short_name || 'Sin ley'
    if (!byLaw[law]) byLaw[law] = []
    byLaw[law].push(q)
  }

  console.log('Distribución por ley:')
  const sorted = Object.entries(byLaw).sort((a, b) => b[1].length - a[1].length)
  for (const [law, questions] of sorted) {
    console.log(`  ${law}: ${questions.length} preguntas`)
  }

  // Mostrar detalle de cada ley
  console.log('\n')
  for (const [law, questions] of sorted) {
    console.log('═'.repeat(60))
    console.log(`${law} - ${questions.length} preguntas con Art. 0`)
    console.log('═'.repeat(60))

    for (const q of questions.slice(0, 5)) {
      console.log('')
      console.log('ID:', q.id)
      console.log('PREGUNTA:', q.question_text.substring(0, 100))
      console.log('EXPLICACIÓN:', (q.explanation || 'N/A').substring(0, 150))
    }

    if (questions.length > 5) {
      console.log(`\n... y ${questions.length - 5} más`)
    }
    console.log('')
  }
}

main().catch(console.error)
