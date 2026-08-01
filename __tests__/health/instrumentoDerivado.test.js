/**
 * @jest-environment node
 */
// Núcleo puro del detector `pregunta_instrumento_derivado`.
//
// El banco de casos NO está inventado: son las NUEVE preguntas que colgaban del art. 7 de la Ley
// 12/2007 andaluza el 01/08/2026, clasificadas a mano contra el texto del artículo. Seis no eran
// contestables con él y tres sí. Si el detector deja de separarlas, el test lo dice.
//
// Origen: cinco impugnaciones de un usuario premium (m.g.espadero), todas ciertas.
const {
  clasificarInstrumentoDerivado,
  pideContenidoDeInstrumento,
} = require('../../lib/health/instrumentoDerivado.cjs')

// Texto REAL del art. 7 (resumido a sus apartados, verbatim en lo que importa para la medida).
const ART7 = {
  id: 'art7',
  article_number: '7',
  content: `1. El Consejo de Gobierno de la Junta de Andalucía, con la participación de las entidades
  locales, formulará y aprobará, con una periodicidad que no será inferior a cuatro años, un Plan
  Estratégico para la Igualdad de Mujeres y Hombres en Andalucía, a propuesta de la Consejería
  competente en materia de igualdad, en el que se incluirán las líneas de intervención y directrices
  que orientarán las actividades de los poderes públicos en Andalucía en materia de igualdad entre
  mujeres y hombres. 2. En desarrollo de las líneas de intervención y directrices del Plan Estratégico,
  cada Consejería elaborará y aprobará sus propios planes de igualdad, de ámbito específico, que
  contemplarán las medidas y el presupuesto en materia de igualdad entre mujeres y hombres en el ámbito
  de sus competencias, que serán evaluados anualmente para incluir las medidas correctoras oportunas.
  3. Las entidades locales aprobarán sus propios planes de igualdad. 4. El
  Instituto Andaluz de la Mujer asesorará a las consejerías y a las entidades locales que así lo
  soliciten en el proceso de elaboración de los planes. 5. Las consejerías y las entidades locales
  remitirán al Instituto Andaluz de la Mujer, para su conocimiento, los planes.`,
}

// El resto de la ley no habla del contenido del Plan de 2022; basta una muestra para la medida.
const OTROS_ARTICULOS = [
  { id: 'art6', content: 'Los poderes públicos incorporarán la evaluación del impacto de género...' },
  { id: 'art8', content: 'El Presupuesto de la Comunidad Autónoma será un elemento activo...' },
]

const clasifica = (enunciado, opcionCorrecta, extra = {}) =>
  clasificarInstrumentoDerivado({
    enunciado,
    opcionCorrecta,
    articuloVinculado: ART7,
    articulosDeLaLey: [ART7, ...OTROS_ARTICULOS],
    ...extra,
  })

describe('pregunta que pide el contenido de un instrumento derivado', () => {
  describe('LAS SEIS que el usuario cazó — el artículo no las responde', () => {
    it('los ejes básicos del Plan de 2022 no están en la ley', () => {
      const r = clasifica(
        '¿Cuáles son los ejes básicos de intervención tiene el Plan Estratégico para la Igualdad de Mujeres y Hombres en Andalucía de 2022?',
        'Gobernanza, cuidados y sostenibilidad de la vida, representación y poder, espacio productivo igualitario, sociedad libre de violencias sexistas.',
      )
      expect(r.hallazgo).toBe(true)
      // El artículo SÍ nombra el Plan: está probado que solo lo manda crear. Ése es el caso limpio.
      expect(r.banda).toBe('error')
      expect(r.motivo).toBe('articulo_solo_ordena_el_instrumento')
    })

    it('los objetivos estratégicos del Plan tampoco', () => {
      const r = clasifica(
        'Señale cuál no es uno de los objetivos estratégicos del Plan Estratégico para la Igualdad de Mujeres y Hombres en Andalucía de 2022:',
        'Contribuir a la erradicación de la violencia doméstica.',
      )
      // Es de negación («señale cuál NO es»). La primera versión la descartaba por eso, heredando la
      // guarda del detector hermano; se retiró al ver que ahí NO aplica (ver cabecera del núcleo).
      expect(r.hallazgo).toBe(true)
    })

    it('la vigencia del Plan (hasta 2028) no la fija la ley', () => {
      const r = clasifica(
        '¿Hasta cuándo tendrá vigencia el actual Plan Estratégico para la Igualdad de Mujeres y Hombres en Andalucía aprobado el 8 de marzo de 2022?',
        'Hasta el año 2028.',
      )
      expect(r.hallazgo).toBe(true)
      // Clave de dos palabras («Hasta el año 2028»): igual que la del IAM, no es medible por solape.
      // Las respuestas que son una FECHA o una CIFRA caen siempre aquí, y está bien que así sea: son
      // justo las que un artículo puede contener por casualidad sin responder la pregunta.
      expect(r.banda).toBe('warn')
      expect(r.motivo).toBe('clave_corta_recall_no_concluyente')
    })

    it('cuándo se aprobó el PRIMER plan es dato histórico, no legal', () => {
      const r = clasifica(
        'En Andalucía, el primer Plan estratégico para la igualdad de mujeres y hombres se aprobó:',
        'En 2010 para el periodo 2010-2013',
      )
      expect(r.hallazgo).toBe(true)
    })

    it('quién PUBLICA la memoria de evaluación: el artículo solo dice que el IAM asesora', () => {
      // Es la observación más fina del usuario: «En ningún caso aparece que el Instituto de la Mujer
      // lo publique, solo habla de Asesorar». Aquí el detector además apunta a una CLAVE sospechosa.
      const r = clasifica(
        '¿Quién publicará la memoria de la evaluación intermedia y final del Plan Estratégico para la Igualdad de Mujeres y Hombres en Andalucía de 2022?',
        'El Instituto Andaluz de la Mujer.',
      )
      expect(r.hallazgo).toBe(true)
      // NO sale por «nadie responde» sino por «no se puede medir»: las tres palabras de la clave
      // («Instituto Andaluz de la Mujer») sí están en el artículo, pero porque el IAM asesora, no
      // porque publique. Con una clave así el recall no decide, y el detector lo dice en vez de
      // dar el caso por bueno. Es el matiz que el usuario vio y la medida sola no.
      expect(r.motivo).toBe('clave_corta_recall_no_concluyente')
      expect(r.banda).toBe('warn')
    })

    it('la estructura 3R/3T del Informe de Impacto de Género no está en la ley', () => {
      const r = clasificarInstrumentoDerivado({
        enunciado: 'La estructura del Informe de Evaluación de Impacto de Género se articula entorno al:',
        opcionCorrecta:
          'Modelo de las 3R (realidad, representación y recursos-resultados) que se enriquece con la perspectiva de las 3T (tiempo pasado, presente y futuro).',
        articuloVinculado: OTROS_ARTICULOS[0],
        articulosDeLaLey: [ART7, ...OTROS_ARTICULOS],
      })
      expect(r.hallazgo).toBe(true)
      // El art. 6 nombra el informe → banda error igualmente.
      expect(['error', 'warn']).toContain(r.banda)
    })
  })

  describe('LAS TRES legítimas — el artículo SÍ las responde, no deben saltar', () => {
    it('quién aprueba el Plan: está literal en el apartado 1', () => {
      const r = clasifica(
        'Según el artículo 7, ¿quién aprueba el Plan Estratégico para la Igualdad de Mujeres y Hombres en Andalucía?',
        'El Consejo de Gobierno de la Junta de Andalucía.',
      )
      expect(r.hallazgo).toBe(false)
    })

    it('la periodicidad de cuatro años está literal en el apartado 1', () => {
      const r = clasifica(
        'Según el art. 7, el Plan Estratégico para la Igualdad de Mujeres y Hombres en Andalucía se aprobará:',
        'Con una periodicidad que no será inferior a cuatro años.',
      )
      expect(r.hallazgo).toBe(false)
    })

    it('los planes de las consejerías se evalúan anualmente: apartado 2', () => {
      const r = clasifica(
        'Los planes de igualdad de ámbito específico de cada Consejería serán evaluados:',
        'Anualmente, para incluir las medidas correctoras oportunas.',
      )
      expect(r.hallazgo).toBe(false)
    })
  })

  describe('las guardas que sostienen la precisión', () => {
    it('citar el instrumento NO basta: hace falta pedir algo propio de él', () => {
      expect(pideContenidoDeInstrumento('¿Quién aprueba el Plan Estratégico?', 'El Consejo de Gobierno')).toBe(false)
      expect(pideContenidoDeInstrumento('¿Cuáles son los ejes del Plan Estratégico de 2022?', 'Gobernanza')).toBe(true)
    })

    it('una pregunta sin instrumento derivado ni se mira', () => {
      const r = clasifica('¿Qué es la transversalidad de género?', 'La integración de la perspectiva de género.')
      expect(r.motivo).toBe('no_pide_instrumento')
    })

    it('CEDE al detector hermano si otro artículo de la ley sí responde', () => {
      // El discriminante que evita que dos detectores digan lo mismo con arreglos distintos.
      const vecinoQueResponde = {
        id: 'artX',
        content:
          'El Plan Estratégico de 2022 tendrá como ejes la gobernanza, los cuidados y sostenibilidad de la vida, la representación y poder, el espacio productivo igualitario y una sociedad libre de violencias sexistas.',
      }
      const r = clasificarInstrumentoDerivado({
        enunciado: '¿Cuáles son los ejes básicos del Plan Estratégico de 2022?',
        opcionCorrecta:
          'Gobernanza, cuidados y sostenibilidad de la vida, representación y poder, espacio productivo igualitario, sociedad libre de violencias sexistas.',
        articuloVinculado: ART7,
        articulosDeLaLey: [ART7, vecinoQueResponde],
      })
      expect(r.hallazgo).toBe(false)
      expect(r.motivo).toBe('lo_responde_un_vecino_cede_a_vinculo_vecino')
      expect(r.articuloQueResponde).toBe('artX')
    })

    it('una pregunta de examen OFICIAL no se toca: el hueco es del temario, no de la pregunta', () => {
      const r = clasifica(
        '¿Cuáles son los ejes básicos del Plan Estratégico de 2022?',
        'Gobernanza, cuidados y sostenibilidad de la vida.',
        { esOficial: true },
      )
      expect(r.hallazgo).toBe(false)
      expect(r.motivo).toBe('oficial_no_se_toca')
    })
  })

  // ── REGRESIÓN: las cuatro que se escaparon (01/08/2026) ──────────────────────────────────────
  //
  // El mismo usuario mandó otras cuatro impugnaciones cuatro horas después de estrenar el detector,
  // todas sobre el I Plan de Igualdad de la Junta 2023-2027 colgadas del art. 32. TRES se perdieron
  // por la exclusión de negación heredada. Son texto real de esas preguntas.
  describe('las cuatro que se escaparon por heredar la guarda de negación', () => {
    const ART32 = {
      id: 'art32',
      content:
        'Las Consejerías y sus entidades instrumentales aprobarán planes de igualdad en el empleo ' +
        'público, previa negociación con la representación legal del personal.',
    }
    const clasifica32 = (enunciado, opcionCorrecta) =>
      clasificarInstrumentoDerivado({
        enunciado,
        opcionCorrecta,
        articuloVinculado: ART32,
        articulosDeLaLey: [ART32],
      })

    it('«Señale la respuesta incorrecta» sobre el contenido del Plan', () => {
      const r = clasifica32(
        'Señale la respuesta incorrecta. Según establece el I Plan de Igualdad de la Administración General de la Junta de Andalucía 2023-2027:',
        'El Comité Directivo se reúne con carácter trimestral para aprobar las medidas correctoras.',
      )
      expect(r.hallazgo).toBe(true)
    })

    it('«no es función del Comité» — negativa y aun así inestudiable', () => {
      const r = clasifica32(
        'Según lo dispuesto en el I Plan de Igualdad de la Administración General de la Junta de Andalucía 2023-2027, no es función del Comité:',
        'Elaborar la memoria anual de contratación pública de la Consejería competente.',
      )
      expect(r.hallazgo).toBe(true)
    })

    it('«no es uno de los principios básicos» del Plan', () => {
      const r = clasifica32(
        'Señale cuál de los siguientes no es uno de los principios básicos en los que se fundamentan todas las medidas que conforman el I Plan de Igualdad 2023-2027:',
        'La primacía del criterio de antigüedad sobre cualquier otro mérito.',
      )
      expect(r.hallazgo).toBe(true)
    })
  })
})

// ── REGRESIÓN: el solape de VOCABULARIO no es responder (01/08/2026) ──────────────────────────
//
// La cuarta de esa tanda seguía escapándose con la exclusión de negación ya retirada: el art. 32 se
// titula «Planes de igualdad en el empleo en la Administración pública», comparte vocabulario con la
// clave y el recall subía a 0,63 sin que el artículo dijera una palabra del I Plan 2023-2027.
describe('un artículo que no menciona el instrumento fechado no lo responde', () => {
  const ART32 = {
    id: 'art32',
    content:
      'Las Consejerías y sus entidades instrumentales de la Administración General de la Junta de ' +
      'Andalucía aprobarán planes de igualdad en el empleo público, previa negociación con la ' +
      'representación legal del personal, y velarán por la igualdad de mujeres y hombres.',
  }

  it('recall alto pero el artículo no habla de ESE Plan → sigue siendo hallazgo', () => {
    const r = clasificarInstrumentoDerivado({
      enunciado:
        'Según establece el I Plan de Igualdad de la Administración General de la Junta de Andalucía 2023-2027, es función del Comité Directivo:',
      opcionCorrecta:
        'Marcar las prioridades de la Administración General de la Junta de Andalucía en materia de igualdad.',
      articuloVinculado: ART32,
      articulosDeLaLey: [ART32],
    })
    expect(r.hallazgo).toBe(true)
    expect(r.motivo).toBe('solape_de_vocabulario_no_menciona_el_instrumento')
  })

  it('si el artículo SÍ trae el año, se respeta el recall y no se marca', () => {
    const conAnio = {
      id: 'x',
      content:
        'El I Plan de Igualdad 2023-2027 fija como función del Comité Directivo marcar las ' +
        'prioridades de la Administración General de la Junta de Andalucía en materia de igualdad.',
    }
    const r = clasificarInstrumentoDerivado({
      enunciado: 'Según el I Plan de Igualdad 2023-2027, es función del Comité Directivo:',
      opcionCorrecta:
        'Marcar las prioridades de la Administración General de la Junta de Andalucía en materia de igualdad.',
      articuloVinculado: conAnio,
      articulosDeLaLey: [conAnio],
    })
    expect(r.hallazgo).toBe(false)
  })

  it('sin fecha en el enunciado NO se opina: no se puede discriminar', () => {
    const { articuloHablaDelMismoInstrumento } = require('../../lib/health/instrumentoDerivado.cjs')
    expect(articuloHablaDelMismoInstrumento('¿Quién aprueba el Plan de Igualdad?', 'texto cualquiera')).toBe(true)
  })
})

// ── REGRESIÓN: la Estrategia nombrada por su MATERIA (01/08/2026, segunda tanda) ────────────────
//
// «I Estrategia de Conciliación en Andalucía 2022-2026» colgada del art. 39, que habla de centros
// infantiles en los centros de trabajo. La lista de instrumentos solo cubría `estrategia
// (nacional|andaluza|estatal|espanola)`, así que un instrumento nombrado por su materia era
// invisible. Tercera vez que una lista cerrada se queda corta.
describe('instrumentos nombrados por su MATERIA, no por su ámbito', () => {
  const ART39 = {
    id: 'art39',
    content:
      'La Administración de la Junta de Andalucía impulsará la creación de centros infantiles en ' +
      'los centros de trabajo, para facilitar la conciliación de la vida laboral y familiar de las ' +
      'empleadas y empleados públicos.',
  }

  it('«el salario emocional» de la I Estrategia de Conciliación', () => {
    const r = clasificarInstrumentoDerivado({
      enunciado:
        'Según la I Estrategia de Conciliación en Andalucía 2022-2026, ¿cuál es una de las principales acciones más efectivas para la conciliación?',
      opcionCorrecta: 'El salario emocional.',
      articuloVinculado: ART39,
      articulosDeLaLey: [ART39],
    })
    expect(r.hallazgo).toBe(true)
  })

  it('«la responsabilidad de cuidado» de la misma Estrategia', () => {
    const r = clasificarInstrumentoDerivado({
      enunciado:
        'La I Estrategia de Conciliación en Andalucía 2022-2026 dispone que, para casi la mitad de las mujeres fuera del mercado laboral, el principal motivo es:',
      opcionCorrecta: 'La responsabilidad de cuidado.',
      articuloVinculado: ART39,
      articulosDeLaLey: [ART39],
    })
    expect(r.hallazgo).toBe(true)
  })
})

// ── REGRESIÓN: la cita de la NORMA no fecha al instrumento (01/08/2026) ─────────────────────────
//
// La guarda de instrumento fechado leía «Ley 12/2007, de 26 de noviembre» como si el instrumento
// fuera de 2007, y el cuerpo de un artículo no repite la fecha de su propia ley. Resultado: marcaba
// como sospechosas preguntas VERIFICADAS A MANO como legítimas ese mismo día.
describe('citar la norma por su nombre completo no convierte la pregunta en sospechosa', () => {
  const ART7 = {
    id: 'art7',
    content:
      'El Consejo de Gobierno de la Junta de Andalucía formulará y aprobará, con una periodicidad ' +
      'que no será inferior a cuatro años, un Plan Estratégico para la Igualdad de Mujeres y ' +
      'Hombres en Andalucía, a propuesta de la Consejería competente en materia de igualdad.',
  }

  it('«¿quién aprueba el Plan?» citando «Ley 12/2007, de 26 de noviembre» NO es hallazgo', () => {
    const r = clasificarInstrumentoDerivado({
      enunciado:
        'Según el artículo 7 de la Ley 12/2007, de 26 de noviembre, para la promoción de la igualdad de género en Andalucía, ¿quién aprueba el Plan Estratégico para la Igualdad de Mujeres y Hombres en Andalucía?',
      opcionCorrecta: 'El Consejo de Gobierno de la Junta de Andalucía.',
      articuloVinculado: ART7,
      articulosDeLaLey: [ART7],
    })
    expect(r.hallazgo).toBe(false)
  })

  it('la periodicidad de cuatro años, citando la ley entera, tampoco', () => {
    const r = clasificarInstrumentoDerivado({
      enunciado:
        'Según el art. 7 de la Ley 12/2007, de 26 de noviembre, el Plan Estratégico para la Igualdad se aprobará:',
      opcionCorrecta: 'Con una periodicidad que no será inferior a cuatro años.',
      articuloVinculado: ART7,
      articulosDeLaLey: [ART7],
    })
    expect(r.hallazgo).toBe(false)
  })
})
