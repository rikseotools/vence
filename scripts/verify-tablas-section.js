import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://yqbpstxowvgipqspqrgo.supabase.co'
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlxYnBzdHhvd3ZnaXBxc3BxcmdvIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MDg3NjcwMywiZXhwIjoyMDY2NDUyNzAzfQ.4yUKsfS-enlY6iGICFkKi-HPqNUyTkHczUqc5kgQB3w'

const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function verifyTablasSection() {
  try {
    console.log('🔍 Verificando sección tablas...\n')
    
    // 1. Verificar si la sección existe
    const { data: section, error: sectionError } = await supabase
      .from('psychometric_sections')
      .select('*')
      .eq('section_key', 'tablas')
      .single()
    
    if (sectionError) {
      console.error('❌ Error obteniendo sección tablas:', sectionError)
      return
    }
    
    console.log('✅ Sección encontrada:')
    console.log('   ID:', section.id)
    console.log('   Key:', section.section_key)
    console.log('   Display Name:', section.display_name)
    console.log('   Category ID:', section.category_id)
    console.log('   Active:', section.is_active)
    console.log('')
    
    // 2. Verificar preguntas en esta sección
    const { data: questions, error: questionsError } = await supabase
      .from('psychometric_questions')
      .select('id, question_text, is_active, question_subtype')
      .eq('section_id', section.id)
    
    if (questionsError) {
      console.error('❌ Error obteniendo preguntas:', questionsError)
      return
    }
    
    console.log('📊 Preguntas encontradas:', questions?.length || 0)
    
    if (questions && questions.length > 0) {
      console.log('\n📝 Lista de preguntas:')
      questions.forEach((q, index) => {
        console.log(`   ${index + 1}. ${q.question_text.substring(0, 50)}...`)
        console.log(`      ID: ${q.id}`)
        console.log(`      Activa: ${q.is_active}`)
        console.log(`      Subtipo: ${q.question_subtype}`)
        console.log('')
      })
    }
    
    // 3. Verificar nuestra pregunta específica
    const floresQuestionId = '7296edc6-f740-4bb0-9c71-6ca2a301f52d'
    const { data: floresQuestion, error: floresError } = await supabase
      .from('psychometric_questions')
      .select('*')
      .eq('id', floresQuestionId)
      .single()
    
    if (floresError) {
      console.error('❌ Error obteniendo pregunta de flores:', floresError)
      return
    }
    
    console.log('🌸 Pregunta de flores:')
    console.log('   ID:', floresQuestion.id)
    console.log('   Section ID:', floresQuestion.section_id)
    console.log('   Category ID:', floresQuestion.category_id)
    console.log('   Activa:', floresQuestion.is_active)
    console.log('   Question subtype:', floresQuestion.question_subtype)
    console.log('   Texto:', floresQuestion.question_text.substring(0, 100) + '...')
    console.log('')
    
    // Verificar si la section_id coincide
    if (floresQuestion.section_id === section.id) {
      console.log('✅ La pregunta está correctamente asociada a la sección tablas')
    } else {
      console.log('❌ PROBLEMA: La pregunta NO está asociada a la sección tablas')
      console.log('   Section ID de la pregunta:', floresQuestion.section_id)
      console.log('   Section ID de tablas:', section.id)
    }
    
  } catch (error) {
    console.error('❌ Error general:', error)
  }
}

verifyTablasSection()