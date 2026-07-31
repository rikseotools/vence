// __tests__/auth/canonicalSub.test.ts
//
// [T-245] El `sub` acuñado debe existir en `user_profiles`. Caso real que lo motiva
// (28/07/2026): una sesión con `sub` sin perfil dejó a un usuario PREMIUM sin poder
// pagar (24 intentos rechazados con «User not found in database») ni avisarnos (el
// formulario de soporte falla por FK contra la misma tabla → el fallo se oculta solo).
import fs from 'fs'
import path from 'path'
import { decidirSub, userIdParaFeedback } from '@/lib/auth/canonicalSub'

const SUB_ROTO = '0f8e35ae-5ff9-48d3-8a43-3e348a103622' // el de la sesión, sin perfil
const SUB_BUENO = '8330df66-d308-4077-b439-21d43e8366fd' // el perfil real del email

describe('decidirSub', () => {
  it('caso normal: el sub tiene perfil → no se toca nada', () => {
    expect(decidirSub(SUB_BUENO, true, null)).toEqual({
      sub: SUB_BUENO,
      reconciliado: false,
      huerfano: false,
    })
  })

  it('el sub NO tiene perfil pero el email sí → se acuña con el id del email', () => {
    // Es exactamente el caso de pcsergio0@gmail.com el 28/07.
    expect(decidirSub(SUB_ROTO, false, SUB_BUENO)).toEqual({
      sub: SUB_BUENO,
      reconciliado: true,
      huerfano: false,
    })
  })

  it('ni sub ni email resuelven → NO se inventa identidad, pero se marca huérfano', () => {
    // Se acuña con el original para no tumbar la sesión; el `error` que emite el endpoint
    // es lo que impide que este usuario quede roto en silencio, que es como llegamos aquí.
    expect(decidirSub(SUB_ROTO, false, null)).toEqual({
      sub: SUB_ROTO,
      reconciliado: false,
      huerfano: true,
    })
  })

  it('si el email resuelve al MISMO sub, no cuenta como reconciliación', () => {
    // Defensa contra un falso positivo que inflaría la métrica del drenaje.
    expect(decidirSub(SUB_ROTO, false, SUB_ROTO)).toEqual({
      sub: SUB_ROTO,
      reconciliado: false,
      huerfano: true,
    })
  })

  it('NUNCA devuelve un sub vacío o distinto de los dos candidatos', () => {
    for (const [existe, porEmail] of [
      [true, null],
      [false, SUB_BUENO],
      [false, null],
    ] as Array<[boolean, string | null]>) {
      const d = decidirSub(SUB_ROTO, existe, porEmail)
      expect([SUB_ROTO, SUB_BUENO]).toContain(d.sub)
      expect(d.sub).toBeTruthy()
    }
  })
})

// GUARDARRAÍL DE CABLEADO: la decisión no sirve de nada si el endpoint deja de llamarla,
// y eso no lo ve ningún test de unidad (la función seguiría verde por su cuenta).
describe('[T-245] cableado en /api/auth/token', () => {
  const fuente = fs.readFileSync(
    path.join(process.cwd(), 'app/api/auth/token/route.ts'),
    'utf8',
  )

  it('reconcilia el sub ANTES de acuñar el token', () => {
    const iReconcilia = fuente.indexOf('canonicalSubForToken(')
    const iAcuna = fuente.indexOf('mintAccessToken({')
    expect(iReconcilia).toBeGreaterThan(-1)
    expect(iAcuna).toBeGreaterThan(-1)
    expect(iReconcilia).toBeLessThan(iAcuna)
  })

  it('acuña con el sub YA decidido, no con el de la sesión', () => {
    expect(fuente).toMatch(/userId\s*=\s*decision\.sub/)
  })

  it('emite señal cuando reconcilia o cuando el usuario queda huérfano', () => {
    expect(fuente).toContain('auth_sub_reconciliado')
    expect(fuente).toMatch(/decision\.huerfano \? 'error' : 'warn'/)
  })
})

// GUARDARRAÍL DE CABLEADO [T-434]: el alta que no consigue perfil tiene que DEJAR RASTRO.
//
// Por qué hace falta un guardarraíl y no basta con el código: el fallo ya existía y era
// invisible —`resolveAppUserId` solo dejaba un `console.warn`, que no se persiste en ningún
// sitio (medido el 31/07: 0 eventos en `observable_events` y en `validation_error_logs`)—
// mientras 29-31 usuarios AL DÍA navegaban con una sesión cuyo id no existe en
// `user_profiles`: sin stats, sin poder pagar (404 «User not found in database») y sin poder
// escribir a soporte. Si alguien quita esta emisión, el problema vuelve a ser mudo y solo se
// descubre cuando un usuario se queja… que es justo lo que no puede hacer.
describe('[T-434] cableado en el callback jwt de Auth.js', () => {
  const fuente = fs.readFileSync(path.join(process.cwd(), 'lib/auth/authjs.ts'), 'utf8')

  it('emite `auth_alta_sin_perfil` cuando resolveAppUserId no devuelve id', () => {
    expect(fuente).toContain('auth_alta_sin_perfil')
    // La emisión va en la rama del fallo, no en la del caso bueno.
    const iAsigna = fuente.indexOf('token.appUserId = appUserId')
    const iEmite = fuente.indexOf('auth_alta_sin_perfil')
    expect(iAsigna).toBeGreaterThan(-1)
    expect(iEmite).toBeGreaterThan(iAsigna)
  })

  it('la señal es `error`: el usuario queda sin poder pagar ni quejarse', () => {
    const bloque = fuente.slice(fuente.indexOf('auth_alta_sin_perfil') - 400, fuente.indexOf('auth_alta_sin_perfil') + 200)
    expect(bloque).toContain("severity: 'error'")
  })

  it('NUNCA manda el email en claro (solo prefijo y dominio)', () => {
    const bloque = fuente.slice(fuente.indexOf('auth_alta_sin_perfil'), fuente.indexOf('auth_alta_sin_perfil') + 500)
    expect(bloque).toContain('emailPrefijo')
    expect(bloque).not.toMatch(/email:\s*user\.email/)
  })
})

// ============================================================
// [T-245] Segunda línea de defensa: el mensaje del usuario NO se pierde
// ============================================================

describe('userIdParaFeedback', () => {
  it('identidad buena → se guarda con su usuario', () => {
    expect(userIdParaFeedback({ sub: SUB_BUENO, reconciliado: false, huerfano: false })).toBe(SUB_BUENO)
  })

  it('identidad reconciliada → se guarda con el usuario CORRECTO, no con el roto', () => {
    expect(userIdParaFeedback({ sub: SUB_BUENO, reconciliado: true, huerfano: false })).toBe(SUB_BUENO)
  })

  it('identidad irresoluble → user_id NULL (el mensaje se guarda igual, no se pierde)', () => {
    // Es la regla que evita el caso del 28/07: 4 mensajes perdidos con 500 porque la FK
    // rechazaba un id inexistente. Preferimos un mensaje sin usuario a ningún mensaje.
    expect(userIdParaFeedback({ sub: SUB_ROTO, reconciliado: false, huerfano: true })).toBeNull()
  })
})

describe('[T-245] guardarraíl: /api/feedback no confía en el id del cliente', () => {
  const queries = fs.readFileSync(path.join(process.cwd(), 'lib/api/feedback/queries.ts'), 'utf8')
  const ruta = fs.readFileSync(path.join(process.cwd(), 'app/api/feedback/route.ts'), 'utf8')

  it('NO inserta el userId del cuerpo a pelo', () => {
    expect(queries).not.toMatch(/userId:\s*params\.userId\s*\|\|\s*null/)
  })

  it('resuelve la identidad con el MISMO núcleo que el acuñado del token', () => {
    expect(queries).toContain('canonicalSubForToken')
    expect(queries).toContain('userIdParaFeedback')
  })

  it('la conversación usa el userId ya resuelto, no el del cuerpo', () => {
    expect(ruta).toMatch(/createFeedbackConversation\(\s*result\.data\.id,\s*result\.data\.userId/)
  })
})
