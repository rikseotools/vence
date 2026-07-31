// [T-026] Vigilancia por hash de fuentes legales. Lo que se fija aquí son las dos formas de
// arruinar una señal: gritar cuando no pasa nada, y callar cuando sí pasa.

const {
  clasificarVigilancia, hashFuente, normalizarParaHash, pareceBloqueo, MINIMO_SERVIBLE,
} = require('@/lib/laws/sourceWatch.cjs')

const DOC = 'Artículo 1. '.padEnd(MINIMO_SERVIBLE + 200, 'texto de la norma ')

describe('clasificarVigilancia', () => {
  it('sin línea base, la primera captura es referencia y NO un hallazgo', () => {
    const r = clasificarVigilancia({ hashPrevio: null, textoDescargado: DOC })
    expect(r.estado).toBe('linea_base')
    expect(r.hash).toHaveLength(64)
  })

  it('mismo documento, mismo hash → sin cambio', () => {
    const r = clasificarVigilancia({ hashPrevio: hashFuente(DOC), textoDescargado: DOC })
    expect(r.estado).toBe('sin_cambio')
  })

  it('una palabra distinta en la norma SÍ dispara «cambiada»', () => {
    // El otro modo de fallo: una normalización demasiado agresiva que se coma un cambio real.
    const r = clasificarVigilancia({ hashPrevio: hashFuente(DOC), textoDescargado: DOC + ' quedará derogado.' })
    expect(r.estado).toBe('cambiada')
  })

  it('una descarga fallida NO es un cambio', () => {
    // Tratarla como cambio llenaría el panel de avisos falsos hasta que nadie lo mirase.
    for (const vacio of ['', null, undefined, 'error 500']) {
      const r = clasificarVigilancia({ hashPrevio: hashFuente(DOC), textoDescargado: vacio })
      expect(r.estado).toBe('inaccesible')
      expect(r.hash).toBeNull()
    }
  })

  it('una pantalla de CAPTCHA tampoco es un cambio, aunque supere el mínimo', () => {
    // Caso real del BORM (31/07): 810 caracteres —por encima del mínimo— con un «incident id»
    // distinto en cada descarga. Sin esta guarda, esa fuente decía «cambiada» todos los días.
    const captcha = 'Your request has originated from the network you are using, please request unblock to site. '
      + 'incident id: 2b537b13-di4q-4718-b8f2-449e50352762 . please solve this captcha to request unblock. '.padEnd(700, 'x')
    const r = clasificarVigilancia({ hashPrevio: hashFuente(DOC), textoDescargado: captcha })
    expect(r.estado).toBe('inaccesible')
    expect(r.motivo).toMatch(/bloqueo|captcha/)
  })
})

describe('normalizarParaHash', () => {
  it('ignora variación de espaciado y mayúsculas (no es un cambio de la norma)', () => {
    expect(hashFuente('Artículo  1.\n\n\nEl plazo   será de dos meses.'))
      .toBe(hashFuente('ARTÍCULO 1.\nEl plazo será de dos meses.'))
  })

  it('ignora la fecha de consulta que estampan algunos boletines', () => {
    const base = 'Artículo 1. El plazo será de dos meses.'
    expect(hashFuente(base + '\nConsultado el 30/07/2026 a las 10:00'))
      .toBe(hashFuente(base + '\nConsultado el 31/07/2026 a las 12:00'))
  })

  it('ignora el pie «página N de M» (cambia al re-paginar un PDF)', () => {
    const base = 'Artículo 1. El plazo será de dos meses.'
    expect(hashFuente(base + '\nPágina 3 de 12')).toBe(hashFuente(base + '\nPágina 4 de 12'))
  })

  it('NO se come una cifra distinta: eso sí es la norma cambiando', () => {
    expect(hashFuente('El plazo será de dos meses.')).not.toBe(hashFuente('El plazo será de tres meses.'))
  })
})

describe('pareceBloqueo', () => {
  it('un documento largo que mencione «forbidden» no se confunde con un bloqueo', () => {
    // Una norma puede citar la palabra sin dejar de ser el documento: por eso la guarda exige
    // además que sea CORTO.
    expect(pareceBloqueo('forbidden '.padEnd(13000, 'articulado real '))).toBe(false)
  })

  it('reconoce las pantallas de bloqueo habituales', () => {
    expect(pareceBloqueo('Access Denied')).toBe(true)
    expect(pareceBloqueo('Attention Required! | Cloudflare')).toBe(true)
  })
})
