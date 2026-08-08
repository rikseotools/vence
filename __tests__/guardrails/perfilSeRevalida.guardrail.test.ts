/**
 * @jest-environment node
 */
// T-352 — un `appUserId` PUESTO no es un `appUserId` que sigue existiendo.
//
// ## Qué fija este fichero, y por qué es un guardarraíl y no un test normal
//
// `decidirReintentoPerfil` (T-434) solo repara la sesión cuando `appUserId` está VACÍO. En
// cuanto tiene cualquier valor, lo da por bueno para siempre — y si el perfil detrás desaparece
// DESPUÉS del primer sign-in (borrado de cuenta, entre otras causas), la sesión queda apuntando
// a un id fantasma indefinidamente: un JWT sin estado en servidor no expira solo.
//
// Caso real (31/07-06/08): un id con 247 eventos en 3 días, 44 acuñados de token (200 OK) y
// CERO fila en `user_profiles` desde el primer evento — nunca se revalidó porque nunca estuvo
// vacío. El código que lo cierra es correcto a la vista si se lee solo; lo que falla si se
// borra es que ALGUIEN vuelva a dejar la resolución colgando de "¿está vacío?" sin más. Un test
// de comportamiento del núcleo puro no lo vería: con la llamada borrada del callback, los
// unitarios de `decidirRevalidacionPerfil` siguen en verde.

import { readFileSync } from 'fs'
import { join } from 'path'

const ROOT = join(__dirname, '..', '..')
const AUTHJS = readFileSync(join(ROOT, 'lib/auth/authjs.ts'), 'utf8')
const REGLAS = readFileSync(join(ROOT, 'backend/src/alerts/alert-rules.ts'), 'utf8')

describe('la revalidación está CABLEADA en el callback jwt', () => {
  it('`authjs.ts` importa y llama al núcleo puro de la decisión', () => {
    expect(AUTHJS).toMatch(/from '\.\/revalidacionPerfil'/)
    expect(AUTHJS).toMatch(/decidirRevalidacionPerfil\(\s*token\s*,/)
  })

  it('solo se llama cuando el reintento dice `ya_resuelto` (si no, se duplica la decisión)', () => {
    const iYaResuelto = AUTHJS.indexOf("decision.accion === 'ya_resuelto'")
    const iRevalidacion = AUTHJS.indexOf('decidirRevalidacionPerfil(')
    expect(iYaResuelto).toBeGreaterThan(-1)
    expect(iRevalidacion).toBeGreaterThan(iYaResuelto)
  })

  it('vive FUERA del bloque de sign-in (si no, no corre en las rotaciones)', () => {
    // Misma condición que causó el fallo original de T-434: `user` solo existe en el primer
    // sign-in.
    const bloqueSignIn = AUTHJS.indexOf('if (user?.email)')
    const llamada = AUTHJS.indexOf('decidirRevalidacionPerfil(')
    expect(bloqueSignIn).toBeGreaterThan(-1)
    expect(llamada).toBeGreaterThan(bloqueSignIn)
    expect(llamada).toBeLessThan(AUTHJS.lastIndexOf('return token'))
  })

  it('la revalidación REÚSA canonicalSubForToken (T-245), no reimplementa el criterio', () => {
    expect(AUTHJS).toMatch(/canonicalSubForToken\(\s*revalidacion\.appUserId/)
  })

  it('se deja marca de la revalidación (sin ella, cada carga de página pagaría una consulta)', () => {
    expect(AUTHJS).toMatch(/token\[CAMPO_REVALIDACION\] = Math\.floor\(Date\.now\(\) \/ 1000\)/)
  })
})

describe('lo que la revalidación hace con cada resultado', () => {
  it('reconciliado: el token se ACTUALIZA con el sub bueno (si no, se vuelve a romper en la siguiente rotación)', () => {
    const bloque = AUTHJS.slice(AUTHJS.indexOf('d.reconciliado'), AUTHJS.indexOf('d.huerfano'))
    expect(bloque).toMatch(/token\.appUserId = d\.sub/)
  })

  it('huérfano: se LIMPIA `appUserId` para que el reintento normal lo recoja después (no se duplica la lógica de "no se pudo")', () => {
    const bloque = AUTHJS.slice(AUTHJS.indexOf('d.huerfano'), AUTHJS.indexOf('} catch (err) {'))
    expect(bloque).toMatch(/delete token\.appUserId/)
  })

  it('las dos ramas emiten el mismo eventType con `resultado` distinto (una sola señal, filtrable)', () => {
    const ocurrencias = AUTHJS.match(/eventType: 'auth_perfil_revalidado'/g) || []
    expect(ocurrencias.length).toBe(2)
    expect(AUTHJS).toMatch(/resultado: 'reconciliado'/)
    expect(AUTHJS).toMatch(/resultado: 'huerfano'/)
  })

  it('esa señal TIENE quien la vigile (si no, es un hueco)', () => {
    expect(REGLAS).toContain('auth_perfil_revalidado')
    expect(REGLAS).toContain('RULE_PERFIL_REVALIDADO_HUERFANO as AlertRule')
  })

  it('el email NUNCA viaja en claro en la metadata de esta señal', () => {
    const bloqueRevalidacion = AUTHJS.slice(
      AUTHJS.indexOf('decidirRevalidacionPerfil('),
      AUTHJS.indexOf('} catch (err) {'),
    )
    const metadatas = bloqueRevalidacion.match(/metadata: \{[\s\S]*?\}/g) || []
    for (const m of metadatas) {
      expect(m).not.toMatch(/\bemail:\s*(revalidacion\.email|token\.email)/)
    }
  })
})

// LA MISMA REGLA QUE EL REINTENTO: UNA REPARACIÓN NO PUEDE TUMBAR AQUELLO QUE REPARA.
describe('la revalidación comparte el try/catch del reintento — no puede romper la sesión', () => {
  it('la llamada vive DENTRO del mismo bloque try que decidirReintentoPerfil', () => {
    const iReintento = AUTHJS.indexOf('decidirReintentoPerfil(token')
    const iRevalidacion = AUTHJS.indexOf('decidirRevalidacionPerfil(')
    const iTry = AUTHJS.lastIndexOf('try {', iReintento)
    const iCatch = AUTHJS.indexOf('} catch (err) {', iReintento)
    expect(iTry).toBeGreaterThan(-1)
    expect(iCatch).toBeGreaterThan(iRevalidacion)
    expect(iRevalidacion).toBeGreaterThan(iTry)
  })
})
