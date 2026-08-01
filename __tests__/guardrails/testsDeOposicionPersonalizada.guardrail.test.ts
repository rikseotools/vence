/**
 * El circuito «mi oposición → mis tests» no se puede cortar en silencio. (T-327)
 *
 * Son tres eslabones y los tres fallan MUDOS si alguien los quita:
 *
 *  1. El Header tiene que mandar a la ruta de la personalizada. Sin esa rama,
 *     `configGetTestsLink` no la encuentra y devuelve `'/'`: el usuario pulsa el icono de tests
 *     y aterriza en la home, sin error y sin explicación.
 *  2. La ruta del tema tiene que pasar el `position_type` EXPLÍCITO. El fallback de
 *     `TemaTestPage` es `auxiliar_administrativo_estado`, así que sin pasarlo le serviría el
 *     temario de OTRA oposición — no falla: acierta la pregunta equivocada.
 *  3. Ese override tiene que seguir existiendo en `TemaTestPage`.
 *
 * Ninguno de los tres da error al romperse. Por eso se fijan aquí.
 */
import { readFileSync } from 'fs'
import { join } from 'path'

const raiz = process.cwd()
const leer = (p: string) => readFileSync(join(raiz, p), 'utf8')

describe('el icono de tests lleva a la oposición personalizada', () => {
  const header = leer('app/Header.tsx')

  it('el Header usa el núcleo puro de la ruta, no una plantilla suya', () => {
    // Si alguien escribe la ruta a mano aquí, el día que cambie habrá dos verdades.
    expect(header).toContain('rutaTestPersonalizada')
    expect(header).toMatch(/from '@\/lib\/oposicion\/objetivoPersonalizado'/)
  })

  it('la comprueba ANTES de caer al config (que devolvería «/»)', () => {
    const iPersonalizada = header.indexOf('rutaTestPersonalizada(opoId)')
    const iConfig = header.indexOf('configGetTestsLink(opoId)')
    expect(iPersonalizada).toBeGreaterThan(-1)
    expect(iConfig).toBeGreaterThan(-1)
    expect(iPersonalizada).toBeLessThan(iConfig)
  })
})

describe('el test de un tema propio usa SU temario, no el de otra oposición', () => {
  const ruta = leer('app/oposicion-personalizada/[id]/test/tema/[numero]/page.tsx')
  const componente = leer('components/test/TemaTestPage.tsx')

  it('la ruta pasa el position_type explícito', () => {
    expect(ruta).toMatch(/positionTypeOverride=\{`personalizada_\$\{limpio\}`\}/)
  })

  it('…y la ruta base, para que los enlaces internos no salten al catálogo', () => {
    expect(ruta).toMatch(/basePathOverride=/)
  })

  it('el componente SIGUE respetando el override (si se quita, vuelve el fallback mudo)', () => {
    expect(componente).toMatch(/positionTypeOverride\s*\|\|\s*config\?\.positionType/)
    expect(componente).toMatch(/basePathOverride\s*\|\|/)
  })

  it('el fallback peligroso sigue siendo el ÚLTIMO recurso, no el primero', () => {
    // El orden importa: si el fallback fuera primero, el override no serviría de nada.
    const linea = componente
      .split('\n')
      .find((l) => l.includes("|| 'auxiliar_administrativo_estado'"))
    expect(linea).toBeDefined()
    expect(linea!.indexOf('positionTypeOverride')).toBeLessThan(
      linea!.indexOf("'auxiliar_administrativo_estado'"),
    )
  })

  it('la ruta valida la FORMA del id antes de servir nada', () => {
    // Un id inventado tiene que dar 404, no una pantalla de test vacía que parece un fallo
    // nuestro.
    expect(ruta).toContain('notFound()')
    expect(ruta).toMatch(/\[0-9a-f\]\{32\}/)
  })
})
