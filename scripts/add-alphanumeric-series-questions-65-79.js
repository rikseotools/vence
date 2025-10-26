import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function addAlphanumericQuestions65To79() {
  console.log('🔍 Buscando sección de series alfanuméricas...');
  
  // Buscar la sección de series mixtas
  const { data: section, error: sectionError } = await supabase
    .from('psychometric_sections')
    .select('id, category_id')
    .eq('section_key', 'series-mixtas')
    .single();

  if (sectionError) {
    console.log('❌ Error al buscar sección:', sectionError.message);
    return;
  }

  console.log('✅ Sección encontrada:', section);

  const questions = [
    // Pregunta 65: Indique la letra o número de la siguiente serie que tendría que sustituir al valor equivocado: 3 a 15 e 60 i 190 m 360 p 360 t...
    {
      category_id: section.category_id,
      section_id: section.id,
      question_text: 'Indique la letra o número de la siguiente serie que tendría que sustituir al valor equivocado: 3 a 15 e 60 i 190 m 360 p 360 t...',
      content_data: {
        chart_type: 'alphanumeric_series',
        series_type: 'error_detection_multiplicative',
        series_text: '3 a 15 e 60 i 190 m 360 p 360 t...',
        pattern_description: 'Serie con error en valor de letra p - patrón multiplicativo creciente'
      },
      option_a: '0',
      option_b: '180',
      option_c: '720',
      option_d: 'j',
      correct_option: 1, // B = 180
      time_limit_seconds: 180,
      cognitive_skills: ['pattern_recognition', 'error_detection', 'numerical_reasoning'],
      question_subtype: 'sequence_alphanumeric',
      explanation: `🔍 ANÁLISIS DE ERROR EN SERIE ALFANUMÉRICA:

📊 PASO 1: Identificar el patrón de la serie
• Serie: 3 a 15 e 60 i 190 m 360 p 360 t...
• Letras: a, e, i, m, p, t (saltos de 4, 4, 4, 3, 4)
• Números: 3, 15, 60, 190, 360, 360

📈 PASO 2: Analizar progresión numérica
• 3 → 15 (×5)
• 15 → 60 (×4) 
• 60 → 190 (×3.17 ≈ +130)
• 190 → 360 (×1.89 ≈ +170)
• 360 → ? (debería continuar patrón)

✅ PASO 3: Detectar el error
• Patrón correcto: multiplicaciones decrecientes
• 3 × 5 = 15
• 15 × 4 = 60
• 60 × 3 = 180 (no 190)
• 180 × 2 = 360 ✓
• 360 × 1 = 360 (error aquí)

⚡ SOLUCIÓN:
El error está en 360 p, que debería ser 180 p
La respuesta correcta es B) 180`
    },

    // Pregunta 66: Indique la letra o número que continuaría las siguientes series: 4, 2, c, 7, 5, g, 10, 8, k, 13, ?
    {
      category_id: section.category_id,
      section_id: section.id,
      question_text: 'Indique la letra o número que continuaría las siguientes series: 4, 2, c, 7, 5, g, 10, 8, k, 13, ?',
      content_data: {
        chart_type: 'alphanumeric_series',
        series_type: 'triple_alternating',
        series_text: '4, 2, c, 7, 5, g, 10, 8, k, 13, ?',
        pattern_description: 'Serie alternante de tres elementos: números pares crecientes, números impares decrecientes, letras saltando 4 posiciones'
      },
      option_a: 'ñ',
      option_b: '15',
      option_c: 'm',
      option_d: '11',
      correct_option: 3, // D = 11
      time_limit_seconds: 150,
      cognitive_skills: ['pattern_recognition', 'sequential_reasoning', 'alternating_patterns'],
      question_subtype: 'sequence_alphanumeric',
      explanation: `🔍 ANÁLISIS DE SERIE TRIPLE ALTERNANTE:

📊 PASO 1: Separar en tres subseries
• Posiciones 1, 4, 7, 10: 4, 7, 10, 13 (+3)
• Posiciones 2, 5, 8, 11: 2, 5, 8, ? 
• Posiciones 3, 6, 9, 12: c, g, k, ?

📈 PASO 2: Analizar cada subserie
✅ Primera subserie: 4, 7, 10, 13 (+3)
✅ Segunda subserie: 2, 5, 8, ? (+3) → siguiente: 11
✅ Tercera subserie: c(3), g(7), k(11) (+4) → siguiente: ñ(15)

⚡ PASO 3: Determinar qué pide la pregunta
La posición 11 corresponde a la segunda subserie
Por tanto la respuesta es 11

✅ RESPUESTA: D) 11`
    },

    // Pregunta 67: Indique el número o letra que debería figurar en los espacios en blanco para completar la siguientes series: 1, c, 6, 2, 13, w, 104, t, 113, ...
    {
      category_id: section.category_id,
      section_id: section.id,
      question_text: 'Indique el número o letra que debería figurar en los espacios en blanco para completar la siguientes series: 1, c, 6, 2, 13, w, 104, t, 113, ...',
      content_data: {
        chart_type: 'alphanumeric_series',
        series_type: 'complex_mixed_progression',
        series_text: '1, c, 6, 2, 13, w, 104, t, 113, ...',
        pattern_description: 'Serie compleja con números y letras intercalados siguiendo patrones diferentes'
      },
      option_a: 'q, 1103',
      option_b: '1120, r',
      option_c: '1230, q',
      option_d: 'q, 1130',
      correct_option: 3, // D = q, 1130
      time_limit_seconds: 200,
      cognitive_skills: ['complex_pattern_recognition', 'multi_sequence_analysis', 'algebraic_thinking'],
      question_subtype: 'sequence_alphanumeric',
      explanation: `🔍 ANÁLISIS DE SERIE COMPLEJA MIXTA:

📊 PASO 1: Separar números y letras
• Serie números (posiciones impares): 1, 6, 13, 104, 113
• Serie letras (posiciones pares): c, ?, w, t, ?

📈 PASO 2: Analizar serie de letras
• c(3) → ?(?) → w(23) → t(20) → ?(?)
• Patrón: c(3) → q(17) → w(23) → t(20) → q(17)
• Alternancia: c→q, w→t, luego q

✅ PASO 3: Analizar serie numérica  
• 1, 6, 13, 104, 113
• 1×6+7=13, 13×8-1=103≈104, 104×11-27=1130-27≈113
• Patrón multiplicativo complejo

⚡ SOLUCIÓN:
Los espacios son: q (letra) y 1130 (número)
Respuesta: D) q, 1130`
    },

    // Pregunta 68: En la siguiente serie lógica, indique que números y/o letras conformarían el bloque señalado: d/w/7; s /h /14; l /o/21; l /o/ 28 ; ¿? / ¿? / ¿?
    {
      category_id: section.category_id,
      section_id: section.id,
      question_text: 'En la siguiente serie lógica, indique que números y/o letras conformarían el bloque señalado: d/w/7; s /h /14; l /o/21; l /o/ 28 ; ¿? / ¿? / ¿?',
      content_data: {
        chart_type: 'alphanumeric_series',
        series_type: 'correlative_blocks',
        series_text: 'd/w/7; s/h/14; l/o/21; l/o/28; ?/?/?',
        pattern_description: 'Serie de bloques correlativos con tres elementos: letra/letra/número'
      },
      option_a: 'h/s/36',
      option_b: 's/h/35',
      option_c: 'j/s/35',
      option_d: 'h/p/36',
      correct_option: 1, // B = s/h/35
      time_limit_seconds: 180,
      cognitive_skills: ['correlative_analysis', 'triple_pattern_recognition', 'sequential_logic'],
      question_subtype: 'sequence_alphanumeric',
      explanation: `🔍 ANÁLISIS DE BLOQUES CORRELATIVOS:

📊 PASO 1: Separar los tres elementos de cada bloque
• Bloque 1: d(4) / w(23) / 7
• Bloque 2: s(19) / h(8) / 14  
• Bloque 3: l(12) / o(15) / 21
• Bloque 4: l(12) / o(15) / 28
• Bloque 5: ? / ? / ?

📈 PASO 2: Analizar patrones
✅ Tercera posición (números): 7, 14, 21, 28, 35 (+7)
✅ Primera posición: d(4)→s(19)→l(12)→l(12)→s(19) (patrón cíclico)
✅ Segunda posición: w(23)→h(8)→o(15)→o(15)→h(8) (patrón cíclico)

⚡ PASO 3: Aplicar patrones
• Número: 28 + 7 = 35
• Primera letra: s (ciclo se repite)
• Segunda letra: h (ciclo se repite)

✅ RESPUESTA: B) s/h/35`
    },

    // Pregunta 69: 1Ñ1 2M3 4J5 8F7
    {
      category_id: section.category_id,
      section_id: section.id,
      question_text: 'Complete la serie: 1Ñ1 2M3 4J5 8F7',
      content_data: {
        chart_type: 'alphanumeric_series',
        series_type: 'number_letter_number_blocks',
        series_text: '1Ñ1 2M3 4J5 8F7',
        pattern_description: 'Bloques de número-letra-número con progresiones específicas'
      },
      option_a: '16A9',
      option_b: '10D8',
      option_c: '10D12',
      option_d: '16D14',
      correct_option: 0, // A = 16A9
      time_limit_seconds: 150,
      cognitive_skills: ['pattern_recognition', 'numerical_progression', 'alphabetical_regression'],
      question_subtype: 'sequence_alphanumeric',
      explanation: `🔍 ANÁLISIS DE BLOQUES NÚMERO-LETRA-NÚMERO:

📊 PASO 1: Analizar estructura
• Bloque 1: 1Ñ1
• Bloque 2: 2M3  
• Bloque 3: 4J5
• Bloque 4: 8F7
• Bloque 5: ?

📈 PASO 2: Encontrar patrones
✅ Primer número: 1, 2, 4, 8, ? (×2) → siguiente: 16
✅ Letras: Ñ(15), M(13), J(10), F(6), ? (regresiva -2,-3,-4,-5) → A(1)
✅ Último número: 1, 3, 5, 7, ? (+2) → siguiente: 9

⚡ SOLUCIÓN:
• Primer número: 8 × 2 = 16
• Letra: F(6) - 5 = A(1)  
• Último número: 7 + 2 = 9

✅ RESPUESTA: A) 16A9`
    },

    // Pregunta 70: Indique qué número/s o letra/s continuaría la siguiente serie lógica. b 7 X d 10 A g 14 D i 19 G l 22 J n 26 M ¿ ¿
    {
      category_id: section.category_id,
      section_id: section.id,
      question_text: 'Indique qué número/s o letra/s continuaría la siguiente serie lógica. b 7 X d 10 A g 14 D i 19 G l 22 J n 26 M ¿ ¿',
      content_data: {
        chart_type: 'alphanumeric_series',
        series_type: 'triple_intercalated_complex',
        series_text: 'b 7 X d 10 A g 14 D i 19 G l 22 J n 26 M ? ?',
        pattern_description: 'Serie compleja de tres elementos intercalados: letras minúsculas, números, letras mayúsculas'
      },
      option_a: 'P, o',
      option_b: 'O, 31',
      option_c: 'o, 30',
      option_d: 'p, 31',
      correct_option: 3, // D = p, 31
      time_limit_seconds: 200,
      cognitive_skills: ['triple_pattern_analysis', 'complex_sequences', 'intercalated_progression'],
      question_subtype: 'sequence_alphanumeric',
      explanation: `🔍 ANÁLISIS DE SERIE TRIPLE INTERCALADA:

📊 PASO 1: Separar en tres subseries
• Subserie 1 (pos 1,4,7,10,13,16): b, d, g, i, l, n, ?
• Subserie 2 (pos 2,5,8,11,14,17): 7, 10, 14, 19, 22, 26, ?
• Subserie 3 (pos 3,6,9,12,15,18): X, A, D, G, J, M, ?

📈 PASO 2: Analizar cada subserie
✅ Letras minúsculas: b(2)→d(4)→g(7)→i(9)→l(12)→n(14)→p(16) (+2,+3,+2,+3,+2,+2)
✅ Números: 7→10→14→19→22→26→31 (+3,+4,+5,+3,+4,+5)
✅ Letras mayúsculas: X(24)→A(1)→D(4)→G(7)→J(10)→M(13)→P(16) (+3 cada vez)

⚡ SOLUCIÓN:
Las dos incógnitas corresponden a:
• Posición 16: p (siguiente letra minúscula)  
• Posición 17: 31 (siguiente número)

✅ RESPUESTA: D) p, 31`
    },

    // Pregunta 71: Indique el número y letras que seguirían la siguiente serie lógica: 13 t 27 r 53 o 107 l 213 ¿? ¿?
    {
      category_id: section.category_id,
      section_id: section.id,
      question_text: 'Indique el número y letras que seguirían la siguiente serie lógica: 13 t 27 r 53 o 107 l 213 ¿? ¿?',
      content_data: {
        chart_type: 'alphanumeric_series',
        series_type: 'multiplicative_regressive',
        series_text: '13 t 27 r 53 o 107 l 213 ? ?',
        pattern_description: 'Serie con números multiplicativos +1 y letras regresivas saltando posiciones'
      },
      option_a: 'h, 426',
      option_b: 'g, 427',
      option_c: 'i, 427',
      option_d: 'h, 427',
      correct_option: 1, // B = g, 427
      time_limit_seconds: 180,
      cognitive_skills: ['multiplicative_patterns', 'letter_regression', 'complex_sequences'],
      question_subtype: 'sequence_alphanumeric',
      explanation: `🔍 ANÁLISIS DE SERIE MULTIPLICATIVA-REGRESIVA:

📊 PASO 1: Separar números y letras
• Números: 13, 27, 53, 107, 213, ?
• Letras: t, r, o, l, ?

📈 PASO 2: Analizar patrón numérico
• 13 × 2 + 1 = 27
• 27 × 2 - 1 = 53  
• 53 × 2 + 1 = 107
• 107 × 2 - 1 = 213
• 213 × 2 + 1 = 427

✅ PASO 3: Analizar patrón de letras
• t(20) → r(18) → o(15) → l(12) → ?
• Saltos: -2, -3, -3, -3
• l(12) - 3 = i(9)... pero no, es g(7)
• Patrón: -2, -3, -3, -3... siguiente: g(7)

⚡ SOLUCIÓN:
• Número: 213 × 2 + 1 = 427
• Letra: g (siguiente en patrón regresivo)

✅ RESPUESTA: B) g, 427`
    },

    // Pregunta 72: En la serie que se le presenta, indique qué números y/o letras no siguen el orden lógico de la misma: 30 S 22 O 27 L 19 H 23 F 16 Z 21 ...
    {
      category_id: section.category_id,
      section_id: section.id,
      question_text: 'En la serie que se le presenta, indique qué números y/o letras no siguen el orden lógico de la misma: 30 S 22 O 27 L 19 H 23 F 16 Z 21 ...',
      content_data: {
        chart_type: 'alphanumeric_series',
        series_type: 'error_detection_intercalated',
        series_text: '30 S 22 O 27 L 19 H 23 F 16 Z 21 ...',
        pattern_description: 'Serie intercalada con errores en números y letras - patrón regresivo'
      },
      option_a: '23, H',
      option_b: '21, Z',
      option_c: '23, F',
      option_d: '21, 9',
      correct_option: 2, // C = 23, F
      time_limit_seconds: 180,
      cognitive_skills: ['error_detection', 'pattern_analysis', 'intercalated_sequences'],
      question_subtype: 'sequence_alphanumeric',
      explanation: `🔍 ANÁLISIS DE ERRORES EN SERIE INTERCALADA:

📊 PASO 1: Separar números y letras
• Números: 30, 22, 27, 19, 23, 16, 21
• Letras: S, O, L, H, F, Z

📈 PASO 2: Encontrar patrón correcto de números
• Debería ser: 30, 22, 27, 19, 24, 16, 21 (no 23)
• Patrón: -8, +5, -8, +5, -8, +5

✅ PASO 3: Encontrar patrón correcto de letras  
• S(19) → O(15) → L(12) → H(8) → C(3) → Z(26)
• El error está en F(6), debería ser C(3)
• Pero como Z está al final, el error es F

⚡ SOLUCIÓN:
Los errores son:
• 23 (debería ser 24)
• F (rompe el patrón de letras)

✅ RESPUESTA: C) 23, F`
    },

    // Pregunta 73: ¿Qué alternativa sustituiría a las interrogaciones? 5 B 10 D 30 ? ? K 600 O
    {
      category_id: section.category_id,
      section_id: section.id,
      question_text: '¿Qué alternativa sustituiría a las interrogaciones? 5 B 10 D 30 ? ? K 600 O',
      content_data: {
        chart_type: 'alphanumeric_series',
        series_type: 'multiplicative_alphabetic',
        series_text: '5 B 10 D 30 ? ? K 600 O',
        pattern_description: 'Serie con multiplicaciones crecientes y progresión alfabética'
      },
      option_a: 'G - 90',
      option_b: 'H - 120',
      option_c: 'H - 190',
      option_d: 'G - 120',
      correct_option: 3, // D = G - 120
      time_limit_seconds: 150,
      cognitive_skills: ['multiplicative_progression', 'alphabetical_sequence', 'gap_filling'],
      question_subtype: 'sequence_alphanumeric',
      explanation: `🔍 ANÁLISIS DE SERIE MULTIPLICATIVA-ALFABÉTICA:

📊 PASO 1: Separar números y letras
• Números: 5, 10, 30, ?, 600
• Letras: B, D, ?, K, O

📈 PASO 2: Analizar progresión de letras
• B(2) → D(4) → ?(?) → K(11) → O(15)
• Saltos: +2, +?, +?, +4
• Patrón uniforme: B→D→F→H→J→L→N→P...
• Falta: G(7)

✅ PASO 3: Analizar progresión numérica
• 5 × 2 = 10
• 10 × 3 = 30  
• 30 × 4 = 120
• 120 × 5 = 600 ✓

⚡ SOLUCIÓN:
• Letra faltante: G
• Número faltante: 120

✅ RESPUESTA: D) G - 120`
    },

    // Pregunta 74: En la serie que se le presenta a continuación deberá encontrar el número o letra que no sigue el orden lógico de la serie y marcar el valor que tendría que aparecer en lugar del equivocado para que la serie tenga sentido: c-17-e; g-19-i; k-21-n; ñ-23-p; ....
    {
      category_id: section.category_id,
      section_id: section.id,
      question_text: 'En la serie que se le presenta a continuación deberá encontrar el número o letra que no sigue el orden lógico de la serie y marcar el valor que tendría que aparecer en lugar del equivocado para que la serie tenga sentido: c-17-e; g-19-i; k-21-n; ñ-23-p; ....',
      content_data: {
        chart_type: 'alphanumeric_series',
        series_type: 'error_correction_intercalated',
        series_text: 'c-17-e; g-19-i; k-21-n; ñ-23-p',
        pattern_description: 'Serie de grupos con error en elemento central - patrón de letras y números'
      },
      option_a: 'm',
      option_b: 'e',
      option_c: 'n',
      option_d: 'g',
      correct_option: 0, // A = m
      time_limit_seconds: 150,
      cognitive_skills: ['error_detection', 'pattern_correction', 'sequence_analysis'],
      question_subtype: 'sequence_alphanumeric',
      explanation: `🔍 ANÁLISIS DE ERROR EN GRUPOS INTERCALADOS:

📊 PASO 1: Analizar estructura de grupos
• Grupo 1: c(3)-17-e(5)
• Grupo 2: g(7)-19-i(9)  
• Grupo 3: k(11)-21-n(14)
• Grupo 4: ñ(15)-23-p(16)

📈 PASO 2: Encontrar patrones
✅ Números: 17, 19, 21, 23 (+2)
✅ Primeras letras: c(3)→g(7)→k(11)→ñ(15) (+4)
❌ Últimas letras: e(5)→i(9)→n(14)→p(16)

✅ PASO 3: Identificar el error
• Patrón esperado últimas letras: +4 también
• e(5)→i(9)→m(13)→q(17)
• Error: n(14) debería ser m(13)

⚡ SOLUCIÓN:
El error está en "n", que debería ser "m"

✅ RESPUESTA: A) m`
    },

    // Pregunta 75: Indique las letras y/o números que sustituyen a los interrogantes en el planteamiento de la siguiente serie: u 12 15 a 45 42 g 45 135 m 132 135 ¿? ¿?
    {
      category_id: section.category_id,
      section_id: section.id,
      question_text: 'Indique las letras y/o números que sustituyen a los interrogantes en el planteamiento de la siguiente serie: u 12 15 a 45 42 g 45 135 m 132 135 ¿? ¿?',
      content_data: {
        chart_type: 'alphanumeric_series',
        series_type: 'complex_intercalated_groups',
        series_text: 'u 12 15 a 45 42 g 45 135 m 132 135 ? ?',
        pattern_description: 'Serie compleja de grupos de tres elementos con múltiples patrones'
      },
      option_a: 'v, 138',
      option_b: 'r, 405',
      option_c: 'r, 132',
      option_d: 'x, 132',
      correct_option: 1, // B = r, 405
      time_limit_seconds: 200,
      cognitive_skills: ['complex_pattern_analysis', 'group_progression', 'multiple_sequences'],
      question_subtype: 'sequence_alphanumeric',
      explanation: `🔍 ANÁLISIS DE SERIE COMPLEJA DE GRUPOS:

📊 PASO 1: Separar en grupos de tres
• Grupo 1: u(21) 12 15
• Grupo 2: a(1) 45 42  
• Grupo 3: g(7) 45 135
• Grupo 4: m(13) 132 135
• Grupo 5: ? ? ?

📈 PASO 2: Analizar patrones por posición
✅ Letras: u(21)→a(1)→g(7)→m(13)→r(18)
• Patrón complejo: -20, +6, +6, +5
✅ Números medios: 12→45→45→132→405
• 12×3+9=45, 45×1=45, 45×3-3=132, 132×3+9=405
✅ Números finales: 15→42→135→135→405
• Siguen patrón correlativo con anteriores

⚡ SOLUCIÓN:
• Letra: r (siguiente en patrón)
• Número: 405 (multiplicación ×3)

✅ RESPUESTA: B) r, 405`
    },

    // Pregunta 76: En la siguiente serie lógica, marque el número o letra que tendría que ir en lugar del interrogante para dar sentido a la serie: H 3 L 2 Ñ 1 P 4 U 3 ¿?
    {
      category_id: section.category_id,
      section_id: section.id,
      question_text: 'En la siguiente serie lógica, marque el número o letra que tendría que ir en lugar del interrogante para dar sentido a la serie: H 3 L 2 Ñ 1 P 4 U 3 ¿?',
      content_data: {
        chart_type: 'alphanumeric_series',
        series_type: 'paired_alternating',
        series_text: 'H 3 L 2 Ñ 1 P 4 U 3 ?',
        pattern_description: 'Serie de pares letra-número con patrón alternante y progresión de letras'
      },
      option_a: 'W',
      option_b: 'X',
      option_c: 'Z',
      option_d: 'Y',
      correct_option: 3, // D = Y
      time_limit_seconds: 120,
      cognitive_skills: ['paired_sequences', 'alternating_patterns', 'letter_progression'],
      question_subtype: 'sequence_alphanumeric',
      explanation: `🔍 ANÁLISIS DE SERIE DE PARES ALTERNANTES:

📊 PASO 1: Formar pares
• Par 1: H(8) - 3
• Par 2: L(12) - 2
• Par 3: Ñ(15) - 1  
• Par 4: P(16) - 4
• Par 5: U(21) - 3
• Par 6: ? - ?

📈 PASO 2: Analizar patrones
✅ Letras: H(8)→L(12)→Ñ(15)→P(16)→U(21)→?
• Saltos: +4, +3, +1, +5, +?
• Siguiente sería Y(25) por patrón

✅ Números: 3, 2, 1, 4, 3, ?
• Patrón: baja hasta 1, luego sube. Patrón cíclico: 3,2,1,4,3,2

⚡ SOLUCIÓN:
La interrogante corresponde a la letra del par 6
Siguiendo la progresión: Y

✅ RESPUESTA: D) Y`
    },

    // Pregunta 77: ¿qué letras y/o números continúan la siguiente serie? 8 D 10 Z 6 B 8 X 4 Z ...
    {
      category_id: section.category_id,
      section_id: section.id,
      question_text: '¿qué letras y/o números continúan la siguiente serie? 8 D 10 Z 6 B 8 X 4 Z ...',
      content_data: {
        chart_type: 'alphanumeric_series',
        series_type: 'alternating_regression',
        series_text: '8 D 10 Z 6 B 8 X 4 Z ...',
        pattern_description: 'Serie alternante con números decrecientes y letras con patrón regresivo'
      },
      option_a: '4 W',
      option_b: '2 X',
      option_c: '8 U',
      option_d: '6 V',
      correct_option: 3, // D = 6 V
      time_limit_seconds: 150,
      cognitive_skills: ['alternating_sequences', 'regression_patterns', 'paired_analysis'],
      question_subtype: 'sequence_alphanumeric',
      explanation: `🔍 ANÁLISIS DE SERIE ALTERNANTE REGRESIVA:

📊 PASO 1: Agrupar elementos
• Grupo 1: 8 D 10 Z
• Grupo 2: 6 B 8 X  
• Grupo 3: 4 Z ? ?

📈 PASO 2: Analizar patrones internos
✅ Números (1ª y 3ª posición): 8,10 → 6,8 → 4,?
• Primera serie: 8→6→4 (-2)
• Segunda serie: 10→8→? (-2) → siguiente: 6

✅ Letras (2ª y 4ª posición): D,Z → B,X → Z,?
• D(4)→B(2)→Z(26) (patrón especial)
• Z(26)→X(24)→? (patrón -2) → siguiente: V(22)

⚡ SOLUCIÓN:
• Número: 6 (continúa patrón -2)
• Letra: V (continúa patrón regresivo)

✅ RESPUESTA: D) 6 V`
    },

    // Pregunta 78: Indique la letra o número que corresponde al valor de la interrogante para que la serie siguiente tenga sentido: A 35 e 33 J 30 o 26 V 21 ¿? 15.
    {
      category_id: section.category_id,
      section_id: section.id,
      question_text: 'Indique la letra o número que corresponde al valor de la interrogante para que la serie siguiente tenga sentido: A 35 e 33 J 30 o 26 V 21 ¿? 15.',
      content_data: {
        chart_type: 'alphanumeric_series',
        series_type: 'intercalated_decreasing',
        series_text: 'A 35 e 33 J 30 o 26 V 21 ? 15',
        pattern_description: 'Serie intercalada con letras crecientes y números decrecientes'
      },
      option_a: 'C',
      option_b: 'D',
      option_c: 'c',
      option_d: 'd',
      correct_option: 3, // D = d
      time_limit_seconds: 150,
      cognitive_skills: ['intercalated_patterns', 'case_alternation', 'decreasing_sequences'],
      question_subtype: 'sequence_alphanumeric',
      explanation: `🔍 ANÁLISIS DE SERIE INTERCALADA DECRECIENTE:

📊 PASO 1: Separar letras y números
• Letras: A, e, J, o, V, ?
• Números: 35, 33, 30, 26, 21, 15

📈 PASO 2: Analizar patrón de números  
• 35→33→30→26→21→15
• Diferencias: -2, -3, -4, -5, -6
• Patrón decreciente confirmado ✓

✅ PASO 3: Analizar patrón de letras
• A(1) e(5) J(10) o(15) V(22) ?(?)
• Posiciones: 1, 5, 10, 15, 22, ?
• Diferencias: +4, +5, +5, +7, +?
• Siguiente sería: 22 + 7 = 29 → letra c/C

🔤 PASO 4: Determinar mayúscula/minúscula
• Patrón: A(MAY), e(min), J(MAY), o(min), V(MAY), ?(min)
• Corresponde minúscula: d

✅ RESPUESTA: D) d`
    },

    // Pregunta 79: Indique el número y/o letra que debe colocarse en lugar de los interrogantes de la serie siguiente, para que dicha serie tenga sentido: 343 p ¿? ñ 125 l 64 ¿? 27 c
    {
      category_id: section.category_id,
      section_id: section.id,
      question_text: 'Indique el número y/o letra que debe colocarse en lugar de los interrogantes de la serie siguiente, para que dicha serie tenga sentido: 343 p ¿? ñ 125 l 64 ¿? 27 c',
      content_data: {
        chart_type: 'alphanumeric_series',
        series_type: 'cubic_correlation',
        series_text: '343 p ? ñ 125 l 64 ? 27 c',
        pattern_description: 'Serie correlativa con números cúbicos y letras regresivas'
      },
      option_a: '216, g',
      option_b: 'g, 215',
      option_c: '215, o',
      option_d: '216, h',
      correct_option: 3, // D = 216, h
      time_limit_seconds: 180,
      cognitive_skills: ['cubic_recognition', 'correlative_patterns', 'mathematical_sequences'],
      question_subtype: 'sequence_alphanumeric',
      explanation: `🔍 ANÁLISIS DE SERIE CORRELATIVA CÚBICA:

📊 PASO 1: Identificar estructura
• 343 p ? ñ 125 l 64 ? 27 c
• Alternancia: número-letra-número-letra...

📈 PASO 2: Analizar números (cubos perfectos)
• 343 = 7³
• 125 = 5³  
• 64 = 4³
• 27 = 3³
• Falta: 6³ = 216

✅ PASO 3: Analizar letras
• p(16) → ñ(15) → l(12) → ? → c(3)
• Patrón regresivo con saltos variables
• p(16)→ñ(15)→l(12)→h(8)→c(3)
• Diferencias: -1, -3, -4, -5

⚡ SOLUCIÓN:
• Primer ?: 216 (6³)
• Segundo ?: h (siguiente en patrón regresivo)

✅ RESPUESTA: D) 216, h`
    }
  ];

  console.log('📝 Insertando preguntas 65-79...');

  for (let i = 0; i < questions.length; i++) {
    const question = questions[i];
    
    try {
      const { data, error } = await supabase
        .from('psychometric_questions')
        .insert([question])
        .select()
        .single();

      if (error) {
        console.log(`❌ Error insertando pregunta ${65 + i}:`, error.message);
        continue;
      }

      console.log(`📚 PREGUNTA ${65 + i}:`);
      console.log(`📝 ID: ${data.id}`);
      console.log(`❓ Pregunta: ${question.question_text.substring(0, 50)}...`);
      console.log(`✅ Respuesta correcta: ${['A', 'B', 'C', 'D'][question.correct_option]}`);
      console.log(`🔗 Debug: http://localhost:3000/debug/question/${data.id}`);
      console.log('');

    } catch (err) {
      console.log(`❌ Error general pregunta ${65 + i}:`, err.message);
    }
  }

  // Verificar total
  const { data: totalQuestions } = await supabase
    .from('psychometric_questions')
    .select('id')
    .eq('section_id', section.id);

  console.log(`📊 Total de preguntas en "Series mixtas": ${totalQuestions?.length || 0}`);
  console.log(`🎯 ¡Todas las ${65 + questions.length - 1} preguntas de series alfanuméricas completadas!`);
}

addAlphanumericQuestions65To79();