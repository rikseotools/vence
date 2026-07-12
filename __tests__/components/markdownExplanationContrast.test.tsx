// Fix contraste dark mode (feedback Alfonso 12/07/2026): MarkdownExplanation (usado
// en 10 componentes de test) usaba `prose` SIN `dark:prose-invert` → en dark mode el
// texto quedaba gris-oscuro sobre fondo azul oscuro (bg-blue-900/30) = ilegible.
// Fix: `dark:prose-invert` (Tailwind Typography invierte los colores en dark).
// Guardarraíl de FUENTE (react-markdown/remark-gfm son ESM que este Jest no
// transforma → no se puede render-testear el componente sin tocar la config global;
// para un fix de clase CSS, jsdom no computa Tailwind de todos modos).
import { readFileSync } from 'fs'
import { join } from 'path'

const src = readFileSync(join(__dirname, '..', '..', 'components', 'MarkdownExplanation.tsx'), 'utf-8')

describe('MarkdownExplanation — contraste en dark mode (fix Alfonso)', () => {
  it('el prose incluye dark:prose-invert (anti-regresión del contraste)', () => {
    expect(src).toMatch(/prose[\s\S]*?dark:prose-invert/)
  })

  it('sigue usando prose (Tailwind Typography) — la base del fix', () => {
    expect(src).toMatch(/className=\{`[\s\S]*?\bprose\b/)
  })
})
