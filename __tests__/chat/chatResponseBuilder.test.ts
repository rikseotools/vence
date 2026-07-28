/**
 * @jest-environment node
 */
// ChatResponseBuilder — que las fuentes lleguen a los metadatos.
//
// Nace del ciclo 5 de la revisión de negativos del chat (28/07/2026). Se repetía una
// incoherencia en las trazas: `db_query` devolvía artículos y el dominio informaba
// `hasSources: false`. La causa era que `metadata.sources` **solo** se rellenaba dentro de
// `withSourcesBlock()`, y `VerificationDomain` no lo llama a propósito («para no mostrar
// fuentes al usuario»). Quería el dato sin la presentación, y el único camino que guardaba el
// dato era el que además lo pintaba: las fuentes se perdían.
//
// Consecuencia medible: respuestas que citaban el artículo correcto quedaban registradas con
// `sources_used` y `detected_laws` vacíos, y la observabilidad decía que respondimos sin
// fuentes cuando sí las teníamos.

import { ChatResponseBuilder } from '@/lib/chat/core/ChatResponseBuilder'
import type { ArticleSource } from '@/lib/chat/core/types'

const FUENTES: ArticleSource[] = [
  { lawName: 'Ley 39/2015', articleNumber: '16', title: 'Registros' },
  { lawName: 'Ley 39/2015', articleNumber: '107', title: 'Declaración de lesividad' },
]

describe('addSources — el DATO, separado de la presentación', () => {
  it('deja las fuentes en metadata aunque NO se pinte el bloque visible', () => {
    // Es el caso de VerificationDomain: quiere el dato sin enseñarlo.
    const r = new ChatResponseBuilder().text('respuesta').addSources(FUENTES).build()
    expect(r.metadata.sources).toHaveLength(2)
    expect(r.metadata.sources?.[0]).toMatchObject({ lawName: 'Ley 39/2015', articleNumber: '16' })
  })

  it('y NO las mete en el texto si no se pide', () => {
    // Lo contrario sería el otro bug: enseñar fuentes donde el dominio no las quiere.
    const r = new ChatResponseBuilder().text('respuesta').addSources(FUENTES).build()
    expect(r.content).not.toMatch(/Fuentes:/)
    expect(r.content).toBe('respuesta')
  })

  it('con `withSourcesBlock` sí aparecen en el texto, y siguen en metadata', () => {
    const r = new ChatResponseBuilder().text('respuesta').addSources(FUENTES).withSourcesBlock().build()
    expect(r.content).toMatch(/Fuentes:/)
    expect(r.content).toMatch(/Ley 39\/2015, Art\. 16/)
    expect(r.metadata.sources).toHaveLength(2)
  })

  it('acumula varias llamadas sin perder las anteriores', () => {
    const r = new ChatResponseBuilder()
      .addSources([FUENTES[0]])
      .addSources([FUENTES[1]])
      .build()
    expect(r.metadata.sources).toHaveLength(2)
  })

  it('sin fuentes, metadata no las inventa', () => {
    // `hasSources` se calcula con `!!metadata.sources?.length`: un array vacío daría false
    // igual, pero un undefined es más honesto — no hubo fuentes, no una lista vacía.
    const r = new ChatResponseBuilder().text('hola').build()
    expect(r.metadata.sources).toBeUndefined()
  })

  it('la copia es independiente: mutar la lista del builder no cambia lo ya construido', () => {
    // `metadata.sources = [...this.sources]` y no la referencia: si un dominio añadiera
    // fuentes después de construir, la respuesta ya entregada no debe cambiar bajo los pies.
    const b = new ChatResponseBuilder().addSources([FUENTES[0]])
    const r = b.build()
    b.addSources([FUENTES[1]])
    expect(r.metadata.sources).toHaveLength(1)
  })
})
