import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function insertSeriesLetrasQuestions67_80() {
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
        question_text: 'O, F, M, H, J, J, ....',
        content_data: {
          sequence: ["O", "F", "M", "H", "J", "J", "?", "?", "?"],
          chart_type: 'sequence_letter',
          pattern_type: 'series_intercaladas_dos_subseries',
          pattern_description: 'Dos subseries intercaladas con patrones diferentes',
          explanation_sections: [
            {
              title: "📊 EXPLICACIÓN:",
              content: "📋 Serie: O, F, M, H, J, J, ....\n\n✅ Series de letras:\n\nLa serie original: C, H, D, G, F, E, I, B... estaría compuesta de dos subseries:\n\n1. C (seguida) D (salta E) F (salta GH) I (ahora saltaría JKL) M (saltaría ÑÑOP) Q...\n\n2. H (seguida) G (salta F) E (salta DC) B (saltaría AZY) X (saltaría WVUT) S...\n\nUna subserie va avanzando en el abecedario saltando 0, 1, 2, 3 letras.. y la otra sigue el mismo planteamiento pero hacia atrás en el abecedario; la serie quedaría:\n\nC H D G F E I B M X Q..., las letras que continuarían la serie serían M X Q\n\n📋 Respuesta: G, L, D"
            }
          ]
        },
        option_a: 'L, Ñ, T',
        option_b: 'K, N, R',
        option_c: 'G, K, N',
        option_d: 'G, L, D',
        correct_option: 3, // D = G, L, D
        question_subtype: 'sequence_letter'
      },
      {
        question_text: 'Señale la letra que continuaría el planteamiento lógico de la siguiente serie: z a c f j ñ ¿?',
        content_data: {
          sequence: ["z", "a", "c", "f", "j", "ñ", "?"],
          chart_type: 'sequence_letter',
          pattern_type: 'series_correlativas_saltos_incrementales',
          pattern_description: 'Serie correlativa con saltos incrementales desde z',
          explanation_sections: [
            {
              title: "📊 EXPLICACIÓN:",
              content: "📋 Serie: z a c f j ñ ?\n\n✅ SERIES CORRELATIVAS:\n\nLa serie presentada iría avanzando en el abecedario comenzando por la 'z' e iría incrementando las letras que va saltando:\n\nz (no salta) a (b) c (de) f (ghi) j (klmn) ñ... ahora saltaría cinco letras (opqrs) marcaríamos la 't'.\n\nOpción de respuesta correcta: r.\n\n📋 Respuesta: t"
            }
          ]
        },
        option_a: 'v',
        option_b: 't',
        option_c: 's',
        option_d: 'u',
        correct_option: 1, // B = t
        question_subtype: 'sequence_letter'
      },
      {
        question_text: '¿Qué letra continuaría la lógica de la siguiente serie?: a h b c g d e f f g h i j ¿?',
        content_data: {
          sequence: ["a", "h", "b", "c", "g", "d", "e", "f", "f", "g", "h", "i", "j", "?"],
          chart_type: 'sequence_letter',
          pattern_type: 'series_intercaladas_patron_complejo',
          pattern_description: 'Dos subseries intercaladas que se van alternando',
          explanation_sections: [
            {
              title: "📊 EXPLICACIÓN:",
              content: "📋 Serie: a h b c g d e f f g h i j ?\n\n✅ SERIES INTERCALADAS:\n\nTenemos dos subseries que forman la serie original y se van alternando:\n\n- una serie va avanzando en el orden del abecedario e incrementando la cantidad de letras: una letra, dos letras contiguas, tres letras contiguas... a b c d e f g h i j...\n\n- otra serie va hacia atrás en el orden alfabético y las letras seguidas: h g f ¿?, esta es la letra que nos piden, tendría que ir la letra 'e'.\n\nLa serie queda: a h b c g d e f f g h i j e ...\n\n📋 Respuesta: e"
            }
          ]
        },
        option_a: 'l',
        option_b: 'h',
        option_c: 'e',
        option_d: 'f',
        correct_option: 2, // C = e
        question_subtype: 'sequence_letter'
      },
      {
        question_text: 'Continúa la serie: A, C, B, D, C, E, ?',
        content_data: {
          sequence: ["A", "C", "B", "D", "C", "E", "?"],
          chart_type: 'sequence_letter',
          pattern_type: 'series_ciclicas_salta_retrocede',
          pattern_description: 'Serie cíclica que salta 2, retrocede 1',
          explanation_sections: [
            {
              title: "📊 EXPLICACIÓN:",
              content: "📋 Serie: A, C, B, D, C, E, ?\n\n✅ SERIES DE LETRAS:\n\nLa serie sigue esta secuencia cíclica: salta 2, retrocede 1.\n\n• De A a C: +2 letras (B, C)\n• De C a B: -1 letra\n• De B a D: +2 letras (C, D)\n• De D a C: -1 letra\n• De C a E: +2 letras (D, E)\n\nSiguiendo el patrón, desde E debemos retroceder 1 letra: D\n\nPor tanto, la respuesta correcta es D\n\n📋 Respuesta: D"
            }
          ]
        },
        option_a: 'G',
        option_b: 'F',
        option_c: 'B',
        option_d: 'D',
        correct_option: 3, // D = D
        question_subtype: 'sequence_letter'
      },
      {
        question_text: 'Si no tenemos en cuenta las letras dobles del abecedario (la ch y la ll), ¿Cuál sería el resultado de la siguiente equivalencia? BIMK es a TAEC como KQVS es a A.....',
        content_data: {
          sequence: ["BIMK → TAEC", "KQVS → ?"],
          chart_type: 'sequence_letter',
          pattern_type: 'analogia_equivalencia_sin_dobles',
          pattern_description: 'Analogía con equivalencia sin letras dobles',
          explanation_sections: [
            {
              title: "📊 EXPLICACIÓN:",
              content: "📋 Analogía: BIMK es a TAEC como KQVS es a A.....\n\n✅ SERIES INTERCALADAS:\n\nEl concepto de intercalado hace referencia al hecho de que la relación de las letras de la serie no es de uno en uno, sino que vamos saltando letras.\n\nNormalmente, podemos encontrar dos series diferenciadas, donde cada una sigue un patrón diferente.\n\nEn esta modalidad, para las explicaciones, cobra importancia la posición que ocupan las letras en la secuencia:\n\n• Hay letras que ocupan posiciones impares, es decir, la primera, tercera, quinta, séptima...\n• y otras que ocupan las posiciones pares, o sea, segundo, cuarto, sexto, octavo...\n\nComo decimos, esto es relevante a la hora de explicar los ítems.\n\nEn esta serie nos encontramos con dos series sin saltos, la segunda aporta la siguiente letra.\n\n📋 Respuesta: HMJ"
            }
          ]
        },
        option_a: 'HMJ',
        option_b: 'HMK',
        option_c: 'HMÑ',
        option_d: 'HML',
        correct_option: 0, // A = HMJ
        question_subtype: 'sequence_letter'
      },
      {
        question_text: 'Siguiendo el razonamiento lógico de la serie, ¿Qué letra la continuaría?: M N A Ñ O B P Q C R ?',
        content_data: {
          sequence: ["M", "N", "A", "Ñ", "O", "B", "P", "Q", "C", "R", "?"],
          chart_type: 'sequence_letter',
          pattern_type: 'series_bloques_dos_letras_alterna',
          pattern_description: 'Bloques de dos letras seguidas y una alterna formando otra serie',
          explanation_sections: [
            {
              title: "📊 EXPLICACIÓN:",
              content: "📋 Serie: M N A Ñ O B P Q C R ?\n\n✅ SERIES DE LETRAS:\n\nSolución:\n\nFormato de la serie: bloques de dos letras seguidas y una alterna formando otra serie: M N Ñ O P Q R iría ahora una S.\n\n📋 Respuesta: S"
            }
          ]
        },
        option_a: 'C',
        option_b: 'D',
        option_c: 'T',
        option_d: 'S',
        correct_option: 3, // D = S
        question_subtype: 'sequence_letter'
      },
      {
        question_text: 'En la siguiente serie, complete la letra que tendría que aparecer en el hueco/s en blanco para que la serie continúe su lógica: B D Y B [ ] F Y B D F',
        content_data: {
          sequence: ["B", "D", "Y", "B", "?", "F", "Y", "B", "D", "F"],
          chart_type: 'sequence_letter',
          pattern_type: 'completar_serie_bloques_intercalados',
          pattern_description: 'Serie con bloques que intercalan Y, aumentando una letra en cada bloque',
          explanation_sections: [
            {
              title: "📊 EXPLICACIÓN:",
              content: "📋 Serie: B D Y B [ ] F Y B D F\n\n✅ SERIES DE LETRAS:\n\nSolución:\n\nComienza la serie con el grupo B D e intercala la Y ; sigue aumentando una letra el bloque B D F e intercala la Y; en el hueco que nos piden debería ir la D.\n\nB D Y  B D F Y  B D F...\n\n📋 Respuesta: D"
            }
          ]
        },
        option_a: 'H',
        option_b: 'I',
        option_c: 'D',
        option_d: 'J',
        correct_option: 2, // C = D
        question_subtype: 'sequence_letter'
      },
      {
        question_text: 'Indique la letra que ocuparía el espacio en blanco en la siguiente serie: r z r s z r s t z r s t __ z ...',
        content_data: {
          sequence: ["r", "z", "r", "s", "z", "r", "s", "t", "z", "r", "s", "t", "?", "z"],
          chart_type: 'sequence_letter',
          pattern_type: 'series_correlativas_bloques_incrementales',
          pattern_description: 'Serie correlativa con bloques que van incrementando con z intercalada',
          explanation_sections: [
            {
              title: "📊 EXPLICACIÓN:",
              content: "📋 Serie: r z r s z r s t z r s t __ z ...\n\n✅ SERIES CORRELATIVAS:\n\nDos bloques diferenciados en la serie:\n\n- primer bloque comienza con la 'r' y va aumentando la cantidad de letras según avanza la serie pero siempre cogiendo las anteriores: primero r, luego aumenta r s; después aumenta r s t; y así sucesivamente.\n\n- segundo bloque: alterna la letra 'z' entre cada bloque anterior.\n\nQuedaría: r z r s z r s t z r s t ¿? sería la letra 'u' la que ocuparía el espacio en blanco y luego volvería la 'z'. La letra que nos piden sería la 'u'.\n\nLa serie: r z r s z r s t z r s t u z ...\n\n📋 Respuesta: u"
            }
          ]
        },
        option_a: 'z',
        option_b: 'v',
        option_c: 'w',
        option_d: 'u',
        correct_option: 3, // D = u
        question_subtype: 'sequence_letter'
      },
      {
        question_text: 'Indique qué letra continúa cada serie (no cuentan las letras dobles pero sí la ñ). Señale cuál sería la segunda letra que continúa la serie: R, A, S, B, T, C, U, D, ?:',
        content_data: {
          sequence: ["R", "A", "S", "B", "T", "C", "U", "D", "?"],
          chart_type: 'sequence_letter',
          pattern_type: 'series_intercaladas_avance_doble',
          pattern_description: 'Series intercaladas donde una avanza y otra va secuencial',
          explanation_sections: [
            {
              title: "📊 EXPLICACIÓN:",
              content: "📋 Serie: R, A, S, B, T, C, U, D, ?\n\n✅ SERIES INTERCALADAS:\n\nEl concepto de intercalado hace referencia al hecho de que la relación de las letras de la serie no es de uno en uno, sino que vamos saltando letras del abecedario.\n\nNos piden la segunda letra que continúa la serie:\n\nR, A, S, B, T, C, U, D, ...V, E\n\n📋 Respuesta: E"
            }
          ]
        },
        option_a: 'Z',
        option_b: 'E',
        option_c: 'W',
        option_d: 'V',
        correct_option: 1, // B = E
        question_subtype: 'sequence_letter'
      },
      {
        question_text: 'Continúa la serie: D, B, H, F, L, ?',
        content_data: {
          sequence: ["D", "B", "H", "F", "L", "?"],
          chart_type: 'sequence_letter',
          pattern_type: 'series_ciclicas_retrocede_salta',
          pattern_description: 'Serie cíclica: retrocede 2, salta 6',
          explanation_sections: [
            {
              title: "📊 EXPLICACIÓN:",
              content: "📋 Serie: D, B, H, F, L, ?\n\n✅ SERIES DE LETRAS:\n\nSOLUCIÓN:\n\nAquí tenemos una serie cíclica donde: retrocede 2, salta 6.\n\n• De D a B: -2 letras (C, B)\n• De B a H: +6 letras (C, D, E, F, G, H)\n• De H a F: -2 letras (G, F)\n• De F a L: +6 letras (G, H, I, J, K, L)\n\nSiguiendo el patrón, desde L debemos retroceder 2 letras:\n\n• K, J La respuesta correcta sería J.\n\n📋 Respuesta: J"
            }
          ]
        },
        option_a: 'Ñ',
        option_b: 'J',
        option_c: 'M',
        option_d: 'K',
        correct_option: 1, // B = J
        question_subtype: 'sequence_letter'
      },
      {
        question_text: 'Indique la opción de respuesta que continuaría la siguiente serie: F E D C B K J I H G O Ñ N M L ? ? ?',
        content_data: {
          sequence: ["F", "E", "D", "C", "B", "K", "J", "I", "H", "G", "O", "Ñ", "N", "M", "L", "?", "?", "?"],
          chart_type: 'sequence_letter',
          pattern_type: 'series_bloques_cinco_letras_hacia_atras',
          pattern_description: 'Bloques de cinco letras seguidas hacia atrás saltando 8 letras',
          explanation_sections: [
            {
              title: "📊 EXPLICACIÓN:",
              content: "📋 Serie: F E D C B K J I H G O Ñ N M L ? ? ?\n\n✅ SERIES DE LETRAS:\n\nSolución: F E D C B salta cdefghij (8) K J I H G salta hijklmn (8) O Ñ N M L mnñopqrs T... Es decir, bloques de cinco letras seguidas hacia atrás y salta 8 letras y así sucesivamente. Hay que tener cuidado porque el ejercicio nos pide tres letras y dos pertenecen a un bloque (ML) y la tercera a otro bloque (T).\n\n📋 Respuesta: M L T"
            }
          ]
        },
        option_a: 'M P S',
        option_b: 'M L R',
        option_c: 'L M Q',
        option_d: 'M L T',
        correct_option: 3, // D = M L T
        question_subtype: 'sequence_letter'
      },
      {
        question_text: 'Resuelve la siguiente serie: J, L, I, K, H, J, ?',
        content_data: {
          sequence: ["J", "L", "I", "K", "H", "J", "?"],
          chart_type: 'sequence_letter',
          pattern_type: 'series_intercaladas_dobles_decrementos',
          pattern_description: 'Dos series intercaladas con decrementos de 1 letra',
          explanation_sections: [
            {
              title: "📊 EXPLICACIÓN:",
              content: "📋 Serie: J, L, I, K, H, J, ?\n\n✅ SERIES DE LETRAS:\n\nSOLUCIÓN:\n\nTenemos dos series intercaladas:\n\n• J, I, H (decrementando 1 letra)\n• L, K, J (decrementando 1 letra)\n\n• Primera serie: J, I, H, G (siguiente)\n• Segunda serie: L, K, J, I (siguiente)\n\nLa respuesta correcta es G para la primera serie e I para la segunda serie. Como se pide el siguiente término de la serie completa, tomamos el primer término, que es G.\n\n📋 Respuesta: G"
            }
          ]
        },
        option_a: 'G',
        option_b: 'H',
        option_c: 'I',
        option_d: 'L',
        correct_option: 0, // A = G
        question_subtype: 'sequence_letter'
      },
      {
        question_text: 'Indique la letra que continuaría la lógica de la siguiente serie: S T U T U W X Y Y A B C B C ?',
        content_data: {
          sequence: ["S", "T", "U", "T", "U", "W", "X", "Y", "Y", "A", "B", "C", "B", "C", "?"],
          chart_type: 'sequence_letter',
          pattern_type: 'series_bloques_patron_complejo',
          pattern_description: 'Serie con bloques y patrón repetitivo complejo',
          explanation_sections: [
            {
              title: "📊 EXPLICACIÓN:",
              content: "📋 Serie: S T U T U W X Y Y A B C B C ?\n\n✅ SERIES DE LETRAS:\n\nSolución:\n\n1. S / T U T U / W X Y / Y / A B C B C / : S W A forman una serie (saltan tres letras) tendría que ir la 'E', y la otra estructura repite el bloque T U T U; X Y Y; B C B C...\n\n2. S T U / T U - W XY / X Y - A B C / B C - el primer bloque van seguidas (STU) salta una letra (V) y sigue el bloque seguidas (WXY), saltaría una letra (Z) y continúa el bloque (ABC), mientras que entre cada uno de los bloques repite las dos letras TU, XY, BC.\n\nSi seguimos este patrón del bloque ABC saltaría una letra (D) tendría que ir la 'E'.\n\n📋 Respuesta: E"
            }
          ]
        },
        option_a: 'C',
        option_b: 'Y',
        option_c: 'X',
        option_d: 'E',
        correct_option: 3, // D = E
        question_subtype: 'sequence_letter'
      },
      {
        question_text: 'En la siguiente serie, ¿qué letra continuaría la lógica de la misma? q p ñ n l k i h f e c b',
        content_data: {
          sequence: ["q", "p", "ñ", "n", "l", "k", "i", "h", "f", "e", "c", "b", "?"],
          chart_type: 'sequence_letter',
          pattern_type: 'series_bloques_decrementos_hacia_atras',
          pattern_description: 'Serie hacia atrás en bloques de dos letras contiguas saltando una letra entre cada bloque',
          explanation_sections: [
            {
              title: "📊 EXPLICACIÓN:",
              content: "📋 Serie: q p ñ n l k i h f e c b ?\n\n✅ SERIES DE LETRAS:\n\nSolución:\n\nLa serie va hacia atrás en bloques de dos letras contiguas y saltando una letra entre cada bloque. q p salta o, ñ n salta m, l k salta j, i h salta g, f e salta d, c tendría que ir la 'b'.\n\nq p   ñ n   l k   i h   f e   cb\n  o     m     j     g     d\n\n📋 Respuesta: b"
            }
          ]
        },
        option_a: 'g',
        option_b: 'b',
        option_c: 'h',
        option_d: 'f',
        correct_option: 1, // B = b
        question_subtype: 'sequence_letter'
      }
    ];

    console.log('📝 Insertando preguntas de series de letras 67-80...');

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
        console.log(`❌ Error al insertar pregunta ${index + 67}:`, error.message);
        return null;
      }

      console.log(`✅ Pregunta ${index + 67} insertada exitosamente`);
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
      console.log(`Pregunta ${index + 67}: http://localhost:3000/debug/question/${result.id}`);
    });

  } catch (error) {
    console.log('❌ Error general:', error.message);
  }
}

insertSeriesLetrasQuestions67_80();