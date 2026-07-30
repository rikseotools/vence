// lib/admin/impersonacion.ts — NÚCLEO PURO de «ver la app como la ve un usuario».
//
// ## Por qué existe (T-289)
//
// Para entender lo que nos reporta una persona hay que ver SU pantalla: su plan, su
// oposición, sus rachas, sus límites, sus badges. Mirar su fila en la base de datos no lo
// reproduce, y `npm run dev` enseña la app con NUESTRA cuenta. Hasta ahora se diagnosticaba
// pidiendo capturas — y esta misma semana costó indicarle a un usuario un rótulo que en su
// pantalla no existía.
//
// ## Las tres reglas, y por qué son reglas y no buenas intenciones
//
//  1. **Solo lectura.** Ver la cuenta de alguien NO puede convertirse en escribir en su
//     nombre: responder tests, gastar su cupo diario, mandar mensajes, tocar su plan. El
//     incidente clásico de impersonación es el admin que escribe creyendo que está en su
//     sesión. Aquí la sesión suplantada lleva la marca `imp` y **el verificador rechaza
//     cualquier método que no sea de lectura**, así que no depende de que nadie se acuerde.
//  2. **Caduca sola.** 30 minutos. Una sesión de suplantación olvidada abierta es una
//     cuenta ajena abierta.
//  3. **Deja rastro.** Quién, a quién, cuándo y por qué. Entrar en la cuenta de una persona
//     sin registro no es aceptable ni para nosotros ni de cara al RGPD.
//
// Y una cuarta que es de seguridad pura: **no se suplanta a otro admin** (escalada cruzada).
//
// Este módulo es puro a propósito (sin red, sin BD, sin `NextRequest`) para poder probar las
// decisiones — que son la parte que importa — sin levantar nada.

/** Métodos que NO modifican estado. Todo lo demás se rechaza durante una suplantación. */
const METODOS_DE_LECTURA = new Set(['GET', 'HEAD', 'OPTIONS'])

/** Duración de una sesión suplantada. Corta a propósito. */
export const TTL_IMPERSONACION_SEG = 30 * 60

/**
 * Nombre del claim que guarda CUÁNDO caduca la suplantación.
 *
 * ## Por qué no vale `exp` (incidente 30/07/2026)
 *
 * La primera versión puso el TTL en `exp`, el claim estándar. Parecía lo correcto y era el
 * error: `exp` **es de Auth.js**, y Auth.js lo reescribe. Cada `GET /api/auth/session` —una
 * por carga de página— re-firma la cookie con `setExpirationTime(now + maxAge)` y maxAge por
 * defecto son **30 días** (`@auth/core/jwt.js`). Es decir: el mecanismo que debía dejar morir
 * la sesión suplantada era justo el que la resucitaba, y una suplantación de 30 minutos
 * duraba indefinidamente mientras el admin navegara.
 *
 * No lo cazó nadie porque el test que existía medía el ACUÑADO (`exp - iat === 30 min`, que
 * es cierto) y el defecto vive en la ROTACIÓN.
 *
 * `impExp` es un claim NUESTRO: Auth.js copia los campos que no conoce sin tocarlos —lo
 * sabemos porque `imp` ya sobrevivía a las rotaciones— así que aquí el reloj es nuestro.
 */
export const CLAIM_CADUCIDAD = 'impExp'

/**
 * Cookie-marca legible por el navegador. NO es una credencial: solo dice «esta sesión es
 * suplantada» para que la franja de aviso no tenga que preguntarle al servidor en cada
 * página. La credencial sigue siendo la cookie de sesión, que es httpOnly.
 */
export const MARCA_IMPERSONACION = 'vence_imp'

/**
 * ¿Puede esta petición seguir adelante durante una suplantación?
 *
 * Se aplica en el verificador de identidad, que es el paso por el que pasan TODAS las APIs
 * autenticadas: poner la guarda en cada endpoint sería confiar en que nadie olvide uno.
 */
export function permitidoDuranteImpersonacion(metodo: string): boolean {
  return METODOS_DE_LECTURA.has(String(metodo || '').toUpperCase())
}

export interface DecisionImpersonar {
  ok: boolean
  /** Código estable para la respuesta y para la señal de observabilidad. */
  motivo?: 'no_admin' | 'objetivo_invalido' | 'objetivo_es_admin' | 'objetivo_es_uno_mismo'
  mensaje?: string
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/**
 * ¿Se puede suplantar a este usuario? Decide con datos ya resueltos por quien llama
 * (el email del objetivo lo saca de la BD), para que esta función no dependa de nada.
 */
export function decidirImpersonacion(args: {
  adminEmail: string | null | undefined
  esAdmin: boolean
  objetivoUserId: string | null | undefined
  objetivoEmail: string | null | undefined
  objetivoEsAdmin: boolean
}): DecisionImpersonar {
  if (!args.esAdmin || !args.adminEmail) {
    return { ok: false, motivo: 'no_admin', mensaje: 'No autorizado' }
  }
  if (!args.objetivoUserId || !UUID_RE.test(args.objetivoUserId)) {
    return { ok: false, motivo: 'objetivo_invalido', mensaje: 'userId inválido' }
  }
  // Suplantar a otro admin permitiría saltar de un admin a otro y difuminar quién hizo qué.
  if (args.objetivoEsAdmin) {
    return {
      ok: false,
      motivo: 'objetivo_es_admin',
      mensaje: 'No se puede ver la cuenta de otro administrador',
    }
  }
  if (
    args.objetivoEmail &&
    args.adminEmail &&
    args.objetivoEmail.toLowerCase() === args.adminEmail.toLowerCase()
  ) {
    return { ok: false, motivo: 'objetivo_es_uno_mismo', mensaje: 'Esa ya es tu cuenta' }
  }
  return { ok: true }
}

/**
 * Payload de la sesión suplantada: la identidad es la del USUARIO (para que la app le sirva
 * su contenido) y `imp` guarda quién está mirando.
 *
 * `imp` viaja dentro del token, no en una cookie aparte, porque una marca separable de la
 * identidad se puede perder por el camino — y entonces la sesión quedaría indistinguible de
 * una real, sin candado de solo lectura y sin franja.
 */
export function payloadSesionImpersonada(args: {
  objetivoUserId: string
  objetivoEmail: string
  adminEmail: string
  nowSec: number
  ttlSec?: number
}) {
  const ttl = args.ttlSec ?? TTL_IMPERSONACION_SEG
  return {
    appUserId: args.objetivoUserId,
    email: args.objetivoEmail,
    sub: args.objetivoUserId,
    /** Marca de suplantación: el email del admin que mira. Su presencia = solo lectura. */
    imp: args.adminEmail,
    /** Cuándo caduca DE VERDAD (ver CLAIM_CADUCIDAD). `exp` lo pisa Auth.js al rotar. */
    impExp: args.nowSec + ttl,
    iat: args.nowSec,
    exp: args.nowSec + ttl,
    jti: `imp-${args.objetivoUserId}-${args.nowSec}`,
  }
}

/**
 * ¿Esta suplantación ya caducó? Devuelve `false` para las sesiones normales: no hay nada que
 * caducar en ellas, y confundirlo desconectaría a todo el mundo.
 *
 * **Fail-closed a propósito:** si el token dice ser una suplantación (`imp`) pero no trae
 * reloj (`impExp`), se considera CADUCADA. Dos razones, y ninguna es teórica:
 *   - son exactamente las sesiones acuñadas antes de este arreglo, que hoy pueden llevar días
 *     vivas en el navegador de un admin → tratarlas como caducadas las mata solas, sin
 *     migración, sin borrar cookies a mano y sin avisar a nadie;
 *   - un token al que se le ha quitado el reloj y conserva la marca es, por definición, algo
 *     que no deberíamos servir.
 */
export function impersonacionCaducada(token: unknown, nowSec: number): boolean {
  if (!esImpersonacion(token)) return false
  const impExp = (token as Record<string, unknown>)[CLAIM_CADUCIDAD]
  if (typeof impExp !== 'number' || !Number.isFinite(impExp)) return true
  return nowSec >= impExp
}

/**
 * Segundos que le quedan de vida a la suplantación. `null` si no es una (nada que limitar),
 * `0` si ya caducó.
 *
 * Lo consumen las capas que emiten algo con vida propia a partir de esta sesión —el access
 * token y la cookie-marca de la franja— para que **nada que nazca de una suplantación pueda
 * sobrevivirla**. Sin esto, un Bearer acuñado en el minuto 29 seguía valiendo 59 minutos
 * después de que la suplantación hubiera terminado.
 */
export function restanteImpersonacionSeg(token: unknown, nowSec: number): number | null {
  if (!esImpersonacion(token)) return null
  const impExp = (token as Record<string, unknown>)[CLAIM_CADUCIDAD]
  if (typeof impExp !== 'number' || !Number.isFinite(impExp)) return 0
  return Math.max(0, Math.floor(impExp - nowSec))
}

/** ¿Este token (de sesión o de acceso) es una suplantación? */
export function esImpersonacion(token: unknown): boolean {
  if (!token || typeof token !== 'object') return false
  const imp = (token as Record<string, unknown>).imp
  return typeof imp === 'string' && imp.length > 0
}

/** Quién está mirando, para pintarlo en la franja y para la auditoría. */
export function adminQueSuplanta(token: unknown): string | null {
  if (!esImpersonacion(token)) return null
  return String((token as Record<string, unknown>).imp)
}
