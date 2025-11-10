// scripts/add-instruccion-procedimiento-batch.js
// Script para añadir preguntas de Procedimiento Administrativo: Instrucción

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Función para convertir letra a número
function letterToNumber(letter) {
  const mapping = { 'A': 0, 'B': 1, 'C': 2, 'D': 3 };
  return mapping[letter.toUpperCase()];
}

// Preguntas de instrucción del procedimiento administrativo basadas en artículos 75-83
const instruccionQuestions = [
  {
    question_text: "Según la Ley 39/2015, y respecto a los medios de prueba en el procedimiento, cuando la prueba consista en la emisión de un informe de una Entidad de derecho público:",
    option_a: "Se entenderá que éste tiene carácter preceptivo.",
    option_b: "Se entenderá que éste tiene carácter facultativo.",
    option_c: "Se entenderá que éste tiene carácter potestativo.",
    option_d: "Se entenderá que éste tiene carácter sancionador.",
    correct_option: "A",
    article_reference: "77",
    explanation: "El artículo 77.6 de la Ley 39/2015 establece que cuando la prueba consista en la emisión de un informe de una entidad de derecho público, éste tendrá carácter preceptivo. Esto garantiza que se obtenga la información necesaria de las entidades públicas competentes para una adecuada resolución del procedimiento."
  },
  {
    question_text: "Tal y como señala el artículo 77 de la Ley 39/2015, el instructor del procedimiento acordará la apertura de un período de prueba por un plazo no superior a treinta días ni inferior a diez:",
    option_a: "Únicamente cuando la naturaleza del procedimiento lo exija.",
    option_b: "Únicamente cuando la Administración no tenga por ciertos los hechos alegados por los interesados.",
    option_c: "El instructor del procedimiento solo podrá acordar la apertura de un período de prueba a solicitud del interesado.",
    option_d: "Cuando la Administración no tenga por ciertos los hechos alegados por los interesados o la naturaleza del procedimiento lo exija.",
    correct_option: "D",
    article_reference: "77",
    explanation: "El artículo 77 de la Ley 39/2015 establece que se abrirá período de prueba cuando la Administración no tenga por ciertos los hechos alegados por los interesados o cuando la naturaleza del procedimiento lo exija. Esto garantiza una investigación completa de los hechos relevantes para la decisión administrativa."
  },
  {
    question_text: "Al regular los actos de instrucción, el artículo 75.4 de la Ley 39/2015 establece que el órgano instructor adoptará las medidas necesarias para lograr el pleno respeto a los principios de:",
    option_a: "Racionalización y agilidad de los procedimientos administrativos.",
    option_b: "Participación, objetividad y transparencia de la actuación administrativa.",
    option_c: "Simplicidad, claridad y proximidad a los ciudadanos.",
    option_d: "Contradicción y de igualdad de los interesados en el procedimiento.",
    correct_option: "D",
    article_reference: "75",
    explanation: "El artículo 75.4 de la Ley 39/2015 exige que el órgano instructor adopte medidas para garantizar los principios de contradicción e igualdad de los interesados. Estos principios fundamentales aseguran que todas las partes tengan las mismas oportunidades de defensa y que puedan conocer y rebatir los argumentos contrarios."
  },
  {
    question_text: "Según el artículo 76 de la Ley 39/2015, ¿cuándo pueden los interesados aducir alegaciones y aportar los documentos que estimen convenientes?",
    option_a: "Solo al inicio del procedimiento.",
    option_b: "En cualquier momento del procedimiento anterior al trámite de audiencia.",
    option_c: "Únicamente durante el trámite de audiencia.",
    option_d: "Solo cuando el instructor lo solicite expresamente.",
    correct_option: "B",
    article_reference: "76",
    explanation: "El artículo 76 de la Ley 39/2015 reconoce el derecho de los interesados a aducir alegaciones y aportar documentos en cualquier momento anterior al trámite de audiencia. Este derecho garantiza una defensa activa y continuada durante toda la fase de instrucción del procedimiento."
  },
  {
    question_text: "¿Qué establece el artículo 77.3 de la Ley 39/2015 sobre el rechazo de pruebas propuestas por los interesados?",
    option_a: "El instructor puede rechazar cualquier prueba sin motivación.",
    option_b: "No se pueden rechazar las pruebas propuestas por los interesados.",
    option_c: "Podrán rechazarse las pruebas propuestas por los interesados cuando sean manifiestamente improcedentes o innecesarias, mediante resolución motivada.",
    option_d: "Solo se pueden rechazar si suponen un coste excesivo.",
    correct_option: "C",
    article_reference: "77",
    explanation: "El artículo 77.3 permite rechazar las pruebas manifiestamente improcedentes o innecesarias mediante resolución motivada. Esto equilibra el derecho a la prueba de los interesados con la eficiencia del procedimiento, evitando dilaciones innecesarias sin fundamento."
  },
  {
    question_text: "Respecto a los hechos declarados probados por resoluciones judiciales penales firmes, según el artículo 77.4 de la Ley 39/2015:",
    option_a: "Vinculan a la Administración solamente si la resolución es absolutoria.",
    option_b: "No tienen ningún efecto en el procedimiento administrativo.",
    option_c: "Vinculan a la Administración, sin perjuicio de que ésta pueda declarar otros hechos probados.",
    option_d: "Solo vinculan si existe identidad de sujetos y objeto.",
    correct_option: "C",
    article_reference: "77",
    explanation: "El artículo 77.4 establece que los hechos declarados probados por resoluciones judiciales penales firmes vinculan a la Administración. Esto respeta la autoridad de cosa juzgada penal, aunque permite a la Administración declarar probados otros hechos no contemplados en la resolución judicial."
  },
  {
    question_text: "Según el artículo 79 de la Ley 39/2015, en la petición de informes:",
    option_a: "No es necesario especificar los extremos sobre los que se solicita.",
    option_b: "Se concretará el extremo o extremos acerca de los que se solicita.",
    option_c: "Solo puede solicitarse información general.",
    option_d: "Debe incluir la propuesta de resolución completa.",
    correct_option: "B",
    article_reference: "79",
    explanation: "El artículo 79.2 de la Ley 39/2015 exige que en la petición de informe se concrete el extremo o extremos sobre los que se solicita información. Esto garantiza la precisión en la solicitud y facilita que el órgano informante pueda proporcionar una respuesta adecuada y específica."
  },
  {
    question_text: "¿Cuál es el plazo general para la emisión de informes según el artículo 80 de la Ley 39/2015?",
    option_a: "Cinco días hábiles.",
    option_b: "Diez días, salvo que una disposición establezca otro plazo.",
    option_c: "Un mes en todos los casos.",
    option_d: "No existe plazo específico.",
    correct_option: "B",
    article_reference: "80",
    explanation: "El artículo 80.2 establece un plazo de diez días para emitir informes, salvo que una disposición o el cumplimiento de otros plazos del procedimiento requiera un plazo diferente. Este plazo equilibra la necesidad de obtener información técnica con la celeridad del procedimiento."
  },
  {
    question_text: "Según el artículo 80.3 de la Ley 39/2015, si no se emite el informe preceptivo en el plazo señalado:",
    option_a: "Se puede proseguir las actuaciones normalmente.",
    option_b: "Se archiva automáticamente el procedimiento.",
    option_c: "Se podrá suspender el transcurso del plazo máximo legal para resolver.",
    option_d: "El procedimiento queda paralizado indefinidamente.",
    correct_option: "C",
    article_reference: "80",
    explanation: "El artículo 80.3 permite suspender el plazo máximo para resolver cuando no se emite un informe preceptivo en plazo. Esta suspensión protege tanto el derecho a una resolución fundada (que requiere el informe) como el cumplimiento de los plazos máximos de resolución."
  },
  {
    question_text: "¿Qué características tienen los informes según el artículo 80.1 de la Ley 39/2015, salvo disposición expresa en contrario?",
    option_a: "Son obligatorios y vinculantes.",
    option_b: "Son facultativos y no vinculantes.",
    option_c: "Son obligatorios pero no vinculantes.",
    option_d: "Son facultativos pero vinculantes.",
    correct_option: "B",
    article_reference: "80",
    explanation: "El artículo 80.1 establece que los informes son facultativos y no vinculantes como regla general. Esto significa que la Administración puede apartarse del criterio del informe motivando adecuadamente su decisión, manteniendo su potestad decisoria."
  },
  {
    question_text: "Según el artículo 82 de la Ley 39/2015, ¿cuándo se debe otorgar trámite de audiencia?",
    option_a: "En todos los procedimientos sin excepción.",
    option_b: "Solo en procedimientos sancionadores.",
    option_c: "Cuando en la instrucción del procedimiento hayan aparecido hechos o alegaciones distintos de los iniciales.",
    option_d: "Solo cuando lo solicite el interesado.",
    correct_option: "C",
    article_reference: "82",
    explanation: "El artículo 82 exige el trámite de audiencia cuando aparecen hechos o alegaciones distintos de los iniciales durante la instrucción. Este trámite garantiza el principio de contradicción, permitiendo a los interesados conocer y responder a nuevos elementos que puedan afectar la resolución."
  },
  {
    question_text: "¿Cuál es la duración del trámite de audiencia según el artículo 82 de la Ley 39/2015?",
    option_a: "No inferior a diez días ni superior a quince.",
    option_b: "Exactamente quince días.",
    option_c: "No inferior a quince días ni superior a treinta.",
    option_d: "Un plazo prudencial que determine el instructor.",
    correct_option: "A",
    article_reference: "82",
    explanation: "El artículo 82 establece un plazo de audiencia no inferior a diez días ni superior a quince. Este plazo equilibra el derecho de defensa de los interesados con la celeridad del procedimiento, proporcionando tiempo suficiente para formular alegaciones sin dilaciones excesivas."
  },
  {
    question_text: "Según el artículo 83 de la Ley 39/2015, ¿cuándo se debe abrir un período de información pública?",
    option_a: "En todos los procedimientos administrativos.",
    option_b: "Cuando la naturaleza del procedimiento lo requiera y se establezca por norma con rango de ley.",
    option_c: "Solo en procedimientos de responsabilidad patrimonial.",
    option_d: "Solo cuando lo soliciten los interesados.",
    correct_option: "B",
    article_reference: "83",
    explanation: "El artículo 83.1 establece que se abrirá período de información pública cuando la naturaleza del procedimiento lo requiera y así se establezca por norma con rango de ley. Esto asegura la participación ciudadana en asuntos de especial relevancia o impacto público."
  },
  {
    question_text: "¿Cuál es la duración del período de información pública según el artículo 83.2 de la Ley 39/2015?",
    option_a: "No será inferior a diez días ni superior a treinta.",
    option_b: "No será inferior a quince días ni superior a cuarenta y cinco.",
    option_c: "No será inferior a veinte días ni superior a treinta.",
    option_d: "No será inferior a treinta días ni superior a sesenta.",
    correct_option: "C",
    article_reference: "83",
    explanation: "El artículo 83.2 establece que el período de información pública no será inferior a veinte días ni superior a treinta. Este plazo permite una participación ciudadana efectiva proporcionando tiempo suficiente para el conocimiento y formulación de observaciones por parte de los interesados."
  },
  {
    question_text: "Según el artículo 81 de la Ley 39/2015, en los procedimientos de responsabilidad patrimonial:",
    option_a: "No se pueden solicitar informes técnicos.",
    option_b: "Se solicitarán los informes, dictámenes y actuaciones que se juzguen necesarios para el esclarecimiento de los hechos.",
    option_c: "Solo se pueden solicitar informes jurídicos.",
    option_d: "Los informes son siempre vinculantes.",
    correct_option: "B",
    article_reference: "81",
    explanation: "El artículo 81 establece que en procedimientos de responsabilidad patrimonial se solicitarán los informes y dictámenes necesarios para esclarecer los hechos. Esta previsión específica reconoce la complejidad técnica de estos procedimientos y la necesidad de contar con elementos de juicio especializados."
  },
  {
    question_text: "¿Qué debe contener la propuesta de resolución según el artículo 77.7 de la Ley 39/2015?",
    option_a: "Solo los hechos probados.",
    option_b: "Solo la fundamentación jurídica.",
    option_c: "Una valoración de las pruebas practicadas.",
    option_d: "Solo la propuesta de decisión.",
    correct_option: "C",
    article_reference: "77",
    explanation: "El artículo 77.7 exige que en la propuesta de resolución se incluya una valoración de las pruebas practicadas. Esta valoración permite conocer el razonamiento seguido para establecer los hechos probados y garantiza la motivación de las decisiones administrativas."
  },
  {
    question_text: "¿Cuándo puede el instructor rechazar la práctica de pruebas según el artículo 77 de la Ley 39/2015?",
    option_a: "Nunca puede rechazar pruebas.",
    option_b: "Cuando sean manifiestamente improcedentes o innecesarias.",
    option_c: "Solo por motivos económicos.",
    option_d: "Cuando superen el plazo del procedimiento.",
    correct_option: "B",
    article_reference: "77",
    explanation: "El artículo 77.3 permite rechazar las pruebas manifiestamente improcedentes o innecesarias, pero siempre mediante resolución motivada. Esta facultad evita dilaciones infundadas mientras respeta el derecho a la prueba de los interesados."
  },
  {
    question_text: "Según el artículo 75 de la Ley 39/2015, los actos de instrucción:",
    option_a: "Solo pueden realizarse en días hábiles.",
    option_b: "No podrán causar indefensión a los interesados.",
    option_c: "Requieren siempre audiencia previa.",
    option_d: "Deben publicarse en el boletín oficial.",
    correct_option: "B",
    article_reference: "75",
    explanation: "El artículo 75 establece que los actos de instrucción no pueden causar indefensión a los interesados. Esta garantía fundamental protege el derecho de defensa durante toda la fase instructora, asegurando que cualquier actuación administrativa respete las garantías procedimentales."
  },
  {
    question_text: "¿Qué sucede si un informe se emite fuera de plazo según el artículo 80.4 de la Ley 39/2015?",
    option_a: "Debe tenerse en cuenta obligatoriamente.",
    option_b: "Se rechaza automáticamente.",
    option_c: "Podrá no ser tenido en cuenta al adoptar la resolución.",
    option_d: "Suspende automáticamente el procedimiento.",
    correct_option: "C",
    article_reference: "80",
    explanation: "El artículo 80.4 establece que el informe emitido fuera de plazo podrá no ser tenido en cuenta. Esta previsión protege la celeridad del procedimiento y evita que la demora en la emisión de informes paralice indebidamente la tramitación administrativa."
  },
  {
    question_text: "Según el artículo 76.1 de la Ley 39/2015, las alegaciones formuladas por los interesados:",
    option_a: "Solo pueden versar sobre cuestiones de hecho.",
    option_b: "Solo pueden versar sobre cuestiones de derecho.",
    option_c: "Pueden versar sobre cualquier aspecto del procedimiento.",
    option_d: "Están limitadas a los defectos de tramitación.",
    correct_option: "C",
    article_reference: "76",
    explanation: "El artículo 76.1 permite que las alegaciones versen sobre cualquier aspecto del procedimiento, tanto de hecho como de derecho. Esta amplitud garantiza el derecho de defensa integral de los interesados durante la fase de instrucción del procedimiento administrativo."
  },
  {
    question_text: "¿Qué establece el artículo 83.4 de la Ley 39/2015 sobre la publicación del período de información pública?",
    option_a: "Solo debe publicarse en el boletín oficial correspondiente.",
    option_b: "Debe anunciarse en los medios de comunicación de mayor audiencia.",
    option_c: "Se anunciará en el diario oficial correspondiente y podrá anunciarse además por otros medios.",
    option_d: "Solo debe notificarse a los interesados conocidos.",
    correct_option: "C",
    article_reference: "83",
    explanation: "El artículo 83.4 exige el anuncio en el diario oficial correspondiente y permite utilizar otros medios adicionales. Esta doble previsión garantiza la publicidad necesaria para una participación ciudadana efectiva en los asuntos sometidos a información pública."
  },
  {
    question_text: "En relación con la emisión de informes por otras Administraciones según el artículo 80 de la Ley 39/2015:",
    option_a: "Si transcurre el plazo sin emitirse, se paraliza el procedimiento.",
    option_b: "Si transcurre el plazo sin emitirse, se podrán proseguir las actuaciones.",
    option_c: "Debe esperarse indefinidamente a su emisión.",
    option_d: "No se pueden solicitar informes a otras Administraciones.",
    correct_option: "B",
    article_reference: "80",
    explanation: "El artículo 80.4 permite proseguir las actuaciones si una Administración distinta no emite el informe en plazo. Esta regla evita que la inactividad de otras Administraciones paralice los procedimientos, manteniendo la eficacia de la actuación administrativa."
  },
  {
    question_text: "¿Cuándo debe concederse un plazo de audiencia según el artículo 82 de la Ley 39/2015?",
    option_a: "Siempre que se inicie un procedimiento.",
    option_b: "Solo en procedimientos iniciados de oficio.",
    option_c: "Cuando hayan aparecido en el expediente hechos o alegaciones distintos a los iniciales.",
    option_d: "Solo cuando el interesado lo solicite expresamente.",
    correct_option: "C",
    article_reference: "82",
    explanation: "El artículo 82 exige conceder audiencia cuando aparezcan hechos o alegaciones distintos a los iniciales. Esta garantía procedimental asegura que los interesados puedan defenderse ante nuevos elementos que surjan durante la instrucción y que puedan influir en la resolución."
  },
  {
    question_text: "Según el artículo 77 de la Ley 39/2015, ¿quién decide sobre la apertura del período de prueba?",
    option_a: "El órgano competente para resolver.",
    option_b: "El instructor del procedimiento.",
    option_c: "El superior jerárquico del instructor.",
    option_d: "Los interesados mediante solicitud.",
    correct_option: "B",
    article_reference: "77",
    explanation: "El artículo 77 atribuye al instructor del procedimiento la decisión sobre la apertura del período de prueba. Esta competencia se justifica por su conocimiento directo del expediente y la necesidad de evaluar si es precisa la práctica de pruebas para esclarecer los hechos relevantes."
  },
  {
    question_text: "¿Qué debe fundamentar la Administración al rechazar las pruebas propuestas según el artículo 77.3 de la Ley 39/2015?",
    option_a: "Que son costosas económicamente.",
    option_b: "Que pueden retrasar el procedimiento.",
    option_c: "Que son manifiestamente improcedentes o innecesarias.",
    option_d: "Que no interesan a la Administración.",
    correct_option: "C",
    article_reference: "77",
    explanation: "El artículo 77.3 exige que el rechazo se base en que las pruebas son manifiestamente improcedentes o innecesarias, y debe hacerse mediante resolución motivada. Esta limitación protege el derecho fundamental a la prueba de los interesados en el procedimiento administrativo."
  },
  {
    question_text: "Según el artículo 83.3 de la Ley 39/2015, ¿en qué fase del procedimiento se abre la información pública?",
    option_a: "Al inicio del procedimiento.",
    option_b: "Tras la fase de instrucción del procedimiento.",
    option_c: "Durante la fase de audiencia.",
    option_d: "Después de dictar la resolución.",
    correct_option: "B",
    article_reference: "83",
    explanation: "El artículo 83.3 establece que la información pública se abre tras la fase de instrucción del procedimiento. Esto permite que la participación ciudadana se produzca una vez que se ha reunido toda la información necesaria y antes de adoptar la decisión definitiva."
  },
  {
    question_text: "En los procedimientos donde se requiera información pública, según el artículo 83 de la Ley 39/2015:",
    option_a: "Se sustituye por el trámite de audiencia.",
    option_b: "Se realiza simultáneamente con el trámite de audiencia.",
    option_c: "Se realiza independientemente del trámite de audiencia.",
    option_d: "Es incompatible con el trámite de audiencia.",
    correct_option: "C",
    article_reference: "83",
    explanation: "El artículo 83 regula la información pública como un trámite independiente del de audiencia. Ambos persiguen objetivos distintos: la audiencia protege los derechos de los interesados específicos, mientras que la información pública permite la participación ciudadana general en asuntos de interés público."
  },
  {
    question_text: "Según el artículo 75 de la Ley 39/2015, ¿qué deben asegurar las medidas adoptadas por el órgano instructor?",
    option_a: "La rapidez del procedimiento exclusivamente.",
    option_b: "El pleno respeto a los principios de contradicción e igualdad.",
    option_c: "El mínimo coste del procedimiento.",
    option_d: "La conformidad de todos los interesados.",
    correct_option: "B",
    article_reference: "75",
    explanation: "El artículo 75.4 obliga al órgano instructor a adoptar medidas que aseguren el pleno respeto a los principios de contradicción e igualdad. Estos principios fundamentales garantizan que todas las partes tengan las mismas oportunidades de defensa y conocimiento mutuo de sus argumentos."
  },
  {
    question_text: "¿Cuándo vinculan a la Administración los hechos declarados probados por resoluciones judiciales según el artículo 77.4?",
    option_a: "Solo cuando son resoluciones civiles.",
    option_b: "Cuando son resoluciones judiciales penales firmes.",
    option_c: "Solo cuando afectan al mismo órgano administrativo.",
    option_d: "Nunca vinculan a la Administración.",
    correct_option: "B",
    article_reference: "77",
    explanation: "El artículo 77.4 establece que vinculan los hechos declarados probados por resoluciones judiciales penales firmes. Esta vinculación respeta la autoridad de la jurisdicción penal en la determinación de hechos, evitando contradicciones entre resoluciones judiciales y administrativas sobre los mismos hechos."
  }
];

async function addInstruccionQuestions() {
  try {
    console.log('🔍 INICIANDO SCRIPT INSTRUCCIÓN DEL PROCEDIMIENTO...\n');

    // 1. Buscar el content scope de instrucción
    const { data: contentScope, error: scopeError } = await supabase
      .from('content_scope')
      .select('*')
      .eq('id', 'e9b43aaf-ddb7-4a65-93c1-9a92bd97c843')
      .single();

    if (scopeError) {
      console.log('❌ Error buscando content scope:', scopeError.message);
      return;
    }

    console.log('✅ Content scope encontrado:', contentScope.id);

    // 2. Buscar la ley 39/2015
    const { data: law, error: lawError } = await supabase
      .from('laws')
      .select('id')
      .eq('short_name', 'Ley 39/2015')
      .single();

    if (lawError) {
      console.log('❌ Error buscando ley:', lawError.message);
      return;
    }

    console.log('✅ Ley encontrada:', law.id);

    // 3. Obtener artículos disponibles
    const { data: articles, error: articlesError } = await supabase
      .from('articles')
      .select('id, article_number, title')
      .eq('law_id', law.id);

    if (articlesError) {
      console.log('❌ Error obteniendo artículos:', articlesError.message);
      return;
    }

    console.log('✅ Artículos disponibles:', articles.length);

    // 4. Procesar y añadir preguntas de instrucción
    let addedCount = 0;
    let errorCount = 0;

    for (const questionData of instruccionQuestions) {
      // Buscar el artículo correspondiente
      const article = articles.find(a => a.article_number === questionData.article_reference);
      
      if (!article) {
        console.log('❌ Artículo no encontrado:', questionData.article_reference);
        errorCount++;
        continue;
      }

      // Preparar la pregunta para inserción
      const questionInsert = {
        question_text: questionData.question_text,
        option_a: questionData.option_a,
        option_b: questionData.option_b,
        option_c: questionData.option_c,
        option_d: questionData.option_d,
        correct_option: letterToNumber(questionData.correct_option),
        explanation: questionData.explanation,
        primary_article_id: article.id,
        difficulty: 'medium',
        question_type: 'single',
        is_official_exam: false,
        is_active: true
      };

      // Insertar pregunta
      const { data, error } = await supabase
        .from('questions')
        .insert(questionInsert)
        .select();

      if (error) {
        console.log('❌ Error insertando pregunta:', error.message);
        errorCount++;
      } else {
        addedCount++;
        console.log(`✅ Pregunta ${addedCount} añadida: ${questionData.question_text.substring(0, 60)}...`);
      }
    }

    console.log('\n📊 RESUMEN INSTRUCCIÓN:');
    console.log('✅ Preguntas añadidas exitosamente:', addedCount);
    console.log('❌ Preguntas con errores:', errorCount);
    console.log('📝 Total procesadas:', instruccionQuestions.length);

    console.log('\n🎯 ESTADO FINAL SECCIÓN INSTRUCCIÓN:');
    console.log('📚 Sección: Procedimiento Administrativo: Instrucción');
    console.log('📄 Total preguntas en instrucción:', addedCount);
    console.log('🌐 URL: /test-oposiciones/procedimiento-administrativo/instruccion');

  } catch (error) {
    console.error('❌ Error general:', error.message);
  }
}

addInstruccionQuestions();