import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function updateExplanation() {
  const newExplanation = `🔍 ANÁLISIS RÁPIDO DE LA SERIE:

📊 PASO 1: Separar en dos series intercaladas
• Serie números (1ª, 3ª, 5ª...): 8, 10, 7, 9, 6, ?
• Serie letras (2ª, 4ª, 6ª...): h, k, n, p, s, ?

📈 PASO 2: Encontrar el patrón numérico
8 → 10 (+2) → 7 (-3) → 9 (+2) → 6 (-3) → ? (+2)
✅ Patrón: +2, -3, +2, -3, +2...
✅ Siguiente: 6 + 2 = 8

📋 PASO 3: Verificar patrón de letras
h(8) → k(11) → n(14) → p(16) → s(19) → ?
✅ Patrón: +3, +3, +2, +3... → siguiente sería t(20)

⚡ TÉCNICA RÁPIDA:
Como la pregunta pide "letra o número", revisar qué posición toca:
Posición 11 = número → La respuesta es 8`;

  try {
    const { data, error } = await supabase
      .from('psychometric_questions')
      .update({
        explanation: newExplanation
      })
      .eq('id', '5d86fbd9-f8d4-4fec-bcf3-e1cebcb17406')
      .select();

    if (error) {
      console.log('❌ Error:', error.message);
    } else {
      console.log('✅ Explicación actualizada a versión práctica y concisa');
      console.log('🔗 Verificar en: http://localhost:3000/debug/question/5d86fbd9-f8d4-4fec-bcf3-e1cebcb17406');
    }
  } catch (error) {
    console.log('❌ Error general:', error.message);
  }
}

updateExplanation();