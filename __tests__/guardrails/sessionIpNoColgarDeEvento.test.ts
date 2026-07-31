/**
 * @jest-environment node
 *
 * Guardarraíl: el registro de IP de sesión NO puede volver a depender de un evento de auth.
 *
 * Historia (T-314): estuvo colgado de `SIGNED_IN`. Al flipear a Auth.js —cuyo adaptador emula los
 * eventos por polling y emite `INITIAL_SESSION` a quien vuelve con la cookie de 30 días— ese
 * evento dejó de llegar y el registro cayó del 80% al 1%. **27 días roto sin una sola señal.**
 *
 * Se vigila por lectura de código porque es un CABLEADO: no hay forma de detectarlo en runtime
 * salvo por la ausencia de datos, que es justo lo que tardó cuatro semanas en verse.
 */
import { readFileSync } from 'fs'
import { join } from 'path'

const ROOT = join(__dirname, '..', '..')
const authContext = readFileSync(join(ROOT, 'contexts/AuthContext.tsx'), 'utf-8')

describe('registro de IP de sesión — cableado (T-314)', () => {
  it('se dispara TAMBIÉN en INITIAL_SESSION, que es el caso real con cookie viva', () => {
    // El bloque de INITIAL_SESSION con usuario debe llamar al tracking. Sin esto volvemos al 1%.
    const iInicial = authContext.indexOf("event === 'INITIAL_SESSION'")
    expect(iInicial).toBeGreaterThan(-1)
    const bloque = authContext.slice(iInicial, iInicial + 2000)
    expect(bloque).toMatch(/trackSessionIPIfDue\(/)
  })

  it('la decisión vive en el núcleo puro, no inline en el contexto', () => {
    expect(authContext).toMatch(/from '@\/lib\/security\/sessionIpTracking'/)
    expect(authContext).toMatch(/shouldTrackSessionIp/)
  })

  it('no se llama al tracking crudo sin pasar por la decisión de ventana', () => {
    // `trackSessionIP(` a secas solo puede aparecer en su definición y dentro del wrapper.
    const llamadasCrudas = [...authContext.matchAll(/(?<!IfDue|const )\btrackSessionIP\(/g)]
    // 1 = la llamada de dentro de `trackSessionIPIfDue`. Más de eso es un atajo que se salta la
    // ventana y convierte cada navegación en una escritura.
    expect(llamadasCrudas.length).toBeLessThanOrEqual(1)
  })

  it('el endpoint sigue existiendo (el fallo era el disparador, no el receptor)', () => {
    const endpoint = readFileSync(join(ROOT, 'app/api/auth/track-session-ip/route.ts'), 'utf-8')
    expect(endpoint).toMatch(/userSessions/)
  })
})

/**
 * Segunda capa del mismo fallo (31/07/2026): con el disparador ya arreglado, la cobertura se quedó
 * en el 2% porque la IP se escribía en la fila EQUIVOCADA — una sesión de otro día, elegida a
 * ciegas porque la de hoy aún no existía. La vía correcta es que la sesión NAZCA con su IP.
 *
 * También por lectura de código: si alguien deja de pasar el origen en la ruta, en runtime no falla
 * nada. Simplemente vuelven las sesiones sin IP y nadie se entera hasta el siguiente barrido.
 */
describe('la sesión nace con su IP — cableado de la ruta que la crea (T-314)', () => {
  const ruta = readFileSync(join(ROOT, 'app/api/v2/user-sessions/route.ts'), 'utf-8')

  it('la ruta resuelve la IP con el módulo compartido y se la pasa a createUserSession', () => {
    expect(ruta).toMatch(/from '@\/lib\/api\/clientIp'/)
    const iCreate = ruta.indexOf('createUserSession(')
    expect(iCreate).toBeGreaterThan(-1)
    const llamada = ruta.slice(iCreate, iCreate + 400)
    expect(llamada).toMatch(/ipAddress:\s*getClientIp\(request\)/)
  })

  it('la IP la pone el SERVIDOR, nunca el body: el esquema del request no la admite', () => {
    // Si `ipAddress` entrara por el body, cualquier navegador podría decir desde dónde estudia.
    const schemas = readFileSync(join(ROOT, 'lib/api/v2/user-sessions/schemas.ts'), 'utf-8')
    expect(schemas).not.toMatch(/ipAddress/)
  })

  it('el rescate posterior no puede volver a estampar una sesión de otro día', () => {
    const endpoint = readFileSync(join(ROOT, 'app/api/auth/track-session-ip/route.ts'), 'utf-8')
    // La búsqueda a ciegas debe estar acotada por la antigüedad de la sesión.
    expect(endpoint).toMatch(/SESSION_IP_MAX_AGE_MIN/)
    const iSelect = endpoint.indexOf('.select({ id: userSessions.id })')
    expect(iSelect).toBeGreaterThan(-1)
    expect(endpoint.slice(iSelect, iSelect + 700)).toMatch(/gte\(userSessions\.sessionStart/)
  })
})
