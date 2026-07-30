// GUARDARRAÍL: el reloj de la suplantación es NUESTRO, y nada que derive de ella lo ignora.
//
// ## De dónde sale (30/07/2026 — T-335)
//
// La suplantación (T-289) prometía caducar sola a los 30 minutos y no caducaba. El plazo se
// guardó en `exp`, un claim que **posee Auth.js**: cada `GET /api/auth/session` re-firma la
// cookie con 30 días de vida, así que el mecanismo que debía apagarla la resucitaba. Y la
// franja roja que avisa «estás viendo la cuenta de otra persona» dependía de una cookie con
// su propio reloj de 30 minutos, que sí caducaba → la suplantación seguía viva y además
// invisible. Lo encontró Manuel al reabrir el navegador y verse dentro de la cuenta de una
// usuaria horas después.
//
// La regla que fija este fichero: **un plazo que hace cumplir otro sistema no es un plazo
// nuestro**, y **lo que nace de una sesión no puede sobrevivirla**. Los tests de
// comportamiento están en __tests__/integration/impersonacionRotacionTtl.test.ts (con la
// librería real); esto vigila que las piezas sigan conectadas donde tienen que estarlo.
import { readFileSync } from 'fs'
import { join } from 'path'

const leer = (p: string) => readFileSync(join(process.cwd(), p), 'utf8')

describe('el plazo vive en un claim propio', () => {
  const nucleo = leer('lib/admin/impersonacion.ts')

  it('la sesión suplantada se acuña con `impExp`', () => {
    expect(nucleo).toMatch(/impExp: args\.nowSec \+ ttl/)
  })

  it('la decisión de caducidad NO mira `exp` (lo pisa Auth.js al rotar)', () => {
    const cuerpo = nucleo.slice(nucleo.indexOf('export function impersonacionCaducada'))
    const funcion = cuerpo.slice(0, cuerpo.indexOf('\n}') + 2)
    expect(funcion).not.toMatch(/\bexp\b(?!ort)/) // ni `token.exp` ni desestructurado
    expect(funcion).toMatch(/CLAIM_CADUCIDAD/)
  })

  it('sin reloj se considera caducada (fail-closed), no viva', () => {
    const cuerpo = nucleo.slice(nucleo.indexOf('export function impersonacionCaducada'))
    expect(cuerpo.slice(0, 400)).toMatch(/return true/)
  })
})

describe('la sesión caducada se corta donde pasa toda rotación', () => {
  const authjs = leer('lib/auth/authjs.ts')

  it('el callback `jwt` la evalúa y devuelve null (Auth.js borra entonces la cookie)', () => {
    const cb = authjs.slice(authjs.indexOf('async jwt('), authjs.indexOf('async session('))
    expect(cb).toMatch(/impersonacionCaducada\(/)
    expect(cb).toMatch(/return null/)
  })

  it('la comprobación va ANTES de resolver identidad: si la sesión muere, lo demás sobra', () => {
    const cb = authjs.slice(authjs.indexOf('async jwt('), authjs.indexOf('async session('))
    expect(cb.indexOf('impersonacionCaducada(')).toBeLessThan(cb.indexOf('resolveAppUserId'))
  })

  it('deja señal al cortar', () => {
    expect(authjs).toMatch(/impersonacion_caducada/)
  })

  it('la sesión propaga el «hasta cuándo», no solo el «quién»', () => {
    // Propagar `imp` sin `impExp` fue lo que dejó tokens sobreviviendo a la suplantación.
    const cb = authjs.slice(authjs.indexOf('async session('))
    expect(cb).toMatch(/impersonadoPor/)
    expect(cb).toMatch(/impersonadoHasta/)
  })
})

describe('nada que nazca de la suplantación la sobrevive', () => {
  it('el access token se recorta al restante (no dura 1h por encima del plazo)', () => {
    const mint = leer('lib/auth/mintAccessToken.ts')
    expect(mint).toMatch(/restanteImpersonacionSeg\(/)
    expect(mint).toMatch(/Math\.min\(ACCESS_TOKEN_TTL_SECONDS, restante\)/)
    // Y si ya no queda nada, no se acuña.
    expect(mint).toMatch(/if \(restante === 0\) return null/)
  })

  it('la cookie-marca de la franja se re-emite con el restante real, sin reloj propio', () => {
    const ruta = leer('app/api/auth/token/route.ts')
    expect(ruta).toMatch(/restanteImpersonacionSeg\(/)
    expect(ruta).toMatch(/maxAge: restante/)
    // Y el endpoint no acuña para una suplantación ya terminada.
    expect(ruta).toMatch(/impersonacionCaducada\(/)
  })

  it('la franja sigue apoyándose en la cookie SOLO como atajo, y lo dice', () => {
    // Si alguien le vuelve a dar vida propia a la marca, el comentario es la primera pista
    // de por qué eso rompe la garantía. Que el aviso desaparezca antes que el peligro es
    // peor que no tener aviso.
    const franja = leer('components/admin/FranjaImpersonacion.tsx')
    expect(franja).toMatch(/T-335/)
    expect(franja).toMatch(/impExp|restante REAL/)
  })
})
