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
        question_number: 2,
        question_text: 'En un abecedario donde no se tienen en cuenta las letras dobles (la ch y la ll), ¿cuál es la letra que ocupa el quinto lugar hacia atrás a partir de la letra intermedia entre la P y la R?',
        question_subtype: 'sequence_letter',
        option_a: 'L',
        option_b: 'M',
        option_c: 'N',
        option_d: 'Ñ',
        correct_option: 'B',
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
            },
            {
              title: "⚡ TÉCNICAS DE ANÁLISIS RÁPIDO",
              content: "🔍 Método 1: Contar posiciones\n• Identificar P (16) y R (18)\n• Intermedia: Q (17)\n• Contar 5 hacia atrás: Q→P→O→N→M\n\n📊 Método 2: Cálculo directo\n• Q es posición 17\n• 17 - 5 = 12\n• Posición 12 = M"
            }
          ]
        }
      },
      {
        id: generateUUID(),
        question_number: 3,
        question_text: 'Continúe la siguiente serie de letras: a j c l e n g o i ?',
        question_subtype: 'sequence_letter',
        option_a: 'q',
        option_b: 'j',
        option_c: 'h',
        option_d: 'p',
        correct_option: 'A',
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
            },
            {
              title: "⚡ TÉCNICAS DE ANÁLISIS RÁPIDO",
              content: "🔍 Método 1: Separar series alternantes\n• Serie 1: a, c, e, g, i → vocales\n• Serie 2: j, l, n, o → consonantes saltando una\n• Siguiente en serie 2: q\n\n📊 Método 2: Observar patrón de saltos\n• a(vocal) j(cons) c(vocal) l(cons)\n• Patrón: vocal-consonante alternado\n• Consonantes: j→l(+2) l→n(+2) n→o(+1) o→q(+2)"
            }
          ]
        }
      },
      {
        id: generateUUID(),
        question_number: 4,
        question_text: 'Indique qué letra continúa cada serie (no cuentan las letras dobles pero sí la ñ). C-C-D-E-E-E-F-G-G-G-H-?',
        question_subtype: 'sequence_letter',
        options: ['J', 'M', 'I', 'K'],
        correct_answer: 'C',
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
            },
            {
              title: "⚡ TÉCNICAS DE ANÁLISIS RÁPIDO",
              content: "🔍 Método 1: Contar repeticiones\n• C(2) D(1) E(3) F(1) G(3) H(1)\n• Patrón alterno: muchas repeticiones vs 1 sola\n• Siguiente: I debería repetirse varias veces\n\n📊 Método 2: Secuencia base\n• Base: C D E F G H I...\n• Repeticiones variables siguiendo patrón\n• Siguiente letra base: I"
            }
          ]
        }
      },
      {
        id: generateUUID(),
        question_number: 5,
        question_text: 'Indique la opción que continúa la serie: C-G-K-Ñ-¿?',
        question_subtype: 'sequence_letter',
        options: ['S', 'P', 'R', 'T'],
        correct_answer: 'C',
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
            },
            {
              title: "⚡ TÉCNICAS DE ANÁLISIS RÁPIDO",
              content: "🔍 Método 1: Contar saltos\n• C→G: 4 letras (C-D-E-F-G)\n• G→K: 4 letras (G-H-I-J-K)\n• K→Ñ: 4 letras (K-L-M-N-Ñ)\n• Ñ→?: 4 letras (Ñ-O-P-Q-R)\n\n📊 Método 2: Verificar opciones\n• S = +4 desde Ñ? No\n• P = +1 desde Ñ? No\n• R = +4 desde Ñ? Sí ✅\n• T = +5 desde Ñ? No"
            }
          ]
        }
      },
      {
        id: generateUUID(),
        question_number: 6,
        question_text: 'Indique la opción que continúa la serie: I-K-N-Q-¿?',
        question_subtype: 'sequence_letter',
        options: ['U', 'V', 'W', 'X'],
        correct_answer: 'B',
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
            },
            {
              title: "⚡ TÉCNICAS DE ANÁLISIS RÁPIDO",
              content: "🔍 Método 1: Contar intervalos\n• I→K: 2 saltos\n• K→N: 3 saltos\n• N→Q: 3 saltos\n• Patrón: 2,3,3... siguiente debería ser 4\n• Q + 4 = V\n\n📊 Método 2: Posiciones numéricas\n• I(9) K(11) N(14) Q(17)\n• Diferencias: +2, +3, +3\n• Siguiente: +4 = posición 21 = V"
            }
          ]
        }
      },
      {
        id: generateUUID(),
        question_number: 7,
        question_text: 'Continúe con las dos letras que corresponderían a los interrogantes en la siguiente serie: p-r-t; t-w-z; z-d-h; h-¿?-¿?',
        question_subtype: 'sequence_letter',
        options: ['m-q', 'n-o', 'm-ñ', 'l-q'],
        correct_answer: 'A',
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
            },
            {
              title: "⚡ TÉCNICAS DE ANÁLISIS RÁPIDO",
              content: "🔍 Método 1: Identificar patrón por grupo\n• Cada grupo: letra inicial + 2 saltos iguales\n• Saltos: +2, +3, +4, siguiente +5\n• h→m→q (saltos de +5)\n\n📊 Método 2: Secuencia de primeras letras\n• p, t, z, h → patrón en primera letra de cada grupo\n• Dentro de grupo: saltos constantes crecientes\n• h + 5 + 5 = m, q"
            }
          ]
        }
      },
      {
        id: generateUUID(),
        question_number: 8,
        question_text: '¿Qué letra continuaría la siguiente serie de letras? h h i j l k n l o m ¿?',
        question_subtype: 'sequence_letter',
        options: ['q', 'p', 'ñ', 'n'],
        correct_answer: 'A',
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
              content: "📋 Serie: h h i j l k n l o m ?\n\n✅ Análisis de posiciones pares e impares:\n\n📋 Posiciones impares (1ª, 3ª, 5ª, 7ª, 9ª): h, i, l, n, o\n• h→i(+1) i→l(+3) l→n(+2) n→o(+1)\n• Las letras van seguidas\n\n📋 Posiciones pares (2ª, 4ª, 6ª, 8ª, 10ª): h, j, k, l, m\n• h→j(+2) j→k(+1) k→l(+1) l→m(+1) \n• Patrón: saltan una; está sería la que nos interesa para contestar la pregunta. Como vemos salta una letra en cada paso, con lo que, a partir de la letra 'o' saltaríamos (p) tendría que seguir la letra 'q' que es nuestra respuesta."
            },
            {
              title: "⚡ TÉCNICAS DE ANÁLISIS RÁPIDO",
              content: "🔍 Método 1: Separar posiciones pares e impares\n• Escribir solo posiciones impares: h, i, l, n, o\n• Escribir solo posiciones pares: h, j, k, l, m\n• La 11ª posición (impar): siguiente después de 'o' saltando una = 'q'\n\n📊 Método 2: Observar patrón de las subseries\n• Subserie 1: h, i, l, n, o → va seguida\n• Subserie 2: h, j, k, l, m → salta una letra cada vez\n• Siguiente en subserie 1: o→p→q (salta p, respuesta q)"
            }
          ]
        }
      },
      {
        id: generateUUID(),
        question_number: 9,
        question_text: 'Indique la letra que continúa la siguiente serie lógica: D Z V R Ñ ¿?',
        question_subtype: 'sequence_letter',
        options: ['K', 'M', 'J', 'L'],
        correct_answer: 'A',
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
            },
            {
              title: "⚡ TÉCNICAS DE ANÁLISIS RÁPIDO",
              content: "🔍 Método 1: Observar dirección de la serie\n• D→Z: retrocede (va hacia atrás en alfabeto)\n• Contar saltos: D(CBA)Z, Z(YXW)V, V(UTS)R\n• Patrón: salta 3 hacia atrás constante\n\n📊 Método 2: Descarte de opciones\n• Desde Ñ, 4 posiciones atrás\n• Ñ(NML)K ✅\n• Verificar que K está 4 posiciones antes que Ñ"
            }
          ]
        }
      },
      {
        id: generateUUID(),
        question_number: 11,
        question_text: 'Indique qué letra continúa cada serie (no cuentan las letras dobles pero sí la ñ). M-W-M-N-W-M-N-Ñ-W-M-N-Ñ-O-W-?',
        question_subtype: 'sequence_letter',
        options: ['W', 'M', 'O', 'N'],
        correct_answer: 'B',
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
              content: "📋 Serie: M-W-M-N-W-M-N-Ñ-W-M-N-Ñ-O-W-?\n\n✅ El concepto de intercalado hace referencia al hecho de que la relación de las letras de la serie no es de uno en uno, sino que vamos saltando letras.\n\nTenemos dos series donde, por un lado la W se repite y, por otro lado, la serie avanza en el abecedario de forma correlativa añadiendo una letra cada vez:\n\nM\nMN\nMNÑ\nMNÑO"
            },
            {
              title: "⚡ TÉCNICAS DE ANÁLISIS RÁPIDO",
              content: "🔍 Método 1: Separar las dos series\n• Serie constante: W (se repite)\n• Serie creciente: M → MN → MNÑ → MNÑO\n• Después de cada grupo completo: W\n• Siguiente después de W: M (inicia MNÑO)\n\n📊 Método 2: Observar estructura de grupos\n• Grupo 1: M,W\n• Grupo 2: M,N,W  \n• Grupo 3: M,N,Ñ,W\n• Grupo 4: M,N,Ñ,O,W\n• Siguiente: M (empieza grupo 5)"
            }
          ]
        }
      },
      {
        id: generateUUID(),
        question_number: 12,
        question_text: 'Indique qué letra continúa cada serie (no cuentan las letras dobles pero sí la ñ). Z-X-U-Q-¿?',
        question_subtype: 'sequence_letter',
        options: ['Ñ', 'F', 'M', 'G'],
        correct_answer: 'C',
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
              content: "📋 Serie: Z-X-U-Q-?\n\n✅ En este caso tenemos una serie de letras correlativas que avanzan hacia atrás.\n\n📋 Análisis de saltos:\n• Z→X: -2 posiciones (salta Y)\n• X→U: -3 posiciones (salta W,V)\n• U→Q: -4 posiciones (salta T,S,R)\n• Q→?: -5 posiciones (salta P,O,N,Ñ) = M"
            },
            {
              title: "⚡ TÉCNICAS DE ANÁLISIS RÁPIDO",
              content: "🔍 Método 1: Contar saltos hacia atrás\n• Z(-2)X(-3)U(-4)Q\n• Patrón: saltos crecientes -2,-3,-4\n• Siguiente: -5 desde Q\n• Q→P→O→N→Ñ→M = M\n\n📊 Método 2: Posiciones numéricas\n• Z=27, X=25, U=22, Q=18\n• Diferencias: -2,-3,-4\n• Siguiente: Q-5 = 18-5 = 13 = M"
            }
          ]
        }
      },
      {
        id: generateUUID(),
        question_number: 14,
        question_text: 'Indique qué letra continúa la serie (no cuentan las letras dobles pero sí la ñ). C-E-G-I-K-M-Ñ-?',
        question_subtype: 'sequence_letter',
        options: ['P', 'R', 'S', 'O'],
        correct_answer: 'A',
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
              content: "📋 Serie: C-E-G-I-K-M-Ñ-?\n\n✅ Serie sencilla salta una letra en el abecedario.\n\nC salta d E salta f G salta h I salta j K salta l M salta n Ñ salta o.. tendría que venir la letra P.\n\n📋 Patrón: Salto constante de +2 posiciones"
            },
            {
              title: "⚡ TÉCNICAS DE ANÁLISIS RÁPIDO",
              content: "🔍 Método 1: Observar patrón de saltos\n• C→E: salta D\n• E→G: salta F\n• G→I: salta H\n• Patrón: salta siempre 1 letra\n• Ñ→?: salta O = P\n\n📊 Método 2: Posiciones impares\n• Verificar que todas están en posiciones impares\n• C(3), E(5), G(7), I(9), K(11), M(13), Ñ(15)\n• Siguiente impar: 17 = P"
            }
          ]
        }
      },
      {
        id: generateUUID(),
        question_number: 15,
        question_text: 'Indique la opción que continúa la serie: L-M-G-F-Ñ-O-E-¿?',
        question_subtype: 'sequence_letter',
        options: ['F', 'D', 'E', 'G'],
        correct_answer: 'B',
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
            },
            {
              title: "⚡ TÉCNICAS DE ANÁLISIS RÁPIDO",
              content: "🔍 Método 1: Identificar dos subseries\n• Subserie 1 (impares): L, G, Ñ, E\n• Subserie 2 (pares): M, F, O, ?\n• Observar dirección de cada subserie\n• La 8ª posición (par): O hacia atrás\n\n📊 Método 2: Patrón de saltos\n• Cada subserie alterna dirección\n• Después de O, debería ir hacia atrás\n• O→N→M→L→K→J→I→H→G→F→E→D\n• Respuesta: D"
            }
          ]
        }
      },
      {
        id: generateUUID(),
        question_number: 16,
        question_text: 'En la siguiente serie, marque la letra que la continuaría: h i j h i j i h i j h i j ¿?',
        question_subtype: 'sequence_letter',
        options: ['k', 'l', 'i', 'j'],
        correct_answer: 'A',
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
              content: "📋 Serie: h i j h i j i h i j h i j ?\n\n✅ La serie forma un grupo de tres letras que se va repitiendo, alternando con otra serie cuyas letras van seguidas.\n\nEl grupo que se repite sería: (h i j) y luego intercala la otra serie,comenzando por la 'h', vuelve a repetir el esquema 'h i j' y continúa la otra serie 'i' y así va repitiendo y avanzando.\n\nh i j h i j corresponderíala letra 'k'."
            },
            {
              title: "⚡ TÉCNICAS DE ANÁLISIS RÁPIDO",
              content: "🔍 Método 1: Identificar grupos repetitivos\n• Grupo base: h-i-j (se repite)\n• Serie intercalada: h, i, j, k... (va seguida)\n• Después de j en posición 13: siguiente de la serie seguida = k\n\n📊 Método 2: Contar posiciones\n• Posiciones 1-3: h-i-j (grupo base)\n• Posiciones 4-6: h-i-j (grupo base)\n• Posición 7: i (serie intercalada)\n• Continúa patrón hasta llegar a k"
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
      console.log('❌ Error al buscar categoría series_letras:', categoryError.message);
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
    const questionsToInsert = questions.map(q => ({
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
      .select('id, question_number');

    if (insertError) {
      console.log('❌ Error al insertar preguntas:', insertError.message);
      return;
    }

    console.log('✅ LOTE DE SERIES DE LETRAS P02-P16 AÑADIDO EXITOSAMENTE');
    console.log(`📊 ${insertedQuestions.length} preguntas insertadas:`);
    
    insertedQuestions.forEach(q => {
      console.log(`   P${q.question_number.toString().padStart(2, '0')}: ${q.id}`);
    });

    console.log('');
    console.log('🔗 ENLACES DE DEBUG:');
    insertedQuestions.forEach(q => {
      console.log(`   P${q.question_number.toString().padStart(2, '0')}: http://localhost:3000/debug/question/${q.id}`);
    });
    
    console.log('');
    console.log('📋 Debug Batch: http://localhost:3000/debug/batch');

  } catch (error) {
    console.log('❌ Error general:', error.message);
  }
}

addLetterSeriesQuestions();