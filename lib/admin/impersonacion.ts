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
    iat: args.nowSec,
    exp: args.nowSec + ttl,
    jti: `imp-${args.objetivoUserId}-${args.nowSec}`,
  }
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
