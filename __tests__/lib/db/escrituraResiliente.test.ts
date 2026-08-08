// __tests__/lib/db/escrituraResiliente.test.ts
//
// Reproduce el defecto real medido el 08/08/2026: un `for` de escritura sin aislamiento por
// fila, donde un INSERT rechazado por Postgres se llevaba por delante TODO lo que venía
// después en la lista — 8 kinds completos con 0 filas en `content_health_findings` (entre
// ellos `veredicto_verificacion_rojo`, con 393 candidatos reales) pese a que sus detectores
// SÍ corrían.

const {
  escribirConAislamiento,
  mensajeEscrituraIncompleta,
} = require('../../../lib/db/escrituraResiliente.cjs')

describe('escribirConAislamiento', () => {
  it('EL DEFECTO REPRODUCIDO: sin aislamiento, un insertar que revienta a mitad se llevaría el resto — aquí NO', async () => {
    const escritos: string[] = []
    const hallazgos = [
      { kind: 'a' },
      { kind: 'b' }, // este va a fallar
      { kind: 'c' },
      { kind: 'd' },
    ]
    const insertar = async (f: { kind: string }) => {
      if (f.kind === 'b') throw new Error('invalid byte sequence for encoding "UTF8": 0x00')
      escritos.push(f.kind)
    }

    const fallos = await escribirConAislamiento(hallazgos, insertar)

    // Antes del fix, un bucle sin try/catch propio habría lanzado en 'b' y 'c'/'d' NUNCA
    // se habrían intentado. Aquí sí llegan.
    expect(escritos).toEqual(['a', 'c', 'd'])
    expect(fallos).toEqual([{ kind: 'b', error: 'invalid byte sequence for encoding "UTF8": 0x00' }])
  })

  it('sin fallos, todos se escriben y no hay fallos que reportar', async () => {
    const escritos: string[] = []
    const hallazgos = [{ kind: 'x' }, { kind: 'y' }]
    const fallos = await escribirConAislamiento(hallazgos, async (f) => {
      escritos.push(f.kind)
    })
    expect(escritos).toEqual(['x', 'y'])
    expect(fallos).toEqual([])
  })

  it('lista vacía no revienta y no llama a insertar', async () => {
    const insertar = jest.fn()
    const fallos = await escribirConAislamiento([], insertar)
    expect(fallos).toEqual([])
    expect(insertar).not.toHaveBeenCalled()
  })

  it('null/undefined en vez de una lista no revienta (total, como el resto de esta familia)', async () => {
    const insertar = jest.fn()
    expect(await escribirConAislamiento(null as never, insertar)).toEqual([])
    expect(await escribirConAislamiento(undefined as never, insertar)).toEqual([])
  })

  it('VARIOS fallos: todos se recogen, no solo el primero', async () => {
    const hallazgos = [{ kind: 'a' }, { kind: 'b' }, { kind: 'c' }]
    const fallos = await escribirConAislamiento(hallazgos, async (f) => {
      throw new Error(`boom-${f.kind}`)
    })
    expect(fallos.map((f) => f.kind)).toEqual(['a', 'b', 'c'])
  })

  it('un error que no es Error (string, objeto raro) no revienta la recolección', async () => {
    const fallos = await escribirConAislamiento([{ kind: 'raro' }], async () => {
      // eslint-disable-next-line no-throw-literal
      throw 'no soy un Error'
    })
    expect(fallos).toEqual([{ kind: 'raro', error: 'no soy un Error' }])
  })

  it('el mensaje de error se recorta a 300 caracteres (no infla el hallazgo con un stack entero)', async () => {
    const largo = 'x'.repeat(500)
    const fallos = await escribirConAislamiento([{ kind: 'k' }], async () => {
      throw new Error(largo)
    })
    expect(fallos[0].error.length).toBe(300)
  })
})

describe('mensajeEscrituraIncompleta', () => {
  it('resume cuántos hallazgos y de cuántos kinds distintos, nombrándolos', () => {
    const msg = mensajeEscrituraIncompleta([
      { kind: 'veredicto_verificacion_rojo', error: 'e1' },
      { kind: 'veredicto_verificacion_rojo', error: 'e2' },
      { kind: 'opciones_duplicadas', error: 'e3' },
    ])
    expect(msg).toContain('3 hallazgo(s)')
    expect(msg).toContain('2 kind(s)')
    expect(msg).toContain('veredicto_verificacion_rojo')
    expect(msg).toContain('opciones_duplicadas')
  })

  it('un kind repetido no aparece duplicado en la lista de nombres', () => {
    const msg = mensajeEscrituraIncompleta([
      { kind: 'x', error: 'e1' },
      { kind: 'x', error: 'e2' },
    ])
    // "x" solo debe contarse una vez en "kind(s)" aunque tenga 2 fallos.
    expect(msg).toContain('2 hallazgo(s) de 1 kind(s)')
  })
})
