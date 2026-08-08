// T-115 — mini-lote de CIERRE de la Ley 9/2017: dos reglas que el lote anterior dejó al aire.
//
//  · art. 138.3, regla de los 4 DÍAS en expedientes urgentes. Quedó descubierta al acotar el
//    enunciado de la pregunta de los 6 días para reparar una cita truncada: la acotación arregla
//    la clave, pero deja la excepción sin enseñar a nadie.
//  · art. 140.3, párrafo 2.º: la exención de aportar documentos justificativos cuando el
//    empresario está inscrito en el ROLECE. Lo señaló la auditoría ciega como extremo no
//    cubierto — no es defecto de la pregunta anterior, es materia que faltaba.
//
// Contenedor ya verificado contra el BOE vigente en el lote matriz (BOE-A-2017-12902).

const LEY = 'la Ley 9/2017, de 8 de noviembre, de Contratos del Sector Público'

export const PREGUNTAS = [
  {
    art: '138',
    correct: 1,
    question_text: `Según el artículo 138.3 de ${LEY}, en los expedientes que hayan sido calificados de urgentes el plazo de seis días para proporcionar la información adicional sobre los pliegos:`,
    opciones: [
      'Será de 4 días a más tardar antes de que finalice el citado plazo en todos los contratos, cualquiera que sea su objeto y el procedimiento de adjudicación.',
      'Será de 4 días a más tardar antes de que finalice el citado plazo en los contratos de obras, suministros y servicios sujetos a regulación armonizada siempre que se adjudiquen por procedimientos abierto y restringido.',
      'Será de 2 días a más tardar antes de que finalice el citado plazo en los contratos de obras, suministros y servicios sujetos a regulación armonizada siempre que se adjudiquen por procedimientos abierto y restringido.',
      'Será de 4 días a más tardar antes de que finalice el citado plazo en los contratos de obras, suministros y servicios sujetos a regulación armonizada siempre que se adjudiquen por procedimientos negociado y de diálogo competitivo.',
    ],
    cita: {
      ref: 'Art. 138.3 de la Ley 9/2017',
      texto:
        'En los expedientes que hayan sido calificados de urgentes, el plazo de seis días a más tardar antes de que finalice el plazo fijado para la presentación de ofertas será de 4 días a más tardar antes de que finalice el citado plazo en los contratos de obras, suministros y servicios sujetos a regulación armonizada siempre que se adjudiquen por procedimientos abierto y restringido.',
    },
    razones: [
      'La reducción no alcanza a todos los contratos: el precepto la acota a los de obras, suministros y servicios sujetos a regulación armonizada adjudicados por procedimiento abierto y restringido.',
      'Reproduce el precepto: en los expedientes urgentes el plazo pasa a 4 días, y solo para los contratos de obras, suministros y servicios sujetos a regulación armonizada adjudicados por procedimiento abierto y restringido.',
      'El plazo reducido que fija el artículo es de 4 días, no de 2.',
      'Los procedimientos a los que el precepto acota la reducción son el abierto y el restringido, no el negociado ni el diálogo competitivo.',
    ],
  },
  {
    art: '140',
    correct: 2,
    question_text: `Conforme al artículo 140.3 de ${LEY}, cuando el empresario esté inscrito en el Registro Oficial de Licitadores y Empresas Clasificadas del Sector Público, o figure en una base de datos nacional de un Estado miembro de la Unión Europea, y estos sean accesibles de modo gratuito para los órganos de contratación:`,
    opciones: [
      'Quedará exento de presentar la declaración responsable que debe acompañar a su proposición.',
      'No estará obligado a presentar documentos justificativos, salvo que el órgano de contratación aprecie dudas razonables sobre la vigencia de la inscripción.',
      'No estará obligado a presentar los documentos justificativos u otra prueba documental de los datos inscritos en los referidos lugares.',
      'No estará obligado a presentar los documentos justificativos, siempre que la inscripción se hubiera practicado en los seis meses anteriores a la licitación.',
    ],
    cita: {
      ref: 'Art. 140.3 de la Ley 9/2017',
      texto:
        'No obstante lo anterior, cuando el empresario esté inscrito en el Registro Oficial de Licitadores y Empresas Clasificadas del Sector Público o figure en una base de datos nacional de un Estado miembro de la Unión Europea, como un expediente virtual de la empresa, un sistema de almacenamiento electrónico de documentos o un sistema de precalificación, y estos sean accesibles de modo gratuito para los citados órganos, no estará obligado a presentar los documentos justificativos u otra prueba documental de los datos inscritos en los referidos lugares.',
    },
    razones: [
      'La exención alcanza a los documentos justificativos de los datos inscritos, no a la declaración responsable que la letra a) del apartado 1 exige acompañar a la proposición.',
      'El precepto no reserva esa salvedad: la exención opera por el hecho de la inscripción accesible de modo gratuito.',
      'Reproduce el precepto: no está obligado a presentar los documentos justificativos u otra prueba documental de los datos inscritos en los referidos lugares.',
      'El artículo no fija plazo alguno de antigüedad de la inscripción; lo que exige es que los registros sean accesibles de modo gratuito para los órganos de contratación.',
    ],
  },
]
