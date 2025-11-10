// scripts/add-ejecucion-batch1.js
// Preguntas de ejecución del procedimiento administrativo

import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

function letterToNumber(letter) {
  const map = { 'A': 0, 'B': 1, 'C': 2, 'D': 3 };
  return map[letter.toUpperCase()];
}

// Preguntas extraídas de las imágenes (TODAS, incluyendo Art. 98 ya creado)
const questionsBatch = [
  // ARTÍCULO 96 - TRAMITACIÓN SIMPLIFICADA
  {
    question_text: "De conformidad con la Ley 39/2015, ¿desde qué momento se empieza a contar la duración de los procedimientos administrativos tramitados de manera simplificada?",
    option_a: "Desde el día en que se notifique al interesado el acuerdo de tramitación simplificada del procedimiento.",
    option_b: "Desde el día en que se publique el acuerdo de tramitación simplificada del procedimiento.",
    option_c: "Desde el día siguiente al que se notifique al interesado el acuerdo de tramitación simplificada del procedimiento.",
    option_d: "Desde el día siguiente al que se publique el convenio de tramitación simplificada del procedimiento.",
    correct_option: "C",
    explanation: "Según el artículo 96 de la Ley 39/2015, la duración se cuenta desde el día siguiente al que se notifique al interesado el acuerdo de tramitación simplificada.",
    law_short_name: "Ley 39/2015",
    article_number: "96"
  },
  {
    question_text: "Según la Ley 39/2015, cuando se tramite un procedimiento de forma simplificada:",
    option_a: "El órgano competente para su tramitación podrá acordar continuar con arreglo a la tramitación ordinaria, siempre que se solicite antes del periodo de prueba.",
    option_b: "El órgano competente para su tramitación deberá acordar la continuación con arreglo a la tramitación ordinaria, en cualquier momento del procedimiento anterior al trámite de audiencia.",
    option_c: "El órgano competente para su tramitación podrá acordar continuar con arreglo a la tramitación ordinaria, en cualquier momento del procedimiento anterior a su resolución.",
    option_d: "El órgano competente para su tramitación deberá acordar la continuación con arreglo a la tramitación ordinaria, en cualquier momento del procedimiento anterior a la propuesta de resolución.",
    correct_option: "C",
    explanation: "El artículo 96 establece que el órgano competente podrá acordar continuar con tramitación ordinaria en cualquier momento anterior a la resolución.",
    law_short_name: "Ley 39/2015",
    article_number: "96"
  },
  {
    question_text: "De conformidad con la Ley 39/2015, en el caso de procedimientos de naturaleza sancionadora, se podrá adoptar la tramitación simplificada del procedimiento cuando el órgano competente para iniciar el procedimiento considere que, de acuerdo con lo previsto en su normativa reguladora, existen:",
    option_a: "Elementos de juicio suficientes para calificar la infracción como grave.",
    option_b: "Elementos de juicio suficientes para calificar la infracción como grave o muy grave.",
    option_c: "Elementos de juicio suficientes para calificar la infracción como muy grave.",
    option_d: "Elementos de juicio suficientes para calificar la infracción como leve.",
    correct_option: "D",
    explanation: "Según el artículo 96, en procedimientos sancionadores se puede adoptar tramitación simplificada cuando hay elementos para calificar la infracción como leve.",
    law_short_name: "Ley 39/2015",
    article_number: "96"
  },
  {
    question_text: "De conformidad con la Ley 39/2015, ¿cuál de los siguientes trámites formará parte de la tramitación simplificada del procedimiento administrativo?",
    option_a: "Trámite de actuaciones previas.",
    option_b: "Trámite de información pública, únicamente cuando la resolución vaya a ser desfavorable para el interesado.",
    option_c: "Periodo de prueba.",
    option_d: "Trámite de audiencia, únicamente cuando la resolución vaya a ser desfavorable para el interesado.",
    correct_option: "D",
    explanation: "En la tramitación simplificada, el trámite de audiencia se realizará únicamente cuando la resolución vaya a ser desfavorable para el interesado.",
    law_short_name: "Ley 39/2015",
    article_number: "96"
  },
  {
    question_text: "De acuerdo con la Ley 39/2015, si el órgano competente para la tramitación del procedimiento administrativo desestima la solicitud del interesado de llevar a cabo el procedimiento de forma simplificada:",
    option_a: "No existe posibilidad de recurso por parte del interesado.",
    option_b: "Existe la posibilidad de interponer recurso de alzada.",
    option_c: "Existe la posibilidad de interponer recurso de reposición.",
    option_d: "Existe la posibilidad de interponer recurso de queja ante el superior jerárquico.",
    correct_option: "A",
    explanation: "Según la Ley 39/2015, cuando se desestima la solicitud de tramitación simplificada, no existe posibilidad de recurso por parte del interesado.",
    law_short_name: "Ley 39/2015",
    article_number: "96"
  },
  {
    question_text: "De conformidad con la Ley 39/2015, salvo que reste menos para su tramitación ordinaria, los procedimientos administrativos tramitados de manera simplificada deberán ser resueltos en:",
    option_a: "20 días.",
    option_b: "30 días.",
    option_c: "15 días.",
    option_d: "2 meses.",
    correct_option: "B",
    explanation: "Los procedimientos tramitados de forma simplificada deben resolverse en 30 días, salvo que reste menos para su tramitación ordinaria.",
    law_short_name: "Ley 39/2015",
    article_number: "96"
  },
  {
    question_text: "De acuerdo con la Ley 39/2015, ¿qué ocurre cuando la Administración de oficio acuerde la tramitación simplificada del procedimiento y alguno de los interesados manifestara su oposición expresa?",
    option_a: "La Administración deberá seguir la tramitación ordinaria, cuando se manifieste la oposición expresa de, al menos, dos tercios de los interesados en el procedimiento.",
    option_b: "La Administración deberá seguir la tramitación ordinaria.",
    option_c: "La Administración seguirá con la tramitación simplificada del procedimiento.",
    option_d: "La Administración podrá seguir con la tramitación simplificada del procedimiento, siempre que no haya oposición expresa de la mayoría de interesados.",
    correct_option: "B",
    explanation: "Cuando algún interesado manifieste oposición expresa a la tramitación simplificada, la Administración deberá seguir la tramitación ordinaria.",
    law_short_name: "Ley 39/2015",
    article_number: "96"
  },
  {
    question_text: "Conforme a la Ley 39/2015, ¿cuál de los siguientes informes se podrá llevar a cabo en la tramitación simplificada del procedimiento administrativo?",
    option_a: "Informe del Tribunal de Cuentas, cuando éste sea preceptivo.",
    option_b: "Informe del Consejo de Estado u órgano consultivo equivalente de la Comunidad Autónoma en los casos en que sea preceptivo.",
    option_c: "Informe del servicio jurídico, cuando éste sea preceptivo.",
    option_d: "Informe del órgano superior jerárquico al que tramita el procedimiento.",
    correct_option: "C",
    explanation: "En la tramitación simplificada se puede llevar a cabo el informe del servicio jurídico cuando éste sea preceptivo.",
    law_short_name: "Ley 39/2015",
    article_number: "96"
  },
  {
    question_text: "De acuerdo con la Ley 39/2015, si el órgano competente para la tramitación aprecia que no concurren razones de interés público o la falta de complejidad del procedimiento:",
    option_a: "Podrá desestimar la solicitud de los interesados para tramitar el procedimiento de forma simplificada, en el plazo de quince días desde su presentación.",
    option_b: "Podrá desestimar la solicitud de los interesados para tramitar el procedimiento de forma simplificada, en el plazo de cinco días desde su presentación.",
    option_c: "Podrá desestimar la solicitud de los interesados para tramitar el procedimiento de forma simplificada, en el plazo de diez días desde su presentación.",
    option_d: "Podrá desestimar la solicitud de los interesados para tramitar el procedimiento de forma simplificada, en el plazo de tres días desde su presentación.",
    correct_option: "B",
    explanation: "El órgano competente puede desestimar la solicitud de tramitación simplificada en el plazo de cinco días desde su presentación.",
    law_short_name: "Ley 39/2015",
    article_number: "96"
  },
  {
    question_text: "Conforme a la Ley 39/2015, en la tramitación simplificada del procedimiento administrativo, el Dictamen del Consejo de Estado u órgano consultivo equivalente de la Comunidad Autónoma en los casos en que sea preceptivo, podrá ser emitido en el plazo de:",
    option_a: "20 días si así lo solicita el órgano competente.",
    option_b: "15 días si así lo solicita el órgano competente.",
    option_c: "5 días si así lo solicita el órgano competente.",
    option_d: "10 días si así lo solicita el órgano competente.",
    correct_option: "B",
    explanation: "En tramitación simplificada, el dictamen puede ser emitido en el plazo de 15 días si así lo solicita el órgano competente.",
    law_short_name: "Ley 39/2015",
    article_number: "96"
  },
  {
    question_text: "De conformidad con la Ley 39/2015, ¿cuál de los siguientes trámites se llevará a cabo en cualquier caso en los procedimientos de manera simplificada?",
    option_a: "El dictamen del Consejo de Estado u órgano consultivo equivalente de la Comunidad Autónoma.",
    option_b: "El informe del Consejo General del Poder Judicial.",
    option_c: "Las alegaciones.",
    option_d: "El trámite de audiencia.",
    correct_option: "C",
    explanation: "Las alegaciones se llevan a cabo en cualquier caso en los procedimientos de tramitación simplificada.",
    law_short_name: "Ley 39/2015",
    article_number: "96"
  },
  {
    question_text: "Según la Ley 39/2015, cuando razones de interés público o la falta de complejidad del procedimiento así lo aconsejen:",
    option_a: "Las Administraciones Públicas podrán acordar la tramitación simplificada del procedimiento.",
    option_b: "Las Administraciones Públicas podrán acordar la tramitación de emergencia del procedimiento.",
    option_c: "Las Administraciones Públicas deberán acordar la tramitación ordinaria del procedimiento.",
    option_d: "Las Administraciones Públicas deberán acordar la tramitación simplificada del procedimiento.",
    correct_option: "A",
    explanation: "Cuando concurran razones de interés público o falta de complejidad, las Administraciones Públicas podrán acordar la tramitación simplificada.",
    law_short_name: "Ley 39/2015",
    article_number: "96"
  },
  {
    question_text: "De conformidad con la Ley 39/2015, ¿cuál de los siguientes trámites no formará parte de la tramitación simplificada del procedimiento administrativo?",
    option_a: "Informe del Consejo General del Poder Judicial, cuando éste sea preceptivo.",
    option_b: "Subsanación de la solicitud presentada, en su caso.",
    option_c: "Trámite de información pública, en su caso.",
    option_d: "Informe del servicio jurídico, cuando éste sea preceptivo.",
    correct_option: "C",
    explanation: "El trámite de información pública no forma parte de la tramitación simplificada del procedimiento administrativo.",
    law_short_name: "Ley 39/2015",
    article_number: "96"
  },
  {
    question_text: "Según la Ley 39/2015, ¿en qué casos las Administraciones Públicas podrán acordar la tramitación simplificada del procedimiento?",
    option_a: "Cuando la complejidad del procedimiento así lo aconseje.",
    option_b: "Cuando así lo aprecie el órgano competente para la tramitación del procedimiento y se reciba informe favorable del Consejo de Estado u órgano consultivo equivalente de las Comunidades Autónomas.",
    option_c: "Cuando razones de interés público o la falta de complejidad del procedimiento así lo aconsejen.",
    option_d: "Cuando así lo aconseje un dictamen del Consejo de Estado u órgano consultivo equivalente de las Comunidades Autónomas.",
    correct_option: "C",
    explanation: "Las Administraciones Públicas pueden acordar tramitación simplificada cuando razones de interés público o falta de complejidad lo aconsejen.",
    law_short_name: "Ley 39/2015",
    article_number: "96"
  },
  {
    question_text: "Cuando en los procedimientos de naturaleza sancionadora se adopte la tramitación simplificada del procedimiento por el órgano competente al considerar que existen elementos de juicio suficientes para calificar la infracción como leve, el artículo 96.5 de la Ley 39/2015, de 1 de octubre, del Procedimiento Administrativo Común de las Administraciones Públicas señala que:",
    option_a: "Los interesados podrán interponer recurso contencioso-administrativo.",
    option_b: "No cabrá la oposición expresa del interesado.",
    option_c: "Los interesados podrán manifestar su oposición expresa y la Administración deberá seguir la tramitación ordinaria.",
    option_d: "No cabrá la oposición expresa del interesado, salvo que éste reconozca voluntariamente su responsabilidad, en cuyo caso la Administración deberá seguir la tramitación ordinaria.",
    correct_option: "B",
    explanation: "Según el artículo 96.5, en procedimientos sancionadores con tramitación simplificada por infracciones leves, no cabrá la oposición expresa del interesado.",
    law_short_name: "Ley 39/2015",
    article_number: "96"
  },
  {
    question_text: "De conformidad con la Ley 39/2015, en la tramitación simplificada, ¿cuándo se llevará a cabo el trámite de audiencia?",
    option_a: "Únicamente cuando la resolución vaya a ser desfavorable para el interesado.",
    option_b: "En cualquier caso.",
    option_c: "Cuando así lo acuerde el órgano superior jerárquico al competente para resolver el procedimiento.",
    option_d: "Cuando la resolución vaya a ser favorable para el interesado.",
    correct_option: "A",
    explanation: "En tramitación simplificada, el trámite de audiencia se realizará únicamente cuando la resolución vaya a ser desfavorable para el interesado.",
    law_short_name: "Ley 39/2015",
    article_number: "96"
  },
  {
    question_text: "De acuerdo con la Ley 39/2015, ¿qué ocurre si los interesados de un procedimiento solicitan la tramitación simplificada y no obtienen una respuesta por parte de la Administración a tal solicitud en el plazo correspondiente?",
    option_a: "Se entiende estimada, siempre que se emita dictamen favorable por parte del Consejo de Estado u órgano consultivo equivalente de las Comunidades Autónomas.",
    option_b: "Se entiende estimada tal solicitud.",
    option_c: "Se entiende desestimada tal solicitud.",
    option_d: "Se entiende desestimada tal solicitud, salvo que por razones de interés público el órgano superior jerárquico al encargado de la tramitación acuerde lo contrario.",
    correct_option: "C",
    explanation: "Si no se obtiene respuesta en el plazo correspondiente, se entiende desestimada la solicitud de tramitación simplificada.",
    law_short_name: "Ley 39/2015",
    article_number: "96"
  },
  {
    question_text: "De conformidad con la Ley 39/2015, en la tramitación simplificada, las alegaciones serán formuladas al inicio del procedimiento durante el plazo de:",
    option_a: "3 días.",
    option_b: "10 días.",
    option_c: "15 días.",
    option_d: "5 días.",
    correct_option: "D",
    explanation: "En tramitación simplificada, las alegaciones se formulan al inicio del procedimiento durante un plazo de 5 días.",
    law_short_name: "Ley 39/2015",
    article_number: "96"
  },
  {
    question_text: "De conformidad con lo establecido en Ley 39/2015, de 1 de octubre, del Procedimiento Administrativo Común de las Administraciones Públicas, en el caso de que un procedimiento exigiera la realización de un trámite distinto de los previstos en el artículo 96.6 para la tramitación simplificada:",
    option_a: "Se suspenderá el transcurso del plazo máximo legal para resolver el procedimiento y notificar la resolución hasta que se haya realizado dicho trámite.",
    option_b: "El órgano competente deberá resolver igualmente el procedimiento dentro del plazo de 30 días, prescindiendo, en su caso, de la realización de dicho trámite.",
    option_c: "El órgano competente acordará de manera motivada la ampliación del plazo máximo de resolución y notificación a fin de que pueda realizarse dicho trámite.",
    option_d: "El procedimiento deberá ser tramitado de manera ordinaria.",
    correct_option: "D",
    explanation: "Cuando se requiere un trámite no previsto en el artículo 96.6, el procedimiento deberá ser tramitado de manera ordinaria.",
    law_short_name: "Ley 39/2015",
    article_number: "96"
  },
  {
    question_text: "De acuerdo con el artículo 96 de la Ley 39/2015, cuando la Administración acuerde de oficio la tramitación simplificada del procedimiento:",
    option_a: "Deberá dar un plazo de alegaciones de 3 días a los interesados, con el fin de que puedan manifestar su posible oposición.",
    option_b: "Deberá publicar el acuerdo de tramitación simplificada.",
    option_c: "Deberá dar un plazo de alegaciones de 20 días a los interesados, con el fin de que puedan manifestar su posible oposición.",
    option_d: "Deberá notificarlo a los interesados.",
    correct_option: "D",
    explanation: "Cuando la Administración acuerde de oficio la tramitación simplificada, deberá notificarlo a los interesados.",
    law_short_name: "Ley 39/2015",
    article_number: "96"
  },
  {
    question_text: "Según la Ley 39/2015, ¿cómo se podrá acordar la tramitación simplificada del procedimiento administrativo?",
    option_a: "Se deberá acordar de oficio.",
    option_b: "Se deberá acordar a solicitud de interesado, salvo que el superior jerárquico al órgano competente decida iniciar el procedimiento de oficio al concurrir una situación de urgencia.",
    option_c: "Se deberá acordar a solicitud de interesado.",
    option_d: "Se podrá acordar de oficio o a solicitud del interesado.",
    correct_option: "D",
    explanation: "La tramitación simplificada se puede acordar de oficio o a solicitud del interesado, según el artículo 96.",
    law_short_name: "Ley 39/2015",
    article_number: "96"
  },

  // ARTÍCULO 98 - EJECUTORIEDAD
  {
    question_text: "Según el artículo 98 de la Ley 39/2015, los actos de las Administraciones Públicas sujetos al Derecho Administrativo serán inmediatamente ejecutivos, salvo que:",
    option_a: "Se produzca la prescripción de un procedimiento administrativo.",
    option_b: "Se produzca la suspensión de la ejecución del acto.",
    option_c: "Se necesite aprobación o autorización inferior en grado.",
    option_d: "Se trate de una resolución de un procedimiento de responsabilidad patrimonial.",
    correct_option: "B",
    explanation: "Según el artículo 98, los actos serán inmediatamente ejecutivos salvo que se produzca la suspensión de la ejecución del acto, entre otras excepciones.",
    law_short_name: "Ley 39/2015",
    article_number: "98"
  },
  {
    question_text: "De conformidad con la Ley 39/2015, los actos de las Administraciones Públicas sujetos al Derecho Administrativo serán inmediatamente ejecutivos, salvo que:",
    option_a: "Se trate de una resolución de un procedimiento de naturaleza sancionadora contra la que no quepa recurso alguno en vía administrativa, incluido el contencioso-administrativo.",
    option_b: "Una disposición establezca lo contrario.",
    option_c: "No se produzca la suspensión de la ejecución del acto.",
    option_d: "No se necesite aprobación o autorización superior.",
    correct_option: "B",
    explanation: "Los actos serán inmediatamente ejecutivos salvo cuando una disposición establezca lo contrario, entre otras excepciones del artículo 98.",
    law_short_name: "Ley 39/2015",
    article_number: "98"
  },
  {
    question_text: "Cuando de una resolución administrativa nace una obligación de pago derivada de una sanción pecuniaria que haya de abonarse a la Hacienda pública, señale cuál de los siguientes medios electrónicos no está contemplado expresamente en la Ley 39/2015, de 1 de octubre, del Procedimiento Administrativo Común de las Administraciones Públicas, como de utilización preferente:",
    option_a: "Transferencia bancaria.",
    option_b: "Cheque bancario.",
    option_c: "Domiciliación bancaria.",
    option_d: "Tarjeta de crédito y débito.",
    correct_option: "B",
    explanation: "El cheque bancario no está contemplado en el artículo 98.2 como medio electrónico de utilización preferente. Los medios contemplados son tarjeta, transferencia, domiciliación bancaria y otros autorizados.",
    law_short_name: "Ley 39/2015",
    article_number: "98"
  },

  // ARTÍCULO 101 - APREMIO SOBRE EL PATRIMONIO
  {
    question_text: "De acuerdo con la Ley 39/2015, ¿en qué casos se seguirá el procedimiento previsto en las normas reguladoras del procedimiento de apremio?",
    option_a: "Cuando se trate de actos personalísimos en que no proceda la compulsión directa sobre la persona del obligado.",
    option_b: "Cuando en virtud de acto administrativo hubiera de satisfacerse cantidad líquida.",
    option_c: "Cuando se trate de actos que impongan una obligación personalísima de no hacer o soportar.",
    option_d: "Cuando se trate de actos que por no ser personalísimos pueden ser realizados por sujeto distinto del obligado.",
    correct_option: "B",
    explanation: "Según el artículo 101, se seguirá el procedimiento de apremio cuando en virtud de acto administrativo hubiera de satisfacerse cantidad líquida.",
    law_short_name: "Ley 39/2015",
    article_number: "101"
  },

  // ARTÍCULO 102 - EJECUCIÓN SUBSIDIARIA
  {
    question_text: "De acuerdo con la Ley 39/2015, ¿qué medio de ejecución forzosa cabe cuando se trate de actos que por no ser personalísimos puedan ser realizados por sujeto distinto del obligado?",
    option_a: "Ejecución subsidiaria.",
    option_b: "Apremio sobre el patrimonio.",
    option_c: "Compulsión sobre las personas.",
    option_d: "Ninguna es correcta.",
    correct_option: "A",
    explanation: "La ejecución subsidiaria es el medio de ejecución forzosa para actos no personalísimos que pueden ser realizados por sujeto distinto del obligado.",
    law_short_name: "Ley 39/2015",
    article_number: "102"
  },
  {
    question_text: "De acuerdo con la Ley 39/2015, habrá lugar a la ejecución subsidiaria:",
    option_a: "Cuando se trate de actos que por no ser personalísimos deban ser realizados por el obligado.",
    option_b: "Cuando se trate de actos que por no ser personalísimos puedan ser realizados por sujeto distinto del obligado.",
    option_c: "Cuando se trate de actos que por ser personalísimos puedan ser realizados por sujeto distinto del obligado.",
    option_d: "Cuando se trate de actos que por ser personalísimos no puedan ser realizados por sujeto distinto del obligado.",
    correct_option: "B",
    explanation: "La ejecución subsidiaria procede cuando se trata de actos no personalísimos que pueden ser realizados por sujeto distinto del obligado.",
    law_short_name: "Ley 39/2015",
    article_number: "102"
  },

  // ARTÍCULO 104 - COMPULSIÓN SOBRE LAS PERSONAS
  {
    question_text: "Conforme a la Ley 39/2015, los actos administrativos que impongan una obligación personalísima de no hacer o soportar podrán ser ejecutados:",
    option_a: "Por compulsión directa sobre las personas en los casos en que la ley expresamente lo autorice, y dentro siempre del respeto debido a su dignidad y a los derechos reconocidos en la Constitución.",
    option_b: "Mediante multa coercitiva en los casos en que la ley expresamente lo autorice, y dentro siempre del respeto debido a su dignidad y a los derechos reconocidos en la Constitución.",
    option_c: "Mediante ejecución subsidiaria en los casos en que la ley expresamente lo autorice, y dentro siempre del respeto debido a su dignidad y a los derechos reconocidos en la Constitución.",
    option_d: "Por el procedimiento de apremio sobre el patrimonio en los casos en que la ley expresamente lo autorice, y dentro siempre del respeto debido a su dignidad y a los derechos reconocidos en la Constitución.",
    correct_option: "A",
    explanation: "Los actos que impongan obligaciones personalísimas pueden ejecutarse por compulsión directa sobre las personas cuando la ley lo autorice.",
    law_short_name: "Ley 39/2015",
    article_number: "104"
  },
  {
    question_text: "Conforme a lo dispuesto en el artículo 104 de la Ley 39/2015, si, tratándose de obligaciones personalísimas de hacer, no se realizase la prestación, el obligado deberá resarcir los daños y perjuicios, a cuya liquidación y cobro se procederá en:",
    option_a: "Vía contencioso-administrativa.",
    option_b: "Vía penal.",
    option_c: "Vía administrativa.",
    option_d: "Vía civil.",
    correct_option: "C",
    explanation: "La liquidación y cobro de daños y perjuicios por incumplimiento de obligaciones personalísimas se procederá por vía administrativa.",
    law_short_name: "Ley 39/2015",
    article_number: "104"
  },
  {
    question_text: "Conforme a la Ley 39/2015, podrán ser ejecutados por compulsión directa sobre las personas en los casos, los actos que:",
    option_a: "Impongan una obligación no personalísima de no hacer o soportar.",
    option_b: "Impongan una obligación no personalísima de hacer o soportar.",
    option_c: "Impongan una obligación personalísima de no hacer o soportar.",
    option_d: "Impongan una obligación personalísima de hacer o soportar.",
    correct_option: "C",
    explanation: "La compulsión directa sobre las personas se aplica a actos que impongan obligaciones personalísimas de no hacer o soportar.",
    law_short_name: "Ley 39/2015",
    article_number: "104"
  }
];

async function addEjecucionQuestions() {
  console.log('🔧 AÑADIENDO PREGUNTAS DE EJECUCIÓN DEL PROCEDIMIENTO ADMINISTRATIVO\n')
  
  try {
    let addedCount = 0
    let duplicateCount = 0
    let errorCount = 0
    
    for (const [index, questionData] of questionsBatch.entries()) {
      console.log(`📝 Procesando pregunta ${index + 1}/${questionsBatch.length}...`)
      
      // 1. Verificar si la pregunta ya existe
      const { data: existingQuestion } = await supabase
        .from('questions')
        .select('id')
        .ilike('question_text', questionData.question_text.substring(0, 50) + '%')
        .single()
      
      if (existingQuestion) {
        console.log(`   ⚠️ Pregunta duplicada, saltando...`)
        duplicateCount++
        continue
      }
      
      // 2. Obtener la ley
      const { data: law } = await supabase
        .from('laws')
        .select('id')
        .eq('short_name', questionData.law_short_name)
        .single()
      
      if (!law) {
        console.log(`   ❌ Ley ${questionData.law_short_name} no encontrada`)
        errorCount++
        continue
      }
      
      // 3. Obtener el artículo
      const { data: article } = await supabase
        .from('articles')
        .select('id')
        .eq('law_id', law.id)
        .eq('article_number', questionData.article_number)
        .single()
      
      if (!article) {
        console.log(`   ❌ Artículo ${questionData.article_number} de ${questionData.law_short_name} no encontrado`)
        errorCount++
        continue
      }
      
      // 4. Insertar la pregunta
      const { data: newQuestion, error: questionError } = await supabase
        .from('questions')
        .insert({
          question_text: questionData.question_text,
          option_a: questionData.option_a,
          option_b: questionData.option_b,
          option_c: questionData.option_c,
          option_d: questionData.option_d,
          correct_option: letterToNumber(questionData.correct_option),
          explanation: questionData.explanation,
          primary_article_id: article.id,
          is_active: true,
          difficulty: 'medium',
          is_official_exam: false,
          exam_source: 'ejecucion_batch1',
          created_at: new Date().toISOString()
        })
        .select('id')
        .single()
      
      if (questionError) {
        console.log(`   ❌ Error insertando pregunta: ${questionError.message}`)
        errorCount++
        continue
      }
      
      console.log(`   ✅ Pregunta añadida: ${newQuestion.id}`)
      addedCount++
    }
    
    console.log('\n📊 RESUMEN EJECUCIÓN BATCH 1:')
    console.log(`✅ Preguntas añadidas: ${addedCount}`)
    console.log(`⚠️ Duplicadas ignoradas: ${duplicateCount}`)
    console.log(`❌ Errores: ${errorCount}`)
    console.log(`📝 Total procesadas: ${questionsBatch.length}`)
    
    if (addedCount > 0) {
      console.log('\n🎯 Preguntas añadidas exitosamente a el-procedimiento-administrativo!')
      console.log('🔗 Disponibles en: /test-personalizado?seccion=el-procedimiento-administrativo')
    }
    
  } catch (error) {
    console.error('❌ Error general:', error.message)
  }
}

// Ejecutar el script
addEjecucionQuestions()