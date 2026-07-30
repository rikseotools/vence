// GUARDARRAÍL: el candado de la suplantación se aplica en TODAS las ramas del verificador.
//
// ## De dónde sale (30/07/2026)
//
// La suplantación (T-289) es de solo lectura porque `verifyAuth` rechaza las escrituras
// cuando el token lleva la marca `imp`. Al construirla, esa guarda se puso **solo en la rama
// `mode === 'on'`** — la que corre hoy en producción.
//
// El fallo no era visible: en producción funcionaba. Pero `JWT_LOCAL_VERIFY_MODE` es una
// **variable de entorno**, no código: cambiarla a `off` o `shadow` —algo que se hace para
// diagnosticar un problema de auth, sin desplegar nada— habría dejado la suplantación
// pudiendo ESCRIBIR en la cuenta de un usuario, y sin ninguna señal de que la protección se
// había caído. Lo encontró la pregunta de Manuel: *«¿esta sesión está protegida con todas
// las capas posibles?»*.
//
// Regla: una protección que depende de qué rama se ejecute no es una protección.
import { readFileSync } from 'fs'
import { join } from 'path'

const src = readFileSync(join(process.cwd(), 'lib/api/auth/verifyAuth.ts'), 'utf8')

describe('el candado de suplantación cubre las tres ramas', () => {
  it('las tres ramas siguen existiendo (si cambia el diseño, este test debe revisarse)', () => {
    expect(src).toMatch(/mode === 'off'/)
    expect(src).toMatch(/mode === 'on'/)
    expect(src).toMatch(/verifiedBy: 'shadow_remote'/)
  })

  it('cada salida con éxito pasa antes por el candado', () => {
    // Contamos: hay 3 retornos `success: true` (uno por rama) y tiene que haber al menos
    // 3 llamadas al bloqueo. Si alguien añade una cuarta rama sin candado, esto se cae.
    const exitos = (src.match(/success: true,/g) || []).length
    const candados = (src.match(/bloquearSiEscribeSuplantando\(/g) || []).length
    // -1 porque una de las apariciones es la propia definición de la función.
    expect(candados - 1).toBeGreaterThanOrEqual(exitos)
  })

  it('y cada salida con éxito pasa antes por el RELOJ (T-335)', () => {
    // Mismo razonamiento que el candado, para la otra mitad de la protección: el candado
    // impide escribir con una suplantación viva; el reloj impide seguir usándola cuando ya
    // ha terminado. Una sin la otra deja el agujero por el que se coló el fallo del 30/07.
    const exitos = (src.match(/success: true,/g) || []).length
    const relojes = (src.match(/rechazarSiImpersonacionCaducada\(/g) || []).length
    expect(relojes - 1).toBeGreaterThanOrEqual(exitos)
  })

  it('la suplantación caducada se rechaza con 401, y deja señal', () => {
    // 401 —y no el 403 del candado— porque una sesión terminada no vale ni para leer.
    expect(src).toMatch(/reason: 'impersonacion_caducada'/)
    expect(src).toMatch(/impersonacion_caducada_rechazada/)
  })

  it('el bloqueo devuelve 403 (sesión válida, escritura prohibida) y NO 401', () => {
    // 401 diría «no estás autenticado», que es falso y confunde al diagnosticar.
    expect(src).toMatch(/status: 403/)
    expect(src).toMatch(/reason: 'impersonacion_solo_lectura'/)
  })

  it('el bloqueo deja señal: sin observabilidad, un intento de escritura pasa inadvertido', () => {
    expect(src).toMatch(/impersonacion_escritura_bloqueada/)
  })

  it('en las ramas remotas el claim se lee sin verificar, y eso solo puede DENEGAR', () => {
    // Leer un claim sin firma sería grave si diera acceso; aquí solo puede bloquear más.
    expect(src).toMatch(/function impSinVerificar/)
    const cuerpo = src.slice(src.indexOf('function impSinVerificar'), src.indexOf('function bloquearSiEscribeSuplantando'))
    // No debe devolver identidad ni userId: solo el email del admin que mira.
    expect(cuerpo).not.toMatch(/userId|appUserId|sub\b/)
  })
})
