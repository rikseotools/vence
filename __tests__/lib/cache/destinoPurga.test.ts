// Guarda del destino de las purgas de caché.
//
// El caso que la motiva (08/08/2026): `.env.local` de cualquier máquina de desarrollo
// trae SITE_URL=http://localhost:3000, y `scripts/purge-all-cache.js` lo usaba tal cual.
// Sin dev server → 0 OK de 1.760 rutas; CON dev server → 1.760 «OK» y producción intacta.
// Lo segundo es lo grave: un verde por apuntar al sitio equivocado.

const { clasificarDestinoPurga, puedePurgar, PRODUCCION } = require('../../../lib/cache/destinoPurga.cjs')

describe('clasificarDestinoPurga', () => {
  it('reconoce producción', () => {
    expect(clasificarDestinoPurga('https://www.vence.es').esProduccion).toBe(true)
    expect(clasificarDestinoPurga('https://vence.es/').esProduccion).toBe(true)
  })

  it('sin valor cae en producción (comportamiento histórico del script)', () => {
    for (const v of [undefined, null, '', '   ']) {
      const c = clasificarDestinoPurga(v as any)
      expect(c.destino).toBe(PRODUCCION)
      expect(c.esProduccion).toBe(true)
    }
  })

  it('marca como LOCAL lo que apunta a la propia máquina', () => {
    for (const url of ['http://localhost:3000', 'http://127.0.0.1:3000', 'http://0.0.0.0:8080', 'http://mi-mac.local']) {
      const c = clasificarDestinoPurga(url)
      expect(c.esLocal).toBe(true)
      expect(c.esProduccion).toBe(false)
      expect(c.motivo).toBeTruthy()
    }
  })

  it('un tercero cualquiera tampoco es producción, y lo dice sin llamarlo local', () => {
    const c = clasificarDestinoPurga('https://staging.vence.es')
    expect(c.esProduccion).toBe(false)
    expect(c.esLocal).toBe(false)
    expect(c.motivo).toContain('staging.vence.es')
  })

  it('una URL rota no se cuela como producción', () => {
    const c = clasificarDestinoPurga('no-es-una-url')
    expect(c.esProduccion).toBe(false)
    expect(c.motivo).toContain('no es una URL válida')
  })
})

describe('puedePurgar — falla CERRADO', () => {
  it('deja purgar producción', () => {
    expect(puedePurgar('https://www.vence.es').ok).toBe(true)
  })

  it('NIEGA localhost por defecto (el caso real que se midió)', () => {
    const v = puedePurgar('http://localhost:3000')
    expect(v.ok).toBe(false)
    expect(v.motivo).toContain('localhost')
  })

  it('lo permite solo si quien lanza lo pide a propósito', () => {
    expect(puedePurgar('http://localhost:3000', { permitirNoProduccion: true }).ok).toBe(true)
  })

  it('nunca reescribe el destino que puso el operador', () => {
    // Corregirlo en silencio sería la otra forma de mentir sobre dónde se purgó.
    expect(puedePurgar('http://localhost:3000', { permitirNoProduccion: true }).destino)
      .toBe('http://localhost:3000')
  })
})
