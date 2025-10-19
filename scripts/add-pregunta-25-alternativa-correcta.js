import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

async function addPregunta25() {
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
      question_text: '¿Cuál de las siguientes alternativas de respuesta estaría ortográficamente correcta?',
      question_subtype: 'text_question',
      content_data: {
        chart_type: 'text_analysis',
        question_type: 'orthographic_identification',
        evaluation_description: 'Capacidad de identificar la serie de palabras ortográficamente correctas'
      },
      option_a: 'garbo, plebe, avutarda',
      option_b: 'vertice, hilativo, desbarío', 
      option_c: 'benemerito, bizco, baselina',
      option_d: 'impúber, voceto, vituperar',
      correct_option: 0, // A es la correcta
      explanation: `La respuesta correcta es <strong style="color: #16a34a;">✓ A) garbo, plebe, avutarda</strong>.

<div style="background-color: #f8fafc; padding: 12px; border-radius: 6px; border-left: 3px solid #e2e8f0; margin: 8px 0;">
<strong>Análisis por opción:</strong>

<strong style="color: #16a34a;">✓ A) garbo, plebe, avutarda - Correcta</strong>
• Todas las palabras están bien escritas

<strong style="color: #dc2626;">B) vertice, hilativo, desbarío - Errores:</strong>
• <em>vertice</em> → <strong>vértice</strong> (falta tilde)
• <em>hilativo</em> → <strong>ilativo</strong> (sin h inicial)
• <em>desbarío</em> → <strong>desvarío</strong> (con v)

<strong style="color: #dc2626;">C) benemerito, bizco, baselina - Errores:</strong>
• <em>benemerito</em> → <strong>benemérito</strong> (falta tilde)
• <em>baselina</em> → <strong>vaselina</strong> (con v)

<strong style="color: #dc2626;">D) impúber, voceto, vituperar - Errores:</strong>
• <em>voceto</em> → <strong>boceto</strong> (con b)

<strong>Solo la opción A tiene todas las palabras correctas.</strong>
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

    console.log('✅ Pregunta 25 añadida exitosamente')
    console.log(`📝 ID: ${data[0].id}`)
    console.log(`🔧 Componente: text_question`)
    console.log(`🔗 Link: http://localhost:3000/debug/question/${data[0].id}`)

  } catch (error) {
    console.error('❌ Error en script:', error)
  }
}

addPregunta25()