// T-331 — batch RD 203/2021 arts 50 y 52 (SMS T21 y 9 oposiciones más).
// Cada opción correcta es cita LITERAL del artículo (§2.2). Cada distractor parte del literal y
// cambia UN elemento (§2.2-bis), salvo los que reproducen texto real de otro artículo del propio
// Reglamento — señalados en la razón.
// `correct` = índice 0-3 (§2.2-ter: distribución uniforme, secuencia sin ciclo).

export const REF50 = 'Art. 50 RD 203/2021'
export const REF52 = 'Art. 52 RD 203/2021'

export const PREGUNTAS = [
  // ── Art. 50 ────────────────────────────────────────────────────────────────
  {
    art: '50',
    correct: 1,
    question_text:
      'Según el artículo 50 del Real Decreto 203/2021, de 30 de marzo, por el que se aprueba el Reglamento de actuación y funcionamiento del sector público por medios electrónicos, ¿qué se entiende por «marca de tiempo» como modalidad de referencia temporal de los documentos administrativos electrónicos?',
    opciones: [
      'La asignación por medios electrónicos de la fecha y, en todo caso, la hora a un documento electrónico.',
      'La asignación por medios electrónicos de la fecha y, en su caso, la hora a un documento electrónico.',
      'La asignación por medios electrónicos de la fecha y, en su caso, la hora a un expediente administrativo electrónico.',
      'La asignación por medios electrónicos de una fecha y hora a un documento electrónico con la intervención de un prestador cualificado de servicios de confianza.',
    ],
    cita: {
      ref: 'Art. 50.1.a) RD 203/2021',
      texto:
        'Marca de tiempo, entendiendo por tal la asignación por medios electrónicos de la fecha y, en su caso, la hora a un documento electrónico.',
    },
    razones: [
      'La hora se asigna «en su caso», no en todo caso: el artículo la deja condicionada, y sustituir esa reserva por una exigencia absoluta cambia el precepto.',
      'Reproduce la definición del artículo: fecha y, en su caso, hora asignadas por medios electrónicos a un documento electrónico.',
      'La referencia temporal se asocia al documento electrónico, no al expediente administrativo electrónico, que es una agrupación de documentos regulada en el artículo 51.',
      'Esa es la definición del sello electrónico cualificado de tiempo, que se distingue precisamente por la intervención de un prestador cualificado de servicios de confianza.',
    ],
  },
  {
    art: '50',
    correct: 3,
    question_text:
      'El artículo 50.1.b) del Real Decreto 203/2021, de 30 de marzo, define el sello electrónico cualificado de tiempo como la asignación por medios electrónicos de una fecha y hora a un documento electrónico con la intervención de un prestador cualificado de servicios de confianza. ¿Qué debe asegurar esa intervención?',
    opciones: [
      'Que asegure la confidencialidad y disponibilidad de la marca de tiempo del documento.',
      'Que asegure la exactitud e integridad del expediente electrónico completo.',
      'Que asegure la autenticidad y la cadena de custodia del documento almacenado.',
      'Que asegure la exactitud e integridad de la marca de tiempo del documento.',
    ],
    cita: {
      ref: 'Art. 50.1.b) RD 203/2021',
      texto:
        'Sello electrónico cualificado de tiempo, entendiendo por tal la asignación por medios electrónicos de una fecha y hora a un documento electrónico con la intervención de un prestador cualificado de servicios de confianza que asegure la exactitud e integridad de la marca de tiempo del documento.',
    },
    razones: [
      'Las propiedades que el precepto exige asegurar son la exactitud y la integridad, no la confidencialidad y la disponibilidad.',
      'Lo que debe quedar asegurado es la marca de tiempo del documento, no el expediente electrónico completo.',
      'La autenticidad y la cadena de custodia son garantías que el artículo 55 exige a la gestión del archivo electrónico único, no al sellado de tiempo.',
      'Es la exigencia literal del precepto: la intervención del prestador cualificado asegura la exactitud e integridad de la marca de tiempo del documento.',
    ],
  },
  {
    art: '50',
    correct: 0,
    question_text:
      'Conforme al artículo 50 del Real Decreto 203/2021, de 30 de marzo, ¿qué tratamiento reciben los sellos electrónicos de tiempo NO cualificados?',
    opciones: [
      'Serán asimilables a todos los efectos a las marcas de tiempo.',
      'Serán asimilables únicamente a efectos probatorios a las marcas de tiempo.',
      'Solo serán admisibles cuando lo prevea el Esquema Nacional de Seguridad.',
      'No podrán asociarse a los documentos administrativos electrónicos.',
    ],
    cita: {
      ref: 'Art. 50.1.b) RD 203/2021',
      texto:
        'Los sellos electrónicos de tiempo no cualificados serán asimilables a todos los efectos a las marcas de tiempo.',
    },
    razones: [
      'Es la regla literal del precepto: la asimilación a las marcas de tiempo se produce a todos los efectos.',
      'La asimilación no se limita a los efectos probatorios: el artículo la extiende a todos los efectos.',
      'El precepto no condiciona su admisibilidad a previsión alguna del Esquema Nacional de Seguridad.',
      'Lejos de excluirlos, el artículo los asimila a las marcas de tiempo, que son una de las dos modalidades de referencia temporal admitidas.',
    ],
  },
  {
    art: '50',
    correct: 2,
    question_text:
      'De acuerdo con el artículo 50.2 del Real Decreto 203/2021, de 30 de marzo, la marca de tiempo será utilizada:',
    opciones: [
      'En todos aquellos casos en los que las normas reguladoras establezcan la utilización de un sello electrónico cualificado de tiempo.',
      'En todos aquellos casos en los que las normas reguladoras no establezcan la utilización de una firma electrónica cualificada.',
      'En todos aquellos casos en los que las normas reguladoras no establezcan la utilización de un sello electrónico cualificado de tiempo.',
      'En todos aquellos casos en los que el Esquema Nacional de Interoperabilidad no establezca la utilización de un sello electrónico cualificado de tiempo.',
    ],
    cita: {
      ref: 'Art. 50.2 RD 203/2021',
      texto:
        'La marca de tiempo será utilizada en todos aquellos casos en los que las normas reguladoras no establezcan la utilización de un sello electrónico cualificado de tiempo.',
    },
    razones: [
      'Invierte la regla al suprimir la negación: la marca de tiempo opera cuando las normas reguladoras NO exigen el sello cualificado, no cuando lo exigen.',
      'Lo que las normas reguladoras pueden imponer en su lugar es un sello electrónico cualificado de tiempo, no una firma electrónica cualificada.',
      'Reproduce la regla del precepto: la marca de tiempo es la modalidad por defecto siempre que las normas reguladoras no impongan el sello cualificado.',
      'Quien puede imponer el sello cualificado son las normas reguladoras de los respectivos procedimientos; el Esquema Nacional de Interoperabilidad determina la forma de asociar la información al documento.',
    ],
  },
  {
    art: '50',
    correct: 3,
    question_text:
      'Según el artículo 50 del Real Decreto 203/2021, de 30 de marzo, la información relativa a las marcas y sellos electrónicos cualificados de tiempo se asociará a los documentos electrónicos en la forma que determine:',
    opciones: [
      'El Esquema Nacional de Seguridad y normativa correspondiente.',
      'La política de gestión de documentos electrónicos de cada Administración.',
      'La Comisión Superior Calificadora de Documentos Administrativos.',
      'El Esquema Nacional de Interoperabilidad y normativa correspondiente.',
    ],
    cita: {
      ref: 'Art. 50.2 RD 203/2021',
      texto:
        'La información relativa a las marcas y sellos electrónicos cualificados de tiempo se asociará a los documentos electrónicos en la forma que determine el Esquema Nacional de Interoperabilidad y normativa correspondiente.',
    },
    razones: [
      'El instrumento que el precepto invoca es el de interoperabilidad, no el de seguridad.',
      'La política de gestión de documentos electrónicos determina, en el artículo 52, el tiempo durante el que se garantiza el acceso al expediente, no la forma de asociar la referencia temporal.',
      'Ese órgano interviene en el artículo 55 para fijar los plazos de accesibilidad en el archivo electrónico único de la Administración General del Estado.',
      'Es la remisión literal del precepto: la forma de asociar esa información la determina el Esquema Nacional de Interoperabilidad y normativa correspondiente.',
    ],
  },
  {
    art: '50',
    correct: 1,
    question_text:
      'El artículo 50.3 del Real Decreto 203/2021, de 30 de marzo, exige que la relación de prestadores cualificados de servicios de confianza que prestan servicios de sellado de tiempo en el sector público esté incluida en:',
    opciones: [
      'El Registro de Funcionarios Habilitados de la Administración General del Estado.',
      'La «Lista de confianza de prestadores cualificados de servicios de confianza».',
      'El Esquema Nacional de Interoperabilidad y su normativa de desarrollo.',
      'El archivo electrónico único de la Administración General del Estado.',
    ],
    cita: {
      ref: 'Art. 50.3 RD 203/2021',
      texto:
        'La relación de prestadores cualificados de servicios de confianza que prestan servicios de sellado de tiempo en el sector público deberá estar incluida en la «Lista de confianza de prestadores cualificados de servicios de confianza».',
    },
    razones: [
      'Ese registro es el que el artículo 48.2 exige para el personal funcionario habilitado que expide copias auténticas, no para los prestadores de servicios de confianza.',
      'Es el instrumento que designa el precepto para dar publicidad a esos prestadores.',
      'El Esquema Nacional de Interoperabilidad determina cómo se asocia la información de las marcas y sellos al documento, pero no es donde se relacionan los prestadores.',
      'El archivo electrónico único sustenta la custodia y recuperación de documentos y expedientes finalizados conforme al artículo 55, no la publicidad de los prestadores.',
    ],
  },
  // ── Art. 52 ────────────────────────────────────────────────────────────────
  {
    art: '52',
    correct: 2,
    question_text:
      'Según el artículo 52 del Real Decreto 203/2021, de 30 de marzo, el derecho de acceso de las personas interesadas que se relacionen electrónicamente con las Administraciones Públicas al expediente electrónico y, en su caso, a la obtención de copia total o parcial del mismo, se entenderá satisfecho mediante:',
    opciones: [
      'La puesta a disposición de dicho expediente en el archivo electrónico único de la Administración competente o en la sede electrónica o sede electrónica asociada que corresponda.',
      'La comparecencia del interesado en la sede electrónica o sede electrónica asociada de la Administración actuante a través de la Dirección Electrónica Habilitada única.',
      'La puesta a disposición de dicho expediente en el Punto de Acceso General electrónico de la Administración competente o en la sede electrónica o sede electrónica asociada que corresponda.',
      'La puesta a disposición de dicho expediente en el Punto de Acceso General electrónico de la Administración competente, siempre que el interesado lo solicite expresamente.',
    ],
    cita: {
      ref: 'Art. 52 RD 203/2021',
      texto:
        'El derecho de acceso de las personas interesadas que se relacionen electrónicamente con las Administraciones Públicas al expediente electrónico y, en su caso, a la obtención de copia total o parcial del mismo, se entenderá satisfecho mediante la puesta a disposición de dicho expediente en el Punto de Acceso General electrónico de la Administración competente o en la sede electrónica o sede electrónica asociada que corresponda.',
    },
    razones: [
      'El lugar de puesta a disposición que fija el precepto es el Punto de Acceso General electrónico; el archivo electrónico único es donde se custodian los expedientes ya finalizados según el artículo 55.',
      'La comparecencia y la Dirección Electrónica Habilitada única son los sistemas con los que el artículo 42 regula la práctica de las notificaciones, no el ejercicio del derecho de acceso al expediente.',
      'Reproduce el precepto: el derecho queda satisfecho con la puesta a disposición del expediente en el Punto de Acceso General electrónico o en la sede electrónica o sede electrónica asociada que corresponda.',
      'Añade una condición que el artículo no contempla: no se exige solicitud expresa de puesta a disposición, y además omite la sede electrónica como alternativa.',
    ],
  },
  {
    art: '52',
    correct: 0,
    question_text:
      'El artículo 52 del Real Decreto 203/2021, de 30 de marzo, regula el ejercicio del derecho de acceso al expediente electrónico «de acuerdo con lo previsto» en un precepto concreto de la Ley 39/2015, de 1 de octubre, del Procedimiento Administrativo Común de las Administraciones Públicas. ¿Cuál es ese precepto?',
    opciones: ['El artículo 53.1.a).', 'El artículo 43.1.', 'El artículo 27.2.', 'El artículo 14.'],
    cita: {
      ref: 'Art. 52 RD 203/2021',
      texto:
        'De acuerdo con lo previsto en el artículo 53.1.a) de la Ley 39/2015, de 1 de octubre, el derecho de acceso de las personas interesadas que se relacionen electrónicamente con las Administraciones Públicas al expediente electrónico y, en su caso, a la obtención de copia total o parcial del mismo, se entenderá satisfecho mediante la puesta a disposición de dicho expediente.',
    },
    razones: [
      'Es la remisión que abre el artículo 52 del Reglamento.',
      'Ese es el precepto que invoca el artículo 42.1 del Reglamento para la práctica de las notificaciones por medios electrónicos.',
      'Ese es el precepto que invoca el artículo 47.1 del Reglamento para los requisitos de validez y eficacia de las copias auténticas.',
      'Ese es el precepto que invoca el artículo 41 del Reglamento cuando la relación del interesado con la Administración debe realizarse por medios electrónicos.',
    ],
  },
  {
    art: '52',
    correct: 3,
    question_text:
      'Conforme al artículo 52 del Real Decreto 203/2021, de 30 de marzo, ¿qué debe remitir al interesado o, en su caso, a su representante la Administración destinataria de la solicitud de acceso al expediente electrónico?',
    opciones: [
      'Una copia auténtica en soporte electrónico del expediente completo puesto a disposición.',
      'La dirección electrónica o localizador que dé acceso al archivo electrónico único de la Administración.',
      'Los datos necesarios para el acceso por medios electrónicos al documento administrativo solicitado.',
      'La dirección electrónica o localizador que dé acceso al expediente electrónico puesto a disposición.',
    ],
    cita: {
      ref: 'Art. 52 RD 203/2021',
      texto:
        'La Administración destinataria de la solicitud remitirá al interesado o, en su caso a su representante, la dirección electrónica o localizador que dé acceso al expediente electrónico puesto a disposición.',
    },
    razones: [
      'El precepto no obliga a remitir una copia auténtica del expediente, sino el medio de acceso a este; la copia auténtica se rige por los artículos 47 y 48.',
      'El acceso se da al expediente electrónico puesto a disposición, no al archivo electrónico único, que custodia los expedientes ya finalizados según el artículo 55.',
      'Esa es la sustitución que permite el artículo 46.2 cuando el órgano actuante debe facilitar un ejemplar de un documento administrativo electrónico, no la respuesta a la solicitud de acceso al expediente.',
      'Es lo que el artículo ordena remitir: la dirección electrónica o localizador que dé acceso al expediente electrónico puesto a disposición.',
    ],
  },
  {
    art: '52',
    correct: 0,
    question_text:
      'Según el artículo 52 del Real Decreto 203/2021, de 30 de marzo, la Administración garantizará el acceso al expediente electrónico puesto a disposición durante:',
    opciones: [
      'El tiempo que determine la correspondiente política de gestión de documentos electrónicos, siempre de acuerdo con el dictamen de valoración emitido por la autoridad calificadora correspondiente.',
      'El tiempo que determine la correspondiente política de gestión de documentos electrónicos, siempre de acuerdo con el dictamen de valoración emitido por el órgano instructor del procedimiento.',
      'Seis meses, independientemente del procedimiento administrativo al que se incorpore o de la Administración Pública a que vaya dirigido el expediente.',
      'El plazo que determine el Esquema Nacional de Interoperabilidad, siempre de acuerdo con la normativa de transparencia y acceso a la información pública.',
    ],
    cita: {
      ref: 'Art. 52 RD 203/2021',
      texto:
        'Garantizando aquella el acceso durante el tiempo que determine la correspondiente política de gestión de documentos electrónicos siempre de acuerdo con el dictamen de valoración emitido por la autoridad calificadora correspondiente.',
    },
    razones: [
      'Reproduce el precepto: el tiempo lo fija la política de gestión de documentos electrónicos, de acuerdo con el dictamen de valoración de la autoridad calificadora correspondiente.',
      'Quien emite el dictamen de valoración es la autoridad calificadora correspondiente, no el órgano instructor del procedimiento.',
      'Ese es el plazo que el artículo 53 fija para conservar a disposición del interesado los documentos en papel o en dispositivo que no se le pudieron devolver, no para el acceso al expediente.',
      'El Esquema Nacional de Interoperabilidad determina la forma de asociar la referencia temporal a los documentos; el tiempo de acceso lo fija la política de gestión de documentos electrónicos.',
    ],
  },
  {
    art: '52',
    correct: 2,
    question_text:
      'El artículo 52 del Real Decreto 203/2021, de 30 de marzo, obliga a garantizar, junto al acceso al expediente electrónico, el cumplimiento de la normativa aplicable en materia de:',
    opciones: [
      'Protección de datos de carácter personal y de transparencia y acceso a la información pública y de seguridad de las redes y sistemas de información.',
      'Protección de datos de carácter personal y de reutilización de la información del sector público y de patrimonio documental, histórico y cultural.',
      'Protección de datos de carácter personal y de transparencia y acceso a la información pública y de patrimonio documental, histórico y cultural.',
      'Protección de datos de carácter personal, de transparencia y acceso a la información pública y de contratación del sector público.',
    ],
    cita: {
      ref: 'Art. 52 RD 203/2021',
      texto:
        'Y el cumplimiento de la normativa aplicable en materia de protección de datos de carácter personal y de transparencia y acceso a la información pública y de patrimonio documental, histórico y cultural.',
    },
    razones: [
      'La tercera materia que enumera el precepto es la de patrimonio documental, histórico y cultural, no la de seguridad de las redes y sistemas de información.',
      'La segunda materia que enumera el precepto es la de transparencia y acceso a la información pública, no la de reutilización de la información del sector público.',
      'Reproduce las tres materias que enumera el precepto: protección de datos de carácter personal, transparencia y acceso a la información pública, y patrimonio documental, histórico y cultural.',
      'La contratación del sector público no figura entre las materias que el artículo enumera; la tercera es la de patrimonio documental, histórico y cultural.',
    ],
  },
]
