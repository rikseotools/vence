/**
 * Tests de `lib/laws/claveConIncisoAnulado.js` (T-169).
 *
 * Los casos vienen de datos reales: el fragmento anulado que el BOE marca en cada artículo
 * (`vigencia_notes.annulledFragments`) y las claves de preguntas vivas.
 */
const { analizarClave, fragmentosUtiles } = require('../../../lib/laws/claveConIncisoAnulado')

describe('fragmentosUtiles — descarta lo que no es un inciso', () => {
  it('tira los MARCADORES del BOE, que son la mitad de lo capturado', () => {
    expect(fragmentosUtiles(['(Anulado)', '(Anulada)', '(Anulado).', '(Derogado)'])).toEqual([])
  })

  it('tira la rúbrica del artículo capturada por error', () => {
    expect(fragmentosUtiles(['Artículo 4. Funciones del Consejo Audiovisual de Andalucía.'])).toEqual([])
  })

  it('conserva los incisos de verdad', () => {
    const frags = ['favorable', 'al Ministerio de Hacienda y Administraciones Públicas']
    expect(fragmentosUtiles(frags)).toEqual(frags)
  })

  it('no revienta con null / vacío', () => {
    expect(fragmentosUtiles(null)).toEqual([])
    expect(fragmentosUtiles(['', '   '])).toEqual([])
  })
})

describe('analizarClave — banda ALTA con fragmentos distintivos', () => {
  it('caza el inciso largo dentro de la clave (LBRL art. 26 / STC 111/2016)', () => {
    const frag = ['al Ministerio de Hacienda y Administraciones Públicas']
    const clave = 'Los municipios de menos de 20.000 habitantes remitirán al Ministerio de Hacienda y Administraciones Públicas el coste efectivo de los servicios.'
    const r = analizarClave(clave, frag)
    expect(r.hallazgo).toBe(true)
    expect(r.banda).toBe('alta')
  })

  it('no marca cuando la clave no reproduce el inciso', () => {
    const r = analizarClave('Los municipios prestarán los servicios mínimos previstos en la ley.', [
      'al Ministerio de Hacienda y Administraciones Públicas',
    ])
    expect(r.hallazgo).toBe(false)
    expect(r.banda).toBeNull()
  })

  it('compara con espacios y comillas normalizados', () => {
    const r = analizarClave('…remitirán   al  Ministerio de Hacienda y Administraciones   Públicas…', [
      'al Ministerio de Hacienda y Administraciones Públicas',
    ])
    expect(r.banda).toBe('alta')
  })
})

describe('analizarClave — banda REVISAR con fragmentos cortos (el caso del art. 92.8)', () => {
  // Caso REAL: la clave decía «De un informe favorable del Ministerio Fiscal» y «favorable»
  // es el inciso que anuló la STC 185/2012. Corto = peligroso pero ambiguo → cola, no badge.
  it('señala la clave del art. 92.8 antes de corregirla', () => {
    const r = analizarClave(
      'De un informe favorable del Ministerio Fiscal. Acuerdo fundamentado en que solo de esa forma se protege adecuadamente el interés superior del menor.',
      ['favorable'],
    )
    expect(r.hallazgo).toBe(true)
    expect(r.banda).toBe('revisar')
    expect(r.fragmento).toBe('favorable')
  })

  it('y deja de señalarla una vez corregida', () => {
    const r = analizarClave(
      'De un informe del Ministerio Fiscal. Acuerdo fundamentado en que solo de esa forma se protege adecuadamente el interés superior del menor.',
      ['favorable'],
    )
    expect(r.hallazgo).toBe(false)
  })

  it('la banda ALTA gana a la corta cuando coinciden las dos', () => {
    const r = analizarClave('… favorable … al Ministerio de Hacienda y Administraciones Públicas …', [
      'favorable',
      'al Ministerio de Hacienda y Administraciones Públicas',
    ])
    expect(r.banda).toBe('alta')
  })

  it('un marcador nunca produce hallazgo aunque la clave diga "anulado"', () => {
    expect(analizarClave('El acto anulado no produce efectos. (Anulado)', ['(Anulado)']).hallazgo).toBe(false)
  })
})

describe('analizarClave — no rompe con entradas vacías', () => {
  it('sin clave o sin fragmentos no hay hallazgo', () => {
    expect(analizarClave('', ['favorable']).hallazgo).toBe(false)
    expect(analizarClave('texto', []).hallazgo).toBe(false)
    expect(analizarClave('texto', null).hallazgo).toBe(false)
  })
})
