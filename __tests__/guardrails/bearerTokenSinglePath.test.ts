/**
 * Guardarraíl: hay UN solo camino para conseguir un Bearer en el cliente —
 * `auth.getAccessToken()` (puerto `lib/auth`). Nadie fuera de los adapters vuelve a
 * escribir su propia adquisición de token.
 *
 * Por qué existe (T-210, 28/07/2026). El patrón «`refreshSession()` y, si no, `getSession()`»
 * estaba COPIADO en 9 sitios: `lib/api/authHeaders.ts`, cinco clientes de `/api/v2/*`,
 * `utils/answerSaveQueue.ts`, `utils/psychometricSaveQueue.ts` y `utils/testAnswers.ts`.
 * Cada copia FUERZA una ida a la red: bajo Auth.js (proveedor vivo desde el 03/07)
 * `refreshSession()` re-acuña el RS256. Medido en producción con `auth_token_minted`
 * (muestreo 10%, ×10): **~58.400 acuñaciones/día** de un token que dura 1 h — p50 ≈ 60 por
 * usuario y día, máximo ≈ 2.960 — anulando la caché de token que se montó el 15/07 justo
 * para cortar ese flood. Y en el camino crítico: `answerSaveQueue` acuñaba un token por
 * respuesta guardada, y cada ida a la red es una oportunidad de fallo transitorio (los
 * `[answerSaveQueue] Sin token`, 219 eventos/24 h).
 *
 * Qué se prohíbe, EXACTAMENTE: el patrón de ADQUISICIÓN, o sea un `refreshSession()`
 * seguido de un `getSession()` como respaldo para sacar un `accessToken`. Es lo que se
 * puede detectar mecánicamente sin ambigüedad.
 *
 * Qué NO se prohíbe (usos legítimos de `refreshSession()`, y por eso el check es estrecho —
 * un guardarraíl que grita en falso se acaba ignorando):
 *   · renovar la sesión para que traiga claims nuevos (`app/premium/page.tsx` tras la
 *     compra: el usuario pasa a premium y hay que releer su estado);
 *   · reintentar UNA vez tras un 401 del servidor (`utils/testAnswers.ts`, Nivel 2);
 *   · los propios adapters de `lib/auth/`, que son los dueños de la mecánica.
 */

import { readFileSync, readdirSync, statSync } from 'fs'
import { join, relative } from 'path'

const ROOT = process.cwd()
// Directorios de código de CLIENTE donde podría reaparecer la copia.
const CLIENT_DIRS = ['app', 'components', 'contexts', 'hooks', 'lib', 'utils']
const SKIP_DIRS = new Set(['node_modules', '.next', '.git', '__tests__', 'backend', 'e2e'])

/**
 * Exención: los adapters SON el dueño del cómo. `lib/auth/adapters/*` implementa
 * `getAccessToken()` y ahí sí se llama a `refreshSession()` del SDK.
 */
const ALLOWED = [/^lib\/auth\//]

function walk(dir: string, out: string[] = []): string[] {
  let entries: string[]
  try { entries = readdirSync(dir) } catch { return out }
  for (const e of entries) {
    if (SKIP_DIRS.has(e)) continue
    const p = join(dir, e)
    if (statSync(p).isDirectory()) walk(p, out)
    else if (/\.(tsx|ts|js|jsx)$/.test(e)) out.push(p)
  }
  return out
}

/** Quita comentarios de línea y de bloque: este mismo fichero (y los que documentan el
 *  cambio) mencionan el patrón en prosa, y una mención no es una llamada. */
function stripComments(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^[ \t]*\/\/.*$/gm, '')
}

/**
 * El patrón de ADQUISICIÓN: una llamada `await …refreshSession()` y, dentro de las ~12
 * líneas siguientes, un `await …getSession()` de respaldo. La ventana es lo que ocupaba
 * cualquiera de las 9 copias reales (la más larga, la de `answerSaveQueue`, cabía en 10).
 *
 * Se exige el `await` a propósito, y no por estilo: las 9 copias reales lo tenían todas
 * (es código asíncrono), y sin él el detector marcaba las MENCIONES en prosa dentro de
 * strings — se autodenunció al registrar la herramienta en `lib/admin/toolRegistry.ts`,
 * cuya descripción cita el patrón para explicar qué se arregló. Quitar comentarios no
 * basta; hay prosa dentro de literales de texto.
 */
function acquisitionPattern(src: string): number[] {
  const clean = stripComments(src)
  const lines = clean.split('\n')
  const hits: number[] = []
  const REFRESH = /await\s+[\w.]*refreshSession\s*\(\s*\)/
  const GET = /await\s+[\w.]*getSession\s*\(\s*\)/
  for (let i = 0; i < lines.length; i++) {
    if (!REFRESH.test(lines[i])) continue
    const ventana = lines.slice(i, i + 12).join('\n')
    if (GET.test(ventana)) hits.push(i + 1)
  }
  return hits
}

describe('guardarraíl: un solo camino para el Bearer del cliente', () => {
  const files = CLIENT_DIRS.flatMap((d) => walk(join(ROOT, d)))

  test('hay ficheros de cliente que analizar (el propio barrido no está roto)', () => {
    expect(files.length).toBeGreaterThan(100)
  })

  test('nadie fuera de lib/auth reimplementa la adquisición del token', () => {
    const ofensores: string[] = []
    for (const f of files) {
      const rel = relative(ROOT, f)
      if (ALLOWED.some((re) => re.test(rel))) continue
      const hits = acquisitionPattern(readFileSync(f, 'utf8'))
      for (const line of hits) ofensores.push(`${rel}:${line}`)
    }

    expect(ofensores).toEqual([])
  })

  test('el detector reconoce el patrón que se prohíbe (no es un test que siempre pasa)', () => {
    // Las 9 copias reales tenían esta forma; si el regex deja de reconocerla, el
    // guardarraíl estaría verde por no mirar nada.
    const copiaReal = `
      async function getToken(): Promise<string | undefined> {
        try {
          const refreshed = await auth.refreshSession()
          if (refreshed?.accessToken) return refreshed.accessToken
        } catch {}
        const session = await auth.getSession()
        return session?.accessToken
      }
    `
    expect(acquisitionPattern(copiaReal)).toHaveLength(1)
  })

  test('no marca los usos legítimos: renovar claims, y reintentar tras un 401', () => {
    const trasCompra = `
      await auth.refreshSession()
      setPremium(true)
    `
    const retryTras401 = `
      if (response.status === 401) {
        const retryRefresh = await auth.refreshSession()
        if (retryRefresh?.accessToken) { await fetch(url, headersCon(retryRefresh.accessToken)) }
      }
    `
    expect(acquisitionPattern(trasCompra)).toEqual([])
    expect(acquisitionPattern(retryTras401)).toEqual([])
  })

  test('una MENCIÓN en un comentario no cuenta como llamada', () => {
    const soloComentario = `
      // Antes hacía refreshSession() y luego getSession() como respaldo (T-210).
      /* refreshSession() + getSession() */
      const t = await auth.getAccessToken()
    `
    expect(acquisitionPattern(soloComentario)).toEqual([])
  })

  test('una MENCIÓN dentro de un string tampoco (el falso positivo que se autodenunció)', () => {
    // Caso real: la ficha de la herramienta en `lib/admin/toolRegistry.ts` describe el
    // patrón en prosa para explicar qué se arregló. Quitar comentarios no bastaba.
    const enString = `
      notas:
        'Causa: 9 copias del patrón «refreshSession() y si no getSession()» que forzaban ' +
        'la re-acuñación saltándose la caché del adapter.',
    `
    expect(acquisitionPattern(enString)).toEqual([])
  })

  test('el puerto sigue declarando getAccessToken como el verbo del Bearer', () => {
    // Si alguien retirara el verbo del puerto, las copias volverían por necesidad.
    const types = readFileSync(join(ROOT, 'lib/auth/types.ts'), 'utf8')
    expect(types).toMatch(/getAccessToken\(\)\s*:\s*Promise<string \| undefined>/)
  })

  test('los dos adapters comparten el núcleo puro de frescura (una sola definición)', () => {
    // El origen de T-210 fue tener dos criterios de "¿hay que ir a la red?" conviviendo.
    for (const adapter of ['lib/auth/adapters/authjsAdapter.ts', 'lib/auth/adapters/supabaseAdapter.ts']) {
      expect(readFileSync(join(ROOT, adapter), 'utf8')).toMatch(/from '\.\.\/tokenFreshness'/)
    }
    // Y nadie más redefine el margen por su cuenta.
    const redefiniciones = files
      .map((f) => relative(ROOT, f))
      .filter((rel) => rel !== 'lib/auth/tokenFreshness.ts')
      .filter((rel) => /TOKEN_SKEW_SEC\s*=/.test(readFileSync(join(ROOT, rel), 'utf8')))
    expect(redefiniciones).toEqual([])
  })
})
