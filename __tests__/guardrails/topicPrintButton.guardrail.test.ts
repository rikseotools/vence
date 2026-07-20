import { readdirSync, readFileSync, statSync } from 'fs'
import { join } from 'path'

// Guardarraíl: el botón "Imprimir PDF" del temario vive SOLO en <TopicPrintButton>.
// Antes estaba copy-pasteado en 111 TopicContentView.tsx (dos variantes, una con
// typos), y window.print() era un no-op silencioso en navegadores in-app. Este test
// impide que alguien vuelva a reimplementar el print a mano en un TopicContentView.

function findTopicViews(dir: string, acc: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name)
    if (name === 'node_modules' || name === '.next' || name === '.open-next') continue
    const st = statSync(full)
    if (st.isDirectory()) findTopicViews(full, acc)
    else if (name === 'TopicContentView.tsx') acc.push(full)
  }
  return acc
}

describe('Guardarraíl: impresión del temario centralizada en <TopicPrintButton>', () => {
  const files = findTopicViews(join(process.cwd(), 'app'))

  test('hay ficheros TopicContentView que auditar', () => {
    expect(files.length).toBeGreaterThan(50)
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
