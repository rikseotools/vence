/**
 * [T-611] El acento del temario, congelado ANTES de borrar las 131 copias.
 *
 * El refactor que unifica `TopicContentView` no puede cambiar lo que ve nadie: cada oposición
 * tiene que seguir resaltando «ha caído en examen» con EL MISMO color que servía su copia.
 * El fixture se generó leyendo las 131 originales en git (la clase del badge de la cabecera),
 * así que esta comprobación sobrevive al borrado de los ficheros.
 */
import fs from 'fs'
import path from 'path'
import {
  acentoDe,
  clasesAcento,
  oposicionesConAcentoPropio,
  ACENTO_POR_DEFECTO,
  type AcentoTemario,
} from '@/lib/temario/acentoPorOposicion'

const ORIGINALES: Record<string, AcentoTemario> = JSON.parse(
  fs.readFileSync(path.join(process.cwd(), '__tests__/temario/fixtures/acentos-originales.json'), 'utf8'),
)

describe('T-611 · acento del temario', () => {
  const slugs = Object.keys(ORIGINALES)

  it('el fixture cubre las 131 oposiciones que tenían copia propia', () => {
    expect(slugs.length).toBe(131)
  })

  describe('EQUIVALENCIA con el color que servía cada copia', () => {
    it.each(slugs)('%s conserva su acento', (slug) => {
      expect(acentoDe(slug)).toBe(ORIGINALES[slug])
    })
  })

  it('las excepciones declaradas son EXACTAMENTE las que no eran el color por defecto', () => {
    const esperadas = slugs.filter((s) => ORIGINALES[s] !== ACENTO_POR_DEFECTO).sort()
    expect(oposicionesConAcentoPropio().sort()).toEqual(esperadas)
  })

  it('una oposición desconocida (o una PERSONALIZADA, sin slug) cae en el acento por defecto', () => {
    expect(acentoDe(undefined)).toBe(ACENTO_POR_DEFECTO)
    expect(acentoDe(null)).toBe(ACENTO_POR_DEFECTO)
    expect(acentoDe('')).toBe(ACENTO_POR_DEFECTO)
    expect(acentoDe('oposicion-que-no-existe')).toBe(ACENTO_POR_DEFECTO)
  })

  describe('las clases van literales (Tailwind purga por texto)', () => {
    it.each(['amber', 'rose', 'red'] as AcentoTemario[])('%s no construye ninguna clase en runtime', (acento) => {
      const clases = clasesAcento(acento)
      for (const valor of Object.values(clases)) {
        expect(valor).toContain(`-${acento}-`)
        // ni interpolación ni plantillas a medias
        expect(valor).not.toContain('${')
        expect(valor.trim()).toBe(valor)
      }
    })
  })
})
