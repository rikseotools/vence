/**
 * @jest-environment node
 */
// [T-678] La puerta que impide decirle a alguien que su problema está arreglado cuando el arreglo
// está en `main` pero NO en producción. Nace del mensaje REAL que se le envió a Esther
// (feedback `e523eabc`) con el arreglo sin desplegar.
const { afirmaArreglo, puedeAfirmarse } = require('../../lib/impugnaciones/promesaDeArreglo.cjs')

// El ancla: el texto exacto que se envió. Si algún día deja de dispararla, el patrón se ha roto.
const MENSAJE_A_ESTHER =
  'Hola Esther,\n\nTienes razón en las dos cosas: el examen no llegaba a enviarse y el panel de ' +
  'progreso te salía vacío. Las dos venían del mismo fallo y ya está corregido.\n\nActualiza la ' +
  'página y vuelve a probar, que no debería volver a pasarte.'

describe('afirmaArreglo — qué cuenta como PROMESA', () => {
  it('el mensaje real que motivó la puerta la dispara', () => {
    const r = afirmaArreglo(MENSAJE_A_ESTHER)
    expect(r.afirma).toBe(true)
    expect(r.frase.toLowerCase()).toContain('ya está corregid')
  })

  it.each([
    'Ya está corregida la pregunta.',
    'Hemos corregido el enunciado.',
    'Ya está resuelto, gracias por avisar.',
    'Ya funciona con normalidad.',
    'No debería volver a salirte.',
    'Ya está disponible en tu temario.',
  ])('promete: %s', (t) => {
    expect(afirmaArreglo(t).afirma).toBe(true)
  })

  it.each([
    // Lo HONESTO cuando aún no está vivo: describe el futuro, no afirma el presente. Si esto se
    // marcara, la puerta no dejaría escribir la única frase correcta y se rodearía siempre.
    'Lo tenemos identificado y corregido, y estará disponible en las próximas horas.',
    'Estamos corrigiéndolo y te avisamos en cuanto esté.',
    'Lo hemos pasado al equipo y lo estamos mirando.',
    // Y lo que no habla de un arreglo en absoluto.
    'La pregunta es correcta: el artículo 14 dice lo que dice.',
    'Tienes razón, la retiramos del temario.',
  ])('NO promete: %s', (t) => {
    expect(afirmaArreglo(t).afirma).toBe(false)
  })

  it('no revienta con vacío o nulo', () => {
    expect(afirmaArreglo(null).afirma).toBe(false)
    expect(afirmaArreglo('').afirma).toBe(false)
  })
})

describe('puedeAfirmarse — el veredicto', () => {
  const vivo = 'abc1234'

  it('BLOQUEA la promesa con commits de superficie servida sin desplegar', () => {
    const v = puedeAfirmarse({ texto: MENSAJE_A_ESTHER, shaVivo: vivo, commitsPendientes: ['deadbee'] })
    expect(v.bloquea).toBe(true)
    expect(v.motivo).toMatch(/SIN desplegar/)
  })

  it('DEJA PASAR la misma promesa si ya está todo vivo', () => {
    expect(puedeAfirmarse({ texto: MENSAJE_A_ESTHER, shaVivo: vivo, commitsPendientes: [] }).bloquea).toBe(false)
  })

  it('DEJA PASAR un mensaje honesto aunque falte desplegar (es la salida buena)', () => {
    const v = puedeAfirmarse({
      texto: 'Lo tenemos corregido y estará disponible en las próximas horas.',
      shaVivo: vivo,
      commitsPendientes: ['deadbee'],
    })
    expect(v.bloquea).toBe(false)
  })

  it('FAIL-OPEN sin sha vivo: avisa, no bloquea — hay una persona esperando respuesta', () => {
    const v = puedeAfirmarse({ texto: MENSAJE_A_ESTHER, shaVivo: null, commitsPendientes: ['deadbee'] })
    expect(v.bloquea).toBe(false)
    expect(v.motivo).toMatch(/no se pudo leer el sha vivo/)
  })

  it('«no lo sé» NO es «no está desplegado»: sin sha vivo tampoco bloquea con la lista vacía', () => {
    expect(puedeAfirmarse({ texto: MENSAJE_A_ESTHER, shaVivo: null, commitsPendientes: [] }).bloquea).toBe(false)
  })

  it('un mensaje que no promete nada nunca bloquea, haya lo que haya sin desplegar', () => {
    const v = puedeAfirmarse({
      texto: 'La pregunta es correcta y te explico por qué.',
      shaVivo: vivo,
      commitsPendientes: ['a', 'b', 'c'],
    })
    expect(v.bloquea).toBe(false)
  })
})
