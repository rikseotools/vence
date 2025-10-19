import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

async function addPregunta45() {
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
      question_text: 'Complete la palabra con las grafías correctas: RE__ENE',
      question_subtype: 'text_question',
      content_data: {
        chart_type: 'text_analysis',
        question_type: 'orthographic_completion',
        evaluation_description: 'Capacidad de completar correctamente palabras con las grafías adecuadas'
      },
      option_a: 'Rellene',
      option_b: 'Reyene', 
      option_c: 'Rellene',
      option_d: 'Retene',
      correct_option: 0, // A = Rellene
      explanation: `La respuesta correcta es <strong style="color: #16a34a;">✓ A) Rellene</strong>.

<div style="background-color: #f8fafc; padding: 12px; border-radius: 6px; border-left: 3px solid #e2e8f0; margin: 8px 0;">
<strong>Análisis por opción:</strong>

<strong style="color: #16a34a;">✓ A) Rellene</strong> - Correcto: del verbo rellenar (llenar completamente)
<strong style="color: #dc2626;">B) Reyene</strong> - Incorrecto: no es una palabra válida
<strong style="color: #16a34a;">C) Rellene</strong> - Correcto pero repetido: misma que A
<strong style="color: #dc2626;">D) Retene</strong> - Incorrecto: del verbo retener, pero no completa RE__ENE

<strong>La palabra correcta es "RELLENE"</strong> - del verbo rellenar, completar con doble L.
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

    console.log('✅ Pregunta 45 añadida exitosamente')
    console.log(`📝 ID: ${data[0].id}`)
    console.log(`🔧 Componente: text_question`)
    console.log(`🔗 Link: http://localhost:3000/debug/question/${data[0].id}`)

  } catch (error) {
    console.error('❌ Error en script:', error)
  }
}

addPregunta45()