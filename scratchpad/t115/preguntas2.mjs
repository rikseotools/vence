// T-115 — lote Ley 9/2017 (LCSP) arts. 137, 138, 140, 142, 146 y 148.
// Los seis sirven CERO preguntas y alcanzan 17 temas de 17 oposiciones (2.428 usuarios).
// Se EVITAN a propósito los arts. 134, 143, 147 y 151: tienen scrapeadas en `draft` con la
// explicación corrupta (mojibake del import), y generar encima crearía duplicados semánticos
// el día que alguien las repare.
// Contenedor verificado contra el BOE vigente (BOE-A-2017-12902): 6/6 idénticos.

const LEY = 'la Ley 9/2017, de 8 de noviembre, de Contratos del Sector Público'

export const PREGUNTAS = [
  // ── Art. 137 ──────────────────────────────────────────────────────────────
  {
    art: '137',
    correct: 0,
    question_text: `Según el artículo 137 de ${LEY}, cuando el expediente de contratación haya sido declarado de tramitación urgente, los plazos establecidos en esa Sección:`,
    opciones: [
      'Se reducirán en la forma prevista en la letra b) del apartado 2 del artículo 119 y en las demás disposiciones de esta Ley.',
      'Se reducirán en la forma prevista en la letra a) del apartado 1 del artículo 119 y en las demás disposiciones de esta Ley.',
      'Se reducirán a la mitad, salvo en los contratos sujetos a regulación armonizada previstos en esta Ley.',
      'Se mantendrán inalterados, sin perjuicio de la reducción que acuerde el órgano de contratación.',
    ],
    cita: {
      ref: 'Art. 137 de la Ley 9/2017',
      texto:
        'En caso de que el expediente de contratación haya sido declarado de tramitación urgente, los plazos establecidos en esta Sección se reducirán en la forma prevista en la letra b) del apartado 2 del artículo 119 y en las demás disposiciones de esta Ley.',
    },
    razones: [
      'Reproduce la remisión del precepto: la reducción se hace en la forma prevista en la letra b) del apartado 2 del artículo 119.',
      'Cambia la remisión: el precepto envía a la letra b) del apartado 2, no a la letra a) del apartado 1.',
      'El artículo no fija una reducción a la mitad ni excluye los contratos sujetos a regulación armonizada: remite a lo previsto en el artículo 119.',
      'La declaración de urgencia sí produce la reducción de los plazos, y no la deja al acuerdo del órgano de contratación.',
    ],
  },
  // ── Art. 138 ──────────────────────────────────────────────────────────────
  {
    art: '138',
    correct: 2,
    question_text: `Conforme al artículo 138.1 de ${LEY}, el acceso a los pliegos y demás documentación complementaria que los órganos de contratación deben ofrecer por medios electrónicos a través del perfil de contratante será:`,
    opciones: [
      'Libre, directo, completo y gratuito, y deberá poder efectuarse desde la fecha de aprobación del pliego de cláusulas administrativas particulares.',
      'Libre, directo, completo y sujeto a tasa, y deberá poder efectuarse desde la fecha de la publicación del anuncio de licitación o, en su caso, del envío de la invitación a los candidatos seleccionados.',
      'Libre, directo, completo y gratuito, y deberá poder efectuarse desde la fecha de la publicación del anuncio de licitación o, en su caso, del envío de la invitación a los candidatos seleccionados.',
      'Libre y directo previa solicitud motivada, y deberá poder efectuarse desde la fecha de la publicación del anuncio de licitación o del envío de la invitación a los candidatos seleccionados.',
    ],
    cita: {
      ref: 'Art. 138.1 de la Ley 9/2017',
      texto:
        'Los órganos de contratación ofrecerán acceso a los pliegos y demás documentación complementaria por medios electrónicos a través del perfil de contratante, acceso que será libre, directo, completo y gratuito, y que deberá poder efectuarse desde la fecha de la publicación del anuncio de licitación o, en su caso, del envío de la invitación a los candidatos seleccionados.',
    },
    razones: [
      'El momento desde el que debe poder efectuarse el acceso es la publicación del anuncio de licitación o el envío de la invitación, no la aprobación del pliego.',
      'El precepto exige que el acceso sea gratuito; someterlo a tasa contradice uno de sus cuatro caracteres.',
      'Reproduce el precepto: acceso libre, directo, completo y gratuito, disponible desde la publicación del anuncio o el envío de la invitación.',
      'El acceso ha de ser directo y completo, sin condicionarlo a una solicitud motivada previa.',
    ],
  },
  {
    art: '138',
    correct: 1,
    question_text: `Según el artículo 138.2 de ${LEY}, cuando excepcionalmente se dé acceso a los pliegos y demás documentación complementaria valiéndose de medios no electrónicos, el plazo de presentación de las proposiciones o de las solicitudes de participación:`,
    opciones: [
      'Se prolongará quince días, salvo en el supuesto de tramitación urgente del expediente a que se refiere el artículo 119.',
      'Se prolongará cinco días, salvo en el supuesto de tramitación urgente del expediente a que se refiere el artículo 119.',
      'Se prolongará cinco días, incluso en el supuesto de tramitación urgente del expediente a que se refiere el artículo 119.',
      'Se prolongará cinco días, salvo en los contratos de concesión de obras y de servicios a que se refiere el artículo 133.',
    ],
    cita: {
      ref: 'Art. 138.2 de la Ley 9/2017',
      texto:
        'En ese caso el anuncio de licitación o la invitación a los candidatos seleccionados advertirán de esta circunstancia; y el plazo de presentación de las proposiciones o de las solicitudes de participación se prolongará cinco días, salvo en el supuesto de tramitación urgente del expediente a que se refiere el artículo 119.',
    },
    razones: [
      'La prórroga que fija el precepto es de cinco días, no de quince.',
      'Reproduce el precepto: cinco días de prórroga, con la excepción de la tramitación urgente del artículo 119.',
      'Invierte la excepción: la prórroga NO se aplica en el supuesto de tramitación urgente, precisamente el caso que el artículo exceptúa.',
      'La excepción del precepto es la tramitación urgente del artículo 119; el artículo 133 regula la confidencialidad, que aquí es uno de los motivos del acceso no electrónico.',
    ],
  },
  {
    art: '138',
    correct: 3,
    question_text: `Entre los supuestos que, según el artículo 138.2 de ${LEY}, justifican el acceso NO electrónico a los pliegos y demás documentación complementaria de la licitación, figura el siguiente:`,
    opciones: [
      'Por razones de confidencialidad, en aplicación de lo dispuesto en el artículo 119.',
      'Por razones de interés público, en aplicación de lo dispuesto en el artículo 133.',
      'Por motivos de urgencia del expediente, en los términos de la Disposición adicional decimoquinta.',
      'Por razones de confidencialidad, en aplicación de lo dispuesto en el artículo 133.',
    ],
    cita: {
      ref: 'Art. 138.2 de la Ley 9/2017',
      texto:
        'a) Cuando se den circunstancias técnicas que lo impidan, en los términos señalados en la Disposición adicional decimoquinta. b) Por razones de confidencialidad, en aplicación de lo dispuesto en el artículo 133. c) En el caso de las concesiones de obras y de servicios, por motivos de seguridad excepcionales.',
    },
    razones: [
      'La remisión del precepto para la confidencialidad es al artículo 133; el 119 regula la tramitación urgente del expediente, que en este artículo aparece como excepción a la prórroga del plazo.',
      'El supuesto que enumera el precepto son las razones de confidencialidad, no un genérico interés público.',
      'La urgencia del expediente no figura entre las tres causas del acceso no electrónico, y lo que la Disposición adicional decimoquinta ampara son las circunstancias técnicas que lo impidan.',
      'Reproduce la letra b) del precepto: razones de confidencialidad, en aplicación de lo dispuesto en el artículo 133. Las otras dos causas son las circunstancias técnicas que lo impidan y, en las concesiones de obras y de servicios, los motivos de seguridad excepcionales.',
    ],
  },
  {
    art: '138',
    correct: 0,
    question_text: `Según el artículo 138.3 de ${LEY}, en un expediente que NO haya sido calificado de urgente, a condición de que la información se hubiere pedido al menos 12 días antes del transcurso del plazo de presentación y salvo que en los pliegos que rigen la licitación se estableciera otro plazo distinto, los órganos de contratación proporcionarán a los interesados la información adicional sobre los pliegos que soliciten:`,
    opciones: [
      'A más tardar 6 días antes de que finalice el plazo fijado para la presentación de ofertas.',
      'A más tardar 12 días antes de que finalice el plazo fijado para la presentación de ofertas.',
      'A más tardar 6 días antes de que finalice el plazo fijado para la formalización del contrato.',
      'A más tardar 15 días antes de que finalice el plazo fijado para la presentación de ofertas.',
    ],
    cita: {
      ref: 'Art. 138.3 de la Ley 9/2017',
      texto:
        'Los órganos de contratación proporcionarán a todos los interesados en el procedimiento de licitación, a más tardar 6 días antes de que finalice el plazo fijado para la presentación de ofertas, aquella información adicional sobre los pliegos y demás documentación complementaria que estos soliciten, a condición de que la hubieren pedido al menos 12 días antes del transcurso del plazo de presentación de las proposiciones o de las solicitudes de participación, salvo que en los pliegos que rigen la licitación se estableciera otro plazo distinto.',
    },
    razones: [
      'Reproduce el plazo del precepto: a más tardar 6 días antes de que finalice el plazo de presentación de ofertas. El propio artículo lo matiza dos veces: cede ante el plazo distinto que fijen los pliegos, y baja a 4 días en los expedientes calificados de urgentes cuando se trate de contratos de obras, suministros y servicios sujetos a regulación armonizada adjudicados por procedimiento abierto o restringido.',
      'Doce días es el plazo de la CONDICIÓN (cuándo hay que haber pedido la información), no el de entrega.',
      'El plazo se cuenta sobre el fin del plazo de presentación de ofertas, no sobre la formalización del contrato.',
      'El precepto no fija quince días: son 6 para entregar y 12 para haber solicitado.',
    ],
  },
  // ── Art. 140 ──────────────────────────────────────────────────────────────
  {
    art: '140',
    correct: 3,
    question_text: `Conforme al artículo 140.1.a) de ${LEY}, las proposiciones en el procedimiento abierto deberán ir acompañadas de:`,
    opciones: [
      'Una declaración responsable que se ajustará al formulario de documento europeo único de contratación de conformidad con lo indicado en el artículo siguiente, que podrá presentarse sin firma cuando se remita por medios electrónicos.',
      'La documentación acreditativa de la solvencia económica, financiera y técnica exigida en el pliego de conformidad con lo indicado en el artículo siguiente, que deberá estar firmada y con la correspondiente identificación.',
      'Una declaración responsable que se ajustará al modelo aprobado por el órgano de contratación en el pliego de cláusulas administrativas particulares, que deberá estar firmada y con la correspondiente identificación.',
      'Una declaración responsable que se ajustará al formulario de documento europeo único de contratación de conformidad con lo indicado en el artículo siguiente, que deberá estar firmada y con la correspondiente identificación.',
    ],
    cita: {
      ref: 'Art. 140.1.a) de la Ley 9/2017',
      texto:
        'Las proposiciones en el procedimiento abierto deberán ir acompañadas de una declaración responsable que se ajustará al formulario de documento europeo único de contratación de conformidad con lo indicado en el artículo siguiente, que deberá estar firmada y con la correspondiente identificación.',
    },
    razones: [
      'El precepto exige que la declaración esté firmada y con la correspondiente identificación, sin excepcionar la remisión por medios electrónicos.',
      'Lo que acompaña a la proposición es la declaración responsable; la documentación justificativa solo se pide en los supuestos del apartado 3 del mismo artículo.',
      'El modelo al que debe ajustarse la declaración es el formulario de documento europeo único de contratación, no uno aprobado por el órgano de contratación.',
      'Reproduce el precepto: declaración responsable ajustada al formulario de documento europeo único de contratación, firmada y con la correspondiente identificación.',
    ],
  },
  {
    art: '140',
    correct: 2,
    question_text: `Según el artículo 140.1.a) de ${LEY}, entre los extremos que el licitador debe poner de manifiesto en la declaración responsable figura:`,
    opciones: [
      'Que no está incursa en prohibición de contratar por sí misma, quedando excluidas las prohibiciones que le alcancen por extensión.',
      'Que no está incursa en prohibición de contratar por sí misma ni por extensión como consecuencia de la aplicación del artículo 75.2 de esta Ley.',
      'Que no está incursa en prohibición de contratar por sí misma ni por extensión como consecuencia de la aplicación del artículo 71.3 de esta Ley.',
      'Que no ha sido sancionada por infracción grave en materia de contratación en los tres años anteriores a la licitación.',
    ],
    cita: {
      ref: 'Art. 140.1.a).3.º de la Ley 9/2017',
      texto:
        'Que no está incursa en prohibición de contratar por sí misma ni por extensión como consecuencia de la aplicación del artículo 71.3 de esta Ley.',
    },
    razones: [
      'La declaración alcanza también a las prohibiciones que operan por extensión, que es justo lo que el precepto añade.',
      'La remisión del precepto es al artículo 71.3; el 75.2 regula el compromiso cuando se recurre a la solvencia de otras empresas.',
      'Reproduce el precepto: no estar incursa en prohibición de contratar por sí misma ni por extensión conforme al artículo 71.3.',
      'El artículo no formula la declaración en términos de sanciones previas, sino de no estar incursa en prohibición de contratar.',
    ],
  },
  {
    art: '140',
    correct: 1,
    question_text: `El artículo 140.3 de ${LEY}, permite al órgano o la mesa de contratación pedir a los candidatos o licitadores que presenten la totalidad o una parte de los documentos justificativos. Dejando al margen la exención que ese mismo apartado reconoce a quien figura inscrito en un registro o base de datos accesible de modo gratuito, ¿en qué supuestos?`,
    opciones: [
      'Cuando lo solicite cualquier otro licitador del procedimiento y, en todo caso, antes de la formalización del contrato.',
      'Cuando consideren que existen dudas razonables sobre la vigencia o fiabilidad de la declaración, cuando resulte necesario para el buen desarrollo del procedimiento y, en todo caso, antes de adjudicar el contrato.',
      'Cuando consideren que existen dudas razonables sobre la vigencia o fiabilidad de la declaración y cuando resulte necesario para el buen desarrollo del procedimiento, pero nunca una vez abiertas las proposiciones.',
      'Cuando consideren que existen dudas razonables sobre la solvencia sobrevenida del licitador y, en todo caso, antes de la apertura de las proposiciones.',
    ],
    cita: {
      ref: 'Art. 140.3 de la Ley 9/2017',
      texto:
        'El órgano o la mesa de contratación podrán pedir a los candidatos o licitadores que presenten la totalidad o una parte de los documentos justificativos, cuando consideren que existen dudas razonables sobre la vigencia o fiabilidad de la declaración, cuando resulte necesario para el buen desarrollo del procedimiento y, en todo caso, antes de adjudicar el contrato.',
    },
    razones: [
      'La petición no depende de que la inste otro licitador, y el momento límite que fija el precepto es antes de adjudicar, no antes de formalizar.',
      'Reproduce los tres supuestos del precepto: dudas razonables sobre la vigencia o fiabilidad de la declaración, necesidad para el buen desarrollo del procedimiento y, en todo caso, antes de adjudicar el contrato. El mismo apartado exceptúa después al empresario inscrito en el Registro Oficial de Licitadores y Empresas Clasificadas del Sector Público, o en una base de datos nacional de un Estado miembro de la Unión Europea, cuando sean accesibles de modo gratuito.',
      'El artículo obliga a pedirlos en todo caso antes de adjudicar, de modo que no puede prohibirse la petición tras la apertura de las proposiciones.',
      'Las dudas que menciona el precepto son sobre la vigencia o fiabilidad de la declaración, y el momento límite es antes de adjudicar el contrato.',
    ],
  },
  {
    art: '140',
    correct: 0,
    question_text: `Según el artículo 140.4 de ${LEY}, las circunstancias relativas a la capacidad, solvencia y ausencia de prohibiciones de contratar:`,
    opciones: [
      'Deberán concurrir en la fecha final de presentación de ofertas y subsistir en el momento de perfección del contrato.',
      'Deberán concurrir en la fecha de publicación del anuncio de licitación y subsistir en el momento de perfección del contrato.',
      'Deberán concurrir en la fecha final de presentación de ofertas y subsistir hasta la completa ejecución del contrato.',
      'Deberán concurrir en el momento de perfección del contrato, sin que se exija su concurrencia previa.',
    ],
    cita: {
      ref: 'Art. 140.4 de la Ley 9/2017',
      texto:
        'Las circunstancias relativas a la capacidad, solvencia y ausencia de prohibiciones de contratar a las que se refieren los apartados anteriores, deberán concurrir en la fecha final de presentación de ofertas y subsistir en el momento de perfección del contrato.',
    },
    razones: [
      'Reproduce el precepto: concurrencia en la fecha final de presentación de ofertas y subsistencia en el momento de perfección del contrato.',
      'El momento inicial que fija el artículo es la fecha final de presentación de ofertas, no la publicación del anuncio.',
      'La subsistencia se exige hasta la perfección del contrato, no hasta su completa ejecución.',
      'El artículo sí exige que concurran ya en la fecha final de presentación de ofertas, además de subsistir después.',
    ],
  },
  // ── Art. 142 ──────────────────────────────────────────────────────────────
  {
    art: '142',
    correct: 1,
    question_text: `Cuando en la adjudicación hayan de tenerse en cuenta criterios distintos del precio, el artículo 142.1 de ${LEY}, permite al órgano de contratación tomar en consideración las variantes que ofrezcan los licitadores. ¿Bajo qué condición?`,
    opciones: [
      'Siempre que las variantes se justifiquen en el expediente.',
      'Siempre que las variantes se prevean en los pliegos.',
      'Siempre que las variantes las acepte la mesa de contratación.',
      'Siempre que las variantes no alteren el objeto del contrato.',
    ],
    cita: {
      ref: 'Art. 142.1 de la Ley 9/2017',
      texto:
        'El órgano de contratación podrá tomar en consideración las variantes que ofrezcan los licitadores, siempre que las variantes se prevean en los pliegos.',
    },
    razones: [
      'La condición del precepto es que las variantes estén previstas en los pliegos, no que se justifiquen en el expediente de contratación.',
      'Reproduce la condición del precepto: que las variantes se prevean en los pliegos.',
      'El artículo no supedita las variantes a una aceptación de la mesa de contratación, sino a su previsión en los pliegos.',
      'El artículo exige la previsión en los pliegos; la vinculación con el objeto del contrato aparece como uno de los extremos que deben expresarse, no como esta condición.',
    ],
  },
  {
    art: '142',
    correct: 2,
    question_text: `Según el artículo 142.1 de ${LEY}, se considerará cumplido el requisito de que las variantes se prevean en los pliegos:`,
    opciones: [
      'Cuando se expresen los requisitos mínimos y las modalidades de las mismas, sin que sea preciso detallar sus características.',
      'Cuando el pliego se limite a admitir la presentación de variantes por los licitadores.',
      'Cuando se expresen los requisitos mínimos, modalidades, y características de las mismas, así como su necesaria vinculación con el objeto del contrato.',
      'Cuando se expresen los requisitos mínimos, modalidades, y características de las mismas, así como su repercusión sobre el presupuesto base de licitación.',
    ],
    cita: {
      ref: 'Art. 142.1 de la Ley 9/2017',
      texto:
        'Se considerará que se cumple este requisito cuando se expresen los requisitos mínimos, modalidades, y características de las mismas, así como su necesaria vinculación con el objeto del contrato.',
    },
    razones: [
      'Las características de las variantes sí deben expresarse: el precepto las enumera junto a los requisitos mínimos y las modalidades.',
      'No basta con admitirlas: el artículo exige expresar requisitos mínimos, modalidades, características y la vinculación con el objeto del contrato.',
      'Reproduce los cuatro extremos del precepto, incluida la necesaria vinculación de las variantes con el objeto del contrato.',
      'El último extremo que exige el precepto es la vinculación con el objeto del contrato, no la repercusión sobre el presupuesto base de licitación.',
    ],
  },
  {
    art: '142',
    correct: 3,
    question_text: `Conforme al artículo 142.3 de ${LEY}, en los procedimientos de adjudicación de contratos de suministro o de servicios, los órganos de contratación que hayan autorizado la presentación de variantes:`,
    opciones: [
      'Podrán rechazar una de ellas por el único motivo de que, de ser elegida, daría lugar a un contrato de servicios en vez de a un contrato de suministro o a un contrato de suministro en vez de a un contrato de servicios.',
      'No podrán rechazar una de ellas por el único motivo de que, de ser elegida, alteraría el valor estimado del contrato o exigiría reajustar el presupuesto base de licitación aprobado.',
      'No podrán rechazar una de ellas por el único motivo de que, de ser elegida, exigiría modificar los criterios de adjudicación previstos en el pliego de cláusulas administrativas particulares.',
      'No podrán rechazar una de ellas por el único motivo de que, de ser elegida, daría lugar a un contrato de servicios en vez de a un contrato de suministro o a un contrato de suministro en vez de a un contrato de servicios.',
    ],
    cita: {
      ref: 'Art. 142.3 de la Ley 9/2017',
      texto:
        'En los procedimientos de adjudicación de contratos de suministro o de servicios, los órganos de contratación que hayan autorizado la presentación de variantes no podrán rechazar una de ellas por el único motivo de que, de ser elegida, daría lugar a un contrato de servicios en vez de a un contrato de suministro o a un contrato de suministro en vez de a un contrato de servicios.',
    },
    razones: [
      'Invierte la regla: el precepto prohíbe precisamente rechazar la variante por ese único motivo.',
      'El motivo que el precepto declara insuficiente es el cambio de tipo contractual entre suministro y servicios, no una alteración del valor estimado.',
      'El motivo que el precepto declara insuficiente es el cambio de tipo contractual entre suministro y servicios, no la necesidad de modificar los criterios de adjudicación.',
      'Reproduce la prohibición del precepto en sus dos sentidos: de suministro a servicios y de servicios a suministro.',
    ],
  },
  // ── Art. 146 ──────────────────────────────────────────────────────────────
  {
    art: '146',
    correct: 0,
    question_text: `Según el artículo 146.2.a) de ${LEY}, en los procedimientos abierto o restringido celebrados por órganos de las Administraciones Públicas, cuando los criterios cuya cuantificación dependa de un juicio de valor tengan atribuida una ponderación mayor que la de los evaluables de forma automática, su valoración corresponderá —salvo que se encomiende a un organismo técnico especializado, debidamente identificado en los pliegos— a:`,
    opciones: [
      'Un comité formado por expertos con cualificación apropiada, que cuente con un mínimo de tres miembros, que podrán pertenecer a los servicios dependientes del órgano de contratación, pero en ningún caso podrán estar adscritos al órgano proponente del contrato.',
      'Un comité formado por expertos con cualificación apropiada, que cuente con un mínimo de cinco miembros, que podrán pertenecer a los servicios dependientes del órgano de contratación, pero en ningún caso podrán estar adscritos al órgano proponente del contrato.',
      'Un comité formado por expertos con cualificación apropiada, que cuente con un mínimo de tres miembros, que deberán pertenecer al órgano proponente del contrato para garantizar el conocimiento técnico del objeto.',
      'La mesa de contratación, si interviene, o los servicios dependientes del órgano de contratación en caso contrario, que podrán solicitar los informes técnicos que consideren precisos.',
    ],
    cita: {
      ref: 'Art. 146.2.a) de la Ley 9/2017',
      texto:
        'La valoración de los criterios cuya cuantificación dependa de un juicio de valor corresponderá, en los casos en que proceda por tener atribuida una ponderación mayor que la correspondiente a los criterios evaluables de forma automática, a un comité formado por expertos con cualificación apropiada, que cuente con un mínimo de tres miembros, que podrán pertenecer a los servicios dependientes del órgano de contratación, pero en ningún caso podrán estar adscritos al órgano proponente del contrato.',
    },
    razones: [
      'Reproduce el precepto: comité de expertos con un mínimo de tres miembros, que podrán pertenecer a los servicios dependientes del órgano de contratación pero en ningún caso estar adscritos al órgano proponente del contrato. El artículo ofrece además una vía alternativa, encomendar la evaluación a un organismo técnico especializado identificado en los pliegos, que el enunciado deja fuera.',
      'El mínimo que fija el precepto es de tres miembros, no de cinco.',
      'Invierte la incompatibilidad: los miembros del comité no pueden estar adscritos al órgano proponente del contrato.',
      'Ese es el régimen de la letra b) del mismo apartado, aplicable a los restantes supuestos, no al que aquí se describe.',
    ],
  },
  {
    art: '146',
    correct: 2,
    question_text: `Según el artículo 146.3 de ${LEY}, cuando el procedimiento de adjudicación se articule en varias fases, además de indicar en cuáles se irán aplicando los distintos criterios, deberá establecerse:`,
    opciones: [
      'Un umbral mínimo del 50 por ciento de la puntuación en el conjunto de los criterios evaluables mediante fórmulas para continuar en el proceso selectivo.',
      'Un umbral mínimo del 30 por ciento de la puntuación en el conjunto de los criterios cualitativos para continuar en el proceso selectivo.',
      'Un umbral mínimo del 50 por ciento de la puntuación en el conjunto de los criterios cualitativos para continuar en el proceso selectivo.',
      'Un umbral mínimo del 50 por ciento de la puntuación total del procedimiento para poder resultar adjudicatario del contrato.',
    ],
    cita: {
      ref: 'Art. 146.3 de la Ley 9/2017',
      texto:
        'En el caso de que el procedimiento de adjudicación se articule en varias fases, se indicará igualmente en cuales de ellas se irán aplicando los distintos criterios, estableciendo un umbral mínimo del 50 por ciento de la puntuación en el conjunto de los criterios cualitativos para continuar en el proceso selectivo.',
    },
    razones: [
      'El umbral se calcula sobre el conjunto de los criterios cualitativos, no sobre los evaluables mediante fórmulas.',
      'El porcentaje que fija el precepto es el 50 por ciento, no el 30.',
      'Reproduce el precepto: umbral mínimo del 50 por ciento de la puntuación en el conjunto de los criterios cualitativos para continuar en el proceso selectivo.',
      'El umbral condiciona la continuidad en el proceso selectivo, no la adjudicación, y se mide sobre los criterios cualitativos.',
    ],
  },
  // ── Art. 148 ──────────────────────────────────────────────────────────────
  {
    art: '148',
    correct: 3,
    question_text: `Según el artículo 148.1 de ${LEY}, dentro del «ciclo de vida» de un producto, obra o servicio se entienden comprendidas:`,
    opciones: [
      'Únicamente las fases posteriores a la adquisición del producto, obra o servicio por el órgano de contratación.',
      'Todas las fases consecutivas o interrelacionadas que se sucedan durante su existencia, hasta el momento de su puesta en servicio.',
      'Todas las fases consecutivas que se sucedan durante su existencia, excluidas la investigación y el desarrollo previos a la fabricación.',
      'Todas las fases consecutivas o interrelacionadas que se sucedan durante su existencia, hasta que se produzca la eliminación, el desmantelamiento o el final de la utilización.',
    ],
    cita: {
      ref: 'Art. 148.1 de la Ley 9/2017',
      texto:
        'A los efectos de esta Ley se entenderán comprendidos dentro del «ciclo de vida» de un producto, obra o servicio todas las fases consecutivas o interrelacionadas que se sucedan durante su existencia y, en todo caso: la investigación y el desarrollo que deba llevarse a cabo, la fabricación o producción, la comercialización y las condiciones en que esta tenga lugar, el transporte, la utilización y el mantenimiento, la adquisición de las materias primas necesarias y la generación de recursos; todo ello hasta que se produzca la eliminación, el desmantelamiento o el final de la utilización.',
    },
    razones: [
      'El precepto incluye expresamente fases anteriores a la adquisición, como la investigación y el desarrollo o la fabricación.',
      'El ciclo de vida no termina con la puesta en servicio: llega hasta la eliminación, el desmantelamiento o el final de la utilización.',
      'La investigación y el desarrollo que deban llevarse a cabo están incluidos en todo caso por el propio precepto.',
      'Reproduce el precepto: todas las fases consecutivas o interrelacionadas de su existencia, hasta la eliminación, el desmantelamiento o el final de la utilización.',
    ],
  },
  {
    art: '148',
    correct: 1,
    question_text: `El artículo 148.3 de ${LEY}, exige que el método utilizado para evaluar los costes imputados a externalidades medioambientales cumpla varias condiciones. Entre ellas:`,
    opciones: [
      'Estar basado en criterios verificables objetivamente y no discriminatorios, y ser accesible únicamente para los licitadores admitidos.',
      'Estar basado en criterios verificables objetivamente y no discriminatorios, y ser accesible para todas las partes interesadas.',
      'Estar basado en criterios aprobados por el órgano de contratación en cada expediente, y ser accesible para todas las partes interesadas.',
      'Estar basado en criterios verificables objetivamente y no discriminatorios, y haber sido aplicado con anterioridad de forma repetida o continuada.',
    ],
    cita: {
      ref: 'Art. 148.3 de la Ley 9/2017',
      texto:
        'a) estar basado en criterios verificables objetivamente y no discriminatorios; en particular, si no se ha establecido para una aplicación repetida o continuada, no favorecerá o perjudicará indebidamente a empresas determinadas; b) ser accesible para todas las partes interesadas.',
    },
    razones: [
      'La accesibilidad que exige el precepto alcanza a todas las partes interesadas, no solo a los licitadores admitidos.',
      'Reproduce dos de las condiciones del precepto: criterios verificables objetivamente y no discriminatorios, y accesibilidad para todas las partes interesadas.',
      'El artículo no remite los criterios a una aprobación caso por caso del órgano de contratación: exige que sean verificables objetivamente y no discriminatorios.',
      'El precepto no exige aplicación previa repetida o continuada; al contrario, contempla que el método no se haya establecido para ese uso y, en tal caso, prohíbe que favorezca o perjudique indebidamente a empresas determinadas.',
    ],
  },
]
