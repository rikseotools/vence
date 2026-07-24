// __tests__/guardrails/lawTestCtaNoBareLink.test.ts
//
// Guardarraíl anti-DRIFT del fix T-073. Los TopicContentView.tsx están DUPLICADOS
// (~125, uno por oposición) y ANTES cada uno hand-rolleaba la URL del CTA "Hacer test
// de {ley}" → driftaron y el de la ley enlazaba a la LEY ENTERA (sirviendo preguntas
// fuera de temario). El fix centraliza esa URL en <LawTestCTA> (única función pura
// buildLawTestLink). Este test falla en CI si CUALQUIER TopicContentView vuelve a
// hand-rollear el enlace de ley pelado, o deja de usar el componente compartido.
// Sin BD (lee ficheros) → corre en el CI de unit. Espejo de content-sweep-parity.
import fs from 'fs'
import path from 'path'
import { execSync } from 'child_process'

const REPO = path.resolve(__dirname, '../..')

function topicContentViewFiles(): string[] {
  const out = execSync('git ls-tree -r HEAD --name-only', { cwd: REPO, encoding: 'utf8' })
  return out
    .split('\n')
    .filter((f) => /temario\/\[slug\]\/TopicContentView\.tsx$/.test(f))
    .map((f) => path.join(REPO, f))
}

// Cualquier href INLINE a `/leyes/${…}` DENTRO de un TopicContentView debe llevar
// `selected_articles` (el CTA por-artículo lo lleva; el de ley ahora va por <LawTestCTA>,
// que NO deja href inline en estos ficheros). Un href a `/leyes/${…}` inline SIN
// selected_articles = un enlace de ley pelado (regresión), sea cual sea la variable.
// Captura cada `href={`/leyes/${…}`}` (template literal) del fichero.
const HREF_LEYES = /href=\{`\/leyes\/\$\{[^`]*`\}/g

describe('guardarraíl T-073 — el CTA de test de ley del temario está centralizado', () => {
  const files = topicContentViewFiles()

  it('hay TopicContentView.tsx que auditar (sanity: la extracción funciona)', () => {
    expect(files.length).toBeGreaterThanOrEqual(100)
  })

  it('NINGÚN href inline a /leyes/{…} va SIN selected_articles (enlace de ley pelado, regresión T-073)', () => {
    const culpables: string[] = []
    for (const f of files) {
      const src = fs.readFileSync(f, 'utf8')
      const hrefs = src.match(HREF_LEYES) || []
      // cada href a /leyes/… inline DEBE acotar con selected_articles
      if (hrefs.some((h) => !h.includes('selected_articles='))) culpables.push(path.relative(REPO, f))
    }
    expect(culpables).toEqual([])
  })

  it('TODOS usan el componente compartido <LawTestCTA> (con su import)', () => {
    const sinComponente = files
      .filter((f) => {
        const src = fs.readFileSync(f, 'utf8')
        const importa = src.includes("import LawTestCTA from '@/components/temario/LawTestCTA'")
        const usa = /<LawTestCTA\b/.test(src)
        return !(importa && usa)
      })
      .map((f) => path.relative(REPO, f))
    expect(sinComponente).toEqual([])
  })
})
