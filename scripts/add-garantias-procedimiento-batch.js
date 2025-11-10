// scripts/add-garantias-procedimiento-batch.js
// Script para añadir preguntas de Procedimiento Administrativo: Garantías

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

// Todas las preguntas de garantías extraídas de las imágenes
const garantiasQuestions = [
  {
    question_text: "¿Cuáles son todas las formas de iniciación de los procedimientos administrativos según la Ley 39/2015, de 1 de octubre, del Procedimiento Administrativo Común de las Administraciones Públicas?",
    option_a: "Siempre será necesario una instancia por escrito del ciudadano ante el órgano correspondiente.",
    option_b: "De oficio, a instancia de parte o mediante denuncia.",
    option_c: "De oficio, en todo caso.",
    option_d: "De oficio o a solicitud del interesado.",
    correct_option: "D",
    article_reference: "54",
    explanation: "Según el artículo 54 de la Ley 39/2015, los procedimientos administrativos pueden iniciarse de oficio por la propia Administración o a solicitud del interesado. Esta dualidad garantiza tanto la potestad administrativa como el derecho ciudadano de acceso a los procedimientos."
  },
  {
    question_text: "¿Dónde debe constar la inscripción del poder para que produzca efectos ante la Administración Pública según el artículo 6.1 de la Ley 39/2015?",
    option_a: "En el registro electrónico de apoderamientos de la Administración Pública competente o del Estado.",
    option_b: "En el registro general de poderes notariales.",
    option_c: "En cualquier registro público oficial.",
    option_d: "En el registro civil correspondiente.",
    correct_option: "A",
    article_reference: "6",
    explanation: "El artículo 6.1 de la Ley 39/2015 establece que los poderes deben inscribirse en el registro electrónico de apoderamientos de la Administración competente. Esto garantiza la verificación y control de las representaciones ante las Administraciones Públicas."
  },
  {
    question_text: "Serán titulares de intereses legítimos colectivos, según lo dispuesto en el artículo 4.2 de la Ley 39/2015:",
    option_a: "Las asociaciones y organizaciones representativas de intereses económicos y sociales, en los términos que la Ley reconozca.",
    option_b: "Los menores de edad para el ejercicio y defensa de aquellos de sus derechos e intereses cuya actuación esté permitida por el ordenamiento jurídico sin la asistencia de la persona que ejerza la patria potestad, tutela o curatela.",
    option_c: "El derecho-habiente, cuando la condición de interesado derivase de alguna relación jurídica transmisible.",
    option_d: "Los patrimonios independientes o autónomos.",
    correct_option: "A",
    article_reference: "4",
    explanation: "El artículo 4.2 de la Ley 39/2015 reconoce como titulares de intereses legítimos colectivos a las asociaciones y organizaciones representativas de intereses económicos y sociales. Esto permite la defensa colectiva de derechos ante la Administración."
  },
  {
    question_text: "¿Cuál de las siguientes afirmaciones es correcta respecto a la iniciación de oficio según el artículo 58 de la Ley 39/2015?",
    option_a: "Solo puede iniciarse por orden superior.",
    option_b: "Únicamente puede iniciarse por propia iniciativa del órgano competente.",
    option_c: "Puede iniciarse por propia iniciativa, por orden superior, por petición razonada de otros órganos o por denuncia.",
    option_d: "Solo puede iniciarse por denuncia de los ciudadanos.",
    correct_option: "C",
    article_reference: "58",
    explanation: "El artículo 58 de la Ley 39/2015 establece las diversas modalidades de iniciación de oficio: por propia iniciativa del órgano, por orden superior, por petición razonada de otros órganos o por denuncia. Esta variedad asegura la eficacia del control administrativo."
  },
  {
    question_text: "¿En qué casos podrán acordarse medidas provisionales según el artículo 56 de la Ley 39/2015?",
    option_a: "Solo cuando sea imprescindible para asegurar la eficacia de la resolución definitiva.",
    option_b: "En todo caso, independientemente de las circunstancias.",
    option_c: "Únicamente cuando lo solicite el interesado.",
    option_d: "Solo en procedimientos sancionadores.",
    correct_option: "A",
    article_reference: "56",
    explanation: "El artículo 56 de la Ley 39/2015 permite acordar medidas provisionales cuando sean imprescindibles para asegurar la eficacia de la resolución definitiva, evitar el perjuicio a los intereses generales o proteger los derechos de los interesados. Son medidas excepcionales y justificadas."
  },
  {
    question_text: "Las medidas provisionales según el artículo 56 de la Ley 39/2015:",
    option_a: "Tienen carácter definitivo una vez adoptadas.",
    option_b: "Deben ser proporcionales a los fines que se pretende conseguir.",
    option_c: "Solo pueden adoptarse a solicitud del interesado.",
    option_d: "No pueden ser modificadas una vez acordadas.",
    correct_option: "B",
    article_reference: "56",
    explanation: "Según el artículo 56 de la Ley 39/2015, las medidas provisionales deben ser proporcionadas a los fines perseguidos. El principio de proporcionalidad es fundamental para evitar restricciones desproporcionadas a los derechos de los ciudadanos."
  },
  {
    question_text: "Según el artículo 68.1 de la Ley 39/2015, si la solicitud de iniciación no reúne los requisitos exigidos:",
    option_a: "Se archivará inmediatamente el expediente.",
    option_b: "Se requerirá al interesado para que, en un plazo de diez días, subsane la falta o acompañe los documentos preceptivos.",
    option_c: "Se denegará automáticamente la solicitud.",
    option_d: "Se tramitará el procedimiento con los datos disponibles.",
    correct_option: "B",
    article_reference: "68",
    explanation: "El artículo 68.1 de la Ley 39/2015 establece el derecho a la subsanación, otorgando un plazo de diez días para corregir defectos. Este derecho garantiza que defectos meramente formales no impidan el ejercicio de derechos sustantivos."
  },
  {
    question_text: "¿Qué establece el artículo 6.2 de la Ley 39/2015 sobre los registros electrónicos de apoderamientos?",
    option_a: "Son opcionales para las Administraciones Públicas.",
    option_b: "Solo los puede crear la Administración General del Estado.",
    option_c: "Cada Administración Pública creará y mantendrá actualizado su propio registro.",
    option_d: "Son gestionados únicamente por notarios.",
    correct_option: "C",
    article_reference: "6",
    explanation: "El artículo 6.2 de la Ley 39/2015 obliga a cada Administración Pública a crear y mantener actualizado su registro electrónico de apoderamientos. Esto descentraliza la gestión mientras garantiza el control de las representaciones."
  },
  {
    question_text: "El inicio del procedimiento como consecuencia de orden superior según el artículo 60 de la Ley 39/2015:",
    option_a: "No requiere motivación alguna.",
    option_b: "Debe especificar el órgano competente para la instrucción y resolución del procedimiento.",
    option_c: "Solo puede darse en procedimientos sancionadores.",
    option_d: "No está permitido en el procedimiento administrativo común.",
    correct_option: "B",
    article_reference: "60",
    explanation: "Según el artículo 60 de la Ley 39/2015, la orden superior que inicie un procedimiento debe especificar el órgano competente para su instrucción y resolución. Esto garantiza la claridad en la distribución de competencias y la responsabilidad orgánica."
  },
  {
    question_text: "¿Qué establece el artículo 6.7 de la Ley 39/2015 sobre las solicitudes de inscripción del poder?",
    option_a: "Deben presentarse necesariamente de forma presencial.",
    option_b: "Pueden presentarse por medios electrónicos.",
    option_c: "Solo pueden presentarse los martes y jueves.",
    option_d: "Requieren autorización judicial previa.",
    correct_option: "B",
    article_reference: "6",
    explanation: "El artículo 6.7 de la Ley 39/2015 permite la presentación electrónica de solicitudes de inscripción del poder, facilitando la gestión digital de las representaciones y modernizando los procedimientos administrativos."
  },
  {
    question_text: "De conformidad con la Ley 39/2015 y respecto de las actuaciones de los interesados en los procedimientos administrativos, señale la incorrecta:",
    option_a: "Para cumplir con una obligación de pago derivada de una sanción pecuniaria, éste se efectuará preferentemente entre otros, mediante tarjeta de crédito y débito.",
    option_b: "Tienen derecho a aportar documentos en cualquier fase del procedimiento anterior al trámite de audiencia.",
    option_c: "Pueden no presentar datos y documentos no exigidos por las normas aplicables al procedimiento de que se trate.",
    option_d: "Deben presentar documentos originales salvo que, de manera excepcional, la normativa reguladora aplicable establezca lo contrario.",
    correct_option: "D",
    article_reference: "53",
    explanation: "La opción D es incorrecta porque según el artículo 53 de la Ley 39/2015, los interesados no están obligados a presentar documentos originales como regla general. Es la excepción, no la norma, que deban presentarse originales."
  },
  {
    question_text: "¿Qué debe contener toda solicitud de iniciación según el artículo 66 de la Ley 39/2015?",
    option_a: "Solo el nombre del solicitante y la petición.",
    option_b: "Nombre y apellidos del interesado, identificación del medio de notificación, hechos y petición, lugar, fecha y firma.",
    option_c: "Únicamente la descripción de los hechos.",
    option_d: "Solo la fecha y la firma del solicitante.",
    correct_option: "B",
    article_reference: "66",
    explanation: "El artículo 66 de la Ley 39/2015 establece los requisitos mínimos de las solicitudes: identificación del interesado, medio de notificación, hechos y petición claramente expresados, lugar, fecha y firma. Estos elementos garantizan la claridad y trazabilidad del procedimiento."
  },
  {
    question_text: "Según el artículo 55 de la Ley 39/2015, las actuaciones previas:",
    option_a: "Son obligatorias en todos los procedimientos.",
    option_b: "Solo pueden realizarse en procedimientos sancionadores.",
    option_c: "Pueden abrirse para conocer las circunstancias del caso y la conveniencia de iniciar el procedimiento.",
    option_d: "Tienen una duración mínima de tres meses.",
    correct_option: "C",
    article_reference: "55",
    explanation: "El artículo 55 de la Ley 39/2015 permite abrir actuaciones previas para conocer las circunstancias del caso concreto y determinar la conveniencia de iniciar el procedimiento. Son facultativas y orientadas a una mejor gestión administrativa."
  },
  {
    question_text: "¿Qué establece el artículo 69 sobre la declaración responsable?",
    option_a: "Es un documento que sustituye a la autorización administrativa.",
    option_b: "Es el documento suscrito por un interesado en el que manifiesta que cumple con los requisitos establecidos en la normativa vigente.",
    option_c: "Solo puede presentarse en procedimientos sancionadores.",
    option_d: "Requiere validación notarial obligatoria.",
    correct_option: "B",
    article_reference: "69",
    explanation: "Según el artículo 69 de la Ley 39/2015, la declaración responsable es el documento donde el interesado manifiesta bajo su responsabilidad que cumple los requisitos legales. Es un instrumento de simplificación administrativa que transfiere la responsabilidad al declarante."
  },
  {
    question_text: "En relación con la declaración responsable y la comunicación según el artículo 69 de la Ley 39/2015:",
    option_a: "Ambas tienen los mismos efectos jurídicos.",
    option_b: "La comunicación habilita para el ejercicio de un derecho desde el día de su presentación.",
    option_c: "Solo la declaración responsable puede ser objeto de comprobación posterior.",
    option_d: "Ninguna de las dos puede ser verificada por la Administración.",
    correct_option: "B",
    article_reference: "69",
    explanation: "El artículo 69 de la Ley 39/2015 establece que tanto la declaración responsable como la comunicación habilitan para el ejercicio del derecho desde el momento de su presentación, sin esperar la resolución administrativa, agilizando así el ejercicio de derechos."
  },
  {
    question_text: "De acuerdo con el artículo 66 de la Ley 39/2015, en la iniciación del procedimiento administrativo a solicitud del interesado, cuando las pretensiones correspondientes a una pluralidad de personas tengan un contenido y fundamento idéntico:",
    option_a: "No podrán ser formuladas en una única solicitud.",
    option_b: "Podrán ser formuladas en una única solicitud.",
    option_c: "Solo podrán ser formuladas en una única solicitud con el consentimiento de todos los interesados.",
    option_d: "Deberán ser formuladas en una única solicitud.",
    correct_option: "B",
    article_reference: "66",
    explanation: "El artículo 66.2 de la Ley 39/2015 permite que pretensiones de varias personas con contenido y fundamento idéntico o sustancialmente similar puedan formularse en una única solicitud, facilitando la gestión de procedimientos colectivos."
  },
  {
    question_text: "¿Cuándo se considera que una persona tiene capacidad de obrar ante las Administraciones Públicas según el artículo 3 de la Ley 39/2015?",
    option_a: "Solo cuando sea mayor de edad.",
    option_b: "Cuando la tenga con arreglo a las normas civiles.",
    option_c: "Únicamente cuando tenga nacionalidad española.",
    option_d: "Solo cuando esté emancipada.",
    correct_option: "B",
    article_reference: "3",
    explanation: "El artículo 3 de la Ley 39/2015 establece que tienen capacidad de obrar ante las Administraciones Públicas quienes la tengan con arreglo a las normas civiles. Esto conecta la capacidad administrativa con el régimen civil general de capacidad."
  },
  {
    question_text: "Según el artículo 5 de la Ley 39/2015, ¿quién puede actuar en representación de otra persona?",
    option_a: "Solo los abogados colegiados.",
    option_b: "Cualquier persona mayor de edad.",
    option_c: "Los que tengan reconocida facultad para ello.",
    option_d: "Únicamente los familiares directos.",
    correct_option: "C",
    article_reference: "5",
    explanation: "El artículo 5 de la Ley 39/2015 establece que pueden actuar mediante representante quienes tengan reconocida esta facultad. La representación debe estar debidamente acreditada conforme a las normas aplicables."
  },
  {
    question_text: "De acuerdo con lo establecido en la Ley 39/2015, ¿cuál de las siguientes medidas provisionales no podrá acordarse?",
    option_a: "La retención de ingresos a cuenta que deban abonar las Administraciones Públicas.",
    option_b: "La retirada o intervención de bienes productivos.",
    option_c: "El embargo preventivo de bienes, rentas y cosas fungibles computables en metálico por aplicación de precios ciertos.",
    option_d: "La intervención y depósito de ingresos obtenidos mediante una actividad que se considere ilícita.",
    correct_option: "C",
    article_reference: "56",
    explanation: "Según el artículo 56 de la Ley 39/2015, no se puede acordar como medida provisional el embargo preventivo de bienes. Las medidas provisionales tienen límites específicos y no pueden equivaler a medidas ejecutivas propias de otro tipo de procedimientos."
  },
  {
    question_text: "¿Qué establece el artículo 57 sobre la acumulación de procedimientos?",
    option_a: "Está prohibida en todos los casos.",
    option_b: "Solo puede acordarse a instancia de parte.",
    option_c: "Puede disponerse de oficio o a instancia de parte cuando los procedimientos guarden identidad sustancial o íntima conexión.",
    option_d: "Únicamente es posible en procedimientos sancionadores.",
    correct_option: "C",
    article_reference: "57",
    explanation: "El artículo 57 de la Ley 39/2015 permite la acumulación de procedimientos de oficio o a instancia de parte cuando guarden identidad sustancial o íntima conexión, siempre que sea el mismo órgano quien deba tramitarlos y resolverlos."
  },
  {
    question_text: "Según el artículo 59 de la Ley 39/2015, ¿cuándo puede iniciarse un procedimiento a propia iniciativa?",
    option_a: "Solo cuando lo autorice una ley específica.",
    option_b: "En cualquier momento que el órgano competente lo considere oportuno.",
    option_c: "Únicamente en horario de oficina.",
    option_d: "Solo cuando haya transcurrido un año desde el último procedimiento.",
    correct_option: "B",
    article_reference: "59",
    explanation: "El artículo 59 de la Ley 39/2015 reconoce la potestad de los órganos administrativos para iniciar procedimientos por propia iniciativa cuando lo consideren necesario para el cumplimiento de sus funciones, dentro del marco de sus competencias."
  },
  {
    question_text: "¿Qué debe especificar una petición razonada según el artículo 61 de la Ley 39/2015?",
    option_a: "Solo el nombre del presunto responsable.",
    option_b: "Las circunstancias, conductas o hechos que motivan la petición.",
    option_c: "Únicamente la fecha de los hechos.",
    option_d: "Solo la normativa aplicable.",
    correct_option: "B",
    article_reference: "61",
    explanation: "El artículo 61 de la Ley 39/2015 exige que la petición razonada especifique las circunstancias, conductas o hechos que la motivan, proporcionando información suficiente para que el órgano competente pueda evaluar la procedencia del inicio del procedimiento."
  },
  {
    question_text: "Según el artículo 62 de la Ley 39/2015, ¿qué efecto tiene la denuncia?",
    option_a: "Obliga a iniciar el procedimiento inmediatamente.",
    option_b: "Pone en conocimiento de la Administración la existencia de determinados hechos.",
    option_c: "Suspende automáticamente la actividad denunciada.",
    option_d: "Otorga la condición de interesado al denunciante.",
    correct_option: "B",
    article_reference: "62",
    explanation: "El artículo 62 de la Ley 39/2015 establece que la denuncia pone en conocimiento de la Administración hechos que pueden justificar el inicio de un procedimiento, pero no obliga a iniciarlo ni otorga automáticamente la condición de interesado al denunciante."
  },
  {
    question_text: "¿Cuál es una característica específica de los procedimientos sancionadores según el artículo 63 de la Ley 39/2015?",
    option_a: "No requieren acuerdo de iniciación.",
    option_b: "El acuerdo de iniciación debe distinguir claramente entre la fase instructora y la sancionadora.",
    option_c: "Solo pueden iniciarse por denuncia.",
    option_d: "No admiten medidas provisionales.",
    correct_option: "B",
    article_reference: "63",
    explanation: "El artículo 63 de la Ley 39/2015 exige que en los procedimientos sancionadores el acuerdo de iniciación distinga claramente entre la fase instructora y la sancionadora, garantizando la separación de funciones y el principio de imparcialidad."
  },
  {
    question_text: "Cuando en una solicitud figuren varios interesados según el artículo 7 de la Ley 39/2015:",
    option_a: "Las actuaciones se efectuarán con todos simultáneamente.",
    option_b: "Se efectuarán con el representante designado o, en su defecto, con el que figure en primer término.",
    option_c: "Cada uno debe presentar solicitud individual.",
    option_d: "Se elige por sorteo el interesado principal.",
    correct_option: "B",
    article_reference: "7",
    explanation: "El artículo 7 de la Ley 39/2015 establece que cuando hay pluralidad de interesados, las actuaciones se realizan con el representante designado expresamente o, en su defecto, con quien figure en primer término, evitando duplicidades procedimentales."
  },
  {
    question_text: "¿Qué establece el artículo 68.4 de la Ley 39/2015 sobre la admisión a trámite?",
    option_a: "Es automática en todos los casos.",
    option_b: "Se pronunciará expresamente sobre la admisión a trámite en los casos establecidos por las normas reguladoras del procedimiento correspondiente.",
    option_c: "Está prohibida en procedimientos sancionadores.",
    option_d: "Solo se aplica a personas jurídicas.",
    correct_option: "B",
    article_reference: "68",
    explanation: "El artículo 68.4 de la Ley 39/2015 establece que la Administración se pronunciará expresamente sobre la admisión a trámite en los casos que determinen las normas reguladoras del procedimiento específico, proporcionando seguridad jurídica al interesado."
  },
  {
    question_text: "De conformidad con el artículo 64.1 de la Ley 39/2015, el acuerdo de iniciación en los procedimientos sancionadores:",
    option_a: "Se comunicará al órgano competente para resolver, y se notificará a los interesados y al denunciante cuando proceda.",
    option_b: "Se comunicará al instructor del procedimiento y se notificará al denunciante cuando la normativa lo prevea.",
    option_c: "Se comunicará al instructor del procedimiento, y se notificará a los interesados y al denunciante cuando las normas lo prevean.",
    option_d: "Se comunicará al órgano competente para resolver y se notificará tanto al denunciante como a los interesados.",
    correct_option: "C",
    article_reference: "64",
    explanation: "El artículo 64.1 de la Ley 39/2015 establece que el acuerdo de iniciación se comunica al instructor, se notifica a los interesados (especialmente al inculpado) y al denunciante cuando las normas reguladoras lo prevean, garantizando el conocimiento del procedimiento a las partes relevantes."
  },
  {
    question_text: "Según el artículo 5.6 de la Ley 39/2015, cuando se actúe en representación de otra persona:",
    option_a: "No es necesario acreditar la representación.",
    option_b: "La representación se acreditará por cualquier medio válido en derecho que deje constancia fidedigna.",
    option_c: "Solo vale la representación notarial.",
    option_d: "La representación debe renovarse cada año.",
    correct_option: "B",
    article_reference: "5",
    explanation: "El artículo 5.6 de la Ley 39/2015 exige que la representación se acredite por cualquier medio válido en derecho que deje constancia fidedigna, permitiendo flexibilidad en las formas de acreditación mientras se garantiza la autenticidad."
  },
  {
    question_text: "¿Qué establece el artículo 98.2 de la Ley 39/2015 sobre la ejecutoriedad?",
    option_a: "Los actos administrativos no son ejecutorios hasta ser confirmados judicialmente.",
    option_b: "Los actos administrativos sujetos al derecho administrativo serán inmediatamente ejecutivos.",
    option_c: "La ejecutoriedad se suspende automáticamente con la interposición de recursos.",
    option_d: "Solo los actos sancionadores son ejecutorios.",
    correct_option: "B",
    article_reference: "98",
    explanation: "El artículo 98.2 de la Ley 39/2015 establece que los actos administrativos sujetos al derecho administrativo son inmediatamente ejecutivos, sin necesidad de confirmación judicial previa, como manifestación de la potestad de autotutela administrativa."
  },
  {
    question_text: "Según el artículo 62.4 de la Ley 39/2015, ¿cuándo debe resolverse sobre las denuncias?",
    option_a: "Inmediatamente al recibirse.",
    option_b: "En el plazo de un año.",
    option_c: "En el plazo máximo establecido para el procedimiento correspondiente.",
    option_d: "No hay plazo específico establecido.",
    correct_option: "C",
    article_reference: "62",
    explanation: "El artículo 62.4 de la Ley 39/2015 establece que las denuncias deben resolverse en el plazo máximo establecido para el procedimiento correspondiente, conectando los plazos de resolución de denuncias con los plazos generales del procedimiento que se inicie."
  },
  {
    question_text: "¿Qué característica tienen las medidas provisionales según el artículo 56 de la Ley 39/2015?",
    option_a: "Son definitivas e irrevocables.",
    option_b: "Podrán ser alzadas o modificadas durante la tramitación del procedimiento.",
    option_c: "Solo pueden modificarse por orden judicial.",
    option_d: "Tienen duración mínima de seis meses.",
    correct_option: "B",
    article_reference: "56",
    explanation: "El artículo 56 de la Ley 39/2015 establece que las medidas provisionales pueden ser alzadas o modificadas durante la tramitación del procedimiento, manteniendo su carácter provisional y adaptándose a las circunstancias cambiantes del caso."
  },
  {
    question_text: "En relación con la pluralidad de interesados según el artículo 7 de la Ley 39/2015:",
    option_a: "Cada interesado debe nombrar un representante individual.",
    option_b: "Las actuaciones se efectúan con el representante común designado.",
    option_c: "No se permite la pluralidad en procedimientos administrativos.",
    option_d: "Todos deben comparecer personalmente.",
    correct_option: "B",
    article_reference: "7",
    explanation: "El artículo 7 de la Ley 39/2015 permite que cuando hay varios interesados, las actuaciones se efectúen con el representante común que hayan designado expresamente, facilitando la gestión procedimental y evitando multiplicación de trámites."
  },
  {
    question_text: "¿Qué debe incluir el contenido de las solicitudes según el artículo 66 de la Ley 39/2015?",
    option_a: "Solo los datos personales del solicitante.",
    option_b: "Hechos, razones y petición con toda claridad.",
    option_c: "Únicamente la fecha y lugar de presentación.",
    option_d: "Solo la firma del interesado.",
    correct_option: "B",
    article_reference: "66",
    explanation: "El artículo 66 de la Ley 39/2015 exige que las solicitudes incluyan hechos, razones y petición con toda claridad, asegurando que la Administración comprenda exactamente lo que se solicita y pueda tramitar adecuadamente el procedimiento."
  },
  {
    question_text: "Según el artículo 55.2 de la Ley 39/2015, en procedimientos sancionadores las actuaciones previas:",
    option_a: "No están permitidas.",
    option_b: "Se orientarán a determinar los hechos susceptibles de motivar la incoación del procedimiento.",
    option_c: "Solo pueden durar un máximo de 15 días.",
    option_d: "Requieren autorización judicial previa.",
    correct_option: "B",
    article_reference: "55",
    explanation: "El artículo 55.2 de la Ley 39/2015 establece que en procedimientos sancionadores las actuaciones previas se orientan a determinar con precisión los hechos susceptibles de motivar la incoación, la identificación de responsables y las circunstancias relevantes."
  },
  {
    question_text: "¿Cuál es el plazo para confirmar las medidas provisionales según el artículo 56 de la Ley 39/2015?",
    option_a: "Dentro de los veinte días siguientes a su adopción.",
    option_b: "Dentro de los quince días siguientes a su adopción.",
    option_c: "Dentro de los treinta días siguientes a su adopción.",
    option_d: "No hay plazo específico establecido.",
    correct_option: "B",
    article_reference: "56",
    explanation: "El artículo 56 de la Ley 39/2015 establece que las medidas provisionales deben confirmarse mediante acuerdo de iniciación del procedimiento dentro de los quince días siguientes a su adopción, evitando que se prolonguen indefinidamente sin fundamento procedimental."
  },
  {
    question_text: "En los procedimientos de responsabilidad patrimonial, según el artículo 61.4 de la Ley 39/2015, la petición razonada debe:",
    option_a: "Solo identificar al responsable.",
    option_b: "Individualizar la lesión producida y su relación de causalidad con el funcionamiento del servicio público.",
    option_c: "Únicamente señalar el momento de la lesión.",
    option_d: "Solo incluir la evaluación económica.",
    correct_option: "B",
    article_reference: "61",
    explanation: "El artículo 61.4 de la Ley 39/2015 exige que en procedimientos de responsabilidad patrimonial la petición individualice la lesión, su relación causal con el servicio público, la evaluación económica si es posible y el momento en que se produjo."
  },
  {
    question_text: "¿Qué establece el artículo 69 sobre los efectos de la declaración responsable?",
    option_a: "No produce efectos hasta su verificación.",
    option_b: "Habilita para el ejercicio del derecho desde el día de su presentación.",
    option_c: "Solo produce efectos tras 30 días de su presentación.",
    option_d: "Requiere confirmación administrativa previa.",
    correct_option: "B",
    article_reference: "69",
    explanation: "El artículo 69 de la Ley 39/2015 establece que la declaración responsable habilita para el ejercicio del derecho o actividad desde el día de su presentación, sin necesidad de esperar acto administrativo expreso, agilizando el ejercicio de derechos."
  },
  {
    question_text: "Según el artículo 53.1 de la Ley 39/2015, los interesados en el procedimiento administrativo tienen derecho a:",
    option_a: "Solo conocer el estado de tramitación.",
    option_b: "Conocer el estado de tramitación, obtener copias de documentos y ser tratados con respeto y deferencia.",
    option_c: "Únicamente obtener copias de documentos.",
    option_d: "Solo ser tratados con respeto.",
    correct_option: "B",
    article_reference: "53",
    explanation: "El artículo 53.1 de la Ley 39/2015 reconoce múltiples derechos a los interesados: conocer el estado de tramitación, obtener copias de documentos, ser tratados con respeto y deferencia, entre otros, garantizando una posición jurídica digna en el procedimiento."
  },
  {
    question_text: "¿Qué debe hacer la Administración según el artículo 68 si detecta errores en la solicitud?",
    option_a: "Archivar inmediatamente el expediente.",
    option_b: "Requerir la subsanación en plazo de diez días.",
    option_c: "Continuar el procedimiento con los datos disponibles.",
    option_d: "Devolver la solicitud sin más trámite.",
    correct_option: "B",
    article_reference: "68",
    explanation: "El artículo 68 de la Ley 39/2015 establece que cuando la solicitud no reúna los requisitos, se debe requerir al interesado para que subsane en un plazo de diez días, garantizando el derecho a la subsanación antes de cualquier decisión desestimatoria."
  },
  {
    question_text: "¿Cuándo debe notificarse el acuerdo de iniciación según el artículo 64 de la Ley 39/2015?",
    option_a: "Solo al finalizar el procedimiento.",
    option_b: "Al interesado, entendiendo en todo caso por tal al inculpado en procedimientos sancionadores.",
    option_c: "Únicamente al denunciante.",
    option_d: "Solo cuando lo solicite el interesado.",
    correct_option: "B",
    article_reference: "64",
    explanation: "El artículo 64 de la Ley 39/2015 exige la notificación del acuerdo de iniciación a los interesados, especialmente al inculpado en procedimientos sancionadores, garantizando el conocimiento del inicio del procedimiento y el derecho de defensa."
  },
  {
    question_text: "Según el artículo 58 de la Ley 39/2015, ¿cuándo NO puede iniciarse un procedimiento de oficio?",
    option_a: "Cuando hayan transcurrido los plazos de prescripción establecidos.",
    option_b: "Cuando no sea festivo.",
    option_c: "Cuando el órgano no sea competente.",
    option_d: "Ambas a) y c) son correctas.",
    correct_option: "D",
    article_reference: "58",
    explanation: "El artículo 58 de la Ley 39/2015 establece límites a la iniciación de oficio: no puede iniciarse cuando hayan transcurrido los plazos de prescripción o cuando el órgano no sea competente, respetando los principios de legalidad y competencia."
  },
  {
    question_text: "¿Qué establece el artículo 62.5 de la Ley 39/2015 sobre las denuncias?",
    option_a: "Deben ser anónimas obligatoriamente.",
    option_b: "Cuando se formule por escrito, la denuncia deberá contener la identificación de la persona que la presenta.",
    option_c: "No pueden presentarse por escrito.",
    option_d: "Solo pueden presentarse presencialmente.",
    correct_option: "B",
    article_reference: "62",
    explanation: "El artículo 62.5 de la Ley 39/2015 exige que las denuncias escritas contengan la identificación del denunciante, evitando denuncias anónimas por escrito y garantizando la responsabilidad del denunciante en sus manifestaciones."
  },
  {
    question_text: "¿Cuál es una característica del registro electrónico de apoderamientos según el artículo 6 de la Ley 39/2015?",
    option_a: "Es opcional para las Administraciones.",
    option_b: "Facilita la acreditación de las representaciones.",
    option_c: "Solo registra poderes notariales.",
    option_d: "Tiene validez limitada a un año.",
    correct_option: "B",
    article_reference: "6",
    explanation: "El artículo 6 de la Ley 39/2015 establece que el registro electrónico de apoderamientos facilita la acreditación de las representaciones ante las Administraciones Públicas, modernizando y agilizando la gestión de los poderes de representación."
  },
  {
    question_text: "Según el artículo 57 de la Ley 39/2015, ¿contra qué no procede recurso?",
    option_a: "Contra el acuerdo de iniciación.",
    option_b: "Contra el acuerdo de acumulación.",
    option_c: "Contra las medidas provisionales.",
    option_d: "Contra la resolución final.",
    correct_option: "B",
    article_reference: "57",
    explanation: "El artículo 57 de la Ley 39/2015 establece expresamente que contra el acuerdo de acumulación no procede recurso alguno, considerándolo un acto de mero trámite sin contenido decisorio que afecte a derechos o intereses legítimos."
  },
  {
    question_text: "¿Qué requisito es esencial en las solicitudes según el artículo 66 de la Ley 39/2015?",
    option_a: "Presentación en horario de oficina únicamente.",
    option_b: "Firma del solicitante o acreditación de la autenticidad de su voluntad.",
    option_c: "Acompañar documentación original exclusivamente.",
    option_d: "Presentación por triplicado.",
    correct_option: "B",
    article_reference: "66",
    explanation: "El artículo 66 de la Ley 39/2015 exige como requisito esencial la firma del solicitante o acreditación de la autenticidad de su voluntad, garantizando que la solicitud expresa realmente la voluntad del interesado y no es apócrifa."
  },
  {
    question_text: "En relación con el artículo 53.2 de la Ley 39/2015, los interesados en el procedimiento:",
    option_a: "No pueden aportar documentos una vez iniciado el trámite de audiencia.",
    option_b: "Tienen derecho a aportar documentos en cualquier fase anterior al trámite de audiencia.",
    option_c: "Solo pueden aportar documentos al inicio del procedimiento.",
    option_d: "No tienen derecho a aportar documentos.",
    correct_option: "B",
    article_reference: "53",
    explanation: "El artículo 53.2 de la Ley 39/2015 reconoce el derecho de los interesados a aportar documentos en cualquier fase del procedimiento anterior al trámite de audiencia, permitiendo una defensa activa y dinámica de sus intereses durante la tramitación."
  },
  {
    question_text: "¿Qué establece el artículo 60 sobre la orden superior que inicia un procedimiento?",
    option_a: "No requiere especificar nada particular.",
    option_b: "Debe especificar el órgano competente para la instrucción y resolución.",
    option_c: "Solo debe indicar la fecha de inicio.",
    option_d: "Únicamente debe mencionar la normativa aplicable.",
    correct_option: "B",
    article_reference: "60",
    explanation: "El artículo 60 de la Ley 39/2015 exige que la orden superior que inicie un procedimiento especifique el órgano competente para su instrucción y resolución, garantizando la claridad competencial y la responsabilidad orgánica desde el inicio del procedimiento."
  }
];

async function addGarantiasQuestions() {
  try {
    console.log('🔍 INICIANDO SCRIPT GARANTÍAS...\n');

    // 1. Buscar el content scope de garantías
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
    console.log('📚 Artículos en scope:', contentScope.article_numbers?.length || 0);

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

    // 3. Obtener todos los artículos disponibles
    const { data: articles, error: articlesError } = await supabase
      .from('articles')
      .select('id, article_number, title')
      .eq('law_id', law.id);

    if (articlesError) {
      console.log('❌ Error obteniendo artículos:', articlesError.message);
      return;
    }

    console.log('✅ Artículos disponibles:', articles.length);

    // 4. Procesar y añadir preguntas
    let addedCount = 0;
    let errorCount = 0;

    for (const questionData of garantiasQuestions) {
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

    console.log('\n📊 RESUMEN GARANTÍAS:');
    console.log('✅ Preguntas añadidas exitosamente:', addedCount);
    console.log('❌ Preguntas con errores:', errorCount);
    console.log('📝 Total procesadas:', garantiasQuestions.length);

    console.log('\n🎯 ESTADO FINAL SECCIÓN:');
    console.log('📚 Sección: Procedimiento Administrativo: Garantías');
    console.log('📄 Total preguntas en garantías:', addedCount);
    console.log('🌐 URL: /test-oposiciones/procedimiento-administrativo/garantias');

  } catch (error) {
    console.error('❌ Error general:', error.message);
  }
}

addGarantiasQuestions();