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
        question_text: '¿Qué letra continúa la siguientes serie lógica? A D H K N Q ¿?',
        content_data: {
          sequence: ["A", "D", "H", "K", "N", "Q", "?"],
          chart_type: 'sequence_letter',
          pattern_type: 'saltos_incrementales',
          pattern_description: 'Serie con saltos incrementales de 2, 3, 2, 3 letras',
          explanation_sections: [
            {
              title: "📊 EXPLICACIÓN:",
              content: "📋 Serie: A D H K N Q ?\n\n✅ Patrón de saltos incrementales:\n• A→D: salta B,C (+3)\n• D→H: salta E,F,G (+4)\n• H→K: salta I,J (+3)\n• K→N: salta L,M (+3)\n• N→Q: salta Ñ,O,P (+3)\n• Q→?: salta R,S,T (+3) = U\n\nLa serie va: A bc D efg H ij K lm N ñop Q rst U. Salta dos letras, luego tres, luego dos, luego tres...\n\nLa respuesta correcta es: U"
            }
          ]
        },
        option_a: 'V',
        option_b: 'T',
        option_c: 'S',
        option_d: 'U',
        correct_option: 3,
        question_subtype: 'sequence_letter'
      },
      {
        question_text: 'Indique qué letra continúa cada serie (no cuentan las letras dobles pero sí la ñ). Señale cuál sería la segunda letra que continuaría la siguiente serie: H, W, I, X, J, Y, K, Z ...',
        content_data: {
          sequence: ["H", "W", "I", "X", "J", "Y", "K", "Z", "?", "?"],
          chart_type: 'sequence_letter',
          pattern_type: 'series_intercaladas',
          pattern_description: 'Dos series intercaladas: una hacia adelante, otra hacia atrás',
          explanation_sections: [
            {
              title: "📊 EXPLICACIÓN:",
              content: "📋 Serie intercalada: H, W, I, X, J, Y, K, Z\n\n✅ Separando las dos series:\n• Serie 1 (posiciones impares): H, I, J, K, L...\n• Serie 2 (posiciones pares): W, X, Y, Z, A...\n\n📋 Análisis:\n• Primera serie es: H, I, J, K, L...\n• Segunda serie es: W, X, Y, Z, A...\n\nH, W, I, X, J, Y, K, Z, L, A\n\nLa segunda letra que continuaría en las siguientes series sería la A."
            }
          ]
        },
        option_a: 'A',
        option_b: 'I',
        option_c: 'J',
        option_d: 'L',
        correct_option: 0,
        question_subtype: 'sequence_letter'
      },
      {
        question_text: 'Indique la letra que colocaríamos en lugar del interrogante para que la serie tenga un sentido: F I N T C ¿?',
        content_data: {
          sequence: ["F", "I", "N", "T", "C", "?"],
          chart_type: 'sequence_letter',
          pattern_type: 'series_saltos_complejos',
          pattern_description: 'Serie con saltos variables y patrón específico',
          explanation_sections: [
            {
              title: "📊 EXPLICACIÓN:",
              content: "📋 Serie: F I N T C ?\n\n✅ Análisis del patrón:\nLa serie mantiene la siguiente estructura: F gh I jklm N ñopqrs T uvwxyzab C defghijklm N. Salta 2, salta 4, salta 6, salta 8 ahora saltaría 10.\n\nAdemas, por la utilidad que pueda tener en un momento determinado, es recomendable asociar la letra con su posición, para favorecer el trabajo de búsqueda de la letra o incluso el plantear la serie de letras como una serie numérica.\n\nAdemás, por la utilidad que pueda tener en un momento determinado, es recomendable asociar la letra con su posición, para favorecer el trabajo de búsqueda de la letra o incluso el plantear la serie de letras como una serie numérica.\n\nLa serie mantiene la siguiente estructura: F gh I jklm N ñopqrs T uvwxyzab C defghijklm N. Salta 2, salta 4, salta 6, salta 8 ahora saltaría 10."
            }
          ]
        },
        option_a: 'O',
        option_b: 'L',
        option_c: 'M',
        option_d: 'N',
        correct_option: 3,
        question_subtype: 'sequence_letter'
      },
      {
        question_text: 'Continúa la serie: D, Y, F, W, H, U, ?',
        content_data: {
          sequence: ["D", "Y", "F", "W", "H", "U", "?"],
          chart_type: 'sequence_letter',
          pattern_type: 'series_intercaladas_bidireccional',
          pattern_description: 'Dos series intercaladas: una incrementa +2, otra decrementa -2',
          explanation_sections: [
            {
              title: "📊 EXPLICACIÓN:",
              content: "📋 Serie intercalada: D, Y, F, W, H, U, ?\n\n✅ Separando las dos series:\n• Serie 1 (impares): D, F, H (incrementando 2 letras)\n• Serie 2 (pares): Y, W, U (decrementando 2 letras)\n\n📋 Análisis:\n• D (E) F (G) H (I) J (incrementando 2 letras)\n• Y (X) W (V) U (T) S (decrementando 2 letras)\n\nLa respuesta correcta es J para la primera serie y S para la segunda serie. Como se pide el siguiente término de la serie completa, tomamos el primer término, que es J."
            }
          ]
        },
        option_a: 'S',
        option_b: 'J',
        option_c: 'V',
        option_d: 'T',
        correct_option: 1,
        question_subtype: 'sequence_letter'
      },
      {
        question_text: 'Indique el bloque de letras que seguiría en la siguiente serie: A/F - G/B - C/H - I/D - E/J - ¿? / ¿? ...',
        content_data: {
          sequence: ["A/F", "G/B", "C/H", "I/D", "E/J", "?/?"],
          chart_type: 'sequence_letter',
          pattern_type: 'series_correlativas_bloques',
          pattern_description: 'Bloques de dos letras que forman dos series distintas',
          explanation_sections: [
            {
              title: "📊 EXPLICACIÓN:",
              content: "📋 Serie en bloques: A/F - G/B - C/H - I/D - E/J - ?/?\n\n✅ Los bloques de dos letras forman dos series distintas:\n• Primera letra del primer bloque se relaciona con la segunda letra del segundo bloque, esta se relaciona con la primera del tercer bloque, con la segunda del cuarto bloque...\n• La segunda letra del primer bloque se relaciona con la primera letra del segundo bloque, esta se relaciona con la segunda letra del tercer bloque, con la primera letra del cuarto bloque...\n\nDe manera esquemática: numeramos las series:\n1/2  2/1  1/2  2/1  1/2  2/1\n\nA/F G/B C/H I/D E/J K/F...este sería el bloque que debería continuar la serie: K/F. Opción de respuesta: K/F"
            }
          ]
        },
        option_a: 'L/F',
        option_b: 'F/K',
        option_c: 'K/F',
        option_d: 'L/G',
        correct_option: 2,
        question_subtype: 'sequence_letter'
      },
      {
        question_text: 'En la siguiente serie hay una letra equivocada, indíquela: c a y v u s q ...',
        content_data: {
          sequence: ["c", "a", "y", "v", "u", "s", "q"],
          chart_type: 'sequence_letter',
          pattern_type: 'series_correlativas_error',
          pattern_description: 'Serie correlativa hacia atrás con error',
          explanation_sections: [
            {
              title: "📊 EXPLICACIÓN:",
              content: "📋 Serie: c a y v u s q\n\n✅ Patrón esperado (hacia atrás):\nLa serie va hacia atrás siguiendo el abecedario y en cada paso se salta una letra:\n\nc (b) a (z) y (x) v (esta es la letra equivocada, con el patrón que vamos siguiendo tendría que ir la letra 'w' y así continuaría la serie). Letra equivocada la 'v'.\n\nLa serie se completaría así: c a y w u s q ..."
            }
          ]
        },
        option_a: 'u',
        option_b: 'v',
        option_c: 'y',
        option_d: 's',
        correct_option: 1,
        question_subtype: 'sequence_letter'
      },
      {
        question_text: '¿Cuál sería la segunda letra que continúa la serie? E A X T Q .... ..?.',
        content_data: {
          sequence: ["E", "A", "X", "T", "Q", "?", "?"],
          chart_type: 'sequence_letter',
          pattern_type: 'series_decrementos_variables',
          pattern_description: 'Serie hacia atrás con decrementos variables',
          explanation_sections: [
            {
              title: "📊 EXPLICACIÓN:",
              content: "📋 Serie hacia atrás: E A X T Q ?\n\n✅ Patrón de decrementos:\nLa serie retrocede: E dcb A zyx X wvu T srq Q poñ N ml K, como nos piden la segunda letra sería la K.\n\nSolución: La serie retrocede: E dcb A zyx X wvu T srq Q poñ N ml K, como nos piden la segunda letra sería la K."
            }
          ]
        },
        option_a: 'S',
        option_b: 'J',
        option_c: 'L',
        option_d: 'K',
        correct_option: 3,
        question_subtype: 'sequence_letter'
      },
      {
        question_text: 'Continúa la serie: Z, X, U, Q, ?',
        content_data: {
          sequence: ["Z", "X", "U", "Q", "?"],
          chart_type: 'sequence_letter',
          pattern_type: 'series_decrementos_crecientes',
          pattern_description: 'Serie hacia atrás con saltos crecientes',
          explanation_sections: [
            {
              title: "📊 EXPLICACIÓN:",
              content: "📋 Serie hacia atrás: Z, X, U, Q, ?\n\n✅ Patrón de saltos crecientes:\n• De Z a X hay un salto de 2 letras hacia atrás (Y)\n• De X a U hay un salto de 3 letras hacia atrás (W, V)\n• De U a Q hay un salto de 4 letras hacia atrás (T, S, R)\n\nSiguiendo este patrón, de Q debemos saltar 5 letras hacia atrás:\n• P, O, Ñ, N, M\n\nEntonces la respuesta correcta es M"
            }
          ]
        },
        option_a: 'P',
        option_b: 'M',
        option_c: 'R',
        option_d: 'N',
        correct_option: 1,
        question_subtype: 'sequence_letter'
      },
      {
        question_text: 'Resuelve la siguiente serie: E, V, H, S, K, P, ?',
        content_data: {
          sequence: ["E", "V", "H", "S", "K", "P", "?"],
          chart_type: 'sequence_letter',
          pattern_type: 'series_intercaladas_mixtas',
          pattern_description: 'Series intercaladas: una incrementa +3, otra decrementa -3',
          explanation_sections: [
            {
              title: "📊 EXPLICACIÓN:",
              content: "📋 Serie intercalada: E, V, H, S, K, P, ?\n\n✅ Separando las dos series:\n• Serie 1 (impares): E, H, K, ? (+3 cada vez)\n• Serie 2 (pares): V, S, P, ? (-3 cada vez)\n\n📋 Análisis:\n• E(5) → H(8) → K(11) → N(14) (incrementando 3)\n• V(23) → S(20) → P(17) → ? (-3 cada vez)\n\nSiguiendo el patrón de la segunda serie: P - 3 = M\nSiguiendo el patrón de la primera serie: K + 3 = N\n\nLa respuesta correcta es N para la primera serie y M para la segunda serie. Como se pide el siguiente término de la serie completa, tomamos el primer término, que es N."
            }
          ]
        },
        option_a: 'M',
        option_b: 'O',
        option_c: 'N',
        option_d: 'L',
        correct_option: 2,
        question_subtype: 'sequence_letter'
      },
      {
        question_text: 'Indique las letras que tendrían que aparecer en lugar de los interrogantes para que se mantenga la lógica de la serie: A C ¿? G ¿? K M...',
        content_data: {
          sequence: ["A", "C", "?", "G", "?", "K", "M"],
          chart_type: 'sequence_letter',
          pattern_type: 'series_correlativas_saltos',
          pattern_description: 'Serie correlativa con saltos de una letra',
          explanation_sections: [
            {
              title: "📊 EXPLICACIÓN:",
              content: "📋 Serie: A C ? G ? K M\n\n✅ Patrón identificado:\nEn este ejercicio, el planteamiento es una serie que sigue el orden del alfabeto (la secuencia de la serie es seguida se relacionan todas las letras una a una) y va saltando una letra. En los interrogantes tendría que aparecer la 'E' y la 'I'."
            }
          ]
        },
        option_a: 'F y I',
        option_b: 'E y J',
        option_c: 'F y J',
        option_d: 'E y I',
        correct_option: 3,
        question_subtype: 'sequence_letter'
      },
      {
        question_text: 'Indique la letra que continúa la serie lógica siguiente: X-U-R; Y-U-Q; Z-U-P; A-U-¿?',
        content_data: {
          sequence: ["X-U-R", "Y-U-Q", "Z-U-P", "A-U-?"],
          chart_type: 'sequence_letter',
          pattern_type: 'series_bloques_patron',
          pattern_description: 'Bloques con patrón: primera letra avanza, tercera retrocede',
          explanation_sections: [
            {
              title: "📊 EXPLICACIÓN:",
              content: "📋 Serie en bloques: X-U-R; Y-U-Q; Z-U-P; A-U-?\n\n✅ Análisis del patrón:\nNuestra serie iría: X wv U ts R; Y xwv U rst Q; Z yxwv U srqp P; A zyxwv U rsqpo O. Salta 2-2; luego 3-3, luego 4-4, luego 5-5.\n\nAdemás, por la utilidad que pueda tener en un momento determinado, es recomendable asociar la letra con su posición, para favorecer el trabajo de búsqueda de la letra o incluso el plantear la serie de letras como una serie numérica.\n\nAdemás, por la utilidad que pueda tener en un momento determinado, es recomendable asociar la letra con su posición, para favorecer el trabajo de búsqueda de la letra o incluso plantear la serie de letras como una serie numérica.\n\nNuestra serie iría: X wv U ts R; Y xwv U rst Q; Z yxwv U srqp P; A zyxwv U rsqpo O. Salta 2-2; luego 3-3, luego 4-4, luego 5-5."
            }
          ]
        },
        option_a: 'O',
        option_b: 'S',
        option_c: 'Q',
        option_d: 'R',
        correct_option: 0,
        question_subtype: 'sequence_letter'
      },
      {
        question_text: 'En la serie que se le presenta a continuación, encuentre la letra que no sigue el razonamiento de la misma: a z b y c x d w e u f...',
        content_data: {
          sequence: ["a", "z", "b", "y", "c", "x", "d", "w", "e", "u", "f"],
          chart_type: 'sequence_letter',
          pattern_type: 'series_intercaladas_error',
          pattern_description: 'Series intercaladas con error en una posición',
          explanation_sections: [
            {
              title: "📊 EXPLICACIÓN:",
              content: "📋 Serie: a z b y c x d w e u f\n\n✅ Análisis del patrón:\nParece claro que la serie tiene dos subseries:\n• Una sigue el orden alfabético desde el principio y las letras ocuparían los lugares impares de la serie: a b c d e f ...\n• La otra va desde el final del alfabeto hacia atrás y ocuparía los lugares pares de la serie: z y x w v u ...\n\nSi seguimos este criterio, vemos que la letra 'u' de esta segunda subserie estaría equivocada, ya que correspondería a la letra 'v' la que tendría que estar en esa posición. La letra equivocada sería la 'u'.\n\nLa serie correcta quedaría: a z b y c x d w e v f ..."
            }
          ]
        },
        option_a: 'e',
        option_b: 'f',
        option_c: 'u',
        option_d: 'd',
        correct_option: 2,
        question_subtype: 'sequence_letter'
      },
      {
        question_text: 'En la siguiente serie, existe una letra equivocada, indíquela: J M O R T X A',
        content_data: {
          sequence: ["J", "M", "O", "R", "T", "X", "A"],
          chart_type: 'sequence_letter',
          pattern_type: 'series_correlativas_saltos_error',
          pattern_description: 'Serie correlativa con saltos de 2 letras pero con error',
          explanation_sections: [
            {
              title: "📊 EXPLICACIÓN:",
              content: "📋 Serie: J M O R T X A\n\n✅ Análisis del patrón:\nEn esta serie, las letra siguen el orden del abecedario saltando dos letras entre una y otra, pero al pasar de la 'R' a la 'T' solo salta una, esa es la letra equivocada, realmente tendría que se una 'U'.\n\nJ salta kl M salta ñ O salta pq R tendría que saltar st U salta vw X salta yz A\n\nLa letra equivocada es la letra 'T', tendría que ir la 'U'."
            }
          ]
        },
        option_a: 'T',
        option_b: 'R',
        option_c: 'X',
        option_d: 'A',
        correct_option: 0,
        question_subtype: 'sequence_letter'
      },
      {
        question_text: '¿En cuál de las siguientes series hay una letra equivocada?',
        content_data: {
          sequence: ["Análisis de múltiples series"],
          chart_type: 'sequence_letter',
          pattern_type: 'series_multiple_analisis',
          pattern_description: 'Análisis de múltiples series para detectar errores',
          explanation_sections: [
            {
              title: "📊 EXPLICACIÓN:",
              content: "📋 Análisis de series múltiples:\n\n✅ Opciones a evaluar:\n• a d g j m: a salta bc d salta ef g salta hi j salta kl m... (correcta)\n• p r t v y z: p salta q r salta s t salta u v salta wx, tendría que saltar solo w y marcaría x. La serie tendría que ser: p r t v x z (incorrecta)\n• j k l m n n m l: repite las letras como si fuera un espejo: j k l m n / n m l... (correcta)\n• a b c d_e f g h_i j k l m: a bc d ef g hi j kl m (correcta)\n\nLa segunda serie es incorrecta. p salta q r salta s t salta u v salta wx, tendría que saltar solo w y marcaría x. La serie tendría que ser: p r t v x z"
            }
          ]
        },
        option_a: 'a d g j m',
        option_b: 'p r t v y z',
        option_c: 'j k l m n n m l',
        option_d: 'a b d e g h',
        correct_option: 1,
        question_subtype: 'sequence_letter'
      },
      {
        question_text: 'Resuelve la siguiente serie: C, V, G, R, K, ?',
        content_data: {
          sequence: ["C", "V", "G", "R", "K", "?"],
          chart_type: 'sequence_letter',
          pattern_type: 'series_intercaladas_bidireccional',
          pattern_description: 'Series intercaladas: una incrementa +4, otra decrementa -4',
          explanation_sections: [
            {
              title: "📊 EXPLICACIÓN:",
              content: "📋 Serie intercalada: C, V, G, R, K, ?\n\n✅ Separando las dos series:\n• Serie 1 (impares): C, G, K (incrementando 4 letras)\n• Serie 2 (pares): V, R, ? (decrementando 4 letras)\n\n📋 Análisis:\n• C, G, K (incrementando 4 letras)\n• V, R, ? (decrementando 4 letras)\n\n• Primera serie: C (D, E, F, G) G (H, I, J, K) K (L, M, N, Ñ) ... (incrementando 4 letras)\n• Segunda serie: V ( U, T, S, R) R (Q, P, O, Ñ) ... (decrementando 4 letras)\n\nLa respuesta correcta es Ñ para la primera serie y Ñ para la segunda serie. Como se pide el siguiente término de la serie completa, tomamos el segundo término, que es Ñ.\n\nLa respuesta correcta es Ñ para la primera serie y Ñ para la segunda serie. Como se pide el siguiente término de la serie completa, tomamos el segundo término, que es Ñ."
            }
          ]
        },
        option_a: 'Ñ',
        option_b: 'T',
        option_c: 'M',
        option_d: 'L',
        correct_option: 0,
        question_subtype: 'sequence_letter'
      }
    ];

    console.log('📝 Insertando preguntas de series de letras 36-50...');

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
        console.log(`❌ Error al insertar pregunta ${index + 36}:`, error.message);
        return null;
      }

      console.log(`✅ Pregunta ${index + 36} insertada exitosamente`);
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
      console.log(`Pregunta ${index + 36}: http://localhost:3000/debug/question/${result.id}`);
    });

  } catch (error) {
    console.log('❌ Error general:', error.message);
  }
}

insertSeriesLetrasQuestions();