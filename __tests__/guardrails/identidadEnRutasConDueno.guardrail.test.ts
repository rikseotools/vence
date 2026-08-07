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

/** Rutas de API cuya guarda comprueba el dueño del recurso. */
function rutasConDueno(): string[] {
  const salida = execSync(
    `grep -rl "requireDuenoDelRecurso" ${path.join(RAIZ, 'app/api')} || true`,
    { encoding: 'utf8' },
  )
  return salida
    .split('\n')
    .filter(Boolean)
    .map((f) => f.replace(path.join(RAIZ, 'app'), '').replace(/\/route\.(ts|js)$/, ''))
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
      } else if (/\.tsx?$/.test(e.name)) out.push(p)
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
