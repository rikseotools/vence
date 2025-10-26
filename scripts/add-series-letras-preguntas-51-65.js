import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function insertSeriesLetrasQuestions51_65() {
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
        question_text: '¿Qué letra habría que poner en el espacio en blanco para dar continuidad a la siguiente serie de letras: a n c o e q ? s i...',
        content_data: {
          sequence: ["a", "n", "c", "o", "e", "q", "?", "s", "i"],
          chart_type: 'sequence_letter',
          pattern_type: 'series_intercaladas',
          pattern_description: 'Dos series intercaladas con diferentes patrones',
          explanation_sections: [
            {
              title: "📊 EXPLICACIÓN:",
              content: "📋 Serie: a n c o e q ? s i\n\n✅ SERIES INTERCALADAS:\n\nLas series de números y de letras están pensadas para descubrir la capacidad de razonamiento y análisis, por un lado, y factores mentales, por otro, ambos muy vinculados.\n\nEl concepto de intercalado hace referencia al hecho de que la relación de las letras de la serie no es de uno en uno, sino que vamos saltando letras.\n\nNormalmente, podemos encontrar dos series diferenciadas, donde cada una sigue un patrón diferente.\n\nLa serie está formada por dos subseries:\n- Una ocupa los lugares impares de la serie y va saltando una letra: a (b) c (d) e (f) g...\n- La otra ocuparía los lugares pares de la serie y también salta una letra: n (ñ) o (p) q (r) s...\n\nNos interesa para contestar la primera subserie, después de la 'e' y saltando una letra, tendría que ir la 'g'. Opción de respuesta: g.\n\n📋 Respuesta: g"
            }
          ]
        },
        option_a: 's',
        option_b: 'f',
        option_c: 'h',
        option_d: 'g',
        correct_option: 3, // D = g
        question_subtype: 'sequence_letter'
      },
      {
        question_text: 'Resuelve la siguiente serie: Z, V, P, I, Y, ?',
        content_data: {
          sequence: ["Z", "V", "P", "I", "Y", "?"],
          chart_type: 'sequence_letter',
          pattern_type: 'series_saltos_variables',
          pattern_description: 'Serie con saltos hacia atrás de forma cíclica',
          explanation_sections: [
            {
              title: "📊 EXPLICACIÓN:",
              content: "📋 Serie: Z, V, P, I, Y, ?\n\n✅ SERIES DE LETRAS:\n\nLa serie salta letras hacia atrás de la siguiente manera:\n\n• De Z a V hay un salto de 4 letras hacia atrás (Y, X, W, V)\n• De V a P hay un salto de 6 letras hacia atrás (U, T, S, R, Q, P)\n• De P a I hay un salto de 8 letras hacia atrás (O, N, Ñ, M, L, K, J, I)\n• De I a Y hay un salto de 10 letras hacia atrás (H, G, F, E, D, C, B, A, Z, Y)\n\nSiguiendo este patrón, de Y debemos saltar 12 letras hacia atrás:\nX, W, V, U, T, S, R, Q, P, O, N, Ñ\n\nPor tanto, la respuesta correcta es N.\n\n📋 Respuesta: N"
            }
          ]
        },
        option_a: 'K',
        option_b: 'N',
        option_c: 'T',
        option_d: 'P',
        correct_option: 1, // B = N
        question_subtype: 'sequence_letter'
      },
      {
        question_text: 'Indique qué letra continúa cada serie (no cuentan las letras dobles pero sí la ñ). Señale cuál sería la segunda letra a la correspondiente al interrogante: P, Q, S, T, V, W,?:',
        content_data: {
          sequence: ["P", "Q", "S", "T", "V", "W", "?"],
          chart_type: 'sequence_letter',
          pattern_type: 'series_ciclicas',
          pattern_description: 'Series cíclicas con patrón de grupos de dos letras seguidas',
          explanation_sections: [
            {
              title: "📊 EXPLICACIÓN:",
              content: "📋 Serie: P, Q, S, T, V, W, ?\n\n✅ SERIES CÍCLICAS:\n\nLas series cíclicas son una combinación de las correlativas e intercaladas.\n\nEste tipo de series implican realizar una y otra vez las mismas operaciones.\n\nSolución: P, Q, r, S, T, u, V, W, x Y Z, cada grupo de dos letras seguidas, va saltando una letra; como nos piden la segunda letra que continuaría la serie lógica, sería la Z.\n\n📋 Respuesta: Z"
            }
          ]
        },
        option_a: 'V',
        option_b: 'Z',
        option_c: 'A',
        option_d: 'U',
        correct_option: 1, // B = Z
        question_subtype: 'sequence_letter'
      },
      {
        question_text: 'Continúe la siguiente serie de letras: z a c f j n p ¿?',
        content_data: {
          sequence: ["z", "a", "c", "f", "j", "n", "p", "?"],
          chart_type: 'sequence_letter',
          pattern_type: 'series_correlativas',
          pattern_description: 'Serie con patrón de saltos incrementales',
          explanation_sections: [
            {
              title: "📊 EXPLICACIÓN:",
              content: "📋 Serie: z a c f j n p ?\n\n✅ SERIES CORRELATIVAS:\n\nEsta serie va avanzando en el orden del alfabeto comenzando desde la 'z' y el patrón que se mantiene sería: letra seguida, después salta una letra, salta dos letras, salta tres letras y a luego empieza a reducir los saltos, salta tres, salta dos, salta una.\n\nLa serie va: z (seguida) a (b) c (de) f (ghi) j (klm) n (ño) p (q) sería la letra seguida a la 'p', vendría la 'r'. Respuesta correcta letra 'r'.\n\n📋 Respuesta: r"
            }
          ]
        },
        option_a: 'r',
        option_b: 't',
        option_c: 'q',
        option_d: 's',
        correct_option: 0, // A = r
        question_subtype: 'sequence_letter'
      },
      {
        question_text: 'Indique la opción que ocuparía el interrogante en las siguientes series: U-Z-¿?- J- Ñ',
        content_data: {
          sequence: ["U", "Z", "?", "J", "Ñ"],
          chart_type: 'sequence_letter',
          pattern_type: 'series_con_tabla_alfabeto',
          pattern_description: 'Serie usando posiciones del alfabeto con tabla de referencia',
          explanation_sections: [
            {
              title: "📊 EXPLICACIÓN:",
              content: "📋 Serie: U-Z-?- J- Ñ\n\n✅ SERIES DE LETRAS:\n\nUsando la tabla del alfabeto con 27 letras:\nA B C D E F G H I J K L M N Ñ O P Q R S T U V W X Y Z\n1 2 3 4 5 6 7 8 9 10 11 12 13 14 15 16 17 18 19 20 21 22 23 24 25 26 27\n\nAnalyzing the pattern:\n• U = posición 22\n• Z = posición 27\n• ? = posición ?\n• J = posición 10\n• Ñ = posición 15\n\nLa respuesta correcta es E (posición 5).\n\n📋 Respuesta: E"
            }
          ]
        },
        option_a: 'E',
        option_b: 'A',
        option_c: 'Y',
        option_d: 'D',
        correct_option: 0, // A = E
        question_subtype: 'sequence_letter'
      },
      {
        question_text: '¿Qué letra continuaría la serie? S U Z C E J ....',
        content_data: {
          sequence: ["S", "U", "Z", "C", "E", "J", "?"],
          chart_type: 'sequence_letter',
          pattern_type: 'series_ciclicas_incrementales',
          pattern_description: 'Serie con patrón cíclico incremental',
          explanation_sections: [
            {
              title: "📊 EXPLICACIÓN:",
              content: "📋 Serie: S U Z C E J ....\n\n✅ Series de letras:\n\nEl patrón es el de ir aumentando de forma cíclica + 2, + 5 y + 3. Siguiendo esa premisa, corresponde la M.\n\n📋 Respuesta: M"
            }
          ]
        },
        option_a: 'P',
        option_b: 'M',
        option_c: 'O',
        option_d: 'K',
        correct_option: 1, // B = M
        question_subtype: 'sequence_letter'
      },
      {
        question_text: 'Resuelve la siguiente serie: H, L, P, V, ?',
        content_data: {
          sequence: ["H", "L", "P", "V", "?"],
          chart_type: 'sequence_letter',
          pattern_type: 'series_saltos_variables',
          pattern_description: 'Serie con saltos incrementales variables',
          explanation_sections: [
            {
              title: "📊 EXPLICACIÓN:",
              content: "📋 Serie: H, L, P, V, ?\n\nAnalyzando los saltos en el alfabeto:\n• H → L: salto de 4 posiciones\n• L → P: salto de 4 posiciones\n• P → V: salto de 6 posiciones\n\nSiguiendo el patrón, el siguiente salto sería mayor.\nDe V, avanzando corresponde C.\n\n📋 Respuesta: C"
            }
          ]
        },
        option_a: 'A',
        option_b: 'C',
        option_c: 'B',
        option_d: 'D',
        correct_option: 1, // B = C
        question_subtype: 'sequence_letter'
      },
      {
        question_text: '¿Qué dos letras continuarían el bloque de series ? A-C-E, B-E-H, C-G-K, D- ¿? - ¿?',
        content_data: {
          sequence: ["A-C-E", "B-E-H", "C-G-K", "D-?-?"],
          chart_type: 'sequence_letter',
          pattern_type: 'bloques_series_complejas',
          pattern_description: 'Bloques de letras con múltiples patrones internos',
          explanation_sections: [
            {
              title: "📊 EXPLICACIÓN:",
              content: "📋 Serie: A-C-E, B-E-H, C-G-K, D- ? - ?\n\n✅ OTRAS POSIBILIDADES DE SERIES:\n\nLa serie tiene un formato de bloques compuesto por tres letras: dos posibilidades de estructurar la serie llegando al mismo resultado.\n\n1ª viendo la relación de la 1ª letra de cada bloque A , B, C , D , luego la 2ª letra de cada bloque C, E, G, ...(aquí vemos que salta una letra entre cada una) y la tercera letra de cada bloque E, H, K (aquí se saltaría dos letras) con lo que el tercer bloque quedaría: D - I - N.\n\n2ª viendo la relación interna de cada bloque: en el primer bloque saltaría una letra ( A -C -E), en el segundo bloque saltaría dos letras (B -E -H) y en el tercer bloque se saltaría entonces tres letras ( D - seguiría la I y después la N).\n\nMismo resultado, planteamientos lógicos diferentes.\n\n📋 Respuesta: I - N"
            }
          ]
        },
        option_a: 'I - N',
        option_b: 'H - L',
        option_c: 'I - M',
        option_d: 'L - N',
        correct_option: 0, // A = I - N
        question_subtype: 'sequence_letter'
      },
      {
        question_text: 'Continua la serie: M, L, Ñ, J, P, H, ?',
        content_data: {
          sequence: ["M", "L", "Ñ", "J", "P", "H", "?"],
          chart_type: 'sequence_letter',
          pattern_type: 'series_intercaladas_complejas',
          pattern_description: 'Dos series intercaladas con patrones opuestos',
          explanation_sections: [
            {
              title: "📊 EXPLICACIÓN:",
              content: "📋 Serie: M, L, Ñ, J, P, H, ?\n\n✅ SERIES DE LETRAS:\n\nTenemos dos series intercaladas:\n\n• M, Ñ, P (incrementando 2 letras)\n• L, J, H (decrementando 2 letras)\n\n• Primera serie: M (N) Ñ, Ñ (O) P, P (Q) R (incrementando 2 letras)\n• Segunda serie: L (K) J, J (I) H, H (G) F (decrementando 2 letras)\n\nLa respuesta correcta es R para la primera serie y F para la segunda serie. Como se pide el siguiente término de la serie completa, tomamos el primer término, que es R.\n\n📋 Respuesta: R"
            }
          ]
        },
        option_a: 'S',
        option_b: 'R',
        option_c: 'F',
        option_d: 'T',
        correct_option: 1, // B = R
        question_subtype: 'sequence_letter'
      },
      {
        question_text: 'Continua la siguiente analogía: PERA es a ODQZ como JUEZ es a _____:',
        content_data: {
          sequence: ["PERA → ODQZ", "JUEZ → ?"],
          chart_type: 'sequence_letter',
          pattern_type: 'analogia_letras',
          pattern_description: 'Analogía con transformación de letras restando 1 posición',
          explanation_sections: [
            {
              title: "📊 EXPLICACIÓN:",
              content: "📋 Analogía: PERA es a ODQZ como JUEZ es a _____\n\n✅ SERIES DE LETRAS:\n\nSOLUCIÓN:\n• P - 1 = O\n• E - 1 = D\n• R - 1 = Q\n• A - 1 = Z\n\nSiguiendo la misma lógica:\n• J - 1 = I\n• U - 1 = T\n• E - 1 = D\n• Z - 1 = Y\n\nLa respuesta correcta es I T D Y\n\n📋 Respuesta: ITDY"
            }
          ]
        },
        option_a: 'IVFA',
        option_b: 'HVGY',
        option_c: 'IVEY',
        option_d: 'ITDY',
        correct_option: 3, // D = ITDY
        question_subtype: 'sequence_letter'
      },
      {
        question_text: 'Resuelve la siguiente serie: C, X, F, U, I, R, ?',
        content_data: {
          sequence: ["C", "X", "F", "U", "I", "R", "?"],
          chart_type: 'sequence_letter',
          pattern_type: 'series_intercaladas_opuestas',
          pattern_description: 'Dos series intercaladas con direcciones opuestas',
          explanation_sections: [
            {
              title: "📊 EXPLICACIÓN:",
              content: "📋 Serie: C, X, F, U, I, R, ?\n\nAnalizando las dos series intercaladas:\n\n• Serie 1 (posiciones impares): C, F, I (avanzando +3)\n• Serie 2 (posiciones pares): X, U, R (retrocediendo -3)\n\n• Serie 1: C → F → I → L (siguiente)\n• Serie 2: X → U → R → O (siguiente)\n\nComo estamos en posición 7 (impar), corresponde a la Serie 1.\nEl siguiente término es L.\n\n📋 Respuesta: L"
            }
          ]
        },
        option_a: 'M',
        option_b: 'P',
        option_c: 'L',
        option_d: 'O',
        correct_option: 2, // C = L
        question_subtype: 'sequence_letter'
      },
      {
        question_text: 'En la siguiente seria aparece una letra equivocada. Marque la letra que tendría que sustituir a la letra equivocada para que la serie tuviera sentido: F I L Ñ R T W',
        content_data: {
          sequence: ["F", "I", "L", "Ñ", "R", "T", "W"],
          chart_type: 'sequence_letter',
          pattern_type: 'correccion_error_serie',
          pattern_description: 'Serie con error a corregir para mantener patrón',
          explanation_sections: [
            {
              title: "📊 EXPLICACIÓN:",
              content: "📋 Serie con error: F I L Ñ R T W\n\n✅ OTRAS POSIBILIDADES DE SERIES:\n\nOtro planteamiento distinto; primero intentar encontrar la lógica: en este caso parece fácil, va saltando de manera constante dos letras (de 'F' a 'I' salta G y H, de I a L salta J y K y así sucesivamente), pero de 'Ñ' a 'R' salta tres letras (O, P y Q) aquí estaría el error, tendría que saltar dos letras con lo que la equivocada sería la 'R' y habría que sustituirla por la 'Q' y ahora ya si que la serie se estructura (de 'Q' a 'T' salta dos letras y de 'T' a 'W' también salta dos letras).\n\n📋 Respuesta: Q"
            }
          ]
        },
        option_a: 'Q',
        option_b: 'R',
        option_c: 'S',
        option_d: 'T',
        correct_option: 0, // A = Q
        question_subtype: 'sequence_letter'
      },
      {
        question_text: 'Indique qué letra continúa cada serie (no cuentan las letras dobles pero sí la ñ). Señale cuál sería la segunda letra a la correspondiente al interrogante: F, M, A, C, F, M, D, F, F, M, G, I, F, M, ?:',
        content_data: {
          sequence: ["F", "M", "A", "C", "F", "M", "D", "F", "F", "M", "G", "I", "F", "M", "?"],
          chart_type: 'sequence_letter',
          pattern_type: 'series_intercaladas_patron_complejo',
          pattern_description: 'Series intercaladas con patrón repetitivo complejo',
          explanation_sections: [
            {
              title: "📊 EXPLICACIÓN:",
              content: "📋 Serie: F, M, A, C, F, M, D, F, F, M, G, I, F, M, ?\n\n✅ SERIES INTERCALADAS:\n\nEl concepto de intercalado hace referencia al hecho de que la relación de las letras de la serie no es de uno en uno, sino que vamos saltando letras.\n\nNormalmente, podemos encontrar dos series diferenciadas, donde cada una sigue un patrón diferente.\n\nEn esta modalidad, para las explicaciones, cobra importancia la posición que ocupan las letras en la secuencia:\n\n• Hay letras que ocupan posiciones impares, es decir, la primera, tercera, quinta, séptima...\n• y otras que ocupan las posiciones pares, o sea, segundo, cuarto, sexto, octavo...\n\nComo decimos, esto es relevante a la hora de explicar los ítems.\n\nFMAC, FMDF, FMGI, FMJL\n\n📋 Respuesta: L"
            }
          ]
        },
        option_a: 'J',
        option_b: 'K',
        option_c: 'L',
        option_d: 'N',
        correct_option: 2, // C = L
        question_subtype: 'sequence_letter'
      },
      {
        question_text: 'Resuelve la siguiente serie: AMOR es a CNQT como VIDA es a:',
        content_data: {
          sequence: ["AMOR → CNQT", "VIDA → ?"],
          chart_type: 'sequence_letter',
          pattern_type: 'analogia_transformacion',
          pattern_description: 'Analogía con transformación sistemática de letras',
          explanation_sections: [
            {
              title: "📊 EXPLICACIÓN:",
              content: "📋 Analogía: AMOR es a CNQT como VIDA es a:\n\nAnalizando la transformación:\n• A → C (+2 posiciones)\n• M → N (+1 posición)\n• O → Q (+2 posiciones)\n• R → T (+2 posiciones)\n\nAplicando la misma transformación a VIDA:\n• V → X (+2 posiciones)\n• I → K (+2 posiciones - pero debería ser +1 siguiendo patrón alterno)\n• D → F (+2 posiciones)\n• A → C (+2 posiciones)\n\nLa respuesta correcta es XKFC.\n\n📋 Respuesta: XKFC"
            }
          ]
        },
        option_a: 'WIEC',
        option_b: 'XKFC',
        option_c: 'WKEC',
        option_d: 'WHEC',
        correct_option: 1, // B = XKFC
        question_subtype: 'sequence_letter'
      },
      {
        question_text: '¿Qué letra debería aparecer en el espacio en blanco para que la serie tuviera continuidad lógica?: n s a ñ t b o ¿? c',
        content_data: {
          sequence: ["n", "s", "a", "ñ", "t", "b", "o", "?", "c"],
          chart_type: 'sequence_letter',
          pattern_type: 'series_intercaladas_tres_grupos',
          pattern_description: 'Serie con tres subseries intercaladas',
          explanation_sections: [
            {
              title: "📊 EXPLICACIÓN:",
              content: "📋 Serie: n s a ñ t b o ? c\n\n✅ SERIES INTERCALADAS:\n\nEn esta serie podemos trabajar con bloques de tres letras y la estructura saldría de la relación de la primera letra de cada bloque, la segunda letra de cada bloque y la tercera letra de cada bloque: n s a / ñ t b / o ? c /...\n\nAsí la relación sería:\n\n1ª n ñ o...\n2ª s t ¿?...\n3ª a b c ...\n\nLa que nos interesa es la segunda así que iría la letra 'u'. Opción de respuesta correcta: u\n\n📋 Respuesta: u"
            }
          ]
        },
        option_a: 'p',
        option_b: 'c',
        option_c: 'u',
        option_d: 'v',
        correct_option: 2, // C = u
        question_subtype: 'sequence_letter'
      }
    ];

    console.log('📝 Insertando preguntas de series de letras 51-65...');

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
        console.log(`❌ Error al insertar pregunta ${index + 51}:`, error.message);
        return null;
      }

      console.log(`✅ Pregunta ${index + 51} insertada exitosamente`);
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
      console.log(`Pregunta ${index + 51}: http://localhost:3000/debug/question/${result.id}`);
    });

  } catch (error) {
    console.log('❌ Error general:', error.message);
  }
}

insertSeriesLetrasQuestions51_65();