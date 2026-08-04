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

/**
 * CUARTO ESLABÓN MUDO: una personalizada VACÍA. [T-508]
 *
 * Los tres de arriba fijan que el circuito «mi oposición → mis tests» llegue a su sitio. Este
 * fija qué pasa cuando el sitio existe pero está vacío, que es el estado NORMAL de la mayoría de
 * las filas: el 03/08/2026, de 585 `custom_oposiciones` activas, **580 eran etiquetas del
 * onboarding viejo con 0 temas** y solo 5 tenían temario.
 *
 * Falla mudo igual que los otros tres: nada peta, simplemente una usuaria premium pulsa 📚 y ve
 * un 404 — pasó, y lo supimos porque escribió. Lo que se fija:
 *
 *  1. La ruta del temario distingue «no existe» (404, correcto) de «existe y está vacía»
 *     (pantalla explicada). Si alguien vuelve a dejar que caiga en el `notFound()` del
 *     componente compartido, vuelve el 404.
 *  2. El texto de esa pantalla es UNO, compartido con la ruta de tests. Con dos copias, la
 *     próxima corrección solo llega a una — que es exactamente cómo nació este bug (la de tests
 *     lo explicaba, la de temario no).
 *  3. Las dos puertas que deciden si se puede fijar como objetivo usan el MISMO criterio puro.
 *     Escribir `temas > 0` a mano en cualquiera de ellas las separa el día que el criterio
 *     cambie, y entonces la buena deja de proteger.
 */
describe('una personalizada vacía no es un 404', () => {
  const rutaTemario = leer('app/oposicion-personalizada/[id]/temario/page.tsx')
  const rutaTests = leer('app/oposicion-personalizada/[id]/test/page.tsx')
  const boton = leer('components/oposicionPersonalizada/MisOposiciones.tsx')
  const endpoint = leer('app/api/profile/target/route.ts')

  it('la ruta del temario decide ELLA si está vacía, en vez de heredar el 404 del componente', () => {
    expect(rutaTemario).toContain('personalizadaUtilizable')
    expect(rutaTemario).toContain('AvisoTemarioVacio')
  })

  it('el texto del vacío es uno solo: las dos rutas usan el mismo componente', () => {
    expect(rutaTests).toContain('AvisoTemarioVacio')
    // Y ninguna se guarda una copia del texto por su cuenta.
    expect(rutaTemario).not.toMatch(/aún no tiene temas con contenido/)
    expect(rutaTests).not.toMatch(/aún no tiene temas con contenido/)
  })

  /**
   * Se mira el CÓDIGO, no la prosa. La primera versión de esta comprobación daba rojo por el
   * comentario que explica justamente por qué no hay que escribir `temas > 0` a mano — un
   * guardarraíl que se dispara con las palabras en vez de con lo ejecutable acaba obligando a
   * escribir peores comentarios para callarlo.
   */
  const sinComentarios = (src: string) =>
    src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*(\/\/|\*).*$/gm, '')

  it('las DOS puertas del objetivo comparten el criterio puro (ninguna lo reescribe a mano)', () => {
    for (const [nombre, fuente] of [['botón', boton], ['endpoint', endpoint]] as const) {
      const codigo = sinComentarios(fuente)
      expect(`${nombre}:${codigo.includes('personalizadaUtilizable')}`).toBe(`${nombre}:true`)
      expect(`${nombre}:${/\.temas\s*>\s*0/.test(codigo)}`).toBe(`${nombre}:false`)
    }
  })

  it('el rechazo del servidor deja rastro: sin evento no nos enteraríamos otra vez', () => {
    expect(endpoint).toContain('objetivo_personalizado_vacio')
    expect(rutaTemario).toContain('objetivo_personalizado_vacio')
  })
})
