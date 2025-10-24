import { createClient } from '@supabase/supabase-js';
import { randomUUID } from 'crypto';

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );
}

async function addLetterSeriesP47ToP64() {
  try {
    const supabase = getSupabase();
    
    const questions = [
      {
        question_number: 47,
        question_text: 'Continúe la siguiente serie: A-D-G-J-M-P-?',
        option_a: 'R',
        option_b: 'S',
        option_c: 'T',
        option_d: 'Q',
        correct_option: 1,
        explanation_sections: [
          {
            title: "📊 EXPLICACIÓN:",
            content: "📋 Serie: A-D-G-J-M-P-?\n\n✅ Patrón de saltos constantes:\n• A → D (salta 2: B, C)\n• D → G (salta 2: E, F)\n• G → J (salta 2: H, I)\n• J → M (salta 2: K, L)\n• M → P (salta 2: N, Ñ)\n• P → ? (salta 2: Q, R) = S\n\n📋 Respuesta: S"
          }
        ]
      },
      {
        question_number: 48,
        question_text: 'Señale la letra que debe continuar esta serie: A-B-C-D-F-G-H-I-K-L-M-N-?',
        option_a: 'O',
        option_b: 'Ñ',
        option_c: 'P',
        option_d: 'Q',
        correct_option: 2,
        explanation_sections: [
          {
            title: "📊 EXPLICACIÓN:",
            content: "📋 Serie: A-B-C-D-F-G-H-I-K-L-M-N-?\n\n✅ Patrón con saltos de vocal E:\n• A-B-C-D (consecutivas) → salta E → F-G-H-I (consecutivas) → salta J → K-L-M-N (consecutivas)\n• Después de cada grupo de 4 letras, salta 1 letra\n• Siguiente: salta Ñ → P\n\n📋 Respuesta: P"
          }
        ]
      },
      {
        question_number: 49,
        question_text: 'Complete la serie que se propone: C-F-I-L-Ñ-R-?',
        option_a: 'U',
        option_b: 'T',
        option_c: 'S',
        option_d: 'V',
        correct_option: 0,
        explanation_sections: [
          {
            title: "📊 EXPLICACIÓN:",
            content: "📋 Serie: C-F-I-L-Ñ-R-?\n\n✅ Patrón de saltos constantes:\n• C → F (salta 2: D, E)\n• F → I (salta 2: G, H)\n• I → L (salta 2: J, K)\n• L → Ñ (salta 2: M, N)\n• Ñ → R (salta 2: O, P, Q)\n• R → ? (salta 2: S, T) = U\n\n📋 Respuesta: U"
          }
        ]
      },
      {
        question_number: 50,
        question_text: 'Indique qué letra debe continuar la serie: C-E-H-J-M-Ñ-Q-S-V-X-?',
        option_a: 'Z',
        option_b: 'A',
        option_c: 'Y',
        option_d: 'W',
        correct_option: 1,
        explanation_sections: [
          {
            title: "📊 EXPLICACIÓN:",
            content: "📋 Serie: C-E-H-J-M-Ñ-Q-S-V-X-?\n\n✅ Dos subseries intercaladas:\n• Posiciones impares: C, H, M, Q, V, ? (salta 4 cada vez)\n• Posiciones pares: E, J, Ñ, S, X (salta 4 cada vez)\n\n📋 V → ? (salta 4: W, X, Y, Z) = A (vuelve al alfabeto)\n\n📋 Respuesta: A"
          }
        ]
      },
      {
        question_number: 51,
        question_text: 'Complete la serie: D-F-I-K-N-P-S-U-X-Z-?',
        option_a: 'C',
        option_b: 'B',
        option_c: 'A',
        option_d: 'D',
        correct_option: 0,
        explanation_sections: [
          {
            title: "📊 EXPLICACIÓN:",
            content: "📋 Serie: D-F-I-K-N-P-S-U-X-Z-?\n\n✅ Dos subseries intercaladas:\n• Posiciones impares: D, I, N, S, X, ? (salta 4 cada vez)\n• Posiciones pares: F, K, P, U, Z (salta 4 cada vez)\n\n📋 X → ? (salta 4: Y, Z, A, B) = C\n\n📋 Respuesta: C"
          }
        ]
      },
      {
        question_number: 52,
        question_text: 'Complete la serie: Z-X-V-T-R-P-N-L-J-H-?',
        option_a: 'F',
        option_b: 'E',
        option_c: 'G',
        option_d: 'D',
        correct_option: 0,
        explanation_sections: [
          {
            title: "📊 EXPLICACIÓN:",
            content: "📋 Serie: Z-X-V-T-R-P-N-L-J-H-?\n\n✅ Patrón retrocedente constante:\n• Z → X (retrocede 1: Y)\n• X → V (retrocede 1: W)\n• V → T (retrocede 1: U)\n• T → R (retrocede 1: S)\n• Patrón: retrocede 1 letra cada vez\n• H → ? (retrocede 1: I, G) = F\n\n📋 Respuesta: F"
          }
        ]
      },
      {
        question_number: 53,
        question_text: 'Indique la letra que debe continuar la serie: B-E-H-K-N-Q-T-W-Z-?',
        option_a: 'C',
        option_b: 'D',
        option_c: 'A',
        option_d: 'B',
        correct_option: 0,
        explanation_sections: [
          {
            title: "📊 EXPLICACIÓN:",
            content: "📋 Serie: B-E-H-K-N-Q-T-W-Z-?\n\n✅ Patrón de saltos constantes:\n• B → E (salta 2: C, D)\n• E → H (salta 2: F, G)\n• H → K (salta 2: I, J)\n• K → N (salta 2: L, M)\n• Patrón: salta 2 letras cada vez\n• Z → ? (salta 2: A, B) = C\n\n📋 Respuesta: C"
          }
        ]
      },
      {
        question_number: 54,
        question_text: 'Complete la serie: A-C-F-H-K-M-P-R-U-W-?',
        option_a: 'Z',
        option_b: 'Y',
        option_c: 'X',
        option_d: 'A',
        correct_option: 0,
        explanation_sections: [
          {
            title: "📊 EXPLICACIÓN:",
            content: "📋 Serie: A-C-F-H-K-M-P-R-U-W-?\n\n✅ Dos subseries intercaladas:\n• Posiciones impares: A, F, K, P, U, ? (salta 4 cada vez)\n• Posiciones pares: C, H, M, R, W (salta 4 cada vez)\n\n📋 U → ? (salta 4: V, W, X, Y) = Z\n\n📋 Respuesta: Z"
          }
        ]
      },
      {
        question_number: 55,
        question_text: 'Indique la letra que continúa la serie: F-I-L-O-R-U-X-?',
        option_a: 'A',
        option_b: 'Z',
        option_c: 'Y',
        option_d: 'B',
        correct_option: 0,
        explanation_sections: [
          {
            title: "📊 EXPLICACIÓN:",
            content: "📋 Serie: F-I-L-O-R-U-X-?\n\n✅ Patrón de saltos constantes:\n• F → I (salta 2: G, H)\n• I → L (salta 2: J, K)\n• L → O (salta 2: M, N)\n• O → R (salta 2: P, Q)\n• R → U (salta 2: S, T)\n• U → X (salta 2: V, W)\n• X → ? (salta 2: Y, Z) = A\n\n📋 Respuesta: A"
          }
        ]
      },
      {
        question_number: 56,
        question_text: 'Complete esta serie: G-J-M-P-S-V-Y-?',
        option_a: 'B',
        option_b: 'A',
        option_c: 'Z',
        option_d: 'C',
        correct_option: 0,
        explanation_sections: [
          {
            title: "📊 EXPLICACIÓN:",
            content: "📋 Serie: G-J-M-P-S-V-Y-?\n\n✅ Patrón de saltos constantes:\n• G → J (salta 2: H, I)\n• J → M (salta 2: K, L)\n• M → P (salta 2: N, Ñ)\n• P → S (salta 2: Q, R)\n• S → V (salta 2: T, U)\n• V → Y (salta 2: W, X)\n• Y → ? (salta 2: Z, A) = B\n\n📋 Respuesta: B"
          }
        ]
      },
      {
        question_number: 57,
        question_text: 'Señale qué letra continúa la serie: H-K-N-Q-T-W-Z-?',
        option_a: 'C',
        option_b: 'B',
        option_c: 'D',
        option_d: 'A',
        correct_option: 0,
        explanation_sections: [
          {
            title: "📊 EXPLICACIÓN:",
            content: "📋 Serie: H-K-N-Q-T-W-Z-?\n\n✅ Patrón de saltos constantes:\n• H → K (salta 2: I, J)\n• K → N (salta 2: L, M)\n• N → Q (salta 2: Ñ, O, P)\n• Q → T (salta 2: R, S)\n• T → W (salta 2: U, V)\n• W → Z (salta 2: X, Y)\n• Z → ? (salta 2: A, B) = C\n\n📋 Respuesta: C"
          }
        ]
      },
      {
        question_number: 58,
        question_text: 'Complete la serie de letras: I-L-O-R-U-X-?',
        option_a: 'A',
        option_b: 'Z',
        option_c: 'Y',
        option_d: 'B',
        correct_option: 0,
        explanation_sections: [
          {
            title: "📊 EXPLICACIÓN:",
            content: "📋 Serie: I-L-O-R-U-X-?\n\n✅ Patrón de saltos constantes:\n• I → L (salta 2: J, K)\n• L → O (salta 2: M, N)\n• O → R (salta 2: P, Q)\n• R → U (salta 2: S, T)\n• U → X (salta 2: V, W)\n• X → ? (salta 2: Y, Z) = A\n\n📋 Respuesta: A"
          }
        ]
      },
      {
        question_number: 59,
        question_text: 'Indique la letra que continúa: J-M-P-S-V-Y-?',
        option_a: 'B',
        option_b: 'A',
        option_c: 'Z',
        option_d: 'C',
        correct_option: 0,
        explanation_sections: [
          {
            title: "📊 EXPLICACIÓN:",
            content: "📋 Serie: J-M-P-S-V-Y-?\n\n✅ Patrón de saltos constantes:\n• J → M (salta 2: K, L)\n• M → P (salta 2: N, Ñ)\n• P → S (salta 2: Q, R)\n• S → V (salta 2: T, U)\n• V → Y (salta 2: W, X)\n• Y → ? (salta 2: Z, A) = B\n\n📋 Respuesta: B"
          }
        ]
      },
      {
        question_number: 60,
        question_text: 'Complete esta serie: K-N-Q-T-W-Z-?',
        option_a: 'C',
        option_b: 'B',
        option_c: 'D',
        option_d: 'A',
        correct_option: 0,
        explanation_sections: [
          {
            title: "📊 EXPLICACIÓN:",
            content: "📋 Serie: K-N-Q-T-W-Z-?\n\n✅ Patrón de saltos constantes:\n• K → N (salta 2: L, M)\n• N → Q (salta 2: Ñ, O, P)\n• Q → T (salta 2: R, S)\n• T → W (salta 2: U, V)\n• W → Z (salta 2: X, Y)\n• Z → ? (salta 2: A, B) = C\n\n📋 Respuesta: C"
          }
        ]
      },
      {
        question_number: 61,
        question_text: 'Señale la letra que continúa: L-O-R-U-X-?',
        option_a: 'A',
        option_b: 'Z',
        option_c: 'Y',
        option_d: 'B',
        correct_option: 0,
        explanation_sections: [
          {
            title: "📊 EXPLICACIÓN:",
            content: "📋 Serie: L-O-R-U-X-?\n\n✅ Patrón de saltos constantes:\n• L → O (salta 2: M, N)\n• O → R (salta 2: P, Q)\n• R → U (salta 2: S, T)\n• U → X (salta 2: V, W)\n• X → ? (salta 2: Y, Z) = A\n\n📋 Respuesta: A"
          }
        ]
      },
      {
        question_number: 62,
        question_text: 'Complete la serie: M-P-S-V-Y-?',
        option_a: 'B',
        option_b: 'A',
        option_c: 'Z',
        option_d: 'C',
        correct_option: 0,
        explanation_sections: [
          {
            title: "📊 EXPLICACIÓN:",
            content: "📋 Serie: M-P-S-V-Y-?\n\n✅ Patrón de saltos constantes:\n• M → P (salta 2: N, Ñ)\n• P → S (salta 2: Q, R)\n• S → V (salta 2: T, U)\n• V → Y (salta 2: W, X)\n• Y → ? (salta 2: Z, A) = B\n\n📋 Respuesta: B"
          }
        ]
      },
      {
        question_number: 63,
        question_text: 'Indique la letra que continúa la serie: N-Q-T-W-Z-?',
        option_a: 'C',
        option_b: 'B',
        option_c: 'D',
        option_d: 'A',
        correct_option: 0,
        explanation_sections: [
          {
            title: "📊 EXPLICACIÓN:",
            content: "📋 Serie: N-Q-T-W-Z-?\n\n✅ Patrón de saltos constantes:\n• N → Q (salta 2: Ñ, O, P)\n• Q → T (salta 2: R, S)\n• T → W (salta 2: U, V)\n• W → Z (salta 2: X, Y)\n• Z → ? (salta 2: A, B) = C\n\n📋 Respuesta: C"
          }
        ]
      },
      {
        question_number: 64,
        question_text: 'Complete esta serie final: O-R-U-X-?',
        option_a: 'A',
        option_b: 'Z',
        option_c: 'Y',
        option_d: 'B',
        correct_option: 0,
        explanation_sections: [
          {
            title: "📊 EXPLICACIÓN:",
            content: "📋 Serie: O-R-U-X-?\n\n✅ Patrón de saltos constantes:\n• O → R (salta 2: P, Q)\n• R → U (salta 2: S, T)\n• U → X (salta 2: V, W)\n• X → ? (salta 2: Y, Z) = A\n\n📋 Respuesta: A"
          }
        ]
      }
    ];

    console.log(`🔍 Agregando ${questions.length} preguntas de series de letras P47-P64...`);

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
    console.log('✅ Todas las preguntas P47-P64 han sido agregadas');
    console.log('🔗 Verificar en: http://localhost:3000/debug/batch');

  } catch (error) {
    console.log('❌ Error general:', error.message);
  }
}

addLetterSeriesP47ToP64();