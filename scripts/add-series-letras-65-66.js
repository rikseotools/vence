import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function addSeriesLetras65Y66() {
  try {
    // Obtener la sección de series de letras correlativas
    const { data: section, error: sectionError } = await supabase
      .from('psychometric_sections')
      .select('id, category_id')
      .eq('section_key', 'series-letras-correlativas')
      .single();

    if (sectionError) {
      console.log('❌ Error obteniendo sección:', sectionError.message);
      return;
    }

    console.log('📋 Sección encontrada:', section.id);

    const preguntas = [
      // Pregunta 65: Continúe la serie - Problema de posiciones alfabéticas
      {
        category_id: section.category_id,
        section_id: section.id,
        question_text: 'Continúe la serie: Si en este abecedario tachamos todas las letras que ocupan un lugar par, aquellas que ocupan un lugar que lleve un tres y todas las que ocupan un lugar acabado en cinco, ¿qué letra ocuparía el séptimo lugar?',
        content_data: {
          pattern_type: "posiciones_alfabeticas_filtradas",
          solution_method: "manual",
          alphabet_reference: "A B C D E F G H I J K L M N Ñ O P Q R S T U V W X Y Z",
          filtering_rules: [
            "Tachamos posiciones pares (2,4,6,8,10,12,14,16,18,20,22,24,26)",
            "Tachamos posiciones con tres (3,13,23)",
            "Tachamos posiciones acabadas en cinco (5,15,25)"
          ]
        },
        option_a: 'P',
        option_b: 'R',
        option_c: 'T',
        option_d: 'X',
        correct_option: 2, // C: T
        explanation: `🔍 Análisis del abecedario filtrado:
• Abecedario completo: A(1) B(2) C(3) D(4) E(5) F(6) G(7) H(8) I(9) J(10) K(11) L(12) M(13) N(14) Ñ(15) O(16) P(17) Q(18) R(19) S(20) T(21) U(22) V(23) W(24) X(25) Y(26) Z(27)

📊 Aplicamos las reglas de filtrado:
• Tachamos posiciones pares: 2,4,6,8,10,12,14,16,18,20,22,24,26
• Tachamos posiciones con "3": 3,13,23  
• Tachamos posiciones acabadas en "5": 5,15,25

❌ Letras tachadas:
• B(2), D(4), F(6), H(8), J(10), L(12), N(14), O(16), Q(18), S(20), U(22), W(24), Y(26) [pares]
• C(3), M(13), V(23) [contienen 3]
• E(5), Ñ(15), X(25) [acaban en 5]

✅ Letras que permanecen:
• A(1), G(7), I(9), K(11), P(17), R(19), T(21), Z(27)

📋 Ordenamos las letras restantes:
1. A (posición original 1)
2. G (posición original 7)  
3. I (posición original 9)
4. K (posición original 11)
5. P (posición original 17)
6. R (posición original 19)
7. T (posición original 21)
8. Z (posición original 27)

✅ La letra en el séptimo lugar es: T

La respuesta correcta es C: T`,
        difficulty: 'hard',
        time_limit_seconds: 200,
        question_subtype: 'sequence_letter',
        is_active: true
      },

      // Pregunta 66: Serie s t u y z a e f g k ¿?
      {
        category_id: section.category_id,
        section_id: section.id,
        question_text: 'Indique la letra que continuaría la serie propuesta: s t u y z a e f g k ¿?',
        content_data: {
          pattern_type: "serie_saltos_alfabeticos_complejos",
          solution_method: "manual"
        },
        option_a: 'm',
        option_b: 'ñ',
        option_c: 'n',
        option_d: 'l',
        correct_option: 3, // D: l
        explanation: `🔍 Análisis de la serie con saltos alfabéticos:
• Serie: s, t, u, y, z, a, e, f, g, k, ?
• Analizamos el patrón de saltos en el alfabeto

📊 Análisis por grupos de letras:
• Primer grupo: s(19), t(20), u(21) → 3 letras consecutivas
• Salto: u(21) → y(25) → salto de 3 letras (v,w,x)
• Segundo grupo: y(25), z(26), a(1) → 3 letras (con vuelta cíclica)
• Salto: a(1) → e(5) → salto de 3 letras (b,c,d)
• Tercer grupo: e(5), f(6), g(7) → 3 letras consecutivas  
• Salto: g(7) → k(11) → salto de 3 letras (h,i,j)

📋 Patrón identificado:
• 3 letras seguidas → salta 3 letras → 3 letras seguidas → salta 3 letras
• Esquema: 3 consecutivas + salto(3) + 3 consecutivas + salto(3) + 3 consecutivas + salto(3)

✅ Aplicando el patrón:
• Después de k(11), deberíamos tener 3 letras consecutivas
• k(11) → l(12) (primera de las 3 siguientes)

🔍 Verificación del patrón completo:
• s,t,u (consecutivas) → salto 3 → y,z,a (consecutivas cíclicas) → salto 3 → e,f,g (consecutivas) → salto 3 → k,l,m (consecutivas)

La respuesta correcta es D: l`,
        difficulty: 'medium',
        time_limit_seconds: 150,
        question_subtype: 'sequence_letter',
        is_active: true
      }
    ];

    // Insertar ambas preguntas
    const { data: insertedData, error: insertError } = await supabase
      .from('psychometric_questions')
      .insert(preguntas)
      .select();

    if (insertError) {
      console.log('❌ Error insertando preguntas:', insertError.message);
      return;
    }

    console.log('✅ Preguntas 65 y 66 de series de letras añadidas exitosamente');
    console.log(`📝 Total de preguntas insertadas: ${insertedData.length}`);
    
    console.log('\n🔗 REVISAR PREGUNTAS VISUALMENTE:');
    insertedData.forEach((pregunta, index) => {
      const numerosPregunta = 65 + index;
      console.log(`📍 Pregunta ${numerosPregunta}: http://localhost:3000/debug/question/${pregunta.id}`);
    });
    
    console.log('\n📋 RESUMEN DE PREGUNTAS AÑADIDAS:');
    console.log('• Pregunta 65: Filtrado de posiciones alfabéticas complejas');
    console.log('• Pregunta 66: Serie con saltos alfabéticos y grupos consecutivos');
    console.log('• Ambas usan el componente SequenceLetterQuestion');
    console.log('• Explicaciones detalladas con análisis paso a paso');

  } catch (error) {
    console.log('❌ Error general:', error.message);
  }
}

addSeriesLetras65Y66();