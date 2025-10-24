import { createClient } from '@supabase/supabase-js';

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );
}

async function addLetterSeriesP17ToP31() {
  try {
    const supabase = getSupabase();
    
    const questions = [
      {
        id: 'a8b9c1d2-e3f4-5678-9012-345678901234',
        question_number: 17,
        question_text: 'Indique qué letra continúa cada serie (no cuentan las letras dobles pero sí la ñ). C-D-D-E-F-G-G-H-I-J-K-K-L-M-N-?',
        option_a: 'Ñ',
        option_b: 'P',
        option_c: 'L',
        option_d: 'Ñ',
        correct_option: 0,
        explanation_sections: [
          {
            title: "📊 EXPLICACIÓN:",
            content: "📋 Serie: C-D-D-E-F-G-G-H-I-J-K-K-L-M-N-?\n\n✅ Patrón identificado:\n• Cada dos letras se repite la misma letra\n• C, D-D, E, F, G-G, H, I, J, K-K, L, M, N, ?\n• Siguiendo el patrón: después de N viene Ñ (se repite)\n\n📋 Respuesta: Ñ"
          }
        ]
      },
      {
        id: 'b1c2d3e4-f5g6-7890-1234-567890123456',
        question_number: 18,
        question_text: 'Continúe la lógica de la siguiente serie y marque la letra que tendría que continuarla: f h k ñ s ¿?',
        option_a: 'Y',
        option_b: 'X',
        option_c: 'W',
        option_d: 'Z',
        correct_option: 0,
        explanation_sections: [
          {
            title: "📊 EXPLICACIÓN:",
            content: "📋 Serie: f h k ñ s ?\n\n✅ Patrón de saltos:\n• f → h (salta 1: g)\n• h → k (salta 2: i, j)\n• k → ñ (salta 3: l, m, n)\n• ñ → s (salta 4: o, p, q, r)\n• s → ? (salta 5: t, u, v, w, x)\n\n📋 Respuesta: Y"
          }
        ]
      },
      {
        id: 'c2d3e4f5-g6h7-8901-2345-678901234567',
        question_number: 19,
        question_text: '¿Cuál sería la segunda letra que continúa la serie? E A X T Q .... ..?..',
        option_a: 'L',
        option_b: 'K',
        option_c: 'J',
        option_d: 'S',
        correct_option: 1,
        explanation_sections: [
          {
            title: "📊 EXPLICACIÓN:",
            content: "📋 Serie: E A X T Q ? ?\n\n✅ Patrón retrocedente:\n• E (posición 5) → A (posición 1): retrocede 4\n• A (posición 1) → X (posición 24): retrocede 3 (desde final)\n• X (posición 24) → T (posición 20): retrocede 4\n• T (posición 20) → Q (posición 17): retrocede 3\n• Q (posición 17) → ? retrocede 4 → M, luego retrocede 3 → K\n\n📋 La segunda letra es: K"
          }
        ]
      },
      {
        id: 'd3e4f5g6-h7i8-9012-3456-789012345678',
        question_number: 20,
        question_text: 'Indique qué letra continúa cada serie (no cuentan las letras dobles pero sí la ñ). B-C-D-D-E-F-G-G-H-I-J-J-?',
        option_a: 'J',
        option_b: 'M',
        option_c: 'K',
        option_d: 'L',
        correct_option: 2,
        explanation_sections: [
          {
            title: "📊 EXPLICACIÓN:",
            content: "📋 Serie: B-C-D-D-E-F-G-G-H-I-J-J-?\n\n✅ Patrón de repetición:\n• Cada dos letras se repite una: D-D, G-G, J-J\n• Secuencia: B, C, D-D, E, F, G-G, H, I, J-J, ?\n• Siguiente en alfabeto después de J es K\n\n📋 Respuesta: K"
          }
        ]
      },
      {
        id: 'e4f5g6h7-i8j9-0123-4567-890123456789',
        question_number: 21,
        question_text: 'Indique la letra que iría en lugar del interrogante en la serie que se le propone: c f h e j l g n ¿?',
        option_a: 'ñ',
        option_b: 'm',
        option_c: 'p',
        option_d: 'o',
        correct_option: 3,
        explanation_sections: [
          {
            title: "📊 EXPLICACIÓN:",
            content: "📋 Serie: c f h e j l g n ?\n\n✅ Tres subseries intercaladas:\n• Posiciones 1,4,7: c, e, g (saltan 1 cada vez)\n• Posiciones 2,5,8: f, j, n (saltan 3 cada vez)\n• Posiciones 3,6,9: h, l, ? (saltan 3 cada vez)\n\n📋 h → l (salta 3), l → ? (salta 3) = o\n\n📋 Respuesta: o"
          }
        ]
      },
      {
        id: 'f5g6h7i8-j9k0-1234-5678-901234567890',
        question_number: 22,
        question_text: 'd, g, i, l, n, p, r, ?',
        option_a: 'U',
        option_b: 'E',
        option_c: 'A',
        option_d: 'O',
        correct_option: 0,
        explanation_sections: [
          {
            title: "📊 EXPLICACIÓN:",
            content: "📋 Serie: d, g, i, l, n, p, r, ?\n\n✅ Patrón de saltos cíclicos:\n• d → g (salta 2)\n• g → i (salta 1)\n• i → l (salta 2)\n• l → n (salta 1)\n• n → p (salta 1)\n• p → r (salta 1)\n• r → ? (salta 2) = u\n\n📋 Respuesta: U"
          }
        ]
      },
      {
        id: 'g6h7i8j9-k0l1-2345-6789-012345678901',
        question_number: 23,
        question_text: '¿Qué letra debería continuar la siguiente serie lógica?: a b c e f g i j ¿?',
        option_a: 'k',
        option_b: 'n',
        option_c: 'm',
        option_d: 'l',
        correct_option: 0,
        explanation_sections: [
          {
            title: "📊 EXPLICACIÓN:",
            content: "📋 Serie: a b c e f g i j ?\n\n✅ Patrón por grupos:\n• Grupo 1: a, b, c (consecutivas)\n• Salta d\n• Grupo 2: e, f, g (consecutivas)\n• Salta h\n• Grupo 3: i, j, ? (consecutivas)\n\n📋 Siguiendo el patrón: k\n\n📋 Respuesta: k"
          }
        ]
      },
      {
        id: 'h7i8j9k0-l1m2-3456-7890-123456789012',
        question_number: 24,
        question_text: 'h, i, h, k, m, j, n, p, l, ?',
        option_a: 'S',
        option_b: 'R',
        option_c: 'T',
        option_d: 'Ninguna es correcta',
        correct_option: 3,
        explanation_sections: [
          {
            title: "📊 EXPLICACIÓN:",
            content: "📋 Serie: h, i, h, k, m, j, n, p, l, ?\n\n✅ Tres subseries cíclicas intercaladas:\n• Posiciones 1,4,7,10: h, k, n, ? (salta 2 cada vez: h→j→l→n→p→r→t)\n• Posiciones 2,5,8: i, m, p (salta 3 cada vez)\n• Posiciones 3,6,9: h, j, l (salta 1 cada vez)\n\n📋 La serie es compleja con múltiples patrones. Ninguna opción simple es correcta.\n\n📋 Respuesta: Ninguna es correcta"
          }
        ]
      },
      {
        id: 'i8j9k0l1-m2n3-4567-8901-234567890123',
        question_number: 25,
        question_text: 'Indique qué letra continúa cada serie (no cuentan las letras dobles pero sí la ñ). X-D-M-Z-G-Q-X-D-M-Z-G-Q-X-?',
        option_a: 'M',
        option_b: 'G',
        option_c: 'Z',
        option_d: 'D',
        correct_option: 3,
        explanation_sections: [
          {
            title: "📊 EXPLICACIÓN:",
            content: "📋 Serie: X-D-M-Z-G-Q-X-D-M-Z-G-Q-X-?\n\n✅ Patrón repetitivo:\n• Se repite el patrón: X-D-M-Z-G-Q\n• Primera repetición: X-D-M-Z-G-Q\n• Segunda repetición: X-D-M-Z-G-Q\n• Tercera repetición: X-? (continúa con D)\n\n📋 Respuesta: D"
          }
        ]
      },
      {
        id: 'j9k0l1m2-n3o4-5678-9012-345678901234',
        question_number: 26,
        question_text: '¿Qué letra continuaría la serie siguiente?: M Ñ Q U W Z D F ¿?',
        option_a: 'G',
        option_b: 'L',
        option_c: 'H',
        option_d: 'I',
        correct_option: 3,
        explanation_sections: [
          {
            title: "📊 EXPLICACIÓN:",
            content: "📋 Serie: M Ñ Q U W Z D F ?\n\n✅ Patrón de saltos cíclicos:\n• M → Ñ (salta 1)\n• Ñ → Q (salta 2)\n• Q → U (salta 3)\n• U → W (salta 1)\n• W → Z (salta 2)\n• Z → D (salta 3, vuelve al ciclo)\n• D → F (salta 1)\n• F → ? (salta 2) = H\n\n📋 Respuesta: I"
          }
        ]
      },
      {
        id: 'k0l1m2n3-o4p5-6789-0123-456789012345',
        question_number: 27,
        question_text: 'En el siguiente bloque, ¿cuántas S van seguidas de una G y precedidas de una D? MGOPTSGGOTDSGAEIOÑDIGSOABDSDGCODSGA',
        option_a: '1',
        option_b: '3',
        option_c: '2',
        option_d: '4',
        correct_option: 2,
        explanation_sections: [
          {
            title: "📊 EXPLICACIÓN:",
            content: "📋 Buscar patrón: D-S-G en la cadena\n\n✅ Análisis:\nMGOPTSGGOTDSGAEIOÑDIGSOABDSDGCODSGA\n\n• TDSGA (posición 10-12): D-S-G ✅\n• BDSDC (posición 24-26): D-S-D ❌\n• ODSGA (posición 30-32): D-S-G ✅\n\n📋 Total encontradas: 2\n\n📋 Respuesta: 2"
          }
        ]
      },
      {
        id: 'l1m2n3o4-p5q6-7890-1234-567890123456',
        question_number: 28,
        question_text: '¿Qué letra continuaría la siguiente serie?: F I L Ñ Q T ¿?',
        option_a: 'W',
        option_b: 'U',
        option_c: 'X',
        option_d: 'V',
        correct_option: 0,
        explanation_sections: [
          {
            title: "📊 EXPLICACIÓN:",
            content: "📋 Serie: F I L Ñ Q T ?\n\n✅ Patrón de saltos constantes:\n• F → I (salta 2: G, H)\n• I → L (salta 2: J, K)\n• L → Ñ (salta 2: M, N)\n• Ñ → Q (salta 2: O, P)\n• Q → T (salta 2: R, S)\n• T → ? (salta 2: U, V) = W\n\n📋 Respuesta: W"
          }
        ]
      },
      {
        id: 'm2n3o4p5-q6r7-8901-2345-678901234567',
        question_number: 29,
        question_text: 'd, e, f, f, g, h, h, i, j, j, k, l, ?',
        option_a: 'I',
        option_b: 'H',
        option_c: 'L',
        option_d: 'J',
        correct_option: 2,
        explanation_sections: [
          {
            title: "📊 EXPLICACIÓN:",
            content: "📋 Serie: d, e, f, f, g, h, h, i, j, j, k, l, ?\n\n✅ Patrón de repetición:\n• Cada tercera letra se repite: f-f, h-h, j-j\n• Secuencia: d, e, f-f, g, h-h, i, j-j, k, l-?\n• Siguiente letra que se repite: l\n\n📋 Respuesta: L"
          }
        ]
      },
      {
        id: 'n3o4p5q6-r7s8-9012-3456-789012345678',
        question_number: 30,
        question_text: 'Indique qué letra continúa la serie (no cuentan las letras dobles pero sí la ñ). B-D-C-E-F-H-G-I-J-L-K-M-N-O-Ñ-P-?',
        option_a: 'R',
        option_b: 'Q',
        option_c: 'T',
        option_d: 'P',
        correct_option: 1,
        explanation_sections: [
          {
            title: "📊 EXPLICACIÓN:",
            content: "📋 Serie: B-D-C-E-F-H-G-I-J-L-K-M-N-O-Ñ-P-?\n\n✅ Patrón intercalado:\n• Dos series alternas:\n• Serie 1 (posiciones impares): B, C, F, G, J, K, N, Ñ, ?\n• Serie 2 (posiciones pares): D, E, H, I, L, M, O, P\n\n📋 Siguiendo serie 1: después de Ñ viene Q\n\n📋 Respuesta: Q"
          }
        ]
      },
      {
        id: 'o4p5q6r7-s8t9-0123-4567-890123456789',
        question_number: 31,
        question_text: 'Indique el bloque de letras que continuaría la siguiente serie: p-r-t; v-x-z; b-d-f; ¿?-¿?-¿?',
        option_a: 'h-j-m',
        option_b: 'h-j-l',
        option_c: 'h-i-m',
        option_d: 'g-i-k',
        correct_option: 1,
        explanation_sections: [
          {
            title: "📊 EXPLICACIÓN:",
            content: "📋 Serie de bloques: p-r-t; v-x-z; b-d-f; ?-?-?\n\n✅ Patrón por bloques:\n• Cada bloque avanza saltando 1 letra\n• Bloque 1: p-r-t (salta q, salta s)\n• Bloque 2: v-x-z (salta w, salta y)\n• Bloque 3: b-d-f (salta c, salta e)\n• Bloque 4: h-j-l (salta i, salta k)\n\n📋 Respuesta: h-j-l"
          }
        ]
      }
    ];

    console.log(`🔍 Agregando ${questions.length} preguntas de series de letras P17-P31...`);

    for (const question of questions) {
      const { data, error } = await supabase
        .from('psychometric_questions')
        .insert({
          id: question.id,
          question_text: question.question_text,
          option_a: question.option_a,
          option_b: question.option_b,
          option_c: question.option_c,
          option_d: question.option_d,
          correct_option: question.correct_option,
          question_subtype: 'sequence_letter',
          content_data: {
            chart_type: 'sequence_letter',
            sequence: question.sequence || [],
            pattern_type: 'letter_series',
            pattern_description: `Serie de letras P${question.question_number}`,
            explanation_sections: question.explanation_sections
          },
          is_active: true
        });

      if (error) {
        console.log(`❌ Error agregando pregunta P${question.question_number}:`, error.message);
      } else {
        console.log(`✅ Pregunta P${question.question_number} agregada correctamente`);
      }
    }

    console.log('');
    console.log('✅ Todas las preguntas P17-P31 han sido agregadas');
    console.log('🔗 Verificar en: http://localhost:3000/debug/batch');

  } catch (error) {
    console.log('❌ Error general:', error.message);
  }
}

addLetterSeriesP17ToP31();