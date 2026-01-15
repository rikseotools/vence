#!/usr/bin/env node
/**
 * review-next-question.cjs
 * Muestra la siguiente pregunta pendiente de revisión
 */

require('dotenv').config({ path: '.env.local' })
const { createClient } = require('@supabase/supabase-js')

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

async function main() {
  // Obtener siguiente pregunta pendiente
  const { data: verifications } = await supabase
    .from('ai_verification_results')
    .select('question_id, explanation')
    .eq('ai_provider', 'embedding_similarity')
    .eq('article_ok', false)
    .limit(1)

  if (!verifications || verifications.length === 0) {
    console.log('✅ No hay más preguntas pendientes')
    return
  }

  const v = verifications[0]

  // Contar pendientes
  const { count } = await supabase
    .from('ai_verification_results')
    .select('*', { count: 'exact', head: true })
    .eq('ai_provider', 'embedding_similarity')
    .eq('article_ok', false)

  // Obtener pregunta
  const { data: q } = await supabase
    .from('questions')
    .select('*')
    .eq('id', v.question_id)
    .single()

  // Obtener artículo actual
  const { data: currentArt } = await supabase
    .from('articles')
    .select('id, article_number, content, title, law_id, laws(id, short_name)')
    .eq('id', q.primary_article_id)
    .single()

  // Obtener Art. 0 (comodín)
  const { data: art0 } = await supabase
    .from('articles')
    .select('id, article_number, content, title')
    .eq('law_id', currentArt.law_id)
    .eq('article_number', '0')
    .single()

  // Parsear sugerencia de embedding
  let suggestedId = null
  let similarity = 0
  try {
    const exp = JSON.parse(v.explanation || '{}')
    suggestedId = exp.suggestedArticleId
    similarity = Math.round((exp.suggestedSimilarity || 0) * 100)
  } catch (e) {}

  let suggestedArt = null
  if (suggestedId) {
    const { data } = await supabase
      .from('articles')
      .select('id, article_number, content, title, laws(short_name)')
      .eq('id', suggestedId)
      .single()
    suggestedArt = data
  }

  // Mostrar información
  console.log('══════════════════════════════════════════════════════════')
  console.log(`PREGUNTA (Pendientes: ${count})`)
  console.log('══════════════════════════════════════════════════════════')
  console.log('')
  console.log('ID:', q.id)
  console.log('')
  console.log('PREGUNTA:', q.question_text)
  console.log('')
  console.log('OPCIONES:')
  console.log('  A)', q.option_a)
  console.log('  B)', q.option_b)
  console.log('  C)', q.option_c)
  console.log('  D)', q.option_d)
  console.log('')
  console.log('CORRECTA:', ['A', 'B', 'C', 'D'][q.correct_option])
  console.log('')
  console.log('EXPLICACIÓN:', q.explanation || 'N/A')
  console.log('')
  console.log('──────────────────────────────────────────────────────────')
  console.log('ACTUAL:', currentArt.laws.short_name, '- Art.', currentArt.article_number)
  console.log('ID_ACTUAL:', currentArt.id)
  console.log('Contenido:', (currentArt.content || 'Sin contenido').substring(0, 500))
  console.log('')

  if (suggestedArt) {
    console.log('──────────────────────────────────────────────────────────')
    console.log('SUGERIDO:', suggestedArt.laws?.short_name, '- Art.', suggestedArt.article_number, `(${similarity}%)`)
    console.log('ID_SUGERIDO:', suggestedArt.id)
    console.log('Contenido:', (suggestedArt.content || 'Sin contenido').substring(0, 500))
    console.log('')
  }

  console.log('──────────────────────────────────────────────────────────')
  console.log('ART_0 (comodín) de', currentArt.laws.short_name + ':')
  if (art0) {
    console.log('ID_ART0:', art0.id)
    console.log('Contenido:', (art0.content || 'Sin contenido').substring(0, 400))
  } else {
    console.log('⚠️ No existe Art. 0 para esta ley')
  }
}

main().catch(console.error)
