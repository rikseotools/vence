import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

async function addPregunta24() {
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
      question_text: '¿Cuál de las siguientes frases tiene un error ortográfico?',
      question_subtype: 'text_question',
      content_data: {
        chart_type: 'text_analysis',
        question_type: 'orthographic_identification',
        evaluation_description: 'Capacidad de identificar errores ortográficos en frases'
      },
      option_a: 'El pueblo rivereño era pequeño.',
      option_b: 'El cansancio turba mis sentidos.', 
      option_c: 'Es mejor que recojas y te vayas.',
      option_d: 'El niño está jugando en el parque.',
      correct_option: 0, // A tiene error
      explanation: `La respuesta correcta es <strong style="color: #16a34a;">✓ A)</strong> que contiene un error ortográfico.

<div style="background-color: #f8fafc; padding: 12px; border-radius: 6px; border-left: 3px solid #e2e8f0; margin: 8px 0;">
<strong>Análisis por opción:</strong>

<strong style="color: #dc2626;">A) "El pueblo rivereño era pequeño." - 1 error:</strong>
• <em>rivereño</em> → <strong>ribereño</strong> (debe escribirse con b)

<strong style="color: #16a34a;">B) "El cansancio turba mis sentidos." - Correcta</strong>
• Todas las palabras están bien escritas

<strong style="color: #16a34a;">C) "Es mejor que recojas y te vayas." - Correcta</strong>
• Todas las palabras están bien escritas

<strong style="color: #16a34a;">D) "El niño está jugando en el parque." - Correcta</strong>
• Todas las palabras están bien escritas

<strong>El error está en "rivereño" que debe escribirse "ribereño" (con b).</strong>
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

    console.log('✅ Pregunta 24 añadida exitosamente')
    console.log(`📝 ID: ${data[0].id}`)
    console.log(`🔧 Componente: text_question`)
    console.log(`🔗 Link: http://localhost:3000/debug/question/${data[0].id}`)

  } catch (error) {
    console.error('❌ Error en script:', error)
  }
}

addPregunta24()