import { createClient } from '@supabase/supabase-js';

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );
}

// Generar UUIDs únicos para cada pregunta
function generateUUID() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

async function addLetterSeriesQuestions() {
  try {
    const supabase = getSupabase();

    const questions = [
      {
        id: generateUUID(),
        question_text: 'En un abecedario donde no se tienen en cuenta las letras dobles (la ch y la ll), ¿cuál es la letra que ocupa el quinto lugar hacia atrás a partir de la letra intermedia entre la P y la R?',
        question_subtype: 'sequence_letter',
        option_a: 'L',
        option_b: 'M',
        option_c: 'N',
        option_d: 'Ñ',
        correct_option: 1, // B = M
        content_data: {
          chart_type: 'sequence_letter',
          pattern_type: 'positional',
          pattern_description: 'Determinar letra por posición relativa en el alfabeto',
          explanation_sections: [
            {
              title: "💡 ¿Qué evalúa este ejercicio?",
              content: "Capacidad de trabajar con posiciones alfabéticas y realizar cálculos de posición relativa en el alfabeto español sin letras dobles."
            },
            {
              title: "📊 ANÁLISIS PASO A PASO:",
              content: "📋 Empezamos por el final, la letra intermedia entre la P y la R sería la Q, así que la quinta hacia atrás es la M.\n\n✅ Alfabeto sin CH y LL: A B C D E F G H I J K L M N Ñ O P Q R S T U V W X Y Z\n\n📋 Posiciones:\n• P = posición 16\n• R = posición 18\n• Letra intermedia: Q = posición 17\n• Quinta hacia atrás desde Q: M = posición 12"
            }
          ]
        }
      },
      {
        id: generateUUID(),
        question_text: 'Continúe la siguiente serie de letras: a j c l e n g o i ?',
        question_subtype: 'sequence_letter',
        option_a: 'q',
        option_b: 'j',
        option_c: 'h',
        option_d: 'p',
        correct_option: 0, // A = q
        content_data: {
          chart_type: 'sequence_letter',
          sequence: ['a', 'j', 'c', 'l', 'e', 'n', 'g', 'o', 'i', '?'],
          pattern_type: 'alternating',
          pattern_description: 'Serie alternante: consonantes correlativas + vocales en orden',
          explanation_sections: [
            {
              title: "💡 ¿Qué evalúa este ejercicio?",
              content: "Capacidad de reconocer patrones alternantes entre dos secuencias independientes: una de vocales en orden y otra de consonantes correlativas."
            },
            {
              title: "📊 ANÁLISIS PASO A PASO:",
              content: "📋 Serie: a j c l e n g o i ?\n\n✅ Separar por posiciones:\n• Posiciones impares (1,3,5,7,9): a, c, e, g, i (vocales en orden)\n• Posiciones pares (2,4,6,8,10): j, l, n, o, ? (consonantes correlativas)\n\n📋 Patrón identificado:\n• Vocales: a, e, i, o, u (falta continuar)\n• Consonantes: j, l, n, o (siguiente sería q)"
            }
          ]
        }
      },
      {
        id: generateUUID(),
        question_text: 'Indique qué letra continúa cada serie (no cuentan las letras dobles pero sí la ñ). C-C-D-E-E-E-F-G-G-G-H-?',
        question_subtype: 'sequence_letter',
        option_a: 'J',
        option_b: 'M',
        option_c: 'I',
        option_d: 'K',
        correct_option: 2, // C = I
        content_data: {
          chart_type: 'sequence_letter',
          sequence: ['C', 'C', 'D', 'E', 'E', 'E', 'F', 'G', 'G', 'G', 'H', '?'],
          pattern_type: 'repetition',
          pattern_description: 'Letras correlativas con repetición: 2,3,4 veces',
          explanation_sections: [
            {
              title: "💡 ¿Qué evalúa este ejercicio?",
              content: "Capacidad de reconocer patrones de repetición variable en secuencias alfabéticas correlativas."
            },
            {
              title: "📊 ANÁLISIS PASO A PASO:",
              content: "📋 Serie: C-C-D-E-E-E-F-G-G-G-H-?\n\n✅ Patrón de repetición:\n• C se repite 2 veces\n• D aparece 1 vez  \n• E se repite 3 veces\n• F aparece 1 vez\n• G se repite 3 veces\n• H aparece 1 vez\n\n📋 Las letras van correlativas pero se repite 2, 3, 4 veces..."
            }
          ]
        }
      },
      {
        id: generateUUID(),
        question_text: 'Indique la opción que continúa la serie: C-G-K-Ñ-¿?',
        question_subtype: 'sequence_letter',
        option_a: 'S',
        option_b: 'P',
        option_c: 'R',
        option_d: 'T',
        correct_option: 2, // C = R
        content_data: {
          chart_type: 'sequence_letter',
          sequence: ['C', 'G', 'K', 'Ñ', '?'],
          pattern_type: 'arithmetic',
          pattern_description: 'Progresión con saltos de +4 posiciones en el alfabeto',
          explanation_sections: [
            {
              title: "💡 ¿Qué evalúa este ejercicio?",
              content: "Capacidad de reconocer progresiones aritméticas en el alfabeto con saltos constantes de posición."
            },
            {
              title: "📊 ANÁLISIS PASO A PASO:",
              content: "📋 Serie: C-G-K-Ñ-?\n\n✅ Posiciones en alfabeto (sin CH, LL):\n• C = posición 3\n• G = posición 7 (+4)\n• K = posición 11 (+4)\n• Ñ = posición 15 (+4)\n• ? = posición 19 (+4) = R\n\n📋 Patrón: Salto constante de +4 posiciones"
            }
          ]
        }
      },
      {
        id: generateUUID(),
        question_text: 'Indique la opción que continúa la serie: I-K-N-Q-¿?',
        question_subtype: 'sequence_letter',
        option_a: 'U',
        option_b: 'V',
        option_c: 'W',
        option_d: 'X',
        correct_option: 1, // B = V
        content_data: {
          chart_type: 'sequence_letter',
          sequence: ['I', 'K', 'N', 'Q', '?'],
          pattern_type: 'arithmetic_increasing',
          pattern_description: 'Saltos crecientes: +2, +3, +3, +4',
          explanation_sections: [
            {
              title: "💡 ¿Qué evalúa este ejercicio?",
              content: "Capacidad de reconocer progresiones con saltos variables crecientes en secuencias alfabéticas."
            },
            {
              title: "📊 ANÁLISIS PASO A PASO:",
              content: "📋 Serie: I-K-N-Q-?\n\n✅ Análisis de saltos:\n• I→K: +2 posiciones\n• K→N: +3 posiciones  \n• N→Q: +3 posiciones\n• Q→?: +4 posiciones\n\n📋 Posiciones:\n• I = 9, K = 11, N = 14, Q = 17\n• Siguiente: 17 + 4 = 21 = V"
            }
          ]
        }
      },
      {
        id: generateUUID(),
        question_text: 'Continúe con las dos letras que corresponderían a los interrogantes en la siguiente serie: p-r-t; t-w-z; z-d-h; h-¿?-¿?',
        question_subtype: 'sequence_letter',
        option_a: 'm-q',
        option_b: 'n-o',
        option_c: 'm-ñ',
        option_d: 'l-q',
        correct_option: 0, // A = m-q
        content_data: {
          chart_type: 'sequence_letter',
          sequence: ['p-r-t', 't-w-z', 'z-d-h', 'h-?-?'],
          pattern_type: 'grouped_progression',
          pattern_description: 'Grupos de 3 letras con saltos de +2, +2, +4 en cada grupo',
          explanation_sections: [
            {
              title: "💡 ¿Qué evalúa este ejercicio?",
              content: "Capacidad de reconocer patrones complejos en grupos de letras con progresiones internas específicas."
            },
            {
              title: "📊 ANÁLISIS PASO A PASO:",
              content: "📋 Serie: p-r-t; t-w-z; z-d-h; h-?-?\n\n✅ Análisis por grupos:\n• Grupo 1: p→r(+2) r→t(+2)\n• Grupo 2: t→w(+3) w→z(+3)\n• Grupo 3: z→d(+4) d→h(+4)\n• Grupo 4: h→?(+5) ?→?(+5)\n\n📋 Patrón: Saltos internos crecientes +2, +3, +4, +5\n• h + 5 = m\n• m + 5 = q\n• Respuesta: m-q"
            }
          ]
        }
      },
      {
        id: generateUUID(),
        question_text: '¿Qué letra continuaría la siguiente serie de letras? h h i j l k n l o m ¿?',
        question_subtype: 'sequence_letter',
        option_a: 'q',
        option_b: 'p',
        option_c: 'ñ',
        option_d: 'n',
        correct_option: 0, // A = q
        content_data: {
          chart_type: 'sequence_letter',
          sequence: ['h', 'h', 'i', 'j', 'l', 'k', 'n', 'l', 'o', 'm', '?'],
          pattern_type: 'alternating_intercalated',
          pattern_description: 'Serie intercalada: posiciones impares van seguidas, pares saltan una',
          explanation_sections: [
            {
              title: "💡 ¿Qué evalúa este ejercicio?",
              content: "Capacidad de reconocer series intercaladas complejas donde existen dos subseries con patrones diferentes aplicados en posiciones alternas."
            },
            {
              title: "📊 ANÁLISIS PASO A PASO:",
              content: "📋 Serie: h h i j l k n l o m ?\n\n✅ Las series de números y de letras están pensadas para descubrir la capacidad de razonamiento y análisis, por un lado, y factores mentales, por otro, ambos muy vinculados.\n\nEl razonamiento es una de las aptitudes mentales primarias, es decir, uno de los componentes de la inteligencia general y básico en la realización de psicotécnicos.\n\nLo más óptimo a la hora de afrontar series de letras es escribir el abecedario con sus 27 letras al comienzo del ejercicio. Hay que recordar que el abecedario ha pasado de 29 letras a 27 en la reforma de la RAE de 2010. Los dígrafos 'ch' y 'll' no existen como tales letras del abecedario.\n\n- subserie que ocupa las posiciones impares de la serie: h i j k l m... las letras van seguidas.\n\n- subserie que ocuparía posiciones pares de la serie: h j l n o ¿? donde las letras van saltando una; está sería la que nos interesa para contestar la pregunta. Como vemos salta una letra en cada paso, con lo que, a partir de la letra 'o' saltaríamos (p) tendría que seguir la letra 'q' que es nuestra respuesta."
            }
          ]
        }
      },
      {
        id: generateUUID(),
        question_text: 'Indique la letra que continúa la siguiente serie lógica: D Z V R Ñ ¿?',
        question_subtype: 'sequence_letter',
        option_a: 'K',
        option_b: 'M',
        option_c: 'J',
        option_d: 'L',
        correct_option: 0, // A = K
        content_data: {
          chart_type: 'sequence_letter',
          sequence: ['D', 'Z', 'V', 'R', 'Ñ', '?'],
          pattern_type: 'decreasing_variable',
          pattern_description: 'Serie correlativa retrocediendo con saltos variables',
          explanation_sections: [
            {
              title: "💡 ¿Qué evalúa este ejercicio?",
              content: "Capacidad de reconocer progresiones decrecientes en el alfabeto con saltos variables específicos."
            },
            {
              title: "📊 ANÁLISIS PASO A PASO:",
              content: "📋 Serie: D Z V R Ñ ?\n\n✅ En el ejercicio que nos plantean, la serie va retrocediendo en el orden del abecedario y saltándose tres letras de manera constante:\n\nD (CBA) Z (YXW) V (UTS) R (QPO) Ñ (NML) marcaríamos la letra 'K', que es la respuesta que nos piden.\n\n📋 Posiciones numéricas:\n• D=4, Z=27, V=23, R=19, Ñ=15\n• Saltos: -4 constante\n• Ñ - 4 = 11 = K"
            }
          ]
        }
      },
      {
        id: generateUUID(),
        question_text: 'Indique qué letra continúa cada serie (no cuentan las letras dobles pero sí la ñ). M-W-M-N-W-M-N-Ñ-W-M-N-Ñ-O-W-?',
        question_subtype: 'sequence_letter',
        option_a: 'W',
        option_b: 'M',
        option_c: 'O',
        option_d: 'N',
        correct_option: 1, // B = M
        content_data: {
          chart_type: 'sequence_letter',
          sequence: ['M', 'W', 'M', 'N', 'W', 'M', 'N', 'Ñ', 'W', 'M', 'N', 'Ñ', 'O', 'W', '?'],
          pattern_type: 'complex_intercalated',
          pattern_description: 'Series intercaladas: W se repite y serie correlativa añadiendo una letra cada vez',
          explanation_sections: [
            {
              title: "💡 ¿Qué evalúa este ejercicio?",
              content: "Capacidad de reconocer patrones intercalados complejos donde una serie se mantiene constante mientras otra progresa añadiendo elementos."
            },
            {
              title: "📊 ANÁLISIS PASO A PASO:",
              content: "📋 Serie: M-W-M-N-W-M-N-Ñ-W-M-N-Ñ-O-W-?\n\n✅ SERIES INTERCALADAS\n\nEl concepto de intercalado hace referencia al hecho de que la relación de las letras de la serie no es de uno en uno, sino que vamos saltando letras.\n\nNormalmente, podemos encontrar dos series diferenciadas, donde cada una sigue un patrón diferente.\n\nEn esta modalidad, para las explicaciones, cobra importancia la posición que ocupan las letras en la secuencia:\n\nHay letras que ocupan posiciones impares, es decir, la primera, tercera, quinta, séptima...\n\ny otras que ocupan las posiciones pares, o sea, segunda, cuarta, sexta, octava...\n\nTenemos dos series donde, por un lado la W se repite y, por otro lado, la serie avanza en el abecedario de forma correlativa añadiendo una letra cada vez:\n\nM\nMN\nMNÑ\nMNÑO"
            }
          ]
        }
      },
      {
        id: generateUUID(),
        question_text: 'Indique qué letra continúa cada serie (no cuentan las letras dobles pero sí la ñ). Z-X-U-Q-¿?',
        question_subtype: 'sequence_letter',
        option_a: 'Ñ',
        option_b: 'F',
        option_c: 'M',
        option_d: 'G',
        correct_option: 2, // C = M
        content_data: {
          chart_type: 'sequence_letter',
          sequence: ['Z', 'X', 'U', 'Q', '?'],
          pattern_type: 'decreasing_variable',
          pattern_description: 'Serie decreciente con saltos variables: -2, -3, -4',
          explanation_sections: [
            {
              title: "💡 ¿Qué evalúa este ejercicio?",
              content: "Capacidad de reconocer progresiones decrecientes en el alfabeto con saltos que aumentan progresivamente."
            },
            {
              title: "📊 ANÁLISIS PASO A PASO:",
              content: "📋 Serie: Z-X-U-Q-?\n\n✅ SERIES DE LETRAS CORRELATIVAS\n\nConsiste en señalar la letra que corresponde en el lugar de la interrogación, por lo que debemos observar toda la secuencia de letras para ver qué premisa sigue.\n\nEn este caso tenemos una serie de letras correlativas que avanzan hacia atrás.\n\n📋 Análisis de saltos:\n• Z→X: -2 posiciones (salta Y)\n• X→U: -3 posiciones (salta W,V)\n• U→Q: -4 posiciones (salta T,S,R)\n• Q→?: -5 posiciones (salta P,O,N,Ñ) = M"
            }
          ]
        }
      },
      {
        id: generateUUID(),
        question_text: 'Indique qué letra continúa la serie (no cuentan las letras dobles pero sí la ñ). C-E-G-I-K-M-Ñ-?',
        question_subtype: 'sequence_letter',
        option_a: 'P',
        option_b: 'R',
        option_c: 'S',
        option_d: 'O',
        correct_option: 0, // A = P
        content_data: {
          chart_type: 'sequence_letter',
          sequence: ['C', 'E', 'G', 'I', 'K', 'M', 'Ñ', '?'],
          pattern_type: 'arithmetic',
          pattern_description: 'Serie sencilla salta una letra en el abecedario',
          explanation_sections: [
            {
              title: "💡 ¿Qué evalúa este ejercicio?",
              content: "Capacidad de reconocer progresiones aritméticas simples en el alfabeto con saltos constantes."
            },
            {
              title: "📊 ANÁLISIS PASO A PASO:",
              content: "📋 Serie: C-E-G-I-K-M-Ñ-?\n\n✅ SERIES DE LETRAS CORRELATIVAS\n\nConsiste en señalar la letra que corresponde en el lugar de la interrogación, por lo que debemos observar toda la secuencia de letras para ver qué premisa sigue.\n\nSerie sencilla salta una letra en el abecedario.\n\nC salta d E salta f G salta h I salta j K salta l M salta n Ñ salta o.. tendría que venir la letra P.\n\n📋 Patrón: Salto constante de +2 posiciones"
            }
          ]
        }
      },
      {
        id: generateUUID(),
        question_text: 'Indique la opción que continúa la serie: L-M-G-F-Ñ-O-E-¿?',
        question_subtype: 'sequence_letter',
        option_a: 'F',
        option_b: 'D',
        option_c: 'E',
        option_d: 'G',
        correct_option: 1, // B = D
        content_data: {
          chart_type: 'sequence_letter',
          sequence: ['L', 'M', 'G', 'F', 'Ñ', 'O', 'E', '?'],
          pattern_type: 'alternating_bidirectional',
          pattern_description: 'Serie alternante: una progresa hacia adelante, otra hacia atrás',
          explanation_sections: [
            {
              title: "💡 ¿Qué evalúa este ejercicio?",
              content: "Capacidad de reconocer patrones alternantes bidireccionales donde dos subseries se mueven en direcciones opuestas del alfabeto."
            },
            {
              title: "📊 ANÁLISIS PASO A PASO:",
              content: "📋 Serie: L-M-G-F-Ñ-O-E-?\n\n✅ Separar por posiciones:\n• Posiciones impares (1,3,5,7): L, G, Ñ, E\n• Posiciones pares (2,4,6,8): M, F, O, ?\n\n📋 Análisis de subseries:\n• Serie 1: L→G(-5) G→Ñ(+8) Ñ→E(-10)\n• Serie 2: M→F(-7) F→O(+9) O→?(-11)\n• Patrón alternante en direcciones opuestas"
            }
          ]
        }
      },
      {
        id: generateUUID(),
        question_text: 'En la siguiente serie, marque la letra que la continuaría: h i j h i j i h i j h i j ¿?',
        question_subtype: 'sequence_letter',
        option_a: 'k',
        option_b: 'l',
        option_c: 'i',
        option_d: 'j',
        correct_option: 0, // A = k
        content_data: {
          chart_type: 'sequence_letter',
          sequence: ['h', 'i', 'j', 'h', 'i', 'j', 'i', 'h', 'i', 'j', 'h', 'i', 'j', '?'],
          pattern_type: 'intercalated_groups',
          pattern_description: 'Grupos de tres letras que se van repitiendo, alternando con otra serie',
          explanation_sections: [
            {
              title: "💡 ¿Qué evalúa este ejercicio?",
              content: "Capacidad de reconocer patrones complejos de grupos intercalados que se repiten con variaciones específicas."
            },
            {
              title: "📊 ANÁLISIS PASO A PASO:",
              content: "📋 Serie: h i j h i j i h i j h i j ?\n\n✅ SERIES INTERCALADAS.\n\nLas series de números y de letras están pensadas para descubrir la capacidad de razonamiento y análisis, por un lado, y factores mentales, por otro, ambos muy vinculados.\n\nEl razonamiento es una de las aptitudes mentales primarias, es decir, uno de los componentes de la inteligencia general y básico en la realización de psicotécnicos.\n\nLo más óptimo a la hora de afrontar series de letras es escribir el abecedario con sus 27 letras al comienzo del ejercicio. Hay que recordar que el abecedario ha pasado de 29 letras a 27 en la reforma de la RAE de 2010. Los dígrafos 'ch' y 'll' no existen como tales letras del abecedario.\n\nEl concepto de intercalado hace referencia al hecho de que la relación de las letras de la serie no es de uno en uno, sino que vamos saltando letras.\n\nNormalmente, podemos encontrar dos series diferenciadas, donde cada una sigue un patrón diferente.\n\nLa serie forma un grupo de tres letras que se va repitiendo, alternando con otra serie cuyas letras van seguidas.\n\nEl grupo que se repite sería: (h i j) y luego intercala la otra serie,comenzando por la 'h', vuelve a repetir el esquema 'h i j' y continúa la otra serie 'i' y así va repitiendo y avanzando.\n\nh i j h i j correspondería la letra 'k'."
            }
          ]
        }
      }
    ];

    // Buscar la categoría y sección correcta
    const { data: categoryData, error: categoryError } = await supabase
      .from('psychometric_categories')
      .select('id')
      .eq('category_key', 'series-letras')
      .single();

    if (categoryError) {
      console.log('❌ Error al buscar categoría series-letras:', categoryError.message);
      return;
    }

    const { data: sectionData, error: sectionError } = await supabase
      .from('psychometric_sections')
      .select('id')
      .eq('section_key', 'series-letras-correlativas')
      .eq('category_id', categoryData.id)
      .single();

    if (sectionError) {
      console.log('❌ Error al buscar sección series-letras-correlativas:', sectionError.message);
      return;
    }

    // Preparar todas las preguntas con los IDs correctos
    const questionsToInsert = questions.map((q, index) => ({
      ...q,
      category_id: categoryData.id,
      section_id: sectionData.id,
      is_active: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }));

    // Insertar todas las preguntas
    const { data: insertedQuestions, error: insertError } = await supabase
      .from('psychometric_questions')
      .insert(questionsToInsert)
      .select('id');

    if (insertError) {
      console.log('❌ Error al insertar preguntas:', insertError.message);
      return;
    }

    console.log('✅ LOTE DE SERIES DE LETRAS P02-P16 AÑADIDO EXITOSAMENTE');
    console.log(`📊 ${insertedQuestions.length} preguntas insertadas`);
    
    console.log('');
    console.log('🔗 ENLACES DE DEBUG:');
    insertedQuestions.forEach((q, index) => {
      const questionNumber = index + 2; // P02, P03, etc.
      console.log(`   P${questionNumber.toString().padStart(2, '0')}: http://localhost:3000/debug/question/${q.id}`);
    });
    
    console.log('');
    console.log('📋 Debug Batch: http://localhost:3000/debug/batch');

  } catch (error) {
    console.log('❌ Error general:', error.message);
  }
}

addLetterSeriesQuestions();