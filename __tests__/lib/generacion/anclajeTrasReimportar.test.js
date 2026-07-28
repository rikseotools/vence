// Qué le pasa a la clave de una pregunta cuando el texto de su artículo se reescribe.
//
// Lo que se protege: la diferencia entre «la reimportación ha roto esto» y «esto ya estaba roto».
// Sin esa distinción, un informe de 207 preguntas sin anclar parece un destrozo nuestro cuando la
// mayoría venían así — y, peor, las que SÍ hemos roto se pierden entre las demás.

const { clasificarAnclaje, estaAnclada, resumirAnclajes } = require('../../../lib/generacion/anclajeTrasReimportar')

describe('estaAnclada — solo NO_LITERAL es defecto duro', () => {
  it('LITERAL, ORTOGRAFIA y ENUMERACION cuentan como ancladas (igual que el verificador de lotes)', () => {
    for (const e of ['LITERAL', 'ORTOGRAFIA', 'ENUMERACION']) expect(estaAnclada(e)).toBe(true)
  })

  it('NO_LITERAL no', () => {
    expect(estaAnclada('NO_LITERAL')).toBe(false)
  })

  it('no se cae con un veredicto ausente o inesperado (y ante la duda, NO anclada)', () => {
    expect(estaAnclada(undefined)).toBe(false)
    expect(estaAnclada('')).toBe(false)
    expect(estaAnclada('MARCIANO')).toBe(false)
  })
})

describe('clasificarAnclaje — dónde mirar primero', () => {
  it('INTACTA: estaba y sigue estando → no hay trabajo', () => {
    const r = clasificarAnclaje('LITERAL', 'LITERAL')
    expect(r.clase).toBe('intacta')
    expect(r.prioridad).toBe(0)
  })

  // La reimportación arregla preguntas: la clave era buena y el texto era el malo.
  it('REPARADA: no estaba en el texto viejo y sí en el oficial', () => {
    const r = clasificarAnclaje('NO_LITERAL', 'LITERAL')
    expect(r.clase).toBe('reparada')
    expect(r.motivo).toMatch(/defecto era del texto/)
  })

  // EL CASO QUE IMPORTA.
  it('ROTA: estaba y ha dejado de estar → prioridad máxima', () => {
    const r = clasificarAnclaje('LITERAL', 'NO_LITERAL')
    expect(r.clase).toBe('rota')
    expect(r.prioridad).toBe(3)
  })

  it('YA_ROTA: no estaba ni antes ni ahora → hay que mirarla, pero no la hemos causado nosotros', () => {
    const r = clasificarAnclaje('NO_LITERAL', 'NO_LITERAL')
    expect(r.clase).toBe('ya_rota')
    expect(r.motivo).toMatch(/no lo ha causado la reimportación/)
  })

  it('«rota» pesa más que «ya_rota», y esta más que «reparada»: el orden de revisión no es arbitrario', () => {
    const p = (a, b) => clasificarAnclaje(a, b).prioridad
    expect(p('LITERAL', 'NO_LITERAL')).toBeGreaterThan(p('NO_LITERAL', 'NO_LITERAL'))
    expect(p('NO_LITERAL', 'NO_LITERAL')).toBeGreaterThan(p('NO_LITERAL', 'LITERAL'))
    expect(p('NO_LITERAL', 'LITERAL')).toBeGreaterThan(p('LITERAL', 'LITERAL'))
  })

  it('un pase blando (ORTOGRAFIA/ENUMERACION) no cuenta como rotura', () => {
    expect(clasificarAnclaje('LITERAL', 'ORTOGRAFIA').clase).toBe('intacta')
    expect(clasificarAnclaje('ENUMERACION', 'LITERAL').clase).toBe('intacta')
  })

  it('sin veredicto previo (artículo sin versión guardada) NO se inventa que estaba bien', () => {
    // Si no hay texto anterior no se puede afirmar que la clave estuviera anclada: cae del lado
    // que pide revisión, nunca del lado que la da por buena.
    expect(clasificarAnclaje(undefined, 'LITERAL').clase).toBe('reparada')
    expect(clasificarAnclaje(undefined, 'NO_LITERAL').clase).toBe('ya_rota')
  })
})

// Sin esto, «señale la FALSA» —donde la correcta NO está en el artículo A PROPÓSITO— se contaba
// como pregunta sin anclar. En el RGPD eso inflaba el recuento y el número dejaba de significar
// nada, que es la forma más rápida de que un informe se ignore.
describe('marco INTRUSO — medir literalidad ahí no informa de nada', () => {
  it('NO_APLICA gane lo que gane la literalidad', () => {
    for (const [a, b] of [['LITERAL', 'NO_LITERAL'], ['NO_LITERAL', 'NO_LITERAL'], ['LITERAL', 'LITERAL']]) {
      expect(clasificarAnclaje(a, b, { marcoIntruso: true }).clase).toBe('no_aplica')
    }
  })

  it('no genera trabajo: prioridad 0', () => {
    expect(clasificarAnclaje('NO_LITERAL', 'NO_LITERAL', { marcoIntruso: true }).prioridad).toBe(0)
  })

  it('sin la marca, la MISMA pregunta se clasifica por literalidad (la opción no se activa sola)', () => {
    expect(clasificarAnclaje('NO_LITERAL', 'NO_LITERAL').clase).toBe('ya_rota')
    expect(clasificarAnclaje('NO_LITERAL', 'NO_LITERAL', {}).clase).toBe('ya_rota')
    expect(clasificarAnclaje('NO_LITERAL', 'NO_LITERAL', { marcoIntruso: false }).clase).toBe('ya_rota')
  })
})

describe('resumirAnclajes', () => {
  it('cuenta la tanda por clase, con las cuatro presentes aunque sean cero', () => {
    expect(resumirAnclajes(['intacta', 'rota', 'rota', 'ya_rota'])).toEqual({
      intacta: 1, reparada: 0, rota: 2, ya_rota: 1, no_aplica: 0,
    })
    expect(resumirAnclajes([])).toEqual({ intacta: 0, reparada: 0, rota: 0, ya_rota: 0, no_aplica: 0 })
  })
})
