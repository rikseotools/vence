// scripts/fix-line-question-category.js
// Script para corregir la categoría de la pregunta de líneas
import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

// Cargar variables de entorno
dotenv.config({ path: '.env.local' })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

async function fixLineQuestionCategory() {
  try {
    console.log('🔧 Fixing line chart question category...')

    const questionId = '588c79ed-05fa-421a-8f32-23e4038b700b'

    // 1. Verificar categoría actual
    const { data: currentQ, error: currentError } = await supabase
      .from('psychometric_questions')
      .select(`
        id, question_text, section_id,
        psychometric_sections!inner(section_key, category_id),
        psychometric_categories!inner(category_key)
      `)
      .eq('id', questionId)
      .single()

    if (currentError) {
      console.error('❌ Error getting current question:', currentError)
      return
    }

    console.log('📋 Current question:')
    console.log('   - ID:', currentQ.id)
    console.log('   - Text:', currentQ.question_text.substring(0, 60) + '...')
    console.log('   - Current category:', currentQ.psychometric_categories.category_key)
    console.log('   - Current section:', currentQ.psychometric_sections.section_key)

    // 2. Obtener la sección correcta (graficos)
    const { data: correctSection, error: sectionError } = await supabase
      .from('psychometric_sections')
      .select('id, section_key')
      .eq('section_key', 'graficos')
      .single()

    if (sectionError) {
      console.error('❌ Error getting graficos section:', sectionError)
      return
    }

    console.log('✅ Found correct section:', correctSection.section_key, '(ID:', correctSection.id + ')')

    // 3. Actualizar la pregunta a la sección correcta
    const { data: updated, error: updateError } = await supabase
      .from('psychometric_questions')
      .update({ section_id: correctSection.id })
      .eq('id', questionId)
      .select()

    if (updateError) {
      console.error('❌ Error updating question:', updateError)
      return
    }

    console.log('✅ Question updated successfully!')

    // 4. Verificar el cambio
    const { data: verified, error: verifyError } = await supabase
      .from('psychometric_questions')
      .select(`
        id, question_text,
        psychometric_sections!inner(section_key),
        psychometric_categories!inner(category_key)
      `)
      .eq('id', questionId)
      .single()

    if (verifyError) {
      console.error('❌ Error verifying update:', verifyError)
      return
    }

    console.log('🔍 Verification:')
    console.log('   - Category:', verified.psychometric_categories.category_key)
    console.log('   - Section:', verified.psychometric_sections.section_key)
    console.log('   - Should now appear in Gráficos section ✅')

    console.log('\n🔗 UPDATED PREVIEW LINKS:')
    console.log(`   📋 Question Preview: http://localhost:3000/debug/question/${questionId}`)
    console.log(`   🏠 Test Route: http://localhost:3000/psicotecnicos/capacidad-administrativa/graficos`)

  } catch (error) {
    console.error('❌ Unexpected error:', error)
  }
}

// Ejecutar el script
fixLineQuestionCategory()