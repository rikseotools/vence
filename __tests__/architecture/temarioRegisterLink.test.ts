// __tests__/architecture/temarioRegisterLink.test.ts
//
// Guard anti-regresión: el modal "Descarga el temario en PDF" de cada temario
// (componentes app/<oposicion>/temario/[slug]/TopicContentView.tsx) muestra a los
// usuarios NO registrados un enlace "Registrarse gratis" a /login?oposicion=...
//
// Esos componentes son CLONES de una plantilla. El enlace estuvo hardcodeado a
// `oposicion=auxiliar_enfermeria_osakidetza` en 8 oposiciones (UNED, tcae-*, etc.),
// enviando al usuario a la oposición equivocada (reporte real Alicia, 18/06/2026).
//
// El enlace DEBE ser dinámico — derivado de la oposición del propio archivo
// (`${oposicion}` / `${basePath}`) — para que cada clon apunte a su oposición y
// no pueda volver a desincronizarse.

import { readFileSync, readdirSync, existsSync } from 'fs'
import { join } from 'path'

const appDir = join(process.cwd(), 'app')
const temarioFiles = readdirSync(appDir)
  .map((d) => join(appDir, d, 'temario', '[slug]', 'TopicContentView.tsx'))
  .filter((p) => existsSync(p))

describe('Temario — enlace de registro del modal "Descarga PDF"', () => {
  it('encuentra componentes de temario que revisar', () => {
    expect(temarioFiles.length).toBeGreaterThan(0)
  })

  it.each(temarioFiles)('%s: el enlace /login apunta a SU oposición, no a otra', (file) => {
    const content = readFileSync(file, 'utf8')
    // Oposición real del archivo = nombre de su carpeta (slug).
    const dirSlug = file.match(/app\/([^/]+)\/temario\//)![1]
    // Enlaces hardcodeados /login?oposicion=<literal> (los dinámicos `${...}` no casan).
    const linked = [...content.matchAll(/\/login\?oposicion=([a-z0-9_]+)/g)]
    for (const m of linked) {
      // position_type → slug (underscores → guiones) debe coincidir con la carpeta.
      expect(m[1].replace(/_/g, '-')).toBe(dirSlug)
    }
  })
})
