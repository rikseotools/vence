import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

async function addPregunta64() {
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
      question_text: 'Señale el término que esté correctamente escrito.',
      question_subtype: 'text_question',
      content_data: {
        chart_type: 'text_analysis',
        question_type: 'correct_term_selection',
        evaluation_description: 'Capacidad de seleccionar el término con escritura correcta'
      },
      option_a: 'Estrafalario',
      option_b: 'Extrafañario', 
      option_c: 'Estrafalario',
      option_d: 'Extrafalario',
      correct_option: 0, // A = Estrafalario
      explanation: `La respuesta correcta es <strong style="color: #16a34a;">✓ A) Estrafalario</strong>.

<div style="background-color: #f8fafc; padding: 12px; border-radius: 6px; border-left: 3px solid #e2e8f0; margin: 8px 0;">
<strong>Análisis por opción:</strong>

<strong style="color: #16a34a;">✓ A) Estrafalario</strong> - Correcto: persona o cosa extravagante, rara
<strong style="color: #dc2626;">B) Extrafañario</strong> - Incorrecto: no existe esta forma con ñ
<strong style="color: #16a34a;">C) Estrafalario</strong> - También correcto: misma palabra que A
<strong style="color: #dc2626;">D) Extrafalario</strong> - Incorrecto: falta la 's' inicial

<strong>La palabra correcta es "ESTRAFALARIO"</strong> - adjetivo que describe a una persona o cosa extravagante, rara o excéntrica. Se escribe con 's' inicial.

<strong>Nota:</strong> Las opciones A y C son idénticas y ambas correctas, pero A es la primera opción correcta.
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

    console.log('✅ Pregunta 64 añadida exitosamente')
    console.log(`📝 ID: ${data[0].id}`)
    console.log(`🔧 Componente: text_question`)
    console.log(`🔗 Link: http://localhost:3000/debug/question/${data[0].id}`)

  } catch (error) {
    console.error('❌ Error en script:', error)
  }
}

addPregunta64()