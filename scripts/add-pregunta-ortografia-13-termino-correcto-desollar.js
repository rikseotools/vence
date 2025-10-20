import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

async function addPreguntaOrtografia13() {
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
      question_text: 'Señale, entre las siguientes alternativas de respuesta, el término que está ortográficamente correcto.',
      question_subtype: 'text_question',
      content_data: {
        chart_type: 'text_analysis',
        question_type: 'correct_orthographic_term',
        evaluation_description: 'Identificar el término ortográficamente correcto'
      },
      option_a: 'Deshollar',
      option_b: 'Desoyar',
      option_c: 'Desollar',
      option_d: 'Desoiar',
      correct_option: 2, // C = Desollar
      explanation: `La respuesta correcta es <strong style="color: #16a34a;">✓ C) Desollar</strong>.

<div style="background-color: #f8fafc; padding: 12px; border-radius: 6px; border-left: 3px solid #e2e8f0; margin: 8px 0;">
<strong>Análisis por opción:</strong>

<strong style="color: #dc2626;">A) Deshollar:</strong> Incorrecto - lleva 'h' innecesaria

<strong style="color: #dc2626;">B) Desoyar:</strong> Incorrecto - cambio de significado (no oír)

<strong style="color: #16a34a;">✓ C) Desollar:</strong> Correcto - quitar la piel del cuerpo

<strong style="color: #dc2626;">D) Desoiar:</strong> Incorrecto - forma inexistente

<strong>La palabra correcta es "DESOLLAR"</strong> - verbo que significa quitar o arrancar la piel del cuerpo de un animal o persona. Se escribe sin 'h' y con doble 'l'.

<strong>No confundir con:</strong>
• "Desoyar" = no hacer caso, desoír
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

    console.log('✅ Pregunta Ortografía 13 añadida exitosamente')
    console.log(`📝 ID: ${data[0].id}`)
    console.log(`🔧 Componente: text_question`)
    console.log(`🔗 Link: http://localhost:3000/debug/question/${data[0].id}`)

  } catch (error) {
    console.error('❌ Error en script:', error)
  }
}

addPreguntaOrtografia13()