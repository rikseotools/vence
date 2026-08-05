// __tests__/lib/notifications/leyPublicable.test.ts
//
// El escudo de la notificación (T-559). Importa la función REAL que usa el hook.
//
// El caso que lo motiva es literal: la tarjeta que recibió Marta Pérez el 05/08/2026,
// con los artículos 190 (Excel 365) y 3 (Access 365) fundidos bajo la ley falsa 'unknown'.
import { particionarPorLeyResuelta } from '@/lib/notifications/leyPublicable'

const art = (article_number: string, law_name: string | null | undefined) => ({
  article_number,
  law_name,
  accuracy_percentage: 0,
})

describe('particionarPorLeyResuelta — qué tarjetas se pueden publicar', () => {
  it('deja pasar los artículos con ley de verdad', () => {
    const r = particionarPorLeyResuelta([art('190', 'Excel 365'), art('3', 'Access 365')])
    expect(r.publicables).toHaveLength(2)
    expect(r.descartados).toHaveLength(0)
    expect(r.leyesDescartadas).toEqual([])
  })

  it('🔒 EL CASO DE MARTA: descarta los artículos cuya ley es el relleno "unknown"', () => {
    // Estos dos se publicaron como «2 Artículos Problemáticos: unknown», con un botón de
    // teoría hacia /teoria/unknown (404) y un test intensivo que sirvió otra materia.
    const r = particionarPorLeyResuelta([art('190', 'unknown'), art('3', 'unknown')])
    expect(r.publicables).toEqual([])
    expect(r.descartados).toHaveLength(2)
    expect(r.leyesDescartadas).toEqual(['unknown'])
  })

  it('no deja que un artículo roto se lleve por delante a los sanos', () => {
    // Importa: el usuario sigue viendo sus tarjetas buenas; solo se cae la que no se puede accionar.
    const r = particionarPorLeyResuelta([
      art('12', 'Ley 39/2015'),
      art('190', 'unknown'),
      art('83', 'CE'),
    ])
    expect(r.publicables.map((a) => a.article_number)).toEqual(['12', '83'])
    expect(r.descartados.map((a) => a.article_number)).toEqual(['190'])
  })

  it.each([null, undefined, '', '   ', 'undefined', 'null', 'UNKNOWN'])(
    'descarta también la ley %p',
    (ley) => {
      const r = particionarPorLeyResuelta([art('1', ley as string | null | undefined)])
      expect(r.publicables).toEqual([])
      expect(r.descartados).toHaveLength(1)
    },
  )

  it('distingue en el evento QUÉ relleno llegó (escritores distintos, causas distintas)', () => {
    const r = particionarPorLeyResuelta([
      art('1', 'unknown'),
      art('2', null),
      art('3', 'unknown'),
      art('4', ''),
    ])
    // Sin duplicados y conservando la forma original: 'unknown' ≠ 'null' ≠ ''.
    expect(r.leyesDescartadas.sort()).toEqual(['', 'null', 'unknown'])
  })

  it('con la lista vacía no inventa descartes (no debe emitir)', () => {
    const r = particionarPorLeyResuelta([])
    expect(r.publicables).toEqual([])
    expect(r.descartados).toEqual([])
    expect(r.leyesDescartadas).toEqual([])
  })

  it('conserva el objeto entero, no solo la ley (la tarjeta necesita el resto)', () => {
    const entrada = { article_number: '190', law_name: 'Excel 365', accuracy_percentage: 0, extra: 'x' }
    expect(particionarPorLeyResuelta([entrada]).publicables[0]).toBe(entrada)
  })
})

describe('cableado: el hook consume la partición y no la lista cruda', () => {
  // Guardarraíl de cableado. El escudo es una línea y se deshace sin querer al refactorizar
  // el reduce de agrupación; el defecto volvería y solo se vería en la pantalla del usuario.
  const { readFileSync } = require('fs') as typeof import('fs')
  const src = readFileSync('hooks/useIntelligentNotifications.ts', 'utf8')

  it('agrupa por ley a partir de `publicables`, nunca de `articles`', () => {
    expect(src).toContain('particionarPorLeyResuelta(articles)')
    expect(src).toMatch(/const articlesByLaw = publicables\.reduce/)
  })

  it('emite cuando descarta (el escudo no puede ser silencioso)', () => {
    expect(src).toContain("eventType: 'notificacion_ley_no_resoluble'")
  })
})
