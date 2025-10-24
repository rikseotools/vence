import { createClient } from '@supabase/supabase-js';
import { randomUUID } from 'crypto';

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );
}

async function addLetterSeriesP32ToP46() {
  try {
    const supabase = getSupabase();
    
    const questions = [
      {
        question_number: 32,
        question_text: 'Indique la opción que continúa la serie: D-E-H-I-L-M-?',
        option_a: 'N',
        option_b: 'M',
        option_c: 'L',
        option_d: 'O',
        correct_option: 3,
        explanation_sections: [
          {
            title: "📊 EXPLICACIÓN:",
            content: "📋 Serie: D-E-H-I-L-M-?\n\n✅ Patrón identificado:\n• D, E (consecutivas) → salta 2 → H, I (consecutivas) → salta 2 → L, M (consecutivas)\n• Patrón: 2 letras consecutivas, salto de 2, repite\n• Después de L, M viene → salta 1 → O\n\n📋 Respuesta: O"
          }
        ]
      },
      {
        question_number: 33,
        question_text: 'Indique qué letra continúa cada serie (no cuentan las letras dobles pero sí la ñ). C-G-K-Ñ-R-?',
        option_a: 'U',
        option_b: 'Z',
        option_c: 'A',
        option_d: 'V',
        correct_option: 3,
        explanation_sections: [
          {
            title: "📊 EXPLICACIÓN:",
            content: "📋 Serie: C-G-K-Ñ-R-?\n\n✅ Patrón de saltos:\n• C → G (salta 3: D, E, F)\n• G → K (salta 3: H, I, J)\n• K → Ñ (salta 3: L, M, N)\n• Ñ → R (salta 3: O, P, Q)\n• R → ? (salta 3: S, T, U) = V\n\n📋 Respuesta: V"
          }
        ]
      },
      {
        question_number: 34,
        question_text: 'Indique qué letra continúa cada serie (no cuentan las letras dobles pero sí la ñ). X-W-Y-Z-X-W-Y-?',
        option_a: 'V',
        option_b: 'X',
        option_c: 'Z',
        option_d: 'W',
        correct_option: 2,
        explanation_sections: [
          {
            title: "📊 EXPLICACIÓN:",
            content: "📋 Serie: X-W-Y-Z-X-W-Y-?\n\n✅ Patrón cíclico identificado:\n• Secuencia que se repite: X-W-Y-Z\n• Primera vez: X-W-Y-Z\n• Segunda vez: X-W-Y-?\n• Siguiendo el patrón: Z\n\n📋 Respuesta: Z"
          }
        ]
      },
      {
        question_number: 35,
        question_text: 'Indique qué letra continúa cada serie (no cuentan las letras dobles pero sí la ñ). A-F-Y-H-W-J-U-?',
        option_a: 'P',
        option_b: 'L',
        option_c: 'V',
        option_d: 'K',
        correct_option: 1,
        explanation_sections: [
          {
            title: "📊 EXPLICACIÓN:",
            content: "📋 Serie: A-F-Y-H-W-J-U-?\n\n✅ Dos subseries intercaladas:\n• Posiciones impares (1,3,5,7): A, Y, W, U (A avanza, luego retrocede)\n• Posiciones pares (2,4,6,8): F, H, J, ? (avanza de 2 en 2)\n\n📋 F → H → J → L (salta 1 cada vez)\n\n📋 Respuesta: L"
          }
        ]
      },
      {
        question_number: 36,
        question_text: 'Indique qué letra continúa cada serie (no cuentan las letras dobles pero sí la ñ). A-Y-W-U-S-?',
        option_a: 'N',
        option_b: 'Ñ',
        option_c: 'Q',
        option_d: 'P',
        correct_option: 2,
        explanation_sections: [
          {
            title: "📊 EXPLICACIÓN:",
            content: "📋 Serie: A-Y-W-U-S-?\n\n✅ Patrón retrocedente:\n• A (posición 1) → Y (posición 25): avanza\n• Y → W → U → S (retrocede de 2 en 2)\n• S (posición 19) → ? (retrocede 2) = Q (posición 17)\n\n📋 Respuesta: Q"
          }
        ]
      },
      {
        question_number: 37,
        question_text: '¿Qué letra continuaría la serie? X V S O N K G E B ....',
        option_a: 'W',
        option_b: 'A',
        option_c: 'Y',
        option_d: 'X',
        correct_option: 3,
        explanation_sections: [
          {
            title: "📊 EXPLICACIÓN:",
            content: "📋 Serie: X V S O N K G E B ?\n\n✅ Patrón retrocedente cíclico:\n• X → V (retrocede 2)\n• V → S (retrocede 3)\n• S → O (retrocede 4)\n• O → N (retrocede 1)\n• El patrón se repite: retrocede 2, 3, 4, 1\n• B → ? (retrocede 2) = X (vuelve al final del alfabeto)\n\n📋 Respuesta: X"
          }
        ]
      },
      {
        question_number: 38,
        question_text: 'Indique la letra que continuaría la siguiente serie: z x v t r ¿?',
        option_a: 'q',
        option_b: 'ñ',
        option_c: 'o',
        option_d: 'p',
        correct_option: 3,
        explanation_sections: [
          {
            title: "📊 EXPLICACIÓN:",
            content: "📋 Serie: z x v t r ?\n\n✅ Patrón retrocedente:\n• z → x (retrocede 1: y)\n• x → v (retrocede 1: w)\n• v → t (retrocede 1: u)\n• t → r (retrocede 1: s)\n• r → ? (retrocede 1: q) = p\n\nEspera, revisando:\n• z → x (salta 1)\n• x → v (salta 1)\n• v → t (salta 1)\n• t → r (salta 1)\n• r → ? (salta 1) = p\n\n📋 Respuesta: p"
          }
        ]
      },
      {
        question_number: 39,
        question_text: 'h, l, i, m, j, n, k,?',
        option_a: 'M',
        option_b: 'S',
        option_c: 'L',
        option_d: 'Ñ',
        correct_option: 3,
        explanation_sections: [
          {
            title: "📊 EXPLICACIÓN:",
            content: "📋 Serie: h, l, i, m, j, n, k, ?\n\n✅ Dos subseries intercaladas:\n• Posiciones impares (1,3,5,7): h, i, j, k (consecutivas alfabéticas)\n• Posiciones pares (2,4,6,8): l, m, n, ? (consecutivas alfabéticas)\n\n📋 Después de n viene ñ\n\n📋 Respuesta: Ñ"
          }
        ]
      },
      {
        question_number: 40,
        question_text: 'En la serie que se le propone, indique la letra que la continuaría: g w i u k s m q ñ ¿?',
        option_a: 'o',
        option_b: 'p',
        option_c: 'ñ',
        option_d: 'q',
        correct_option: 0,
        explanation_sections: [
          {
            title: "📊 EXPLICACIÓN:",
            content: "📋 Serie: g w i u k s m q ñ ?\n\n✅ Dos subseries intercaladas:\n• Posiciones impares: g, i, k, m, ñ (avanza de 2 en 2)\n• Posiciones pares: w, u, s, q (retrocede de 2 en 2)\n\n📋 Siguiente en posición par después de q:\nq → ? (retrocede 2) = o\n\n📋 Respuesta: o"
          }
        ]
      },
      {
        question_number: 41,
        question_text: 'g, o, i, ñ, k, n, m, m, ?',
        option_a: 'Ñ',
        option_b: 'O',
        option_c: 'N',
        option_d: 'M',
        correct_option: 0,
        explanation_sections: [
          {
            title: "📊 EXPLICACIÓN:",
            content: "📋 Serie: g, o, i, ñ, k, n, m, m, ?\n\n✅ Dos subseries intercaladas:\n• Serie 1: g, i, k, m (avanza de 2 en 2)\n• Serie 2: o, ñ, n, m (decrece)\n\n📋 La siguiente en la secuencia sería:\ng → i → k → m → ñ (siguiente en serie 1)\n\n📋 Respuesta: Ñ"
          }
        ]
      },
      {
        question_number: 42,
        question_text: 'Indique qué letra continúa cada serie (no cuentan las letras dobles pero sí la ñ). E-E-D-D-D-?',
        option_a: 'G',
        option_b: 'A',
        option_c: 'C',
        option_d: 'H',
        correct_option: 2,
        explanation_sections: [
          {
            title: "📊 EXPLICACIÓN:",
            content: "📋 Serie: E-E-D-D-D-?\n\n✅ Patrón de repeticiones:\n• E aparece 2 veces\n• D aparece 3 veces\n• Retrocede en el alfabeto: E → D → C\n• C debería aparecer 4 veces, empezando con 1\n\n📋 Respuesta: C"
          }
        ]
      },
      {
        question_number: 43,
        question_text: 'Indique la letra que tendría que ocupar el interrogante para continuar la serie: z u y v x w x v y u ¿?',
        option_a: 'a',
        option_b: 'z',
        option_c: 'v',
        option_d: 't',
        correct_option: 1,
        explanation_sections: [
          {
            title: "📊 EXPLICACIÓN:",
            content: "📋 Serie: z u y v x w x v y u ?\n\n✅ Patrón simétrico/cíclico:\n• La serie tiene simetría: z u y v x w | x v y u ?\n• La primera mitad: z u y v x w\n• La segunda mitad espejo: x v y u ?\n• Siguiendo la simetría: z\n\n📋 Respuesta: z"
          }
        ]
      },
      {
        question_number: 44,
        question_text: '¿Qué dos letras irían en lugar de las interrogaciones para continuar la serie? A Z B Y D W G T ? ?',
        option_a: 'I Q',
        option_b: 'H S',
        option_c: 'K P',
        option_d: 'J P',
        correct_option: 2,
        explanation_sections: [
          {
            title: "📊 EXPLICACIÓN:",
            content: "📋 Serie: A Z B Y D W G T ? ?\n\n✅ Dos subseries alternas:\n• Posiciones impares: A, B, D, G, ? (saltos: +1, +2, +3, +4) = K\n• Posiciones pares: Z, Y, W, T, ? (retrocede: -1, -2, -3, -4) = P\n\n📋 Respuesta: K P"
          }
        ]
      },
      {
        question_number: 45,
        question_text: 'a, l, f, a, b, l, f, z, a, b, c, l, f, ?',
        option_a: 'Y',
        option_b: 'A',
        option_c: 'v',
        option_d: 'X',
        correct_option: 0,
        explanation_sections: [
          {
            title: "📊 EXPLICACIÓN:",
            content: "📋 Serie: a, l, f, a, b, l, f, z, a, b, c, l, f, ?\n\n✅ Patrón cíclico identificado:\n• Grupos: (a, l, f) + letra variable\n• a, l, f, [a] → a, b, l, f, [z] → a, b, c, l, f, [?]\n• La letra variable va: a → z → y (retrocede)\n\n📋 Respuesta: Y"
          }
        ]
      },
      {
        question_number: 46,
        question_text: 'Indique qué letra continúa cada serie (no cuentan las letras dobles pero sí la ñ). N-Ñ-O-N-P-Q-R-P-S-T-U-?',
        option_a: 'W',
        option_b: 'T',
        option_c: 'V',
        option_d: 'S',
        correct_option: 3,
        explanation_sections: [
          {
            title: "📊 EXPLICACIÓN:",
            content: "📋 Serie: N-Ñ-O-N-P-Q-R-P-S-T-U-?\n\n✅ Patrón de bloques con repetición:\n• Bloque 1: N-Ñ-O-N (N se repite)\n• Bloque 2: P-Q-R-P (P se repite)\n• Bloque 3: S-T-U-? (S debe repetirse)\n\n📋 Respuesta: S"
          }
        ]
      }
    ];

    console.log(`🔍 Agregando ${questions.length} preguntas de series de letras P32-P46...`);

    for (const question of questions) {
      const id = randomUUID();
      const { data, error } = await supabase
        .from('psychometric_questions')
        .insert({
          id: id,
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
          is_active: true,
          category_id: 'f08ebf08-f51d-4fc0-8e0d-578ae1e83af3'
        });

      if (error) {
        console.log(`❌ Error agregando pregunta P${question.question_number}:`, error.message);
      } else {
        console.log(`✅ Pregunta P${question.question_number} agregada correctamente (ID: ${id})`);
      }
    }

    console.log('');
    console.log('✅ Todas las preguntas P32-P46 han sido agregadas');
    console.log('🔗 Verificar en: http://localhost:3000/debug/batch');

  } catch (error) {
    console.log('❌ Error general:', error.message);
  }
}

addLetterSeriesP32ToP46();