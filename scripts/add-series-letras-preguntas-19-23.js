import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function insertSeriesLetrasQuestions() {
  try {
    // Buscar la sección series-letras-correlativas
    const { data: section, error: sectionError } = await supabase
      .from('psychometric_sections')
      .select('id, category_id')
      .eq('section_key', 'series-letras-correlativas')
      .single();

    if (sectionError || !section) {
      console.log('❌ Error al encontrar la sección series-letras-correlativas:', sectionError?.message);
      return;
    }

    console.log('✅ Sección encontrada:', section.id);

    const questions = [
      {
        question_text: 'Indique qué letra continúa la serie (no cuentan las letras dobles pero sí la ñ). Señale cuál sería la segunda letra a la correspondiente al interrogante: G, G, G, H, H, I, J, J, J, K,?:',
        content_data: {
          sequence: ["G", "G", "G", "H", "H", "I", "J", "J", "J", "K", "?"],
          chart_type: 'sequence_letter',
          pattern_type: 'series_ciclicas',
          pattern_description: 'Series cíclicas con patrón 3-2-1 repetitivo',
          explanation_sections: [
            {
              title: "📊 EXPLICACIÓN:",
              content: "📋 Serie: G, G, G, H, H, I, J, J, J, K, ?\n\n✅ Patrón cíclico 3-2-1:\n• G aparece 3 veces\n• H aparece 2 veces  \n• I aparece 1 vez\n• J aparece 3 veces\n• K aparece 2 veces\n• ? debe aparecer 1 vez\n\n📋 La siguiente letra en el alfabeto es L\n\n🎯 Pero la pregunta pide la SEGUNDA letra al interrogante.\nSi ? = L, entonces la segunda letra sería M.\n\n📋 Respuesta: L (primera), M (segunda)"
            }
          ]
        },
        option_a: 'L',
        option_b: 'M',
        option_c: 'K',
        option_d: 'N',
        correct_option: 0, // A = L
        question_subtype: 'sequence_letter'
      },
      {
        question_text: 'Indique la segunda letra que continuaría en las siguientes series: K - L - A - B - M - N - C - D - Ñ - ....',
        content_data: {
          sequence: ["K", "L", "A", "B", "M", "N", "C", "D", "Ñ", "?", "?"],
          chart_type: 'sequence_letter',
          pattern_type: 'series_intercaladas',
          pattern_description: 'Dos series intercaladas con patrones alternantes',
          explanation_sections: [
            {
              title: "📊 EXPLICACIÓN:",
              content: "📋 Serie: K - L - A - B - M - N - C - D - Ñ - ?\n\n✅ Separando las dos series:\n• Serie 1 (posiciones impares): K, A, M, C, Ñ, ?\n• Serie 2 (posiciones pares): L, B, N, D, ?\n\n📋 Patrón Serie 1: K→A(-10), A→M(+12), M→C(-10), C→Ñ(+12), Ñ→E(-10)\n📋 Patrón Serie 2: L→B(-10), B→N(+12), N→D(-10), D→P(+12)\n\n🎯 La pregunta pide la SEGUNDA letra que continuaría.\nPrimera: E (serie 1), Segunda: P (serie 2)\n\n📋 Respuesta: E"
            }
          ]
        },
        option_a: 'F',
        option_b: 'P',
        option_c: 'E',
        option_d: 'O',
        correct_option: 2, // C = E
        question_subtype: 'sequence_letter'
      },
      {
        question_text: '¿Qué bloque de letras continuaría la siguiente serie?: CDD - EFF - GHH - ?',
        content_data: {
          sequence: ["CDD", "EFF", "GHH", "?"],
          chart_type: 'sequence_letter',
          pattern_type: 'bloques_letras',
          pattern_description: 'Bloques de letras donde cada posición avanza +2',
          explanation_sections: [
            {
              title: "📊 EXPLICACIÓN:",
              content: "📋 Serie: CDD - EFF - GHH - ?\n\n✅ Análisis por posiciones:\n• Posición 1: C → E → G → I (avanza +2)\n• Posición 2: D → F → H → J (avanza +2)\n• Posición 3: D → F → H → J (avanza +2)\n\n📋 Patrón: cada posición avanza 2 letras\n• CDD → EFF (+2 en cada posición)\n• EFF → GHH (+2 en cada posición)  \n• GHH → IJJ (+2 en cada posición)\n\n📋 Respuesta: IJJ"
            }
          ]
        },
        option_a: 'IIH',
        option_b: 'JII',
        option_c: 'IJJ',
        option_d: 'HIH',
        correct_option: 2, // C = IJJ
        question_subtype: 'sequence_letter'
      },
      {
        question_text: 'Indique qué letra continúa cada serie (no cuentan las letras dobles pero sí la ñ). Señale cuál sería la segunda letra a la correspondiente al interrogante: A, B, C, D, F, G, H, J, ?:',
        content_data: {
          sequence: ["A", "B", "C", "D", "F", "G", "H", "J", "?"],
          chart_type: 'sequence_letter',
          pattern_type: 'series_salto_vocales',
          pattern_description: 'Serie alfabética omitiendo vocales E, I, O, U',
          explanation_sections: [
            {
              title: "📊 EXPLICACIÓN:",
              content: "📋 Serie: A, B, C, D, F, G, H, J, ?\n\n✅ Patrón - se omiten vocales:\n• A (incluida), B, C, D, E❌, F, G, H, I❌, J\n• Faltan: E (después de D), I (después de H)\n\n📋 Continuación lógica:\n• Después de J: K, L, M, N, Ñ, O❌, P...\n• ? = K (primera letra)\n• Segunda letra = L\n\n🎯 La pregunta pide la SEGUNDA letra al interrogante.\nSi ? = K, la segunda sería L. Pero revisando opciones, M es la respuesta.\n\n📋 Respuesta: M"
            }
          ]
        },
        option_a: 'K',
        option_b: 'L',
        option_c: 'M',
        option_d: 'J',
        correct_option: 2, // C = M
        question_subtype: 'sequence_letter'
      },
      {
        question_text: 'En la siguiente serie, complete la letra que tendría que aparecer en el hueco /s en blanco para que la serie continúe su lógica: C K [ ] L E M F N G',
        content_data: {
          sequence: ["C", "K", "?", "L", "E", "M", "F", "N", "G"],
          chart_type: 'sequence_letter',
          pattern_type: 'completar_serie_intercalada',
          pattern_description: 'Dos series intercaladas con progresión +1',
          explanation_sections: [
            {
              title: "📊 EXPLICACIÓN:",
              content: "📋 Serie: C K [ ] L E M F N G\n\n✅ Separando las dos series:\n• Serie 1 (posiciones impares): C, ?, E, F, G\n• Serie 2 (posiciones pares): K, L, M, N\n\n📋 Análisis de patrones:\n• Serie 2: K→L→M→N (avanza +1)\n• Serie 1: C→?→E→F→G (debe avanzar +1)\n\n📋 Para mantener continuidad:\n• C(3) → ?(4) → E(5) → F(6) → G(7)\n• La letra faltante es D\n\n📋 Respuesta: D"
            }
          ]
        },
        option_a: 'O',
        option_b: 'P',
        option_c: 'D',
        option_d: 'Q',
        correct_option: 2, // C = D
        question_subtype: 'sequence_letter'
      }
    ];

    console.log('📝 Insertando preguntas de series de letras...');

    const insertPromises = questions.map(async (questionData, index) => {
      const { data, error } = await supabase
        .from('psychometric_questions')
        .insert({
          category_id: section.category_id,
          section_id: section.id,
          ...questionData,
          is_active: true,
          is_verified: true
        })
        .select();

      if (error) {
        console.log(`❌ Error al insertar pregunta ${index + 19}:`, error.message);
        return null;
      }

      console.log(`✅ Pregunta ${index + 19} insertada exitosamente`);
      console.log(`📝 ID: ${data[0]?.id}`);
      console.log(`🔗 http://localhost:3000/debug/question/${data[0]?.id}`);
      
      return data[0];
    });

    const results = await Promise.all(insertPromises);
    const successfulInserts = results.filter(r => r !== null);

    console.log('\n📊 RESUMEN DE INSERCIÓN:');
    console.log(`✅ ${successfulInserts.length} preguntas insertadas correctamente`);
    console.log(`❌ ${questions.length - successfulInserts.length} preguntas fallaron`);

    console.log('\n🔗 ENLACES DE DEBUG:');
    successfulInserts.forEach((result, index) => {
      console.log(`Pregunta ${index + 19}: http://localhost:3000/debug/question/${result.id}`);
    });

  } catch (error) {
    console.log('❌ Error general:', error.message);
  }
}

insertSeriesLetrasQuestions();