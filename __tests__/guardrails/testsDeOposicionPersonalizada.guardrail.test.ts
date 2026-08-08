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
  // [T-339] TERCERA puerta: el guardado progresivo del onboarding escribía `target_oposicion`
  // directo, sin pasar por `personalizadaUtilizable` — la misma forma en que esto se rompió la
  // primera vez, un escalón más abajo (dos puertas con criterios distintos no protegen: se
  // contradicen). Medido el 07/08/2026: las 10 personalizadas "más populares" que el propio
  // onboarding ofrece (`get_popular_custom_oposiciones`) tienen las 10 CERO temas.
  const onboarding = leer('app/api/v2/onboarding/save-field/route.ts')

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

  it('las TRES puertas del objetivo comparten el criterio puro (ninguna lo reescribe a mano)', () => {
    for (const [nombre, fuente] of [
      ['botón', boton],
      ['endpoint', endpoint],
      ['onboarding', onboarding],
    ] as const) {
      const codigo = sinComentarios(fuente)
      expect(`${nombre}:${codigo.includes('personalizadaUtilizable')}`).toBe(`${nombre}:true`)
      expect(`${nombre}:${/\.temas\s*>\s*0/.test(codigo)}`).toBe(`${nombre}:false`)
    }
  })

  it('las DOS puertas de escritura server-side comparten la MISMA consulta, no una copia', () => {
    // `buscarPersonalizada` vive en un solo sitio (lib/api/oposicionPersonalizada/consultas.ts).
    // Si alguna de las dos la reescribe con su propio SELECT, vuelven a poder divergir.
    for (const [nombre, fuente] of [
      ['endpoint', endpoint],
      ['onboarding', onboarding],
    ] as const) {
      expect(`${nombre}:${fuente.includes("from '@/lib/api/oposicionPersonalizada/consultas'")}`).toBe(
        `${nombre}:true`,
      )
    }
  })

  it('el rechazo del servidor deja rastro: sin evento no nos enteraríamos otra vez', () => {
    expect(endpoint).toContain('objetivo_personalizado_vacio')
    expect(rutaTemario).toContain('objetivo_personalizado_vacio')
    expect(onboarding).toContain('objetivo_personalizado_vacio')
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
  // [T-611] Ya no hay un componente por oposición: es UNO. Antes esto leía la copia de
  // `administrativo-estado`, que era la que reutilizaba la personalizada.
  const componente = leer('components/temario/TopicContentView.tsx')

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
    expect(componente).toMatch(/basePathProp\s*\?\?\s*\(oposicion/)
  })

  it('el default peligroso sigue siendo el ÚLTIMO recurso, no el primero', () => {
    const linea = componente.split('\n').find((l) => l.includes('const basePath ='))
    expect(linea).toBeDefined()
    expect(linea!.indexOf('basePathProp')).toBeLessThan(linea!.indexOf('${oposicion}'))
  })

  it('sin slug NO se hereda el de otra oposición: ni en los enlaces ni en el login', () => {
    // [T-611] Antes `oposicion` traía por defecto un slug REAL ('administrativo-estado'), así que
    // una personalizada que solo pasaba `basePath` seguía yendo a ese login y resolvía SUS
    // bloques. Es el mismo modo de fallo de [T-541] un enlace más abajo.
    expect(componente).not.toMatch(/oposicion\s*=\s*['"][a-z0-9-]+['"]/)
    expect(componente).toMatch(/oposicion\s*\?\s*`\/login\?oposicion=/)
  })

  it('ninguna página monta el temario de OTRA oposición a ciegas', () => {
    // La regla de clase: montar el componente compartido fuera de la ruta de una oposición del
    // catálogo es legítimo (lo hace esta página), pero entonces hay que decirle dónde está.
    // Sin `basePath` los enlaces salen a la raíz equivocada.
    const cruzadas = ficherosTsx('app').filter((f) => {
      const enRutaDeCatalogo = /^app\/[a-z0-9-]+\/temario\//.test(f)
      const monta = /@\/components\/temario\/TopicContentView/.test(leer(f))
      return monta && !enRutaDeCatalogo
    })
    // La página personalizada es una de ellas: si esta lista se queda vacía es que el import
    // cambió de forma y el guardarraíl dejó de mirar nada.
    expect(cruzadas.length).toBeGreaterThan(0)
    for (const f of cruzadas) {
      expect(leer(f)).toMatch(/basePath=\{/)
    }
  })
})

/**
 * SEXTO ESLABÓN MUDO: el pie del tema navegaba a ciegas. [T-541]
 *
 * `TopicNavFooter` pintaba «Tema siguiente» haciendo `topicNumber + 1` sin comprobar que ese
 * tema existiera. Mientras los enlaces se escapaban a otra oposición el fallo estaba TAPADO —el
 * tema siguiente existía, en la oposición equivocada—; al enderezarlos, la última página del
 * temario propio pasó a ofrecer un 404. Lo vio el rastreador contra producción, no una prueba.
 */
describe('el pie del tema no ofrece temas que no existen', () => {
  const pie = leer('components/TopicNavFooter.tsx')
  const ruta = leer('app/oposicion-personalizada/[id]/temario/[slug]/page.tsx')

  it('el componente admite la lista de temas que existen', () => {
    expect(pie).toMatch(/temasExistentes\?:\s*number\[\]/)
  })

  it('…y la respeta en los DOS botones (anterior y siguiente)', () => {
    expect(pie).toMatch(/const anterior = topicNumber > 1 && existe\(topicNumber - 1\)/)
    expect(pie).toMatch(/const siguiente = existe\(topicNumber \+ 1\)/)
  })

  it('sin la lista se mantiene el comportamiento de siempre (las ~120 del catálogo no cambian)', () => {
    expect(pie).toMatch(/!temasExistentes \|\| temasExistentes\.includes\(n\)/)
  })

  it('la página personalizada se la pasa, sacada de su propio temario', () => {
    expect(ruta).toContain('getTemarioByPositionType')
    expect(ruta).toMatch(/temasExistentes=\{/)
  })
})

/**
 * SÉPTIMO ESLABÓN: que no nazca la copia 132. [T-611]
 *
 * La página de un tema del temario vivió COPIADA una vez por oposición: 131 ficheros
 * `app/<opo>/temario/[slug]/TopicContentView.tsx`, 122 cuerpos distintos por deriva de
 * copia-pega. Lo que de verdad cambiaba entre ellos era una tabla de rangos y un color, y las
 * consecuencias fueron medibles: `expandAll` escrito en 78 copias y conectado a un botón en
 * CERO, y `<TopicVideoCourses>` ausente en 54 (esas oposiciones tenían cursos y no se
 * enseñaban).
 *
 * La fábrica estaba abierta en el manual de alta de oposiciones, así que esto no se arregla
 * borrando: se arregla impidiendo que la siguiente oposición vuelva a nacer como copia. Y la
 * regla NO puede ser «que no exista un fichero con ese nombre» (se rodea renombrando): lo que
 * se prohíbe es que una ruta del temario vuelva a montar SU PROPIO árbol de leyes/artículos.
 */
describe('el temario es UN componente, no uno por oposición', () => {
  /** El árbol del temario se reconoce por sus dos piezas internas, no por el nombre del fichero. */
  const ES_UN_ARBOL_PROPIO = /function\s+(LawSection|ArticleCard)\b/

  /**
   * ÚNICA excepción viva, y es un DISEÑO distinto, no una copia: cabecera de ley en degradado
   * índigo, badge «LEY» y la capa de «artículos a repasar» (`useTopicUnlock`). Absorberla en el
   * componente único cambia el aspecto de la oposición insignia → es decisión de producto.
   *
   * TRINQUETE: esta lista solo puede MENGUAR. Añadir una entrada es reabrir la fábrica.
   */
  const EXCEPCIONES_CON_DISENO_PROPIO = ['auxiliar-administrativo-estado']

  const conArbolPropio = ficherosTsx('app')
    .filter((f) => f.includes('/temario/'))
    .filter((f) => ES_UN_ARBOL_PROPIO.test(leer(f)))

  it('ninguna ruta de temario monta su propio árbol de leyes y artículos', () => {
    const inesperadas = conArbolPropio.filter(
      (f) => !EXCEPCIONES_CON_DISENO_PROPIO.some((e) => f.startsWith(`app/${e}/`)),
    )
    expect(inesperadas).toEqual([])
  })

  it('la lista de excepciones no crece (trinquete)', () => {
    expect(EXCEPCIONES_CON_DISENO_PROPIO.length).toBeLessThanOrEqual(1)
  })

  it('…y la excepción declarada sigue existiendo (si se migra, hay que quitarla de la lista)', () => {
    for (const e of EXCEPCIONES_CON_DISENO_PROPIO) {
      expect(conArbolPropio.some((f) => f.startsWith(`app/${e}/`))).toBe(true)
    }
  })

  it('el componente único resuelve los bloques del DATO, no de una función copiada', () => {
    const componente = leer('components/temario/TopicContentView.tsx')
    expect(componente).toMatch(/from '@\/lib\/temario\/bloquesTemario'/)
    expect(componente).toMatch(/from '@\/lib\/temario\/bloquesPorOposicion'/)
    expect(componente).not.toMatch(/function\s+getBlockInfo/)
  })

  it('…y monta TopicVideoCourses para todas (se auto-oculta: faltaba en 54 por olvido)', () => {
    expect(leer('components/temario/TopicContentView.tsx')).toContain('<TopicVideoCourses')
  })
})

/**
 * OCTAVO ESLABÓN: el bucle temario → test → VUELTA AL ARTÍCULO. [T-611]
 *
 * Lo reportó una premium: *«hago un test de un artículo y después no puedo volver exactamente
 * al mismo lugar, tengo que volver al temario y buscar el artículo por donde me quedé»*. En el
 * código eran tres piezas y las tres tenían que existir a la vez —por eso van juntas aquí—:
 * el `id` de la tarjeta (0 de 131 copias lo tenían), la URL de vuelta CON ancla (las 131
 * guardaban `window.location.href` pelado) y desplegar la ley al llegar (las tarjetas viven
 * dentro de una sección PLEGADA, así que sin eso el salto no lleva a ninguna parte).
 *
 * Quitar cualquiera de las tres no rompe nada visible: simplemente se vuelve a caer arriba
 * del tema, que es el estado del que venimos.
 */
describe('el temario devuelve al artículo del que saliste', () => {
  const componente = leer('components/temario/TopicContentView.tsx')

  it('la tarjeta del artículo lleva su ancla', () => {
    expect(componente).toMatch(/id=\{ancla\}/)
    expect(componente).toMatch(/anclaArticulo\(lawShortName, article\.articleNumber\)/)
  })

  it('el ancla sale del núcleo puro compartido, no de una plantilla escrita a mano', () => {
    // Si se construye aquí a mano, el día que cambie de forma la vuelta deja de casar y
    // falla en SILENCIO (el ancla no encuentra nada y se cae arriba del tema).
    expect(componente).toMatch(/from '@\/lib\/navigation\/backToArticleLink'/)
  })

  it('la URL que se guarda para volver lleva el ancla', () => {
    expect(componente).toMatch(/sessionStorage\.setItem\('temario_return_url'/)
    expect(componente).toMatch(/ancla \? `\$\{base\}#\$\{ancla\}` : base/)
  })

  it('al llegar con ancla DESPLIEGA la ley (si no, el artículo sigue oculto)', () => {
    expect(componente).toMatch(/window\.location\.hash/)
    expect(componente).toMatch(/setExpandedLaws\(\(prev\) => new Set\(prev\)\.add\(ley\.law\.id\)\)/)
    expect(componente).toMatch(/scrollIntoView/)
  })

  it('deja rastro: sin evento no sabríamos si el bucle se cerró de verdad', () => {
    expect(componente).toMatch(/eventType: 'temario_vuelta_articulo'/)
    expect(componente).toMatch(/resultado: ley \? 'articulo' : 'no_encontrado'/)
  })
})

/**
 * NOVENO ESLABÓN: el test ALEATORIO multi-tema — existía la ruta y no había enlace. [T-327]
 *
 * Causa raíz reproducida el 06/08/2026: `/test/aleatorio` (el picker del catálogo) resuelve la
 * oposición con `getOposicionConfig(positionType)`, que sale de `OPOSICIONES` — un array literal
 * hardcodeado. Una personalizada (`personalizada_<id>`) es una fila dinámica en `topics`, así que
 * nunca puede estar ahí: esa página se queda cargando para siempre. Y la razón de que nadie lo
 * hubiera notado no era que "no pasara": es que el hub que SÍ funciona
 * (`app/oposicion-personalizada/[id]/test/page.tsx`) nunca enlazaba a esa pantalla — no hay
 * enlace roto que alguien vaya a pisar, hay AUSENCIA de funcionalidad. Se fija aquí para que la
 * ausencia no vuelva: el hub tiene que seguir enlazando, y la página nueva tiene que seguir sin
 * pasar por el config estático (el mismo modo de fallo mudo que los otros ocho eslabones).
 */
describe('el test aleatorio de una personalizada existe Y es alcanzable', () => {
  const hub = leer('app/oposicion-personalizada/[id]/test/page.tsx')
  const rutaAleatorio = leer('app/oposicion-personalizada/[id]/test/aleatorio/page.tsx')
  const picker = leer('components/oposicionPersonalizada/AleatorioPersonalizadoPicker.tsx')

  it('el hub ENLAZA al test aleatorio (sin esto la ruta es inalcanzable, aunque exista)', () => {
    expect(hub).toMatch(/href=\{`\/oposicion-personalizada\/\$\{limpio\}\/test\/aleatorio`\}/)
  })

  it('la ruta del aleatorio valida la FORMA del id antes de servir nada (igual que la de tema)', () => {
    expect(rutaAleatorio).toContain('notFound()')
    expect(rutaAleatorio).toMatch(/\[0-9a-f\]\{32\}/)
  })

  it('la ruta construye el position_type de la fila, NO lo saca del config estático', () => {
    // La trampa exacta de T-327: `getOposicionConfig`/`getOposicion(` devuelven null para
    // cualquier personalizada porque salen de `OPOSICIONES`, el array hardcodeado. Se mira el
    // IMPORT (lo ejecutable), no la prosa — el propio fichero EXPLICA la trampa en un comentario,
    // y un guardarraíl que mirase el texto entero se dispararía con su propia documentación.
    expect(rutaAleatorio).not.toMatch(/from '@\/lib\/config\/oposiciones'/)
    expect(picker).not.toMatch(/from '@\/lib\/config\/oposiciones'/)
  })

  it('el picker pasa positionType EXPLÍCITO a TestPageWrapper, nunca implícito', () => {
    expect(picker).toMatch(/positionType=\{positionType\}/)
    expect(picker).toMatch(/const positionType = `personalizada_\$\{personalizadaId\}`/)
  })

  it('los temas que ofrece el picker vienen del propio temario, no de una lista fija', () => {
    // Blindaje anti-regresión de "página propia, sin bloques": si alguien reintroduce
    // `getAllThemes`/bloques aquí, ha vuelto a acoplar esta pantalla al catálogo estático.
    expect(rutaAleatorio).not.toMatch(/getAllThemes|themeBlocks/)
    expect(picker).not.toMatch(/getAllThemes|themeBlocks/)
  })
})
