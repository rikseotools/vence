#!/usr/bin/env node
/**
 * fix-question.cjs
 * Actualiza el artículo de una pregunta
 *
 * Uso:
 *   node scripts/fix-question.cjs <question_id> <new_article_id>
 *   node scripts/fix-question.cjs <question_id> KEEP       # Mantener actual
 *   node scripts/fix-question.cjs <question_id> ART0       # Usar Art. 0 de la misma ley
 */

require('dotenv').config({ path: '.env.local' })
const { createClient } = require('@supabase/supabase-js')

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

async function main() {
  const questionId = process.argv[2]
  const action = process.argv[3]

  if (!questionId || !action) {
    console.log('Uso: node scripts/fix-question.cjs <question_id> <new_article_id|KEEP|ART0>')
    process.exit(1)
  }

  // Obtener pregunta actual
  const { data: q } = await supabase
    .from('questions')
    .select('id, primary_article_id, articles!primary_article_id(law_id, laws(short_name))')
    .eq('id', questionId)
    .single()

  if (!q) {
    console.log('❌ Pregunta no encontrada')
    process.exit(1)
  }

  let newArticleId = null
  let actionDesc = ''

  if (action === 'KEEP') {
    // Mantener artículo actual, solo marcar como revisado
    actionDesc = 'Mantener actual'
  } else if (action === 'ART0') {
    // Buscar Art. 0 de la misma ley
    const { data: art0 } = await supabase
      .from('articles')
      .select('id')
      .eq('law_id', q.articles.law_id)
      .eq('article_number', '0')
      .single()

    if (!art0) {
      console.log('❌ No existe Art. 0 para esta ley')
      process.exit(1)
    }
    newArticleId = art0.id
    actionDesc = `Cambiar a Art. 0 de ${q.articles.laws.short_name}`
  } else {
    // ID de artículo específico
    newArticleId = action

    // Verificar que existe
    const { data: newArt } = await supabase
      .from('articles')
      .select('article_number, laws(short_name)')
      .eq('id', newArticleId)
      .single()

    if (!newArt) {
      console.log('❌ Artículo no encontrado:', newArticleId)
      process.exit(1)
    }
    actionDesc = `Cambiar a ${newArt.laws.short_name} Art. ${newArt.article_number}`
  }

  // Actualizar pregunta
  if (newArticleId) {
    const { error } = await supabase
      .from('questions')
      .update({
        primary_article_id: newArticleId,
        topic_review_status: null,
        verification_status: 'ai_corrected'
      })
      .eq('id', questionId)

    if (error) {
      console.log('❌ Error actualizando:', error.message)
      process.exit(1)
    }
  } else {
    // Solo limpiar estado
    await supabase
      .from('questions')
      .update({
        topic_review_status: null,
        verification_status: 'reviewed'
      })
      .eq('id', questionId)
  }

  // Marcar verificación como resuelta
  await supabase
    .from('ai_verification_results')
    .update({ article_ok: true })
    .eq('question_id', questionId)
    .eq('ai_provider', 'embedding_similarity')

  console.log('✅', actionDesc)
}

main().catch(console.error)
