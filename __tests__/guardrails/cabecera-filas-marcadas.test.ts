/**
 * @jest-environment node
 */
// GUARDARRAÍL del contrato `data-cabecera-fila`.
//
// La cabecera es `sticky top-0 z-50`, así que cualquier cosa que se pegue debajo (hoy los
// controles flotantes del examen) tiene que saber DÓNDE acaba. Y no acaba en su caja: hay
// filas colocadas `absolute top-full` que cuelgan POR DEBAJO y tapan igual — la de racha,
// leyes y soporte que solo sale con sesión. `useOffsetCabecera` las suma, pero solo cuenta las
// que llevan la marca `data-cabecera-fila`, y NO escanea todo lo posicionado a propósito:
// escanearlo se tragaba el menú desplegable oculto (457 px) y hundía los controles a media
// pantalla.
//
// Hay DOS clases de cosa colgante y hay que distinguirlas, no marcarlas todas:
//   · `data-cabecera-fila`    → ocupa sitio SIEMPRE (cuenta para el hueco).
//   · `data-cabecera-overlay` → transitorio, se abre encima (NO cuenta; el menú móvil).
// El guardarraíl no impone cuál es: obliga a DECLARARLO. Añadir una fila nueva sin decidirlo
// es justo lo que devuelve el bug.
//
// El riesgo que cubre este test es el olvido humano: alguien añade otra fila colgante y no la
// declara → los controles vuelven a quedar tapados por ella, que es exactamente el fallo que
// reportó Manolo (28/07/2026). El journey `examen-controles-flotantes` lo cazaría también,
// pero on-demand y en producción; esto falla en el commit.

import { readFileSync } from 'fs'
import { join } from 'path'

const ROOT = join(__dirname, '..', '..')
const HEADER = join(ROOT, 'app/Header.tsx')

/** Trozos `className="…"` (o con backticks) que declaran una fila colgada bajo la cabecera. */
function bloquesColgantes(src: string): string[] {
  // Se busca sobre el ATRIBUTO entero para no cruzar clases de dos elementos distintos.
  const atributos = src.match(/className=(?:"[^"]*"|\{`[^`]*`\}|\{"[^"]*"\})/g) ?? []
  return atributos.filter(a => /\babsolute\b/.test(a) && /\btop-full\b/.test(a))
}

/** ¿El elemento dueño de ese className DECLARA qué es? Se mira la etiqueta que lo contiene. */
function declaracionDe(src: string, className: string): 'fila' | 'overlay' | null {
  const idx = src.indexOf(className)
  if (idx < 0) return null
  const inicio = src.lastIndexOf('<', idx)
  const fin = src.indexOf('>', idx)
  const etiqueta = src.slice(inicio, fin === -1 ? undefined : fin)
  if (/data-cabecera-fila/.test(etiqueta)) return 'fila'
  if (/data-cabecera-overlay/.test(etiqueta)) return 'overlay'
  return null
}

describe('guardarraíl — filas de la cabecera que cuelgan por debajo', () => {
  const src = readFileSync(HEADER, 'utf8')

  it('la cabecera sigue siendo pegajosa (si deja de serlo, el offset sobra y hay que revisarlo)', () => {
    expect(src).toMatch(/<header[^>]*sticky top-0/)
  })

  it('TODO lo que cuelga bajo la cabecera declara si ocupa sitio o es transitorio', () => {
    const colgantes = bloquesColgantes(src)
    // Si esto falla por 0, o han quitado la fila (revisar `useOffsetCabecera`) o cambió la
    // forma de colgarla y este guardarraíl se ha quedado ciego: en ambos casos, mirar.
    expect(colgantes.length).toBeGreaterThan(0)

    const sinDeclarar = colgantes.filter(c => declaracionDe(src, c) === null)
    expect(sinDeclarar).toEqual([])
  })

  it('sigue habiendo al menos una fila que SÍ ocupa sitio (la de racha/leyes con sesión)', () => {
    const filas = bloquesColgantes(src).filter(c => declaracionDe(src, c) === 'fila')
    expect(filas.length).toBeGreaterThan(0)
  })

  it('el menú desplegable NO cuenta como fila (contarlo hundía los controles media pantalla)', () => {
    const overlays = bloquesColgantes(src).filter(c => declaracionDe(src, c) === 'overlay')
    expect(overlays.length).toBeGreaterThan(0)
  })

  it('el hook mide SOLO las filas marcadas (no vuelve a escanear todo lo posicionado)', () => {
    const hook = readFileSync(join(ROOT, 'hooks/useOffsetCabecera.ts'), 'utf8')
    expect(hook).toMatch(/\[data-cabecera-fila\]/)
    // El escaneo genérico fue la regresión: `querySelectorAll('*')` + position absolute.
    expect(hook).not.toMatch(/querySelectorAll\(\s*['"`]\*['"`]\s*\)/)
  })

  it('los controles del examen se pegan al offset medido, nunca a `top-0`', () => {
    const examen = readFileSync(join(ROOT, 'components/ExamLayout.tsx'), 'utf8')
    expect(examen).toMatch(/useOffsetCabecera\(\)/)
    expect(examen).toMatch(/style=\{\{\s*top:\s*offsetCabecera/)
  })
})
