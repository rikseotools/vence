/**
 * @jest-environment node
 */
// El TTL de la suplantación sobrevive a la ROTACIÓN de la sesión (T-335).
//
// ## Por qué este test tiene que existir, y por qué con la librería de verdad
//
// La suplantación (T-289) declara «caduca sola: 30 minutos» y guardaba ese plazo en el claim
// `exp`. El test que lo cubría comprobaba `exp - iat === 30 min` sobre el payload recién
// acuñado — y pasaba. La protección, sin embargo, no existía: `exp` es de Auth.js, que
// **re-firma la cookie en cada `GET /api/auth/session`** (una por carga de página) con
// `setExpirationTime(now + maxAge)` y maxAge por defecto de 30 días. Una suplantación de 30
// minutos duraba indefinidamente mientras el admin navegara, y encima invisible: la cookie
// que dispara la franja roja sí caducaba a los 30 minutos.
//
// La lección es la que fija este fichero: el defecto no estaba en el ACUÑADO —donde miraban
// todas las pruebas— sino en la ROTACIÓN, y la rotación es código de `@auth/core`. Por eso
// aquí se usan el `encode`/`decode` REALES en vez de un doble: un mock habría reproducido lo
// que creíamos que pasaba, que es exactamente el error que se quiere impedir.
import { encode, decode } from 'next-auth/jwt'
import {
  payloadSesionImpersonada,
  impersonacionCaducada,
  restanteImpersonacionSeg,
  TTL_IMPERSONACION_SEG,
} from '@/lib/admin/impersonacion'

const SECRET = 'secreto-de-prueba-suficientemente-largo-para-derivar-clave'
const SALT = 'authjs.session-token' // el salt real es el nombre de la cookie
const AHORA = 1_800_000_000

const UID = '75e32f96-358b-4623-91ea-246a3a890d91'

/** Acuña la cookie tal y como lo hace `/api/admin/impersonar`. */
async function acunarSuplantada(nowSec = AHORA) {
  const token = payloadSesionImpersonada({
    objetivoUserId: UID,
    objetivoEmail: 'alumna@example.com',
    adminEmail: 'admin@vence.es',
    nowSec,
  })
  return encode({ token, secret: SECRET, salt: SALT, maxAge: TTL_IMPERSONACION_SEG })
}

/**
 * Rota la cookie EXACTAMENTE como `@auth/core/lib/actions/session.js`: descifra, pasa el
 * payload por el callback `jwt` y vuelve a cifrar **sin pasar maxAge** — que es el detalle
 * del que salió todo el fallo.
 */
async function rotarComoAuthjs(cookie: string): Promise<{ cookie: string; payload: Record<string, unknown> }> {
  const previo = (await decode({ token: cookie, secret: SECRET, salt: SALT })) as Record<string, unknown>
  const nueva = await encode({ token: previo, secret: SECRET, salt: SALT })
  // Se devuelve el payload de la cookie YA rotada: es el que verá la siguiente petición, y
  // mirar el anterior sería medir justo lo que este fichero existe para no volver a medir.
  const payload = (await decode({ token: nueva, secret: SECRET, salt: SALT })) as Record<string, unknown>
  return { cookie: nueva, payload }
}

describe('la rotación de Auth.js NO puede resucitar una suplantación', () => {
  it('`exp` e `iat` los pisa Auth.js al rotar — por eso ninguno puede ser el reloj', async () => {
    // Lo que declara el payload que fabricamos: media hora de vida.
    const acunado = payloadSesionImpersonada({
      objetivoUserId: UID,
      objetivoEmail: 'alumna@example.com',
      adminEmail: 'admin@vence.es',
      nowSec: AHORA,
    })
    expect(acunado.exp - acunado.iat).toBe(TTL_IMPERSONACION_SEG)

    // Lo que queda tras una rotación: `exp` a 30 días e `iat` a AHORA MISMO. Es decir, los
    // dos claims estándar quedan reescritos por `setExpirationTime`/`setIssuedAt`, y una
    // suplantación acuñada hace horas se presenta como recién nacida.
    const { payload } = await rotarComoAuthjs(await acunarSuplantada())
    const relojDeVerdad = Math.floor(Date.now() / 1000)
    expect(Number(payload.exp) - relojDeVerdad).toBeGreaterThan(29 * 24 * 3600)
    expect(Math.abs(Number(payload.iat) - relojDeVerdad)).toBeLessThan(60)
    expect(Number(payload.exp) - Number(payload.iat)).not.toBe(TTL_IMPERSONACION_SEG)
  })

  it('`impExp` sobrevive intacto a rotaciones sucesivas', async () => {
    let cookie = await acunarSuplantada()
    for (let i = 0; i < 5; i++) {
      const r = await rotarComoAuthjs(cookie)
      cookie = r.cookie
      expect(r.payload.impExp).toBe(AHORA + TTL_IMPERSONACION_SEG)
      expect(r.payload.imp).toBe('admin@vence.es')
    }
  })

  it('pasado el TTL, la sesión rotada se considera caducada (aunque su `exp` diga 30 días)', async () => {
    const cookie = await acunarSuplantada()
    const { payload } = await rotarComoAuthjs(cookie)

    expect(impersonacionCaducada(payload, AHORA + TTL_IMPERSONACION_SEG - 1)).toBe(false)
    expect(impersonacionCaducada(payload, AHORA + TTL_IMPERSONACION_SEG)).toBe(true)
    expect(impersonacionCaducada(payload, AHORA + 30 * 24 * 3600)).toBe(true)
  })

  it('una sesión NORMAL rotada nunca se considera caducada (no la desconectamos por error)', async () => {
    const normal = { appUserId: UID, email: 'alumna@example.com', sub: UID }
    const cookie = await encode({ token: normal, secret: SECRET, salt: SALT })
    const { payload } = await rotarComoAuthjs(cookie)

    expect(impersonacionCaducada(payload, AHORA + 10 * 365 * 24 * 3600)).toBe(false)
    expect(restanteImpersonacionSeg(payload, AHORA)).toBe(null)
  })

  it('una suplantación SIN reloj (las acuñadas antes del arreglo) se trata como caducada', async () => {
    // Exactamente lo que hay hoy en el navegador de un admin: marca sí, reloj no.
    const legacy = { appUserId: UID, email: 'alumna@example.com', sub: UID, imp: 'admin@vence.es' }
    const cookie = await encode({ token: legacy, secret: SECRET, salt: SALT })
    const { payload } = await rotarComoAuthjs(cookie)

    expect(impersonacionCaducada(payload, AHORA)).toBe(true)
    expect(restanteImpersonacionSeg(payload, AHORA)).toBe(0)
  })
})
