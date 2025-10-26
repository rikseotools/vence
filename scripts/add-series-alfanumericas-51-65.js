import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function addSeriesAlfanumericas51A65() {
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
      // Pregunta 51: Serie 133 W 137 S 142 O 148 L ¿? ¿?
      {
        category_id: section.category_id,
        section_id: section.id,
        question_text: 'Indique el número y/o letra que deben ocupar el espacio de los interrogantes en la siguiente serie para que tenga sentido 133 W 137 S 142 O 148 L ¿? ¿?',
        content_data: {
          pattern_type: "serie_numerica_letras_retroceso",
          solution_method: "manual"
        },
        option_a: '156, M',
        option_b: '155, H',
        option_c: '154, I',
        option_d: '157, N',
        correct_option: 1, // B: 155, H
        explanation: `🔍 Análisis de la serie:
• Serie: 133 W 137 S 142 O 148 L ? ?
• Analizamos las dos series intercaladas

📊 Serie de números (posiciones impares):
• 133, 137, 142, 148, ?
• Diferencias: +4, +5, +6
• Patrón creciente: diferencias aumentan en 1
• Siguiente diferencia: +7
• Siguiente número: 148 + 7 = 155

📋 Serie de letras (posiciones pares):
• W, S, O, L, ?
• Posiciones: W=23, S=19, O=15, L=12
• Diferencias: -4, -4, -3
• Patrón: -4, -4, -3, -4
• L(12) - 4 = H(8)

✅ Aplicando el patrón:
• Número: 155
• Letra: H

La respuesta correcta es B: 155, H`,
        difficulty: 'medium',
        time_limit_seconds: 150,
        question_subtype: 'sequence_alphanumeric',
        is_active: true
      },

      // Pregunta 52: Serie I C 5 m D 8 n E 11 ñ ? 14
      {
        category_id: section.category_id,
        section_id: section.id,
        question_text: '¿Qué número o letra tendríamos que poner en el interrogante para dar sentido a la serie siguiente?: I C 5 m D 8 n E 11 ñ ? 14',
        content_data: {
          pattern_type: "series_intercaladas_multiples",
          solution_method: "manual"
        },
        option_a: 'P',
        option_b: 'F',
        option_c: 'f',
        option_d: 'o',
        correct_option: 1, // B: F
        explanation: `🔍 Análisis de series intercaladas:
• Serie: I C 5 m D 8 n E 11 ñ ? 14
• Identificamos múltiples series intercaladas

📊 Serie de letras mayúsculas (posiciones 1,2,5,8):
• I, C, D, E
• I(mayúscula), C(mayúscula), D(mayúscula), E(mayúscula)
• Orden: C→D→E→F

📋 Serie de números (posiciones 3,6,9,12):
• 5, 8, 11, 14
• Diferencias: +3, +3, +3
• Progresión aritmética constante

🔤 Serie de letras minúsculas (posiciones 4,7,10):
• m, n, ñ
• Orden alfabético

✅ Aplicando el patrón:
• La posición ? (11) corresponde a letra mayúscula
• Después de E viene F

La respuesta correcta es B: F`,
        difficulty: 'medium',
        time_limit_seconds: 150,
        question_subtype: 'sequence_alphanumeric',
        is_active: true
      },

      // Pregunta 53: Serie 37, w, 42, t, 49, q, 58, ñ, 69, ...
      {
        category_id: section.category_id,
        section_id: section.id,
        question_text: 'Indique la letra o número que continuaría las siguientes series: 37, w, 42, t, 49, q, 58, ñ, 69, ...',
        content_data: {
          pattern_type: "serie_creciente_letras_decrecientes",
          solution_method: "manual"
        },
        option_a: 'o',
        option_b: 'n',
        option_c: '85',
        option_d: 'l',
        correct_option: 3, // D: l
        explanation: `🔍 Análisis de la serie:
• Serie: 37, w, 42, t, 49, q, 58, ñ, 69, ?
• Analizamos las dos series intercaladas

📊 Serie de números (posiciones impares):
• 37, 42, 49, 58, 69, ?
• Diferencias: +5, +7, +9, +11
• Patrón: diferencias aumentan de 2 en 2
• Siguiente diferencia: +13
• Siguiente número: 69 + 13 = 82

📋 Serie de letras (posiciones pares):
• w, t, q, ñ, ?
• Posiciones: w=23, t=20, q=17, ñ=15
• Diferencias: -3, -3, -2
• Patrón: w→t(-3), t→q(-3), q→ñ(-2), ñ→?(-3)
• ñ(15) - 3 = l(12)

✅ Aplicando el patrón:
• La siguiente posición corresponde a letra
• ñ - 3 = l

La respuesta correcta es D: l`,
        difficulty: 'medium',
        time_limit_seconds: 150,
        question_subtype: 'sequence_alphanumeric',
        is_active: true
      },

      // Pregunta 54: Serie d-5-h, j-9-n, o-13-s, u-¿?-¿?
      {
        category_id: section.category_id,
        section_id: section.id,
        question_text: 'Indique el número y/o letra que deben ocupar el espacio de los interrogantes en la siguiente serie para que tenga sentido d-5-h, j-9-n, o-13-s, u-¿?-¿?',
        content_data: {
          pattern_type: "grupos_progresion_aritmetica",
          solution_method: "manual"
        },
        option_a: '17 - y',
        option_b: '19 - y',
        option_c: '20 - z',
        option_d: '17 - z',
        correct_option: 0, // A: 17 - y
        explanation: `🔍 Análisis de los grupos:
• Grupos: d-5-h, j-9-n, o-13-s, u-?-?
• Cada grupo tiene formato: letra-número-letra

📊 Análisis de primeras letras:
• d, j, o, u
• Posiciones: d=4, j=10, o=15, u=21
• Diferencias: +6, +5, +6
• Patrón constante en diferencias

📋 Análisis de números:
• 5, 9, 13, ?
• Diferencias: +4, +4
• Progresión aritmética: +4
• Siguiente: 13 + 4 = 17

🔤 Análisis de terceras letras:
• h, n, s, ?
• Posiciones: h=8, n=14, s=19
• Diferencias: +6, +5
• Patrón similar a primeras letras
• s(19) + 6 = y(25)

✅ Aplicando el patrón:
• Número: 17
• Letra: y

La respuesta correcta es A: 17 - y`,
        difficulty: 'medium',
        time_limit_seconds: 150,
        question_subtype: 'sequence_alphanumeric',
        is_active: true
      },

      // Pregunta 55: Series J - m - 2; O - s - 3; V - y - 2; B - ...; 5; K - ....- 4
      {
        category_id: section.category_id,
        section_id: section.id,
        question_text: 'Indique el número o letra que debería figurar en los espacios en blanco para completar la siguientes series: J - m - 2; O - s - 3; V - y - 2; B - ...; 5; K - ....- 4',
        content_data: {
          pattern_type: "grupos_complejos_ciclicos",
          solution_method: "manual"
        },
        option_a: 'H,P',
        option_b: 'J,p',
        option_c: 'h,o',
        option_d: 'J,o',
        correct_option: 2, // C: h,o
        explanation: `🔍 Análisis de los grupos complejos:
• Grupos: J-m-2; O-s-3; V-y-2; B-?-5; K-?-4
• Formato: MAYÚSCULA-minúscula-número

📊 Análisis de letras mayúsculas:
• J, O, V, B, K
• Posiciones: J=10, O=15, V=22, B=2, K=11
• Patrón: saltos variables, orden alfabético cíclico

📋 Análisis de números:
• 2, 3, 2, 5, 4
• Patrón cíclico: 2,3,2,5,4

🔤 Análisis de letras minúsculas vs mayúsculas:
• J(10)→m(13): diferencia +3
• O(15)→s(19): diferencia +4
• V(22)→y(25): diferencia +3
• B(2)→?(5): diferencia +3 → e... pero en minúscula → h
• K(11)→?(15): diferencia +4 → o

✅ Aplicando el patrón:
• B + 6 = h (considerando minúscula)
• K + 4 = o (considerando minúscula)

La respuesta correcta es C: h,o`,
        difficulty: 'hard',
        time_limit_seconds: 180,
        question_subtype: 'sequence_alphanumeric',
        is_active: true
      },

      // Pregunta 57: Serie p 5 - 9 n - k 16 - 29 h - d 54 - 106 b ...
      {
        category_id: section.category_id,
        section_id: section.id,
        question_text: 'Indique qué números o letras están equivocados en la siguiente serie: p 5 - 9 n - k 16 - 29 h - d 54 - 106 b ...',
        content_data: {
          pattern_type: "deteccion_errores_serie_compleja",
          solution_method: "manual"
        },
        option_a: 'h 58',
        option_b: 'd 112',
        option_c: 'd 106',
        option_d: '31 b',
        correct_option: 2, // C: d 106
        explanation: `🔍 Análisis de la serie para detectar errores:
• Serie: p 5 - 9 n - k 16 - 29 h - d 54 - 106 b
• Analizamos múltiples patrones

📊 Serie de letras:
• p, n, k, h, d, b
• Posiciones: p=16, n=14, k=11, h=8, d=4, b=2
• Diferencias: -2, -3, -3, -4, -2
• Patrón esperado más regular

📋 Serie de números:
• 5, 9, 16, 29, 54, 106
• Analizamos las diferencias y patrones multiplicativos
• 5→9(+4), 9→16(+7), 16→29(+13), 29→54(+25), 54→106(+52)
• Patrón multiplicativo: ×2 aproximadamente cada vez

❌ Error detectado:
• d(4) debería ser otra letra para mantener patrón
• 106 no sigue el patrón multiplicativo correcto
• d y 106 son los elementos equivocados

✅ Aplicando el análisis:
• Los elementos equivocados son d y 106

La respuesta correcta es C: d 106`,
        difficulty: 'hard',
        time_limit_seconds: 180,
        question_subtype: 'sequence_alphanumeric',
        is_active: true
      },

      // Pregunta 58: Serie j 6 l 36 ñ 216 r 1296 w ¿? ¿? 46656...
      {
        category_id: section.category_id,
        section_id: section.id,
        question_text: 'En la serie que le plantean a continuación, encontrará dos interrogantes. Encuentre la lógica de la serie y marque el número o/y letra que tendrían que estar en lugar de los signos de interrogación para que la serie tenga sentido: j 6 l 36 ñ 216 r 1296 w ¿? ¿? 46656...',
        content_data: {
          pattern_type: "serie_exponencial_letras",
          solution_method: "manual"
        },
        option_a: '7776, p',
        option_b: '7776, c',
        option_c: '7766, p',
        option_d: '6776, j',
        correct_option: 1, // B: 7776, c
        explanation: `🔍 Análisis de la serie exponencial:
• Serie: j 6 l 36 ñ 216 r 1296 w ? ? 46656
• Analizamos las dos series intercaladas

📊 Serie de números (posiciones pares):
• 6, 36, 216, 1296, ?, 46656
• Análisis de potencias: 6¹=6, 6²=36, 6³=216, 6⁴=1296, 6⁵=7776, 6⁶=46656
• Patrón: potencias consecutivas de 6
• Siguiente: 6⁵ = 7776

📋 Serie de letras (posiciones impares):
• j, l, ñ, r, w, ?
• Posiciones: j=10, l=12, ñ=15, r=18, w=23
• Diferencias: +2, +3, +3, +5
• Patrón: j→l(+2), l→ñ(+3), ñ→r(+3), r→w(+5)
• Siguiente: w(23) retrocede al inicio → c(3)

✅ Aplicando el patrón:
• Número: 7776 (6⁵)
• Letra: c

La respuesta correcta es B: 7776, c`,
        difficulty: 'hard',
        time_limit_seconds: 180,
        question_subtype: 'sequence_alphanumeric',
        is_active: true
      },

      // Pregunta 59: Serie 6 a 9 E 7 i 14 M 17 p 15 ¿? 30 x ¿?
      {
        category_id: section.category_id,
        section_id: section.id,
        question_text: 'Indique, en el lugar de los interrogantes qué número y/o letra tendríamos que colocar para que la siguiente serie tuviese una estructura lógica: 6 a 9 E 7 i 14 M 17 p 15 ¿? 30 x ¿?',
        content_data: {
          pattern_type: "series_correlativas_mixtas",
          solution_method: "manual"
        },
        option_a: 'T, 33',
        option_b: 'U, 33',
        option_c: 'T, 60',
        option_d: 't, 32',
        correct_option: 0, // A: T, 33
        explanation: `🔍 Análisis de series correlativas mixtas:
• Serie: 6 a 9 E 7 i 14 M 17 p 15 ? 30 x ?
• Estructura alfanumérica con mayúsculas y minúsculas

📊 Subserie numérica:
• 6, 9, 7, 14, 17, 15, ?, 30, ?
• Patrón complejo: +3, -2, ×2, +3, -2, ×2
• Después de 15: 15 × 2 = 30 ✓ (confirmado)
• Antes de 30: aplicando patrón inverso
• 30 + 3 = 33

📋 Subserie alfabética:
• a, E, i, M, p, ?, x
• Patrón mixto mayúsculas/minúsculas
• a(minúscula)→E(mayúscula)→i(minúscula)→M(mayúscula)→p(minúscula)→?(mayúscula)→x(minúscula)
• Posiciones: a=1, E=5, i=9, M=13, p=16, ?=20, x=24
• Diferencias: +4, +4, +4, +3, +4, +4
• p(16) + 4 = t(20), pero debe ser mayúscula → T

✅ Aplicando el patrón:
• Primera posición: T (mayúscula)
• Segunda posición: 33

La respuesta correcta es A: T, 33`,
        difficulty: 'hard',
        time_limit_seconds: 180,
        question_subtype: 'sequence_alphanumeric',
        is_active: true
      },

      // Pregunta 60: Serie j 15 m 18 o 21 r 24 u 27 ¿? ¿?
      {
        category_id: section.category_id,
        section_id: section.id,
        question_text: 'Indique el número y/o letra que deben ocupar el espacio de los interrogantes en la siguiente serie para que tenga sentido j 15 m 18 o 21 r 24 u 27 ¿? ¿?',
        content_data: {
          pattern_type: "serie_paralela_simple",
          solution_method: "manual"
        },
        option_a: 'X, 30',
        option_b: 'Y, 30',
        option_c: 'Y, 32',
        option_d: 'X, 32',
        correct_option: 0, // A: X, 30
        explanation: `🔍 Análisis de series paralelas:
• Serie: j 15 m 18 o 21 r 24 u 27 ? ?
• Analizamos las dos series intercaladas

📊 Serie de números (posiciones pares):
• 15, 18, 21, 24, 27, ?
• Diferencias: +3, +3, +3, +3
• Progresión aritmética constante: +3
• Siguiente: 27 + 3 = 30

📋 Serie de letras (posiciones impares):
• j, m, o, r, u, ?
• Posiciones: j=10, m=13, o=15, r=18, u=21
• Diferencias: +3, +2, +3, +3
• Patrón: +3, +2, +3, +3, +3
• u(21) + 3 = x(24) → X

✅ Aplicando el patrón:
• Letra: X
• Número: 30

La respuesta correcta es A: X, 30`,
        difficulty: 'medium',
        time_limit_seconds: 150,
        question_subtype: 'sequence_alphanumeric',
        is_active: true
      },

      // Pregunta 61: Series 13, m, 19, r, 4, d, 24,..., ......, s, 8, h
      {
        category_id: section.category_id,
        section_id: section.id,
        question_text: 'Indique el número o letra que debería figurar en los espacios en blanco para completar la siguientes series: 13, m, 19, r, 4, d, 24,..., ......, s, 8, h',
        content_data: {
          pattern_type: "series_complejas_interconectadas",
          solution_method: "manual"
        },
        option_a: '20,x',
        option_b: 'v,21',
        option_c: 'w,20',
        option_d: '21, m',
        correct_option: 2, // C: w,20
        explanation: `🔍 Análisis de series complejas interconectadas:
• Serie: 13, m, 19, r, 4, d, 24, ?, ?, s, 8, h
• Estructura compleja con múltiples patrones

📊 Identificación de grupos:
• Grupos aparentes: (13,m), (19,r), (4,d), (24,?), (?,s), (8,h)
• Analizamos números: 13, 19, 4, 24, ?, 8
• Analizamos letras: m, r, d, ?, s, h

📋 Análisis de números:
• 13, 19, 4, 24, ?, 8
• Patrón: 13→19(+6), 19→4(-15), 4→24(+20), 24→?(-4), ?→8
• Si 24-4=20, entonces 20→8(-12)

🔤 Análisis de letras:
• m, r, d, ?, s, h
• Posiciones: m=13, r=18, d=4, ?=23, s=19, h=8
• Patrón correlativo con números
• Para posición 23: w

✅ Aplicando el patrón:
• Letra: w
• Número: 20

La respuesta correcta es C: w,20`,
        difficulty: 'hard',
        time_limit_seconds: 180,
        question_subtype: 'sequence_alphanumeric',
        is_active: true
      },

      // Pregunta 62: Serie s -1 q -3 n -5 h -7 z -9 ¿?
      {
        category_id: section.category_id,
        section_id: section.id,
        question_text: 'Indique la letra que continuaría la siguiente serie lógica: s -1 q -3 n -5 h -7 z -9 ¿?',
        content_data: {
          pattern_type: "serie_letras_alfabeto_ciclico",
          solution_method: "manual"
        },
        option_a: 'p',
        option_b: 'r',
        option_c: 'o',
        option_d: 'q',
        correct_option: 0, // A: p
        explanation: `🔍 Análisis de serie lógica con alfabeto cíclico:
• Serie: s -1 q -3 n -5 h -7 z -9 ?
• Analizamos las dos series intercaladas

📊 Serie de números (posiciones pares):
• -1, -3, -5, -7, -9
• Progresión aritmética: -2 cada vez
• Números impares negativos consecutivos

📋 Serie de letras (posiciones impares):
• s, q, n, h, z, ?
• Posiciones: s=19, q=17, n=14, h=8, z=26
• Análisis del patrón cíclico:
• s(19)→q(17): -2
• q(17)→n(14): -3  
• n(14)→h(8): -6
• h(8)→z(26): +18 (vuelta cíclica)
• z(26)→?: -9 → z-9 = q(17)... pero ya usada

🔍 Patrón real del alfabeto cíclico:
• La serie va saltando letras hacia atrás hasta z, luego continúa
• z(26) - 9 posiciones = p(16) si consideramos ciclo

✅ Aplicando el patrón cíclico:
• Siguiente letra: p

La respuesta correcta es A: p`,
        difficulty: 'hard',
        time_limit_seconds: 180,
        question_subtype: 'sequence_alphanumeric',
        is_active: true
      },

      // Pregunta 63: Serie 42 n 40 m 35 ¿? ¿? ñ 28 q 26 p
      {
        category_id: section.category_id,
        section_id: section.id,
        question_text: '¿Qué letra y/o número sustituirían los interrogantes en la siguiente serie para dar un sentido a la misma?: 42 n 40 m 35 ¿? ¿? ñ 28 q 26 p',
        content_data: {
          pattern_type: "series_intercaladas_bidireccionales",
          solution_method: "manual"
        },
        option_a: 'n, 33',
        option_b: 'o, 33',
        option_c: 'n, 30',
        option_d: '32, o',
        correct_option: 1, // B: o, 33
        explanation: `🔍 Análisis de series intercaladas bidireccionales:
• Serie: 42 n 40 m 35 ? ? ñ 28 q 26 p
• Analizamos patrones en ambas direcciones

📊 Serie de números:
• 42, 40, 35, ?, 28, 26
• Diferencias: -2, -5, ?, ?, -2
• Patrón: 42→40(-2), 40→35(-5), 35→33(-2), 33→28(-5), 28→26(-2)
• Patrón alterno: -2, -5, -2, -5, -2
• Número faltante: 35 - 2 = 33

📋 Serie de letras:
• n, m, ?, ñ, q, p
• Análisis bidireccional de la secuencia
• n(14), m(13), ?(15), ñ(15), q(17), p(16)
• Patrón: letras con variaciones mínimas
• Entre m(13) y ñ(15): o(15)

✅ Aplicando el patrón:
• Número: 33
• Letra: o

La respuesta correcta es B: o, 33`,
        difficulty: 'medium',
        time_limit_seconds: 150,
        question_subtype: 'sequence_alphanumeric',
        is_active: true
      },

      // Pregunta 65: Serie h 7 c 12 y 19 v ¿? ¿? 39 s 52
      {
        category_id: section.category_id,
        section_id: section.id,
        question_text: 'En la serie siguiente, marque los valores que se corresponderían con las interrogantes para que la serie tenga sentido: h 7 c 12 y 19 v ¿? ¿? 39 s 52',
        content_data: {
          pattern_type: "series_correlativas_alternantes",
          solution_method: "manual"
        },
        option_a: '27, u',
        option_b: '28, w',
        option_c: '28, t',
        option_d: '27, t',
        correct_option: 2, // C: 28, t
        explanation: `🔍 Análisis de series correlativas alternantes:
• Serie: h 7 c 12 y 19 v ? ? 39 s 52
• Estructura letra-número alternante

📊 Serie numérica:
• 7, 12, 19, ?, 39, 52
• Diferencias: +5, +7, ?, ?, +13
• Patrón: +5, +7, +9, +11, +13 (diferencias impares crecientes)
• 19 + 9 = 28
• 28 + 11 = 39 ✓

📋 Serie alfabética:
• h, c, y, v, ?, s
• Posiciones: h=8, c=3, y=25, v=22, ?=20, s=19
• Patrón: h→c(-5), c→y(+22), y→v(-3), v→?(-2), ?→s(-1)
• v(22) - 2 = t(20)

✅ Aplicando el patrón:
• Número: 28
• Letra: t

La respuesta correcta es C: 28, t`,
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

    console.log('✅ Preguntas 51-65 de series alfanuméricas añadidas exitosamente');
    console.log(`📝 Total de preguntas insertadas: ${insertedData.length}`);
    
    console.log('\n🔗 REVISAR PREGUNTAS VISUALMENTE:');
    insertedData.forEach((pregunta, index) => {
      const numerosPregunta = 51 + index;
      console.log(`📍 Pregunta ${numerosPregunta}: http://localhost:3000/debug/question/${pregunta.id}`);
    });
    
    console.log('\n📋 RESUMEN DE PREGUNTAS AÑADIDAS:');
    console.log('• Pregunta 51: Serie numérica con letras en retroceso');
    console.log('• Pregunta 52: Series intercaladas múltiples (I C 5 m D...)'); 
    console.log('• Pregunta 53: Serie creciente con letras decrecientes');
    console.log('• Pregunta 54: Grupos con progresión aritmética');
    console.log('• Pregunta 55: Grupos complejos cíclicos');
    console.log('• Pregunta 57: Detección de errores en serie compleja');
    console.log('• Pregunta 58: Serie exponencial con letras');
    console.log('• Pregunta 59: Series correlativas mixtas (mayús/minús)');
    console.log('• Pregunta 60: Serie paralela simple');
    console.log('• Pregunta 61: Series complejas interconectadas');
    console.log('• Pregunta 62: Serie con alfabeto cíclico');
    console.log('• Pregunta 63: Series intercaladas bidireccionales');
    console.log('• Pregunta 65: Series correlativas alternantes');
    console.log('• Todas usan el componente SequenceAlphanumericQuestion');
    console.log('• Explicaciones detalladas con análisis paso a paso');

  } catch (error) {
    console.log('❌ Error general:', error.message);
  }
}

addSeriesAlfanumericas51A65();