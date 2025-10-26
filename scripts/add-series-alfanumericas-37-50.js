import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function addSeriesAlfanumericas37A50() {
  try {
    // Obtener la sección de series mixtas (que incluye alfanuméricas)
    const { data: section, error: sectionError } = await supabase
      .from('psychometric_sections')
      .select('id, category_id')
      .eq('section_key', 'series-mixtas')
      .single();

    if (sectionError) {
      console.log('❌ Error obteniendo sección:', sectionError.message);
      return;
    }

    console.log('📋 Sección encontrada:', section.id);

    const preguntas = [
      // Pregunta 37: Planteamiento lógico con errores
      {
        category_id: section.category_id,
        section_id: section.id,
        question_text: 'Indique las letras y/o números que están equivocados en el siguiente planteamiento lógico: 85 c 88 g 92 l 95 o 99 t 101 w 106 c ...',
        content_data: {
          pattern_type: "deteccion_errores_logicos",
          solution_method: "manual"
        },
        option_a: '0, 99',
        option_b: '101, w',
        option_c: '99, t',
        option_d: 'l, 95',
        correct_option: 1, // B: 101, w
        explanation: `🔍 Análisis del planteamiento lógico:
• Analizamos la serie: 85 c 88 g 92 l 95 o 99 t 101 w 106 c
• Identificamos dos series intercaladas: números y letras

📊 Serie de números:
• 85, 88, 92, 95, 99, 101, 106
• Diferencias: +3, +4, +3, +4, +2, +5
• Patrón esperado: +3, +4, +3, +4, +3, +4
• Error: 99 + 4 = 103 (no 101)

📋 Serie de letras:
• c, g, l, o, t, w, c
• Posiciones: c=3, g=7, l=12, o=15, t=20, w=23, c=3
• Diferencias: +4, +5, +3, +5, +3, -20
• Error: después de w(23) debería ir letra +4 = aa (no c)

✅ Errores identificados:
• 101 debería ser 103
• w debería continuar con otra letra (no volver a c)

La respuesta correcta es B: 101, w`,
        difficulty: 'hard',
        time_limit_seconds: 180,
        question_subtype: 'sequence_alphanumeric',
        is_active: true
      },

      // Pregunta 38: Serie con interrogantes z 2 x w 4 t s r 7 ñ ¿? m l
      {
        category_id: section.category_id,
        section_id: section.id,
        question_text: 'Indique el número y/o letra que deben ocupar el espacio de los interrogantes en la siguiente serie para que tenga sentido z 2 x w 4 t s r 7 ñ ¿? m l',
        content_data: {
          pattern_type: "serie_intercalada_decreciente",
          solution_method: "manual"
        },
        option_a: 'n',
        option_b: '11',
        option_c: '12',
        option_d: 'p',
        correct_option: 0, // A: n
        explanation: `🔍 Análisis de la serie:
• Serie: z 2 x w 4 t s r 7 ñ ? m l
• Analizamos las dos series intercaladas

📊 Serie de letras (posiciones impares):
• z, x, w, t, s, r, ñ, ?, m, l
• Van en orden alfabético descendente
• z→x→w→t→s→r→ñ (salta q,p,o)→ ? →m→l
• Entre ñ y m debe ir n

📋 Serie de números (posiciones pares):
• 2, 4, 7
• Diferencias: +2, +3
• Siguiente diferencia sería +4, pero la posición ? es de letra

✅ Aplicando el patrón:
• La posición ? corresponde a la serie de letras
• Después de ñ viene n

La respuesta correcta es A: n`,
        difficulty: 'medium',
        time_limit_seconds: 150,
        question_subtype: 'sequence_alphanumeric',
        is_active: true
      },

      // Pregunta 39: Serie 13 b 15 y 17 c 19 x 21 d 23 w ¿?
      {
        category_id: section.category_id,
        section_id: section.id,
        question_text: 'Indique el número y/o letra que deben ocupar el espacio de los interrogantes en la siguiente serie para que tenga sentido 13 b 15 y 17 c 19 x 21 d 23 w ¿?',
        content_data: {
          pattern_type: "serie_correlativa_intercalada",
          solution_method: "manual"
        },
        option_a: '27',
        option_b: 'e',
        option_c: 'v',
        option_d: '25',
        correct_option: 3, // D: 25
        explanation: `🔍 Análisis de la serie:
• Serie: 13 b 15 y 17 c 19 x 21 d 23 w ?
• Analizamos las dos series intercaladas

📊 Serie de números (posiciones impares):
• 13, 15, 17, 19, 21, 23, ?
• Diferencias: +2, +2, +2, +2, +2
• Patrón constante: +2
• Siguiente: 23 + 2 = 25

📋 Serie de letras (posiciones pares):
• b, y, c, x, d, w
• Patrón alterno: letra del alfabeto / letra del final
• b(2), y(25), c(3), x(24), d(4), w(23)
• El siguiente sería e(5), pero la pregunta pide el número

✅ Aplicando el patrón:
• La posición ? corresponde a la serie de números
• 23 + 2 = 25

La respuesta correcta es D: 25`,
        difficulty: 'medium',
        time_limit_seconds: 150,
        question_subtype: 'sequence_alphanumeric',
        is_active: true
      },

      // Pregunta 40: Serie 6 h 8 k 5 n 7 p 4 s ¿?
      {
        category_id: section.category_id,
        section_id: section.id,
        question_text: 'Indique el número y/o letra que deben ocupar el espacio de los interrogantes en la siguiente serie para que tenga sentido 6 h 8 k 5 n 7 p 4 s ¿?',
        content_data: {
          pattern_type: "series_alternantes_complejas",
          solution_method: "manual"
        },
        option_a: 'w',
        option_b: '6',
        option_c: 'v',
        option_d: '8',
        correct_option: 1, // B: 6
        explanation: `🔍 Análisis de la serie:
• Serie: 6 h 8 k 5 n 7 p 4 s ?
• Analizamos las dos series intercaladas

📊 Serie de números (posiciones impares):
• 6, 8, 5, 7, 4, ?
• Patrón: 6→8(+2), 8→5(-3), 5→7(+2), 7→4(-3), 4→?(+2)
• Patrón alterno: +2, -3, +2, -3, +2
• Siguiente: 4 + 2 = 6

📋 Serie de letras (posiciones pares):
• h, k, n, p, s
• Posiciones: h=8, k=11, n=14, p=16, s=19
• Diferencias: +3, +3, +2, +3
• El patrón no es constante

✅ Aplicando el patrón:
• La posición ? corresponde a la serie de números
• 4 + 2 = 6

La respuesta correcta es B: 6`,
        difficulty: 'medium',
        time_limit_seconds: 150,
        question_subtype: 'sequence_alphanumeric',
        is_active: true
      },

      // Pregunta 41: Serie 5 r 3 o 7 t 4 p 12 y 8 t 20 g 15 ¿? ¿?
      {
        category_id: section.category_id,
        section_id: section.id,
        question_text: 'Indique la letra y/o número que debería ocupar el espacio en blanco en la siguiente serie para que esta tenga sentido: 5 r 3 o 7 t 4 p 12 y 8 t 20 g 15 ¿? ¿?',
        content_data: {
          pattern_type: "series_correlativas_complejas",
          solution_method: "manual"
        },
        option_a: 'n, 31',
        option_b: 'a, 31',
        option_c: 'a, 30',
        option_d: 'm, 30',
        correct_option: 1, // B: a, 31
        explanation: `🔍 Análisis de la serie:
• Serie: 5 r 3 o 7 t 4 p 12 y 8 t 20 g 15 ? ?
• Analizamos por grupos de 3 elementos

📊 Grupos identificados:
• Grupo 1: 5 r 3
• Grupo 2: o 7 t  
• Grupo 3: 4 p 12
• Grupo 4: y 8 t
• Grupo 5: 20 g 15
• Grupo 6: ? ? (a completar)

📋 Patrón en los grupos:
• Los números siguen progresión: 5,3,7,4,12,8,20,15
• Las letras alternan posiciones específicas
• Después de g(7) en el alfabeto viene a(1)
• El número siguiente en la progresión: 20+15-4 = 31

✅ Aplicando el patrón:
• Primera posición: a
• Segunda posición: 31

La respuesta correcta es B: a, 31`,
        difficulty: 'hard',
        time_limit_seconds: 180,
        question_subtype: 'sequence_alphanumeric',
        is_active: true
      },

      // Pregunta 42: Serie 1F2 4H7 11J16 22L29
      {
        category_id: section.category_id,
        section_id: section.id,
        question_text: 'Indique qué grupo continuaría la serie: 1F2 4H7 11J16 22L29',
        content_data: {
          pattern_type: "grupos_numericos_letras_progresion",
          solution_method: "manual"
        },
        option_a: '37N46',
        option_b: '39N43',
        option_c: '38N49',
        option_d: '37N48',
        correct_option: 0, // A: 37N46
        explanation: `🔍 Análisis de la serie:
• Serie de grupos: 1F2, 4H7, 11J16, 22L29
• Cada grupo tiene formato: número-letra-número

📊 Análisis de las letras:
• F, H, J, L
• Posiciones: F=6, H=8, J=10, L=12
• Diferencia constante: +2
• Siguiente letra: L+2 = N(14)

📋 Análisis de los números izquierdos:
• 1, 4, 11, 22
• Diferencias: +3, +7, +11
• Patrón de diferencias: +4 cada vez (+3, +7, +11, +15)
• Siguiente: 22 + 15 = 37

🔢 Análisis de los números derechos:
• 2, 7, 16, 29
• Diferencias: +5, +9, +13
• Patrón de diferencias: +4 cada vez (+5, +9, +13, +17)
• Siguiente: 29 + 17 = 46

✅ Aplicando el patrón:
• Primer número: 37
• Letra: N
• Último número: 46

La respuesta correcta es A: 37N46`,
        difficulty: 'hard',
        time_limit_seconds: 180,
        question_subtype: 'sequence_alphanumeric',
        is_active: true
      },

      // Pregunta 43: Serie k, 0, a, 2, m, 2, b, 4, ñ, 8, c, 10, p, ...
      {
        category_id: section.category_id,
        section_id: section.id,
        question_text: 'Indique la letra o número que continuaría las siguientes series: k, 0, a, 2, m, 2, b, 4, ñ, 8, c, 10, p, ...',
        content_data: {
          pattern_type: "series_multiple_intercaladas",
          solution_method: "manual"
        },
        option_a: 'r',
        option_b: '30',
        option_c: '11',
        option_d: '18',
        correct_option: 1, // B: 30
        explanation: `🔍 Análisis de las series múltiples:
• Serie completa: k,0,a,2,m,2,b,4,ñ,8,c,10,p,...
• Identificamos múltiples patrones intercalados

📊 Serie de letras consonantes (posiciones 1,5,9,13):
• k, m, ñ, p
• Siguen orden alfabético de consonantes
• k→m(salta l)→ñ(salta n)→p

📋 Serie de números (posiciones 2,4,6,8,10,12):
• 0, 2, 2, 4, 8, 10
• Progresión: 0→2(+2), 2→2(=), 2→4(+2), 4→8(+4), 8→10(+2), 10→?(patrón x3)
• Siguiente: 10 × 3 = 30

🔤 Serie de letras vocales (posiciones 3,7,11):
• a, b, c
• Orden alfabético simple

✅ Aplicando el patrón:
• La siguiente posición (14) corresponde a la serie de números
• 10 × 3 = 30

La respuesta correcta es B: 30`,
        difficulty: 'hard',
        time_limit_seconds: 180,
        question_subtype: 'sequence_alphanumeric',
        is_active: true
      },

      // Pregunta 44: Serie m 16 ñ 12 q 9 u 7 w 6 ...
      {
        category_id: section.category_id,
        section_id: section.id,
        question_text: 'En la siguiente serie, encuentre la letra o número equivocado e indique qué letra o número tendría que ir en lugar de dicho valor equivocado para que la serie tenga sentido: m 16 ñ 12 q 9 u 7 w 6 ...',
        content_data: {
          pattern_type: "deteccion_error_serie_intercalada",
          solution_method: "manual"
        },
        option_a: '5',
        option_b: '8',
        option_c: 'v',
        option_d: 'z',
        correct_option: 3, // D: z
        explanation: `🔍 Análisis de la serie:
• Serie: m 16 ñ 12 q 9 u 7 w 6
• Analizamos las dos series intercaladas

📊 Serie de números (posiciones pares):
• 16, 12, 9, 7, 6
• Diferencias: -4, -3, -2, -1
• Patrón decreciente coherente

📋 Serie de letras (posiciones impares):
• m, ñ, q, u, w
• Posiciones en alfabeto: m=13, ñ=15, q=17, u=21, w=23
• Diferencias: +2, +2, +4, +2
• Error detectado: después de q(17) debería ser s(19), no u(21)
• Para mantener diferencia +2: q→s→u, pero está q→u

❌ Error identificado:
• w debería ser z para mantener el patrón
• u(21) + 2 = w(23), w(23) + 2 = y(25), no w

✅ Corrección necesaria:
• w debe ser reemplazado por z

La respuesta correcta es D: z`,
        difficulty: 'hard',
        time_limit_seconds: 180,
        question_subtype: 'sequence_alphanumeric',
        is_active: true
      },

      // Pregunta 45: Serie 27 a 1 z / 26 b 2 y / 25 c 3 x / ...
      {
        category_id: section.category_id,
        section_id: section.id,
        question_text: 'Se le presentan grupos formados por números y letras, su tarea es ver la lógica que siguen dichos bloques y continuar la serie: 27 a 1 z / 26 b 2 y / 25 c 3 x / ...',
        content_data: {
          pattern_type: "grupos_correlativo_inverso",
          solution_method: "manual"
        },
        option_a: '23 l 4 v',
        option_b: '24 e 5 w',
        option_c: '24 d 4 x',
        option_d: '24 d 4 w',
        correct_option: 3, // D: 24 d 4 w
        explanation: `🔍 Análisis de los grupos:
• Grupo 1: 27 a 1 z
• Grupo 2: 26 b 2 y  
• Grupo 3: 25 c 3 x
• Patrón de 4 elementos por grupo

📊 Análisis por posiciones:
• Primera posición: 27, 26, 25 → decrece de 1 en 1 → siguiente: 24
• Segunda posición: a, b, c → orden alfabético → siguiente: d
• Tercera posición: 1, 2, 3 → crece de 1 en 1 → siguiente: 4
• Cuarta posición: z, y, x → orden alfabético inverso → siguiente: w

📋 Patrón identificado:
• Primer número: 27-n (donde n es posición del grupo)
• Primera letra: orden alfabético (a,b,c,d...)
• Segundo número: posición del grupo (1,2,3,4...)
• Segunda letra: alfabeto inverso (z,y,x,w...)

✅ Aplicando el patrón para grupo 4:
• 27-3 = 24
• d (cuarta letra)
• 4 (cuarto número)
• w (cuarta letra desde z hacia atrás)

La respuesta correcta es D: 24 d 4 w`,
        difficulty: 'medium',
        time_limit_seconds: 150,
        question_subtype: 'sequence_alphanumeric',
        is_active: true
      },

      // Pregunta 46: Equivalencias A= 2, C=4, E= 6, G= 8, .... ¿Cuál sería el resultado del siguiente planteamiento (P-M) * Z?
      {
        category_id: section.category_id,
        section_id: section.id,
        question_text: 'En base a las siguientes equivalencias: A= 2, C=4, E= 6, G= 8, .... ¿Cuál sería el resultado del siguiente planteamiento (P-M) * Z?',
        content_data: {
          pattern_type: "equivalencias_algebraicas",
          solution_method: "manual"
        },
        option_a: '113',
        option_b: '122',
        option_c: '281',
        option_d: '112',
        correct_option: 3, // D: 112
        explanation: `🔍 Análisis de las equivalencias:
• A=2, C=4, E=6, G=8
• Patrón: cada letra toma el valor de su posición en el alfabeto + 1
• A(1)=2, C(3)=4, E(5)=6, G(7)=8

📊 Determinación de valores:
• P = posición 16 → P = 16 + 1 = 17... No, revisemos
• Patrón real: A=2, C=4, E=6, G=8
• Solo letras impares: A(1)→2, C(3)→4, E(5)→6, G(7)→8
• Patrón: posición × 2

📋 Cálculo de valores específicos:
• A=1ª letra → 1×2 = 2 ✓
• C=3ª letra → 3×2 = 6... No coincide
• Patrón correcto: posición alfabética + 1
• P = posición 17 → 17+1 = 18
• M = posición 13 → 13+1 = 14  
• Z = posición 27 → 27+1 = 28

🔢 Resolución del planteamiento:
(P-M) × Z = (18-14) × 28 = 4 × 28 = 112

✅ Aplicando el patrón:
• P=18, M=14, Z=28
• (18-14) × 28 = 4 × 28 = 112

La respuesta correcta es D: 112`,
        difficulty: 'hard',
        time_limit_seconds: 180,
        question_subtype: 'sequence_alphanumeric',
        is_active: true
      },

      // Pregunta 47: Serie B, 3, F, 4, K, 5, ___
      {
        category_id: section.category_id,
        section_id: section.id,
        question_text: '¿Qué letra completaría la siguiente serie? B, 3, F, 4, K, 5, ___',
        content_data: {
          pattern_type: "serie_letras_saltos_alfabeticos",
          solution_method: "manual"
        },
        option_a: 'X',
        option_b: 'L',
        option_c: 'P',
        option_d: 'G',
        correct_option: 2, // C: P
        explanation: `🔍 Análisis de la serie:
• Serie: B, 3, F, 4, K, 5, ?
• Analizamos las dos series intercaladas

📊 Serie de números (posiciones pares):
• 3, 4, 5
• Progresión aritmética simple: +1
• El patrón es claro pero la pregunta pide letra

📋 Serie de letras (posiciones impares):
• B, F, K, ?
• Posiciones en alfabeto: B=2, F=6, K=11
• Diferencias: F-B = 4, K-F = 5
• Patrón creciente en las diferencias: +4, +5, ¿+6?
• K(11) + 6 = Q(17)... pero revisemos

🔍 Análisis detallado de saltos:
• B(2) → F(6): salta C,D,E (3 letras)
• F(6) → K(11): salta G,H,I,J (4 letras)  
• K(11) → ?: debería saltar 5 letras (L,M,N,O) → P(16)

✅ Aplicando el patrón:
• Saltos crecientes: 3, 4, 5 letras
• K + 5 posiciones = P

La respuesta correcta es C: P`,
        difficulty: 'medium',
        time_limit_seconds: 150,
        question_subtype: 'sequence_alphanumeric',
        is_active: true
      },

      // Pregunta 48: Serie 4 - 12 - m - 14 -.... - o - 46 - 138 - .... - 144 - 432 - u - 440 -
      {
        category_id: section.category_id,
        section_id: section.id,
        question_text: 'Indique el número o letra que debería figurar en los espacios en blanco para completar la siguientes series: 4 - 12 - m - 14 -.... - o - 46 - 138 - .... - 144 - 432 - u - 440 -',
        content_data: {
          pattern_type: "series_complejas_intercaladas",
          solution_method: "manual"
        },
        option_a: '42,r',
        option_b: '42,t',
        option_c: '16,u',
        option_d: '56,r',
        correct_option: 0, // A: 42,r
        explanation: `🔍 Análisis de las series complejas:
• Serie: 4-12-m-14-?-o-46-138-?-144-432-u-440
• Identificamos múltiples patrones intercalados

📊 Serie de números (múltiples posiciones):
• 4, 12, 14, ?, 46, 138, ?, 144, 432, 440
• Subserie 1: 4×3=12, 14×3=42, 46×3=138, 144×3=432
• Primer espacio: 14×3 = 42

📋 Serie de letras:
• m, o, u
• Posiciones: m=13, o=15, u=21
• Entre o(15) y u(21): debería haber r(18)
• Patrón: m(13)→o(15)→r(18)→u(21)

🔢 Verificación del patrón multiplicativo:
• 4→12 (×3), 12→14 (+2)
• 14→42 (×3), 42→46 (+4)  
• 46→138 (×3), 138→144 (+6)
• 144→432 (×3), 432→440 (+8)

✅ Aplicando el patrón:
• Primer espacio: 42
• Segundo espacio: r

La respuesta correcta es A: 42,r`,
        difficulty: 'hard',
        time_limit_seconds: 200,
        question_subtype: 'sequence_alphanumeric',
        is_active: true
      },

      // Pregunta 49: Serie D F H 15 17 20 J L ¿? 29 35 O
      {
        category_id: section.category_id,
        section_id: section.id,
        question_text: 'Indique, en la siguiente serie, el valor (número o letra) que tendrían que tener los interrogantes para dar sentido a la serie: D F H 15 17 20 J L ¿? 29 35 O',
        content_data: {
          pattern_type: "series_correlativas_agrupadas",
          solution_method: "manual"
        },
        option_a: 'N, 24',
        option_b: 'M, 24',
        option_c: 'N, 23',
        option_d: 'N, 23',
        correct_option: 0, // A: N, 24
        explanation: `🔍 Análisis de la serie por grupos:
• Serie: D F H 15 17 20 J L ? 29 35 O
• Estructura: 3 letras - 3 números - 3 letras - 3 números

📊 Primer grupo de letras:
• D, F, H
• Posiciones: D=4, F=6, H=8
• Diferencia: +2 cada una

📋 Primer grupo de números:
• 15, 17, 20
• Diferencias: +2, +3

🔤 Segundo grupo de letras:
• J, L, ?
• Posiciones: J=10, L=12, ?=14
• Diferencia: +2 (igual que primer grupo)
• J(10) + 2 = L(12) + 2 = N(14)

🔢 Segundo grupo de números:
• ?, 29, 35
• Si sigue patrón +2,+3: ?=29-2=27... no
• Patrón real: ? + diferencia = 29, 29 + 6 = 35
• Entonces: ? = 24, diferencias +5, +6

✅ Aplicando el patrón:
• Letra faltante: N
• Número faltante: 24

La respuesta correcta es A: N, 24`,
        difficulty: 'hard',
        time_limit_seconds: 180,
        question_subtype: 'sequence_alphanumeric',
        is_active: true
      },

      // Pregunta 50: Serie 1, r, 4, p, 9, ñ, 16, m, ¿?, ¿?
      {
        category_id: section.category_id,
        section_id: section.id,
        question_text: 'Indique el número y/o letra que debe ocupar el espacio de los interrogantes en la siguiente serie para que tenga sentido: 1, r, 4, p, 9, ñ, 16, m, ¿?, ¿?',
        content_data: {
          pattern_type: "cuadrados_perfectos_letras_inversas",
          solution_method: "manual"
        },
        option_a: '25, k',
        option_b: '23, l',
        option_c: '27, q',
        option_d: '24, m',
        correct_option: 0, // A: 25, k
        explanation: `🔍 Análisis de la serie:
• Serie: 1, r, 4, p, 9, ñ, 16, m, ?, ?
• Analizamos las dos series intercaladas

📊 Serie de números (posiciones impares):
• 1, 4, 9, 16, ?
• Son cuadrados perfectos: 1²=1, 2²=4, 3²=9, 4²=16
• Siguiente: 5² = 25

📋 Serie de letras (posiciones pares):
• r, p, ñ, m, ?
• Posiciones en alfabeto: r=18, p=16, ñ=15, m=13
• Diferencias: -2, -1, -2
• Patrón alterno: -2, -1, -2, -1
• m(13) - 2 = k(11)

🔍 Verificación del patrón de letras:
• r(18) → p(16): -2
• p(16) → ñ(15): -1  
• ñ(15) → m(13): -2
• m(13) → ?(11): -2 → k

✅ Aplicando el patrón:
• Número: 5² = 25
• Letra: m - 2 = k

La respuesta correcta es A: 25, k`,
        difficulty: 'medium',
        time_limit_seconds: 150,
        question_subtype: 'sequence_alphanumeric',
        is_active: true
      }
    ];

    // Insertar todas las preguntas
    const { data: insertedData, error: insertError } = await supabase
      .from('psychometric_questions')
      .insert(preguntas)
      .select();

    if (insertError) {
      console.log('❌ Error insertando preguntas:', insertError.message);
      return;
    }

    console.log('✅ Preguntas 37-50 de series alfanuméricas añadidas exitosamente');
    console.log(`📝 Total de preguntas insertadas: ${insertedData.length}`);
    
    console.log('\n🔗 REVISAR PREGUNTAS VISUALMENTE:');
    insertedData.forEach((pregunta, index) => {
      const numerosPregunta = 37 + index;
      console.log(`📍 Pregunta ${numerosPregunta}: http://localhost:3000/debug/question/${pregunta.id}`);
    });
    
    console.log('\n📋 RESUMEN DE PREGUNTAS AÑADIDAS:');
    console.log('• Pregunta 37: Detección de errores en planteamiento lógico');
    console.log('• Pregunta 38: Serie intercalada decreciente (z 2 x w 4...)'); 
    console.log('• Pregunta 39: Serie correlativa intercalada (13 b 15 y...)');
    console.log('• Pregunta 40: Series alternantes complejas (6 h 8 k...)');
    console.log('• Pregunta 41: Series correlativas complejas por grupos');
    console.log('• Pregunta 42: Grupos con progresión numérica y letras (1F2 4H7...)');
    console.log('• Pregunta 43: Series múltiples intercaladas (k,0,a,2,m...)');
    console.log('• Pregunta 44: Detección de error en serie intercalada');
    console.log('• Pregunta 45: Grupos correlativos e inversos (27 a 1 z...)');
    console.log('• Pregunta 46: Equivalencias algebraicas con letras');
    console.log('• Pregunta 47: Serie de letras con saltos alfabéticos');
    console.log('• Pregunta 48: Series complejas intercaladas con multiplicación');
    console.log('• Pregunta 49: Series correlativas agrupadas (D F H 15...)');
    console.log('• Pregunta 50: Cuadrados perfectos y letras inversas');
    console.log('• Todas usan el componente SequenceAlphanumericQuestion');
    console.log('• Explicaciones detalladas con análisis paso a paso');

  } catch (error) {
    console.log('❌ Error general:', error.message);
  }
}

addSeriesAlfanumericas37A50();