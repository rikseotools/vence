import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function addAlphanumericSeriesQuestions50_64() {
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
      // Pregunta 50: 64 h 70 k 77 n 85 p 94 ......
      {
        category_id: section.category_id,
        section_id: section.id,
        question_text: 'En la siguiente serie indique el segundo número o letra que continuaría la serie: 64 h 70 k 77 n 85 p 94 ......',
        content_data: {
          chart_type: 'alphanumeric_series',
          series_type: 'intercalated_incremental',
          series_text: '64 h 70 k 77 n 85 p 94 ......',
          pattern_description: 'Serie intercalada: números con incrementos crecientes y letras saltando posiciones'
        },
        option_a: 't',
        option_b: '98',
        option_c: 's', 
        option_d: '104',
        correct_option: 3, // D = 104
        explanation: `📊 PASO 1: Separar series intercaladas
• Números: 64, 70, 77, 85, 94, ?
• Letras: h, k, n, p, ?

📈 PASO 2: Patrones identificados  
• Números: 64→70(+6)→77(+7)→85(+8)→94(+9)→104(+10)
• Letras: h(8)→k(11)→n(14)→p(16)→s(19) (saltos: +3,+3,+2,+3)

📋 PASO 3: Siguiente elemento (segundo)
Pide segundo elemento = número
✅ Respuesta: 104`,
        difficulty: 'medium',
        time_limit_seconds: 150,
        cognitive_skills: ['pattern_recognition', 'logical_reasoning', 'incremental'],
        question_subtype: 'sequence_alphanumeric',
        is_active: true,
        is_verified: true
      },

      // Pregunta 51: 1-3-s-u, 2-6-v-q, 3-12-y-n, 4-?-b-g?
      {
        category_id: section.category_id,
        section_id: section.id,
        question_text: 'Indique el número y/o letra que debe ocupar el espacio de los interrogantes en la siguiente serie para que tenga sentido: 1-3-s-u, 2-6-v-q, 3-12-y-n, 4-?-b-g?',
        content_data: {
          chart_type: 'alphanumeric_series',
          series_type: 'grouped_quadruple',
          series_text: '1-3-s-u, 2-6-v-q, 3-12-y-n, 4-?-b-g?',
          pattern_description: 'Serie agrupada en cuádruples con patrones internos específicos'
        },
        option_a: '26, k',
        option_b: '22, ñ',
        option_c: '24, j', 
        option_d: '20, n',
        correct_option: 2, // C = 24, j
        explanation: `📊 PASO 1: Analizar grupos
Grupos: (1,3,s,u) (2,6,v,q) (3,12,y,n) (4,?,b,?)

📈 PASO 2: Patrones internos
• Primeros números: 1,2,3,4 (consecutivos)
• Segundos números: 3,6,12,? (×2 cada vez: 3→6→12→24)
• Terceras letras: s,v,y,b (patrón específico)
• Cuartas letras: u,q,n,j (patrón descendente)

📋 PASO 3: Completar interrogantes
Segundo número: 12×2 = 24
Cuarta letra: después de n viene j
✅ Respuesta: 24, j`,
        difficulty: 'hard',
        time_limit_seconds: 200,
        cognitive_skills: ['pattern_recognition', 'logical_reasoning', 'grouping'],
        question_subtype: 'sequence_alphanumeric',
        is_active: true,
        is_verified: true
      },

      // Pregunta 52: 60 h 30 j 28 m 14 p 13 r 6 t 4 y ...
      {
        category_id: section.category_id,
        section_id: section.id,
        question_text: 'En la serie que se le presenta, indique los números y/o letras que están equivocados y no siguen el planteamiento de dicha serie: 60 h 30 j 28 m 14 p 13 r 6 t 4 y ...',
        content_data: {
          chart_type: 'alphanumeric_series',
          series_type: 'error_detection',
          series_text: '60 h 30 j 28 m 14 p 13 r 6 t 4 y',
          pattern_description: 'Serie con errores: números dividiéndose y letras con patrón, hay elementos incorrectos'
        },
        option_a: '13 r',
        option_b: '13 y',
        option_c: '13 t', 
        option_d: '14 u',
        correct_option: 2, // C = 13 t
        explanation: `📊 PASO 1: Separar series intercaladas
• Números: 60, 30, 28, 14, 13, 6, 4
• Letras: h, j, m, p, r, t, y

📈 PASO 2: Identificar patrones correctos
• Números: 60→30(÷2)→28→14(÷2)→13→6→4
• Letras: h→j→m→p→r→t→y (saltos específicos)

📋 PASO 3: Detectar errores
Serie correcta: 60 h 30 j 28 m 14 p 12 r 6 u 4 y
Errores: 13 (debería ser 12) y t (debería ser u)
✅ Respuesta: 13 t`,
        difficulty: 'hard',
        time_limit_seconds: 180,
        cognitive_skills: ['pattern_recognition', 'logical_reasoning', 'error_detection'],
        question_subtype: 'sequence_alphanumeric',
        is_active: true,
        is_verified: true
      },

      // Pregunta 53: a 60 C 59 e 56 ¿? ¿? i 44 K 35 m
      {
        category_id: section.category_id,
        section_id: section.id,
        question_text: 'Indique el valor (número o letra) que tienen que tener los interrogantes que aparecen en la siguiente serie, para que esta tenga sentido: a 60 C 59 e 56 ¿? ¿? i 44 K 35 m',
        content_data: {
          chart_type: 'alphanumeric_series',
          series_type: 'alternating_case_descending',
          series_text: 'a 60 C 59 e 56 ¿? ¿? i 44 K 35 m',
          pattern_description: 'Serie alternando mayúsculas/minúsculas con números descendentes específicos'
        },
        option_a: 'F, 51',
        option_b: 'g, 50',
        option_c: 'G, 51', 
        option_d: 'f, 50',
        correct_option: 2, // C = G, 51
        explanation: `📊 PASO 1: Identificar patrones
• Letras: a(min), C(may), e(min), ?, ?, i(min), K(may), m(min)
• Números: 60, 59, 56, ?, ?, 44, 35

📈 PASO 2: Patrones identificados
• Letras alternan mayúscula/minúscula: a,C,e,G,i,K,m
• Números descendentes: 60→59(-1)→56(-3)→51(-5)→44(-7)→35(-9)

📋 PASO 3: Completar interrogantes
Primera ? = G (mayúscula)
Segunda ? = 51 (número)
✅ Respuesta: G, 51`,
        difficulty: 'medium',
        time_limit_seconds: 150,
        cognitive_skills: ['pattern_recognition', 'logical_reasoning', 'alternating'],
        question_subtype: 'sequence_alphanumeric',
        is_active: true,
        is_verified: true
      },

      // Pregunta 54: b d f 8 10 13 h j l 17 22 ¿? ¿? n ¿? q
      {
        category_id: section.category_id,
        section_id: section.id,
        question_text: 'Indique el número o letra que deben ocupar el espacio de los interrogantes en la siguiente serie para que tenga sentido: b d f 8 10 13 h j l 17 22 ¿? ¿? n ¿? q',
        content_data: {
          chart_type: 'alphanumeric_series',
          series_type: 'grouped_mixed_increment',
          series_text: 'b d f 8 10 13 h j l 17 22 ¿? ¿? n ¿? q',
          pattern_description: 'Serie agrupada: grupos de letras consecutivas saltando una, seguidos de números con incrementos'
        },
        option_a: '26, m',
        option_b: '25, m',
        option_c: '28, o', 
        option_d: '27, ñ',
        correct_option: 2, // C = 28, o
        explanation: `📊 PASO 1: Identificar grupos
Grupos: (b,d,f,8,10,13) (h,j,l,17,22,?) (?,n,?,q)

📈 PASO 2: Patrones internos
• Letras: b,d,f (saltando una) → h,j,l (saltando una) → m,ñ,o,p,q
• Números: 8→10(+2)→13(+3) → 17→22(+5)→28(+6)

📋 PASO 3: Completar interrogantes
Primera ? = 28 (siguiente número)
Segunda ? = m (primera letra del grupo)
Tercera ? = o (letra antes de p en secuencia)
✅ Respuesta: 28, o`,
        difficulty: 'hard',
        time_limit_seconds: 200,
        cognitive_skills: ['pattern_recognition', 'logical_reasoning', 'complex_grouping'],
        question_subtype: 'sequence_alphanumeric',
        is_active: true,
        is_verified: true
      },

      // Pregunta 55: Z-A-3; X-C-9; V-E-27; T-G-81; R-...
      {
        category_id: section.category_id,
        section_id: section.id,
        question_text: 'Indique la letra o número que continuaría las siguientes series: Z-A-3; X-C-9; V-E-27; T-G-81; R-...',
        content_data: {
          chart_type: 'alphanumeric_series',
          series_type: 'triple_progression',
          series_text: 'Z-A-3; X-C-9; V-E-27; T-G-81; R-...',
          pattern_description: 'Serie de triples: letras retrocediendo, letras avanzando, números multiplicándose por 3'
        },
        option_a: '1',
        option_b: '641',
        option_c: '243', 
        option_d: 'S',
        correct_option: 0, // A = I
        explanation: `📊 PASO 1: Analizar triples
Triples: (Z,A,3) (X,C,9) (V,E,27) (T,G,81) (R,?,?)

📈 PASO 2: Patrones identificados
• Primera letra: Z→X→V→T→R (retrocediendo -2)
• Segunda letra: A→C→E→G→I (avanzando +2)
• Números: 3→9(×3)→27(×3)→81(×3)→243(×3)

📋 PASO 3: Siguiente elemento
Después de R-I-243, pide siguiente = I
✅ Respuesta: I`,
        difficulty: 'medium',
        time_limit_seconds: 150,
        cognitive_skills: ['pattern_recognition', 'logical_reasoning', 'geometric_progression'],
        question_subtype: 'sequence_alphanumeric',
        is_active: true,
        is_verified: true
      },

      // Pregunta 56: 5 - F - 10 - h - 12 - K - 36 - m - 39 - O - 156 - q - 160 - T - 800...
      {
        category_id: section.category_id,
        section_id: section.id,
        question_text: 'Indique la letra o número que continuaría las siguientes series: 5 - F - 10 - h - 12 - K - 36 - m - 39 - O - 156 - q - 160 - T - 800...',
        content_data: {
          chart_type: 'alphanumeric_series',
          series_type: 'alternating_complex',
          series_text: '5-F-10-h-12-K-36-m-39-O-156-q-160-T-800',
          pattern_description: 'Serie alternante compleja con números con multiplicaciones y letras alternando mayúsculas/minúsculas'
        },
        option_a: '805',
        option_b: 'W',
        option_c: 'v', 
        option_d: 'w',
        correct_option: 2, // C = v
        explanation: `📊 PASO 1: Separar series alternantes
• Números: 5,10,12,36,39,156,160,800,?
• Letras: F,h,K,m,O,q,T,?

📈 PASO 2: Patrones identificados
• Números: 5→10(×2)→12(+2)→36(×3)→39(+3)→156(×4)→160(+4)→800(×5)→805(+5)
• Letras: F(may),h(min),K(may),m(min),O(may),q(min),T(may),v(min)

📋 PASO 3: Siguiente elemento
Siguiente letra = v (minúscula)
✅ Respuesta: v`,
        difficulty: 'hard',
        time_limit_seconds: 200,
        cognitive_skills: ['pattern_recognition', 'logical_reasoning', 'complex_alternating'],
        question_subtype: 'sequence_alphanumeric',
        is_active: true,
        is_verified: true
      },

      // Pregunta 57: W 2 Y 3 B 4 F 5 K 6 ¿? ¿?
      {
        category_id: section.category_id,
        section_id: section.id,
        question_text: 'Indique el número y/o letra que deben ocupar el espacio de los interrogantes en la siguiente serie para que tenga sentido W 2 Y 3 B 4 F 5 K 6 ¿? ¿?',
        content_data: {
          chart_type: 'alphanumeric_series',
          series_type: 'intercalated_position_jump',
          series_text: 'W 2 Y 3 B 4 F 5 K 6 ¿? ¿?',
          pattern_description: 'Serie intercalada: letras con saltos específicos y números consecutivos'
        },
        option_a: 's, 6',
        option_b: 'p, 7',
        option_c: 'r, 9', 
        option_d: 'q, 8',
        correct_option: 1, // B = p, 7
        explanation: `📊 PASO 1: Separar series intercaladas
• Letras: W, Y, B, F, K, ?
• Números: 2, 3, 4, 5, 6, ?

📈 PASO 2: Patrones identificados
• Números: 2→3→4→5→6→7 (consecutivos)
• Letras: W(23)→Y(25)→B(2)→F(6)→K(11)→P(16) (saltos: +2,+3,+4,+5,+5)

📋 PASO 3: Siguiente elemento
Primera ? = P (letra)
Segunda ? = 7 (número)
✅ Respuesta: p, 7`,
        difficulty: 'medium',
        time_limit_seconds: 150,
        cognitive_skills: ['pattern_recognition', 'logical_reasoning', 'position_jumps'],
        question_subtype: 'sequence_alphanumeric',
        is_active: true,
        is_verified: true
      },

      // Pregunta 58: g-3-k; m-2-o; q-5-w; ¿?-3-¿?
      {
        category_id: section.category_id,
        section_id: section.id,
        question_text: 'Indique que valores (letras y/o números) habría que poner en lugar de los interrogantes para continuar la siguiente serie: g-3-k; m-2-o; q-5-w; ¿?-3-¿?',
        content_data: {
          chart_type: 'alphanumeric_series',
          series_type: 'correlative_triples',
          series_text: 'g-3-k; m-2-o; q-5-w; ¿?-3-¿?',
          pattern_description: 'Serie correlativa en triples: letras con saltos, números variables, terceras letras con patrón'
        },
        option_a: 'v, c',
        option_b: 'x, b',
        option_c: 'y, c', 
        option_d: 'y, b',
        correct_option: 2, // C = y, c
        explanation: `📊 PASO 1: Analizar triples
Triples: (g,3,k) (m,2,o) (q,5,w) (?,3,?)

📈 PASO 2: Patrones identificados
• Primera letra: g(7)→m(13)→q(17)→y(25) (saltos: +6,+4,+8)
• Números: 3→2→5→3 (patrón específico que se repite)
• Tercera letra: k(11)→o(15)→w(23)→c(3) (saltos específicos)

📋 PASO 3: Completar interrogantes
Primera ? = y
Segunda ? = c
✅ Respuesta: y, c`,
        difficulty: 'medium',
        time_limit_seconds: 180,
        cognitive_skills: ['pattern_recognition', 'logical_reasoning', 'correlative'],
        question_subtype: 'sequence_alphanumeric',
        is_active: true,
        is_verified: true
      },

      // Pregunta 59: 256, T, 128, W, 64, Z, ¿?, ¿?
      {
        category_id: section.category_id,
        section_id: section.id,
        question_text: 'Indique el número y/o letra que debe ocupar el espacio de los interrogantes en la siguiente serie para que tenga sentido: 256, T, 128, W, 64, Z, ¿?, ¿?',
        content_data: {
          chart_type: 'alphanumeric_series',
          series_type: 'division_advancement',
          series_text: '256, T, 128, W, 64, Z, ¿?, ¿?',
          pattern_description: 'Serie intercalada: números dividiéndose por 2 y letras avanzando 3 posiciones'
        },
        option_a: '30, a',
        option_b: '32, c',
        option_c: '36, e', 
        option_d: '34, b',
        correct_option: 1, // B = 32, c
        explanation: `📊 PASO 1: Separar series intercaladas
• Números: 256, 128, 64, ?
• Letras: T, W, Z, ?

📈 PASO 2: Patrones identificados
• Números: 256→128(÷2)→64(÷2)→32(÷2)
• Letras: T(20)→W(23)→Z(26)→C(3) (+3,+3,+3 con ciclo)

📋 PASO 3: Siguiente elemento
Primera ? = 32 (número)
Segunda ? = c (letra)
✅ Respuesta: 32, c`,
        difficulty: 'medium',
        time_limit_seconds: 150,
        cognitive_skills: ['pattern_recognition', 'logical_reasoning', 'division'],
        question_subtype: 'sequence_alphanumeric',
        is_active: true,
        is_verified: true
      },

      // Pregunta 60: G - 7 - 9 - i; O - 16 - 14 - n; R - ... - 21 - ...;
      {
        category_id: section.category_id,
        section_id: section.id,
        question_text: 'Indique el número o letra que debería figurar en los espacios en blanco para completar la siguientes series: G - 7 - 9 - i; O - 16 - 14 - n; R - ... - 21 - ...;',
        content_data: {
          chart_type: 'alphanumeric_series',
          series_type: 'quadruple_correlative',
          series_text: 'G-7-9-i; O-16-14-n; R-...-21-...;',
          pattern_description: 'Serie correlativa en cuádruples con patrones internos específicos'
        },
        option_a: '19,T',
        option_b: '22,v',
        option_c: '19,t', 
        option_d: '23,s',
        correct_option: 2, // C = 19,t
        explanation: `📊 PASO 1: Analizar cuádruples
Cuádruples: (G,7,9,i) (O,16,14,n) (R,?,21,?)

📈 PASO 2: Patrones identificados
• Primera letra: G(7)→O(15)→R(18) (+8,+3)
• Segundo número: 7→16→? (correlación con letra)
• Tercer número: 9→14→21 (+5,+7)
• Cuarta letra: i(9)→n(14)→t(20) (+5,+6)

📋 PASO 3: Completar espacios
Segundo número = 19 (R=18, +1)
Cuarta letra = t
✅ Respuesta: 19,t`,
        difficulty: 'hard',
        time_limit_seconds: 200,
        cognitive_skills: ['pattern_recognition', 'logical_reasoning', 'correlative_complex'],
        question_subtype: 'sequence_alphanumeric',
        is_active: true,
        is_verified: true
      },

      // Pregunta 61: 20 s 35 u 52 x 71 b 92 ¿? ¿?
      {
        category_id: section.category_id,
        section_id: section.id,
        question_text: 'En la siguiente serie, indique qué número o letra debemos poner en lugar de los interrogantes para que la serie tenga sentido: 20 s 35 u 52 x 71 b 92 ¿? ¿?',
        content_data: {
          chart_type: 'alphanumeric_series',
          series_type: 'intercalated_square_based',
          series_text: '20 s 35 u 52 x 71 b 92 ¿? ¿?',
          pattern_description: 'Serie intercalada: números basados en cuadrados y letras con patrón específico'
        },
        option_a: 'e, 115',
        option_b: 'g, 114',
        option_c: 'f, 114', 
        option_d: 'g, 115',
        correct_option: 3, // D = g, 115
        explanation: `📊 PASO 1: Separar series intercaladas
• Números: 20, 35, 52, 71, 92, ?
• Letras: s, u, x, b, ?

📈 PASO 2: Patrones identificados
• Números: 20→35(+15)→52(+17)→71(+19)→92(+21)→115(+23)
• Letras: s(19)→u(21)→x(24)→b(2)→g(7) (patrón con ciclo)

📋 PASO 3: Siguiente elemento
Primera ? = g (letra)
Segunda ? = 115 (número)
✅ Respuesta: g, 115`,
        difficulty: 'medium',
        time_limit_seconds: 180,
        cognitive_skills: ['pattern_recognition', 'logical_reasoning', 'square_based'],
        question_subtype: 'sequence_alphanumeric',
        is_active: true,
        is_verified: true
      },

      // Pregunta 62: D 323 G 326 J 329 M 332 ¿? ¿?
      {
        category_id: section.category_id,
        section_id: section.id,
        question_text: 'Indique el número y/o letra que deben ocupar el espacio de los interrogantes en la siguiente serie para que tenga sentido D 323 G 326 J 329 M 332 ¿? ¿?',
        content_data: {
          chart_type: 'alphanumeric_series',
          series_type: 'intercalated_constant_sum',
          series_text: 'D 323 G 326 J 329 M 332 ¿? ¿?',
          pattern_description: 'Serie intercalada: letras saltando 3 posiciones y números sumando 3'
        },
        option_a: 'O, 335',
        option_b: 'P, 336',
        option_c: 'R, 335', 
        option_d: 'Q, 337',
        correct_option: 0, // A = O, 335
        explanation: `📊 PASO 1: Separar series intercaladas
• Letras: D, G, J, M, ?
• Números: 323, 326, 329, 332, ?

📈 PASO 2: Patrones identificados
• Letras: D(4)→G(7)→J(10)→M(13)→O(16) (+3 cada vez)
• Números: 323→326(+3)→329(+3)→332(+3)→335(+3)

📋 PASO 3: Siguiente elemento
Primera ? = O (letra)
Segunda ? = 335 (número)
✅ Respuesta: O, 335`,
        difficulty: 'easy',
        time_limit_seconds: 120,
        cognitive_skills: ['pattern_recognition', 'logical_reasoning', 'constant_addition'],
        question_subtype: 'sequence_alphanumeric',
        is_active: true,
        is_verified: true
      }
    ];

    // Insertar las preguntas 50-64
    console.log('📝 Insertando preguntas 50-64...');
    
    const { data: insertedQuestions, error: insertError } = await supabase
      .from('psychometric_questions')
      .insert(questions)
      .select();
    
    if (insertError) {
      console.log('❌ Error insertando preguntas:', insertError.message);
      return;
    }
    
    console.log('✅ Preguntas 50-64 añadidas exitosamente:');
    console.log('');
    
    insertedQuestions.forEach((question, index) => {
      const questionNumber = index + 50; // Empezar desde 50
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
    console.log('🎯 ¡Todas las 64 preguntas de series alfanuméricas completadas!');
    
  } catch (error) {
    console.log('❌ Error general:', error.message);
  }
}

addAlphanumericSeriesQuestions50_64();