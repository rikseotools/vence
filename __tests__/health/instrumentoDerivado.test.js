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
      // OJO: ésta es de negación («señale cuál NO es»), y ahí el desajuste es por diseño. Se excluye
      // aunque el fondo sea un instrumento derivado: la exclusión pesa más que la sospecha.
      expect(r.hallazgo).toBe(false)
      expect(r.motivo).toBe('negacion')
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
})
