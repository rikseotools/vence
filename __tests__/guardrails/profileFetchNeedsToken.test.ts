/**
 * Guardarraíl: toda llamada del CLIENTE a /api/profile debe mandar el token.
 *
 * El 08/07/2026 (commit d7634fa5) `/api/profile` dejó de fiarse del `?userId=` del cliente y
 * pasó a derivar la identidad del TOKEN (arreglo de seguridad correcto: el `?userId=` era un
 * IDOR). Pero dos llamadas de `app/perfil/page.tsx` se quedaron sin migrar y seguían llamando
 * `fetch('/api/profile?userId=' + user.id)` SIN cabeceras → 401 "No autenticado".
 *
 * Coste real, medido el 16/07: **663 errores, 180 usuarios en 8 días** (94 solo el día
 * anterior). Y no es un error cosmético: al recibir 401 el cliente cree que el usuario NO
 * TIENE perfil → llama a createInitialProfile → ensure-profile → repite la llamada rota →
 * lanza "perfil no disponible" y **la página de perfil se rompe**. Una usuaria (Susana, free,
 * registrada ese mismo día) abrió su perfil, recibió los 2 401 y **borró su cuenta 31 segundos
 * después**. Diez minutos de vida como usuaria.
 *
 * Por qué este test y no un barrido genérico: un regex sobre todas las llamadas del cliente da
 * ~22 falsos positivos (no reconoce `{ headers }` en atajo, ni variables, ni `Authorization`
 * inline). Este check es ESTRECHO a propósito — solo /api/profile, solo ficheros de cliente —
 * porque un guardarraíl que grita en falso se acaba ignorando.
 */

import { readFileSync, readdirSync, statSync } from 'fs'
import { join } from 'path'

// Ficheros de cliente que llaman a /api/profile (no los route.ts del servidor).
const CLIENT_DIRS = ['app', 'components', 'contexts', 'hooks', 'lib']
const SKIP = new Set(['node_modules', '.next', '.git', '__tests__'])

function walk(dir: string, out: string[] = []): string[] {
  let entries: string[]
  try { entries = readdirSync(dir) } catch { return out }
  for (const e of entries) {
    if (SKIP.has(e)) continue
    const p = join(dir, e)
    if (statSync(p).isDirectory()) walk(p, out)
    else if (/\.(tsx|ts|js|jsx)$/.test(e) && !/route\.(ts|js)$/.test(e)) out.push(p)
  }
  return out
}

/**
 * Bloque de la llamada fetch a /api/profile EXACTO: desde `fetch(` hasta el cierre del objeto
 * de opciones.
 *
 * Se excluyen los SUBPATHS (`/api/profile/avatar-settings`, `/api/profile/email-preferences`,
 * `/api/profile/target`…): verificado el 16/07 — NO usan verifyAuth, siguen tomando el userId
 * del query y no generan 401 en producción. Marcarlos sería un falso positivo, y un guardarraíl
 * que grita en falso se acaba ignorando. Solo el endpoint raíz migró a identidad-por-token.
 */
function profileFetchBlocks(src: string): { block: string; line: number }[] {
  const out: { block: string; line: number }[] = []
  const re = /fetch\(\s*[`'"]\/api\/profile(?![a-zA-Z0-9/_-])/g
  let m: RegExpExecArray | null
  while ((m = re.exec(src))) {
    // 260 caracteres bastan para abarcar el objeto de opciones de una llamada normal
    out.push({ block: src.slice(m.index, m.index + 260), line: src.slice(0, m.index).split('\n').length })
  }
  return out
}

const sendsToken = (block: string) =>
  /getAuthHeaders|Authorization|authHeaders|headers:\s*headers\b|headers\s*\}|\{\s*headers\s*\}/.test(block)

describe('/api/profile — el cliente SIEMPRE debe mandar el token', () => {
  const files = CLIENT_DIRS.flatMap(d => walk(join(process.cwd(), d)))

  test('hay llamadas a /api/profile que auditar (el test no es un no-op)', () => {
    const total = files.reduce((n, f) => n + profileFetchBlocks(readFileSync(f, 'utf8')).length, 0)
    expect(total).toBeGreaterThan(0)
  })

  test('ninguna llamada del cliente a /api/profile va sin cabecera de autorización', () => {
    const rotas: string[] = []
    for (const f of files) {
      for (const { block, line } of profileFetchBlocks(readFileSync(f, 'utf8'))) {
        if (!sendsToken(block)) rotas.push(`${f.replace(process.cwd() + '/', '')}:${line}`)
      }
    }
    // Si esto falla: el endpoint deriva la identidad del token (d7634fa5). Sin cabecera
    // responde 401 y la página de perfil revienta. Añade `headers: await getAuthHeaders()`.
    expect(rotas).toEqual([])
  })

  test('la carga del perfil en /perfil manda el token (la que rompió 8 días)', () => {
    const src = readFileSync(join(process.cwd(), 'app/perfil/page.tsx'), 'utf8')
    const bloques = profileFetchBlocks(src)
    expect(bloques.length).toBeGreaterThanOrEqual(2)
    for (const { block } of bloques) expect(sendsToken(block)).toBe(true)
  })
})
