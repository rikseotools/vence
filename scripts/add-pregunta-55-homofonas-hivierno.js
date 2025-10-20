import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

async function addPregunta55() {
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
      question_text: 'Seleccione la opción que contiene una palabra mal escrita por confusión de homófonas.',
      question_subtype: 'text_question',
      content_data: {
        chart_type: 'text_analysis',
        question_type: 'homophones_identification',
        evaluation_description: 'Capacidad de identificar errores de escritura por confusión de homófonas'
      },
      option_a: 'Honda, hierva, hallar',
      option_b: 'Valla, baya, vaya', 
      option_c: 'Halla, hierba, hivierno',
      option_d: 'Haya, hondo, hielo',
      correct_option: 2, // C = hivierno es incorrecto
      explanation: `La respuesta correcta es <strong style="color: #16a34a;">✓ C) Halla, hierba, hivierno</strong>.

<div style="background-color: #f8fafc; padding: 12px; border-radius: 6px; border-left: 3px solid #e2e8f0; margin: 8px 0;">
<strong>Análisis por opción:</strong>

<strong style="color: #16a34a;">A) Honda, hierva, hallar</strong> - Todas correctas:
• Honda (profunda) ✓
• Hierva (del verbo hervir) ✓  
• Hallar (encontrar) ✓

<strong style="color: #16a34a;">B) Valla, baya, vaya</strong> - Todas correctas:
• Valla (cerca, vallado) ✓
• Baya (fruto) ✓
• Vaya (del verbo ir) ✓

<strong style="color: #dc2626;">✗ C) Halla, hierba, hivierno</strong> - Contiene error:
• Halla (del verbo hallar) ✓
• Hierba (planta) ✓
• <strong>Hivierno</strong> ❌ (debería ser "invierno")

<strong style="color: #16a34a;">D) Haya, hondo, hielo</strong> - Todas correctas:
• Haya (del verbo haber o árbol) ✓
• Hondo (profundo) ✓
• Hielo (agua congelada) ✓

<strong>El error está en "hivierno"</strong> - la forma correcta es "invierno" (estación fría del año).
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

    console.log('✅ Pregunta 55 añadida exitosamente')
    console.log(`📝 ID: ${data[0].id}`)
    console.log(`🔧 Componente: text_question`)
    console.log(`🔗 Link: http://localhost:3000/debug/question/${data[0].id}`)

  } catch (error) {
    console.error('❌ Error en script:', error)
  }
}

addPregunta55()