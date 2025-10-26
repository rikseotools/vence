import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function insertSeriesLetrasQuestions92to100() {
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
        // Pregunta 92: Error detection in series
        question_text: 'Detecte el error en la siguiente serie: y, t, q, m, j, f, b',
        content_data: {
          sequence: ["y", "t", "q", "m", "j", "f", "b"],
          chart_type: 'sequence_letter',
          pattern_type: 'error_detection',
          pattern_description: 'Serie con decrementos -5, -3, -4, -3, -4, -4 (error en último salto)',
          explanation_sections: [
            {
              title: "📊 EXPLICACIÓN:",
              content: "📋 Serie: y, t, q, m, j, f, b\n\n✅ Análisis de saltos:\n• y→t: -5 posiciones\n• t→q: -3 posiciones\n• q→m: -4 posiciones\n• m→j: -3 posiciones\n• j→f: -4 posiciones\n• f→b: -4 posiciones ❌\n\n📋 Patrón esperado: -5, -3, -4, -3, -4, -3\n🎯 El último salto debería ser -3, no -4\nf→c sería correcto (-3)\n\n📋 Error: La letra 'b' debería ser 'c'"
            }
          ]
        },
        option_a: 'La letra y debería ser z',
        option_b: 'La letra b debería ser c', 
        option_c: 'La letra j debería ser k',
        option_d: 'No hay error',
        correct_option: 1, // B = La letra b debería ser c
        question_subtype: 'sequence_letter'
      },
      {
        // Pregunta 93: Complex series with "none of the above" option
        question_text: '¿Qué letra continúa la serie? b, d, f, h, j, l, n, p, ?',
        content_data: {
          sequence: ["b", "d", "f", "h", "j", "l", "n", "p", "?"],
          chart_type: 'sequence_letter',
          pattern_type: 'series_salto_constante',
          pattern_description: 'Serie con avance constante de +2 posiciones',
          explanation_sections: [
            {
              title: "📊 EXPLICACIÓN:",
              content: "📋 Serie: b, d, f, h, j, l, n, p, ?\n\n✅ Patrón constante +2:\n• b→d: +2 posiciones\n• d→f: +2 posiciones\n• f→h: +2 posiciones\n• h→j: +2 posiciones\n• j→l: +2 posiciones\n• l→n: +2 posiciones\n• n→p: +2 posiciones\n• p→?: +2 posiciones\n\n📋 p + 2 = r\n\n📋 Respuesta: r"
            }
          ]
        },
        option_a: 'q',
        option_b: 'r',
        option_c: 's',
        option_d: 'Ninguna de las anteriores es correcta',
        correct_option: 1, // B = r
        question_subtype: 'sequence_letter'
      },
      {
        // Pregunta 94: Multiple letter continuation
        question_text: '¿Qué letras continúan la serie? h, i, j, n, ñ, o, s, t, u, ?, ?, ?',
        content_data: {
          sequence: ["h", "i", "j", "n", "ñ", "o", "s", "t", "u", "?", "?", "?"],
          chart_type: 'sequence_letter',
          pattern_type: 'series_bloques_avance',
          pattern_description: 'Bloques de 3 letras consecutivas con saltos de +4',
          explanation_sections: [
            {
              title: "📊 EXPLICACIÓN:",
              content: "📋 Serie: h, i, j, n, ñ, o, s, t, u, ?, ?, ?\n\n✅ Agrupando en bloques de 3:\n• Bloque 1: h, i, j (consecutivas)\n• Bloque 2: n, ñ, o (consecutivas)\n• Bloque 3: s, t, u (consecutivas)\n• Bloque 4: ?, ?, ? (consecutivas)\n\n📋 Saltos entre bloques:\n• h→n: +6 posiciones\n• n→s: +5 posiciones\n• s→?: +6 posiciones\n\n📋 s(19) + 6 = y(25)\nSiguientes: y, z, a\n\n📋 Respuesta: y, z, a"
            }
          ]
        },
        option_a: 'x, y, z',
        option_b: 'y, z, a',
        option_c: 'w, x, y',
        option_d: 'z, a, b',
        correct_option: 1, // B = y, z, a
        question_subtype: 'sequence_letter'
      },
      {
        // Pregunta 95: Block series pattern
        question_text: '¿Qué bloque de letras continúa la serie? N O Ñ - Q S R - U W V - Y A Z - ?',
        content_data: {
          sequence: ["N O Ñ", "Q S R", "U W V", "Y A Z", "?"],
          chart_type: 'sequence_letter',
          pattern_type: 'bloques_intercalados',
          pattern_description: 'Bloques con primera letra avanzando +3, segunda +4, tercera específica',
          explanation_sections: [
            {
              title: "📊 EXPLICACIÓN:",
              content: "📋 Serie: N O Ñ - Q S R - U W V - Y A Z - ?\n\n✅ Análisis por posiciones:\n• Posición 1: N→Q→U→Y (+3 cada vez)\n• Posición 2: O→S→W→A (+4 cada vez, con reinicio)\n• Posición 3: Ñ→R→V→Z (+3, +4, +4)\n\n📋 Siguiente bloque:\n• Posición 1: Y + 3 = B\n• Posición 2: A + 4 = E\n• Posición 3: Z + 4 = D\n\n📋 Respuesta: B E D"
            }
          ]
        },
        option_a: 'B E D',
        option_b: 'C F E',
        option_c: 'A D C',
        option_d: 'D G F',
        correct_option: 0, // A = B E D
        question_subtype: 'sequence_letter'
      },
      {
        // Pregunta 96: Simple decreasing series
        question_text: '¿Qué letra continúa la serie? v - p - k - e - y - ?',
        content_data: {
          sequence: ["v", "p", "k", "e", "y", "?"],
          chart_type: 'sequence_letter',
          pattern_type: 'series_decrementos_variables',
          pattern_description: 'Serie con decrementos variables: -6, -5, -6, +20, -5',
          explanation_sections: [
            {
              title: "📊 EXPLICACIÓN:",
              content: "📋 Serie: v - p - k - e - y - ?\n\n✅ Análisis de saltos:\n• v→p: -6 posiciones\n• p→k: -5 posiciones\n• k→e: -6 posiciones\n• e→y: +20 posiciones (vuelta al final)\n• y→?: -5 posiciones\n\n📋 Patrón: -6, -5, -6, (+20), -5\ny - 5 = t\n\n📋 Respuesta: t"
            }
          ]
        },
        option_a: 's',
        option_b: 't',
        option_c: 'u',
        option_d: 'r',
        correct_option: 1, // B = t
        question_subtype: 'sequence_letter'
      },
      {
        // Pregunta 97: Correlative series with increasing gaps
        question_text: '¿Qué letra continúa la serie? A, C, F, H, K, M, ?',
        content_data: {
          sequence: ["A", "C", "F", "H", "K", "M", "?"],
          chart_type: 'sequence_letter',
          pattern_type: 'series_saltos_incrementales',
          pattern_description: 'Serie con saltos incrementales: +2, +3, +2, +3, +2, +3',
          explanation_sections: [
            {
              title: "📊 EXPLICACIÓN:",
              content: "📋 Serie: A, C, F, H, K, M, ?\n\n✅ Análisis de saltos:\n• A→C: +2 posiciones\n• C→F: +3 posiciones\n• F→H: +2 posiciones\n• H→K: +3 posiciones\n• K→M: +2 posiciones\n• M→?: +3 posiciones\n\n📋 Patrón alternante: +2, +3, +2, +3, +2, +3\nM + 3 = P\n\n📋 Respuesta: P"
            }
          ]
        },
        option_a: 'N',
        option_b: 'O',
        option_c: 'P',
        option_d: 'Q',
        correct_option: 2, // C = P
        question_subtype: 'sequence_letter'
      },
      {
        // Pregunta 98: Complex correlative series
        question_text: '¿Qué letra continúa la serie? S, T, U, V, Z, A, B, F, G, ?',
        content_data: {
          sequence: ["S", "T", "U", "V", "Z", "A", "B", "F", "G", "?"],
          chart_type: 'sequence_letter',
          pattern_type: 'series_bloques_progresivos',
          pattern_description: 'Bloques progresivos de letras consecutivas con saltos específicos',
          explanation_sections: [
            {
              title: "📊 EXPLICACIÓN:",
              content: "📋 Serie: S, T, U, V, Z, A, B, F, G, ?\n\n✅ Agrupando en bloques:\n• Bloque 1: S, T, U, V (4 consecutivas)\n• Bloque 2: Z, A, B (3 consecutivas)\n• Bloque 3: F, G (2 consecutivas)\n• Bloque 4: ? (1 letra)\n\n📋 Patrón decreciente: 4→3→2→1\nSaltos: V→Z (+4), B→F (+4)\nG + 4 = K\n\n📋 Respuesta: K"
            }
          ]
        },
        option_a: 'H',
        option_b: 'I',
        option_c: 'J',
        option_d: 'K',
        correct_option: 3, // D = K
        question_subtype: 'sequence_letter'
      },
      {
        // Pregunta 99: Completion series
        question_text: 'Complete la letra que falta en la serie: c, x, e, v, h, s, l, o, [ ], k',
        content_data: {
          sequence: ["c", "x", "e", "v", "h", "s", "l", "o", "?", "k"],
          chart_type: 'sequence_letter',
          pattern_type: 'series_intercaladas_divergentes',
          pattern_description: 'Dos series intercaladas: una creciente (+2,+3,+4) y otra decreciente (-1,-3,-4)',
          explanation_sections: [
            {
              title: "📊 EXPLICACIÓN:",
              content: "📋 Serie: c, x, e, v, h, s, l, o, ?, k\n\n✅ Separando las dos series:\n• Serie 1 (impares): c, e, h, l, ?\n• Serie 2 (pares): x, v, s, o, k\n\n📋 Serie 1: c→e (+2), e→h (+3), h→l (+4), l→? (+5)\n📋 Serie 2: x→v (-2), v→s (-3), s→o (-4), o→k (-4)\n\n📋 l + 5 = q\n\n📋 Respuesta: q"
            }
          ]
        },
        option_a: 'p',
        option_b: 'q',
        option_c: 'r',
        option_d: 'm',
        correct_option: 1, // B = q
        question_subtype: 'sequence_letter'
      },
      {
        // Pregunta 100: Cyclic series with pattern
        question_text: '¿Qué letra continúa la serie? F, T, F, S, G, R, G, Q, H, P, H, O, ?',
        content_data: {
          sequence: ["F", "T", "F", "S", "G", "R", "G", "Q", "H", "P", "H", "O", "?"],
          chart_type: 'sequence_letter',
          pattern_type: 'series_ciclicas_dobles',
          pattern_description: 'Serie cíclica con repetición de primera letra y decremento en segunda',
          explanation_sections: [
            {
              title: "📊 EXPLICACIÓN:",
              content: "📋 Serie: F, T, F, S, G, R, G, Q, H, P, H, O, ?\n\n✅ Patrón de repetición:\n• F, T, F, S (F se repite, T→S -1)\n• G, R, G, Q (G se repite, R→Q -1)\n• H, P, H, O (H se repite, P→O -1)\n• I, ?, I, ? (I se repite, O→N -1)\n\n📋 Siguiente en el patrón:\nDespués de H, P, H, O viene I\n\n📋 Respuesta: I"
            }
          ]
        },
        option_a: 'I',
        option_b: 'J',
        option_c: 'N',
        option_d: 'M',
        correct_option: 0, // A = I
        question_subtype: 'sequence_letter'
      }
    ];

    console.log('📝 Insertando preguntas de series de letras 92-100...');

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
        console.log(`❌ Error al insertar pregunta ${index + 92}:`, error.message);
        return null;
      }

      console.log(`✅ Pregunta ${index + 92} insertada exitosamente`);
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
      console.log(`Pregunta ${index + 92}: http://localhost:3000/debug/question/${result.id}`);
    });

    console.log('\n📋 IDs PARA DEBUG BATCH:');
    const questionIds = successfulInserts.map(result => `'${result.id}'`).join(',\n      ');
    console.log(`questionIds: [\n      ${questionIds}\n    ]`);

  } catch (error) {
    console.log('❌ Error general:', error.message);
  }
}

insertSeriesLetrasQuestions92to100();