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
import { readFileSync, readdirSync } from 'fs'
import { join, relative } from 'path'

const raiz = process.cwd()
const leer = (p: string) => readFileSync(join(raiz, p), 'utf8')

/** Todos los `.tsx` bajo un directorio, en ruta relativa al repo. */
function ficherosTsx(dir: string): string[] {
  const salida: string[] = []
  for (const e of readdirSync(join(raiz, dir), { withFileTypes: true })) {
    const p = join(dir, e.name)
    if (e.isDirectory()) salida.push(...ficherosTsx(p))
    else if (e.name.endsWith('.tsx')) salida.push(relative('.', p))
  }
  return salida
}

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

/**
 * QUINTO ESLABÓN MUDO: el TEMARIO de un tema propio. [T-541]
 *
 * El eslabón del TEST (arriba) ya fija que la ruta pase `positionTypeOverride` y
 * `basePathOverride`, y explica por qué: *«el fallback de TemaTestPage es
 * auxiliar_administrativo_estado, así que sin pasarlo le serviría el temario de OTRA oposición
 * — no falla: acierta la pregunta equivocada»*.
 *
 * Su hermana, la página del TEMA del temario, tenía el mismo agujero y nadie lo miraba. Ahí el
 * componente compartido es el `TopicContentView` de `administrativo-estado`, cuyo `oposicion`
 * por defecto es su propio slug: la página no le pasaba nada, así que los cuatro enlaces de la
 * pantalla (tema anterior, tema siguiente, «Volver al índice» y «Practicar este tema») salían a
 * `/administrativo-estado/...`.
 *
 * Lo cazó un premium el 04/08/2026, no una prueba: pulsó «Practicar este tema» dentro de su
 * oposición y se puso a hacer el test del Estado.
 */
describe('el temario de un tema propio enlaza DENTRO de tu oposición', () => {
  const ruta = leer('app/oposicion-personalizada/[id]/temario/[slug]/page.tsx')
  const componente = leer('app/administrativo-estado/temario/[slug]/TopicContentView.tsx')

  it('la ruta pasa el basePath explícito', () => {
    expect(ruta).toMatch(/basePath=\{/)
  })

  it('…y lo saca del núcleo puro, no de una plantilla escrita a mano', () => {
    // Si se escribe la ruta aquí, el día que cambie habrá dos verdades (misma razón que en el
    // Header con `rutaTestPersonalizada`).
    expect(ruta).toContain('raizPersonalizada')
    expect(ruta).toMatch(/from '@\/lib\/oposicion\/objetivoPersonalizado'/)
  })

  it('el componente SIGUE respetando el basePath (si se quita, vuelve el default mudo)', () => {
    expect(componente).toMatch(/basePath\?:\s*string/)
    expect(componente).toMatch(/basePathProp\s*\?\?\s*`\/\$\{oposicion\}`/)
  })

  it('el default peligroso sigue siendo el ÚLTIMO recurso, no el primero', () => {
    const linea = componente.split('\n').find((l) => l.includes('const basePath ='))
    expect(linea).toBeDefined()
    expect(linea!.indexOf('basePathProp')).toBeLessThan(linea!.indexOf('${oposicion}'))
  })

  it('ninguna otra página monta el TopicContentView de OTRA oposición a ciegas', () => {
    // La regla de clase: reutilizar el componente de otra oposición es legítimo (lo hace esta
    // página), pero entonces hay que decirle dónde está. Sin `basePath`, hereda un slug REAL y
    // teletransporta al usuario.
    const cruzadas = ficherosTsx('app').filter((f) => {
      const propia = f.match(/^app\/([a-z0-9-]+)\//)?.[1]
      const importada = leer(f).match(
        /@\/app\/([a-z0-9-]+)\/temario\/\[slug\]\/TopicContentView/,
      )?.[1]
      return propia && importada && propia !== importada
    })
    // La página personalizada es una de ellas: si esta lista se queda vacía es que el import
    // cambió de forma y el guardarraíl dejó de mirar nada.
    expect(cruzadas.length).toBeGreaterThan(0)
    for (const f of cruzadas) {
      expect(leer(f)).toMatch(/basePath=\{/)
    }
  })
})
