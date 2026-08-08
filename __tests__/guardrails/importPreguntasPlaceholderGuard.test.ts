/**
 * Los importadores de preguntas clínicas NO pueden volver a colgar preguntas de un artículo
 * vacío en silencio. (T-374, 07/08/2026)
 *
 * El 08/07/2026 `import-aulaplus-clinico.cjs` vinculó 7.202 preguntas de enfermería al
 * artículo 1 de 80 contenedores virtuales cuyo contenido era «⏳ Teoría pendiente…» — nada en
 * el script, ni en la cadena de aprobación posterior, comprobó el artículo. El manual (§11 de
 * `importar-preguntas-scrapeadas.md`) ya decía el orden correcto (redactar el temario ANTES de
 * vincular); no estaba HECHO CUMPLIR.
 *
 * Este guardarraíl mira el CÓDIGO, no la prosa: que los dos importadores conocidos usen el
 * mismo criterio puro (`esContenidoPlaceholder`, la fuente única del umbral que también usa
 * el ratchet `placeholderTemarioGuard.test.ts`) y que rechacen sin `--apply` silencioso.
 */
import { readFileSync } from 'fs'
import { join } from 'path'

const raiz = process.cwd()
const leer = (p: string) => readFileSync(join(raiz, p), 'utf8')

const IMPORTADORES = [
  'scripts/import-aulaplus-clinico.cjs',
  'scripts/import-tcae-subject.cjs',
]

describe('importadores de preguntas clínicas: puerta de artículo placeholder', () => {
  for (const ruta of IMPORTADORES) {
    describe(ruta, () => {
      const src = leer(ruta)

      it('usa el criterio ÚNICO de placeholder (no reescribe el umbral a mano)', () => {
        expect(src).toMatch(/require\(.*articuloPlaceholder.*\)/)
        expect(src).toContain('esContenidoPlaceholder')
      })

      it('tiene una vía de escape EXPLÍCITA con motivo, no un flag mudo', () => {
        expect(src).toContain('--permitir-placeholder')
        expect(src).toContain('PERMITIR_PLACEHOLDER')
      })

      it('sin el escape, aborta (process.exit) en vez de seguir e insertar igual', () => {
        // Desde la PRIMERA llamada real (la condición), no desde el require: los dos
        // scripts resuelven la forma distinto, pero ambos abortan cerca de la comprobación.
        const iLlamada = src.indexOf('esContenidoPlaceholder(')
        expect(iLlamada).toBeGreaterThan(-1)
        const iExit = src.indexOf('process.exit(1)', iLlamada)
        expect(iExit).toBeGreaterThan(-1)
        expect(iExit - iLlamada).toBeLessThan(800)
      })

      it('cita T-374, así que quien lo toque sabe por qué existe', () => {
        expect(src).toContain('T-374')
      })
    })
  }

  it('el manual documenta el orden correcto (redactar antes de vincular) — §11', () => {
    const manual = leer('docs/maintenance/importar-preguntas-scrapeadas.md')
    const i11 = manual.indexOf('## 11. Preguntas sin artículo legal')
    expect(i11).toBeGreaterThan(-1)
    const seccion = manual.slice(i11, i11 + 3000)
    expect(seccion).toMatch(/T-374/)
  })
})
