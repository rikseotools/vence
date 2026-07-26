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

// --- El enunciado, que antes no se leía (26/07/2026) ---
// El módulo documentaba esta limitación como de diseño, con la medida hecha: 7 avisos
// de 67 preguntas y 5 eran falsos positivos de ese tipo. El lote
// `gen_atc_t225_2026-07-26_s26c` lo confirmó a lo grande: 6 avisos de 16, TODOS el
// mismo patrón inocuo — la opción completa la frase legal y la continuación es el
// predicado que ya está en la pregunta.
describe('analizarCitaVsOpcion — la cola que ya está en el enunciado', () => {
  // Caso real: art. 21 Ley 19/1991 (batch gen_atc_t225_2026-07-26_s26c).
  const EXP_ART21 = [
    '**Por qué B es correcta:** el artículo 21 aplica la regla con independencia de la duración.',
    '',
    '> «Las concesiones administrativas para la explotación de servicios o bienes de dominio o titularidad pública, **cualquiera que sea su duración**, se valorarán con arreglo a los criterios señalados en el Impuesto sobre Transmisiones Patrimoniales y Actos Jurídicos Documentados.»',
    '',
    '**Por qué las demás son incorrectas:** x',
  ].join('\n')
  const OK_ART21 = 'cualquiera que sea su duración'
  const ENUN_ART21 =
    'Según el artículo 21 de la Ley 19/1991, las concesiones administrativas para la explotación de servicios o bienes de dominio o titularidad pública se valoran con arreglo a los criterios del Impuesto sobre Transmisiones Patrimoniales y Actos Jurídicos Documentados:'

  it('sin enunciado avisa (comportamiento anterior, intacto)', () => {
    expect(analizarCitaVsOpcion(EXP_ART21, OK_ART21).aviso).toBe(true)
  })

  it('con el enunciado NO avisa y lo deja trazado', () => {
    const r = analizarCitaVsOpcion(EXP_ART21, OK_ART21, ENUN_ART21)
    expect(r.aviso).toBe(false)
    expect(r.enElEnunciado).toBe(true)
    expect(r.cola).toBeTruthy() // se conserva para poder auditar la decisión
  })

  // INVARIANTE: los dos defectos REALES que este check cazó deben seguir cazándose
  // aunque se pase el enunciado. Si esto se pone verde, el cambio abrió un agujero.
  it('SIGUE avisando del defecto real del art. 46.3 RDL 1/1993 (T224)', () => {
    // La clave recogía solo el primer inciso; el segundo la condiciona y NO estaba
    // en el enunciado original.
    const exp = [
      '**Por qué A es correcta:** el artículo 46.3 toma como base el valor declarado.',
      '',
      '> «Cuando el valor declarado por los interesados fuese superior al resultante de la comprobación, **aquél tendrá la consideración de base imponible**. Si el valor resultante de la comprobación o el valor declarado resultase inferior al precio o contraprestación pactada, se tomará esta última magnitud como base imponible.»',
      '',
      '**Por qué las demás son incorrectas:** x',
    ].join('\n')
    // OJO: la cola relevante va tras un punto, así que lo que aquí se mide es la
    // continuación DENTRO de la frase. Se usa la opción sin el cierre de frase.
    const enunciado =
      'Según el artículo 46.3 del Real Decreto Legislativo 1/1993, cuando el valor declarado por los interesados fuese superior al resultante de la comprobación:'
    const r = analizarCitaVsOpcion(exp, 'aquél tendrá', enunciado)
    expect(r.aviso).toBe(true)
    expect(r.cola).toMatch(/consideración de base imponible/)
  })

  it('SIGUE avisando del defecto real del art. 2.2 RDL 1/1993 (T223)', () => {
    // La opción paraba en "hasta que ésta se cumpla" y la ley añade un deber
    // registral sobre la MISMA liquidación, que el enunciado no mencionaba.
    const exp = [
      '**Por qué A es correcta:** el artículo 2.2 aplaza la liquidación.',
      '',
      '> «Si fuere suspensiva **no se liquidará el impuesto hasta que ésta se cumpla**, haciéndose constar el aplazamiento de la liquidación en la inscripción de bienes en el registro público correspondiente.»',
      '',
      '**Por qué las demás son incorrectas:** x',
    ].join('\n')
    const enunciado = 'Conforme al artículo 2.2 del Real Decreto Legislativo 1/1993, cuando en un acto o contrato medie una condición SUSPENSIVA:'
    const r = analizarCitaVsOpcion(exp, 'no se liquidará el impuesto hasta que ésta se cumpla', enunciado)
    expect(r.aviso).toBe(true)
    expect(r.cola).toMatch(/haciéndose constar el aplazamiento/)
  })

  it('un enunciado que NO contiene la cola sigue avisando', () => {
    expect(analizarCitaVsOpcion(EXP_ART21, OK_ART21, 'Según el artículo 21, las concesiones administrativas:').aviso).toBe(true)
  })
})
