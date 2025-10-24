import { createClient } from '@supabase/supabase-js';

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );
}

async function fixP01Explanation() {
  try {
    const supabase = getSupabase();
    
    // Actualizar la pregunta P01 con formato estructurado
    const updatedContentData = {
      chart_type: 'sequence_letter',
      sequence: ['c', 'd', 'c', 'd', 'e', 'e', 'f', 'e', 'f', 'g', '?'],
      pattern_type: 'correlative_repetition',
      pattern_description: 'Serie correlativa con patrón de repetición específico',
      explanation_sections: [
        {
          title: "💡 ¿Qué evalúa este ejercicio?",
          content: "Capacidad de reconocer patrones complejos en series de letras correlativas con repeticiones específicas."
        },
        {
          title: "📊 ANÁLISIS PASO A PASO:",
          content: "📋 Serie: c, d, c, d, e, e, f, e, f, g, ?\n\n✅ Observación del patrón:\n• c, d → se repite: c, d\n• e → se repite dos veces: e, e\n• f, e, f → intercalado con la e anterior\n• g → siguiente letra correlativa\n\n📋 Patrón identificado:\n• Las letras van correlativas: c, d, e, f, g...\n• Cada letra aparece siguiendo un patrón específico de repetición\n• g es la siguiente en la secuencia correlativa"
        },
        {
          title: "⚡ TÉCNICAS DE ANÁLISIS RÁPIDO (Para oposiciones)",
          content: "🔍 Método 1: Identificar secuencia base\n• Secuencia alfabética: c → d → e → f → g\n• Cada letra sigue el orden correlativo\n• La siguiente letra es g\n\n📊 Método 2: Patrón de apariciones\n• c aparece 2 veces, d aparece 2 veces\n• e aparece 3 veces, f aparece 2 veces\n• g aparece 1 vez → debe continuar\n\n💰 Método 3: Descarte de opciones\n• Opción A: G ✅ (Siguiente en secuencia alfabética)\n• Opción B: H ❌ (Se salta una letra)\n• Opción C: F ❌ (Ya apareció)\n• Opción D: E ❌ (Ya apareció varias veces)"
        }
      ]
    };

    const { error } = await supabase
      .from('psychometric_questions')
      .update({
        content_data: updatedContentData,
        explanation: null // Limpiar la explanation antigua
      })
      .eq('id', '27787b60-ea30-40fb-abd1-57e2e550919b');

    if (error) {
      console.log('❌ Error al actualizar pregunta P01:', error.message);
    } else {
      console.log('✅ Pregunta P01 actualizada con explanation_sections estructuradas');
      console.log('🔗 Verificar en: http://localhost:3000/debug/question/27787b60-ea30-40fb-abd1-57e2e550919b');
    }

  } catch (error) {
    console.log('❌ Error general:', error.message);
  }
}

fixP01Explanation();