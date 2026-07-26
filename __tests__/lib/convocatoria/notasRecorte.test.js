const { recortarParaNotas } = require('@/lib/convocatoria/notasRecorte.cjs')

const RUIDO = 'La Consejería informa a las personas aspirantes de los trámites administrativos ordinarios del procedimiento.\n\n'

describe('recortarParaNotas — conservar lo que puede contener la respuesta', () => {
  it('conserva el párrafo con la versión de software, que es el dato que más se busca', () => {
    const texto = RUIDO.repeat(20) + 'Se examinará de la versión 11 de Windows y de Word para Microsoft 365 en la Web.\n\n' + RUIDO.repeat(20)
    const r = recortarParaNotas(texto)
    expect(r.texto).toContain('versión 11 de Windows')
    expect(r.texto).toContain('Microsoft 365')
    expect(r.charsDespues).toBeLessThan(r.charsAntes / 2)
  })

  it('conserva fecha de examen, material permitido y penalización', () => {
    const texto =
      RUIDO.repeat(10) +
      'El primer ejercicio se celebrará el día 15 de mayo de 2027.\n\n' +
      RUIDO.repeat(10) +
      'No se permitirá el uso de calculadora ni de diccionario.\n\n' +
      RUIDO.repeat(10) +
      'Cada respuesta errónea penaliza un tercio de acierto.\n\n' +
      RUIDO.repeat(10)
    const r = recortarParaNotas(texto)
    expect(r.texto).toMatch(/15 de mayo de 2027/)
    expect(r.texto).toMatch(/calculadora/)
    expect(r.texto).toMatch(/penaliza/)
  })

  it('trae CONTEXTO alrededor: el dato suele estar en la frase de al lado', () => {
    const texto = `${RUIDO}Se comunica lo siguiente sobre el temario.\n\nSerá la versión más moderna disponible.\n\n${RUIDO}`
    const r = recortarParaNotas(texto)
    // "versión" es señal; el párrafo anterior ("sobre el temario") da el sujeto y debe venir.
    expect(r.texto).toContain('temario')
    expect(r.texto).toContain('más moderna')
  })

  it('marca los huecos para que el modelo no encadene frases lejanas', () => {
    const texto = 'Windows 11 en el ejercicio.\n\n' + RUIDO.repeat(30) + 'Se permite calculadora.\n\n'
    const r = recortarParaNotas(texto)
    expect(r.texto).toContain('[…]')
  })

  it('FAIL-SAFE: sin ninguna señal no recorta a ciegas, devuelve el principio', () => {
    const texto = RUIDO.repeat(50)
    const r = recortarParaNotas(texto, { maxChars: 500 })
    expect(r.bloques).toBe(0)
    expect(r.texto.length).toBeLessThanOrEqual(500)
    expect(texto.startsWith(r.texto)).toBe(true)
  })

  it('nunca devuelve MÁS de lo que recibe', () => {
    const corto = 'Windows 11.'
    const r = recortarParaNotas(corto)
    expect(r.texto.length).toBeLessThanOrEqual(corto.length)
    expect(r.recortado).toBe(false)
  })

  it('respeta el tope duro', () => {
    const texto = ('Se examina de Windows 11 y Excel 2016. ' + RUIDO).repeat(200)
    const r = recortarParaNotas(texto, { maxChars: 1000 })
    expect(r.charsDespues).toBeLessThanOrEqual(1010)
  })

  it('entrada vacía o nula no revienta', () => {
    expect(recortarParaNotas('').texto).toBe('')
    expect(recortarParaNotas(null).charsAntes).toBe(0)
    expect(() => recortarParaNotas(undefined)).not.toThrow()
  })

  it('tolera texto sin párrafos dobles (PDFs que solo traen saltos simples)', () => {
    const texto = Array.from({ length: 40 }, (_, i) => (i === 20 ? 'La prueba será con Windows 11.' : 'Texto de trámite ordinario.')).join('\n')
    const r = recortarParaNotas(texto)
    expect(r.texto).toContain('Windows 11')
    expect(r.charsDespues).toBeLessThan(r.charsAntes)
  })

  it('funciona con las tildes perdidas de los PDFs oficiales', () => {
    const texto = RUIDO.repeat(15) + 'La version del sistema operativo sera Windows 11.\n\n' + RUIDO.repeat(15)
    const r = recortarParaNotas(texto)
    expect(r.texto).toContain('Windows 11')
  })
})
