// T-115 — lote LO 3/2018 (LOPDGDD) arts. 26, 53 bis, 61 y 62. Los cuatro sirven CERO preguntas
// en 43 temas de 43 oposiciones activas.
// Contenedor verificado contra el BOE vigente (BOE-A-2018-16673): 4/4 idénticos.
// Cada correcta es cita literal (§2.2); cada distractor parte del literal y cambia UN elemento
// (§2.2-bis). `correct` = índice 0-3 (§2.2-ter).

const LO = 'la Ley Orgánica 3/2018, de 5 de diciembre, de Protección de Datos Personales y garantía de los derechos digitales'

export const PREGUNTAS = [
  // ── Art. 26 ───────────────────────────────────────────────────────────────
  {
    art: '26',
    correct: 2,
    question_text: `El artículo 26 de ${LO}, somete el tratamiento de datos con fines de archivo en interés público al Reglamento (UE) 2016/679 y a la propia ley orgánica, «con las especialidades que se derivan de lo previsto en» determinadas normas. ¿Cuáles son?`,
    opciones: [
      'La Ley 16/1985, de 25 de junio, del Patrimonio Histórico Español, el Real Decreto 1708/2011, de 18 de noviembre, y la normativa municipal que resulte de aplicación.',
      'La Ley 16/1985, de 25 de junio, del Patrimonio Histórico Español, la Ley 19/2013, de 9 de diciembre, de transparencia, y la legislación autonómica que resulte de aplicación.',
      'La Ley 16/1985, de 25 de junio, del Patrimonio Histórico Español, el Real Decreto 1708/2011, de 18 de noviembre, y la legislación autonómica que resulte de aplicación.',
      'La Ley 39/2015, de 1 de octubre, del Procedimiento Administrativo Común, el Real Decreto 1708/2011, de 18 de noviembre, y la legislación autonómica que resulte de aplicación.',
    ],
    cita: {
      ref: 'Art. 26 de la Ley Orgánica 3/2018',
      texto:
        'Será lícito el tratamiento por las Administraciones Públicas de datos con fines de archivo en interés público, que se someterá a lo dispuesto en el Reglamento (UE) 2016/679 y en la presente ley orgánica con las especialidades que se derivan de lo previsto en la Ley 16/1985, de 25 de junio, del Patrimonio Histórico Español, en el Real Decreto 1708/2011, de 18 de noviembre, por el que se establece el Sistema Español de Archivos y se regula el Sistema de Archivos de la Administración General del Estado y de sus Organismos Públicos y su régimen de acceso, así como la legislación autonómica que resulte de aplicación.',
    },
    razones: [
      'La tercera remisión del precepto es a la legislación autonómica que resulte de aplicación, no a la normativa municipal.',
      'La segunda norma que enumera el artículo es el Real Decreto 1708/2011, de 18 de noviembre, no la ley de transparencia.',
      'Reproduce las tres remisiones del precepto: la ley del Patrimonio Histórico Español, el Real Decreto 1708/2011 y la legislación autonómica aplicable.',
      'La primera norma que enumera el artículo es la Ley 16/1985, de 25 de junio, del Patrimonio Histórico Español, no la de procedimiento administrativo común.',
    ],
  },
  {
    art: '26',
    correct: 0,
    question_text: `Según el artículo 26 de ${LO}, ¿qué establece y regula el Real Decreto 1708/2011, de 18 de noviembre, al que ese precepto se remite?`,
    opciones: [
      'El Sistema Español de Archivos, y regula el Sistema de Archivos de la Administración General del Estado y de sus Organismos Públicos y su régimen de acceso.',
      'El Sistema Español de Archivos, y regula el Sistema de Archivos de las Comunidades Autónomas y de sus Organismos Públicos y su régimen de acceso.',
      'El Sistema Español de Archivos, y regula el Sistema de Archivos de la Administración General del Estado y de sus Organismos Públicos y su régimen sancionador.',
      'El Sistema Español de Patrimonio Documental, y regula el Sistema de Archivos de la Administración General del Estado y su régimen de acceso.',
    ],
    cita: {
      ref: 'Art. 26 de la Ley Orgánica 3/2018',
      texto:
        'En el Real Decreto 1708/2011, de 18 de noviembre, por el que se establece el Sistema Español de Archivos y se regula el Sistema de Archivos de la Administración General del Estado y de sus Organismos Públicos y su régimen de acceso.',
    },
    razones: [
      'Reproduce el título del real decreto tal y como lo cita el artículo: Sistema Español de Archivos, Sistema de Archivos de la Administración General del Estado y de sus Organismos Públicos, y su régimen de acceso.',
      'El sistema de archivos que ese real decreto regula es el de la Administración General del Estado, no el de las Comunidades Autónomas.',
      'Lo que ese real decreto regula es el régimen de acceso, no un régimen sancionador.',
      'Lo que ese real decreto establece es el Sistema Español de Archivos; el patrimonio documental es materia de la Ley 16/1985, la otra norma a la que remite el artículo.',
    ],
  },
  {
    art: '26',
    correct: 3,
    question_text: `De acuerdo con el artículo 26 de ${LO}, ¿qué tratamiento declara lícito ese precepto?`,
    opciones: [
      'El tratamiento por las Administraciones Públicas de datos con fines de investigación científica e histórica.',
      'El tratamiento por cualquier responsable o encargado de datos con fines de archivo en interés público.',
      'El tratamiento por las Administraciones Públicas de datos con fines estadísticos en interés general.',
      'El tratamiento por las Administraciones Públicas de datos con fines de archivo en interés público.',
    ],
    cita: {
      ref: 'Art. 26 de la Ley Orgánica 3/2018',
      texto:
        'Será lícito el tratamiento por las Administraciones Públicas de datos con fines de archivo en interés público.',
    },
    razones: [
      'El fin que el artículo declara lícito es el de archivo en interés público, no el de investigación científica e histórica.',
      'El precepto acota el sujeto a las Administraciones Públicas, no lo extiende a cualquier responsable o encargado.',
      'El fin que el artículo declara lícito es el de archivo en interés público, no el estadístico.',
      'Reproduce el supuesto del precepto: tratamiento por las Administraciones Públicas con fines de archivo en interés público.',
    ],
  },
  // ── Art. 53 bis ───────────────────────────────────────────────────────────
  {
    art: '53 bis',
    correct: 1,
    question_text: `Según el artículo 53 bis de ${LO}, las actuaciones de investigación podrán realizarse a través de sistemas digitales que, mediante la videoconferencia u otro sistema similar, permitan:`,
    opciones: [
      'La comunicación unidireccional y diferida de imagen y sonido, la interacción visual, auditiva y verbal entre la Agencia Española de Protección de Datos y el inspeccionado.',
      'La comunicación bidireccional y simultánea de imagen y sonido, la interacción visual, auditiva y verbal entre la Agencia Española de Protección de Datos y el inspeccionado.',
      'La comunicación bidireccional y simultánea de imagen y sonido, la interacción visual, auditiva y verbal entre el Comité Europeo de Protección de Datos y el inspeccionado.',
      'La comunicación bidireccional y simultánea de imagen y sonido, así como la firma electrónica cualificada de las actas por parte del inspeccionado.',
    ],
    cita: {
      ref: 'Art. 53 bis de la Ley Orgánica 3/2018',
      texto:
        'Las actuaciones de investigación podrán realizarse a través de sistemas digitales que, mediante la videoconferencia u otro sistema similar, permitan la comunicación bidireccional y simultánea de imagen y sonido, la interacción visual, auditiva y verbal entre la Agencia Española de Protección de Datos y el inspeccionado.',
    },
    razones: [
      'El precepto exige que la comunicación sea bidireccional y simultánea; una comunicación unidireccional y diferida no permitiría la interacción que el artículo requiere.',
      'Reproduce lo que el artículo exige al sistema digital: comunicación bidireccional y simultánea de imagen y sonido e interacción visual, auditiva y verbal entre la autoridad de control y el inspeccionado.',
      'La interacción que describe el precepto se produce entre la Agencia Española de Protección de Datos y el inspeccionado; el Comité Europeo de Protección de Datos interviene en el procedimiento del artículo 62 de esta ley orgánica, no en las actuaciones de investigación.',
      'El artículo no exige firma electrónica cualificada de las actas: lo que pide es recoger las evidencias asegurando su autoría, autenticidad e integridad.',
    ],
  },
  {
    art: '53 bis',
    correct: 3,
    question_text: `Además de permitir la comunicación bidireccional y simultánea, ¿qué deben garantizar los sistemas digitales a los que se refiere el artículo 53 bis de ${LO}?`,
    opciones: [
      'La transmisión y recepción seguras de los documentos e información que se intercambien y, en su caso, recoger las evidencias necesarias y el resultado de las actuaciones realizadas asegurando su autoría, confidencialidad y disponibilidad.',
      'La transmisión y recepción seguras de los documentos e información que se intercambien y, en todo caso, recoger las evidencias necesarias y el resultado de las actuaciones realizadas asegurando su autoría, autenticidad e integridad.',
      'La conservación durante seis meses de los documentos e información que se intercambien y, en su caso, recoger las evidencias necesarias y el resultado de las actuaciones realizadas asegurando su autoría, autenticidad e integridad.',
      'La transmisión y recepción seguras de los documentos e información que se intercambien y, en su caso, recoger las evidencias necesarias y el resultado de las actuaciones realizadas asegurando su autoría, autenticidad e integridad.',
    ],
    cita: {
      ref: 'Art. 53 bis de la Ley Orgánica 3/2018',
      texto:
        'Además, deben garantizar la transmisión y recepción seguras de los documentos e información que se intercambien, y, en su caso, recoger las evidencias necesarias y el resultado de las actuaciones realizadas asegurando su autoría, autenticidad e integridad.',
    },
    razones: [
      'Las tres propiedades que el precepto exige asegurar son autoría, autenticidad e integridad, no confidencialidad y disponibilidad.',
      'El artículo condiciona esa recogida de evidencias con un «en su caso»; sustituirlo por «en todo caso» convierte en obligatorio lo que la norma deja a las circunstancias.',
      'El precepto no fija plazo de conservación alguno: lo que exige es la transmisión y recepción seguras de los documentos e información que se intercambien.',
      'Reproduce la exigencia del artículo: transmisión y recepción seguras y, en su caso, recogida de evidencias y del resultado asegurando autoría, autenticidad e integridad.',
    ],
  },
  {
    art: '53 bis',
    correct: 0,
    question_text: `Conforme al artículo 53 bis de ${LO}, la utilización de estos sistemas digitales en las actuaciones de investigación:`,
    opciones: [
      'Se producirá cuando lo determine la Agencia y requerirá la conformidad del inspeccionado en relación con su uso y con la fecha y hora de su desarrollo.',
      'Se producirá cuando lo solicite el inspeccionado y requerirá la conformidad de la Agencia en relación con su uso y con la fecha y hora de su desarrollo.',
      'Se producirá cuando lo determine la Agencia y no requerirá la conformidad del inspeccionado, sin perjuicio de su derecho a formular alegaciones.',
      'Se producirá cuando lo determine la Agencia y requerirá la conformidad del inspeccionado únicamente en relación con la fecha y hora de su desarrollo.',
    ],
    cita: {
      ref: 'Art. 53 bis de la Ley Orgánica 3/2018',
      texto:
        'La utilización de estos sistemas se producirá cuando lo determine la Agencia y requerirá la conformidad del inspeccionado en relación con su uso y con la fecha y hora de su desarrollo.',
    },
    razones: [
      'Reproduce el precepto: la decisión es de la Agencia y la conformidad, del inspeccionado, tanto sobre el uso como sobre la fecha y la hora.',
      'Invierte los papeles: quien determina la utilización es la Agencia, y quien presta la conformidad es el inspeccionado.',
      'La conformidad del inspeccionado sí se exige; el artículo la hace requisito de la utilización del sistema.',
      'La conformidad del inspeccionado alcanza también al uso del sistema, no solo a la fecha y hora de su desarrollo.',
    ],
  },
  // ── Art. 61 ───────────────────────────────────────────────────────────────
  {
    art: '61',
    correct: 2,
    question_text: `El artículo 61.1 de ${LO}, atribuye a las autoridades autonómicas de protección de datos la condición de autoridad de control principal o interesada en el procedimiento establecido por el artículo 60 del Reglamento (UE) 2016/679. ¿Con qué salvedad?`,
    opciones: [
      'Salvo que desarrollase ocasionalmente tratamientos de distinta naturaleza en el resto del territorio español.',
      'Salvo que el responsable tuviera su establecimiento principal fuera del territorio español.',
      'Salvo que desarrollase significativamente tratamientos de la misma naturaleza en el resto del territorio español.',
      'Salvo que la Agencia Española de Protección de Datos hubiera iniciado ya actuaciones de investigación.',
    ],
    cita: {
      ref: 'Art. 61.1 de la Ley Orgánica 3/2018',
      texto:
        'Las autoridades autonómicas de protección de datos ostentarán la condición de autoridad de control principal o interesada en el procedimiento establecido por el artículo 60 del Reglamento (UE) 2016/679 cuando se refiera a un tratamiento previsto en el artículo 57 de esta ley orgánica que se llevara a cabo por un responsable o encargado del tratamiento de los previstos en el artículo 56 del Reglamento (UE) 2016/679, salvo que desarrollase significativamente tratamientos de la misma naturaleza en el resto del territorio español.',
    },
    razones: [
      'La salvedad se activa cuando los tratamientos se desarrollan de forma significativa y son de la misma naturaleza; cambiar ambos términos la vacía de contenido.',
      'El precepto no atiende a dónde esté el establecimiento principal del responsable, sino a si este desarrolla significativamente tratamientos de la misma naturaleza en el resto del territorio.',
      'Reproduce la salvedad del artículo: que se desarrollasen significativamente tratamientos de la misma naturaleza en el resto del territorio español.',
      'El artículo no condiciona la salvedad a que la Agencia haya iniciado actuaciones previas.',
    ],
  },
  {
    art: '61',
    correct: 1,
    question_text: `Según el artículo 61.1 de ${LO}, la intervención de las autoridades autonómicas como autoridad de control principal o interesada procede cuando el procedimiento se refiera a:`,
    opciones: [
      'Un tratamiento previsto en el artículo 56 de esta ley orgánica que se llevara a cabo por un responsable o encargado del tratamiento de los previstos en el artículo 57 del Reglamento (UE) 2016/679.',
      'Un tratamiento previsto en el artículo 57 de esta ley orgánica que se llevara a cabo por un responsable o encargado del tratamiento de los previstos en el artículo 56 del Reglamento (UE) 2016/679.',
      'Un tratamiento previsto en el artículo 57 de esta ley orgánica que se llevara a cabo por un responsable o encargado del tratamiento de los previstos en el artículo 60 del Reglamento (UE) 2016/679.',
      'Cualquier tratamiento transfronterizo que se llevara a cabo por un responsable o encargado del tratamiento establecido en el territorio de la comunidad autónoma.',
    ],
    cita: {
      ref: 'Art. 61.1 de la Ley Orgánica 3/2018',
      texto:
        'Cuando se refiera a un tratamiento previsto en el artículo 57 de esta ley orgánica que se llevara a cabo por un responsable o encargado del tratamiento de los previstos en el artículo 56 del Reglamento (UE) 2016/679.',
    },
    razones: [
      'Intercambia las dos remisiones: el tratamiento es el del artículo 57 de la ley orgánica y el responsable o encargado, el del artículo 56 del Reglamento.',
      'Reproduce las dos remisiones del precepto: tratamiento del artículo 57 de la ley orgánica y responsable o encargado del artículo 56 del Reglamento.',
      'El artículo 60 del Reglamento es el que establece el procedimiento en el que se interviene, no el que identifica al responsable o encargado.',
      'El precepto no alcanza a cualquier tratamiento transfronterizo ni usa como criterio el establecimiento en el territorio de la comunidad autónoma.',
    ],
  },
  {
    art: '61',
    correct: 3,
    question_text: `De acuerdo con el artículo 61.2 de ${LO}, al intervenir en los procedimientos establecidos en el artículo 60 del Reglamento (UE) 2016/679, las autoridades autonómicas informarán a la Agencia Española de Protección de Datos sobre su desarrollo:`,
    opciones: [
      'En todo caso, con independencia del mecanismo que resulte aplicable.',
      'Únicamente cuando la Agencia se lo requiera de forma expresa.',
      'En los supuestos en que deba aplicarse el mecanismo de ventanilla única.',
      'En los supuestos en que deba aplicarse el mecanismo de coherencia.',
    ],
    cita: {
      ref: 'Art. 61.2 de la Ley Orgánica 3/2018',
      texto:
        'Corresponderá en estos casos a las autoridades autonómicas intervenir en los procedimientos establecidos en el artículo 60 del Reglamento (UE) 2016/679, informando a la Agencia Española de Protección de Datos sobre su desarrollo en los supuestos en que deba aplicarse el mecanismo de coherencia.',
    },
    razones: [
      'El artículo acota el deber de información a un supuesto concreto, en lugar de imponerlo en todo caso.',
      'El deber de informar no depende de un requerimiento previo de la Agencia: nace de que deba aplicarse el mecanismo correspondiente.',
      'El mecanismo que el precepto menciona es el de coherencia, no el de ventanilla única.',
      'Reproduce el supuesto del artículo: se informa a la Agencia cuando deba aplicarse el mecanismo de coherencia.',
    ],
  },
  // ── Art. 62 ───────────────────────────────────────────────────────────────
  {
    art: '62',
    correct: 0,
    question_text: `Según el artículo 62.1 de ${LO}, cuando las autoridades autonómicas de protección de datos, como autoridades principales, deban solicitar del Comité Europeo de Protección de Datos la emisión de una decisión vinculante, las comunicaciones entre ambos:`,
    opciones: [
      'Se practicarán por conducto de la Agencia Española de Protección de Datos.',
      'Se practicarán directamente entre el Comité y la autoridad autonómica interesada.',
      'Se practicarán por conducto del ministerio competente en materia de justicia.',
      'Se practicarán por conducto de la Agencia solo cuando esta lo solicite expresamente.',
    ],
    cita: {
      ref: 'Art. 62.1 de la Ley Orgánica 3/2018',
      texto:
        'Se practicarán por conducto de la Agencia Española de Protección de Datos todas las comunicaciones entre el Comité Europeo de Protección de Datos y las autoridades autonómicas de protección de datos cuando estas, como autoridades principales, deban solicitar del citado Comité la emisión de una decisión vinculante.',
    },
    razones: [
      'Reproduce la regla del precepto: en ese supuesto todas las comunicaciones pasan por la Agencia Española de Protección de Datos.',
      'El artículo interpone precisamente a la Agencia: excluye que la comunicación sea directa entre el Comité y la autoridad autonómica.',
      'El conducto que fija el artículo es la Agencia Española de Protección de Datos, no un ministerio.',
      'La regla no está condicionada a que la Agencia lo solicite: alcanza a todas las comunicaciones de ese supuesto.',
    ],
  },
  {
    art: '62',
    correct: 2,
    question_text: `El artículo 62.1 de ${LO}, se refiere a la decisión vinculante que las autoridades principales pueden solicitar del Comité Europeo de Protección de Datos. ¿En qué artículo del Reglamento (UE) 2016/679 está prevista esa decisión?`,
    opciones: ['En el artículo 60.', 'En el artículo 56.', 'En el artículo 65.', 'En el artículo 57.'],
    cita: {
      ref: 'Art. 62.1 de la Ley Orgánica 3/2018',
      texto:
        'Deban solicitar del citado Comité la emisión de una decisión vinculante según lo previsto en el artículo 65 del Reglamento (UE) 2016/679.',
    },
    razones: [
      'Ese es el artículo del Reglamento que establece el procedimiento en el que interviene la autoridad autonómica según el artículo 61 de la ley orgánica.',
      'Ese es el artículo del Reglamento que identifica al responsable o encargado del tratamiento en el supuesto del artículo 61.1 de la ley orgánica.',
      'Es la remisión del precepto: la decisión vinculante del Comité está prevista en el artículo 65 del Reglamento.',
      'Con ese número, el artículo 57 al que remite la ley orgánica es el suyo propio, no el del Reglamento.',
    ],
  },
  {
    art: '62',
    correct: 1,
    question_text: `Conforme al artículo 62.2 de ${LO}, las autoridades autonómicas de protección de datos que tengan la condición de autoridad interesada no principal en un procedimiento de los previstos en el artículo 65 del Reglamento (UE) 2016/679:`,
    opciones: [
      'Informarán al Comité Europeo de Protección de Datos cuando el asunto sea remitido a la Agencia Española de Protección de Datos, facilitándole la documentación e información necesarias para su tramitación.',
      'Informarán a la Agencia Española de Protección de Datos cuando el asunto sea remitido al Comité Europeo de Protección de Datos, facilitándole la documentación e información necesarias para su tramitación.',
      'Informarán a la Agencia Española de Protección de Datos cuando el asunto sea remitido al Comité Europeo de Protección de Datos, sin que deban facilitarle documentación alguna sobre su tramitación.',
      'Informarán a la Agencia Española de Protección de Datos únicamente si esta les requiere la documentación e información necesarias para la tramitación del asunto.',
    ],
    cita: {
      ref: 'Art. 62.2 de la Ley Orgánica 3/2018',
      texto:
        'Las autoridades autonómicas de protección de datos que tengan la condición de autoridad interesada no principal en un procedimiento de los previstos en el artículo 65 del Reglamento (UE) 2016/679 informarán a la Agencia Española de Protección de Datos cuando el asunto sea remitido al Comité Europeo de Protección de Datos, facilitándole la documentación e información necesarias para su tramitación.',
    },
    razones: [
      'Intercambia los papeles: se informa a la Agencia cuando el asunto se remite al Comité, y no al revés.',
      'Reproduce el precepto: se informa a la Agencia al remitirse el asunto al Comité y se le facilita la documentación e información necesarias.',
      'El artículo sí impone facilitar la documentación e información necesarias para la tramitación, además de informar.',
      'El deber no depende de un requerimiento previo de la Agencia: surge cuando el asunto es remitido al Comité.',
    ],
  },
  {
    art: '62',
    correct: 0,
    question_text: `Según el artículo 62 de ${LO}, en su intervención ante el Comité Europeo de Protección de Datos, la Agencia Española de Protección de Datos:`,
    opciones: [
      'Será asistida por un representante de la autoridad autonómica interesada.',
      'Será asistida por un representante del ministerio competente en la materia.',
      'Actuará en exclusiva, sin representación de las autoridades autonómicas.',
      'Será sustituida por un representante de la autoridad autonómica interesada.',
    ],
    cita: {
      ref: 'Art. 62.2 de la Ley Orgánica 3/2018',
      texto:
        'La Agencia Española de Protección de Datos será asistida por un representante de la autoridad autonómica interesada en su intervención ante el mencionado comité.',
    },
    razones: [
      'Reproduce el precepto: la asistencia la presta un representante de la autoridad autonómica interesada.',
      'Quien asiste a la Agencia es un representante de la autoridad autonómica interesada, no del ministerio.',
      'El artículo prevé expresamente esa asistencia autonómica, de modo que la Agencia no actúa en exclusiva.',
      'La autoridad autonómica asiste a la Agencia; no la sustituye en su intervención ante el comité.',
    ],
  },
]
