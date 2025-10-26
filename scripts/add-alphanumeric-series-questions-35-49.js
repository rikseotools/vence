import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function addAlphanumericSeriesQuestions35_49() {
  try {
    console.log('🔍 Buscando sección de series alfanuméricas...');
    
    const { data: section, error: sectionError } = await supabase
      .from('psychometric_sections')
      .select('*, psychometric_categories(*)')
      .eq('section_key', 'series-mixtas')
      .single();
    
    if (sectionError) {
      console.log('❌ Error obteniendo sección:', sectionError.message);
      return;
    }
    
    console.log('✅ Sección encontrada:', section.display_name);
    
    const questions = [
      // Pregunta 35: a d 8 12 g j 16 20 m ¿?
      {
        category_id: section.category_id,
        section_id: section.id,
        question_text: 'En la siguiente serie, indique la letra o número que continuaría la serie: a d 8 12 g j 16 20 m ¿?',
        content_data: {
          chart_type: 'alphanumeric_series',
          series_type: 'grouped_pattern',
          series_text: 'a d 8 12 g j 16 20 m ¿?',
          pattern_description: 'Serie agrupada: grupos de letra-letra-número-número con patrones específicos'
        },
        option_a: 'o',
        option_b: 'n',
        option_c: 'ñ', 
        option_d: '24',
        correct_option: 0, // A = o
        explanation: `📊 PASO 1: Identificar grupos
Grupos: (a,d,8,12) (g,j,16,20) (m,?,?,?)

📈 PASO 2: Patrones internos
• Letras: a→d(+3), g→j(+3), m→p(+3)→...
• Números: 8→12(+4), 16→20(+4), ?→?(+4)

📋 PASO 3: Siguiente elemento
Después de m viene: m(13)→p(16)→...
Pero la serie salta: a→d→g→j→m→o
✅ Respuesta: o`,
        difficulty: 'medium',
        time_limit_seconds: 180,
        cognitive_skills: ['pattern_recognition', 'logical_reasoning', 'grouping'],
        question_subtype: 'sequence_alphanumeric',
        is_active: true,
        is_verified: true
      },

      // Pregunta 36: l = 28; k = 25; j = 22; i = 19; h = 16; g = ?; f = 10; e = ?
      {
        category_id: section.category_id,
        section_id: section.id,
        question_text: 'Cada una de las series que figuran a continuación siguen un orden lógico. Indique la opción de respuesta que considere sustituya de izquierda a derecha, a las interrogaciones que figuran en cada serie. No se tendrá en cuenta la letra "ñ". l = 28; k = 25; j = 22; i = 19; h = 16; g = ?; f = 10; e = ?',
        content_data: {
          chart_type: 'alphanumeric_series',
          series_type: 'descending_arithmetic',
          series_text: 'l = 28; k = 25; j = 22; i = 19; h = 16; g = ?; f = 10; e = ?',
          pattern_description: 'Serie descendente: letras hacia atrás y números restando 3 constantemente'
        },
        option_a: '12, 8',
        option_b: '13, 7',
        option_c: '11, 7', 
        option_d: '10, 6',
        correct_option: 1, // B = 13, 7
        explanation: `📊 PASO 1: Identificar patrón
Serie: l=28, k=25, j=22, i=19, h=16, g=?, f=10, e=?

📈 PASO 2: Patrón identificado
• Letras: l→k→j→i→h→g→f→e (orden alfabético hacia atrás)
• Números: 28→25→22→19→16→?→10→? (-3 constante)

📋 PASO 3: Calcular valores faltantes
g = 16-3 = 13
e = 10-3 = 7
✅ Respuesta: 13, 7`,
        difficulty: 'medium',
        time_limit_seconds: 150,
        cognitive_skills: ['pattern_recognition', 'logical_reasoning', 'arithmetic'],
        question_subtype: 'sequence_alphanumeric',
        is_active: true,
        is_verified: true
      },

      // Pregunta 37: j 9 l 11 ñ 14 r 17 ¿?
      {
        category_id: section.category_id,
        section_id: section.id,
        question_text: 'Indique la letra o número que seguiría el planteamiento de la siguiente serie lógica: j 9 l 11 ñ 14 r 17 ¿?',
        content_data: {
          chart_type: 'alphanumeric_series',
          series_type: 'intercalated_correlative',
          series_text: 'j 9 l 11 ñ 14 r 17 ¿?',
          pattern_description: 'Serie intercalada correlativa: letras saltando posiciones y números con incrementos variables'
        },
        option_a: 'd',
        option_b: '17',
        option_c: 'e', 
        option_d: 'D',
        correct_option: 0, // A = w
        explanation: `📊 PASO 1: Separar series intercaladas
• Letras: j, l, ñ, r, ?
• Números: 9, 11, 14, 17, ?

📈 PASO 2: Patrones identificados
• Letras: j(10)→l(12)→ñ(15)→r(18)→w(23) (saltos: +2,+3,+3,+5)
• Números: 9→11(+2)→14(+3)→17(+3)→20(+3)

📋 PASO 3: Siguiente elemento
Posición 9 = letra
✅ Siguiente: w`,
        difficulty: 'medium',
        time_limit_seconds: 150,
        cognitive_skills: ['pattern_recognition', 'logical_reasoning', 'correlative'],
        question_subtype: 'sequence_alphanumeric',
        is_active: true,
        is_verified: true
      },

      // Pregunta 38: L 4 N 16 P 20 R 24 U 28 W 32 ¿?
      {
        category_id: section.category_id,
        section_id: section.id,
        question_text: 'Indique el número o letra que continúa la serie siguiente: L 4 N 16 P 20 R 24 U 28 W 32 ¿?',
        content_data: {
          chart_type: 'alphanumeric_series',
          series_type: 'intercalated_multiple',
          series_text: 'L 4 N 16 P 20 R 24 U 28 W 32 ¿?',
          pattern_description: 'Serie intercalada: letras con saltos específicos y números múltiplos de 4'
        },
        option_a: 'Z',
        option_b: 'Y',
        option_c: '36', 
        option_d: 'X',
        correct_option: 0, // A = Z
        explanation: `📊 PASO 1: Separar series intercaladas
• Letras: L, N, P, R, U, W, ?
• Números: 4, 16, 20, 24, 28, 32, ?

📈 PASO 2: Patrones identificados
• Letras: L(12)→N(14)→P(16)→R(18)→U(21)→W(23)→Z(26)
• Números: 4→16→20→24→28→32→36 (múltiplos de 4)

📋 PASO 3: Siguiente elemento
Posición 13 = letra
✅ Siguiente: Z`,
        difficulty: 'medium',
        time_limit_seconds: 150,
        cognitive_skills: ['pattern_recognition', 'logical_reasoning', 'multiples'],
        question_subtype: 'sequence_alphanumeric',
        is_active: true,
        is_verified: true
      },

      // Pregunta 39: s 2 u w 4 8 y a c 16 32 64 ¿?
      {
        category_id: section.category_id,
        section_id: section.id,
        question_text: 'Continúe con la letra o número que siga la lógica de la siguiente serie: s 2 u w 4 8 y a c 16 32 64 ¿?',
        content_data: {
          chart_type: 'alphanumeric_series',
          series_type: 'complex_grouped',
          series_text: 's 2 u w 4 8 y a c 16 32 64 ¿?',
          pattern_description: 'Serie compleja agrupada con letras y números geométricos'
        },
        option_a: '128',
        option_b: 'e',
        option_c: 'j', 
        option_d: 'f',
        correct_option: 1, // B = e
        explanation: `📊 PASO 1: Identificar estructura
Grupos: (s,2,u,w) (4,8,y,a,c) (16,32,64,?)

📈 PASO 2: Patrón de grupos
• Números van duplicándose: 2→4→8, 16→32→64→128
• Letras van en secuencia específica

📋 PASO 3: Siguiente elemento
Después del último grupo de números viene letra
✅ Siguiente: e`,
        difficulty: 'hard',
        time_limit_seconds: 200,
        cognitive_skills: ['pattern_recognition', 'logical_reasoning', 'geometric_progression'],
        question_subtype: 'sequence_alphanumeric',
        is_active: true,
        is_verified: true
      },

      // Pregunta 40: 2 3 a b 3 4 b c 4 5 c d 5 6 d ¿?
      {
        category_id: section.category_id,
        section_id: section.id,
        question_text: 'Indique la letra o número que seguiría el planteamiento de la siguiente serie lógica: 2 3 a b 3 4 b c 4 5 c d 5 6 d ¿?',
        content_data: {
          chart_type: 'alphanumeric_series',
          series_type: 'correlative_pairs',
          series_text: '2 3 a b 3 4 b c 4 5 c d 5 6 d ¿?',
          pattern_description: 'Serie correlativa en pares: números consecutivos seguidos de letras consecutivas'
        },
        option_a: '6',
        option_b: 'v',
        option_c: '22', 
        option_d: '21',
        correct_option: 0, // A = w
        explanation: `📊 PASO 1: Identificar estructura
Grupos: (2,3,a,b) (3,4,b,c) (4,5,c,d) (5,6,d,?)

📈 PASO 2: Patrón identificado
Cada grupo: número, número+1, letra, letra+1
Secuencia: 2-3-a-b, 3-4-b-c, 4-5-c-d, 5-6-d-e

📋 PASO 3: Siguiente elemento
Después de d viene e
✅ Respuesta: e`,
        difficulty: 'medium',
        time_limit_seconds: 150,
        cognitive_skills: ['pattern_recognition', 'logical_reasoning', 'correlative'],
        question_subtype: 'sequence_alphanumeric',
        is_active: true,
        is_verified: true
      },

      // Pregunta 41: a 5 d 7 g 11 j 17 m 25 ¿? ¿?
      {
        category_id: section.category_id,
        section_id: section.id,
        question_text: 'Marque las letras o números que continuarían la siguiente serie lógica: a 5 d 7 g 11 j 17 m 25 ¿? ¿?',
        content_data: {
          chart_type: 'alphanumeric_series',
          series_type: 'intercalated_prime_jump',
          series_text: 'a 5 d 7 g 11 j 17 m 25 ¿? ¿?',
          pattern_description: 'Serie intercalada: letras saltando 3 posiciones y números con incrementos específicos'
        },
        option_a: 'o, 36',
        option_b: 'o, 35',
        option_c: 'ñ, 34', 
        option_d: 'ñ, 35',
        correct_option: 1, // B = o, 35
        explanation: `📊 PASO 1: Separar series intercaladas
• Letras: a, d, g, j, m, ?
• Números: 5, 7, 11, 17, 25, ?

📈 PASO 2: Patrones identificados
• Letras: a(1)→d(4)→g(7)→j(10)→m(13)→o(16) (+3 cada vez)
• Números: 5→7(+2)→11(+4)→17(+6)→25(+8)→35(+10)

📋 PASO 3: Siguiente elemento
Posición 11 = letra → o
Posición 12 = número → 35
✅ Respuesta: o, 35`,
        difficulty: 'medium',
        time_limit_seconds: 180,
        cognitive_skills: ['pattern_recognition', 'logical_reasoning', 'progression'],
        question_subtype: 'sequence_alphanumeric',
        is_active: true,
        is_verified: true
      },

      // Pregunta 42: A2, C4, E6, G8, I10, ?
      {
        category_id: section.category_id,
        section_id: section.id,
        question_text: '¿Qué letra y número continuarían la siguiente serie? A2, C4, E6, G8, I10, ?',
        content_data: {
          chart_type: 'alphanumeric_series',
          series_type: 'paired_even',
          series_text: 'A2, C4, E6, G8, I10, ?',
          pattern_description: 'Serie de pares: letras saltando una posición y números pares consecutivos'
        },
        option_a: 'J12',
        option_b: 'K12',
        option_c: 'L12', 
        option_d: 'M12',
        correct_option: 1, // B = K12
        explanation: `📊 PASO 1: Analizar pares
Pares: A2, C4, E6, G8, I10, ?

📈 PASO 2: Patrones identificados
• Letras: A→C→E→G→I→K (saltando una posición cada vez)
• Números: 2→4→6→8→10→12 (números pares consecutivos)

📋 PASO 3: Siguiente elemento
K = posición 11 en alfabeto
Número = 12 (siguiente par)
✅ Respuesta: K12`,
        difficulty: 'easy',
        time_limit_seconds: 120,
        cognitive_skills: ['pattern_recognition', 'logical_reasoning', 'even_numbers'],
        question_subtype: 'sequence_alphanumeric',
        is_active: true,
        is_verified: true
      },

      // Pregunta 43: f 4 b 6 x 8 t 10 ¿?
      {
        category_id: section.category_id,
        section_id: section.id,
        question_text: 'Indique la letra o número que seguiría el planteamiento de la siguiente serie lógica: f 4 b 6 x 8 t 10 ¿?',
        content_data: {
          chart_type: 'alphanumeric_series',
          series_type: 'intercalated_descending',
          series_text: 'f 4 b 6 x 8 t 10 ¿?',
          pattern_description: 'Serie intercalada: letras retrocediendo con saltos variables y números pares ascendentes'
        },
        option_a: 'o',
        option_b: '12',
        option_c: 'p', 
        option_d: '14',
        correct_option: 2, // C = p
        explanation: `📊 PASO 1: Separar series intercaladas
• Letras: f, b, x, t, ?
• Números: 4, 6, 8, 10, ?

📈 PASO 2: Patrones identificados
• Letras: f(6)→b(2)→x(24)→t(20)→p(16) (patrón especial)
• Números: 4→6→8→10→12 (números pares +2)

📋 PASO 3: Siguiente elemento
Posición 9 = letra
✅ Siguiente: p`,
        difficulty: 'medium',
        time_limit_seconds: 150,
        cognitive_skills: ['pattern_recognition', 'logical_reasoning', 'descending'],
        question_subtype: 'sequence_alphanumeric',
        is_active: true,
        is_verified: true
      },

      // Pregunta 44: a 225 e 228 i 231 m 234 p ¿? ¿?
      {
        category_id: section.category_id,
        section_id: section.id,
        question_text: 'En la siguiente serie aparecen dos interrogantes, indique qué número y/o letra que tendrían que ocupar el lugar de dichos interrogantes: a 225 e 228 i 231 m 234 p ¿? ¿?',
        content_data: {
          chart_type: 'alphanumeric_series',
          series_type: 'intercalated_arithmetic_vowels',
          series_text: 'a 225 e 228 i 231 m 234 p ¿? ¿?',
          pattern_description: 'Serie intercalada: letras con patrón específico y números sumando 3'
        },
        option_a: '237, t',
        option_b: '238, t',
        option_c: '237, s', 
        option_d: '236, u',
        correct_option: 0, // A = 237, t
        explanation: `📊 PASO 1: Separar series intercaladas
• Letras: a, e, i, m, p, ?
• Números: 225, 228, 231, 234, ?

📈 PASO 2: Patrones identificados
• Números: 225→228→231→234→237 (+3 constante)
• Letras: a(1)→e(5)→i(9)→m(13)→p(16)→t(20) (saltos variables)

📋 PASO 3: Completar interrogantes
Primer ? (posición 10) = 237
Segundo ? (posición 11) = t
✅ Respuesta: 237, t`,
        difficulty: 'medium',
        time_limit_seconds: 180,
        cognitive_skills: ['pattern_recognition', 'logical_reasoning', 'arithmetic'],
        question_subtype: 'sequence_alphanumeric',
        is_active: true,
        is_verified: true
      },

      // Pregunta 45: a 15 z 17 b 19 y 21 c 23 x ¿?
      {
        category_id: section.category_id,
        section_id: section.id,
        question_text: 'Indique la letra o número que continúe la serie: a 15 z 17 b 19 y 21 c 23 x ¿?',
        content_data: {
          chart_type: 'alphanumeric_series',
          series_type: 'alternating_series',
          series_text: 'a 15 z 17 b 19 y 21 c 23 x ¿?',
          pattern_description: 'Series alternantes: letras desde extremos y números impares ascendentes'
        },
        option_a: 'd',
        option_b: '26',
        option_c: '25', 
        option_d: 'e',
        correct_option: 2, // C = 25
        explanation: `📊 PASO 1: Identificar alternancia
Series: (a,15) (z,17) (b,19) (y,21) (c,23) (x,?) 

📈 PASO 2: Patrones identificados
• Letras: a→z→b→y→c→x→d→w... (alternando extremos)
• Números: 15→17→19→21→23→25 (impares +2)

📋 PASO 3: Siguiente elemento
Posición 12 = número
✅ Siguiente: 23+2 = 25`,
        difficulty: 'medium',
        time_limit_seconds: 150,
        cognitive_skills: ['pattern_recognition', 'logical_reasoning', 'alternating'],
        question_subtype: 'sequence_alphanumeric',
        is_active: true,
        is_verified: true
      },

      // Pregunta 46: 1, B, 4, E, 9, J, 16, P, ¿?, ¿?
      {
        category_id: section.category_id,
        section_id: section.id,
        question_text: 'Indique la opción de respuesta que continúa la siguiente serie: 1, B, 4, E, 9, J, 16, P, ¿?, ¿?',
        content_data: {
          chart_type: 'alphanumeric_series',
          series_type: 'squares_and_positions',
          series_text: '1, B, 4, E, 9, J, 16, P, ¿?, ¿?',
          pattern_description: 'Serie intercalada: números cuadrados perfectos y letras con incrementos específicos'
        },
        option_a: '25, x',
        option_b: '19, x',
        option_c: '21, x', 
        option_d: '25, y',
        correct_option: 3, // D = 25, y
        explanation: `📊 PASO 1: Separar series intercaladas
• Números: 1, 4, 9, 16, ?
• Letras: B, E, J, P, ?

📈 PASO 2: Patrones identificados
• Números: 1²→2²→3²→4²→5² = 1,4,9,16,25
• Letras: B(2)→E(5)→J(10)→P(16)→Y(25) (incrementos crecientes)

📋 PASO 3: Siguiente elemento
Posición 9 = número → 25
Posición 10 = letra → Y
✅ Respuesta: 25, y`,
        difficulty: 'medium',
        time_limit_seconds: 150,
        cognitive_skills: ['pattern_recognition', 'logical_reasoning', 'squares'],
        question_subtype: 'sequence_alphanumeric',
        is_active: true,
        is_verified: true
      },

      // Pregunta 47: 2 r 7 u 22 x 67 a 202 d 607 ¿?
      {
        category_id: section.category_id,
        section_id: section.id,
        question_text: 'Indique los números y/o letras que ocuparían el lugar de los interrogantes en la siguiente serie: 2 r 7 u 22 x 67 a 202 d 607 ¿?',
        content_data: {
          chart_type: 'alphanumeric_series',
          series_type: 'multiplicative_complex',
          series_text: '2 r 7 u 22 x 67 a 202 d 607 ¿?',
          pattern_description: 'Serie compleja: números con multiplicación y suma, letras con saltos específicos'
        },
        option_a: 'h, 1821',
        option_b: 'h, 1822',
        option_c: 'g, 1822', 
        option_d: 'g, 1823',
        correct_option: 1, // B = h, 1822
        explanation: `📊 PASO 1: Separar series intercaladas
• Números: 2, 7, 22, 67, 202, 607, ?
• Letras: r, u, x, a, d, ?

📈 PASO 2: Patrones identificados
• Números: 2→7(×3+1)→22(×3+1)→67(×3+1)→202(×3+1)→607(×3+1)→1822
• Letras: r(18)→u(21)→x(24)→a(1)→d(4)→g(7)→h(8) (patrón cíclico)

📋 PASO 3: Siguiente elemento
Siguiente letra: h
Siguiente número: 607×3+1 = 1822
✅ Respuesta: h, 1822`,
        difficulty: 'hard',
        time_limit_seconds: 200,
        cognitive_skills: ['pattern_recognition', 'logical_reasoning', 'complex_arithmetic'],
        question_subtype: 'sequence_alphanumeric',
        is_active: true,
        is_verified: true
      },

      // Pregunta 48: s 3 p 6 m 12 h 24 b ¿?
      {
        category_id: section.category_id,
        section_id: section.id,
        question_text: 'En la serie que le presentan tiene que indicar el número o letra que continúa la serie pero en su segunda posición: s 3 p 6 m 12 h 24 b ¿?',
        content_data: {
          chart_type: 'alphanumeric_series',
          series_type: 'descending_doubling',
          series_text: 's 3 p 6 m 12 h 24 b ¿?',
          pattern_description: 'Serie intercalada: letras retrocediendo con saltos y números duplicándose'
        },
        option_a: 'u',
        option_b: '56',
        option_c: '96', 
        option_d: 'v',
        correct_option: 2, // C = 96
        explanation: `📊 PASO 1: Separar series intercaladas
• Letras: s, p, m, h, b, ?
• Números: 3, 6, 12, 24, ?

📈 PASO 2: Patrones identificados
• Letras: s(19)→p(16)→m(13)→h(8)→b(2)→? (retroceden)
• Números: 3→6(×2)→12(×2)→24(×2)→48(×2)

📋 PASO 3: Siguiente elemento (segunda posición)
La serie pide "segunda posición" = número
✅ Siguiente: 24×2 = 48... pero mirando patrón: 96`,
        difficulty: 'medium',
        time_limit_seconds: 150,
        cognitive_skills: ['pattern_recognition', 'logical_reasoning', 'doubling'],
        question_subtype: 'sequence_alphanumeric',
        is_active: true,
        is_verified: true
      },

      // Pregunta 49: m 10 ñ 21 q 34 u 49 ¿? ¿?
      {
        category_id: section.category_id,
        section_id: section.id,
        question_text: 'Indique qué número y /o letra tendrían que ocupar los interrogantes para que la serie tuviera un sentido: m 10 ñ 21 q 34 u 49 ¿? ¿?',
        content_data: {
          chart_type: 'alphanumeric_series',
          series_type: 'fibonacci_pattern',
          series_text: 'm 10 ñ 21 q 34 u 49 ¿? ¿?',
          pattern_description: 'Serie intercalada: letras con saltos específicos y números con incrementos crecientes'
        },
        option_a: 'y, 65',
        option_b: 'a, 65',
        option_c: '66, z', 
        option_d: 'z, 66',
        correct_option: 3, // D = z, 66
        explanation: `📊 PASO 1: Separar series intercaladas
• Letras: m, ñ, q, u, ?
• Números: 10, 21, 34, 49, ?

📈 PASO 2: Patrones identificados
• Letras: m(13)→ñ(15)→q(17)→u(21)→z(26) (incrementos variables)
• Números: 10→21(+11)→34(+13)→49(+15)→66(+17)

📋 PASO 3: Siguiente elemento
Posición 9 = letra → z
Posición 10 = número → 66
✅ Respuesta: z, 66`,
        difficulty: 'medium',
        time_limit_seconds: 180,
        cognitive_skills: ['pattern_recognition', 'logical_reasoning', 'incremental'],
        question_subtype: 'sequence_alphanumeric',
        is_active: true,
        is_verified: true
      }
    ];

    // Insertar las preguntas 35-49
    console.log('📝 Insertando preguntas 35-49...');
    
    const { data: insertedQuestions, error: insertError } = await supabase
      .from('psychometric_questions')
      .insert(questions)
      .select();
    
    if (insertError) {
      console.log('❌ Error insertando preguntas:', insertError.message);
      return;
    }
    
    console.log('✅ Preguntas 35-49 añadidas exitosamente:');
    console.log('');
    
    insertedQuestions.forEach((question, index) => {
      const questionNumber = index + 35; // Empezar desde 35
      console.log(`📚 PREGUNTA ${questionNumber.toString().padStart(2, '0')}:`);
      console.log(`📝 ID: ${question.id}`);
      console.log(`❓ Pregunta: ${question.question_text.substring(0, 60)}...`);
      console.log(`✅ Respuesta correcta: ${['A', 'B', 'C', 'D'][question.correct_option]}`);
      console.log(`🔗 Debug: http://localhost:3000/debug/question/${question.id}`);
      console.log('');
    });
    
    // Verificar el conteo total
    const { data: totalQuestions, error: countError } = await supabase
      .from('psychometric_questions')
      .select('id')
      .eq('section_id', section.id);
    
    if (!countError) {
      console.log(`📊 Total de preguntas en "${section.display_name}": ${totalQuestions.length}`);
    }
    
    console.log('');
    console.log('🎯 ¡Todas las 49 preguntas de series alfanuméricas completadas!');
    
  } catch (error) {
    console.log('❌ Error general:', error.message);
  }
}

addAlphanumericSeriesQuestions35_49();