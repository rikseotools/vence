const {
  aEntero,
  normalizarNumerosDelTexto,
  extraerAfirmaciones,
  verificarAfirmaciones,
  detectarContradicciones,
} = require('@/lib/convocatoria/landingClaims.cjs')

// Fragmento REAL de la convocatoria de Policía Nacional (BOE-A-2026-15055), que es el caso que
// motivó el detector. Los boletines escriben las cifras en letra: si el núcleo no las normaliza,
// TODA cifra correcta saldría como "sin respaldo" y el detector sería inservible.
const BOE_REAL = `
Se convocan 2.704 plazas de alumnos/as de la Escuela Nacional de Policía de la División de
Formación y Perfeccionamiento, aspirantes a ingreso en la Escala Básica, categoría de policía.
Del total de 2.704 plazas autorizadas se reservan 541 para militares profesionales de tropa y
marinería. Las 2.163 plazas restantes serán cubiertas por el procedimiento de oposición libre.
6.1.1 Primera prueba (de conocimientos). La prueba consistirá en la contestación por escrito en
cincuenta minutos a un cuestionario de cien preguntas, con un enunciado y tres alternativas de
respuestas de las que solo una es verdadera, relacionadas con el temario que figura como anexo I.
El plazo de presentación de solicitudes será de quince días hábiles. Tema 44. La Seguridad en la
Conducción. Tema 45. Prevención de Riesgos Laborales en Seguridad Vial.
`.repeat(3) // longitud > 600 chars, como exige el núcleo para opinar

describe('aEntero — formatos de cifra que usan los boletines', () => {
  it('acepta punto de millar, espacio fino y dígitos pelados', () => {
    expect(aEntero('2.704')).toBe(2704)
    expect(aEntero('2 704')).toBe(2704)
    expect(aEntero('2704')).toBe(2704)
    expect(aEntero('45')).toBe(45)
  })
  it('rechaza lo que no es un entero', () => {
    expect(aEntero('')).toBeNull()
    expect(aEntero(null)).toBeNull()
    expect(aEntero('cien')).toBeNull()
    expect(aEntero('12,5')).toBeNull()
  })
})

describe('normalizarNumerosDelTexto — cifras en letra → dígitos', () => {
  it('convierte las formas que usa el BOE', () => {
    const t = normalizarNumerosDelTexto('un cuestionario de cien preguntas en cincuenta minutos')
    expect(t).toMatch(/100\s+preguntas/)
    expect(t).toMatch(/50\s+minutos/)
  })
  it('convierte millares (plazas escritas en letra)', () => {
    expect(normalizarNumerosDelTexto('dos mil setecientas cuatro plazas')).toMatch(/2704\s+plazas/)
  })
  it('no destroza el texto que no es número', () => {
    const t = 'La Escala Básica del Cuerpo Nacional de Policía'
    expect(normalizarNumerosDelTexto(t)).toContain('Escala Básica')
  })
  it('entrada vacía no revienta', () => {
    expect(normalizarNumerosDelTexto(null)).toBe('')
    expect(normalizarNumerosDelTexto('')).toBe('')
  })
})

describe('extraerAfirmaciones — qué números afirma la página', () => {
  it('saca los cuatro conceptos verificables con su superficie', () => {
    const af = extraerAfirmaciones([
      { superficie: 'hero', texto: '2.704 plazas · 45 temas · 100 preguntas en 50 minutos' },
    ])
    const pares = af.map((a) => `${a.tipo}=${a.valor}`).sort()
    expect(pares).toEqual(['minutos=50', 'plazas=2704', 'preguntas=100', 'temas=45'])
    expect(af.every((a) => a.superficie === 'hero')).toBe(true)
  })

  it('NO extrae el salario ni cifras sin concepto (serían ruido garantizado)', () => {
    const af = extraerAfirmaciones([
      { superficie: 'faq', texto: 'Entre 22.000 y 35.000 euros brutos anuales (~1.841€ netos/mes)' },
    ])
    expect(af).toEqual([])
  })

  it('conserva el fragmento para que el hallazgo sea accionable', () => {
    const af = extraerAfirmaciones([{ superficie: 'faq', texto: 'psicotécnicos (80 preguntas, 60 min)' }])
    expect(af[0].fragmento).toContain('80 preguntas')
  })
})

describe('verificarAfirmaciones — respaldo en el documento oficial', () => {
  const sup = [
    { superficie: 'hero', texto: '2.704 plazas · 45 temas del programa oficial · 100 preguntas en 50 minutos' },
    { superficie: 'faq_examen', texto: 'psicotécnicos (80 preguntas, 60 minutos)' },
    { superficie: 'caja', texto: '46 temas' },
  ]

  it('CAZA el caso real: la cifra inventada de psicotécnicos', () => {
    const { sinRespaldo, sinDocumento } = verificarAfirmaciones(extraerAfirmaciones(sup), BOE_REAL)
    expect(sinDocumento).toBe(false)
    expect(sinRespaldo.map((a) => `${a.tipo}=${a.valor}`)).toContain('preguntas=80')
  })

  it('CAZA que se presente como OFICIAL un número de temas que el programa no tiene', () => {
    const { sinRespaldo } = verificarAfirmaciones(
      extraerAfirmaciones([{ superficie: 'hero', texto: '46 temas del programa oficial' }]),
      BOE_REAL,
    )
    expect(sinRespaldo.map((a) => `${a.tipo}=${a.valor}`)).toEqual(['temas_programa=46'])
  })

  it('NO contrasta contra el documento los temas que SERVIMOS (son dato nuestro, no del boletín)', () => {
    // Servir un bloque de apoyo además del programa oficial es legítimo (Policía Nacional: 45 del
    // Anexo I + inglés para el requisito A2). Verificarlo contra el BOE marcaría para siempre una
    // landing correcta, que es como se construye una bandeja que nadie mira.
    const { sinRespaldo, respaldadas } = verificarAfirmaciones(
      extraerAfirmaciones([{ superficie: 'caja', texto: '46 temas' }]),
      BOE_REAL,
    )
    expect(sinRespaldo).toEqual([])
    expect(respaldadas).toEqual([])
  })

  it('NO marca las cifras correctas, aunque el boletín las escriba en letra', () => {
    const { respaldadas } = verificarAfirmaciones(extraerAfirmaciones(sup), BOE_REAL)
    const ok = respaldadas.map((a) => `${a.tipo}=${a.valor}`)
    expect(ok).toEqual(
      expect.arrayContaining(['plazas=2704', 'preguntas=100', 'minutos=50', 'temas_programa=45']),
    )
  })

  it('el respaldo es DEL CONCEPTO, no del documento entero', () => {
    // Sin ventana de contexto, cualquier "80" suelto (un artículo, un porcentaje) valdría como
    // prueba y el detector no cazaría nada. Este es el fallo que tuvo la primera versión.
    const doc = BOE_REAL + ' El artículo 80 del Reglamento y el 60 por ciento de la puntuación. '
    const { sinRespaldo } = verificarAfirmaciones(
      extraerAfirmaciones([{ superficie: 'faq', texto: '80 preguntas' }]),
      doc,
    )
    expect(sinRespaldo.map((a) => a.valor)).toEqual([80])
  })

  it('sin documento (o con texto insuficiente) NO se opina', () => {
    const af = extraerAfirmaciones(sup)
    expect(verificarAfirmaciones(af, null).sinDocumento).toBe(true)
    expect(verificarAfirmaciones(af, 'corto').sinDocumento).toBe(true)
    expect(verificarAfirmaciones(af, null).sinRespaldo).toEqual([])
  })

  it('no confunde 45 con 450 ni con 2.045 (frontera de dígito)', () => {
    const doc = 'Se convocan 450 plazas. '.repeat(60)
    const { sinRespaldo } = verificarAfirmaciones(
      extraerAfirmaciones([{ superficie: 'hero', texto: '45 plazas' }]),
      doc,
    )
    expect(sinRespaldo.map((a) => a.valor)).toEqual([45])
  })
})

// [T-202] Este núcleo es la TERCERA implementación de «¿está la cifra en el documento?», y resultó
// ser la que llevaba razón: exigía frontera de dígito desde el 26/07 mientras el núcleo del
// detector de plazas se conformaba con un `includes`. Ahora los tres se prueban contra el MISMO
// fixture, cada uno en la columna que le toca. Un caso nuevo de calibración va al fixture.
describe('casos compartidos con cifraEnTexto y con el mirror del backend', () => {
  const { CASOS } = require('../../fixtures/cifraEnDocumento.cjs')
  const { CONCEPTOS, numerosDelConcepto } = require('@/lib/convocatoria/landingClaims.cjs')
  const RE_PLAZAS = CONCEPTOS.find((c) => c.tipo === 'plazas').re
  const aplican = CASOS.filter((c) => c.laLlamaPlazas !== null)

  it.each(aplican.map((c) => [c.nombre, c]))('¿el documento la presenta como plazas? — %s', (_n, c) => {
    const presentadas = numerosDelConcepto(normalizarNumerosDelTexto(c.texto), RE_PLAZAS)
    expect(presentadas.includes(c.cifra)).toBe(c.laLlamaPlazas)
  })

  it('hay casos donde el documento PRUEBA la cifra sin llamarla plazas (por eso no sirve de regla)', () => {
    // Si esta lista se quedara vacía, alguien habría igualado dos reglas que miden cosas distintas:
    // «la cifra está» (lo que puede afirmar el detector) y «la llama plazas» (más exigente, y que
    // simulado sobre las 118 convocatorias vivas producía 56 hallazgos casi todos falsos).
    // [T-224] amplió el patrón y sacó de aquí el paréntesis (1704) y la forma invertida (1747);
    // solo queda la «y» que no une un numeral compuesto («…laboral y tres plazas»), deuda conocida
    // y deliberadamente sin tocar (ver el caso en el fixture).
    const divergen = CASOS.filter((c) => c.apareceLaCifra && c.laLlamaPlazas === false)
    // `.sort()` a secas ordena como TEXTO: con más de un elemento el orden mentiría sobre qué
    // cambió. Con uno solo no hace falta, pero se deja explícito para el día que crezca.
    expect(divergen.map((c) => c.cifra).sort((a, b) => a - b)).toEqual([3])
  })
})

describe('cifras DERIVADAS — el boletín reparte, no escribe el total (T-147, paso 3)', () => {
  // Los tres casos son landings REALES que salían "sin respaldo" siendo correctas, y que por eso
  // impedían subir el detector al barrido nocturno.

  test('subalterno-parlamento-andalucia: "153 preguntas" = 65 psicotécnicas + 65 del temario + 23 de reserva', () => {
    const doc = 'El ejercicio constará de 65 preguntas psicotécnicas y 65 preguntas sobre el temario, más 23 preguntas de reserva. '.repeat(6)
    const r = verificarAfirmaciones(
      extraerAfirmaciones([{ superficie: 'tarjeta_hero', texto: '153 preguntas en el examen' }]), doc)
    expect(r.sinRespaldo).toHaveLength(0)
    expect(r.derivadas).toHaveLength(1)
    expect(r.derivadas[0].derivacion).toMatchObject({ como: 'suma' })
    expect(r.derivadas[0].derivacion.detalle).toMatch(/65 \+ 65 \+ 23 = 153/)
  })

  test('oficial-de-gestion: "105 preguntas" = 100 del cuestionario + 5 de reserva', () => {
    const doc = 'El cuestionario tendrá 100 preguntas y 5 preguntas de reserva que solo se valorarán en caso de anulación. '.repeat(6)
    const r = verificarAfirmaciones(
      extraerAfirmaciones([{ superficie: 'tarjeta_hero', texto: '105 preguntas' }]), doc)
    expect(r.derivadas[0].derivacion.detalle).toMatch(/100 \+ 5 = 105/)
  })

  test('la derivación NO respalda un número que no sale de ninguna suma explicable', () => {
    // ≥600 caracteres: por debajo, el núcleo no opina (guarda del detector de fuentes ciegas).
    const doc = 'El cuestionario tendrá 100 preguntas y 5 preguntas de reserva que solo se valorarán en caso de anulación. '.repeat(6)
    const r = verificarAfirmaciones(
      extraerAfirmaciones([{ superficie: 'tarjeta_hero', texto: '80 preguntas' }]), doc)
    expect(r.derivadas).toHaveLength(0)
    expect(r.sinRespaldo).toHaveLength(1)   // el caso raíz de policia-nacional sigue cazándose
  })

  test('máximo 3 sumandos: con más, cualquier cifra "cuadraría"', () => {
    const doc = 'Habrá 10 preguntas, 20 preguntas, 30 preguntas, 40 preguntas y 50 preguntas repartidas. '.repeat(6)
    const r = verificarAfirmaciones(
      extraerAfirmaciones([{ superficie: 'tarjeta_hero', texto: '150 preguntas' }]), doc)
    // 10+20+30+40+50 = 150, pero eso es "encontrar una combinación", no una derivación explicable.
    expect(r.derivadas).toHaveLength(0)
  })

  test('los sumandos salen de las ventanas del CONCEPTO, no del documento entero', () => {
    // 90 y 63 están en el documento pero hablando de artículos y plazos, no de preguntas.
    const doc = 'Según el artículo 90 y en el plazo de 63 días. '.repeat(20) + 'El ejercicio tendrá 40 preguntas. '.repeat(6)
    const r = verificarAfirmaciones(
      extraerAfirmaciones([{ superficie: 'tarjeta_hero', texto: '153 preguntas' }]), doc)
    expect(r.derivadas).toHaveLength(0)
    expect(r.sinRespaldo).toHaveLength(1)
  })
})

describe('detectarContradicciones — la página contra sí misma', () => {
  it('CAZA dos superficies de RESUMEN que dan distinto número del mismo concepto', () => {
    const c = detectarContradicciones(
      extraerAfirmaciones([
        { superficie: 'tarjeta_hero', texto: '45 temas del programa oficial' },
        { superficie: 'caja_convocatoria', texto: '46 temas del programa oficial' },
      ]),
    )
    expect(c).toHaveLength(1)
    expect(c[0].tipo).toBe('temas_programa')
    expect(c[0].valores).toEqual([45, 46])
    expect(c[0].detalle).toContain('caja_convocatoria')
  })

  it('NO compara FAQ contra FAQ: enumeran subconjuntos, no totales', () => {
    // Medido sobre las 123 landings activas: comparar FAQs entre sí producía 89 "contradicciones",
    // casi todas legítimas ("10 preguntas de reserva" frente a "60 del test"). El detector solo
    // habla de superficies de resumen.
    expect(
      detectarContradicciones(
        extraerAfirmaciones([
          { superficie: 'faq', texto: 'El test tiene 60 preguntas' },
          { superficie: 'faq', texto: 'Hay 10 preguntas de reserva' },
        ]),
      ),
    ).toEqual([])
  })

  it('NO llama contradicción a "45 oficiales" frente a "46 servidos" (caso legítimo)', () => {
    // Es la tensión real que destapó el caso de Policía Nacional: `temas_card` exige que la
    // tarjeta cuadre con los topics SERVIDOS y el programa oficial dice otra cosa. Los dos tienen
    // razón porque hablan de conceptos distintos; el detector tiene que saberlo o pelearse con el
    // otro detector para siempre.
    expect(
      detectarContradicciones(
        extraerAfirmaciones([
          { superficie: 'hero', texto: '45 temas del programa oficial' },
          { superficie: 'temas_count', texto: '46 temas' },
        ]),
      ),
    ).toEqual([])
  })

  it('no inventa contradicción cuando todas las superficies coinciden', () => {
    expect(
      detectarContradicciones(
        extraerAfirmaciones([
          { superficie: 'hero', texto: '45 temas' },
          { superficie: 'faq', texto: '45 temas' },
        ]),
      ),
    ).toEqual([])
  })

  it('no cruza conceptos distintos (45 temas y 100 preguntas no se contradicen)', () => {
    expect(
      detectarContradicciones(
        extraerAfirmaciones([{ superficie: 'hero', texto: '45 temas y 100 preguntas' }]),
      ),
    ).toEqual([])
  })

  it('NO llama contradicción a "plazas totales" frente a "plazas turno libre" (caso Navarra)', () => {
    // Falso positivo REAL cazado en la simulación bank-wide: administrativo-navarra tiene dos
    // tarjetas correctas —585 totales y 264 turno libre— y el detector las marcaba como error.
    expect(
      detectarContradicciones(
        extraerAfirmaciones([
          { superficie: 'tarjeta_hero', texto: '585 Plazas totales' },
          { superficie: 'tarjeta_hero', texto: '264 Plazas turno libre' },
        ]),
      ),
    ).toEqual([])
  })

  it('SÍ marca dos cifras distintas del MISMO matiz', () => {
    const c = detectarContradicciones(
      extraerAfirmaciones([
        { superficie: 'tarjeta_hero', texto: '585 plazas totales' },
        { superficie: 'caja_convocatoria', texto: '600 plazas totales' },
      ]),
    )
    expect(c).toHaveLength(1)
    expect(c[0].matiz).toBe('total')
    expect(c[0].detalle).toMatch(/585.*600|600.*585/)
  })

  it('el matiz también separa preguntas de examen de las de reserva', () => {
    expect(
      detectarContradicciones(
        extraerAfirmaciones([
          { superficie: 'tarjeta_hero', texto: '100 preguntas' },
          { superficie: 'caja_convocatoria', texto: '5 preguntas de reserva' },
        ]),
      ),
    ).toEqual([])
  })

  it('entrada vacía no revienta', () => {
    expect(detectarContradicciones(null)).toEqual([])
    expect(detectarContradicciones([])).toEqual([])
  })
})
