/**
 * [T-669] Una ruta que comprueba DE QUIÉN es el recurso necesita que el cliente mande identidad.
 * Si no la manda, el servidor ve un anónimo y **bloquea al propio dueño** con un 403.
 *
 * ── EL INCIDENTE, medido el 07/08/2026 ──────────────────────────────────────────────────────
 * [T-565] puso —con razón— una guarda de propiedad en `exam/*` y `psychometric/*`: antes, con solo
 * el UUID del test se leían las respuestas de otra persona. Pero varios clientes llamaban a esas
 * rutas con `fetch(url, { headers: { 'Content-Type': ... } })` y nada más. El resultado no fue una
 * puerta cerrada a un intruso, fue **el usuario que termina su examen, pulsa corregir y ve «no
 * tienes conexión»**: 190 rechazos en `/api/exam/validate` en 24 h, **191 de 222 sin identidad del
 * que pedía**, 20 personas distintas y cuatro usuarias premium escribiendo el mismo día. Cero en
 * los diez días anteriores.
 *
 * ── POR QUÉ ESTE TEST Y NO OTRA COSA ────────────────────────────────────────────────────────
 * El fallo no está ni en la guarda (correcta) ni en el cliente (razonable cuando se escribió):
 * está en que **las dos mitades se decidieron por separado**. Añadir la guarda a una ruta nueva es
 * fácil; acordarse de que sus clientes tienen que mandar el token, no. Esto lo cruza automáticamente:
 * por cada ruta con `requireDuenoDelRecurso`, quien la llame desde el navegador tiene que mandar
 * identidad. Es un cruce entre servidor y cliente, que es justo lo que ningún test de un lado ve.
 */
import fs from 'fs'
import path from 'path'
import { execSync } from 'child_process'

const RAIZ = process.cwd()

/** Rutas de API que aplican una guarda de identidad, por el nombre de la guarda. */
function rutasConGuarda(guarda: string): string[] {
  const salida = execSync(
    `grep -rl "${guarda}" ${path.join(RAIZ, 'app/api')} || true`,
    { encoding: 'utf8' },
  )
  return salida
    .split('\n')
    .filter(Boolean)
    .map((f) => f.replace(path.join(RAIZ, 'app'), '').replace(/\/route\.(ts|js)$/, ''))
}

/** Rutas de API cuya guarda comprueba el dueño del recurso. */
function rutasConDueno(): string[] {
  return rutasConGuarda('requireDuenoDelRecurso')
}

/**
 * Rutas que exigen que quien pide SEA el usuario del token ([T-671]).
 *
 * Es la GEMELA de la de arriba y hacía falta, porque el mismo descuido tiene dos caras y esta
 * pasó desapercibida mientras se arreglaba la otra: `requireDuenoDelRecurso` responde **403** a
 * quien no manda identidad, y `requireUsuarioPropio` responde **401**. Al mirar solo los 403 se vio
 * `/api/exam/validate` (190 rechazos, 20 personas) y NO se vio el grupo de lectura, que era mucho
 * mayor: **`/api/v2/user-stats` con 4.114 respuestas 401 sobre 4.329 peticiones —el 95%— y 248
 * usuarios**, más `/api/exam/pending` (254 usuarios) y `/api/psychometric/completed-sessions`.
 * Efecto para el usuario: las estadísticas en blanco y los exámenes pendientes desaparecidos.
 */
function rutasDeUsuarioPropio(): string[] {
  return rutasConGuarda('requireUsuarioPropio')
}

/** Todos los .ts/.tsx del navegador, una sola vez (recorrer con `grep` por shell rompía con la
 * comilla invertida de las plantillas: el patrón que hay que buscar la lleva dentro). */
function ficherosDeCliente(): string[] {
  const out: string[] = []
  const anda = (dir: string) => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, e.name)
      if (e.isDirectory()) {
        if (e.name === 'node_modules' || e.name === '.next' || p.includes(`${path.sep}app${path.sep}api`)) continue
        anda(p)
      // `.js`/`.jsx` TAMBIÉN ([T-675]): al ampliar esto a las dos guardas seguían quedando fuera
      // dos llamadas sin token —`components/UserProfileModal.js` a `/api/v2/user-stats` y
      // `app/test/aleatorio-examen/page.js` a `/api/exam/resume`— **invisibles solo por su
      // extensión**. El repo mezcla las cuatro y la extensión no dice nada sobre si el fichero
      // manda identidad: un barrido que elige por extensión deja un hueco del tamaño de lo que no
      // mira, y aquí ese hueco tenía dentro un endpoint con dueño.
      } else if (/\.[jt]sx?$/.test(e.name)) out.push(p)
    }
  }
  for (const d of ['components', 'lib', 'app']) {
    const p = path.join(RAIZ, d)
    if (fs.existsSync(p)) anda(p)
  }
  return out
}

const CLIENTES = ficherosDeCliente().map((f) => ({ f, src: fs.readFileSync(f, 'utf8') }))

/** Ficheros de cliente que hacen una llamada REAL (`fetch('<ruta>` / plantilla) a esa ruta. */
function clientesQueLlaman(ruta: string): string[] {
  // Solo llamadas reales: una mención en un comentario o en un esquema no es una llamada, y
  // contarla llenaría esto de ruido — que es como un guardarraíl se acaba ignorando.
  //
  // Y la ruta tiene que acabar AHÍ. Sin exigirlo, `/api/psychometric/complete` casaba dentro de
  // `/api/psychometric/completed-sessions` —otra ruta, sin guarda de propiedad— y el guardarraíl
  // acusaba a un fichero sano. Se acepta lo que de verdad cierra una URL: la comilla, un `?` de
  // query o una `/` de subruta.
  const re = new RegExp(`fetch\\(\\s*[\`'"]${ruta.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}[?/\`'"]`)
  return CLIENTES.filter(({ src }) => re.test(src)).map(({ f }) => f)
}

describe('[T-669] quien llama a una ruta con dueño manda identidad', () => {
  const rutas = rutasConDueno()

  it('hay rutas con guarda de propiedad (si no, el cruce no mide nada)', () => {
    // Un cero aquí significaría que el grep dejó de encontrarlas —por un cambio de nombre de la
    // guarda, por ejemplo— y entonces este fichero pasaría en verde sin comprobar nada.
    expect(rutas.length).toBeGreaterThan(3)
  })

  it.each(rutas)('%s: sus clientes de navegador adjuntan el token', (ruta) => {
    const fallan = clientesQueLlaman(ruta).filter((f) => {
      const src = fs.readFileSync(f, 'utf8')
      // Vale cualquiera de las formas legítimas: el helper canónico, o pasar cabeceras ya
      // construidas por él. Lo que NO vale es no mandar nada.
      return !/getAuthHeaders|authHeaders|Authorization/.test(src)
    })
    expect(fallan).toEqual([])
  })
})

describe('[T-671] quien llama a una ruta de usuario propio manda identidad', () => {
  const rutas = rutasDeUsuarioPropio()

  it('hay rutas con guarda de usuario propio (si no, el cruce no mide nada)', () => {
    expect(rutas.length).toBeGreaterThan(3)
  })

  it.each(rutas)('%s: sus clientes de navegador adjuntan el token', (ruta) => {
    const fallan = clientesQueLlaman(ruta).filter((f) => {
      const src = fs.readFileSync(f, 'utf8')
      return !/getAuthHeaders|authHeaders|Authorization/.test(src)
    })
    expect(fallan).toEqual([])
  })
})

/**
 * [T-692] Mandar el token no basta: hay que ENTERARSE cuando no se pudo mandar.
 *
 * Los dos bloques de arriba comprueban que el código PIDE el token. Este comprueba que, si no
 * lo hay, la petición no sale a morir en silencio. `getAuthHeaders()` devolvía `{}` y la llamada
 * salía igual; como el navegador adjunta la cookie por su cuenta, el servidor no lo distingue de
 * una sesión con credenciales malas, así que el 401 se contabiliza como rechazo legítimo y el
 * defecto es INVISIBLE. Medido el 08/08/2026: `/api/exam/pending` pasó de NUEVE DÍAS a 0,0 % de
 * 401 al 44,2 % (18 usuarios/día) y `/api/v2/user-stats` llevaba un 20-36 % DIARIO de antes;
 * 7.000 rechazos en 24 h sin que constara el motivo en ninguna parte.
 *
 * ── POR QUÉ TRINQUETE Y NO «TODAS AHORA» ────────────────────────────────────────────────────
 * Hay 24 rutas con guarda y, al medirlo, 22 llamadas no lo declaraban. Exigirlo a todas de golpe
 * pone esto en rojo el día que nace, y un guardarraíl que nace rojo se ignora (la misma lección
 * que mató de aviso a `landing_cifra_sin_respaldo`). Así que se cierra donde el daño está MEDIDO
 * —las dos rutas del incidente— y para el resto se pone un techo que solo puede BAJAR.
 */
describe('[T-692] la llamada a una ruta con dueño avisa si se queda sin token', () => {
  /** Las dos del incidente medido: aquí se exige, no se tolera. */
  const RUTAS_MEDIDAS = ['/api/exam/pending', '/api/v2/user-stats']

  /**
   * Cuántas llamadas a rutas con guarda siguen SIN declarar `exigeSesion`. Eran 22 al empezar
   * [T-692] y quedan **21** tras cubrir las dos rutas del incidente; este número **solo puede
   * bajar**: al cubrir una, se baja el techo. Si sube, es que alguien añadió una llamada nueva
   * sin la declaración — que es exactamente cómo nacieron [T-671] y [T-675].
   */
  const TECHO_SIN_DECLARAR = 21

  const declara = (f: string) => /exigeSesion/.test(fs.readFileSync(f, 'utf8'))

  it.each(RUTAS_MEDIDAS)('%s: todos sus clientes declaran exigeSesion', (ruta) => {
    const llamantes = clientesQueLlaman(ruta)
    // Sin llamantes esto no mide nada y pasaría en verde por vacío.
    expect(llamantes.length).toBeGreaterThan(0)
    expect(llamantes.filter((f) => !declara(f))).toEqual([])
  })

  it(`el resto no crece (techo ${TECHO_SIN_DECLARAR}, solo puede bajar)`, () => {
    const todas = [...new Set([...rutasConDueno(), ...rutasDeUsuarioPropio()])]
    const sin = new Set<string>()
    for (const ruta of todas) {
      for (const f of clientesQueLlaman(ruta)) if (!declara(f)) sin.add(`${f} → ${ruta}`)
    }
    expect(sin.size).toBeLessThanOrEqual(TECHO_SIN_DECLARAR)
  })
})
