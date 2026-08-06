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
// [T-611] El componente compartido va SIEMPRE el primero: desde que las 131 copias son una
// sola, es el fichero que sirve el temario de 130 oposiciones. Sin incluirlo aquí, el día que
// se migró la lista habría pasado de 131 ficheros a 1 y estos tres invariantes habrían dejado
// de mirar lo que de verdad se sirve.
const TOPIC_VIEWS: string[] = [path.join('components', 'temario', 'TopicContentView.tsx')]
for (const name of fs.readdirSync(APP_DIR)) {
  const candidate = path.join('app', name, 'temario', '[slug]', 'TopicContentView.tsx')
  if (fs.existsSync(path.join(ROOT, candidate))) TOPIC_VIEWS.push(candidate)
}

describe('TopicContentView — sin branching virtual', () => {
  it('el componente compartido está en la lista (sanity check)', () => {
    expect(TOPIC_VIEWS).toContain(path.join('components', 'temario', 'TopicContentView.tsx'))
    expect(fs.existsSync(path.join(ROOT, TOPIC_VIEWS[0]))).toBe(true)
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
