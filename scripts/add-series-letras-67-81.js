import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function addSeriesLetras67A81() {
  try {
    // Obtener la sección de series de letras correlativas
    const { data: section, error: sectionError } = await supabase
      .from('psychometric_sections')
      .select('id, category_id')
      .eq('section_key', 'series-letras-correlativas')
      .single();

    if (sectionError) {
      console.log('❌ Error obteniendo sección:', sectionError.message);
      return;
    }

    console.log('📋 Sección encontrada:', section.id);

    const preguntas = [
      // Pregunta 67: a, b, b, c, c, c, d, e, ?
      {
        category_id: section.category_id,
        section_id: section.id,
        question_text: 'a, b, b, c, c, c, d, e, ?',
        content_data: {
          pattern_type: "series_letras_correlativas_repeticiones",
          solution_method: "manual"
        },
        option_a: 'A',
        option_b: 'C',
        option_c: 'E',
        option_d: 'D',
        correct_option: 2, // C: E
        explanation: `🔍 Análisis de la serie con repeticiones correlativas:
• Serie: a, b, b, c, c, c, d, e, ?

📊 Patrón identificado:
• Primer grupo: a (1 vez)
• Segundo grupo: b (2 veces) 
• Tercer grupo: c (3 veces)
• Cuarto grupo: d (1 vez)
• Quinto grupo: e (1 vez)

✅ Análisis del patrón:
En esta serie, el hueco entre letras aumenta según la serie 1,2,3,4, ...
- a bb ccc d ee

La respuesta correcta es C: E`,
        difficulty: 'medium',
        time_limit_seconds: 120,
        question_subtype: 'sequence_letter',
        is_active: true
      },

      // Pregunta 68: ¿Cuál sería la segunda letra que continúa la serie? B F D H F J H L .... .?..
      {
        category_id: section.category_id,
        section_id: section.id,
        question_text: '¿Cuál sería la segunda letra que continúa la serie? B F D H F J H L .... .?..',
        content_data: {
          pattern_type: "series_intercaladas_dobles",
          solution_method: "manual"
        },
        option_a: 'M',
        option_b: 'Ñ',
        option_c: 'N',
        option_d: 'J',
        correct_option: 2, // C: N
        explanation: `🔍 Análisis de series intercaladas:
• Serie: B F D H F J H L .... .?..

📊 Separamos en dos series alternas:
• Serie 1 (posiciones impares): B, D, F, H (salto de +2)
• Serie 2 (posiciones pares): F, H, J, L (salto de +2)

🔍 Continuando las series:
• Serie 1: B(2), D(4), F(6), H(8) → siguiente: J(10)
• Serie 2: F(6), H(8), J(10), L(12) → siguiente: N(14)

✅ La segunda letra que continúa es: N

La respuesta correcta es C: N`,
        difficulty: 'medium',
        time_limit_seconds: 150,
        question_subtype: 'sequence_letter',
        is_active: true
      },

      // Pregunta 69: d, o, x, g, r, a, j, u, d, ?
      {
        category_id: section.category_id,
        section_id: section.id,
        question_text: 'd, o, x, g, r, a, j, u, d, ?',
        content_data: {
          pattern_type: "series_intercaladas_complejas",
          solution_method: "manual"
        },
        option_a: 'O',
        option_b: 'N',
        option_c: 'P',
        option_d: 'Ninguna de las anteriores es correcta',
        correct_option: 3, // D: Ninguna de las anteriores es correcta
        explanation: `🔍 Análisis de la serie intercalada compleja:
• Serie: d, o, x, g, r, a, j, u, d, ?

📊 El concepto de intercalado hace referencia al hecho de que la relación de las letras de la serie no es de uno en uno, sino que vamos saltando letras.

🔍 Separamos en series por posiciones:
• Posiciones impares (1,3,5,7,9): d, x, r, j, d
• Posiciones pares (2,4,6,8,10): o, g, a, u, ?

📋 Análisis de patrones:
• Serie impar: d(4) → x(24) → r(19) → j(10) → d(4)
• Serie par: o(15) → g(7) → a(1) → u(21) → ?

La serie comienza con la d, sustituye dos letras y continúa con la serie como si esas dos letras hubieran estado. d g j (M) ...... o r u .... x a d

✅ Ninguna de las opciones propuestas (O, N, P) es correcta según el patrón identificado.

La respuesta correcta es D: Ninguna de las anteriores es correcta`,
        difficulty: 'hard',
        time_limit_seconds: 180,
        question_subtype: 'sequence_letter',
        is_active: true
      },

      // Pregunta 70: En la siguiente serie lógica, ¿Qué letra colocaríamos en lugar del interrogante para continuarla?: a t b u c v d w ¿?
      {
        category_id: section.category_id,
        section_id: section.id,
        question_text: 'En la siguiente serie lógica, ¿Qué letra colocaríamos en lugar del interrogante para continuarla?: a t b u c v d w ¿?',
        content_data: {
          pattern_type: "series_intercaladas_alfabeticas",
          solution_method: "manual"
        },
        option_a: 'e',
        option_b: 'x',
        option_c: 'y',
        option_d: 'f',
        correct_option: 0, // A: e
        explanation: `🔍 Análisis de series intercaladas:
• Serie: a t b u c v d w ¿?

📊 Separamos en dos subseries:
• Una ocupa las posiciones impares y va siguiendo el orden del alfabeto: a b c d e ...
• La otra ocuparía las posiciones pares y también va siguiendo el orden alfabético pero desde la letra t u v w x...

🔍 Esquema identificado:
• Posiciones impares: a(1), b(2), c(3), d(4), e(5)...
• Posiciones pares: t(21), u(22), v(23), w(24), x(25)...

✅ En el caso que nos piden interesa la posición impar, así que continuaría la letra "e".

La serie quedaría: a t b u c v d w e...

La respuesta correcta es A: e`,
        difficulty: 'medium',
        time_limit_seconds: 120,
        question_subtype: 'sequence_letter',
        is_active: true
      },

      // Pregunta 71: f, g, a, b, c, h, i, d, e, f,?
      {
        category_id: section.category_id,
        section_id: section.id,
        question_text: 'f, g, a, b, c, h, i, d, e, f,?',
        content_data: {
          pattern_type: "series_intercaladas_grupos",
          solution_method: "manual"
        },
        option_a: 'E',
        option_b: 'U',
        option_c: 'J',
        option_d: 'I',
        correct_option: 2, // C: J
        explanation: `🔍 Análisis de series intercaladas por grupos:
• Serie: f, g, a, b, c, h, i, d, e, f, ?

📊 El concepto de intercalado hace referencia al hecho de que la relación de las letras de la serie no es de uno en uno, sino que vamos saltando letras.

🔍 En este ejercicio tenemos dos series, la 1ª va de 2 en 2 y la siguiente de 3 en 3:
• Primera serie: f, g... h, i... j
• Segunda serie: a, b, c... d, e, f...

📋 Patrón completo:
• Grupo 1: f, g (2 letras consecutivas)
• Grupo 2: a, b, c (3 letras consecutivas)  
• Grupo 3: h, i (2 letras consecutivas)
• Grupo 4: d, e, f (3 letras consecutivas)
• Grupo 5: j, ? (2 letras consecutivas)

✅ Después de f, g viene h, i, entonces después de h, i viene j.

La respuesta correcta es C: J`,
        difficulty: 'medium',
        time_limit_seconds: 150,
        question_subtype: 'sequence_letter',
        is_active: true
      },

      // Pregunta 72: Indique qué letra continúa cada serie (no cuentan las letras dobles pero sí la ñ). B-C-Ñ-B-C-Ñ-B-C-O-B-C-?
      {
        category_id: section.category_id,
        section_id: section.id,
        question_text: 'Indique qué letra continúa cada serie (no cuentan las letras dobles pero sí la ñ). B-C-Ñ-B-C-Ñ-B-C-O-B-C-?',
        content_data: {
          pattern_type: "series_intercaladas_con_repeticion",
          solution_method: "manual"
        },
        option_a: 'C',
        option_b: 'Q',
        option_c: 'M',
        option_d: 'P',
        correct_option: 3, // D: P
        explanation: `🔍 Análisis de series intercaladas con repetición:
• Serie: B-C-Ñ-B-C-Ñ-B-C-O-B-C-?

📊 El concepto de intercalado hace referencia al hecho de que la relación de las letras de la serie no es de uno en uno, sino que vamos saltando letras.

🔍 Patrón identificado:
En esta serie la B y la C se repiten y el resto de las letras sería una serie correlativa Ñ-Ñ-O-P.

📋 Estructura del patrón:
• Posiciones fijas: B, C (se repiten constantemente)
• Serie progresiva: Ñ, Ñ, O, P (avanza en el alfabeto sin letras dobles)

✅ La próxima letra en la serie progresiva después de Ñ, Ñ, O es P.

La respuesta correcta es D: P`,
        difficulty: 'medium',
        time_limit_seconds: 150,
        question_subtype: 'sequence_letter',
        is_active: true
      },

      // Pregunta 73: c, e, h, l, ?
      {
        category_id: section.category_id,
        section_id: section.id,
        question_text: 'c, e, h, l, ?',
        content_data: {
          pattern_type: "series_correlativas_espacios_crecientes",
          solution_method: "manual"
        },
        option_a: 'M',
        option_b: 'N',
        option_c: 'Ñ',
        option_d: 'Ninguna de las anteriores es correcta',
        correct_option: 3, // D: Ninguna de las anteriores es correcta
        explanation: `🔍 Análisis de series correlativas con espacios crecientes:
• Serie: c, e, h, l, ?

📊 Consiste en señalar la letra que corresponde en el lugar de la interrogación, por lo que debemos observar toda la secuencia de letras para ver qué premisa sigue.

🔍 En esta serie, el hueco entre letras aumenta según la serie 1,2,3,4, ...
• c(3) → e(5): salto de +2
• e(5) → h(8): salto de +3  
• h(8) → l(12): salto de +4
• l(12) → ?: salto de +5 = q(17)

✅ La letra que continúa sería la "q", pero esta opción no está disponible entre las alternativas.

La respuesta correcta es D: Ninguna de las anteriores es correcta`,
        difficulty: 'medium',
        time_limit_seconds: 150,
        question_subtype: 'sequence_letter',
        is_active: true
      },

      // Pregunta 74: Indique qué letra continúa cada serie (no cuentan las letras dobles pero sí la ñ). H-A-X-B-X-H-C-X?
      {
        category_id: section.category_id,
        section_id: section.id,
        question_text: 'Indique qué letra continúa cada serie (no cuentan las letras dobles pero sí la ñ). H-A-X-B-X-H-C-X?',
        content_data: {
          pattern_type: "series_intercaladas_con_fijas",
          solution_method: "manual"
        },
        option_a: 'D',
        option_b: 'A',
        option_c: 'X',
        option_d: 'H',
        correct_option: 0, // A: D
        explanation: `🔍 Análisis de series intercaladas con letras fijas:
• Serie: H-A-X-B-X-H-C-X?

📊 El concepto de intercalado hace referencia al hecho de que la relación de las letras de la serie no es de uno en uno, sino que vamos saltando letras.

🔍 Patrón identificado:
Por un lado tenemos la H y la X que se van alternando siguiendo un patrón y por otro tenemos la serie por la que nos preguntan que sería el abecedario correlativo A-B-C-D...

📋 Estructura:
• Serie fija alternante: H, X (se alternan en posiciones específicas)
• Serie correlativa: A, B, C, D... (avanza alfabéticamente)

✅ Después de A, B, C viene D en la serie correlativa.

La respuesta correcta es A: D`,
        difficulty: 'medium',
        time_limit_seconds: 150,
        question_subtype: 'sequence_letter',
        is_active: true
      },

      // Pregunta 75: Qué serie indica el orden alfabético correcto de las siguientes palabras:
      {
        category_id: section.category_id,
        section_id: section.id,
        question_text: 'Qué serie indica el orden alfabético correcto de las siguientes palabras:',
        content_data: {
          pattern_type: "orden_alfabetico_palabras",
          solution_method: "manual",
          words_to_order: ["deal", "deanato", "deanazgo", "deambulatoria"]
        },
        option_a: 'deal, deambulatoria, deanazgo, deanato.',
        option_b: 'deal, deambulatoria, deanato, deanazgo.',
        option_c: 'deal, deanato, deambulatoria, deanazgo.',
        option_d: 'deambulatoria, deanato, deal, deanazgo.',
        correct_option: 1, // B: deal, deambulatoria, deanato, deanazgo.
        explanation: `🔍 Análisis del orden alfabético:
Habría que ponerse el abecedario para ordenarlo:

📊 Palabras a ordenar:
• deal
• deambulatoria  
• deanato
• deanazgo

🔍 Ordenación alfabética paso a paso:
1. deal (d-e-a-l)
2. deambulatoria (d-e-a-m-b...)
3. deanato (d-e-a-n-a-t-o)
4. deanazgo (d-e-a-n-a-z-g-o)

✅ Todas empiezan con "dea", por lo que comparamos la cuarta letra:
• deal: l
• deambulatoria: m
• deanato: n  
• deanazgo: n

El orden correcto es: deal, deambulatoria, deanato, deanazgo.

La respuesta correcta es B: deal, deambulatoria, deanato, deanazgo.`,
        difficulty: 'medium',
        time_limit_seconds: 180,
        question_subtype: 'sequence_letter',
        is_active: true
      },

      // Pregunta 76: Indique la opción que continúa la serie: Z-X-U-Q-¿?
      {
        category_id: section.category_id,
        section_id: section.id,
        question_text: 'Indique la opción que continúa la serie: Z-X-U-Q-¿?',
        content_data: {
          pattern_type: "series_decrecientes_variables",
          solution_method: "manual"
        },
        option_a: 'L',
        option_b: 'M',
        option_c: 'N',
        option_d: 'Ñ',
        correct_option: 1, // B: M
        explanation: `🔍 Análisis de serie decreciente con saltos variables:
• Serie: Z-X-U-Q-¿?

📊 Analizamos los saltos hacia atrás en el alfabeto:
• Z(27) → X(25): salto de -2
• X(25) → U(22): salto de -3
• U(22) → Q(18): salto de -4
• Q(18) → ?: salto de -5

🔍 Patrón identificado:
Los saltos hacia atrás aumentan progresivamente: -2, -3, -4, -5...

✅ Aplicando el patrón:
Q(18) - 5 = M(13)

La respuesta correcta es B: M`,
        difficulty: 'medium',
        time_limit_seconds: 120,
        question_subtype: 'sequence_letter',
        is_active: true
      },

      // Pregunta 77: a, z, b, y, c, ?
      {
        category_id: section.category_id,
        section_id: section.id,
        question_text: 'a, z, b, y, c, ?',
        content_data: {
          pattern_type: "series_ciclicas_extremos",
          solution_method: "manual"
        },
        option_a: 'B',
        option_b: 'A',
        option_c: 'Z',
        option_d: 'X',
        correct_option: 3, // D: X
        explanation: `🔍 Análisis de series cíclicas:
• Serie: a, z, b, y, c, ?

📊 Las series cíclicas son una combinación de las correlativas e intercaladas.

🔍 Este tipo de series implican realizar una y otra vez las mismas operaciones.

Son aquellas donde generamos una relación con un conjunto de letras que luego repetimos de forma constante.

✅ En esta serie tenemos: 2 series, donde una aumenta desde la a y otra que disminuye desde la z

• Serie ascendente: a, b, c... (desde el principio del alfabeto)
• Serie descendente: z, y, x... (desde el final del alfabeto)

La próxima letra en la serie descendente es X.

La respuesta correcta es D: X`,
        difficulty: 'medium',
        time_limit_seconds: 120,
        question_subtype: 'sequence_letter',
        is_active: true
      },

      // Pregunta 78: Indique la opción de respuesta que continuaría la siguiente serie: F E D C B K J I H G O Ñ N ? ? ?
      {
        category_id: section.category_id,
        section_id: section.id,
        question_text: 'Indique la opción de respuesta que continuaría la siguiente serie: F E D C B K J I H G O Ñ N ? ? ?',
        content_data: {
          pattern_type: "series_numericas_bloques",
          solution_method: "manual"
        },
        option_a: 'M P S',
        option_b: 'M L T',
        option_c: 'L M Q',
        option_d: 'M L R',
        correct_option: 1, // B: M L T
        explanation: `🔍 Análisis de series numéricas por bloques:
• Serie: F E D C B K J I H G O Ñ N ? ? ?

📊 En esta ocasión, las letras forman bloques diferentes. Los vemos con mayor claridad:
F E D C B / K J I H G / O Ñ N M L T

🔍 Análisis del patrón:
Esa son las tres letras que siguen la secuencia. Si tuviese que continuar, detrás de la T, aparecería la S R Q P. Si os fijáis, las letras no coinciden nunca y por ese motivo el resultado sería M L T.

📋 Otra forma de planteamiento:
F E D C B / K J I H G / O Ñ N M L / T... es decir cada bloque va hacia atrás en el orden alfabético y la primera letra del primer bloque se relaciona con la última del bloque dos (F-G) y el bloque dos hacia atrás; la primera del bloque dos (K) se relaciona con la última del bloque tres (L) y el bloque tres hacia atrás y así sucesivamente.

✅ Las tres letras que continúan son: M L T

La respuesta correcta es B: M L T`,
        difficulty: 'hard',
        time_limit_seconds: 200,
        question_subtype: 'sequence_letter',
        is_active: true
      },

      // Pregunta 79: w, v, t, s, p, o, l, k, ?
      {
        category_id: section.category_id,
        section_id: section.id,
        question_text: 'w, v, t, s, p, o, l, k, ?',
        content_data: {
          pattern_type: "series_correlativas_saltos_decrecientes",
          solution_method: "manual"
        },
        option_a: 'N',
        option_b: 'F',
        option_c: 'H',
        option_d: 'M',
        correct_option: 1, // B: F
        explanation: `🔍 Análisis de series correlativas con saltos decrecientes:
• Serie: w, v, t, s, p, o, l, k, ?

📊 Consiste en señalar la letra que corresponde en el lugar de la interrogación, por lo que debemos observar toda la secuencia de letras para ver qué premisa sigue.

🔍 Nuestra serie va de atrás hacia delante dejando huecos primero de 1, luego de 2, después 3, etc...
• w(24) → v(23): salto de -1
• v(23) → t(21): salto de -2
• t(21) → s(20): salto de -1
• s(20) → p(17): salto de -3
• p(17) → o(16): salto de -1
• o(16) → l(13): salto de -3
• l(13) → k(11): salto de -2
• k(11) → ?: salto de -5

w v (-u) t s (-rq) p o (-nm) l k (ijhg) F

✅ Siguiendo el patrón, la siguiente letra es F.

La respuesta correcta es B: F`,
        difficulty: 'hard',
        time_limit_seconds: 180,
        question_subtype: 'sequence_letter',
        is_active: true
      },

      // Pregunta 80: Indique la letra que continuaría la siguiente serie lógica: r t v y b d f i ¿?
      {
        category_id: section.category_id,
        section_id: section.id,
        question_text: 'Indique la letra que continuaría la siguiente serie lógica: r t v y b d f i ¿?',
        content_data: {
          pattern_type: "series_correlativas_saltos_patron",
          solution_method: "manual"
        },
        option_a: 'k',
        option_b: 'l',
        option_c: 'j',
        option_d: 'n',
        correct_option: 1, // B: l
        explanation: `🔍 Análisis de series correlativas con patrón de saltos:
• Serie: r t v y b d f i ¿?

📊 Las series de números y de letras están pensadas para descubrir la capacidad de razonamiento y análisis, por un lado, y factores mentales, por otro, ambos muy vinculados.

🔍 Lo más óptimo a la hora de afrontar series de letras es escribir el abecedario con sus 27 letras al comienzo del ejercicio.

📋 Tabla de referencia:
A B C D E F G H I J K L M N Ñ O P Q R S T U V W X Y Z
1 2 3 4 5 6 7 8 9 10 11 12 13 14 15 16 17 18 19 20 21 22 23 24 25 26 27

🔍 La serie que nos presentan sigue el orden del abecedario pero lo que va haciendo es saltarse letras según el siguiente patrón: salta 1, salta 1, salta 2, salta 2, salta 1, salta 1, salta 2, salta 2....

La serie iría: r (s) t (u) v (wx) y (za) b (c) d (e) f (gh) i (jk) marcaríamos la letra "l" que sería la respuesta pedida.

✅ La siguiente letra es l.

La respuesta correcta es B: l`,
        difficulty: 'hard',
        time_limit_seconds: 180,
        question_subtype: 'sequence_letter',
        is_active: true
      },

      // Pregunta 81: t, r, ñ, m, i, g, ?
      {
        category_id: section.category_id,
        section_id: section.id,
        question_text: 't, r, ñ, m, i, g, ?',
        content_data: {
          pattern_type: "series_correlativas_espacios_variables",
          solution_method: "manual"
        },
        option_a: 'A',
        option_b: 'B',
        option_c: 'D',
        option_d: 'C',
        correct_option: 3, // D: C
        explanation: `🔍 Análisis de series correlativas con espacios variables:
• Serie: t, r, ñ, m, i, g, ?

📊 Consiste en señalar la letra que corresponde en el lugar de la interrogación, por lo que debemos observar toda la secuencia de letras para ver qué premisa sigue.

🔍 La serie que se presenta va dejando 1 y 3 espacios, comenzando de atrás hacia delante. El próximo es de 3 espacios:
• t(21) → r(19): salto de -2 (salta 1 letra: s)
• r(19) → ñ(15): salto de -4 (salta 3 letras: q,p,o)  
• ñ(15) → m(13): salto de -2 (salta 1 letra: n)
• m(13) → i(9): salto de -4 (salta 3 letras: l,k,j)
• i(9) → g(7): salto de -2 (salta 1 letra: h)
• g(7) → ?: salto de -4 (salta 3 letras: f,e,d) = c(3)

✅ La siguiente letra es C.

La respuesta correcta es D: C`,
        difficulty: 'hard',
        time_limit_seconds: 180,
        question_subtype: 'sequence_letter',
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

    console.log('✅ Preguntas 67-81 de series de letras añadidas exitosamente');
    console.log(`📝 Total de preguntas insertadas: ${insertedData.length}`);
    
    console.log('\n🔗 REVISAR PREGUNTAS VISUALMENTE:');
    insertedData.forEach((pregunta, index) => {
      const numerosPregunta = 67 + index;
      console.log(`📍 Pregunta ${numerosPregunta}: http://localhost:3000/debug/question/${pregunta.id}`);
    });
    
    console.log('\n📋 RESUMEN DE PREGUNTAS AÑADIDAS:');
    console.log('• Pregunta 67: Series correlativas con repeticiones');
    console.log('• Pregunta 68: Series intercaladas dobles');
    console.log('• Pregunta 69: Series intercaladas complejas');
    console.log('• Pregunta 70: Series intercaladas alfabéticas');
    console.log('• Pregunta 71: Series intercaladas por grupos');
    console.log('• Pregunta 72: Series intercaladas con repetición');
    console.log('• Pregunta 73: Series correlativas con espacios crecientes');
    console.log('• Pregunta 74: Series intercaladas con letras fijas');
    console.log('• Pregunta 75: Orden alfabético de palabras');
    console.log('• Pregunta 76: Series decrecientes variables');
    console.log('• Pregunta 77: Series cíclicas de extremos');
    console.log('• Pregunta 78: Series numéricas por bloques');
    console.log('• Pregunta 79: Series correlativas con saltos decrecientes');
    console.log('• Pregunta 80: Series correlativas con patrón de saltos');
    console.log('• Pregunta 81: Series correlativas con espacios variables');
    console.log('• Todas usan el componente SequenceLetterQuestion');
    console.log('• Explicaciones detalladas con análisis paso a paso');

  } catch (error) {
    console.log('❌ Error general:', error.message);
  }
}

addSeriesLetras67A81();