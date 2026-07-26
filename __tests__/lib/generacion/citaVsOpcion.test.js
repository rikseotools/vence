const { analizarCitaVsOpcion, citaDe } = require('../../../lib/generacion/citaVsOpcion')

const exp = (cita, resto = '**Por qué A es correcta:** razón.') => `> **Art. X**\n> "${cita}"\n\n${resto}`

// Los TRES defectos reales de la campaña T-115 (26/07/2026), cada uno cazado por
// un auditor LLM distinto y ninguno por los checks mecánicos que ya existían.
describe('analizarCitaVsOpcion — casos reales de correcta parcial', () => {
  it('art. 28.2 LCSP: la opción para antes de la cláusula de la pyme', () => {
    const cita =
      'Las entidades del sector público velarán por la eficiencia y el mantenimiento de los términos acordados ' +
      'en la ejecución de los procesos de contratación pública, favorecerán la agilización de trámites, valorarán ' +
      'la incorporación de consideraciones sociales, medioambientales y de innovación como aspectos positivos en ' +
      'los procedimientos de contratación pública y promoverán la participación de la pequeña y mediana empresa y ' +
      'el acceso sin coste a la información, en los términos previstos en la presente Ley.'
    const opcion =
      'favorecerán la agilización de trámites, valorarán la incorporación de consideraciones sociales, ' +
      'medioambientales y de innovación como aspectos positivos en los procedimientos de contratación pública'
    const r = analizarCitaVsOpcion(exp(cita), opcion)
    expect(r.aviso).toBe(true)
    expect(r.cola).toMatch(/pequeña y mediana empresa/)
  })

  it('art. 31.1 a) LCSP: la opción deja fuera el acuerdo de encargo', () => {
    const cita =
      'Mediante sistemas de cooperación vertical consistentes en el uso de medios propios personificados en el ' +
      'sentido y con los límites establecidos en el artículo 32 para los poderes adjudicadores, y en el artículo 33 ' +
      'para los entes del sector público que no tengan la consideración de poder adjudicador, en el ejercicio de su ' +
      'potestad de auto organización, mediante el oportuno acuerdo de encargo.'
    const opcion =
      'Mediante sistemas de cooperación vertical consistentes en el uso de medios propios personificados en el ' +
      'sentido y con los límites establecidos en el artículo 32 para los poderes adjudicadores, y en el artículo 33 ' +
      'para los entes del sector público que no tengan la consideración de poder adjudicador'
    const r = analizarCitaVsOpcion(exp(cita), opcion)
    expect(r.aviso).toBe(true)
    expect(r.cola).toMatch(/acuerdo de encargo/)
  })

  it('art. 149.3 LCSP: la opción omite el inciso de las uniones temporales', () => {
    const cita =
      'Cuando hubieren presentado ofertas empresas que pertenezcan a un mismo grupo, se tomará únicamente, para ' +
      'aplicar el régimen de identificación de las ofertas incursas en presunción de anormalidad, aquella que fuere ' +
      'más baja, y ello con independencia de que presenten su oferta en solitario o conjuntamente con otra empresa ' +
      'o empresas ajenas al grupo y con las cuales concurran en unión temporal.'
    const opcion =
      'se tomará únicamente, para aplicar el régimen de identificación de las ofertas incursas en presunción de ' +
      'anormalidad, aquella que fuere más baja'
    expect(analizarCitaVsOpcion(exp(cita), opcion).aviso).toBe(true)
  })
})

describe('analizarCitaVsOpcion — lo que NO debe marcar', () => {
  it('cita y opción abarcan lo mismo', () => {
    const cita = 'Los Tribunales ejercen el control de legalidad de los acuerdos y actos de las entidades locales.'
    const opcion = 'Los Tribunales ejercen el control de legalidad de los acuerdos y actos de las entidades locales'
    expect(analizarCitaVsOpcion(exp(cita), opcion).aviso).toBe(false)
  })

  it('la cola es una remisión corta: condensación válida (§2.2), no defecto', () => {
    const cita = 'Los órganos de contratación rechazarán las ofertas anormalmente bajas, en aplicación del artículo 201.'
    const opcion = 'Los órganos de contratación rechazarán las ofertas anormalmente bajas'
    expect(analizarCitaVsOpcion(exp(cita), opcion).aviso).toBe(false)
  })

  it('la cita sigue con OTRA letra del listado, no con una cola de la misma regla', () => {
    const cita = 'a) El establecimiento de medios adecuados para la evaluación y control de las actuaciones sanitarias b) La implantación de sistemas de información adecuados que permitan la elaboración de mapas'
    const opcion = 'El establecimiento de medios adecuados para la evaluación y control de las actuaciones sanitarias'
    expect(analizarCitaVsOpcion(exp(cita), opcion).aviso).toBe(false)
  })

  it('la cita no reproduce la opción (pregunta intruso): nada que comparar', () => {
    expect(analizarCitaVsOpcion(exp('texto de la ley'), 'opción inventada que no está en la ley').aviso).toBe(false)
  })

  it('la frase termina justo donde termina la opción, aunque la cita continúe en otra', () => {
    const cita = 'La denominación podrá ser en castellano o en ambas. La inscripción no constituirá prueba de residencia legal.'
    const opcion = 'La denominación podrá ser en castellano o en ambas'
    expect(analizarCitaVsOpcion(exp(cita), opcion).aviso).toBe(false)
  })

  it('tolera explicaciones sin blockquote y entradas vacías', () => {
    expect(analizarCitaVsOpcion('**Por qué A es correcta:** sin cita.', 'algo').aviso).toBe(false)
    expect(analizarCitaVsOpcion('', '').aviso).toBe(false)
    expect(analizarCitaVsOpcion(undefined, undefined).aviso).toBe(false)
  })
})

describe('citaDe', () => {
  it('extrae solo el blockquote y limpia el marcado', () => {
    expect(citaDe('> **Art. 5**\n> "texto legal"\n\n**Por qué A:** razón')).toBe('art. 5 "texto legal"')
  })
})
