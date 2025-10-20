import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

async function addPreguntaOrtografia12() {
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
      question_text: 'Indique cuál de las siguientes palabras contiene un error ortográfico.',
      question_subtype: 'text_question',
      content_data: {
        chart_type: 'text_analysis',
        question_type: 'orthographic_error_identification',
        evaluation_description: 'Identificar la palabra que contiene error ortográfico'
      },
      option_a: 'Güinapo',
      option_b: 'Saya',
      option_c: 'Tramoya',
      option_d: 'Ajonjolí',
      correct_option: 0, // A = Güinapo (debe ser Guiñapo)
      explanation: `La respuesta correcta es <strong style="color: #16a34a;">✓ A) Güinapo</strong>.

<div style="background-color: #f8fafc; padding: 12px; border-radius: 6px; border-left: 3px solid #e2e8f0; margin: 8px 0;">
<strong>Análisis por opción:</strong>

<strong style="color: #dc2626;">✗ A) Güinapo:</strong> ERROR - La palabra correcta es <strong style="color: #16a34a;">"guiñapo"</strong> (persona andrajosa)

<strong style="color: #16a34a;">✓ B) Saya:</strong> Correcto - falda que usan las mujeres

<strong style="color: #16a34a;">✓ C) Tramoya:</strong> Correcto - maquinaria teatral

<strong style="color: #16a34a;">✓ D) Ajonjolí:</strong> Correcto - planta oleaginosa (sésamo)

<strong>Explicación del error:</strong>
• "Guiñapo" se escribe con "ñ", no con "ü"
• Significa persona vestida con andrajos, desaliñada
• No confundir con "güisqui" (whisky) que sí lleva diéresis
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

    console.log('✅ Pregunta Ortografía 12 añadida exitosamente')
    console.log(`📝 ID: ${data[0].id}`)
    console.log(`🔧 Componente: text_question`)
    console.log(`🔗 Link: http://localhost:3000/debug/question/${data[0].id}`)

  } catch (error) {
    console.error('❌ Error en script:', error)
  }
}

addPreguntaOrtografia12()