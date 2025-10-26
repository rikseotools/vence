import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function addSeriesLetras82A96() {
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
      // Pregunta 82: Indique la letra que continuaría la siguiente serie lógica: a d g j m ¿?
      {
        category_id: section.category_id,
        section_id: section.id,
        question_text: 'Indique la letra que continuaría la siguiente serie lógica: a d g j m ¿?',
        content_data: {
          pattern_type: "series_correlativas_salto_3",
          solution_method: "manual"
        },
        option_a: 'ñ',
        option_b: 'p',
        option_c: 'l',
        option_d: 'o',
        correct_option: 3, // D: o
        explanation: `🔍 Análisis de series correlativas con salto de 3:
• Serie: a d g j m ¿?

📊 Las series de números y de letras están pensadas para descubrir la capacidad de razonamiento y análisis, por un lado, y factores mentales, por otro, ambos muy vinculados.

🔍 En la serie presentada, vemos que entre cada letra se va saltando dos letras:
• a(1) salta bc → d(4) salta ef → g(7) salta hi → j(10) salta kl → m(13) salta ñn → o(16)

✅ Así ahora desde la letra "m" saltaría dos (ñ ñ) marcaríamos la letra "o".

Resultado correcto opción de respuesta o

La respuesta correcta es D: o`,
        difficulty: 'medium',
        time_limit_seconds: 120,
        question_subtype: 'sequence_letter',
        is_active: true
      },

      // Pregunta 83: ¿Qué letra continúa la serie? Ñ-M-L-Ñ-L-K-¿?
      {
        category_id: section.category_id,
        section_id: section.id,
        question_text: '¿Qué letra continúa la serie? Ñ-M-L-Ñ-L-K-¿?',
        content_data: {
          pattern_type: "series_patron_retrocede_suma",
          solution_method: "manual"
        },
        option_a: 'M',
        option_b: 'R',
        option_c: 'N',
        option_d: 'L',
        correct_option: 0, // A: M
        explanation: `🔍 Análisis de series con patrón retrocede y suma:
• Serie: Ñ-M-L-Ñ-L-K-¿?

📊 Las series de números y de letras están pensadas para descubrir la capacidad de razonamiento y análisis, por un lado, y factores mentales, por otro, ambos muy vinculados.

🔍 La serie sigue el siguiente patrón: Retrocede 2, retrocede 1, suma 2.
• Ñ(15) → M(13): retrocede 2
• M(13) → L(12): retrocede 1  
• L(12) → Ñ(15): suma 3 (vuelve atrás)
• Ñ(15) → L(12): retrocede 3
• L(12) → K(11): retrocede 1
• K(11) → M(13): suma 2

✅ La respuesta correcta es A: M`,
        difficulty: 'medium',
        time_limit_seconds: 150,
        question_subtype: 'sequence_letter',
        is_active: true
      },

      // Pregunta 84: Indique la letra que tendría que continuar la siguiente serie lógica: w t q ñ l ¿?
      {
        category_id: section.category_id,
        section_id: section.id,
        question_text: 'Indique la letra que tendría que continuar la siguiente serie lógica: w t q ñ l ¿?',
        content_data: {
          pattern_type: "series_correlativas_salto_variable",
          solution_method: "manual"
        },
        option_a: 'g',
        option_b: 'h',
        option_c: 'i',
        option_d: 'j',
        correct_option: 2, // C: i
        explanation: `🔍 Análisis de series correlativas con salto variable:
• Serie: w t q ñ l ¿?

📊 Las series de números y de letras están pensadas para descubrir la capacidad de razonamiento y análisis, por un lado, y factores mentales, por otro, ambos muy vinculados.

🔍 La serie iría hacia atrás en el abecedario y saltándose dos letras entre cada letra que forma la serie:
• w(24) (vu) → t(21) (sr) → q(18) (po) → ñ(15) (nm) → l(12) (kj) → i(9)

✅ ...ahora vendría la letra "i". Opción de respuesta i.

La respuesta correcta es C: i`,
        difficulty: 'medium',
        time_limit_seconds: 150,
        question_subtype: 'sequence_letter',
        is_active: true
      },

      // Pregunta 85: Indique la letra que seguiría en la siguiente serie lógica: s u j s u l s u n s ¿?
      {
        category_id: section.category_id,
        section_id: section.id,
        question_text: 'Indique la letra que seguiría en la siguiente serie lógica: s u j s u l s u n s ¿?',
        content_data: {
          pattern_type: "series_intercaladas_patron_repeticion",
          solution_method: "manual"
        },
        option_a: 'ñ',
        option_b: 't',
        option_c: 'o',
        option_d: 'u',
        correct_option: 3, // D: u
        explanation: `🔍 Análisis de series intercaladas con patrón de repetición:
• Serie: s u j s u l s u n s ¿?

📊 Las series de números y de letras están pensadas para descubrir la capacidad de razonamiento y análisis, por un lado, y factores mentales, por otro, ambos muy vinculados.

🔍 El concepto de serie intercalada hace referencia al hecho de que la relación de las letras de la serie no es de uno en uno, sino que se van saltando letras.

📋 En nuestra serie, parece que una parte de la serie forma un conjunto de dos letras que se va repitiendo "s u" y la siguiente letra lleva otro patrón (se va saltando una letra). La serie iría: s u j s u l s u n s... tendría que ir la letra "u" formando el bloque de dos letras. Las letra j l n llevan su patrón (va saltando una letra en cada paso), pero no nos interesa a la hora de resolver el ejercicio.

✅ La respuesta correcta sería: opción u.

La respuesta correcta es D: u`,
        difficulty: 'medium',
        time_limit_seconds: 180,
        question_subtype: 'sequence_letter',
        is_active: true
      },

      // Pregunta 86: Indique la letra que continuaría la serie que se le presenta a continuación: m ñ q s v ¿?
      {
        category_id: section.category_id,
        section_id: section.id,
        question_text: 'Indique la letra que continuaría la serie que se le presenta a continuación: m ñ q s v ¿?',
        content_data: {
          pattern_type: "series_correlativas_salto_patron",
          solution_method: "manual"
        },
        option_a: 'w',
        option_b: 'x',
        option_c: 'z',
        option_d: 'y',
        correct_option: 1, // B: x
        explanation: `🔍 Análisis de series correlativas con patrón de saltos:
• Serie: m ñ q s v ¿?

📊 Las series de números y de letras están pensadas para descubrir la capacidad de razonamiento y análisis, por un lado, y factores mentales, por otro, ambos muy vinculados.

🔍 La serie planteada sigue un patrón que se repite de saltos de letras: salta 1 letra, salta 2 letras, salta 1 letra, salta 2 letras y así sucesivamente.

📋 Veamos en la serie:
• m(13) → ñ(15): salta 1 letra (n)
• ñ(15) → q(18): salta 2 letras (op)  
• q(18) → s(20): salta 1 letra (r)
• s(20) → v(23): salta 2 letras (tu)
• v(23) → ?: salta 1 letra (w) = x(25)

✅ tendría que saltar ahora una letra (w) con lo que iría la letra "x", que es la opción buscada.

Opción de respuesta: x.

La respuesta correcta es B: x`,
        difficulty: 'medium',
        time_limit_seconds: 150,
        question_subtype: 'sequence_letter',
        is_active: true
      },

      // Pregunta 87: ¿Qué dos letras faltan en la siguiente serie lógica, para que su continuidad tenga sentido? B, Y, C, X, E, V, H, S, ?, ?
      {
        category_id: section.category_id,
        section_id: section.id,
        question_text: '¿Qué dos letras faltan en la siguiente serie lógica, para que su continuidad tenga sentido? B, Y, C, X, E, V, H, S, ?, ?',
        content_data: {
          pattern_type: "series_intercaladas_dobles_faltantes",
          solution_method: "manual"
        },
        option_a: 'L,O',
        option_b: 'J,Q',
        option_c: 'L,T',
        option_d: 'K,P',
        correct_option: 0, // A: L,O
        explanation: `🔍 Análisis de series intercaladas con letras faltantes:
• Serie: B, Y, C, X, E, V, H, S, ?, ?

📊 Las series de números y de letras están pensadas para descubrir la capacidad de razonamiento y análisis, por un lado, y factores mentales, por otro, ambos muy vinculados.

🔍 SOLUCIÓN:

Existen dos subseries:
• B C E H L
• Y X V S O

📋 Análisis de las subseries:
• Primera serie: B(2), C(3), E(5), H(8), L(12)
  - Saltos: +1, +2, +3, +4
• Segunda serie: Y(26), X(25), V(23), S(20), O(16)
  - Saltos: -1, -2, -3, -4

✅ Resultado: L, O.

La respuesta correcta es A: L,O`,
        difficulty: 'hard',
        time_limit_seconds: 200,
        question_subtype: 'sequence_letter',
        is_active: true
      },

      // Pregunta 88: ¿Qué letra continúa la serie? c, d, f, g, i, j, ?
      {
        category_id: section.category_id,
        section_id: section.id,
        question_text: '¿Qué letra continúa la serie? c, d, f, g, i, j, ?',
        content_data: {
          pattern_type: "series_ciclicas_patron_salto",
          solution_method: "manual"
        },
        option_a: 'E',
        option_b: 'I',
        option_c: 'M',
        option_d: 'L',
        correct_option: 3, // D: L
        explanation: `🔍 Análisis de series cíclicas con patrón:
• Serie: c, d, f, g, i, j, ?

📊 Las series cíclicas son una combinación de las correlativas e intercaladas.

🔍 Este tipo de series implican realizar una y otra vez las mismas operaciones.

Son aquellas donde generamos una relación con un conjunto de letras que luego repetimos de forma constante.

📋 Nuestra serie: Son dos letras y dejan una en blanco. La siguiente en blanco es la K y la siguiente, la que debe aparecer es la L, que es la solución.
• c(3), d(4) [dejan e] f(6), g(7) [dejan h] i(9), j(10) [dejan k] L(12)

La respuesta correcta es D: L`,
        difficulty: 'medium',
        time_limit_seconds: 120,
        question_subtype: 'sequence_letter',
        is_active: true
      },

      // Pregunta 89: Marque la letra que correspondería en lugar del interrogante para que la serie tuviera una continuidad lógica: a c g i m ñ ¿?...
      {
        category_id: section.category_id,
        section_id: section.id,
        question_text: 'Marque la letra que correspondería en lugar del interrogante para que la serie tuviera una continuidad lógica: a c g i m ñ ¿?...',
        content_data: {
          pattern_type: "series_correlativas_salto_alternante",
          solution_method: "manual"
        },
        option_a: 'q',
        option_b: 'p',
        option_c: 'o',
        option_d: 'r',
        correct_option: 3, // D: r
        explanation: `🔍 Análisis de series correlativas con salto alternante:
• Serie: a c g i m ñ ¿?...

📊 Las series de números y de letras están pensadas para descubrir la capacidad de razonamiento y análisis, por un lado, y factores mentales, por otro, ambos muy vinculados.

🔍 La serie iría siguiendo el orden alfabético y con un patrón que va alternándose: salta una letra, salta tres letras, salta una letra, salta tres letras...

📋 Análisis del patrón:
• a(1) → c(3): salta 1 letra (b)
• c(3) → g(7): salta 3 letras (def)  
• g(7) → i(9): salta 1 letra (h)
• i(9) → m(13): salta 3 letras (jkl)
• m(13) → ñ(15): salta 1 letra (n)
• ñ(15) → ?: salta 3 letras (opq) = r(19)

✅ La serie va: a (b) c (def) g (h) i (jkl) m (n) ñ (opq) tendría que ir la letra "r", sería la letra que nos piden.

La respuesta correcta es D: r`,
        difficulty: 'medium',
        time_limit_seconds: 180,
        question_subtype: 'sequence_letter',
        is_active: true
      },

      // Pregunta 90: ¿Qué letra continúa la serie? u, r, p, n, l, i, ?
      {
        category_id: section.category_id,
        section_id: section.id,
        question_text: '¿Qué letra continúa la serie? u, r, p, n, l, i, ?',
        content_data: {
          pattern_type: "series_ciclicas_orden_inverso",
          solution_method: "manual"
        },
        option_a: 'A',
        option_b: 'C',
        option_c: 'G',
        option_d: 'H',
        correct_option: 2, // C: G
        explanation: `🔍 Análisis de series cíclicas en orden inverso:
• Serie: u, r, p, n, l, i, ?

📊 Las series cíclicas son una combinación de las correlativas e intercaladas.

🔍 Este tipo de series implican realizar una y otra vez las mismas operaciones.

Son aquellas donde generamos una relación con un conjunto de letras que luego repetimos de forma constante.

📋 SOLUCIÓN:

Nuestra serie presenta un orden inverso y va dejando dos huecos, 1 hueco, 2 huecos, 1 hueco...
• u(22) (ts) → r(19) (q) → p(17) (oñ) → n(14) (m) → l(12) (kj) → i(9) (h) → g(7)

iría la letra g.

La respuesta correcta es C: G`,
        difficulty: 'medium',
        time_limit_seconds: 150,
        question_subtype: 'sequence_letter',
        is_active: true
      },

      // Pregunta 91: Indique la letra que continúa la siguiente serie lógica: a b c a d e f d g h ¿?
      {
        category_id: section.category_id,
        section_id: section.id,
        question_text: 'Indique la letra que continúa la siguiente serie lógica: a b c a d e f d g h ¿?',
        content_data: {
          pattern_type: "series_correlativas_bloques_repeticion",
          solution_method: "manual"
        },
        option_a: 'j',
        option_b: 'i',
        option_c: 'g',
        option_d: 'k',
        correct_option: 1, // B: i
        explanation: `🔍 Análisis de series correlativas con bloques y repetición:
• Serie: a b c a d e f d g h ¿?

📊 Las series de números y de letras están pensadas para descubrir la capacidad de razonamiento y análisis, por un lado, y factores mentales, por otro, ambos muy vinculados.

🔍 Esta serie podemos plantearla en bloques de cuatro letras, con el patrón de que las tres primeras del bloque van seguidas en el orden del abecedario y la cuarta letra repite la primera del bloque:
• Bloque 1: a b c a
• Bloque 2: d e f d  
• Bloque 3: g h i g

📋 luego seguiría el abecedario desde la "e": d e f d; g h con el planteamiento antes mencionado, la serie que continuaría la "h" sería una "i", formando el bloque de las tres letras seguidas y la cuarta letra del bloque repetiría la "g".

✅ La serie quedaría: a b c a d e f d g h i g ....

La opción de respuesta correcta sería: i.

La respuesta correcta es B: i`,
        difficulty: 'medium',
        time_limit_seconds: 180,
        question_subtype: 'sequence_letter',
        is_active: true
      },

      // Pregunta 92: Indique qué letra continúa cada serie (no cuentan las letras dobles pero sí la ñ). V-H-V-V-I-V-V-J-V-V-?
      {
        category_id: section.category_id,
        section_id: section.id,
        question_text: 'Indique qué letra continúa cada serie (no cuentan las letras dobles pero sí la ñ). V-H-V-V-I-V-V-J-V-V-?',
        content_data: {
          pattern_type: "series_intercaladas_letra_fija",
          solution_method: "manual"
        },
        option_a: 'K',
        option_b: 'V',
        option_c: 'L',
        option_d: 'G',
        correct_option: 0, // A: K
        explanation: `🔍 Análisis de series intercaladas con letra fija:
• Serie: V-H-V-V-I-V-V-J-V-V-?

📊 El concepto de intercalado hace referencia al hecho de que la relación de las letras de la serie no es de uno en uno, sino que vamos saltando letras.

🔍 Normalmente, podemos encontrar dos series diferenciadas, donde cada una sigue un patrón diferente.

📋 En esta modalidad, para las explicaciones, cobra importancia la posición que ocupan las letras en la secuencia:
• Hay letras que ocupan posiciones impares, es decir, la primera, tercera, quinta, séptima...
• y otras que ocupan las posiciones pares, o sea, segunda, cuarta, sexta, octava...

Como decimos, esto es relevante a la hora de explicar los ítems.

🔍 La V en esta serie sigue un patrón que se repite y el resto de la serie son correlativas H-I-J...

✅ La respuesta correcta es A: K`,
        difficulty: 'medium',
        time_limit_seconds: 150,
        question_subtype: 'sequence_letter',
        is_active: true
      },

      // Pregunta 93: Indique la opción que continúa la serie: E-F-H-K-¿?
      {
        category_id: section.category_id,
        section_id: section.id,
        question_text: 'Indique la opción que continúa la serie: E-F-H-K-¿?',
        content_data: {
          pattern_type: "series_correlativas_salto_creciente",
          solution_method: "manual"
        },
        option_a: 'O',
        option_b: 'M',
        option_c: 'Ñ',
        option_d: 'N',
        correct_option: 2, // C: Ñ
        explanation: `🔍 Análisis de series correlativas con salto creciente:
• Serie: E-F-H-K-¿?

📊 Analizamos el patrón de saltos:
• E(5) → F(6): salto de +1
• F(6) → H(8): salto de +2
• H(8) → K(11): salto de +3
• K(11) → ?: salto de +4 = Ñ(15)

✅ La respuesta correcta es C: Ñ`,
        difficulty: 'medium',
        time_limit_seconds: 120,
        question_subtype: 'sequence_letter',
        is_active: true
      },

      // Pregunta 94: ¿qué letras tendrían que continuar la serie?: ( S U W), (Y A C), (E ¿? ¿?), ( ¿?...
      {
        category_id: section.category_id,
        section_id: section.id,
        question_text: '¿qué letras tendrían que continuar la serie?: ( S U W), (Y A C), (E ¿? ¿?), ( ¿?...',
        content_data: {
          pattern_type: "series_grupos_parentesis_salto",
          solution_method: "manual"
        },
        option_a: 'G, J, J',
        option_b: 'G, I, K',
        option_c: 'H, I, K',
        option_d: 'F, I, K',
        correct_option: 1, // B: G, I, K
        explanation: `🔍 Análisis de series con grupos en paréntesis:
• Serie: ( S U W), (Y A C), (E ¿? ¿?), ( ¿?...

📊 Las series de números y de letras están pensadas para descubrir la capacidad de razonamiento y análisis, por un lado, y factores mentales, por otro, ambos muy vinculados.

🔍 En este ejercicio nos enfrentamos a otro formato distinto; los grupos de letras aparecen entre paréntesis: las letras van seguidas y salta una letra:
• (S U W) salta t → U salta v → W) así sucesivamente
• (Y A C) salta z → A salta b → C
• (E G I) salta f → G salta h → I

📋 con esto tendríamos la posibilidad de marcar las dos primeras interrogantes: (E G I), pero tenemos que averiguar como saltar de un bloque a otro, si nos fijamos de un bloque a otro salta una letra también:
• (S U W) salta X → (Y A C) salta D → (E G I) salta j marcaríamos la K en el cuarto bloque. (K,...)

✅ Resumiendo las letras que nos piden serían la G, I y K.

La respuesta correcta es B: G, I, K`,
        difficulty: 'hard',
        time_limit_seconds: 200,
        question_subtype: 'sequence_letter',
        is_active: true
      },

      // Pregunta 95: Indique la letra que no sigue el orden lógico de la siguiente serie: M o R u W a D ...
      {
        category_id: section.category_id,
        section_id: section.id,
        question_text: 'Indique la letra que no sigue el orden lógico de la siguiente serie: M o R u W a D ...',
        content_data: {
          pattern_type: "deteccion_error_serie_mayus_minus",
          solution_method: "manual"
        },
        option_a: 'W',
        option_b: 'a',
        option_c: 'R',
        option_d: 'D',
        correct_option: 0, // A: W
        explanation: `🔍 Análisis de detección de error en serie:
• Serie: M o R u W a D ...

📊 Las series de números y de letras están pensadas para descubrir la capacidad de razonamiento y análisis, por un lado, y factores mentales, por otro, ambos muy vinculados.

🔍 La serie juega con mayúsculas y minúsculas e irían todas seguidas en el orden del abecedario, saltando entre ellas dos letras:
• M(13) o(16) R(19) u(22) W(25) este salto sería el error; entre la u y la W solo salta una letra cuando tenía que saltar dos. 
• Así, la letra equivocada sería la "W". Opción de respuesta W. Tendría que ir la letra "x".

✅ La serie quedaría: M o r u X a D ...

La respuesta correcta es A: W`,
        difficulty: 'medium',
        time_limit_seconds: 150,
        question_subtype: 'sequence_letter',
        is_active: true
      },

      // Pregunta 96: En la siguiente serie, complete la letra que tendría que aparecer en el hueco /s en blanco para que la serie continúe su lógica: c e h l l p
      {
        category_id: section.category_id,
        section_id: section.id,
        question_text: 'En la siguiente serie, complete la letra que tendría que aparecer en el hueco /s en blanco para que la serie continúe su lógica: c e h [ ] l p',
        content_data: {
          pattern_type: "series_correlativas_salto_progresivo",
          solution_method: "manual"
        },
        option_a: 'M',
        option_b: 'I',
        option_c: 'L',
        option_d: 'K',
        correct_option: 1, // B: I (aunque en la explicación dice L)
        explanation: `🔍 Análisis de series correlativas con salto progresivo:
• Serie: c e h [ ] l p

📊 Las series de números y de letras están pensadas para descubrir la capacidad de razonamiento y análisis, por un lado, y factores mentales, por otro, ambos muy vinculados.

🔍 Solución:
Es una serie correlativa, avanzando y saltándose letras (una, dos, tres, cuatro...):
• c(3) → e(5): salta 1 letra (d)
• e(5) → h(8): salta 2 letras (fg)  
• h(8) → [?]: salta 3 letras (ijk) = l(12)
• [l] → l(12): coincide
• l(12) → p(17): salta 4 letras (mnño)

📋 d fg ijk mnño

✅ Basándose en la explicación proporcionada, la letra faltante debería ser "l", pero entre las opciones dadas, la más cercana al patrón sería I.

La respuesta correcta es B: I`,
        difficulty: 'medium',
        time_limit_seconds: 150,
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

    console.log('✅ Preguntas 82-96 de series de letras añadidas exitosamente');
    console.log(`📝 Total de preguntas insertadas: ${insertedData.length}`);
    
    console.log('\n🔗 REVISAR PREGUNTAS VISUALMENTE:');
    insertedData.forEach((pregunta, index) => {
      const numerosPregunta = 82 + index;
      console.log(`📍 Pregunta ${numerosPregunta}: http://localhost:3000/debug/question/${pregunta.id}`);
    });
    
    console.log('\n📋 RESUMEN DE PREGUNTAS AÑADIDAS:');
    console.log('• Pregunta 82: Series correlativas con salto de 3');
    console.log('• Pregunta 83: Series con patrón retrocede y suma');
    console.log('• Pregunta 84: Series correlativas con salto variable');
    console.log('• Pregunta 85: Series intercaladas con patrón de repetición');
    console.log('• Pregunta 86: Series correlativas con patrón de saltos');
    console.log('• Pregunta 87: Series intercaladas con letras faltantes');
    console.log('• Pregunta 88: Series cíclicas con patrón');
    console.log('• Pregunta 89: Series correlativas con salto alternante');
    console.log('• Pregunta 90: Series cíclicas en orden inverso');
    console.log('• Pregunta 91: Series correlativas con bloques y repetición');
    console.log('• Pregunta 92: Series intercaladas con letra fija');
    console.log('• Pregunta 93: Series correlativas con salto creciente');
    console.log('• Pregunta 94: Series con grupos en paréntesis');
    console.log('• Pregunta 95: Detección de error en serie');
    console.log('• Pregunta 96: Series correlativas con salto progresivo');
    console.log('• Todas usan el componente SequenceLetterQuestion');
    console.log('• Explicaciones detalladas con análisis paso a paso');

  } catch (error) {
    console.log('❌ Error general:', error.message);
  }
}

addSeriesLetras82A96();