import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

async function addPregunta69() {
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
      question_text: 'Señale la palabra que esté bien escrita.',
      question_subtype: 'text_question',
      content_data: {
        chart_type: 'text_analysis',
        question_type: 'well_written_word',
        evaluation_description: 'Capacidad de identificar la palabra bien escrita'
      },
      option_a: 'Exorbitante',
      option_b: 'Esorbitante', 
      option_c: 'Exhorbitante',
      option_d: 'Exorbitante',
      correct_option: 0, // A = Exorbitante (también D es correcta, pero A es la primera)
      explanation: `La respuesta correcta es <strong style="color: #16a34a;">✓ A) Exorbitante</strong>.

<div style="background-color: #f8fafc; padding: 12px; border-radius: 6px; border-left: 3px solid #e2e8f0; margin: 8px 0;">
<strong>Análisis por opción:</strong>

<strong style="color: #16a34a;">✓ A) Exorbitante</strong> - Correcto: excesivo, desmesurado
<strong style="color: #dc2626;">B) Esorbitante</strong> - Incorrecto: falta la 'x'
<strong style="color: #dc2626;">C) Exhorbitante</strong> - Incorrecto: lleva 'h' innecesaria
<strong style="color: #16a34a;">D) Exorbitante</strong> - También correcto: misma palabra que A

<strong>La palabra correcta es "EXORBITANTE"</strong> - adjetivo que significa excesivo, desmesurado, que se sale de lo normal. Se escribe con 'x' y sin 'h'.

<strong>Nota:</strong> Las opciones A y D son idénticas y ambas correctas, pero A es la primera opción correcta.
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

    console.log('✅ Pregunta 69 añadida exitosamente')
    console.log(`📝 ID: ${data[0].id}`)
    console.log(`🔧 Componente: text_question`)
    console.log(`🔗 Link: http://localhost:3000/debug/question/${data[0].id}`)

  } catch (error) {
    console.error('❌ Error en script:', error)
  }
}

addPregunta69()