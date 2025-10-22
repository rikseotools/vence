// Script para mejorar la explicación de la pregunta de series con interrogantes
import { createClient } from '@supabase/supabase-js';

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );
}

async function fixExplanation() {
  try {
    const supabase = getSupabase();
    
    console.log('🔧 Mejorando explicación de la pregunta de series con interrogantes...');
    
    const questionId = '1bf0664e-3b99-4d82-94cf-79dfee0f6bf9';
    
    // Nueva explicación más clara y paso a paso
    const newExplanation = `**ANÁLISIS PASO A PASO:**

**1. Observamos los grupos conocidos:**
- (3-6-4): primer número = 3, segundo = 6, tercero = 4
- (5-15-11): primer número = 5, segundo = 15, tercero = 11  
- (12-60-44): primer número = 12, segundo = 60, tercero = 44

**2. Encontramos el patrón del primer número:**
3 → 5 → ? → 12
- De 3 a 5: +2
- De 5 a ?: +3  
- De ? a 12: +4
- Por tanto: ? = 5 + 3 = **8**

**3. Encontramos el patrón del segundo número:**
- En (3-6-4): 3 × 2 = 6
- En (5-15-11): 5 × 3 = 15
- En (12-60-44): 12 × 5 = 60
- Multiplica por: 2, 3, ?, 5
- La secuencia es 2, 3, 4, 5
- Por tanto: 8 × 4 = **32**

**4. Encontramos el patrón del tercer número:**
- En (3-6-4): 6 - 2 = 4
- En (5-15-11): 15 - 4 = 11
- En (12-60-44): 60 - 16 = 44
- Resta: 2, 4, ?, 16
- La secuencia es 2, 4, 8, 16 (potencias de 2)
- Por tanto: 32 - 8 = **24**

**RESPUESTA:** (¿-¿-¿?) = **(8-32-24)**`;

    const { data, error } = await supabase
      .from('psychometric_questions')
      .update({
        explanation: newExplanation,
        updated_at: new Date().toISOString()
      })
      .eq('id', questionId)
      .select();
      
    if (error) {
      console.log('❌ Error actualizando explicación:', error.message);
      return;
    }
    
    console.log('✅ Explicación actualizada exitosamente');
    console.log(`📝 ID: ${questionId}`);
    console.log('🔗 Verificar en: http://localhost:3000/debug/question/' + questionId);
    
  } catch (error) {
    console.log('❌ Error general:', error.message);
  }
}

fixExplanation();