import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

async function addPregunta21() {
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
      question_text: '¿En cuál de las siguientes alternativas de respuesta se ha cometido un error ortográfico?',
      question_subtype: 'text_question',
      content_data: {
        chart_type: 'text_analysis',
        question_type: 'orthographic_identification',
        evaluation_description: 'Capacidad de identificar errores ortográficos en palabras sin contexto'
      },
      option_a: 'anhelar, heliógrafo, herbáceo',
      option_b: 'ornitología, ahínco, holgura', 
      option_c: 'asceta, aunar, oquedad',
      option_d: 'osario, orfandad, holgar',
      correct_option: 0, // A tiene error
      explanation: `La respuesta correcta es <strong style="color: #16a34a;">✓ A)</strong> que contiene un error ortográfico.

<div style="background-color: #f8fafc; padding: 12px; border-radius: 6px; border-left: 3px solid #e2e8f0; margin: 8px 0;">
<strong>Análisis por opción:</strong>

<strong style="color: #dc2626;">A) anhelar, heliógrafo, herbáceo - 1 error:</strong>
• <em>herbáceo</em> → <strong>herbáceo</strong> (debería llevar tilde)

<strong style="color: #16a34a;">B) ornitología, ahínco, holgura - 0 errores:</strong>
• Todas las palabras están correctas

<strong style="color: #16a34a;">C) asceta, aunar, oquedad - 0 errores:</strong>
• Todas las palabras están correctas

<strong style="color: #16a34a;">D) osario, orfandad, holgar - 0 errores:</strong>
• Todas las palabras están correctas

<strong>El error está en "herbáceo" que debería llevar tilde.</strong>
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

    console.log('✅ Pregunta 21 añadida exitosamente')
    console.log(`📝 ID: ${data[0].id}`)
    console.log(`🔧 Componente: text_question`)
    console.log(`🔗 Link: http://localhost:3000/debug/question/${data[0].id}`)

  } catch (error) {
    console.error('❌ Error en script:', error)
  }
}

addPregunta21()