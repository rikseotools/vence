// __tests__/lib/convocatoria/documentoFuente.test.js
// Unit del núcleo REAL que usan `repuntar-enlace-convocatoria.cjs` (botón oficial de la
// landing) y `clonar-documento.cjs` (hub de provenance) — no una copia.
//
// Qué se fija aquí: el criterio de "esto es el documento oficial de ESTE proceso". Los casos
// salen de fallos reales:
//  · policia-nacional apuntaba a una SPA que devolvía 200 con cuatro palabras (T-134) → umbral.
//  · las bases de Córdoba en PDF dicen 21 plazas y la landing 23 → las anclas tienen que
//    distinguir el documento correcto del parecido.
//  · los boletines escriben con tildes y en mayúsculas según les conviene → comparación plana.

const {
  aTexto, plano, buscarAnclas, paredDelPortal, dictaminar, MIN_CHARS, MARCA_PDF_ILEGIBLE,
} = require('../../../lib/convocatoria/documentoFuente.cjs')

const buf = (s) => Buffer.from(s, 'utf8')
const largo = (s, n = MIN_CHARS + 50) => s + ' relleno'.repeat(Math.ceil(n / 8))

describe('aTexto', () => {
  test('HTML: quita etiquetas, scripts y estilos', () => {
    const html = '<html><head><style>p{color:red}</style><script>var a=1</script></head><body><p>Veintitrés plazas</p></body></html>'
    const t = aTexto(buf(html), 'text/html; charset=utf-8')
    expect(t).toContain('Veintitrés plazas')
    expect(t).not.toMatch(/var a=1|color:red|<p>/)
  })

  test('HTML: colapsa espacios (el texto de un boletín viene con saltos por doquier)', () => {
    expect(aTexto(buf('<p>uno</p>\n\n   <p>dos</p>'), 'text/html')).toBe(' uno dos ')
  })

  test('detecta PDF por content-type Y por cabecera %PDF- (hay servidores que mienten)', () => {
    // Sin pdftotext utilizable sobre basura, devuelve la marca de ilegible en vez de romper.
    const r = aTexto(buf('%PDF-1.5 esto no es un pdf de verdad'), 'application/octet-stream')
    expect(r.startsWith(MARCA_PDF_ILEGIBLE)).toBe(true)
  })
})

describe('plano / buscarAnclas', () => {
  test('ignora tildes, mayúsculas y espacios de más', () => {
    // No recorta los extremos a propósito: se usa con `includes`, y recortar solo escondería
    // diferencias de espaciado que ahí dan igual.
    expect(plano('  Veintitrés   PLAZAS  ')).toBe(' veintitres plazas ')
  })

  test('encuentra el ancla aunque el boletín la escriba distinto', () => {
    const texto = 'Se convocan VEINTITRES  plazas de Ordenanza en turno libre'
    expect(buscarAnclas(texto, ['Veintitrés plazas']).encontradas).toEqual(['Veintitrés plazas'])
  })

  test('separa encontradas de las que faltan', () => {
    const { encontradas, faltan } = buscarAnclas('21 plazas de Ordenanza', ['Ordenanza', '23 plazas'])
    expect(encontradas).toEqual(['Ordenanza'])
    expect(faltan).toEqual(['23 plazas'])
  })
})

describe('dictaminar', () => {
  test('rechaza HTTP distinto de 200', () => {
    expect(dictaminar(largo('texto'), [], { status: 404 })).toMatchObject({ ok: false, motivo: 'HTTP 404' })
  })

  test('REGRESIÓN (T-134): un 200 con cuatro palabras NO es un documento', () => {
    const r = dictaminar('Cargando ...', [])
    expect(r.ok).toBe(false)
    expect(r.motivo).toMatch(/SPA|chars/)
  })

  test('rechaza el PDF ilegible en vez de darlo por bueno', () => {
    expect(dictaminar(`${MARCA_PDF_ILEGIBLE} pdftotext ENOENT`, []).ok).toBe(false)
  })

  test('rechaza el documento PARECIDO: las bases de 21 plazas cuando pedimos las de 23', () => {
    const bases21 = largo('Bases para la provisión de 21 plazas de Ordenanza del Ayuntamiento de Córdoba.')
    const r = dictaminar(bases21, ['Veintitrés plazas de Ordenanza'])
    expect(r.ok).toBe(false)
    expect(r.anclasFaltan).toEqual(['Veintitrés plazas de Ordenanza'])
  })

  test('acepta el documento correcto y lista las anclas encontradas', () => {
    const boe = largo('Veintitrés plazas de Ordenanza, por el sistema de oposición, en turno libre. El plazo será de veinte días hábiles.')
    const r = dictaminar(boe, ['Veintitrés plazas de Ordenanza', 'veinte días hábiles'])
    expect(r.ok).toBe(true)
    expect(r.anclasEncontradas).toHaveLength(2)
  })

  test('sin anclas exigidas basta con que sea legible (pero deja constancia)', () => {
    const r = dictaminar(largo('Resolución del Ayuntamiento'), [])
    expect(r.ok).toBe(true)
    expect(r.motivo).toMatch(/sin anclas exigidas/)
  })
})

describe('paredDelPortal — paridad con `esParedDelPortal` de backend/scripts/clonar-documento.ts', () => {
  test('REGRESIÓN (BORM, 16/07): un captcha de 711 chars devuelto con HTTP 200 no es un documento', () => {
    const captcha = largo('Radware Captcha Page. Your activity and behavior on this site made us think that you are a bot.', 700)
    expect(paredDelPortal(captcha)).toMatch(/captcha/)
    expect(dictaminar(captcha, []).ok).toBe(false)
  })

  test('acceso denegado y rate limit se distinguen del documento', () => {
    expect(paredDelPortal(largo('Acceso denegado'))).toMatch(/denegado/)
    expect(paredDelPortal(largo('Too many requests, rate limit exceeded'))).toMatch(/rate limit/)
  })

  test('el chrome de un portal (menú sin norma) se rechaza, pero el documento con la misma cabecera NO', () => {
    const menu = 'Búsqueda avanzada · Mapa web · Política de cookies · Contacto'.repeat(8)
    expect(paredDelPortal(menu)).toMatch(/chrome del portal/)
    const conNorma = `${menu} Resolución por la que se convocan 23 plazas`
    expect(paredDelPortal(conNorma)).toBeNull()
  })

  test('un documento normal pasa limpio', () => {
    expect(paredDelPortal(largo('Resolución de 13 de julio de 2026 por la que se convocan plazas'))).toBeNull()
  })
})

describe('pareceBoletinCompleto — el boletín entero no es "el documento"', () => {
  const { pareceBoletinCompleto } = require('../../../lib/convocatoria/documentoFuente.cjs')

  test('REGRESIÓN (BORM 146/2026): 739k chars con sumario = boletín completo, no la convocatoria', () => {
    const boletin = 'Número 146 sábado, 27 de junio de 2026 S U M A R I O I. Comunidad Autónoma. ' + 'contenido '.repeat(30000)
    expect(pareceBoletinCompleto(boletin)).toMatch(/boletín completo/)
  })

  test('unas bases largas DE VERDAD no se marcan (tamaño sin pinta de recopilatorio)', () => {
    const bases = 'Bases específicas que han de regir la convocatoria. ' + 'La base cuarta establece los requisitos. '.repeat(8000)
    expect(pareceBoletinCompleto(bases)).toBeNull()
  })

  test('un documento normal, ni se mira', () => {
    expect(pareceBoletinCompleto('Resolución por la que se convoca proceso selectivo')).toBeNull()
  })
})
