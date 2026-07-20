/**
 * @jest-environment node
 */
// Guardarraíl del PDF del temario (T-039). El botón de imprimir (TopicPrintButton) deriva el
// identificador de la oposición del `oposicion=` del loginHref, que es el POSITION_TYPE (con
// underscores). La ruta `/api/temario/[oposicion]/[topic]/pdf` indexa por SLUG (con guiones) y
// lo normaliza con `.replace(/_/g,'-')`. Ese fix SOLO es correcto si, para toda oposición,
// `slug === positionType.replace(/_/g,'-')`. Si alguien añade una donde no se cumpla, el botón
// volvería a dar 404 en esa oposición sin que nada más avise. Este test lo fija.
//
// Bug real (20/07/2026): desde que T-039 cambió el botón de window.print() a este fetch, TODAS
// las oposiciones daban 404 al imprimir (el botón mandaba underscores, la ruta esperaba guiones).
import { OPOSICIONES } from '@/lib/config/oposiciones'

describe('PDF del temario — invariante slug ↔ positionType', () => {
  it('para toda oposición, slug === positionType con `_`→`-` (lo que normaliza la ruta del PDF)', () => {
    const rotas = OPOSICIONES
      .filter(o => o.positionType.replace(/_/g, '-') !== o.slug)
      .map(o => `${o.slug} ⟷ ${o.positionType}`)
    expect(rotas).toEqual([])
  })
})
