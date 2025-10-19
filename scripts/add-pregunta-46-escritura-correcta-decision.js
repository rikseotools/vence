import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

async function addPregunta46() {
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
      question_text: 'Elija la escritura correcta de la palabra.',
      question_subtype: 'text_question',
      content_data: {
        chart_type: 'text_analysis',
        question_type: 'orthographic_selection',
        evaluation_description: 'Capacidad de seleccionar la forma correcta de escribir una palabra'
      },
      option_a: 'Desición',
      option_b: 'Decisión', 
      option_c: 'Decición',
      option_d: 'Descición',
      correct_option: 1, // B = Decisión
      explanation: `La respuesta correcta es <strong style="color: #16a34a;">✓ B) Decisión</strong>.

<div style="background-color: #f8fafc; padding: 12px; border-radius: 6px; border-left: 3px solid #e2e8f0; margin: 8px 0;">
<strong>Análisis por opción:</strong>

<strong style="color: #dc2626;">A) Desición</strong> - Incorrecto: falta la "ci" después de "de"
<strong style="color: #16a34a;">✓ B) Decisión</strong> - Correcto: forma adecuada con "ci"
<strong style="color: #dc2626;">C) Decición</strong> - Incorrecto: falta la "s" después de "de"
<strong style="color: #dc2626;">D) Descición</strong> - Incorrecto: sobra la "c" antes de "ción"

<strong>La forma correcta es "DECISIÓN"</strong> - acción de decidir, con "ci" intermedia.
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

    console.log('✅ Pregunta 46 añadida exitosamente')
    console.log(`📝 ID: ${data[0].id}`)
    console.log(`🔧 Componente: text_question`)
    console.log(`🔗 Link: http://localhost:3000/debug/question/${data[0].id}`)

  } catch (error) {
    console.error('❌ Error en script:', error)
  }
}

addPregunta46()