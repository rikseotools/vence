import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const letterToNumber = (letter) => {
  const map = { 'A': 0, 'B': 1, 'C': 2, 'D': 3 };
  return map[letter.toUpperCase()] ?? 0;
};

// 30 preguntas basadas en las imágenes proporcionadas
const questionsData = [
  {
    question_text: "En el procedimiento administrativo común, ¿qué ocurre si los hechos probados no constituyen, de modo manifiesto, infracción administrativa?",
    option_a: "Se fijarán de forma motivada los demás hechos que se consideren probados y su exacta calificación jurídica, y se determinará la infracción que, en su caso, aquéllos constituyan.",
    option_b: "El órgano instructor continuará el procedimiento, siendo necesario formular propuesta de resolución en todo caso.",
    option_c: "El órgano instructor resolverá la finalización del procedimiento, con archivo de las actuaciones, sin que sea necesaria la formulación de la propuesta de resolución.",
    option_d: "Todas las respuestas son incorrectas.",
    correct_option: "C",
    explanation: "**Finalización sin infracción**: Según el art. 89, cuando los hechos probados no constituyen de modo manifiesto infracción administrativa, el órgano instructor puede resolver directamente la finalización del procedimiento con archivo de actuaciones, sin necesidad de propuesta de resolución. Esto agiliza el procedimiento cuando queda claro que no hay infracción.",
    primary_article_number: "89"
  },
  {
    question_text: "Según la Ley 39/2015, respecto a la terminación convencional del procedimiento, indique cuál de las siguientes afirmaciones no es correcta respecto a la finalización del procedimiento por esta vía:",
    option_a: "Los acuerdos pueden insertarse en los procedimientos con carácter previo, vinculante o no, a la resolución que les ponga fin.",
    option_b: "Los acuerdos celebrados por las Administraciones Públicas deben realizarse con personas de Derecho público.",
    option_c: "Los acuerdos se celebrarán con el alcance, efectos y régimen jurídico específico que, en su caso, prevea la disposición que lo regule.",
    option_d: "Los acuerdos pueden versar sobre materias susceptibles de transacción.",
    correct_option: "B",
    explanation: "**Terminación convencional**: El art. 86 establece que las Administraciones pueden celebrar acuerdos con personas **tanto de Derecho público como privado**, no solo con personas de Derecho público. Esto permite mayor flexibilidad en la terminación convencional del procedimiento, siempre que no sean contrarios al ordenamiento jurídico.",
    primary_article_number: "86"
  },
  {
    question_text: "De conformidad con la Ley 39/2015, las actuaciones complementarias indispensables para resolver el procedimiento deberán practicarse en un plazo no superior a:",
    option_a: "30 días.",
    option_b: "10 días.",
    option_c: "15 días.",
    option_d: "7 días.",
    correct_option: "C",
    explanation: "**Plazo actuaciones complementarias**: El art. 87 establece que las actuaciones complementarias indispensables para resolver el procedimiento deberán practicarse en un plazo no superior a **15 días**. Durante este tiempo, el plazo para resolver queda suspendido, y tras su finalización los interesados tienen 7 días para alegaciones.",
    primary_article_number: "87"
  },
  {
    question_text: "El artículo 94 de la Ley 39/2015, de 1 de octubre, del Procedimiento Administrativo Común de las Administraciones Públicas regula el desistimiento y la renuncia por los interesados y señala en su apartado 5º que la Administración podrá limitar los efectos del desistimiento o la renuncia al interesado y seguir el procedimiento:",
    option_a: "Si la cuestión suscitada por la incoación del procedimiento entrañase interés general o fuera conveniente sustanciarla para su definición y esclarecimiento.",
    option_b: "Si la cuestión suscitada por la incoación del procedimiento fuese de orden público o fuera conveniente sustanciarla para su definición y esclarecimiento.",
    option_c: "Si la cuestión suscitada por la incoación del procedimiento estuviese relacionada con el ejercicio de funciones públicas o potestades administrativas o fuera conveniente sustanciarla para su definición y esclarecimiento.",
    option_d: "Si se hubiesen personado en el procedimiento terceros interesados e instasen estos su continuación.",
    correct_option: "A",
    explanation: "**Limitación del desistimiento**: El art. 94.5 permite a la Administración limitar los efectos del desistimiento cuando la cuestión entrañe **interés general** o sea conveniente sustanciarla para su definición y esclarecimiento. Esto evita que el interés público quede desprotegido por la voluntad del particular.",
    primary_article_number: "93"
  },
  {
    question_text: "La resolución de los procedimientos complementarios en materia sancionadora a los que se refiere el artículo 90.4 de la Ley 39/2015, de 1 de octubre, del Procedimiento Administrativo Común de las Administraciones Públicas:",
    option_a: "No será susceptible de recurso.",
    option_b: "Solo pondrá fin a la vía administrativa cuando sea favorable al responsable o presunto responsable.",
    option_c: "Pondrá fin a la vía administrativa.",
    option_d: "No será ejecutiva en tanto no haya transcurrido el plazo legalmente previsto sin que el interesado haya interpuesto recurso contencioso administrativo.",
    correct_option: "C",
    explanation: "**Procedimientos complementarios sancionadores**: Según el art. 90.4, la resolución de procedimientos complementarios en materia sancionadora **pondrá fin a la vía administrativa**. Esto significa que agota la vía administrativa y solo cabe recurso contencioso-administrativo, proporcionando seguridad jurídica al interesado.",
    primary_article_number: "90"
  },
  {
    question_text: "Según la Ley 39/2015, la resolución que ponga fin al procedimiento:",
    option_a: "Decidirá todas las cuestiones planteadas por los interesados no pudiendo pronunciarse sobre cuestiones conexas.",
    option_b: "Decidirá todas las cuestiones planteadas por los interesados y aquellas otras derivadas del mismo.",
    option_c: "Decidirá todas las cuestiones planteadas por los interesados y aquellas conexas que no hubieran sido planteadas por los interesados, sin necesidad de ponerlo en su conocimiento siempre y cuando el órgano competente para resolver dicte acuerdo motivado justificando este extremo.",
    option_d: "Decidirá todas las cuestiones planteadas por los interesados y aquellas conexas cuando se hubieran suscitado al inicio del procedimiento.",
    correct_option: "B",
    explanation: "**Contenido de la resolución**: El art. 88 establece que la resolución decidirá todas las cuestiones planteadas por los interesados **y aquellas otras derivadas del mismo**. Esto garantiza la completitud de la resolución y evita la necesidad de procedimientos adicionales para cuestiones relacionadas.",
    primary_article_number: "88"
  },
  {
    question_text: "De acuerdo con la Ley 39/2015, el órgano instructor resolverá la finalización de un procedimiento de carácter sancionador, con archivo de las actuaciones, sin que sea necesaria la formulación de la propuesta de resolución:",
    option_a: "Cuando la persona o personas interesadas hayan celebrado un acuerdo con la Administración, siempre que no sean contrarios al ordenamiento jurídico ni versen sobre materias no susceptibles de transacción y tengan por objeto satisfacer el interés público que tienen encomendado",
    option_b: "Cuando los hechos pudiesen constituir una infracción de carácter leve",
    option_c: "Cuando el infractor reconozca su responsabilidad",
    option_d: "Cuando se concluyera, en cualquier momento, que ha prescrito la infracción",
    correct_option: "D",
    explanation: "**Finalización por prescripción**: El art. 89 establece que cuando se concluya que ha prescrito la infracción, el órgano instructor resolverá la finalización con archivo de actuaciones sin propuesta de resolución. La prescripción extingue la responsabilidad administrativa automáticamente.",
    primary_article_number: "89"
  },
  {
    question_text: "De acuerdo con la Ley 39/2015, la aceptación de informes en la resolución que ponga fin al procedimiento administrativo:",
    option_a: "No servirán de motivación, salvo en el caso de informes preceptivos y vinculantes.",
    option_b: "Servirán de motivación a la resolución cuando se incorporen al texto de la resolución.",
    option_c: "No servirán de motivación, al contener estos siempre una sucinta referencia de hechos y fundamentos de derecho.",
    option_d: "Servirán de motivación a la resolución cuando se trate de informes preceptivos.",
    correct_option: "B",
    explanation: "**Informes como motivación**: Según el art. 88, los informes servirán de motivación a la resolución **cuando se incorporen al texto de la resolución**. La incorporación material al texto es lo que les otorga valor motivador, no su mera mención o referencia.",
    primary_article_number: "88"
  },
  {
    question_text: "Según la Ley 39/2015, los acuerdos celebrados entre Administraciones Públicas que pongan fin al procedimiento y no versen sobre materias propias de las Comunidades Autónomas, ¿de qué órgano requerirán aprobación expresa?:",
    option_a: "Del Consejo General del Poder Judicial.",
    option_b: "Del Consejo de Ministros.",
    option_c: "Del Ministerio para la Transformación Digital y de la Función Pública.",
    option_d: "Del Consejo de Estado.",
    correct_option: "B",
    explanation: "**Aprobación de acuerdos**: El art. 86.3 establece que requerirán aprobación expresa del **Consejo de Ministros** (u órgano equivalente de las CCAA) los acuerdos que versen sobre materias de la competencia directa de dicho órgano. Esto asegura el control político de decisiones importantes.",
    primary_article_number: "86"
  },
  {
    question_text: "Señale la respuesta incorrecta en relación con el contenido de la resolución en los procedimientos de carácter sancionador, de conformidad con lo establecido en el artículo 90.1 de la Ley 39/2015, de 1 de octubre, del Procedimiento Administrativo Común de las Administraciones Públicas:",
    option_a: "En el caso de procedimientos de carácter sancionador, la resolución fijará los hechos y, en su caso, la persona o personas responsables.",
    option_b: "En el caso de procedimientos de carácter sancionador, la resolución fijará la infracción o infracciones cometidas y la sanción o sanciones que se imponen, o bien la declaración de no existencia de infracción o responsabilidad.",
    option_c: "En el caso de procedimientos de carácter sancionador la resolución fijará el órgano competente para la resolución del procedimiento y la norma que le atribuya tal competencia, indicando la posibilidad de que el presunto responsable pueda reconocer voluntariamente su responsabilidad.",
    option_d: "En el caso de procedimientos de carácter sancionador, la resolución incluirá la valoración de las pruebas practicadas, en especial aquellas que constituyan los fundamentos básicos de la decisión.",
    correct_option: "C",
    explanation: "**Contenido resolución sancionadora**: El art. 90.1 no establece que la resolución deba fijar el órgano competente y la norma atributiva de competencia como contenido de la resolución. Estos aspectos deben determinarse antes del dictado de la resolución. La resolución se centra en hechos, responsables, infracciones, sanciones y valoración probatoria.",
    primary_article_number: "90"
  },
  {
    question_text: "El artículo 85 de la Ley 39/2015, de 1 de octubre, del Procedimiento Administrativo Común de las Administraciones Públicas regula la terminación en los procedimientos sancionadores. A tal efecto, el pago voluntario por el presunto responsable, en cualquier momento anterior a la resolución:",
    option_a: "No implicará la terminación del procedimiento, salvo en lo relativo a la reposición de la situación alterada o a la determinación de la indemnización por los daños y perjuicios causados por la comisión de la infracción.",
    option_b: "Implicará la terminación del procedimiento a todos los efectos, incluso en lo relativo a la reposición de la situación alterada o a la determinación de la indemnización por los daños y perjuicios causados por la comisión de la infracción, cuando la sanción tenga únicamente carácter pecuniario o bien quepa imponer una sanción pecuniaria y otra de carácter no pecuniario pero se ha justificado la improcedencia de la segunda.",
    option_c: "Implicará la terminación del procedimiento, salvo en lo relativo a la reposición de la situación alterada o a la determinación de la indemnización por los daños y perjuicios causados por la comisión de la infracción, cuando la sanción tenga únicamente carácter pecuniario o bien quepa imponer una sanción pecuniaria y otra de carácter no pecuniario pero se ha justificado la improcedencia de la segunda.",
    option_d: "No implicará la terminación del procedimiento, aunque la sanción tenga únicamente carácter pecuniario o bien quepa imponer una sanción pecuniaria y otra de carácter no pecuniario pero se haya justificado la improcedencia de la segunda.",
    correct_option: "C",
    explanation: "**Pago voluntario**: El art. 85 establece que el pago voluntario implica terminación del procedimiento **salvo en lo relativo a reposición de la situación alterada e indemnización**, cuando la sanción tenga carácter pecuniario únicamente o se haya justificado la improcedencia de la sanción no pecuniaria. Permite cerrar lo punitivo pero mantener lo reparador.",
    primary_article_number: "85"
  },
  {
    question_text: "En los procedimientos de carácter sancionador, tal y como señala el artículo 89.2 de la Ley 39/2015, de 1 de octubre, del Procedimiento Administrativo Común de las Administraciones Públicas, la propuesta de resolución:",
    option_a: "Deberá indicar la puesta de manifiesto del procedimiento y el plazo para formular alegaciones y presentar los documentos e informaciones que se estimen pertinentes.",
    option_b: "Deberá indicar el órgano competente para la resolución del procedimiento y la norma que le atribuya tal competencia, así como el plazo para formular alegaciones y presentar los documentos e informaciones que se estimen pertinentes.",
    option_c: "Deberá indicar la puesta de manifiesto del procedimiento, la calificación de los hechos y las sanciones que pudieran corresponder.",
    option_d: "Deberá indicar la persona o personas presuntamente responsables y presentar los documentos e informaciones que se estimen pertinentes.",
    correct_option: "A",
    explanation: "**Propuesta de resolución sancionadora**: El art. 89.2 establece que la propuesta de resolución debe indicar **la puesta de manifiesto del procedimiento y el plazo para alegaciones y documentos**. La puesta de manifiesto garantiza el derecho de defensa antes de la resolución final.",
    primary_article_number: "89"
  },
  {
    question_text: "Según la Ley 39/2015, en los procedimientos de carácter sancionador, ¿cómo resolverá el órgano instructor la finalización del procedimiento?",
    option_a: "Con archivo de las actuaciones, siendo necesaria en todo caso la formulación de una propuesta de resolución.",
    option_b: "Con archivo de las actuaciones, siendo necesaria la formulación de la propuesta de resolución cuando en la instrucción procedimiento se ponga de manifiesto que los hechos probados no constituyen, de modo manifiesto, infracción administrativa.",
    option_c: "Con archivo de las actuaciones, sin que sea necesaria la formulación de la propuesta de resolución, cuando en la instrucción procedimiento se ponga de manifiesto que ha prescrito la infracción.",
    option_d: "Con suspensión de las actuaciones cuando en la instrucción procedimiento se ponga de manifiesto que ha prescrito la infracción.",
    correct_option: "C",
    explanation: "**Finalización por prescripción**: El art. 89 permite al órgano instructor resolver con archivo de actuaciones **sin propuesta de resolución cuando ha prescrito la infracción**. La prescripción extingue automáticamente la potestad sancionadora, haciendo innecesaria la tramitación completa.",
    primary_article_number: "89"
  },
  {
    question_text: "De conformidad con lo establecido sobre la resolución del procedimiento en el artículo 88.1 de la Ley 39/2015, de 1 de octubre, del Procedimiento Administrativo Común de las Administraciones Públicas, cuando el órgano competente se pronuncie sobre cuestiones conexas que no hubieran sido planteadas por los interesados:",
    option_a: "Deberá ponerlo antes de manifiesto a los interesados por un plazo no superior a cinco días, para que formulen las alegaciones que estimen pertinentes y aporten, en su caso, los medios de prueba.",
    option_b: "Deberá ponerlo antes de manifiesto a los interesados por un plazo no superior a veinte días, para que formulen las alegaciones que estimen pertinentes y aporten, en su caso, los medios de prueba.",
    option_c: "Deberá ponerlo antes de manifiesto a los interesados por un plazo no superior a diez, para que formulen las alegaciones que estimen pertinentes y aporten, en su caso, los medios de prueba.",
    option_d: "Deberá ponerlo antes de manifiesto a los interesados por un plazo no superior a quince días, para que formulen las alegaciones que estimen pertinentes y aporten, en su caso, los medios de prueba.",
    correct_option: "D",
    explanation: "**Cuestiones conexas no planteadas**: El art. 88.1 establece que cuando el órgano se pronuncie sobre cuestiones conexas no planteadas por los interesados, debe ponerlo de manifiesto por un plazo no superior a **quince días** para alegaciones y pruebas. Esto garantiza el derecho de defensa.",
    primary_article_number: "88"
  },
  {
    question_text: "Conforme a la Ley 39/2015, cuando en la terminación de los procedimientos sancionadores el órgano competente para resolver aplique reducciones sobre el importe de la sanción propuesta, ¿qué aspecto debe tenerse en cuenta?:",
    option_a: "Las reducciones deberán estar determinadas en la notificación de iniciación del procedimiento.",
    option_b: "Su efectividad estará condicionada a la renuncia de cualquier recurso en vía administrativa contra la sanción.",
    option_c: "Su efectividad estará condicionada al desistimiento.",
    option_d: "Todas son correctas.",
    correct_option: "D",
    explanation: "**Reducciones en sanciones**: El art. 85 establece que las reducciones deben estar **determinadas en la notificación de iniciación**, su efectividad se condiciona a la **renuncia de recursos administrativos** y al **desistimiento**. Estas tres condiciones trabajan conjuntamente para incentivar la colaboración y agilizar el procedimiento.",
    primary_article_number: "85"
  },
  {
    question_text: "De conformidad con lo establecido en el artículo 95.2 de la Ley 39/2015, de 1 de octubre, del Procedimiento Administrativo Común de las Administraciones Públicas:",
    option_a: "Solo podrá acordarse la caducidad por la simple inactividad del interesado en la cumplimentación de trámites cuando no sean indispensables para dictar resolución.",
    option_b: "No podrá acordarse la caducidad por la simple inactividad del interesado en la cumplimentación de trámites, siempre que no sean indispensables para dictar resolución. Dicha inactividad no tendrá otro efecto que la pérdida de su derecho al referido trámite.",
    option_c: "No podrá acordarse la caducidad por la simple inactividad del interesado en la cumplimentación de trámites, siempre que no sean indispensables para dictar resolución, salvo autorización judicial expresa que habilite para ello.",
    option_d: "No podrá acordarse la caducidad por la simple inactividad del interesado en la cumplimentación de trámites, aunque sean indispensables para dictar resolución. Dicha inactividad no tendrá otro efecto que la pérdida de su derecho al referido trámite.",
    correct_option: "B",
    explanation: "**Caducidad por inactividad**: El art. 95.2 establece que **no puede acordarse caducidad** por simple inactividad en trámites no indispensables para resolver. Esta inactividad solo produce la **pérdida del derecho al trámite específico**, protegiendo así el derecho fundamental a la tutela administrativa efectiva.",
    primary_article_number: "95"
  },
  {
    question_text: "Conforme a la Ley 39/2015, ¿existe algún supuesto en que la Administración pueda desistir del procedimiento administrativo?:",
    option_a: "No, a la Administración no se le reconoce el derecho de desistimiento ni renuncia.",
    option_b: "Sí, pero solo en los procedimientos sancionadores, motivadamente y en los supuestos y con los requisitos previstos en las Leyes.",
    option_c: "Sí, en los procedimientos iniciados de oficio, motivadamente y en los supuestos y con los requisitos previstos en las Leyes.",
    option_d: "Sí, en los procedimientos iniciados de oficio o a instancia de parte, motivadamente y en los supuestos y con los requisitos previstos en las Leyes.",
    correct_option: "C",
    explanation: "**Desistimiento administrativo**: El art. 93 permite a la Administración desistir en **procedimientos iniciados de oficio**, motivadamente y en los supuestos previstos en las leyes. No cabe en procedimientos a instancia de parte, donde el interés del solicitante debe ser respetado salvo causas legalmente previstas.",
    primary_article_number: "93"
  },
  {
    question_text: "Según el artículo 90 de la Ley 39/2015, en la resolución de los procedimientos sancionadores, cuando las conductas sancionadas hubieran causado daños o perjuicios a las Administraciones y la cuantía no hubiera quedado determinada en el expediente:",
    option_a: "La resolución del procedimiento que fije la cuantía indeterminada podrá ser ejecutiva.",
    option_b: "La cuantía se fijará mediante un procedimiento complementario.",
    option_c: "Este procedimiento no será susceptible de terminación convencional.",
    option_d: "Podrá interponerse recurso de alzada en los términos señalados legalmente.",
    correct_option: "B",
    explanation: "**Procedimiento complementario**: El art. 90 establece que cuando los daños no tengan cuantía determinada en el expediente, **se fijará mediante procedimiento complementario**. Esto permite una correcta determinación de la indemnización sin retrasar innecesariamente la sanción principal.",
    primary_article_number: "90"
  },
  {
    question_text: "De conformidad con lo establecido en el artículo 95.3 de la Ley 39/2015, de 1 de octubre, del Procedimiento Administrativo Común de las Administraciones Públicas en relación a la caducidad:",
    option_a: "En los casos en los que sea posible la iniciación de un nuevo procedimiento por no haberse producido la prescripción, podrán incorporarse a éste los actos y trámites cuyo contenido se hubiera mantenido igual de no haberse producido la caducidad. En todo caso, en el nuevo procedimiento no podrá cumplimentarse ningún trámite que suponga una reiteración de los ya realizados en el procedimiento caducado, incluidas la proposición de prueba y audiencia al interesado.",
    option_b: "En los casos en los que sea posible la iniciación de un nuevo procedimiento por no haberse producido la prescripción, podrán incorporarse a éste los actos y trámites cuyo contenido se hubiera mantenido igual de no haberse producido la caducidad. En todo caso, en el nuevo procedimiento deberán cumplimentarse los trámites de solicitud de informes y de información pública.",
    option_c: "En los casos en los que sea posible la iniciación de un nuevo procedimiento por no haberse producido la prescripción, podrán incorporarse a éste los actos y trámites cuyo contenido se hubiera mantenido igual de no haberse producido la caducidad. En todo caso, en el nuevo procedimiento deberán cumplimentarse los trámites de alegaciones, proposición de prueba y audiencia al interesado.",
    option_d: "En los casos en los que sea posible la iniciación de un nuevo procedimiento por no haberse producido la prescripción, no podrán incorporarse a éste los actos y trámites del procedimiento caducado, aunque su contenido se hubiera mantenido igual de no haberse producido la caducidad. En todo caso, en el nuevo procedimiento deberán cumplimentarse los trámites de alegaciones, proposición de prueba y audiencia al interesado.",
    correct_option: "C",
    explanation: "**Nuevo procedimiento tras caducidad**: El art. 95.3 permite incorporar actos cuyo contenido se hubiera mantenido igual, pero establece que **deben cumplimentarse alegaciones, proposición de prueba y audiencia al interesado**. Estos trámites esenciales del derecho de defensa no pueden obviarse nunca.",
    primary_article_number: "95"
  },
  {
    question_text: "La imposibilidad material de continuar el procedimiento por causas sobrevenidas producirá, según el artículo 84.2 de la Ley 39/2015, de 1 de octubre, del Procedimiento Administrativo Común de las Administraciones Públicas:",
    option_a: "La suspensión del plazo máximo legal para resolver un procedimiento y notificar la resolución.",
    option_b: "La prescripción.",
    option_c: "La interrupción del cómputo del plazo para resolver y notificar la resolución.",
    option_d: "La terminación del procedimiento.",
    correct_option: "D",
    explanation: "**Imposibilidad material sobrevenida**: El art. 84.2 establece que la imposibilidad material de continuar por causas sobrevenidas produce **la terminación del procedimiento**. Cuando es materialmente imposible continuar (ej: fallecimiento del único interesado), el procedimiento debe cesar definitivamente.",
    primary_article_number: "84"
  },
  {
    question_text: "De acuerdo con la Ley 39/2015, en los procedimientos sancionadores que se resuelvan con una resolución ejecutiva y se suspenda la misma cautelarmente, ¿cuándo finalizará esta suspensión cautelar?:",
    option_a: "Cuando el interesado haya interpuesto recurso contencioso administrativo, aún habiendo transcurrido el plazo legalmente previsto.",
    option_b: "Cuando haya transcurrido el plazo legalmente previsto sin que el interesado haya interpuesto recurso contencioso administrativo.",
    option_c: "Cuando habiendo el interesado interpuesto recurso contencioso-administrativo, se haya solicitado en el mismo trámite la suspensión cautelar de la resolución impugnada.",
    option_d: "Cuando habiendo el interesado interpuesto recurso contencioso-administrativo, el órgano judicial no se pronuncie de manera motivada sobre la suspensión cautelar solicitada.",
    correct_option: "B",
    explanation: "**Suspensión cautelar en sancionadores**: Según el art. 90, la suspensión cautelar finaliza **cuando transcurre el plazo sin interponer recurso contencioso-administrativo**. Si no se recurre en plazo, la resolución deviene firme y la suspensión carece de objeto, pudiendo ejecutarse inmediatamente.",
    primary_article_number: "90"
  },
  {
    question_text: "Conforme a la Ley 39/2015, indique cuál de las siguientes afirmaciones no es correcta respecto a la resolución que ponga fin a los procedimientos sancionadores:",
    option_a: "Cuando sea ejecutiva se podrán adoptar en la misma las disposiciones cautelares precisas para garantizar su eficacia.",
    option_b: "La resolución que ponga fin al procedimiento será ejecutiva cuando no quepa contra ella ningún recurso ordinario en vía civil o penal.",
    option_c: "Será ejecutiva cuando no quepa contra ella ningún recurso ordinario en vía administrativa.",
    option_d: "Cuando la resolución sea ejecutiva, se podrá suspender cautelarmente, si el interesado manifiesta a la Administración su intención de interponer recurso contencioso-administrativo.",
    correct_option: "B",
    explanation: "**Ejecutividad en sancionadores**: El art. 90 establece que la resolución es ejecutiva cuando no cabe recurso ordinario **en vía administrativa**, no en vía civil o penal. Los recursos civiles o penales son independientes del ámbito administrativo y no condicionan la ejecutividad de la resolución administrativa.",
    primary_article_number: "90"
  },
  {
    question_text: "Según lo dispuesto en la Ley 39/2015, la competencia para la resolución de los procedimientos de responsabilidad patrimonial en el ámbito autonómico y local, corresponde:",
    option_a: "Al órgano previsto por las normas que determinen su régimen jurídico.",
    option_b: "Al Ministro competente.",
    option_c: "A los órganos correspondientes de las Comunidades Autónomas o de las Entidades que integran la Administración Local.",
    option_d: "Al Consejo de Ministros.",
    correct_option: "C",
    explanation: "**Competencia responsabilidad patrimonial**: El art. 92 establece que la competencia corresponde **a los órganos de las CCAA o Entidades de Administración Local**. Cada nivel administrativo tiene competencia para resolver sobre su propia responsabilidad patrimonial, respetando el principio de autonomía administrativa.",
    primary_article_number: "92"
  },
  {
    question_text: "De conformidad con el artículo 93 de la Ley 39/2015, en los procedimientos iniciados de oficio, la Administración podrá desistir:",
    option_a: "Motivadamente en los supuestos y con los requisitos previstos en las leyes",
    option_b: "Motivadamente y sólo en los procedimientos sancionadores",
    option_c: "Discrecionalmente, pero motivando su decisión",
    option_d: "Discrecionalmente, sin más requisitos",
    correct_option: "A",
    explanation: "**Desistimiento administrativo**: El art. 93 permite el desistimiento **motivadamente en los supuestos y con los requisitos previstos en las leyes**. No es una facultad discrecional absoluta, sino que debe estar habilitada legalmente y cumplir los requisitos específicos que establezca cada normativa sectorial.",
    primary_article_number: "93"
  },
  {
    question_text: "De acuerdo con la Ley 39/2015 y respecto a los acuerdos celebrados entre las Administraciones Públicas y personas de Derecho privado que pongan fin al procedimiento administrativo, indique cuál de los siguientes no debe incluirse como contenido mínimo en los mismos:",
    option_a: "Las personas a las que estuvieran destinados.",
    option_b: "El ámbito personal, funcional y territorial.",
    option_c: "El plazo de vigencia.",
    option_d: "Los recursos que caben frente al acuerdo y el órgano competente para resolverlos.",
    correct_option: "D",
    explanation: "**Contenido mínimo acuerdos**: El art. 86.2 establece como contenido mínimo: identificación de partes, ámbito personal/funcional/territorial, y plazo de vigencia. **No incluye recursos contra el acuerdo** como contenido mínimo obligatorio, pues estos se rigen por las normas generales sobre impugnación de actos administrativos.",
    primary_article_number: "86"
  },
  {
    question_text: "Conforme al artículo 84 de la Ley 39/2015, ¿cuál de las siguientes no pone fin al procedimiento administrativo?:",
    option_a: "La prescripción.",
    option_b: "El desistimiento.",
    option_c: "La renuncia al derecho en que se funde la solicitud.",
    option_d: "La declaración de caducidad.",
    correct_option: "A",
    explanation: "**Formas de terminación**: El art. 84 incluye desistimiento, renuncia y caducidad como formas de terminación. **La prescripción no aparece** en este artículo como forma de terminación del procedimiento, aunque sí puede producir efectos extintivos de derechos o acciones, se regula en otras normas específicas.",
    primary_article_number: "84"
  },
  {
    question_text: "Según el artículo 88 de la Ley 39/2015, la aceptación de informes servirá de motivación a la resolución:",
    option_a: "Cuando se incorporen al expediente.",
    option_b: "Cuando la resolución se remita a ellos.",
    option_c: "Cuando hayan sido notificados a los interesados.",
    option_d: "Cuando la resolución los incorpore al texto de la misma.",
    correct_option: "D",
    explanation: "**Informes como motivación**: El art. 88 establece que los informes servirán de motivación **cuando la resolución los incorpore al texto de la misma**. No basta con su mera incorporación al expediente o referencia, sino que deben formar parte material del texto resolutorio para tener valor motivador.",
    primary_article_number: "88"
  },
  {
    question_text: "El artículo 88.4 de la Ley 39/2015, de 1 de octubre, del Procedimiento Administrativo Común de las Administraciones Públicas establece que la resolución del procedimiento:",
    option_a: "Se dictará electrónicamente y garantizará la identidad del órgano competente, así como la autenticidad e integridad del documento que se formalice, sin perjuicio de la forma y lugar señalados por el interesado para la práctica de las notificaciones.",
    option_b: "Se dictará en formato papel y garantizará la identidad del órgano competente, así como la autenticidad e integridad del documento que se formalice, sin perjuicio de la forma y lugar señalados por el interesado para la práctica de las notificaciones.",
    option_c: "Se dictará electrónicamente o en formato papel, a elección del interesado, y garantizará la identidad del órgano competente, así como la autenticidad e integridad del documento que se formalice.",
    option_d: "Se dictará electrónicamente y garantizará la identidad del órgano competente, así como la transparencia y objetividad del documento que se formalice, sin perjuicio de la forma y lugar señalados por el interesado para la práctica de las notificaciones.",
    correct_option: "A",
    explanation: "**Formato de la resolución**: El art. 88.4 establece que se dictará **electrónicamente** garantizando identidad del órgano, **autenticidad e integridad** del documento, sin perjuicio de la forma elegida por el interesado para notificaciones. La resolución siempre es electrónica, pero la notificación puede adaptarse a las preferencias del interesado.",
    primary_article_number: "88"
  },
  {
    question_text: "Conforme a la Ley 39/2015, indique qué efecto produce la realización de las actuaciones complementarias:",
    option_a: "La suspensión del procedimiento hasta la práctica de las actuaciones complementarias.",
    option_b: "La tramitación separada de la actuaciones complementarias y la continuación del procedimiento hasta la resolución de aquellas.",
    option_c: "La suspensión del procedimiento hasta la terminación de las actuaciones complementarias.",
    option_d: "La tramitación separada de la actuaciones complementarias y la continuación del procedimiento hasta la práctica de aquellas.",
    correct_option: "C",
    explanation: "**Efectos actuaciones complementarias**: El art. 87 establece que las actuaciones complementarias producen **la suspensión del procedimiento hasta la terminación** de las mismas. No es una tramitación separada, sino que el procedimiento principal queda en suspenso hasta completar estas actuaciones indispensables.",
    primary_article_number: "87"
  },
  {
    question_text: "Conforme a la Ley 39/2015, indique cuál de las siguientes no es correcta respecto a los aspectos que se deben fijar en la propuesta de resolución:",
    option_a: "La infracción que en su caso constituyan los hechos probados.",
    option_b: "Las medidas provisionales que en su caso, se hubieran adoptado.",
    option_c: "Los hechos que se consideren probados con su exacta calificación jurídica, y los no probados.",
    option_d: "La valoración de las pruebas practicadas, en especial aquellas que constituyan los fundamentos básicos de la decisión.",
    correct_option: "B",
    explanation: "**Contenido propuesta de resolución**: El art. 89 establece que debe contener: hechos probados y no probados con calificación jurídica, infracciones, valoración probatoria. **Las medidas provisionales no son contenido** de la propuesta de resolución, sino que se adoptan durante la instrucción y se mencionan en otros contextos del procedimiento.",
    primary_article_number: "89"
  }
];

async function addFinalizacionQuestions() {
  try {
    console.log('🔍 INICIANDO PROCESO DE ADICIÓN DE PREGUNTAS FINALIZACIÓN...\n');
    
    // 1. Verificar sección existe
    const { data: section, error: sectionError } = await supabase
      .from('content_sections')
      .select('id, name')
      .eq('slug', 'finalizacion-procedimiento')
      .single();
    
    if (sectionError || !section) {
      throw new Error('❌ Sección finalización-procedimiento no existe. Crear primero.');
    }
    
    console.log('✅ Sección encontrada:', section.name);
    
    // 2. Verificar artículos existen
    const requiredArticles = ['84', '85', '86', '87', '88', '89', '90', '92', '93', '95'];
    const { data: law } = await supabase
      .from('laws')
      .select('id')
      .eq('short_name', 'Ley 39/2015')
      .single();
    
    const { data: articles, error: articlesError } = await supabase
      .from('articles')
      .select('id, article_number')
      .eq('law_id', law.id)
      .in('article_number', requiredArticles);
    
    if (articles.length !== requiredArticles.length) {
      const missing = requiredArticles.filter(req => 
        !articles.find(art => art.article_number === req)
      );
      throw new Error(`❌ Artículos faltantes: ${missing.join(', ')}`);
    }
    
    console.log('✅ Todos los artículos existen\n');
    
    // 3. Procesar preguntas
    let successCount = 0;
    let errorCount = 0;
    
    for (const [index, questionData] of questionsData.entries()) {
      try {
        const article = articles.find(a => a.article_number === questionData.primary_article_number);
        
        if (!article) {
          console.log(`⚠️ Saltando pregunta ${index + 1}: artículo ${questionData.primary_article_number} no encontrado`);
          errorCount++;
          continue;
        }
        
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
        
        const { data, error } = await supabase
          .from('questions')
          .insert(questionInsert)
          .select('id, question_text');
        
        if (error) {
          console.log(`❌ Error pregunta ${index + 1}:`, error.message);
          errorCount++;
        } else {
          console.log(`✅ Pregunta ${index + 1} añadida: ${data[0].question_text.substring(0, 60)}...`);
          successCount++;
        }
        
      } catch (questionError) {
        console.log(`❌ Error procesando pregunta ${index + 1}:`, questionError.message);
        errorCount++;
      }
    }
    
    console.log(`\n📊 RESUMEN FINAL:`);
    console.log(`✅ Preguntas añadidas exitosamente: ${successCount}`);
    console.log(`❌ Preguntas con errores: ${errorCount}`);
    console.log(`📝 Total procesadas: ${successCount + errorCount}`);
    
  } catch (error) {
    console.error('❌ Error general:', error.message);
  }
}

addFinalizacionQuestions();