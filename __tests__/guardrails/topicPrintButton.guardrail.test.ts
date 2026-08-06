import { readFileSync } from 'fs'
import { join } from 'path'
import { vistasDeTemario, VISTA_COMPARTIDA } from '../helpers/vistasDeTemario'

// Guardarraíl: el botón "Imprimir PDF" del temario vive SOLO en <TopicPrintButton>.
// Antes estaba copy-pasteado en 111 TopicContentView.tsx (dos variantes, una con
// typos), y window.print() era un no-op silencioso en navegadores in-app. Este test
// impide que alguien vuelva a reimplementar el print a mano en un TopicContentView.

describe('Guardarraíl: impresión del temario centralizada en <TopicPrintButton>', () => {
  // [T-611] La vista del temario es UNA (+ las que conservan diseño propio): la lista la da
  // el helper compartido, no un recorrido de `app/` que ya solo vería el residuo.
  const files = vistasDeTemario().map((f) => join(process.cwd(), f))

  test('hay ficheros TopicContentView que auditar', () => {
    expect(files.length).toBeGreaterThan(0)
    expect(files).toContain(join(process.cwd(), VISTA_COMPARTIDA))
  })

  test.each(files.map((f) => [f.replace(process.cwd() + '/', ''), f]))(
    '%s no reimplementa el print a mano y usa el componente',
    (_label, full) => {
      const src = readFileSync(full, 'utf8')
      // No debe llamar a window.print() ni definir su propio handlePrint/modal.
      expect(src).not.toMatch(/window\.print\(/)
      expect(src).not.toMatch(/const handlePrint\b/)
      expect(src).not.toMatch(/showPrintModal/)
      // Debe delegar en el componente compartido, exactamente una vez.
      expect((src.match(/<TopicPrintButton/g) || []).length).toBe(1)
      expect(src).toMatch(/import TopicPrintButton from '@\/components\/TopicPrintButton'/)
    }
  )
})
