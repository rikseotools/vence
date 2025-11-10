import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const letterToNumber = (letter) => {
  const map = { 'A': 0, 'B': 1, 'C': 2, 'D': 3 };
  return map[letter.toUpperCase()] ?? 0;
};

// 24 preguntas adicionales basadas en las nuevas imágenes
const questionsData = [
  {
    question_text: "Según la Ley 39/2015, en los procedimientos iniciados a solicitud del interesado, cuando se produzca su paralización por causa imputable al mismo, ¿en qué plazo le advertirá la Administración que transcurrido éste se producirá la caducidad del procedimiento?",
    option_a: "Transcurrido 1 mes.",
    option_b: "Transcurridos tres meses.",
    option_c: "Transcurridos seis meses.",
    option_d: "Transcurrido un año.",
    correct_option: "B",
    explanation: "**Advertencia de caducidad**: El art. 95 establece que cuando se produzca paralización por causa imputable al interesado, la Administración le advertirá que **transcurridos tres meses** se producirá la caducidad. Esto da una oportunidad razonable al interesado para reactivar el procedimiento antes de perder definitivamente su derecho.",
    primary_article_number: "95"
  },
  {
    question_text: "De acuerdo con la Ley 39/2015, las resoluciones que pongan fin al procedimiento administrativo, contendrán:",
    option_a: "La decisión, los recursos que contra la misma procedan, órgano administrativo o judicial ante el que hubieran de presentarse y plazo para interponerlos y, según los casos, indicación de la apertura de un nuevo procedimiento para la resolución de las cuestiones conexas pendientes de resolver.",
    option_b: "La decisión, los recursos que contra la misma procedan, órgano administrativo o judicial ante el que hubieran de presentarse, plazo para interponerlos e indicación de otras actuaciones que puedan ejercitar los interesados.",
    option_c: "La decisión, los recursos que contra la misma procedan, órgano administrativo o judicial ante el que hubieran de presentarse y plazo para interponerlos con indicación del plazo para la aportación de las pruebas que se estimen necesarias.",
    option_d: "La decisión, los recursos que contra la misma procedan, órgano administrativo o judicial ante el que hubieran de presentarse y plazo para interponerlos.",
    correct_option: "D",
    explanation: "**Contenido esencial de la resolución**: El art. 88 establece que las resoluciones deben contener **la decisión, los recursos procedentes, órgano ante el que presentarlos y plazo**. Estos son los elementos mínimos esenciales. Las demás opciones añaden elementos que no son obligatorios según este artículo.",
    primary_article_number: "88"
  },
  {
    question_text: "De conformidad con la Ley 39/2015, en los procedimientos de carácter sancionador, concluida la instrucción el órgano instructor formulará una propuesta de resolución. Indique cuál de los siguientes no es un requisito necesario de la misma:",
    option_a: "Deberá detallar la pruebas que no han sido admitidas, la causa de inadmisión y la posibilidad de recurrir las mismas ante el órgano competente para resolver.",
    option_b: "Deberá indicar la puesta de manifiesto del procedimiento.",
    option_c: "Deberá ser notificada a los interesados.",
    option_d: "Deberá indicar el plazo para formular alegaciones y presentar los documentos e informaciones que se estimen pertinentes.",
    correct_option: "A",
    explanation: "**Requisitos propuesta de resolución**: El art. 89 establece que debe indicar puesta de manifiesto, ser notificada y establecer plazo para alegaciones. **No exige detallar pruebas no admitidas** como contenido obligatorio de la propuesta de resolución, aunque puedan haberse producido inadmisiones durante la instrucción.",
    primary_article_number: "89"
  },
  {
    question_text: "Los acuerdos que se suscriban entre las Administraciones Públicas y personas tanto de Derecho público como privado que pongan fin al procedimiento administrativo no supondrán, a tenor de lo dispuesto en el artículo 86.4 de la Ley 39/2015, de 1 de octubre, del Procedimiento Administrativo Común de las Administraciones Públicas:",
    option_a: "Alteración de las competencias atribuidas a los órganos administrativos, ni de las responsabilidades que correspondan a las autoridades y funcionarios, relativas al funcionamiento de los servicios públicos.",
    option_b: "Suspensión del plazo máximo legal para resolver un procedimiento y notificar la resolución.",
    option_c: "La renuncia al derecho en que se funda la solicitud.",
    option_d: "Ampliación del plazo máximo legal para resolver un procedimiento y notificar la resolución.",
    correct_option: "A",
    explanation: "**Límites de la terminación convencional**: El art. 86.4 establece expresamente que los acuerdos **no supondrán alteración de competencias ni responsabilidades** de autoridades y funcionarios. Esto protege la integridad del sistema organizativo administrativo, evitando que los acuerdos alteren las bases competenciales legalmente establecidas.",
    primary_article_number: "86"
  },
  {
    question_text: "De acuerdo con la Ley 39/2015, en los procedimientos sancionadores se prevén reducciones en las sanciones pecuniarias, ¿cómo podrán ser incrementadas estas reducciones?:",
    option_a: "Reglamentariamente.",
    option_b: "Por acuerdo motivado del órgano competente para resolver el procedimiento.",
    option_c: "Por Ley.",
    option_d: "Por acuerdo motivado del órgano competente para instruir el procedimiento.",
    correct_option: "A",
    explanation: "**Incremento de reducciones**: El art. 85 establece que las reducciones en procedimientos sancionadores podrán ser incrementadas **reglamentariamente**. Esto permite adaptar los incentivos según las especificidades de cada materia sancionadora, manteniendo la coherencia normativa a través del desarrollo reglamentario.",
    primary_article_number: "85"
  },
  {
    question_text: "Conforme a la Ley 39/2015, la Administración aceptará de plano el desistimiento o la renuncia, y declarará concluso el procedimiento salvo que:",
    option_a: "Habiéndose personado en el mismo terceros interesados, instasen éstos su continuación en el plazo de quince días desde que fueron notificados del desistimiento o renuncia.",
    option_b: "Habiéndose personado en el mismo terceros interesados, instasen éstos su continuación en el plazo de diez días desde que fueron notificados del desistimiento o renuncia.",
    option_c: "Habiéndose personado en el mismo terceros interesados, instasen éstos su continuación en el plazo de treinta días desde que fueron notificados del desistimiento o renuncia.",
    option_d: "Habiéndose personado en el mismo terceros interesados, instasen éstos su continuación en el plazo de veinte días desde que fueron notificados del desistimiento o renuncia.",
    correct_option: "B",
    explanation: "**Terceros interesados y desistimiento**: El art. 94 establece que cuando se hayan personado terceros interesados, estos pueden instar la continuación en un plazo de **diez días** desde la notificación del desistimiento o renuncia. Esto protege los derechos de terceros que tienen interés legítimo en la continuación del procedimiento.",
    primary_article_number: "93"
  },
  {
    question_text: "Según la Ley 39/2015, ¿en qué plazo deberán practicarse las actuaciones complementarias?:",
    option_a: "En un plazo no superior a diez días.",
    option_b: "En un plazo no superior a cinco días.",
    option_c: "En un plazo no superior a quince días.",
    option_d: "En un plazo no superior a veinte días.",
    correct_option: "C",
    explanation: "**Plazo actuaciones complementarias**: El art. 87 establece que las actuaciones complementarias indispensables para resolver deberán practicarse **en un plazo no superior a quince días**. Durante este plazo, el cómputo del plazo para resolver queda suspendido, garantizando que no se penalice a la Administración por realizar actuaciones necesarias para una correcta resolución.",
    primary_article_number: "87"
  },
  {
    question_text: "De acuerdo con la ley 39/2015, ¿cuál de los siguientes efectos no se produce por la caducidad del procedimiento?:",
    option_a: "La caducidad producirá por sí sola la prescripción de las acciones de la Administración.",
    option_b: "Podrá no ser aplicable la caducidad en el supuesto de que la cuestión suscitada afecte al interés general, o fuera conveniente sustanciarla para su definición y esclarecimiento.",
    option_c: "Los procedimientos caducados no interrumpirán el plazo de prescripción.",
    option_d: "La caducidad no producirá por sí sola la prescripción de las acciones del particular.",
    correct_option: "A",
    explanation: "**Efectos de la caducidad**: El art. 95 establece que la caducidad **no produce por sí sola la prescripción** de las acciones de la Administración. La caducidad extingue el procedimiento concreto, pero no afecta automáticamente a los plazos de prescripción, que siguen su curso independiente según su regulación específica.",
    primary_article_number: "95"
  },
  {
    question_text: "Conforme a la Ley 39/2015, ¿cuál de las siguientes afirmaciones no es correcta respecto al archivo de las actuaciones por caducidad del procedimiento?:",
    option_a: "Contra la resolución que declare la caducidad no cabe recurso alguno.",
    option_b: "Debe tratarse de procedimientos iniciados a solicitud del interesado.",
    option_c: "Con carácter general, es necesario que la paralización del procedimiento se produzca por causa imputable al interesado que inició el procedimiento.",
    option_d: "Deben haber transcurrido tres meses sin que el particular requerido realice las actividades necesarias para reanudar la tramitación.",
    correct_option: "A",
    explanation: "**Recurso contra caducidad**: La opción A es incorrecta porque **sí cabe recurso** contra la resolución que declare la caducidad. La caducidad es un acto administrativo que puede ser impugnado por los medios ordinarios si el interesado considera que no se dan los requisitos legales para su declaración.",
    primary_article_number: "95"
  },
  {
    question_text: "De acuerdo con la Ley 39/2015 y referente a la resolución de los procedimientos sancionadores, indique la correcta de las siguientes afirmaciones:",
    option_a: "Se podrán aceptar hechos distintos de los determinados en el curso del procedimiento cuando el órgano competente para resolver considere que la infracción o la sanción revisten mayor gravedad que la determinada en la propuesta de resolución.",
    option_b: "No se podrán aceptar hechos distintos de los determinados en el curso del procedimiento.",
    option_c: "Se podrán aceptar hechos distintos de los determinados en el curso del procedimiento dependiendo de su valoración jurídica.",
    option_d: "Se podrán aceptar hechos distintos de los determinados en el curso del procedimiento cuando el órgano competente para resolver considere que la infracción o la sanción revisten menor gravedad que la determinada en la propuesta de resolución.",
    correct_option: "B",
    explanation: "**Principio de congruencia en sancionadores**: El art. 90 establece que en procedimientos sancionadores **no se podrán aceptar hechos distintos** de los determinados durante el procedimiento. Esto garantiza el derecho de defensa, ya que el interesado debe haber tenido oportunidad de defenderse respecto de todos los hechos que sirvan de base a la sanción.",
    primary_article_number: "90"
  },
  {
    question_text: "Conforme a la Ley 39/2015, ¿cómo deberá realizarse el desistimiento o la renuncia en el procedimiento administrativo?:",
    option_a: "Tanto el desistimiento como la renuncia deberán hacerse electrónicamente, siempre que se indique al menos, la identificación de las partes en el procedimiento, el órgano competente para resolver y se incorpore las firmas que correspondan de acuerdo con lo previsto en la normativa aplicable.",
    option_b: "Tanto el desistimiento como la renuncia deberán hacerse electrónicamente, siempre que se indique al menos, el número de procedimiento afectado, la identificación de las partes en el procedimiento, el órgano competente para resolver y se incorpore las firmas que correspondan de acuerdo con lo previsto en la normativa aplicable.",
    option_c: "Tanto el desistimiento como la renuncia podrán hacerse por cualquier medio que permita su constancia, siempre que incorpore las firmas que correspondan de acuerdo con lo previsto en la normativa aplicable.",
    option_d: "Tanto el desistimiento como la renuncia deberán hacerse electrónicamente, siempre que incorpore las firmas que correspondan de acuerdo con lo previsto en la normativa aplicable.",
    correct_option: "C",
    explanation: "**Forma del desistimiento y renuncia**: El art. 94 establece que pueden hacerse **por cualquier medio que permita su constancia**, no exclusivamente electrónico. Lo esencial es que incorpore las firmas correspondientes según la normativa aplicable, garantizando la autenticidad sin limitar innecesariamente los medios de comunicación con la Administración.",
    primary_article_number: "93"
  },
  {
    question_text: "De acuerdo a lo dispuesto en la Ley 39/2015, ¿de qué plazo disponen los interesados recibida la notificación del acuerdo de realización de actuaciones complementarias para formular las alegaciones tras la finalización de las mismas?:",
    option_a: "De un plazo de diez días.",
    option_b: "De un plazo de veinte días.",
    option_c: "De un plazo de quince días.",
    option_d: "De un plazo de siete días.",
    correct_option: "D",
    explanation: "**Alegaciones tras actuaciones complementarias**: El art. 87 establece que tras la finalización de las actuaciones complementarias, los interesados disponen de **siete días** para formular alegaciones. Este plazo breve se justifica porque las actuaciones complementarias son puntuales e indispensables, requiriendo una resolución ágil del procedimiento.",
    primary_article_number: "87"
  },
  {
    question_text: "Conforme a la Ley 39/2015, en la terminación de los procedimientos sancionadores, ¿en qué situaciones el pago de la sanción por el presunto responsable implicará la terminación de los mismos?:",
    option_a: "Cuando quepa imponer una sanción pecuniaria y otra de carácter no pecuniario.",
    option_b: "En cualquier momento anterior a la resolución, en los casos de determinación de la indemnización por los daños y perjuicios causados por la comisión de la infracción.",
    option_c: "En cualquier momento posterior a la resolución, en los casos de reposición de la situación alterada.",
    option_d: "Cuando el pago sea voluntario, en cualquier momento anterior a la resolución.",
    correct_option: "D",
    explanation: "**Pago voluntario y terminación**: El art. 85 establece que **cuando el pago sea voluntario en cualquier momento anterior a la resolución**, implicará la terminación del procedimiento. El carácter voluntario y la anterioridad a la resolución son elementos esenciales que incentivan la colaboración del interesado y agilizan la finalización del procedimiento.",
    primary_article_number: "85"
  },
  {
    question_text: "Según la Ley 39/2015, si el escrito de iniciación se hubiera formulado por dos o más interesados, ¿a quién afectará los casos desistimiento y renuncia de uno de ellos?:",
    option_a: "El desistimiento solo afectará a aquel que lo hubiese formulado, mientras que la renuncia afectará a todos los interesados.",
    option_b: "A todos los interesados.",
    option_c: "Solo afectarán a aquel que hubiese formulado la renuncia o el desistimiento.",
    option_d: "La renuncia solo afectará a aquel que la hubiese formulado, mientras que el desistimiento afectará a todos los interesados.",
    correct_option: "C",
    explanation: "**Efectos subjetivos del desistimiento y renuncia**: El art. 94 establece que cuando hay varios interesados, tanto el desistimiento como la renuncia **solo afectan a quien los formula**. Esto respeta la autonomía de la voluntad individual y evita que la decisión de uno perjudique los derechos de los demás cointeresados en el procedimiento.",
    primary_article_number: "93"
  },
  {
    question_text: "En los procedimientos tramitados a solicitud del interesado, según lo dispuesto en el artículo 88.2 Ley 39/2015, de 1 de octubre, del Procedimiento Administrativo Común de las Administraciones Públicas:",
    option_a: "La resolución será congruente con las peticiones formuladas por éste, sin que en ningún caso pueda agravar su situación inicial y sin perjuicio de la potestad de la Administración de incoar de oficio un nuevo procedimiento, si procede.",
    option_b: "La resolución será congruente con las peticiones formuladas por éste, aunque ello conlleve que se agrave su situación inicial y sin perjuicio de la potestad de la Administración de incoar de oficio un nuevo procedimiento, si procede.",
    option_c: "La resolución será congruente con las peticiones formuladas por éste, sin que en ningún caso pueda agravar su situación inicial y sin que la Administración pueda incoar de oficio un nuevo procedimiento.",
    option_d: "La resolución sólo podrá dictarse de ser confirmatoria de las peticiones formuladas por éste, sin que en ningún caso pueda agravar su situación inicial y sin que la Administración pueda incoar de oficio un nuevo procedimiento.",
    correct_option: "A",
    explanation: "**Principio de congruencia y no agravación**: El art. 88.2 establece que en procedimientos a instancia del interesado la resolución debe ser congruente con sus peticiones **sin agravar su situación inicial**, pero preservando la potestad administrativa de incoar nuevos procedimientos de oficio si procede. Esto equilibra la protección del solicitante con las potestades públicas.",
    primary_article_number: "88"
  },
  {
    question_text: "De acuerdo con la Ley 39/2015, en la terminación de los procedimientos sancionadores, ¿qué sucede si iniciado el procedimiento el infractor reconoce su responsabilidad?:",
    option_a: "Se continuará el procedimiento, si bien se omitirá el período de práctica de prueba si no se hubiera llegado al mismo.",
    option_b: "Se podrá resolver el procedimiento con la imposición de la sanción que proceda rebajada en la mitad.",
    option_c: "Se podrá resolver el procedimiento con la imposición de la sanción que proceda.",
    option_d: "Se continuará el procedimiento, si bien se omitirá el trámite de audiencia a los interesados si no se hubiera realizado.",
    correct_option: "C",
    explanation: "**Reconocimiento de responsabilidad**: El art. 85 establece que cuando el infractor reconoce su responsabilidad **se podrá resolver con la sanción que proceda**. El reconocimiento permite una resolución más ágil del procedimiento, pero no altera automáticamente la sanción aplicable, salvo que concurran otros supuestos de reducción previstos en la norma.",
    primary_article_number: "85"
  },
  {
    question_text: "En los procedimientos de carácter sancionador, de conformidad con lo establecido en el artículo 90.3 de la Ley 39/2015, de 1 de octubre, del Procedimiento Administrativo Común de las Administraciones Públicas:",
    option_a: "La resolución podrá adoptar las disposiciones cautelares precisas para garantizar su eficacia en tanto no sea ejecutiva, si bien no podrán consistir en el mantenimiento de las medidas provisionales que en su caso se hubieran adoptado, que se extinguirán cuando aquella surta efectos.",
    option_b: "La resolución no podrá adoptar disposiciones cautelares de ningún tipo en tanto no haya transcurrido el plazo legalmente previsto sin que el interesado haya interpuesto recurso contencioso administrativo.",
    option_c: "La resolución podrá adoptar las disposiciones cautelares precisas para garantizar su eficacia en tanto no sea ejecutiva y que podrán consistir en el mantenimiento de las medidas provisionales que en su caso se hubieran adoptado.",
    option_d: "La resolución podrá adoptar las disposiciones cautelares precisas para garantizar su eficacia en tanto no sea ejecutiva, previo pronunciamiento judicial sobre las mismas.",
    correct_option: "C",
    explanation: "**Disposiciones cautelares en la resolución**: El art. 90.3 permite adoptar disposiciones cautelares para garantizar la eficacia **mientras no sea ejecutiva** y estas **podrán consistir en el mantenimiento de medidas provisionales** previamente adoptadas. Esto asegura la continuidad de la protección del interés público hasta que la resolución devenga ejecutiva.",
    primary_article_number: "90"
  },
  {
    question_text: "Según la Ley 39/2015, cuando el órgano competente para resolver un procedimiento sancionador considere que la infracción reviste mayor gravedad que la determinada en la propuesta de resolución, ¿de qué plazo dispondrá el inculpado para que aporte cuantas alegaciones estime convenientes?",
    option_a: "Diez días.",
    option_b: "Veinte días.",
    option_c: "Quince días.",
    option_d: "Cinco días.",
    correct_option: "C",
    explanation: "**Agravación de la propuesta de resolución**: El art. 90 establece que cuando el órgano resolutor considere que la infracción reviste mayor gravedad, debe otorgar al inculpado un plazo de **quince días** para alegaciones. Esto garantiza el derecho de defensa ante la posible imposición de una sanción más grave que la inicialmente propuesta.",
    primary_article_number: "90"
  },
  {
    question_text: "De acuerdo con la Ley 39/2015, cuando la competencia para instruir y resolver un procedimiento no recaiga en un mismo órgano:",
    option_a: "No se podrá interponer recurso alguno frente a las resoluciones del órgano instructor.",
    option_b: "Será necesario que el instructor eleve al órgano competente para resolver una propuesta de resolución.",
    option_c: "Bastará con que el instructor comunique a los interesados la identificación del órgano competente para resolver y remita a éste el expediente administrativo.",
    option_d: "Bastará con que el instructor comunique al órgano competente para resolver la finalización de la fase de instrucción.",
    correct_option: "B",
    explanation: "**Separación de instrucción y resolución**: Cuando las competencias están separadas, el art. 89 establece que **es necesario que el instructor eleve propuesta de resolución** al órgano competente para resolver. Esto garantiza que el órgano resolutor cuente con una valoración técnica completa del expediente antes de adoptar su decisión final.",
    primary_article_number: "88"
  },
  {
    question_text: "De conformidad con la Ley 39/2015, ¿en qué casos podrá la Administración abstenerse de resolver?:",
    option_a: "En los casos de silencio de los preceptos legales.",
    option_b: "En los casos de oscuridad de los preceptos legales.",
    option_c: "En ningún caso podrá la Administración abstenerse de resolver.",
    option_d: "En los casos de insuficiencia de los preceptos legales.",
    correct_option: "C",
    explanation: "**Deber inexcusable de resolver**: El art. 88 establece que **en ningún caso la Administración puede abstenerse de resolver**. Ni el silencio, oscuridad o insuficiencia de los preceptos legales exime del deber de resolver. La Administración debe pronunciarse siempre, acudiendo a los principios generales del derecho y la analogía cuando sea necesario.",
    primary_article_number: "88"
  },
  {
    question_text: "Según lo dispuesto en la Ley 39/2015, en la terminación de los procedimientos sancionadores, cuando la sanción tenga únicamente carácter pecuniario el órgano competente para resolver el procedimiento:",
    option_a: "Aplicará reducciones de, al menos, el 50 % sobre el importe de la sanción propuesta.",
    option_b: "Aplicará reducciones de, al menos, el 30 % sobre el importe de la sanción propuesta.",
    option_c: "Aplicará reducciones de, al menos, el 40 % sobre el importe de la sanción propuesta.",
    option_d: "Aplicará reducciones de, al menos, el 20 % sobre el importe de la sanción propuesta.",
    correct_option: "D",
    explanation: "**Reducción mínima en sanciones pecuniarias**: El art. 85 establece que cuando la sanción tenga únicamente carácter pecuniario, se aplicarán reducciones de **al menos el 20%** sobre el importe propuesto. Esta reducción incentiva la colaboración del interesado y agiliza la finalización del procedimiento sancionador.",
    primary_article_number: "85"
  },
  {
    question_text: "Según el artículo 86.1 de la Ley 39/2015, de 1 de octubre, del Procedimiento Administrativo Común de las Administraciones Públicas, las Administraciones Públicas podrán celebrar acuerdos, pactos, convenios o contratos:",
    option_a: "Con personas tanto de Derecho público como privado, siempre que no sean contrarios al ordenamiento jurídico y tengan por objeto satisfacer el interés público que tienen encomendado, aunque versen sobre materias no susceptibles de transacción, con el alcance, efectos y régimen jurídico específico que, en su caso, prevea la disposición que lo regule, pudiendo tales actos tener la consideración de finalizadores de los procedimientos administrativos o insertarse en los mismos con carácter previo, vinculante o no, a la resolución que les ponga fin.",
    option_b: "Con personas tanto de Derecho público como privado, siempre que no sean contrarios al ordenamiento jurídico ni versen sobre materias no susceptibles de transacción y tengan por objeto satisfacer el interés público que tienen encomendado, con el alcance, efectos y régimen jurídico específico que, en su caso, prevea la disposición que lo regule, no pudiendo tales actos tener la consideración de finalizadores de los procedimientos administrativos pero sí insertarse en los mismos con carácter previo, vinculante o no, a la resolución que les ponga fin.",
    option_c: "Con personas tanto de Derecho público como privado, siempre que no sean contrarios al ordenamiento jurídico ni versen sobre materias no susceptibles de transacción y tengan por objeto satisfacer el interés público que tienen encomendado, con el alcance, efectos y régimen jurídico específico que, en su caso, prevea la disposición que lo regule, pudiendo tales actos tener la consideración de finalizadores de los procedimientos administrativos o insertarse en los mismos con carácter previo, vinculante o no, a la resolución que les ponga fin.",
    option_d: "Con personas tanto de Derecho público como privado, siempre que no sean contrarios al ordenamiento jurídico ni versen sobre materias no susceptibles de transacción y tengan por objeto satisfacer el interés público que tienen encomendado, con el alcance, efectos y régimen jurídico específico que prevean las partes, pudiendo tales actos tener la consideración de finalizadores de los procedimientos administrativos o insertarse en los mismos con carácter previo, vinculante o no, a la resolución que les ponga fin.",
    correct_option: "C",
    explanation: "**Requisitos de la terminación convencional**: El art. 86.1 exige que los acuerdos **no sean contrarios al ordenamiento jurídico ni versen sobre materias no susceptibles de transacción**, tengan por objeto el interés público encomendado, con el régimen que prevea la disposición que lo regule, y **pueden ser finalizadores del procedimiento o insertarse en el mismo**.",
    primary_article_number: "86"
  },
  {
    question_text: "Según el artículo 89 de la Ley 39/2015, en los procedimientos de carácter sancionador, indique en cuál de las siguientes situaciones es necesario que el órgano instructor eleve propuesta de resolución al competente para resolver:",
    option_a: "Cuando no exista o no se haya podido identificar a la persona o personas responsables o bien aparezcan exentos de responsabilidad.",
    option_b: "Cuando los hechos no resulten acreditados.",
    option_c: "Cuando los hechos probados no constituyan, de modo manifiesto, infracción administrativa.",
    option_d: "Cuando se concluyera, en cualquier momento, que ha caducado la infracción.",
    correct_option: "D",
    explanation: "**Supuestos de propuesta de resolución necesaria**: El art. 89 establece que cuando se concluye que ha **caducado la infracción**, es necesario elevar propuesta de resolución. En los otros supuestos (no identificación del responsable, hechos no acreditados, no constitutivos de infracción manifiesta), el instructor puede resolver directamente la finalización con archivo.",
    primary_article_number: "89"
  }
];

async function addFinalizacionBatch2() {
  try {
    console.log('🔍 INICIANDO BATCH 2 - FINALIZACIÓN DEL PROCEDIMIENTO...\n');
    
    // 1. Verificar sección existe
    const { data: section, error: sectionError } = await supabase
      .from('content_sections')
      .select('id, name')
      .eq('slug', 'finalizacion-procedimiento')
      .single();
    
    if (sectionError || !section) {
      throw new Error('❌ Sección finalización-procedimiento no existe.');
    }
    
    console.log('✅ Sección encontrada:', section.name);
    
    // 2. Obtener artículos de la ley
    const { data: law } = await supabase
      .from('laws')
      .select('id')
      .eq('short_name', 'Ley 39/2015')
      .single();
    
    const { data: articles } = await supabase
      .from('articles')
      .select('id, article_number')
      .eq('law_id', law.id)
      .in('article_number', ['84', '85', '86', '87', '88', '89', '90', '92', '93', '95']);
    
    console.log('✅ Artículos disponibles:', articles.length);
    
    // 3. Procesar preguntas del batch 2
    let successCount = 0;
    let errorCount = 0;
    
    for (const [index, questionData] of questionsData.entries()) {
      try {
        const article = articles.find(a => a.article_number === questionData.primary_article_number);
        
        if (!article) {
          console.log(`⚠️ Saltando pregunta ${index + 31}: artículo ${questionData.primary_article_number} no encontrado`);
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
          console.log(`❌ Error pregunta ${index + 31}:`, error.message);
          errorCount++;
        } else {
          console.log(`✅ Pregunta ${index + 31} añadida: ${data[0].question_text.substring(0, 60)}...`);
          successCount++;
        }
        
      } catch (questionError) {
        console.log(`❌ Error procesando pregunta ${index + 31}:`, questionError.message);
        errorCount++;
      }
    }
    
    console.log(`\n📊 RESUMEN BATCH 2:`);
    console.log(`✅ Preguntas añadidas exitosamente: ${successCount}`);
    console.log(`❌ Preguntas con errores: ${errorCount}`);
    console.log(`📝 Total procesadas: ${successCount + errorCount}`);
    
    // 4. Estado final de la sección
    const { data: totalQuestions } = await supabase
      .from('questions')
      .select('id')
      .in('primary_article_id', articles.map(a => a.id));
    
    console.log(`\n🎯 ESTADO FINAL SECCIÓN:`);
    console.log(`📚 Total preguntas en finalización: ${totalQuestions?.length || 0}`);
    console.log(`🌐 URL: /test-oposiciones/procedimiento-administrativo/finalizacion-procedimiento`);
    
  } catch (error) {
    console.error('❌ Error general:', error.message);
  }
}

addFinalizacionBatch2();