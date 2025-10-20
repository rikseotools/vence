import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

async function addPregunta57() {
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
      question_text: 'Señale qué palabra se corresponde con la siguiente definición: "Entendimiento, inteligencia, razón natural".',
      question_subtype: 'text_question',
      content_data: {
        chart_type: 'text_analysis',
        question_type: 'definition_matching',
        evaluation_description: 'Capacidad de relacionar definiciones con palabras correctas'
      },
      option_a: 'Elemental',
      option_b: 'Opinión', 
      option_c: 'Emprendimiento',
      option_d: 'Conocimiento',
      correct_option: 3, // D = Conocimiento
      explanation: `La respuesta correcta es <strong style="color: #16a34a;">✓ D) Conocimiento</strong>.

<div style="background-color: #f8fafc; padding: 12px; border-radius: 6px; border-left: 3px solid #e2e8f0; margin: 8px 0;">
<strong>Análisis por opción:</strong>

<strong style="color: #dc2626;">A) Elemental</strong> - Incorrecto:
• Significa "básico, fundamental" no se refiere a entendimiento

<strong style="color: #dc2626;">B) Opinión</strong> - Incorrecto:
• Significa "juicio o valoración" no se refiere a inteligencia natural

<strong style="color: #dc2626;">C) Emprendimiento</strong> - Incorrecto:
• Significa "acción de emprender" no se refiere a razón natural

<strong style="color: #16a34a;">✓ D) Conocimiento</strong> - Correcto:
• Definición RAE: "Acción y efecto de conocer. Entendimiento, inteligencia, razón natural"

<strong>Según la RAE, conocimiento se define como:</strong>
1. Acción y efecto de conocer
2. Entendimiento, discernimiento, inteligencia
3. Razón natural, intuición, juicio, cognición

La definición coincide exactamente con "entendimiento, inteligencia, razón natural".
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

    console.log('✅ Pregunta 57 añadida exitosamente')
    console.log(`📝 ID: ${data[0].id}`)
    console.log(`🔧 Componente: text_question`)
    console.log(`🔗 Link: http://localhost:3000/debug/question/${data[0].id}`)

  } catch (error) {
    console.error('❌ Error en script:', error)
  }
}

addPregunta57()