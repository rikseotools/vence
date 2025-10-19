import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

async function addPregunta51() {
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
      question_text: 'Señale la opción de respuesta que se corresponde con el término ortográficamente correcto.',
      question_subtype: 'text_question',
      content_data: {
        chart_type: 'text_analysis',
        question_type: 'orthographic_selection',
        evaluation_description: 'Capacidad de seleccionar el término con escritura ortográfica correcta'
      },
      option_a: 'Givia',
      option_b: 'Jibia', 
      option_c: 'Jiba',
      option_d: 'Gibla',
      correct_option: 1, // B = Jibia
      explanation: `La respuesta correcta es <strong style="color: #16a34a;">✓ B) Jibia</strong>.

<div style="background-color: #f8fafc; padding: 12px; border-radius: 6px; border-left: 3px solid #e2e8f0; margin: 8px 0;">
<strong>Análisis por opción:</strong>

<strong style="color: #dc2626;">A) Givia</strong> - Incorrecto: no es una palabra válida
<strong style="color: #16a34a;">✓ B) Jibia</strong> - Correcto: molusco cefalópodo (sepia)
<strong style="color: #dc2626;">C) Jiba</strong> - Incorrecto: no es la forma correcta
<strong style="color: #dc2626;">D) Gibla</strong> - Incorrecto: no es una palabra válida

<strong>La palabra correcta es "JIBIA"</strong> - molusco cefalópodo marino también conocido como sepia, se escribe con J inicial.
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

    console.log('✅ Pregunta 51 añadida exitosamente')
    console.log(`📝 ID: ${data[0].id}`)
    console.log(`🔧 Componente: text_question`)
    console.log(`🔗 Link: http://localhost:3000/debug/question/${data[0].id}`)

  } catch (error) {
    console.error('❌ Error en script:', error)
  }
}

addPregunta51()