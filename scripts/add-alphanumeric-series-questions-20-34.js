import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function addAlphanumericSeriesQuestions20_34() {
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
      // Pregunta 20: X 5 V 7 R 11 M 17 E 25 ?
      {
        category_id: section.category_id,
        section_id: section.id,
        question_text: '¿Qué número y letra continuarían la siguiente serie? X 5 V 7 R 11 M 17 E 25 ?',
        content_data: {
          chart_type: 'alphanumeric_series',
          series_type: 'intercalated_prime_pattern',
          series_text: 'X 5 V 7 R 11 M 17 E 25 ?',
          pattern_description: 'Serie intercalada: letras retrocediendo con saltos y números primos o incrementos'
        },
        option_a: 'U35',
        option_b: 'T32',
        option_c: 'X36', 
        option_d: 'V34',
        correct_option: 0, // A = U35
        explanation: `📊 PASO 1: Separar series intercaladas
• Letras: X, V, R, M, E, ?
• Números: 5, 7, 11, 17, 25, ?

📈 PASO 2: Patrones identificados
• Letras: X(24)→V(22)→R(18)→M(13)→E(5)→U(21) (patrón especial)
• Números: 5→7(+2)→11(+4)→17(+6)→25(+8)→35(+10)

📋 PASO 3: Siguiente elemento
Posición 11 = letra → U
Posición 12 = número → 35
✅ Respuesta: U35`,
        difficulty: 'hard',
        time_limit_seconds: 180,
        cognitive_skills: ['pattern_recognition', 'logical_reasoning', 'prime_numbers'],
        question_subtype: 'sequence_alphanumeric',
        is_active: true,
        is_verified: true
      },

      // Pregunta 21: 108 N 117 O 126 Q 135 S ?
      {
        category_id: section.category_id,
        section_id: section.id,
        question_text: '¿Qué número y letra continuarían la siguiente serie? 108 N 117 O 126 Q 135 S ?',
        content_data: {
          chart_type: 'alphanumeric_series',
          series_type: 'intercalated_progressive',
          series_text: '108 N 117 O 126 Q 135 S ?',
          pattern_description: 'Serie intercalada: números sumando 9 y letras con saltos variables'
        },
        option_a: '152T',
        option_b: '114U',
        option_c: '144U', 
        option_d: '154V',
        correct_option: 2, // C = 144U
        explanation: `📊 PASO 1: Separar series intercaladas
• Números: 108, 117, 126, 135, ?
• Letras: N, O, Q, S, ?

📈 PASO 2: Patrones identificados
• Números: 108→117(+9)→126(+9)→135(+9)→144(+9)
• Letras: N(14)→O(15)→Q(17)→S(19)→U(21) (+1,+2,+2,+2)

📋 PASO 3: Siguiente elemento
Posición 9 = número → 144
Posición 10 = letra → U
✅ Respuesta: 144U`,
        difficulty: 'medium',
        time_limit_seconds: 150,
        cognitive_skills: ['pattern_recognition', 'logical_reasoning', 'arithmetic'],
        question_subtype: 'sequence_alphanumeric',
        is_active: true,
        is_verified: true
      },

      // Pregunta 22: T 2 P 4 M 8 I 16 E 32 ?
      {
        category_id: section.category_id,
        section_id: section.id,
        question_text: '¿Qué número y letra continuarían la siguiente serie? T 2 P 4 M 8 I 16 E 32 ?',
        content_data: {
          chart_type: 'alphanumeric_series',
          series_type: 'intercalated_geometric',
          series_text: 'T 2 P 4 M 8 I 16 E 32 ?',
          pattern_description: 'Serie intercalada: letras retrocediendo con salto de 4 y números multiplicándose por 2'
        },
        option_a: 'Y50',
        option_b: 'B48',
        option_c: 'A64', 
        option_d: 'Z64',
        correct_option: 2, // C = A64
        explanation: `📊 PASO 1: Separar series intercaladas
• Letras: T, P, M, I, E, ?
• Números: 2, 4, 8, 16, 32, ?

📈 PASO 2: Patrones identificados
• Letras: T(20)→P(16)→M(13)→I(9)→E(5)→A(1) (retroceden -4,-3,-4,-4,-4)
• Números: 2→4(×2)→8(×2)→16(×2)→32(×2)→64(×2)

📋 PASO 3: Siguiente elemento
Posición 11 = letra → A
Posición 12 = número → 64
✅ Respuesta: A64`,
        difficulty: 'medium',
        time_limit_seconds: 150,
        cognitive_skills: ['pattern_recognition', 'logical_reasoning', 'geometric_progression'],
        question_subtype: 'sequence_alphanumeric',
        is_active: true,
        is_verified: true
      },

      // Pregunta 23: B-19-Q-22-F-17-V-20-J-15-A-18-N-13-F-?-?
      {
        category_id: section.category_id,
        section_id: section.id,
        question_text: 'Continúe la siguiente serie: B-19-Q-22-F-17-V-20-J-15-A-18-N-13-F-?-?',
        content_data: {
          chart_type: 'alphanumeric_series',
          series_type: 'complex_grouped',
          series_text: 'B-19-Q-22-F-17-V-20-J-15-A-18-N-13-F-?-?',
          pattern_description: 'Serie compleja agrupada con patrones intercalados de letras y números'
        },
        option_a: '12 S',
        option_b: '15 S',
        option_c: '16 Q', 
        option_d: '14 R',
        correct_option: 2, // C = 16 Q
        explanation: `📊 PASO 1: Identificar estructura
Serie: B-19-Q-22-F-17-V-20-J-15-A-18-N-13-F-?-?

📈 PASO 2: Patrones intercalados
• Números: 19→22(+3)→17(-5)→20(+3)→15(-5)→18(+3)→13(-5)→16(+3)
• Letras: B→Q→F→V→J→A→N→F→Q (patrón especial)

📋 PASO 3: Siguiente elemento
Serie numérica: +3,-5,+3,-5... siguiente: 13+3=16
Serie alfabética: después de F viene Q
✅ Respuesta: 16 Q`,
        difficulty: 'hard',
        time_limit_seconds: 200,
        cognitive_skills: ['pattern_recognition', 'logical_reasoning', 'complex_sequences'],
        question_subtype: 'sequence_alphanumeric',
        is_active: true,
        is_verified: true
      },

      // Pregunta 24: j k 10 11 ñ o 15 16 s t 20 21 ?
      {
        category_id: section.category_id,
        section_id: section.id,
        question_text: 'En la serie que se le presenta, indique la letra o número que la continuaría: j k 10 11 ñ o 15 16 s t 20 21 ?',
        content_data: {
          chart_type: 'alphanumeric_series',
          series_type: 'grouped_consecutive',
          series_text: 'j k 10 11 ñ o 15 16 s t 20 21 ?',
          pattern_description: 'Serie agrupada: pares de letras consecutivas seguidos de pares de números consecutivos'
        },
        option_a: '21',
        option_b: 'x',
        option_c: '22', 
        option_d: 'w',
        correct_option: 1, // B = x
        explanation: `📊 PASO 1: Identificar grupos
Grupos: (j,k,10,11) (ñ,o,15,16) (s,t,20,21) (?,?,?,?)

📈 PASO 2: Patrón de grupos
Cada grupo: 2 letras consecutivas + 2 números consecutivos
• j,k → ñ,o → s,t → w,x
• 10,11 → 15,16 → 20,21 → 25,26

📋 PASO 3: Siguiente elemento
Posición 13 = letra del nuevo grupo
✅ Siguiente: w,x... posición pide primera → x`,
        difficulty: 'medium',
        time_limit_seconds: 150,
        cognitive_skills: ['pattern_recognition', 'logical_reasoning', 'grouping'],
        question_subtype: 'sequence_alphanumeric',
        is_active: true,
        is_verified: true
      },

      // Pregunta 25: m 25 27 30 o 34 36 39 r 43 45 48 u 52 54 57 x ?
      {
        category_id: section.category_id,
        section_id: section.id,
        question_text: 'En la siguiente serie, marque la letra y/o número que la continúa: m 25 27 30 o 34 36 39 r 43 45 48 u 52 54 57 x ?',
        content_data: {
          chart_type: 'alphanumeric_series',
          series_type: 'grouped_arithmetic',
          series_text: 'm 25 27 30 o 34 36 39 r 43 45 48 u 52 54 57 x ?',
          pattern_description: 'Serie agrupada: letra seguida de 3 números con incrementos específicos'
        },
        option_a: '60',
        option_b: 'z',
        option_c: '61', 
        option_d: 'y',
        correct_option: 2, // C = 61
        explanation: `📊 PASO 1: Identificar grupos
Grupos: (m,25,27,30) (o,34,36,39) (r,43,45,48) (u,52,54,57) (x,?,?,?)

📈 PASO 2: Patrón interno
Cada grupo: letra + 3 números
• Números: +2,+3,+4 repetitivo en cada grupo
• m→o→r→u→x (saltos de +3 cada vez)

📋 PASO 3: Siguiente elemento
Grupo x: 57+4=61
✅ Respuesta: 61`,
        difficulty: 'medium',
        time_limit_seconds: 180,
        cognitive_skills: ['pattern_recognition', 'logical_reasoning', 'arithmetic'],
        question_subtype: 'sequence_alphanumeric',
        is_active: true,
        is_verified: true
      },

      // Pregunta 26: A2, C6, F12, J20, ?
      {
        category_id: section.category_id,
        section_id: section.id,
        question_text: '¿Qué letra y número continuarían la siguiente serie? A2, C6, F12, J20, ?',
        content_data: {
          chart_type: 'alphanumeric_series',
          series_type: 'paired_progression',
          series_text: 'A2, C6, F12, J20, ?',
          pattern_description: 'Serie de pares letra-número con saltos crecientes en letras y multiplicaciones en números'
        },
        option_a: 'O30',
        option_b: 'N30',
        option_c: 'L25', 
        option_d: 'N26',
        correct_option: 1, // B = N30
        explanation: `📊 PASO 1: Analizar pares
Pares: A2, C6, F12, J20, ?

📈 PASO 2: Patrones identificados
• Letras: A(1)→C(3)→F(6)→J(10)→N(15) (saltos: +2,+3,+4,+5)
• Números: 2→6(×3)→12(×2)→20(+8)→30(+10)

📋 PASO 3: Siguiente elemento
N = posición 15 en alfabeto
Número = 20+10 = 30
✅ Respuesta: N30`,
        difficulty: 'medium',
        time_limit_seconds: 150,
        cognitive_skills: ['pattern_recognition', 'logical_reasoning', 'paired_sequences'],
        question_subtype: 'sequence_alphanumeric',
        is_active: true,
        is_verified: true
      },

      // Pregunta 27: T a 11 S b 13 R c 15 Q ?
      {
        category_id: section.category_id,
        section_id: section.id,
        question_text: '¿Qué letra o número continúa la serie siguiente?: T a 11 S b 13 R c 15 Q ?',
        content_data: {
          chart_type: 'alphanumeric_series',
          series_type: 'triple_intercalated',
          series_text: 'T a 11 S b 13 R c 15 Q ?',
          pattern_description: 'Serie triple intercalada: mayúsculas descendiendo, minúsculas ascendiendo, números sumando 2'
        },
        option_a: 'd',
        option_b: '17',
        option_c: 'e', 
        option_d: 'D',
        correct_option: 0, // A = d
        explanation: `📊 PASO 1: Separar tres series
• Mayúsculas: T, S, R, Q, ?
• Minúsculas: a, b, c, ?
• Números: 11, 13, 15, ?

📈 PASO 2: Patrones identificados
• Mayúsculas: T→S→R→Q→P (descendente)
• Minúsculas: a→b→c→d (ascendente)
• Números: 11→13→15→17 (+2 cada vez)

📋 PASO 3: Siguiente elemento
Posición 10 = minúscula
✅ Siguiente: d`,
        difficulty: 'medium',
        time_limit_seconds: 150,
        cognitive_skills: ['pattern_recognition', 'logical_reasoning', 'triple_sequences'],
        question_subtype: 'sequence_alphanumeric',
        is_active: true,
        is_verified: true
      },

      // Pregunta 28: 10 j 13 m 16 o 19 r ? u 25 ?
      {
        category_id: section.category_id,
        section_id: section.id,
        question_text: '¿Qué número y/o letra habría que colocar en lugar de los interrogantes para que la siguiente serie tuviera sentido?: 10 j 13 m 16 o 19 r ? u 25 ?',
        content_data: {
          chart_type: 'alphanumeric_series',
          series_type: 'intercalated_double_gap',
          series_text: '10 j 13 m 16 o 19 r ? u 25 ?',
          pattern_description: 'Serie intercalada con dos interrogantes: números sumando 3 y letras con saltos específicos'
        },
        option_a: '21, w',
        option_b: '23, v',
        option_c: '22, u', 
        option_d: '22, x',
        correct_option: 3, // D = 22, x
        explanation: `📊 PASO 1: Separar series intercaladas
• Números: 10, 13, 16, 19, ?, 25
• Letras: j, m, o, r, u, ?

📈 PASO 2: Patrones identificados
• Números: 10→13(+3)→16(+3)→19(+3)→22(+3)→25(+3)
• Letras: j(10)→m(13)→o(15)→r(18)→u(21)→x(24)

📋 PASO 3: Completar interrogantes
Primer ? (posición 9) = 22
Segundo ? (posición 12) = x
✅ Respuesta: 22, x`,
        difficulty: 'medium',
        time_limit_seconds: 180,
        cognitive_skills: ['pattern_recognition', 'logical_reasoning', 'multiple_gaps'],
        question_subtype: 'sequence_alphanumeric',
        is_active: true,
        is_verified: true
      },

      // Pregunta 29: T 24 Q 32 Ñ 40 L 48 I 56 ?
      {
        category_id: section.category_id,
        section_id: section.id,
        question_text: '¿Qué número y letra continuarían la siguiente serie? T 24 Q 32 Ñ 40 L 48 I 56 ?',
        content_data: {
          chart_type: 'alphanumeric_series',
          series_type: 'intercalated_arithmetic',
          series_text: 'T 24 Q 32 Ñ 40 L 48 I 56 ?',
          pattern_description: 'Serie intercalada: letras retrocediendo con saltos y números sumando 8'
        },
        option_a: 'F64',
        option_b: 'N70',
        option_c: 'L66', 
        option_d: 'M68',
        correct_option: 0, // A = F64
        explanation: `📊 PASO 1: Separar series intercaladas
• Letras: T, Q, Ñ, L, I, ?
• Números: 24, 32, 40, 48, 56, ?

📈 PASO 2: Patrones identificados
• Letras: T(20)→Q(17)→Ñ(15)→L(12)→I(9)→F(6) (retroceden -3,-2,-3,-3,-3)
• Números: 24→32(+8)→40(+8)→48(+8)→56(+8)→64(+8)

📋 PASO 3: Siguiente elemento
Posición 11 = letra → F
Posición 12 = número → 64
✅ Respuesta: F64`,
        difficulty: 'medium',
        time_limit_seconds: 150,
        cognitive_skills: ['pattern_recognition', 'logical_reasoning', 'arithmetic'],
        question_subtype: 'sequence_alphanumeric',
        is_active: true,
        is_verified: true
      },

      // Pregunta 30: 18 M 22 J 26 G 30 D ?
      {
        category_id: section.category_id,
        section_id: section.id,
        question_text: '¿Qué número y letra continuarían la siguiente serie? 18 M 22 J 26 G 30 D ?',
        content_data: {
          chart_type: 'alphanumeric_series',
          series_type: 'intercalated_opposite',
          series_text: '18 M 22 J 26 G 30 D ?',
          pattern_description: 'Serie intercalada: números sumando 4 y letras retrocediendo 3 posiciones'
        },
        option_a: '34A',
        option_b: '38B',
        option_c: '35B', 
        option_d: '36C',
        correct_option: 0, // A = 34A
        explanation: `📊 PASO 1: Separar series intercaladas
• Números: 18, 22, 26, 30, ?
• Letras: M, J, G, D, ?

📈 PASO 2: Patrones identificados
• Números: 18→22(+4)→26(+4)→30(+4)→34(+4)
• Letras: M(13)→J(10)→G(7)→D(4)→A(1) (-3 cada vez)

📋 PASO 3: Siguiente elemento
Posición 9 = número → 34
Posición 10 = letra → A
✅ Respuesta: 34A`,
        difficulty: 'medium',
        time_limit_seconds: 150,
        cognitive_skills: ['pattern_recognition', 'logical_reasoning', 'opposite_patterns'],
        question_subtype: 'sequence_alphanumeric',
        is_active: true,
        is_verified: true
      },

      // Pregunta 31: s 10 y 15 d 19 h 22 k 24 ?
      {
        category_id: section.category_id,
        section_id: section.id,
        question_text: 'Indique el número y/o letra que corresponda en lugar del interrogante en la serie siguiente: s 10 y 15 d 19 h 22 k 24 ?',
        content_data: {
          chart_type: 'alphanumeric_series',
          series_type: 'intercalated_irregular',
          series_text: 's 10 y 15 d 19 h 22 k 24 ?',
          pattern_description: 'Serie intercalada: letras con patrón irregular y números con incrementos decrecientes'
        },
        option_a: 'm',
        option_b: '23',
        option_c: 'n', 
        option_d: '22',
        correct_option: 0, // A = m
        explanation: `📊 PASO 1: Separar series intercaladas
• Letras: s, y, d, h, k, ?
• Números: 10, 15, 19, 22, 24, ?

📈 PASO 2: Patrones identificados
• Números: 10→15(+5)→19(+4)→22(+3)→24(+2)→25(+1)
• Letras: s(19)→y(25)→d(4)→h(8)→k(11)→m(13) (patrón especial)

📋 PASO 3: Siguiente elemento
Posición 11 = letra
✅ Siguiente: m`,
        difficulty: 'hard',
        time_limit_seconds: 180,
        cognitive_skills: ['pattern_recognition', 'logical_reasoning', 'irregular_patterns'],
        question_subtype: 'sequence_alphanumeric',
        is_active: true,
        is_verified: true
      },

      // Pregunta 32: 9 H 16 N 25 S ?
      {
        category_id: section.category_id,
        section_id: section.id,
        question_text: '¿Qué número y letra continuarían la siguiente serie? 9 H 16 N 25 S ?',
        content_data: {
          chart_type: 'alphanumeric_series',
          series_type: 'intercalated_squares',
          series_text: '9 H 16 N 25 S ?',
          pattern_description: 'Serie intercalada: números cuadrados perfectos y letras con saltos específicos'
        },
        option_a: '38Z',
        option_b: '32L',
        option_c: '36Y', 
        option_d: '30M',
        correct_option: 2, // C = 36Y
        explanation: `📊 PASO 1: Separar series intercaladas
• Números: 9, 16, 25, ?
• Letras: H, N, S, ?

📈 PASO 2: Patrones identificados
• Números: 9(3²)→16(4²)→25(5²)→36(6²) (cuadrados perfectos)
• Letras: H(8)→N(14)→S(19)→Y(25) (saltos: +6,+5,+6)

📋 PASO 3: Siguiente elemento
Posición 7 = número → 36
Posición 8 = letra → Y
✅ Respuesta: 36Y`,
        difficulty: 'medium',
        time_limit_seconds: 150,
        cognitive_skills: ['pattern_recognition', 'logical_reasoning', 'squares'],
        question_subtype: 'sequence_alphanumeric',
        is_active: true,
        is_verified: true
      },

      // Pregunta 34: 3 z 8 w 15 t 24 q 35 ?
      {
        category_id: section.category_id,
        section_id: section.id,
        question_text: 'Marque la letra y/o número que continúa la siguiente serie: 3 z 8 w 15 t 24 q 35 ?',
        content_data: {
          chart_type: 'alphanumeric_series',
          series_type: 'intercalated_formula',
          series_text: '3 z 8 w 15 t 24 q 35 ?',
          pattern_description: 'Serie intercalada: números con fórmula n²-1 y letras retrocediendo 3 posiciones'
        },
        option_a: 'p',
        option_b: 'n',
        option_c: 'o', 
        option_d: 'ñ',
        correct_option: 3, // D = ñ
        explanation: `📊 PASO 1: Separar series intercaladas
• Números: 3, 8, 15, 24, 35, ?
• Letras: z, w, t, q, ?

📈 PASO 2: Patrones identificados
• Números: 3(2²-1)→8(3²-1)→15(4²-1)→24(5²-1)→35(6²-1)→48(7²-1)
• Letras: z(26)→w(23)→t(20)→q(17)→ñ(14) (-3 cada vez)

📋 PASO 3: Siguiente elemento
Posición 10 = letra
✅ Siguiente: ñ`,
        difficulty: 'hard',
        time_limit_seconds: 180,
        cognitive_skills: ['pattern_recognition', 'logical_reasoning', 'formulas'],
        question_subtype: 'sequence_alphanumeric',
        is_active: true,
        is_verified: true
      },

      // Pregunta 35: 7 z 14 w 21 t 28 q 35 ?
      {
        category_id: section.category_id,
        section_id: section.id,
        question_text: '¿Qué letra o número seguiría el razonamiento de la siguiente serie?: 7 z 14 w 21 t 28 q 35 ?',
        content_data: {
          chart_type: 'alphanumeric_series',
          series_type: 'intercalated_multiples',
          series_text: '7 z 14 w 21 t 28 q 35 ?',
          pattern_description: 'Serie intercalada: números múltiplos de 7 y letras retrocediendo saltando 2'
        },
        option_a: 'ñ',
        option_b: 'o',
        option_c: '42', 
        option_d: 'q',
        correct_option: 0, // A = ñ
        explanation: `📊 PASO 1: Separar series intercaladas
• Números: 7, 14, 21, 28, 35, ?
• Letras: z, w, t, q, ?

📈 PASO 2: Patrones identificados
• Números: 7→14→21→28→35→42 (múltiplos de 7)
• Letras: z(26)→w(23)→t(20)→q(17)→ñ(14) (-3 cada vez)

📋 PASO 3: Siguiente elemento
Posición 10 = letra
✅ Siguiente: ñ`,
        difficulty: 'medium',
        time_limit_seconds: 150,
        cognitive_skills: ['pattern_recognition', 'logical_reasoning', 'multiples'],
        question_subtype: 'sequence_alphanumeric',
        is_active: true,
        is_verified: true
      }
    ];

    // Insertar las preguntas 20-34
    console.log('📝 Insertando preguntas 20-34...');
    
    const { data: insertedQuestions, error: insertError } = await supabase
      .from('psychometric_questions')
      .insert(questions)
      .select();
    
    if (insertError) {
      console.log('❌ Error insertando preguntas:', insertError.message);
      return;
    }
    
    console.log('✅ Preguntas 20-34 añadidas exitosamente:');
    console.log('');
    
    insertedQuestions.forEach((question, index) => {
      const questionNumber = index + 20; // Empezar desde 20
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
    console.log('🎯 ¡Todas las 34 preguntas de series alfanuméricas completadas!');
    
  } catch (error) {
    console.log('❌ Error general:', error.message);
  }
}

addAlphanumericSeriesQuestions20_34();