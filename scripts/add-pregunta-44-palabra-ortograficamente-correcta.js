import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

async function addPregunta44() {
  try {
    const { data: section } = await supabase
      .from('psychometric_sections')
      .select('id, category_id')
      .eq('section_key', 'ortografia')
      .single()

    if (!section) {
      console.error('❌ No se encontró la sección de ortografía')
      return
    }

    const questionData = {
      category_id: section.category_id,
      section_id: section.id,
      question_text: 'Señale cuál de las siguientes palabras está ortográficamente correcta.',
      question_subtype: 'text_question',
      content_data: {
        chart_type: 'text_analysis',
        question_type: 'orthographic_identification',
        evaluation_description: 'Capacidad de identificar la palabra ortográficamente correcta entre las opciones'
      },
      option_a: 'Hurfano',
      option_b: 'Hurto', 
      option_c: 'Hurves',
      option_d: 'Hivieron',
      correct_option: 1, // B = Hurto
      explanation: `La respuesta correcta es <strong style="color: #16a34a;">✓ B) Hurto</strong>.

<div style="background-color: #f8fafc; padding: 12px; border-radius: 6px; border-left: 3px solid #e2e8f0; margin: 8px 0;">
<strong>Análisis por opción:</strong>

<strong style="color: #dc2626;">A) Hurfano</strong> - Incorrecto: debería ser <strong>Huérfano</strong> (con é)
<strong style="color: #16a34a;">✓ B) Hurto</strong> - Correcto: delito de robo
<strong style="color: #dc2626;">C) Hurves</strong> - Incorrecto: debería ser <strong>Hierves</strong> (con ie)
<strong style="color: #dc2626;">D) Hivieron</strong> - Incorrecto: debería ser <strong>Hirvieron</strong> (con ir)

<strong>La palabra correcta es "Hurto"</strong> - acción de hurtar, robar algo sin violencia.
</div>`,
      is_active: true
    }

    const { data, error } = await supabase
      .from('psychometric_questions')
      .insert([questionData])
      .select()

    if (error) {
      console.error('❌ Error insertando pregunta:', error)
      return
    }

    console.log('✅ Pregunta 44 añadida exitosamente')
    console.log(`📝 ID: ${data[0].id}`)
    console.log(`🔧 Componente: text_question`)
    console.log(`🔗 Link: http://localhost:3000/debug/question/${data[0].id}`)

  } catch (error) {
    console.error('❌ Error en script:', error)
  }
}

addPregunta44()