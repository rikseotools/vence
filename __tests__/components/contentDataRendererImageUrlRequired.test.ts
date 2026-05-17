/**
 * Test de regresión: todos los usos de <ContentDataRenderer ... /> deben pasar
 * la prop `imageUrl=`.
 *
 * Bug del 17/05/2026 (reportado por Miau, vayarolloderegistro@gmail.com):
 * 361 preguntas psicotécnicas del subtype `data_tables` tenían `image_url`
 * poblado en BD pero `content_data = {}`. PsychometricTestLayout,
 * ExamReviewLayout y la función renderTextPsychometricQuestion de
 * OfficialExamLayout llamaban a `<ContentDataRenderer contentData={...} />`
 * SIN pasar `imageUrl`, por lo que la imagen nunca se renderizaba aunque la
 * columna `psychometric_questions.image_url` apuntara a un PNG válido en
 * Supabase Storage.
 *
 * El componente ContentDataRenderer ya soportaba `imageUrl` (con click-to-zoom),
 * pero era opcional, así que la omisión se coló sin error de tipos.
 *
 * Fix: (a) los 3 callers ahora pasan imageUrl; (b) la prop pasó a ser
 * obligatoria en la interfaz; (c) este test grep verifica que la cadena
 * `imageUrl=` aparece en cada uso JSX de `<ContentDataRenderer`.
 */
import { describe, expect, it } from '@jest/globals'
import * as fs from 'fs'
import * as path from 'path'

const ROOT = path.join(__dirname, '..', '..')
const read = (rel: string) => fs.readFileSync(path.join(ROOT, rel), 'utf-8')

// Localizar todos los .tsx en components/ y app/ que importen ContentDataRenderer.
function findCallerFiles(): string[] {
  const dirs = ['components', 'app']
  const results: string[] = []

  function walk(dir: string) {
    const abs = path.join(ROOT, dir)
    if (!fs.existsSync(abs)) return
    const entries = fs.readdirSync(abs, { withFileTypes: true })
    for (const entry of entries) {
      const childRel = path.join(dir, entry.name)
      if (entry.isDirectory()) {
        if (entry.name === 'node_modules' || entry.name === '.next') continue
        walk(childRel)
      } else if (entry.name.endsWith('.tsx') || entry.name.endsWith('.ts')) {
        // El propio ContentDataRenderer.tsx no es un caller.
        if (entry.name === 'ContentDataRenderer.tsx') continue
        const src = fs.readFileSync(path.join(ROOT, childRel), 'utf-8')
        if (src.includes('ContentDataRenderer')) {
          results.push(childRel)
        }
      }
    }
  }

  for (const d of dirs) walk(d)
  return results
}

describe('ContentDataRenderer — imageUrl obligatorio en todos los callers', () => {
  const callerFiles = findCallerFiles()

  it('encuentra al menos un caller (sanity check)', () => {
    expect(callerFiles.length).toBeGreaterThan(0)
  })

  it.each(callerFiles)(
    '%s pasa imageUrl en todos sus usos JSX de <ContentDataRenderer',
    (file) => {
      const src = read(file)
      // Match cada <ContentDataRenderer ... /> o <ContentDataRenderer ...> ... </ContentDataRenderer>
      // El renderer es siempre self-closing en este repo, pero soportamos ambos.
      const jsxUses = [...src.matchAll(/<ContentDataRenderer\b[\s\S]*?\/>/g)]
      // Si el archivo importa pero solo lo usa en comentarios/strings, jsxUses estará vacío.
      // En ese caso, no hay nada que verificar.
      for (const m of jsxUses) {
        expect(m[0]).toMatch(/imageUrl=/)
      }
    },
  )

  it('la prop imageUrl es obligatoria en la interfaz de ContentDataRenderer', () => {
    const src = read('components/ContentDataRenderer.tsx')
    // No debe quedar `imageUrl?:` (opcional). La forma vigente es `imageUrl:`.
    expect(src).not.toMatch(/imageUrl\?:/)
    expect(src).toMatch(/imageUrl:\s*string\s*\|\s*null\s*\|\s*undefined/)
  })
})
