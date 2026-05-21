/**
 * Bug (21/05/2026): leyes virtuales de informática (Word, Outlook, Access,
 * Windows, etc.) se renderizaban como tarjeta compacta `VirtualLawCard`
 * (solo botón "Hacer test") en /temario/[slug], escondiendo el contenido
 * teórico de sus artículos que sí está cargado en BD. Excel era la única
 * que se mostraba completa, porque su `description` no contenía las
 * palabras "ficticia" ni "virtual" que detectaba `isVirtualLaw()`.
 *
 * Fix: eliminar el branching virtual/no-virtual de las 38 TopicContentView.
 * Todas las leyes con artículos pasan a renderizarse como `LawSection`
 * (sección expandible con contenido completo).
 *
 * Estos tests son estáticos (lectura de archivos) y verifican que ningún
 * TopicContentView vuelve a importar `isVirtualLaw` ni a usar
 * `VirtualLawCard`.
 */
import { describe, expect, it } from '@jest/globals'
import * as fs from 'fs'
import * as path from 'path'

const ROOT = path.join(__dirname, '..', '..')

// Glob ./[slug]/ no funciona porque los corchetes son metacaracteres. Hacemos
// el listado a mano: leemos app/ y filtramos cada subdir que contenga temario/[slug]/TopicContentView.tsx.
const APP_DIR = path.join(ROOT, 'app')
const TOPIC_VIEWS: string[] = []
for (const name of fs.readdirSync(APP_DIR)) {
  const candidate = path.join('app', name, 'temario', '[slug]', 'TopicContentView.tsx')
  if (fs.existsSync(path.join(ROOT, candidate))) TOPIC_VIEWS.push(candidate)
}

describe('TopicContentView — sin branching virtual', () => {
  it('hay al menos 30 TopicContentView (sanity check del glob)', () => {
    expect(TOPIC_VIEWS.length).toBeGreaterThanOrEqual(30)
  })

  describe.each(TOPIC_VIEWS)('%s', (rel) => {
    const src = fs.readFileSync(path.join(ROOT, rel), 'utf-8')

    it('no importa isVirtualLaw de @/lib/isVirtualLaw', () => {
      expect(src).not.toMatch(/from '@\/lib\/isVirtualLaw'/)
      expect(src).not.toMatch(/\bisVirtualLaw\b/)
    })

    it('no define ni usa VirtualLawCard', () => {
      expect(src).not.toMatch(/\bVirtualLawCard\b/)
    })

    it('renderiza LawSection directamente en el .map de content.laws', () => {
      // El JSX dentro del map debe contener <LawSection sin branching ternario
      // sobre isVirtualLaw.
      expect(src).toMatch(
        /content\.laws\.map\(\(lawData, index\) => \(\s*<LawSection/,
      )
    })
  })
})
