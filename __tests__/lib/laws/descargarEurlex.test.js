// Tests de la descarga del texto oficial de la UE con espejo de reserva.
//
// Cada caso viene del 28/07/2026, cuando EUR-Lex empezó a racionarnos a mitad de una
// verificación del RGPD. Lo que hay que blindar no es "que baje el HTML", sino que un
// documento que NO sirve JAMÁS se dé por bueno: mientras se validó el código de estado y no
// el contenido, un `202` con 0 bytes producía «no hay nada que reescribir» sobre una ley que
// leen 49 oposiciones.

const { descargarDocumentoOficial } = require('../../../lib/laws/descargarEurlex')
const { documentoSirve, fuentesDocumento, urlCellar, urlEurLex } = require('../../../lib/laws/eurlexConsolidado')

/** HTML mínimo que sí parece el documento: pasa el listón de tamaño y trae artículos. */
const docBueno = (n = 3) =>
  Array.from({ length: n }, (_, i) => `<div id="art_${i + 1}"><p>Artículo ${i + 1}</p><p>${'texto '.repeat(400)}</p></div>`).join('')

const respuesta = (status, body) => ({ ok: status >= 200 && status < 300, status, text: async () => body })

describe('documentoSirve — se juzga el CONTENIDO, no el código de estado', () => {
  it('acepta un documento con artículos', () => {
    expect(documentoSirve(docBueno()).sirve).toBe(true)
  })

  // EL CASO QUE MOTIVÓ TODO ESTO.
  it('RECHAZA el cuerpo vacío con el que CloudFront contesta un 202', () => {
    const r = documentoSirve('')
    expect(r.sirve).toBe(false)
    expect(r.motivo).toMatch(/vacía|cortesía/)
  })

  it('rechaza una página de aviso larga pero SIN artículos (no basta con pesar mucho)', () => {
    const r = documentoSirve(`<html><body>${'Servicio no disponible. '.repeat(500)}</body></html>`)
    expect(r.sirve).toBe(false)
    expect(r.motivo).toMatch(/artículo/)
  })

  it('rechaza un documento sospechosamente corto aunque traiga un art_N', () => {
    expect(documentoSirve('<div id="art_1">Artículo 1</div>').sirve).toBe(false)
  })
})

describe('fuentes: EUR-Lex primero, Cellar de reserva', () => {
  it('propone las dos, en ese orden, para el mismo CELEX', () => {
    const f = fuentesDocumento('CELEX:02016R0679-20160504')
    expect(f.map((x) => x.nombre)).toEqual(['EUR-Lex', 'Cellar'])
    expect(f[0].url).toBe(urlEurLex('CELEX:02016R0679-20160504'))
    expect(f[1].url).toBe(urlCellar('CELEX:02016R0679-20160504'))
  })

  it('Cellar pide el español EXPLÍCITAMENTE (sin eso sirve otra lengua)', () => {
    const cellar = fuentesDocumento('CELEX:02016R0679-20160504')[1]
    expect(cellar.cabeceras['Accept-Language']).toBe('spa')
  })

  it('la URL de Cellar no arrastra el prefijo CELEX:', () => {
    expect(urlCellar('CELEX:02016R0679-20160504')).toBe('http://publications.europa.eu/resource/celex/02016R0679-20160504')
    expect(urlCellar('02016R0679-20160504')).toBe(urlCellar('CELEX:02016R0679-20160504'))
  })
})

describe('descargarDocumentoOficial', () => {
  it('devuelve el documento de EUR-Lex cuando responde bien (y NO pide el espejo)', async () => {
    const pedidas = []
    const fetchImpl = async (url) => { pedidas.push(url); return respuesta(200, docBueno()) }
    const r = await descargarDocumentoOficial('CELEX:02016R0679-20160504', { fetchImpl })
    expect(r.fuente).toBe('EUR-Lex')
    expect(pedidas).toHaveLength(1)
  })

  // EL CASO REAL DEL 28/07: 202 + 0 bytes.
  it('un 202 con cuerpo vacío NO se da por bueno: cae al espejo Cellar', async () => {
    const pedidas = []
    const fetchImpl = async (url) => {
      pedidas.push(url)
      return url.includes('eur-lex') ? respuesta(202, '') : respuesta(200, docBueno())
    }
    const r = await descargarDocumentoOficial('CELEX:02016R0679-20160504', { fetchImpl })
    expect(r.fuente).toBe('Cellar')
    expect(r.html).toContain('id="art_1"')
    expect(pedidas).toHaveLength(2)
  })

  it('también cae al espejo ante un error de red, no solo ante una respuesta mala', async () => {
    const fetchImpl = async (url) => {
      if (url.includes('eur-lex')) throw new Error('ECONNRESET')
      return respuesta(200, docBueno())
    }
    expect((await descargarDocumentoOficial('CELEX:0x', { fetchImpl })).fuente).toBe('Cellar')
  })

  // Quedarse sin fuente es un ERROR, no un resultado vacío: esa confusión fue el fallo.
  it('LANZA si ninguna fuente sirve, detallando cada intento', async () => {
    const fetchImpl = async (url) => (url.includes('eur-lex') ? respuesta(202, '') : respuesta(500, ''))
    await expect(descargarDocumentoOficial('CELEX:02016R0679-20160504', { fetchImpl })).rejects.toThrow(/EUR-Lex.*Cellar/s)
  })

  it('el error NO se confunde con un documento sin artículos (nunca devuelve html vacío)', async () => {
    const fetchImpl = async () => respuesta(200, '')
    await expect(descargarDocumentoOficial('CELEX:0x', { fetchImpl })).rejects.toThrow(/no se pudo obtener/)
  })
})
