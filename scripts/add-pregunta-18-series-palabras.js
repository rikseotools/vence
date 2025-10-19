import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

async function addPregunta18() {
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
      question_text: 'En las siguientes series de palabras, ¿en qué alternativa de respuesta se han cometido más errores ortográficos?',
      question_subtype: 'text_question',
      content_data: {
        chart_type: 'text_analysis',
        question_type: 'orthographic_comparison',
        evaluation_description: 'Capacidad de comparar y evaluar errores ortográficos entre series de palabras'
      },
      option_a: 'gladiolo, helvético, isopear',
      option_b: 'pseudo, homóplato, reúma', 
      option_c: 'íbero, pabilo, omoplato',
      option_d: 'reuma, setiembre, seudo',
      correct_option: 0, // A tiene más errores
      explanation: `La respuesta correcta es <strong style="color: #16a34a;">✓ A)</strong> que contiene mayor número de errores ortográficos.

<div style="background-color: #f8fafc; padding: 12px; border-radius: 6px; border-left: 3px solid #e2e8f0; margin: 8px 0;">
<strong>Análisis por opción:</strong>

<strong style="color: #dc2626;">A) gladiolo, helvético, isopear - 2 errores:</strong>
• <em>helvético</em> → <strong>helvetico</strong> (sin tilde)
• <em>isopear</em> → <strong>hisopear</strong> (falta h inicial)

<strong style="color: #16a34a;">B) pseudo, homóplato, reúma - 0 errores:</strong>
• Todas las palabras están correctas

<strong style="color: #16a34a;">C) íbero, pabilo, omoplato - 0 errores:</strong>
• Todas las palabras están correctas

<strong style="color: #16a34a;">D) reuma, setiembre, seudo - 0 errores:</strong>
• Todas las palabras están correctas (formas aceptadas por la RAE)
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

    console.log('✅ Pregunta 18 añadida exitosamente')
    console.log(`📝 ID: ${data[0].id}`)
    console.log(`🔧 Componente: text_question`)
    console.log(`🔗 Link: http://localhost:3000/debug/question/${data[0].id}`)

  } catch (error) {
    console.error('❌ Error en script:', error)
  }
}

addPregunta18()