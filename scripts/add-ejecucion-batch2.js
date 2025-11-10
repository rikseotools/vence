// scripts/add-ejecucion-batch2.js
// Script para añadir 41 preguntas de ejecución de procedimiento administrativo con explicaciones didácticas

import { createClient } from '@supabase/supabase-js';

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );
}

function letterToNumber(letter) {
  const mapping = { 'A': 0, 'B': 1, 'C': 2, 'D': 3 };
  return mapping[letter.toUpperCase()];
}

const questionsBatch2 = [
  {
    question_text: "De acuerdo con la Ley 39/2015, los actos de las Administraciones Públicas sujetos al Derecho Administrativo serán inmediatamente ejecutivos, salvo que:",
    option_a: "Se trate de una resolución de un procedimiento de responsabilidad patrimonial contra la que quepa algún recurso en vía administrativa, incluido el potestativo de reposición.",
    option_b: "Se trate de una resolución de un procedimiento de naturaleza sancionadora contra la que quepa algún recurso en vía administrativa, excluido el potestativo de reposición.",
    option_c: "Se trate de una resolución de un procedimiento de naturaleza sancionadora contra la que quepa algún recurso en vía administrativa, incluido el potestativo de reposición.",
    option_d: "Se trate de una resolución de un procedimiento de responsabilidad patrimonial contra la que quepa algún recurso en vía administrativa, excluido el potestativo de reposición.",
    correct_option: "C",
    explanation: "El artículo 98 de la Ley 39/2015 establece que los actos son inmediatamente ejecutivos salvo excepciones específicas. Una de estas excepciones es cuando se trata de resoluciones sancionadoras contra las que quepa recurso administrativo, incluido el potestativo de reposición, ya que estas resoluciones requieren mayor garantía procesal antes de su ejecución.",
    law_short_name: "Ley 39/2015",
    article_number: "98"
  },
  {
    question_text: "Según lo previsto en la Ley 39/2015, se admitirán a trámite:",
    option_a: "Acciones posesorias contra las actuaciones de los órganos administrativos realizadas en materia de su competencia y de acuerdo con el procedimiento legalmente establecido.",
    option_b: "Acciones posesorias contra las actuaciones de los órganos administrativos realizadas en materia de su competencia y de acuerdo con el procedimiento reglamentariamente establecido.",
    option_c: "Acciones posesorias contra las actuaciones de los órganos judiciales realizadas en materia de su competencia y de acuerdo con el procedimiento legalmente establecido.",
    option_d: "Ninguna es correcta.",
    correct_option: "D",
    explanation: "Según el artículo 105 de la Ley 39/2015, NO se admitirán a trámite acciones posesorias contra actuaciones administrativas realizadas en competencia y procedimiento legalmente establecido. Esta prohibición protege la eficacia de la actuación administrativa y evita la interferencia de los tribunales civiles en el ejercicio de potestades administrativas legítimas.",
    law_short_name: "Ley 39/2015",
    article_number: "105"
  },
  {
    question_text: "De acuerdo con la Ley 39/2015, en la ejecución subsidiaria:",
    option_a: "Las Administraciones Públicas realizarán el acto, por sí o a través de las personas que determinen, a costa del obligado.",
    option_b: "Los obligados realizarán el acto, por sí o a través de las personas que determinen, a costa de la Administración.",
    option_c: "Las Administraciones Públicas realizarán el acto, por sí o a través de las personas que determinen, a costa de la misma.",
    option_d: "Las Administraciones Públicas realizarán el acto, a través de terceros exclusivamente, a costa del obligado.",
    correct_option: "A",
    explanation: "El artículo 102 establece que la ejecución subsidiaria permite a la Administración realizar directamente la prestación incumplida por el obligado, repercutiendo todos los gastos, daños y perjuicios al incumplidor. Es un mecanismo eficaz cuando la obligación consiste en una prestación de hacer que puede ser realizada por un tercero.",
    law_short_name: "Ley 39/2015",
    article_number: "102"
  },
  {
    question_text: "De conformidad con el artículo 103 de la Ley 39/2015, las Administraciones Públicas pueden imponer multas coercitivas en los siguientes supuestos:",
    option_a: "Actos personalísimos en que proceda la compulsión directa sobre la persona del obligado.",
    option_b: "Actos no personalísimos en que proceda la compulsión directa sobre la persona del obligado.",
    option_c: "Actos personalísimos en que no proceda la compulsión directa sobre la persona del obligado.",
    option_d: "Actos no personalísimos en que no proceda la compulsión directa sobre la persona del obligado.",
    correct_option: "C",
    explanation: "Las multas coercitivas se aplican específicamente en actos personalísimos donde NO procede la compulsión directa sobre la persona. Son una forma de presión económica progresiva para lograr el cumplimiento cuando la prestación solo puede ser realizada por el propio obligado y no cabe la sustitución forzosa.",
    law_short_name: "Ley 39/2015",
    article_number: "103"
  },
  {
    question_text: "Según lo previsto en la Ley 39/2015, el órgano que ordene un acto de ejecución material de resoluciones estará obligado a:",
    option_a: "Solicitar, con carácter previo, la autorización del órgano que dictó la resolución objeto de ejecución.",
    option_b: "Solicitar el dictamen del Consejo de Estado.",
    option_c: "Notificar al particular interesado la resolución que autorice la actuación administrativa.",
    option_d: "Solicitar la intervención de los Tribunales.",
    correct_option: "C",
    explanation: "El artículo 97 establece que el órgano ejecutor debe notificar previamente al interesado la resolución que autoriza la actuación administrativa. Esta notificación garantiza el derecho de defensa y permite al afectado conocer las razones y el fundamento legal de la actuación que se va a realizar contra él.",
    law_short_name: "Ley 39/2015",
    article_number: "97"
  },
  {
    question_text: "Conforme a lo dispuesto en la Ley 39/2015, cuando fuese necesario entrar en el domicilio del afectado por la ejecución forzosa:",
    option_a: "Las Administraciones Públicas deberán obtener la oportuna autorización judicial, independientemente de que se tenga el consentimiento del titular del domicilio.",
    option_b: "Las Administraciones Públicas pueden acordar la entrada en domicilios de los interesados, previa autorización administrativa.",
    option_c: "Las Administraciones Públicas pueden obtener el consentimiento del mismo o, en su defecto, la oportuna autorización administrativa.",
    option_d: "Las Administraciones Públicas deberán obtener el consentimiento del mismo o, en su defecto, la oportuna autorización judicial.",
    correct_option: "D",
    explanation: "El artículo 100 protege la inviolabilidad del domicilio estableciendo que se requiere consentimiento del titular o, subsidiariamente, autorización judicial. Esta garantía constitucional no puede ser eludida mediante autorización administrativa, siendo necesaria siempre la intervención judicial cuando no hay consentimiento voluntario.",
    law_short_name: "Ley 39/2015",
    article_number: "100"
  },
  {
    question_text: "De conformidad con la Ley 39/2015, no podrá imponerse a los administrados una obligación pecuniaria que no estuviese establecida con arreglo a:",
    option_a: "Una norma reglamentaria.",
    option_b: "Un Decreto.",
    option_c: "Una Orden.",
    option_d: "Una norma con rango legal.",
    correct_option: "D",
    explanation: "El artículo 101.2 consagra el principio de reserva de ley en materia tributaria y sancionadora. Solo las normas con rango de ley (leyes orgánicas, ordinarias, decretos-ley, decretos legislativos) pueden establecer obligaciones pecuniarias para los ciudadanos, garantizando así el principio democrático de que solo los representantes del pueblo pueden imponer cargas económicas.",
    law_short_name: "Ley 39/2015",
    article_number: "101"
  },
  {
    question_text: "Conforme a lo dispuesto en la Ley 39/2015, si fueran varios los medios de ejecución forzosa admisibles se elegirá:",
    option_a: "El que menos coste tenga para la Administración.",
    option_b: "El que menos coste tenga para el interesado.",
    option_c: "El menos restrictivo de la libertad individual.",
    option_d: "El que suponga la más rápida ejecución del acto administrativo.",
    correct_option: "C",
    explanation: "El artículo 100 establece el principio de proporcionalidad en la ejecución forzosa. Cuando existen varios medios ejecutivos posibles, debe escogerse el menos lesivo para los derechos del administrado, especialmente el menos restrictivo de la libertad individual, garantizando así que la coacción administrativa sea la mínima necesaria para lograr el cumplimiento.",
    law_short_name: "Ley 39/2015",
    article_number: "100"
  },
  {
    question_text: "De acuerdo con la Ley 39/2015, en la ejecución subsidiaria el acto se realizará a costa de:",
    option_a: "Las Aseguradoras de la Administración.",
    option_b: "Un tercero.",
    option_c: "El obligado.",
    option_d: "La Administración.",
    correct_option: "C",
    explanation: "En la ejecución subsidiaria (artículo 102), cuando el obligado no cumple una prestación de hacer, la Administración puede realizarla directamente o encargarla a terceros, pero todos los gastos, daños y perjuicios se repercuten al obligado incumplidor. Es un principio básico: quien incumple asume las consecuencias económicas de su incumplimiento.",
    law_short_name: "Ley 39/2015",
    article_number: "102"
  },
  {
    question_text: "Según el artículo 99 de la Ley 39/2015, las Administraciones Públicas, a través de sus órganos competentes en cada caso, podrán proceder:",
    option_a: "A la ejecución forzosa de los actos administrativos, inclusive en los supuestos en que se suspenda la ejecución de acuerdo con la Ley, o cuando la Constitución o la Ley exijan la intervención de un órgano judicial.",
    option_b: "A la ejecución forzosa de los actos administrativos, salvo en los supuestos en que se adopten medidas provisionales de acuerdo con la Ley, o cuando la Constitución o la Ley exijan la intervención de un órgano económico-administrativo.",
    option_c: "A la ejecución forzosa de los actos administrativos, salvo en los supuestos en que se suspenda la ejecución de acuerdo con la Ley, o cuando la Constitución o la Ley exijan la intervención de un órgano administrativo.",
    option_d: "A la ejecución forzosa de los actos administrativos, salvo en los supuestos en que se suspenda la ejecución de acuerdo con la Ley, o cuando la Constitución o la Ley exijan la intervención de un órgano judicial.",
    correct_option: "D",
    explanation: "El artículo 99 establece que la Administración puede proceder a la ejecución forzosa como regla general, pero con dos importantes limitaciones: cuando se haya suspendido la ejecución conforme a la ley (por ejemplo, por un recurso) o cuando sea necesaria la intervención judicial (como en casos de entrada en domicilio o cuando lo exija la separación de poderes).",
    law_short_name: "Ley 39/2015",
    article_number: "99"
  },
  {
    question_text: "De conformidad con el artículo 103 de la Ley 39/2015, ¿quiénes podrán imponer multas coercitivas?",
    option_a: "Las Administraciones Públicas.",
    option_b: "El Ministerio Fiscal.",
    option_c: "Los Juzgados y Tribunales.",
    option_d: "El Consejo General del Poder Judicial.",
    correct_option: "A",
    explanation: "Las multas coercitivas son una potestad exclusivamente administrativa regulada en el artículo 103. Permiten a las Administraciones Públicas ejercer presión económica progresiva para lograr el cumplimiento de obligaciones personalísimas cuando no cabe la compulsión directa ni la ejecución subsidiaria.",
    law_short_name: "Ley 39/2015",
    article_number: "103"
  },
  {
    question_text: "Es un medio de ejecución forzosa de los actos administrativos:",
    option_a: "La sanción subsidiaria.",
    option_b: "La multa coercitiva.",
    option_c: "La desviación de poder.",
    option_d: "La compulsa de documentos administrativos.",
    correct_option: "B",
    explanation: "El artículo 100 enumera los medios de ejecución forzosa: apremio sobre el patrimonio, ejecución subsidiaria, multa coercitiva y compulsión sobre las personas. La multa coercitiva es específicamente un mecanismo de presión económica para forzar el cumplimiento cuando la prestación es personalísima.",
    law_short_name: "Ley 39/2015",
    article_number: "100"
  },
  {
    question_text: "De conformidad con el artículo 103 de la Ley 39/2015, las Administraciones Públicas:",
    option_a: "Podrán imponer multas coercitivas para la ejecución de determinados actos, reiteradas por lapsos de tiempo que sean suficientes para cumplir lo ordenado, con un máximo de tres multas por cada acto, posteriormente si no se cumple con lo ordenado habría que acudir a la vía contenciosa.",
    option_b: "Podrán imponer multas coercitivas para la ejecución de determinados actos, reiteradas por lapsos de tiempo que sean suficientes para cumplir lo ordenado, con un máximo de cinco multas por cada acto, posteriormente si no se cumple con lo ordenado habría que acudir a la vía contenciosa.",
    option_c: "Solo podrán imponer una multa coercitiva por cada acto susceptible de ejecución.",
    option_d: "Podrán imponer multas coercitivas para la ejecución de determinados actos, reiteradas por lapsos de tiempo que sean suficientes para cumplir lo ordenado.",
    correct_option: "D",
    explanation: "El artículo 103 no establece un límite máximo al número de multas coercitivas que pueden imponerse. Pueden reiterarse por períodos de tiempo suficientes para el cumplimiento, manteniendo la presión económica hasta lograr la ejecución. La periodicidad debe ser razonable y proporcional al incumplimiento.",
    law_short_name: "Ley 39/2015",
    article_number: "103"
  },
  {
    question_text: "Según el artículo 97 de la Ley 39/2015, estará obligado a notificar al particular interesado la resolución que autorice la actuación administrativa:",
    option_a: "El órgano que ordene un acto de ejecución material de resoluciones.",
    option_b: "El servicio jurídico cuando reciba informe del Consejo General del Poder Judicial.",
    option_c: "El órgano que solicite la intervención del Consejo de Estado.",
    option_d: "El órgano que ordene un acto de ejecución formal de resoluciones.",
    correct_option: "A",
    explanation: "El artículo 97 establece claramente que el órgano que ordena la ejecución material debe notificar previamente la resolución que autoriza la actuación. Esta notificación previa es una garantía esencial del derecho de defensa, permitiendo al interesado conocer y, en su caso, impugnar la decisión ejecutiva antes de su materialización.",
    law_short_name: "Ley 39/2015",
    article_number: "97"
  },
  {
    question_text: "Conforme a la Ley 39/2015, ¿en qué casos se podrá llevar a cabo la compulsión directa sobre las personas como forma de ejecución forzosa?",
    option_a: "En los casos en que la ley expresamente lo autorice, y dentro siempre del respeto debido a su dignidad y a los derechos reconocidos en la Constitución.",
    option_b: "En los casos en que se autorice reglamentariamente, y dentro siempre del respeto debido a su libertad y a los derechos reconocidos en la Ley del Procedimiento Administrativo Común.",
    option_c: "En los casos en que se autorice mediante Real Decreto y dentro siempre del respeto al principio de legalidad y seguridad jurídica.",
    option_d: "En los casos en que se autorice reglamentariamente, y dentro siempre del respeto debido a su dignidad y a los derechos reconocidos en la Constitución.",
    correct_option: "A",
    explanation: "El artículo 104 requiere autorización legal expresa para la compulsión sobre personas, estableciendo además límites constitucionales estrictos. Esta exigencia refleja la gravedad de afectar la libertad personal, que solo puede hacerse con habilitación legal específica y respetando la dignidad humana y los derechos fundamentales.",
    law_short_name: "Ley 39/2015",
    article_number: "104"
  },
  {
    question_text: "Señale la respuesta correcta en relación a lo establecido en el artículo 97 de la Ley 39/2015 sobre la ejecutoriedad de los actos de las Administraciones Públicas:",
    option_a: "Las resoluciones de las Administraciones Públicas sujetos a Derecho Administrativo se presumirán válidas, por lo que en consecuencia, serán inmediatamente ejecutivas desde la fecha en que se adoptan.",
    option_b: "Las Administraciones Públicas no iniciarán ninguna actuación material de ejecución de resoluciones que limite derechos de los particulares sin que previamente haya sido adoptada la resolución que le sirva de fundamento jurídico.",
    option_c: "Los actos de ejecución material de resoluciones surtirán efectos desde la fecha en que se dicten.",
    option_d: "Si para llevar a cabo la ejecución forzosa de un acto fuese necesario entrar en el domicilio de un afectado, podrá hacerse, en todo caso, en virtud de la presunción de validez y eficacia de los actos administrativos.",
    correct_option: "B",
    explanation: "El artículo 97 establece una garantía fundamental: no puede iniciarse ninguna actuación material ejecutiva sin resolución previa que la fundamente. Esta regla protege contra actuaciones administrativas arbitrarias, exigiendo siempre un acto formal y motivado que justifique la ejecución material.",
    law_short_name: "Ley 39/2015",
    article_number: "97"
  },
  {
    question_text: "Según el artículo 98 de la Ley 39/2015, con carácter general, los actos de las Administraciones Públicas sujetos al Derecho Administrativo serán:",
    option_a: "Comprensivos.",
    option_b: "Diligentes.",
    option_c: "Dilatorios.",
    option_d: "Inmediatamente ejecutivos.",
    correct_option: "D",
    explanation: "El artículo 98 consagra el principio de ejecutoriedad inmediata como regla general para los actos administrativos. Esta característica distingue al Derecho Administrativo del civil, permitiendo a la Administración ejecutar sus decisiones sin necesidad de acudir previamente a los tribunales, salvo las excepciones legalmente establecidas.",
    law_short_name: "Ley 39/2015",
    article_number: "98"
  },
  {
    question_text: "Conforme a lo dispuesto en la Ley 39/2015, ¿en qué casos las Administraciones Públicas deberán obtener el consentimiento de la persona o, en su defecto, la oportuna autorización judicial?",
    option_a: "Cuando fuese necesario realizar alguna actuación que afectase a su libertad individual.",
    option_b: "Cuando fuese necesario realizar acciones que impliquen obligaciones de hacer o soportar al interesado.",
    option_c: "Cuando fuese necesario realizar acciones que impliquen obligaciones personalísimas de no hacer.",
    option_d: "Cuando fuese necesario entrar en el domicilio del afectado o en los restantes lugares que requieran la autorización de su titular.",
    correct_option: "D",
    explanation: "El artículo 100 específicamente regula la entrada en domicilio, que como derecho fundamental requiere consentimiento del titular o autorización judicial subsidiaria. Esta garantía protege la inviolabilidad del domicilio frente a las potestades ejecutivas administrativas, manteniendo el equilibrio entre eficacia administrativa y derechos fundamentales.",
    law_short_name: "Ley 39/2015",
    article_number: "100"
  },
  {
    question_text: "Según la Ley 39/2015, salvo que se justifique la imposibilidad de hacerlo, ¿en qué casos se utilizará la transferencia bancaria como medio de pago?",
    option_a: "Cuando de una resolución administrativa nazca una obligación personalísima de hacer o soportar o cualquier otro derecho que haya de abonarse a la Hacienda pública.",
    option_b: "Cuando de una resolución administrativa nazca una obligación personalísima de no hacer o cualquier otro derecho que haya de abonarse a la Hacienda pública.",
    option_c: "Cuando de una resolución administrativa nazca una obligación de ejecución subsidiaria por parte de la Administración o cualquier otro derecho que haya de abonarse a la Hacienda pública.",
    option_d: "Cuando de una resolución administrativa nazca una obligación de pago derivada de una sanción pecuniaria, multa o cualquier otro derecho que haya de abonarse a la Hacienda pública.",
    correct_option: "D",
    explanation: "El artículo 98.2 establece que en obligaciones de pago (sanciones, multas, tasas, etc.) se utilizará preferentemente la transferencia bancaria como medio más seguro y eficiente. Esta modernización de los medios de pago mejora la gestión recaudatoria y reduce costes administrativos, salvo imposibilidad justificada.",
    law_short_name: "Ley 39/2015",
    article_number: "98"
  },
  {
    question_text: "El artículo 99 de la Ley 39/2015, dispone que las Administraciones Públicas, a través de sus órganos competentes en cada caso, podrán proceder a la ejecución forzosa de los actos administrativos, salvo en los supuestos en que se suspenda la ejecución de acuerdo con la Ley, o cuando la Constitución o la Ley exijan la intervención de un órgano judicial:",
    option_a: "Previo apercibimiento.",
    option_b: "Previo informe favorable del Consejo de Estado.",
    option_c: "Previa motivación por el órgano competente.",
    option_d: "Previa resolución administrativa que así lo establezca.",
    correct_option: "A",
    explanation: "El artículo 99 exige 'previo apercibimiento' como garantía procedimental antes de la ejecución forzosa. Este apercibimiento advierte al obligado de las consecuencias de su incumplimiento y le otorga una última oportunidad de cumplimiento voluntario, respetando así el principio de proporcionalidad en la actuación administrativa.",
    law_short_name: "Ley 39/2015",
    article_number: "99"
  },
  {
    question_text: "De conformidad con el artículo 103 de la Ley 39/2015, señale la respuesta correcta en relación con el apremio sobre el patrimonio:",
    option_a: "En cualquier caso deberá imponerse a los administrados una obligación pecuniaria que no estuviese establecida con arreglo a una norma de rango legal.",
    option_b: "En cualquier caso no podrá imponerse a los administrados una obligación pecuniaria que estuviese establecida con arreglo a una norma de rango legal.",
    option_c: "En cualquier caso podrá imponerse a los administrados una obligación pecuniaria que no estuviese establecida con arreglo a una norma de rango legal.",
    option_d: "En cualquier caso no podrá imponerse a los administrados una obligación pecuniaria que no estuviese establecida con arreglo a una norma de rango legal.",
    correct_option: "D",
    explanation: "Este principio fundamental del artículo 101.2 protege a los ciudadanos estableciendo que solo las normas con rango de ley pueden crear obligaciones pecuniarias. Garantiza el principio democrático de reserva de ley en materia tributaria y sancionadora, impidiendo que reglamentos o actos administrativos impongan cargas económicas no previstas legalmente.",
    law_short_name: "Ley 39/2015",
    article_number: "101"
  },
  {
    question_text: "Según el art. 103 de la Ley 39/2015, del Procedimiento Administrativo Común de las Administraciones Públicas, la multa coercitiva:",
    option_a: "No es independiente de las sanciones que puedan imponerse con tal carácter y resulta incompatible con ellas.",
    option_b: "Es alternativa de las sanciones que puedan imponerse con tal carácter y accesoria a ellas.",
    option_c: "Es independiente de las sanciones que puedan imponerse con tal carácter y compatible con ellas.",
    option_d: "Es independiente de las sanciones que puedan imponerse con tal carácter pero incompatible con ellas.",
    correct_option: "C",
    explanation: "Las multas coercitivas tienen naturaleza ejecutiva, no sancionadora. Su finalidad es forzar el cumplimiento, no castigar una infracción. Por ello son independientes y compatibles con sanciones posteriores por la misma conducta, ya que persiguen objetivos diferentes: una busca la ejecución y otra la represión de la infracción.",
    law_short_name: "Ley 39/2015",
    article_number: "103"
  },
  {
    question_text: "De acuerdo con el artículo 103 de la Ley 39/2015, las Administraciones Públicas pueden imponer multas coercitivas en los siguientes supuestos:",
    option_a: "Actos en que, procediendo la compulsión, la Administración no la estimara conveniente.",
    option_b: "Actos personalísimos de no hacer o soportar.",
    option_c: "Actos no personalísimos en que no proceda la compulsión directa sobre la persona del obligado.",
    option_d: "Actos cuya ejecución no se pueda encargar a otra persona distinta del obligado.",
    correct_option: "A",
    explanation: "El artículo 103 permite multas coercitivas cuando, aunque fuera técnicamente posible la compulsión directa, la Administración considera más conveniente o proporcional utilizar la presión económica. Esto refleja el principio de proporcionalidad, eligiendo el medio menos lesivo para lograr el cumplimiento.",
    law_short_name: "Ley 39/2015",
    article_number: "103"
  },
  {
    question_text: "De conformidad con el artículo 100 de la Ley 39/2015, ¿cuál de los siguientes no es un medio de ejecución forzosa?",
    option_a: "Suspensión definitiva.",
    option_b: "Multa coercitiva.",
    option_c: "Apremio sobre el patrimonio.",
    option_d: "Ejecución subsidiaria.",
    correct_option: "A",
    explanation: "La suspensión definitiva no es un medio de ejecución forzosa sino una medida cautelar o sancionadora. El artículo 100 enumera taxativamente los medios ejecutivos: apremio patrimonial, ejecución subsidiaria, multa coercitiva y compulsión personal. Cada uno responde a diferentes tipos de obligaciones y situaciones de incumplimiento.",
    law_short_name: "Ley 39/2015",
    article_number: "100"
  },
  {
    question_text: "Según la Ley 39/2015, en la ejecución forzosa de los actos administrativos consistentes en obligaciones personalísimas de hacer, si el obligado no realizase la prestación:",
    option_a: "Podrán ser ejecutados subsidiariamente en los casos en que la ley expresamente lo autorice.",
    option_b: "El obligado deberá resarcir los daños y perjuicios.",
    option_c: "Podrán ser ejecutados por compulsión directa sobre la persona obligada.",
    option_d: "El obligado podrá optar porque sea realizada, en igualdad de condiciones, por un sujeto distinto.",
    correct_option: "B",
    explanation: "En obligaciones personalísimas de hacer que no pueden ejecutarse subsidiariamente ni por compulsión, el artículo 104.2 establece que el obligado debe resarcir daños y perjuicios. Es el mecanismo residual cuando no es posible el cumplimiento forzoso, transformando la obligación de hacer en una obligación de indemnizar.",
    law_short_name: "Ley 39/2015",
    article_number: "104"
  },
  {
    question_text: "De conformidad con la Ley 39/2015, el importe de los gastos, daños y perjuicios ocasionados como consecuencia de la ejecución subsidiaria:",
    option_a: "Podrá liquidarse de forma provisional y realizarse antes de la ejecución, a reserva de la liquidación definitiva.",
    option_b: "Deberá liquidarse de forma provisional y realizarse después de la ejecución, a reserva de la liquidación definitiva.",
    option_c: "Deberá liquidarse de forma provisional y realizarse antes de la ejecución, a reserva de la liquidación definitiva.",
    option_d: "Podrá liquidarse de forma provisional y realizarse después de la ejecución, a reserva de la liquidación definitiva.",
    correct_option: "A",
    explanation: "El artículo 102.3 permite la liquidación provisional previa a la ejecución, facilitando que la Administración disponga de recursos antes de acometer la actuación subsidiaria. Esta flexibilidad mejora la gestión financiera sin perjudicar al obligado, quien conserva el derecho a la liquidación definitiva posterior.",
    law_short_name: "Ley 39/2015",
    article_number: "102"
  },
  {
    question_text: "Conforme a lo dispuesto en el artículo 105 de la Ley 39/2015, las acciones posesorias contra las actuaciones de los órganos administrativos realizadas en materia de su competencia y de acuerdo con el procedimiento legalmente establecido:",
    option_a: "Serán estimadas en vía administrativa.",
    option_b: "No se admitirán a trámite.",
    option_c: "Se admitirán a trámite.",
    option_d: "Serán desestimadas en vía administrativa.",
    correct_option: "B",
    explanation: "El artículo 105 prohíbe categóricamente las acciones posesorias contra actuaciones administrativas legítimas. Esta prohibición protege la eficacia de la actuación administrativa evitando que los tribunales civiles interfieran en el ejercicio de potestades públicas ejercidas conforme a derecho y competencia.",
    law_short_name: "Ley 39/2015",
    article_number: "105"
  },
  {
    question_text: "De conformidad con el artículo 100 de la Ley 39/2015, la ejecución forzosa por las Administraciones Públicas se efectuará respetando siempre el principio de:",
    option_a: "Proporcionalidad.",
    option_b: "Arbitrariedad.",
    option_c: "Libertad.",
    option_d: "Responsabilidad.",
    correct_option: "A",
    explanation: "El principio de proporcionalidad es fundamental en la ejecución forzosa, exigiendo que los medios empleados sean adecuados, necesarios y proporcionados al fin perseguido. Garantiza que la coacción administrativa sea la mínima imprescindible para lograr el cumplimiento, equilibrando eficacia administrativa y derechos del administrado.",
    law_short_name: "Ley 39/2015",
    article_number: "100"
  },
  {
    question_text: "De conformidad con la Ley 39/2015, se podrán imponer multas coercitivas:",
    option_a: "Cuando así se autorice reglamentariamente, y en la forma y cuantía que determinen las Administraciones Públicas.",
    option_b: "Cuando así se disponga reglamentariamente, y en la forma y cuantía que se determine.",
    option_c: "Cuando así lo autoricen las Leyes, y en la forma y cuantía que éstas determinen.",
    option_d: "Cuando así lo autoricen las Leyes, y en la forma y cuantía que determinen las Administraciones Públicas.",
    correct_option: "C",
    explanation: "Las multas coercitivas requieren habilitación legal específica tanto para su imposición como para determinar forma y cuantía. Esta reserva de ley garantiza que solo el legislador puede autorizar este medio de coacción económica, protegiendo contra el ejercicio arbitrario de potestades sancionadoras por parte de la Administración.",
    law_short_name: "Ley 39/2015",
    article_number: "103"
  },
  {
    question_text: "De conformidad con la Ley 39/2015, el importe de los gastos, daños y perjuicios ocasionados como consecuencia de la ejecución subsidiaria:",
    option_a: "Podrá liquidarse de forma provisional y realizarse antes de la ejecución, a reserva de la liquidación definitiva.",
    option_b: "Deberá liquidarse de forma provisional y realizarse después de la ejecución, a reserva de la liquidación definitiva.",
    option_c: "Deberá liquidarse de forma provisional y realizarse antes de la ejecución, a reserva de la liquidación definitiva.",
    option_d: "Podrá liquidarse de forma provisional y realizarse después de la ejecución, a reserva de la liquidación definitiva.",
    correct_option: "A",
    explanation: "La liquidación provisional previa (artículo 102.3) es una opción, no una obligación, que permite mayor flexibilidad en la gestión de la ejecución subsidiaria. La Administración puede optar entre liquidar antes o después, según las circunstancias del caso, manteniendo siempre el derecho del obligado a la liquidación definitiva posterior.",
    law_short_name: "Ley 39/2015",
    article_number: "102"
  },
  {
    question_text: "De conformidad con el artículo 100 de la Ley 39/2015, los medios por los que se efectuará la ejecución forzosa por las Administraciones públicas son:",
    option_a: "Apremio sobre el patrimonio, ejecución subsidiaria, multa coercitiva, responsabilidad patrimonial, compulsión sobre las personas.",
    option_b: "Apremio sobre el patrimonio, ejecución subsidiaria, multa coercitiva, medidas de seguridad preventivas, compulsión sobre las personas.",
    option_c: "Apremio sobre el patrimonio, ejecución subsidiaria, multa coercitiva, compulsión sobre las personas.",
    option_d: "Apremio sobre el patrimonio, ejecución subsidiaria, multa coercitiva, medidas preventivas y responsabilidad patrimonial.",
    correct_option: "C",
    explanation: "El artículo 100.1 enumera taxativamente los cuatro medios de ejecución forzosa: apremio patrimonial (para obligaciones pecuniarias), ejecución subsidiaria (prestaciones de hacer realizables por terceros), multa coercitiva (presión económica progresiva) y compulsión personal (cuando la ley lo autorice expresamente).",
    law_short_name: "Ley 39/2015",
    article_number: "100"
  },
  {
    question_text: "De acuerdo con la Ley 39/2015, el importe de los gastos, daños y perjuicios se exigirá conforme:",
    option_a: "Al procedimiento contencioso.",
    option_b: "Al procedimiento de ejecución administrativa.",
    option_c: "Al procedimiento de apremio.",
    option_d: "Al procedimiento administrativo.",
    correct_option: "C",
    explanation: "El artículo 102.3 establece que los importes derivados de la ejecución subsidiaria se exigen mediante el procedimiento de apremio, que es el mecanismo específico para el cobro ejecutivo de deudas con la Hacienda Pública. Este procedimiento ofrece garantías pero permite una recaudación eficaz de los créditos administrativos.",
    law_short_name: "Ley 39/2015",
    article_number: "102"
  },
  {
    question_text: "Conforme a lo dispuesto en el artículo 105 de la Ley 39/2015, las acciones posesorias contra las actuaciones de los órganos administrativos realizadas en materia de su competencia y de acuerdo con el procedimiento legalmente establecido:",
    option_a: "Serán estimadas en vía administrativa.",
    option_b: "No se admitirán a trámite.",
    option_c: "Se admitirán a trámite.",
    option_d: "Serán desestimadas en vía administrativa.",
    correct_option: "B",
    explanation: "La inadmisión a trámite es tajante cuando las actuaciones administrativas se realizan dentro de la competencia y conforme al procedimiento legal. Esta regla protege la ejecución administrativa legítima frente a interferencias judiciales civiles, manteniendo la separación entre jurisdicciones administrativa y civil.",
    law_short_name: "Ley 39/2015",
    article_number: "105"
  },
  {
    question_text: "De conformidad con el artículo 100 de la Ley 39/2015, la ejecución forzosa por las Administraciones Públicas se efectuará respetando siempre el principio de:",
    option_a: "Proporcionalidad.",
    option_b: "Arbitrariedad.",
    option_c: "Libertad.",
    option_d: "Responsabilidad.",
    correct_option: "A",
    explanation: "La proporcionalidad es el principio rector que equilibra la necesidad de ejecución administrativa con el respeto a los derechos del administrado. Exige valorar la adecuación, necesidad y proporcionalidad stricto sensu de las medidas ejecutivas, garantizando que la intensidad de la coacción corresponda a la importancia del interés público perseguido.",
    law_short_name: "Ley 39/2015",
    article_number: "100"
  },
  {
    question_text: "Según el art. 103 de la Ley 39/2015, del Procedimiento Administrativo Común de las Administraciones Públicas, la multa coercitiva:",
    option_a: "No es independiente de las sanciones que puedan imponerse con tal carácter y resulta incompatible con ellas.",
    option_b: "Es alternativa de las sanciones que puedan imponerse con tal carácter y accesoria a ellas.",
    option_c: "Es independiente de las sanciones que puedan imponerse con tal carácter y compatible con ellas.",
    option_d: "Es independiente de las sanciones que puedan imponerse con tal carácter pero incompatible con ellas.",
    correct_option: "C",
    explanation: "Esta distinción es clave: las multas coercitivas son medidas ejecutivas (buscan el cumplimiento futuro) mientras que las sanciones son represivas (castigan infracciones pasadas). Su diferente naturaleza jurídica permite su compatibilidad, pudiendo coexistir ambas figuras por los mismos hechos sin vulnerar el principio non bis in idem.",
    law_short_name: "Ley 39/2015",
    article_number: "103"
  },
  {
    question_text: "De acuerdo con el artículo 103 de la Ley 39/2015, las Administraciones Públicas pueden imponer multas coercitivas en los siguientes supuestos:",
    option_a: "Actos en que, procediendo la compulsión, la Administración no la estimara conveniente.",
    option_b: "Actos personalísimos de no hacer o soportar.",
    option_c: "Actos no personalísimos en que no proceda la compulsión directa sobre la persona del obligado.",
    option_d: "Actos cuya ejecución no se pueda encargar a otra persona distinta del obligado.",
    correct_option: "A",
    explanation: "Esta norma reconoce la discrecionalidad administrativa para elegir el medio ejecutivo menos lesivo. Aunque técnicamente sea posible la compulsión directa, la Administración puede preferir la multa coercitiva por consideraciones de proporcionalidad, eficacia o menor afectación a los derechos del obligado.",
    law_short_name: "Ley 39/2015",
    article_number: "103"
  },
  {
    question_text: "De conformidad con el artículo 100 de la Ley 39/2015, ¿cuál de los siguientes no es un medio de ejecución forzosa?",
    option_a: "Suspensión definitiva.",
    option_b: "Multa coercitiva.",
    option_c: "Apremio sobre el patrimonio.",
    option_d: "Ejecución subsidiaria.",
    correct_option: "A",
    explanation: "La suspensión definitiva es una sanción administrativa o medida cautelar, no un medio de ejecución forzosa. Los medios ejecutivos están tasativamente enumerados en el artículo 100 y responden a la lógica de obtener el cumplimiento, no de sancionar o prevenir, que son las funciones propias de la suspensión.",
    law_short_name: "Ley 39/2015",
    article_number: "100"
  }
];

async function addEjecucionQuestionsBatch2() {
  try {
    console.log('🎯 AÑADIENDO 41 PREGUNTAS DE EJECUCIÓN (BATCH 2):\n');
    
    const supabase = getSupabase();
    
    // Obtener la Ley 39/2015
    const { data: ley39, error: lawError } = await supabase
      .from('laws')
      .select('id')
      .eq('short_name', 'Ley 39/2015')
      .single();

    if (lawError) {
      throw new Error('Error obteniendo Ley 39/2015: ' + lawError.message);
    }

    console.log('⚖️ Ley 39/2015 encontrada:', ley39.id);

    let addedCount = 0;
    let duplicateCount = 0;
    let errorCount = 0;

    for (const [index, questionData] of questionsBatch2.entries()) {
      try {
        console.log(`\n📝 Procesando pregunta ${index + 1}/41...`);

        // Buscar el artículo correspondiente
        const { data: article, error: articleError } = await supabase
          .from('articles')
          .select('id')
          .eq('law_id', ley39.id)
          .eq('article_number', questionData.article_number)
          .single();

        if (articleError) {
          console.log(`❌ Error: Artículo ${questionData.article_number} no encontrado`);
          errorCount++;
          continue;
        }

        // Verificar si la pregunta ya existe (por texto)
        const { data: existingQuestion } = await supabase
          .from('questions')
          .select('id')
          .eq('question_text', questionData.question_text)
          .limit(1);

        if (existingQuestion && existingQuestion.length > 0) {
          console.log(`⚠️ Pregunta duplicada (omitida): "${questionData.question_text.substring(0, 50)}..."`);
          duplicateCount++;
          continue;
        }

        // Preparar datos de la pregunta
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

        // Insertar la pregunta
        const { data, error } = await supabase
          .from('questions')
          .insert(questionInsert)
          .select()
          .single();

        if (error) {
          console.log(`❌ Error insertando pregunta ${index + 1}:`, error.message);
          errorCount++;
        } else {
          console.log(`✅ Pregunta ${index + 1} añadida - Art. ${questionData.article_number}`);
          addedCount++;
        }

      } catch (error) {
        console.log(`❌ Error procesando pregunta ${index + 1}:`, error.message);
        errorCount++;
      }
    }

    console.log('\n📊 RESUMEN FINAL:');
    console.log(`   ✅ Preguntas añadidas: ${addedCount}`);
    console.log(`   ⚠️ Preguntas duplicadas: ${duplicateCount}`);
    console.log(`   ❌ Errores: ${errorCount}`);
    console.log(`   📝 Total procesadas: ${questionsBatch2.length}`);
    
    if (addedCount > 0) {
      console.log('\n🎉 ¡BATCH 2 DE PREGUNTAS DE EJECUCIÓN AÑADIDO EXITOSAMENTE!');
      console.log('🔗 Las preguntas están disponibles en la sección de Ejecución');
    }

  } catch (error) {
    console.error('❌ Error general:', error.message);
    throw error;
  }
}

// Ejecutar el script
addEjecucionQuestionsBatch2()
  .then(() => {
    console.log('\n✅ Script completado exitosamente');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Error ejecutando script:', error.message);
    process.exit(1);
  });