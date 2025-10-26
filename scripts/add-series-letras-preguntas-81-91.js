import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function insertSeriesLetrasQuestions81_91() {
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
        question_text: 'Indique la letra que continúa la siguiente serie: P Q D E F D P Q G H I G P Q ?',
        content_data: {
          sequence: ["P", "Q", "D", "E", "F", "D", "P", "Q", "G", "H", "I", "G", "P", "Q", "?"],
          chart_type: 'sequence_letter',
          pattern_type: 'series_bloques_intercalados',
          pattern_description: 'Serie con bloques que se repiten entre cada bloque de cuatro letras seguidas',
          explanation_sections: [
            {
              title: "📊 EXPLICACIÓN:",
              content: "📋 Serie: P Q D E F D P Q G H I G P Q ?\n\n✅ SERIES DE LETRAS:\n\nSolución:\n\nLa serie tiene una estructura en bloques: P Q se repite entre cada bloque de cuatro letras seguidas y repitiendo la primera letra que forma el bloque: D E F D; G H I G.\n\nPara contestar siguiendo este patrón le corresponde al grupo J K L J, es decir, iría la letra J.\n\nSerie: P Q / D E F D / P Q / G H I G / P Q / J K L J / P Q ...\n\n📋 Respuesta: J"
            }
          ]
        },
        option_a: 'K',
        option_b: 'P',
        option_c: 'J',
        option_d: 'I',
        correct_option: 2, // C = J
        question_subtype: 'sequence_letter'
      },
      {
        question_text: 'Indique la letra que continuaría la siguiente serie lógica: F, i, M, o, S, v, Z, c, ¿?',
        content_data: {
          sequence: ["F", "i", "M", "o", "S", "v", "Z", "c", "?"],
          chart_type: 'sequence_letter',
          pattern_type: 'series_con_tabla_alfabeto',
          pattern_description: 'Serie usando posiciones del alfabeto con tabla de referencia',
          explanation_sections: [
            {
              title: "📊 EXPLICACIÓN:",
              content: "📋 Serie: F, i, M, o, S, v, Z, c, ?\n\n✅ SERIES DE LETRAS:\n\nUsando la tabla del alfabeto:\nA B C D E F G H I J K L M N Ñ O P Q R S T U V W X Y Z\n1 2 3 4 5 6 7 8 9 10 11 12 13 14 15 16 17 18 19 20 21 22 23 24 25 26 27\n\nAnalizando el patrón:\n• F(6) → i(9) → M(13) → o(16) → S(20) → v(23) → Z(27) → c(3)\n\nLa respuesta correcta es G.\n\n📋 Respuesta: G"
            }
          ]
        },
        option_a: 'F',
        option_b: 'G',
        option_c: 'g',
        option_d: 'D',
        correct_option: 1, // B = G
        question_subtype: 'sequence_letter'
      },
      {
        question_text: 'Indique qué letra continúa cada serie (no cuentan las letras dobles pero sí la ñ). Señale cuál sería la segunda letra a la correspondiente al interrogante: A, B, C, Z, Y, X, D, E, F, Z, Y, X, G, ?:',
        content_data: {
          sequence: ["A", "B", "C", "Z", "Y", "X", "D", "E", "F", "Z", "Y", "X", "G", "?"],
          chart_type: 'sequence_letter',
          pattern_type: 'series_intercaladas_bloques',
          pattern_description: 'Series intercaladas en bloques con patrón ABC, ZYX',
          explanation_sections: [
            {
              title: "📊 EXPLICACIÓN:",
              content: "📋 Serie: A, B, C, Z, Y, X, D, E, F, Z, Y, X, G, ?\n\n✅ SERIES INTERCALADAS:\n\nEl concepto de intercalado hace referencia al hecho de que la relación de las letras de la serie no es de uno en uno, sino que vamos saltando letras.\n\nEn la pregunta nos piden la segunda letra que continuaría la serie:\n\nABC, ZYX, DEF, ZYX, G H I\n\n📋 Respuesta: I"
            }
          ]
        },
        option_a: 'K',
        option_b: 'I',
        option_c: 'J',
        option_d: 'H',
        correct_option: 1, // B = I
        question_subtype: 'sequence_letter'
      },
      {
        question_text: 'Resuelve la siguiente serie: CASA es a AYQY como VELO es a:',
        content_data: {
          sequence: ["CASA → AYQY", "VELO → ?"],
          chart_type: 'sequence_letter',
          pattern_type: 'analogia_decrementos_dos_posiciones',
          pattern_description: 'Analogía con decrementos de 2 posiciones en el alfabeto',
          explanation_sections: [
            {
              title: "📊 EXPLICACIÓN:",
              content: "📋 Analogía: CASA es a AYQY como VELO es a:\n\n✅ SERIES DE LETRAS:\n\nSOLUCIÓN:\n\nLa relación entre CASA y AYQY es que cada letra ha sido decrementada en 2 posiciones en el alfabeto:\n\n• C - 2 = A\n• A - 2 = Y\n• S - 2 = Q\n• A - 2 = Y\n\nSiguiendo la misma lógica:\n\n• V - 2 = T\n• E - 2 = C\n• L - 2 = J\n• O - 2 = N\n\nLa respuesta correcta es T C J N\n\n📋 Respuesta: TCJN"
            }
          ]
        },
        option_a: 'APIM',
        option_b: 'TCJN',
        option_c: 'SBIM',
        option_d: 'LPQR',
        correct_option: 1, // B = TCJN
        question_subtype: 'sequence_letter'
      },
      {
        question_text: 'Continúa la siguiente analogía: CASA es a DBTB como MESA es a______:',
        content_data: {
          sequence: ["CASA → DBTB", "MESA → ?"],
          chart_type: 'sequence_letter',
          pattern_type: 'analogia_incrementos_una_posicion',
          pattern_description: 'Analogía con incrementos de 1 posición en el alfabeto',
          explanation_sections: [
            {
              title: "📊 EXPLICACIÓN:",
              content: "📋 Analogía: CASA es a DBTB como MESA es a______:\n\n✅ SERIES DE LETRAS:\n\nSOLUCIÓN:\n\nLa relación entre CASA y DBTB es que cada letra ha sido incrementada en 1 posición en el alfabeto:\n\n• C + 1 = D\n• A + 1 = B\n• S + 1 = T\n• A + 1 = B\n\nSiguiendo la misma lógica:\n\n• M + 1 = N\n• E + 1 = F\n• S + 1 = T\n• A + 1 = B\n\nLa respuesta correcta es N F T B\n\n📋 Respuesta: NFTB"
            }
          ]
        },
        option_a: 'NFRB',
        option_b: 'NFTB',
        option_c: 'LDRB',
        option_d: 'NTFB',
        correct_option: 1, // B = NFTB
        question_subtype: 'sequence_letter'
      },
      {
        question_text: 'Indique la letra que continúa la siguiente serie lógica: d r q p o e f ñ n m g h ¿?',
        content_data: {
          sequence: ["d", "r", "q", "p", "o", "e", "f", "ñ", "n", "m", "g", "h", "?"],
          chart_type: 'sequence_letter',
          pattern_type: 'series_intercaladas_independientes',
          pattern_description: 'Serie con dos subseries independientes que se incrementan en cantidad de letras',
          explanation_sections: [
            {
              title: "📊 EXPLICACIÓN:",
              content: "📋 Serie: d r q p o e f ñ n m g h ?\n\n✅ SERIES INTERCALADAS:\n\nLa serie tiene dos subseries independientes que se van alternando y que se incrementan en la cantidad de letras.\n\n1) una letra (d), dos letras (e f), tres letras (g h...)\n\n2) cuatro letras seguidas hacia atrás, después tres letras seguidas y así sucesivamente siguiendo en el orden del alfabeto: (r q p o) (ñ n m)...\n\nLa que nos interesa para contestar sería la primera serie: tres letras (g h iría la letra \"i\"). Respuesta correcta: \"i\".\n\nLa serie va: d r q p o e f ñ n m g h i...\n\n📋 Respuesta: i"
            }
          ]
        },
        option_a: 'h',
        option_b: 'i',
        option_c: 'j',
        option_d: 'l',
        correct_option: 1, // B = i
        question_subtype: 'sequence_letter'
      },
      {
        question_text: 'Indique qué letra continúa cada serie (no cuentan las letras dobles pero sí la ñ). Señale cuál sería la segunda letra a la correspondiente al interrogante: D, E, F, G, G, H, I, J, K, K, L, M, ?:',
        content_data: {
          sequence: ["D", "E", "F", "G", "G", "H", "I", "J", "K", "K", "L", "M", "?"],
          chart_type: 'sequence_letter',
          pattern_type: 'series_correlativas_grupos',
          pattern_description: 'Serie correlativa con grupos donde se repiten ciertas letras',
          explanation_sections: [
            {
              title: "📊 EXPLICACIÓN:",
              content: "📋 Serie: D, E, F, G, G, H, I, J, K, K, L, M, ?\n\n✅ SERIES DE LETRAS CORRELATIVAS:\n\nConsiste en señalar la letra que corresponde en el lugar de la interrogación, por lo que debemos observar toda la secuencia de letras para ver qué premisa sigue.\n\nDEF, GG, HIJ, KK, LMN ÑÑ\n\nOtro planteamiento: D E F G  G H I J K  K L M N ÑO...\n\nEl resultado seguiría siendo el mismo: Ñ. piden la segunda letra que continúa la serie.\n\n📋 Respuesta: Ñ"
            }
          ]
        },
        option_a: 'Ñ',
        option_b: 'N',
        option_c: 'R',
        option_d: 'O',
        correct_option: 0, // A = Ñ
        question_subtype: 'sequence_letter'
      },
      {
        question_text: '¿Qué letra habría que poner en lugar del interrogante para dar continuidad a la serie?: P S Q R R Q S P ¿?',
        content_data: {
          sequence: ["P", "S", "Q", "R", "R", "Q", "S", "P", "?"],
          chart_type: 'sequence_letter',
          pattern_type: 'series_ciclicas_espejo',
          pattern_description: 'Serie cíclica tipo espejo con patrón repetitivo',
          explanation_sections: [
            {
              title: "📊 EXPLICACIÓN:",
              content: "📋 Serie: P S Q R R Q S P ?\n\n✅ OTRAS POSIBILIDADES DE SERIES:\n\nLa serie, visualmente, parece que nos lleva a un planteamiento de \"espejo\", P S Q R y vuelve R Q S P, y con esto podríamos pensar que la letra que continuaría sería otra vez la P, pero no nos dan dicha letra en las alternativas de respuesta, por eso habrá que buscar otro planteamiento; en este caso sería una serie cíclica (recordemos: las series cíclicas son una combinación de las correlativas e intercaladas. Este tipo de series implican realizar una y otra vez las mismas operaciones. Son aquellas donde generamos una relación con un conjunto de letras que luego repetimos de forma constante.\n\nEn este ejercicio: P Q R S tendría que venir la letra \"T\".\n\n📋 Respuesta: T"
            }
          ]
        },
        option_a: 'O',
        option_b: 'S',
        option_c: 'Q',
        option_d: 'T',
        correct_option: 3, // D = T
        question_subtype: 'sequence_letter'
      },
      {
        question_text: 'Indique la/s letra/s que continuaría la siguiente serie: c, f, h, k, m, o, ? ?',
        content_data: {
          sequence: ["c", "f", "h", "k", "m", "o", "?", "?"],
          chart_type: 'sequence_letter',
          pattern_type: 'series_saltos_variables',
          pattern_description: 'Serie con saltos variables: 2 letras - 1 letra - 2 letras - 1 letra...',
          explanation_sections: [
            {
              title: "📊 EXPLICACIÓN:",
              content: "📋 Serie: c, f, h, k, m, o, ? ?\n\n✅ SERIES DE LETRAS:\n\nSOLUCIÓN:\n\nLa serie va:\nc (salta \"de\") f (salta \"g\") h (salta \"ij\") k (salta \"l\") m (salta \"nn\") o saltaría \"p\" seguiría la \"q\" y después saltaría \"rs\" marcaríamos la \"t\", es decir, va saltando 2 letras -1 letra - 2 letras - 1 letra...y así sucesivamente.\n\nLa serie quedaría: c, f, h, k, m, o, q, t...\n\n📋 Respuesta: q,t"
            }
          ]
        },
        option_a: 'p,r',
        option_b: 'o,r',
        option_c: 'q,t',
        option_d: 'p,q',
        correct_option: 2, // C = q,t
        question_subtype: 'sequence_letter'
      },
      {
        question_text: 'En la serie que se le muestra a continuación, hay una letra que no sigue el orden lógico de la misma, indíquela: H M P S U Z E ...',
        content_data: {
          sequence: ["H", "M", "P", "S", "U", "Z", "E"],
          chart_type: 'sequence_letter',
          pattern_type: 'detectar_error_serie',
          pattern_description: 'Serie correlativa con una letra que no sigue el patrón',
          explanation_sections: [
            {
              title: "📊 EXPLICACIÓN:",
              content: "📋 Serie con error: H M P S U Z E ...\n\n✅ SERIES CORRELATIVAS:\n\nLa serie iría saltando un número de letras que varía y ese esquema lo va repitiendo; comenzaría saltando 4 letras, luego 3 letras, luego dos letras, una letra y vuelve a comenzar: salta 4 letras, salta 3 letras y así sucesivamente.\n\nH (IJKL) M (NÑO) P (QR) S (T) U (VWXY) Z (ABC) tendría que ir la letra \"D\" no la \"E\", esta letra \"E\" sería la que no sigue la regla de la serie.\n\n📋 Respuesta: E"
            }
          ]
        },
        option_a: 'P',
        option_b: 'S',
        option_c: 'E',
        option_d: 'Z',
        correct_option: 2, // C = E
        question_subtype: 'sequence_letter'
      },
      {
        question_text: 'En la siguiente serie de letras, ¿qué letra ocupa el lugar del interrogante para dar sentido lógico a la serie?: i k n q v ¿? i...',
        content_data: {
          sequence: ["i", "k", "n", "q", "v", "?", "i"],
          chart_type: 'sequence_letter',
          pattern_type: 'series_correlativas_saltos_incrementales',
          pattern_description: 'Serie correlativa con saltos incrementales y vuelta al inicio',
          explanation_sections: [
            {
              title: "📊 EXPLICACIÓN:",
              content: "📋 Serie: i k n q v ? i...\n\n✅ SERIES CORRELATIVAS:\n\nLa serie es correlativa, todas las letras siguen el orden del alfabeto, pero lo que cambia son los saltos que se dan entre cada letra: una letra, dos letras, tres letras, cuatro letras...: i (j) k (lm) n (ñop) q (rstu) v (wxyza) ¿? (cdefgh) i...\n\nLa letra que iría en el interrogante, con el patrón marcado, sería la \"b\". Opción de respuesta b.\n\n📋 Respuesta: b"
            }
          ]
        },
        option_a: 'b',
        option_b: 'y',
        option_c: 'z',
        option_d: 'c',
        correct_option: 0, // A = b
        question_subtype: 'sequence_letter'
      }
    ];

    console.log('📝 Insertando preguntas de series de letras 81-91...');

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
        console.log(`❌ Error al insertar pregunta ${index + 81}:`, error.message);
        return null;
      }

      console.log(`✅ Pregunta ${index + 81} insertada exitosamente`);
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
      console.log(`Pregunta ${index + 81}: http://localhost:3000/debug/question/${result.id}`);
    });

  } catch (error) {
    console.log('❌ Error general:', error.message);
  }
}

insertSeriesLetrasQuestions81_91();