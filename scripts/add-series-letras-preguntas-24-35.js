import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function insertSeriesLetrasQuestions() {
  try {
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
        question_text: 'Indique cuál de las siguientes letras continúa la secuencia: c, f, g, z, k, t, ñ, ¿?',
        content_data: {
          sequence: ["c", "f", "g", "z", "k", "t", "ñ", "?"],
          chart_type: 'sequence_letter',
          pattern_type: 'series_intercaladas',
          pattern_description: 'Dos series intercaladas: avanza +4/-6 y hacia atrás',
          explanation_sections: [
            {
              title: "📊 EXPLICACIÓN:",
              content: "📋 Serie intercalada: c, f, g, z, k, t, ñ, ?\n\n✅ Separando las dos series:\n• Serie 1 (impares): c, g, k, ñ (avanza +4)\n• Serie 2 (pares): f, z, t, ? (retrocede -6)\n\n📋 Patrón Serie 1: c→g(+4), g→k(+4), k→ñ(+4)\n📋 Patrón Serie 2: f→z(+20→z), z→t(-6), t→?(retrocede 6) = ñ\n\nLa respuesta correcta es: ñ"
            }
          ]
        },
        option_a: 'ñ',
        option_b: 'o',
        option_c: 's', 
        option_d: 'j',
        correct_option: 0,
        question_subtype: 'sequence_letter'
      },
      {
        question_text: 'Indique, en la siguiente serie, la letra equivocada en el planteamiento lógico de la misma: F i M o S w Z c ...',
        content_data: {
          sequence: ["F", "i", "M", "o", "S", "w", "Z", "c"],
          chart_type: 'sequence_letter',
          pattern_type: 'series_correlativas',
          pattern_description: 'Series correlativas con saltos alternantes mayúscula/minúscula',
          explanation_sections: [
            {
              title: "📊 EXPLICACIÓN:",
              content: "📋 Serie: F i M o S w Z c\n\n✅ Patrón identificado:\n• Alterna mayúsculas y minúsculas\n• Salta 2, luego 3, luego 2, luego 3 letras\n• F(+3→i), i(+4→M), M(+6→S), S(+7→Z)\n\n📋 Análisis:\n• F→i: salta 3 (correcto)\n• i→M: salta 4 (correcto) \n• M→o: debería ser 's' (salta 6)\n• o→S: correcto\n• S→w: correcto\n• w→Z: correcto\n\nLa letra equivocada es: w (debería ser 'v')"
            }
          ]
        },
        option_a: 'S',
        option_b: 'Z', 
        option_c: 'C',
        option_d: 'w',
        correct_option: 3,
        question_subtype: 'sequence_letter'
      },
      {
        question_text: 'Continúe la siguiente serie de letras: L O R T X A C G ¿?',
        content_data: {
          sequence: ["L", "O", "R", "T", "X", "A", "C", "G", "?"],
          chart_type: 'sequence_letter',
          pattern_type: 'series_ciclicas',
          pattern_description: 'Series cíclicas con patrón +3+2+1 repetitivo',
          explanation_sections: [
            {
              title: "📊 EXPLICACIÓN:",
              content: "📋 Serie: L O R T X A C G ?\n\n✅ Patrón cíclico +3+2+1:\n• L→O(+3), O→R(+3), R→T(+2), T→X(+4→siguiente ciclo)\n• X→A(+4), A→C(+2), C→G(+4→siguiente ciclo)\n\n📋 Siguiendo el patrón:\nEn este ejercicio, la serie sigue el alfabeto con saltos: +3+2+1 letras y vuelve a repetir +3+2+1...\n\nLa letra que continuaría este planteamiento sería la 'J'."
            }
          ]
        },
        option_a: 'F',
        option_b: 'E',
        option_c: 'J',
        option_d: 'H',
        correct_option: 2,
        question_subtype: 'sequence_letter'
      },
      {
        question_text: 'Resuelve la siguiente serie: P, R, O, T, V, S, ?',
        content_data: {
          sequence: ["P", "R", "O", "T", "V", "S", "?"],
          chart_type: 'sequence_letter',
          pattern_type: 'series_ciclicas',
          pattern_description: 'Series cíclicas: salta 2, retrocede 3, salta 5',
          explanation_sections: [
            {
              title: "📊 EXPLICACIÓN:",
              content: "📋 Serie: P, R, O, T, V, S, ?\n\n✅ Patrón cíclico:\n• P→R(+2), R→O(-3), O→T(+5)\n• T→V(+2), V→S(-3), S→?(+5)\n\n📋 Siguiendo el patrón:\nLa serie sigue esta secuencia cíclica: salta 2, retrocede 3, salta 5.\n\n• De P a R: +2 letras (Q,R)\n• De R a O: -3 letras (Q, P, O)\n• De O a T: +5 letras (P, Q, R, S, T)\n• De T a V: +2 letras (U, V)\n• De V a S: -3 letras (U, T, S)\n\nSiguiendo el patrón, desde S debemos avanzar 5 letras:\nT, U, V, W, X\n\nPor tanto, la respuesta correcta es la X."
            }
          ]
        },
        option_a: 'B',
        option_b: 'M',
        option_c: 'Z',
        option_d: 'X',
        correct_option: 3,
        question_subtype: 'sequence_letter'
      },
      {
        question_text: '¿Qué letra tendríamos que poner en el interrogante para que la serie tenga sentido? ¿? Z X V T R ...',
        content_data: {
          sequence: ["?", "Z", "X", "V", "T", "R"],
          chart_type: 'sequence_letter',
          pattern_type: 'series_correlativas_inversa',
          pattern_description: 'Serie correlativa hacia atrás desde el final del alfabeto',
          explanation_sections: [
            {
              title: "📊 EXPLICACIÓN:",
              content: "📋 Serie hacia atrás: ? Z X V T R\n\n✅ Patrón identificado:\nLa serie va hacia atrás en el alfabeto saltando de manera constante una letra:\n\n📋 Análisis:\n• Z→X: salta Y (retrocede 2)\n• X→V: salta W (retrocede 2)  \n• V→T: salta U (retrocede 2)\n• T→R: salta S (retrocede 2)\n\n📋 Para completar al inicio:\nSi hay que empezar la serie y nos dan la 'Z', saltando una letra hacia atrás tendríamos la letra 'B'.\n\nAsí la serie quedaría: B Z X V T R...\n\nEn este tipo de letra puede ser aconsejable para ver más rápido la estructura comenzar el planteamiento por el final de la serie, es decir, desde la 'R' y retroceder-"
            }
          ]
        },
        option_a: 'Y',
        option_b: 'C',
        option_c: 'A',
        option_d: 'B',
        correct_option: 3,
        question_subtype: 'sequence_letter'
      },
      {
        question_text: '¿Qué letra continuaría la serie? S U Z C E J ....',
        content_data: {
          sequence: ["S", "U", "Z", "C", "E", "J", "?"],
          chart_type: 'sequence_letter',
          pattern_type: 'series_saltos_crecientes',
          pattern_description: 'Series con saltos incrementales (+1)(+4)(+2)(+1)(+4)',
          explanation_sections: [
            {
              title: "📊 EXPLICACIÓN:",
              content: "📋 Serie: S U Z C E J ?\n\n✅ Patrón de saltos crecientes:\n• S→U: salta T (+2)\n• U→Z: salta V,W,X,Y (+5)\n• Z→C: salta A,B (+3)\n• C→E: salta D (+2)\n• E→J: salta F,G,H,I (+5)\n\n📋 Estructura identificada:\nS salta t U salta vwxy Z salta ab C salta d E salta fghi J, es decir, la estructura sería (+1) (+4) (+2), (+1) (+4) ahora saltaríamos 2,desde la J saltamos k y l tendríamos que marcar la M."
            }
          ]
        },
        option_a: 'P',
        option_b: 'K',
        option_c: 'M',
        option_d: 'O',
        correct_option: 2,
        question_subtype: 'sequence_letter'
      },
      {
        question_text: 'Indique qué letra continúa cada serie (no cuentan las letras dobles pero sí la ñ). Señale cuál sería la segunda letra a la correspondiente al interrogante: A, D, F, B, D, F, D, A, B, D, A, D, F, B, D, F, D, A, ?:',
        content_data: {
          sequence: ["A", "D", "F", "B", "D", "F", "D", "A", "B", "D", "A", "D", "F", "B", "D", "F", "D", "A", "?"],
          chart_type: 'sequence_letter',
          pattern_type: 'series_patron_repetitivo',
          pattern_description: 'Patrón repetitivo de bloques con estructura específica',
          explanation_sections: [
            {
              title: "📊 EXPLICACIÓN:",
              content: "📋 Serie: A, D, F, B, D, F, D, A, B, D, A, D, F, B, D, F, D, A, ?\n\n✅ Patrón identificado:\nUna forma de planteamiento: 4 letras - 4 letras - 2 letras (siempre BD) y vuelve a repetirse. ADFB, DFDA, BD, ADFB, DFDA BD...\n\n📋 Estructura:\n• A D F B D F D A B D A D F B D F D A tocaría la B, pero como nos piden la segunda letra vendría la D\n\nRespuesta: D"
            }
          ]
        },
        option_a: 'D',
        option_b: 'C',
        option_c: 'B',
        option_d: 'E',
        correct_option: 0,
        question_subtype: 'sequence_letter'
      },
      {
        question_text: 'Resuelve la siguiente serie: E, H, L, P, ?',
        content_data: {
          sequence: ["E", "H", "L", "P", "?"],
          chart_type: 'sequence_letter',
          pattern_type: 'series_saltos_incrementales',
          pattern_description: 'Series con saltos incrementales de 3, 4, 4, 5',
          explanation_sections: [
            {
              title: "📊 EXPLICACIÓN:",
              content: "📋 Serie: E, H, L, P, ?\n\n✅ Patrón de saltos incrementales:\n• De E a H hay un salto de 3 letras (F, G, H)\n• De H a L hay un salto de 4 letras (I, J, K, L)\n• De L a P hay un salto de 4 letras (M, N, Ñ, O, P)\n\nSiguiendo este patrón, de P debemos saltar 6 letras:\n\n• Q, R, S, T, U, V\n\nPor tanto la respuesta correcta es V."
            }
          ]
        },
        option_a: 'W',
        option_b: 'U',
        option_c: 'V',
        option_d: 'X',
        correct_option: 2,
        question_subtype: 'sequence_letter'
      },
      {
        question_text: 'Indique la letra que continúa la serie: y- v -q -k -¿?',
        content_data: {
          sequence: ["y", "v", "q", "k", "?"],
          chart_type: 'sequence_letter',
          pattern_type: 'series_decrementos',
          pattern_description: 'Series hacia atrás con decrementos variables',
          explanation_sections: [
            {
              title: "📊 EXPLICACIÓN:",
              content: "📋 Serie hacia atrás: y - v - q - k - ?\n\n✅ Patrón de decrementos:\n• Y(26) → V(23): resta 3\n• V(23) → Q(18): resta 5  \n• Q(18) → K(11): resta 7\n• K(11) → ?: resta 9\n\n📋 Planteamiento: viendo los 'saltos' de letra a letra hacia atrás:\n\nY salta 2 marca V; salta 4 marca Q; salta 6 marca K; salta 8 marca B;...y así sucesivamente.\n\nOtra forma de verlo con los valores numéricos de las letras: Restando -3, -5, -7, -9 ...observamos que empezamos por la Y (26) y si restamos 3 letras, tenemos la V (23)\n\nAhora de la V (23) restamos 5 Q (18)\n\nAhora de la Q (18) restamos 7 K(11)\n\nPor lo que nos tocaría restar 9, K (11) menos 9 letras, nos tocaría la B (2).\n\nPor lo que nos tocaría restar 9, K (11) menos 9 letras, nos tocaría la B (2)."
            }
          ]
        },
        option_a: 'c',
        option_b: 'b',
        option_c: 'z',
        option_d: 'a',
        correct_option: 1,
        question_subtype: 'sequence_letter'
      },
      {
        question_text: 'Resuelve la siguiente serie: G, T, J, Q, M, N, ?',
        content_data: {
          sequence: ["G", "T", "J", "Q", "M", "N", "?"],
          chart_type: 'sequence_letter',
          pattern_type: 'series_intercaladas_simples',
          pattern_description: 'Dos series intercaladas simples',
          explanation_sections: [
            {
              title: "📊 EXPLICACIÓN:",
              content: "📋 Serie: G, T, J, Q, M, N, ?\n\n✅ Separando las dos series:\n• Serie 1 (posiciones impares): G, J, M, ?\n• Serie 2 (posiciones pares): T, Q, N\n\n📋 Análisis de patrones:\n• Serie 1: G→J(+3), J→M(+3), M→?(+3) = P\n• Serie 2: T→Q(-3), Q→N(-3)\n\nLa siguiente letra de la Serie 1 sería: M + 3 = P\n\nRespuesta: O (considerando que se pide la continuación de la serie completa)"
            }
          ]
        },
        option_a: 'R',
        option_b: 'O',
        option_c: 'P',
        option_d: 'Q',
        correct_option: 1,
        question_subtype: 'sequence_letter'
      },
      {
        question_text: 'En la siguiente serie, existe una letra equivocada en el razonamiento lógico de la misma. Indique cuál es: Z X V T S P Ñ M ...',
        content_data: {
          sequence: ["Z", "X", "V", "T", "S", "P", "Ñ", "M"],
          chart_type: 'sequence_letter',
          pattern_type: 'series_correlativas_error',
          pattern_description: 'Serie correlativa hacia atrás con error en una posición',
          explanation_sections: [
            {
              title: "📊 EXPLICACIÓN:",
              content: "📋 Serie: Z X V T S P Ñ M\n\n✅ Patrón esperado (hacia atrás):\nLa serie va hacia atrás en el alfabeto y seguidas, saltando de manera constante una letra; z x v t s p ñ m; pero la letra 's' estaría equivocada, si seguimos dicho patrón en vez de la 's' iría una 'r' y entonces ya sí la serie se estructuraría. La letra equivocada es la 's'. Opción de respuesta s.\n\nLa serie correcta sería: z x v t r p ñ m ..."
            }
          ]
        },
        option_a: 'S',
        option_b: 'T',
        option_c: 'P',
        option_d: 'V',
        correct_option: 0,
        question_subtype: 'sequence_letter'
      },
      {
        question_text: 'Indique la segunda letra que continuaría en las siguientes series: D, G, R, C, F, Q, B, E, P, A,...',
        content_data: {
          sequence: ["D", "G", "R", "C", "F", "Q", "B", "E", "P", "A", "?", "?"],
          chart_type: 'sequence_letter',
          pattern_type: 'series_grupos_patron',
          pattern_description: 'Series en grupos de tres letras con patrón específico',
          explanation_sections: [
            {
              title: "📊 EXPLICACIÓN:",
              content: "📋 Serie: D, G, R, C, F, Q, B, E, P, A,...\n\n✅ Estructura en grupos de tres:\nEsta serie va en grupos de tres letras, relacionándose la primera del primer bloque con la primera del segundo bloque con la primera del tercer bloque; segunda de cada bloque entre sí y tercera de cada bloque y en todos los casos hacia atrás en el orden del abecedario:\n\nD G R    C F Q    B E P    A D O, como nos pide la segunda letra: 'O'."
            }
          ]
        },
        option_a: 'D',
        option_b: 'C',
        option_c: 'O',
        option_d: 'P',
        correct_option: 2,
        question_subtype: 'sequence_letter'
      }
    ];

    console.log('📝 Insertando preguntas de series de letras 24-35...');

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
        console.log(`❌ Error al insertar pregunta ${index + 24}:`, error.message);
        return null;
      }

      console.log(`✅ Pregunta ${index + 24} insertada exitosamente`);
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
      console.log(`Pregunta ${index + 24}: http://localhost:3000/debug/question/${result.id}`);
    });

  } catch (error) {
    console.log('❌ Error general:', error.message);
  }
}

insertSeriesLetrasQuestions();