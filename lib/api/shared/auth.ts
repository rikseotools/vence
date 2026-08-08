// lib/api/shared/auth.ts
// Centraliza el patrón de autenticación duplicado en 30+ rutas API.
// Usado por 27 endpoints (admin, finance, ai-config, lifecycle, etc.).
//
// **REFACTOR 2026-05-11**: internamente delegado a `verifyAuth()` para
// portabilidad y latencia (Fase 0.7 — JWT local verify):
// - Latencia auth: 250-1000ms → <5ms (cuando JWT_LOCAL_VERIFY_MODE=on)
// - Portabilidad: cambiar provider auth = modificar 1 archivo (`verifyJwtLocal.ts`)
// - API externa intacta — los 27 callers no cambian
//
// El objeto `user` devuelto incluye solo {id, email} (lo único que usan
// los 27 callers según auditoría). Otros campos del User type de Supabase
// (app_metadata, user_metadata, role, etc.) quedan undefined — NINGÚN
// caller los lee actualmente.

import { createClient, type SupabaseClient, type User } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { getAdminDb } from '@/db/client'
import { userProfiles } from '@/db/schema'
import { eq } from 'drizzle-orm'
import { verifyAuth, verifyAuthOptional } from '@/lib/api/auth/verifyAuth'
import { isAdminEmail } from '@/lib/auth/adminEmails'
import { emitFireAndForget } from '@/lib/observability/emit'
import { juzgarPropiedad, dejaPasar, statusDe } from '@/lib/api/shared/propiedadRecurso'

// ============================================
// Tipos
// ============================================

// NOTA (10/07): se retiró el campo `supabase` de los resultados de auth — ningún
// caller lo usaba (los datos ya son agnósticos vía Drizzle) y creaba un cliente
// Supabase en CADA request autenticado. `getServiceClient` sigue existiendo solo
// para `authAdmin` (auth.users legacy, pre-flip).
export type AuthResult =
  | { ok: true; user: User }
  | { ok: false; response: NextResponse }

export type AdminResult =
  | { ok: true; user: User }
  | { ok: false; response: NextResponse }

// ============================================
// Service client (bypass RLS)
// ============================================

export function getServiceClient(): SupabaseClient {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

// ============================================
// Autenticación de usuario via Bearer token
// ============================================
// Delegado a verifyAuth (wrapper Fase 0.7). Mantiene API legacy para los
// 27 callers existentes pero hereda los modos off/shadow/on del wrapper.

export async function getAuthenticatedUser(
  request: NextRequest
): Promise<AuthResult> {
  const auth = await verifyAuth(request, '/lib/api/shared/auth')
  if (!auth.success) {
    return {
      ok: false,
      response: NextResponse.json(
        {
          error: auth.reason === 'no_bearer_token'
            ? 'No autorizado'
            : 'Usuario no autenticado',
        },
        { status: 401 }
      ),
    }
  }

  // Construir objeto User-compatible. Los 27 callers solo leen .id y .email
  // (verificado por auditoría 2026-05-11). Otros campos del User type quedan
  // undefined — Cast necesario porque User es interface compleja de Supabase.
  const user = {
    id: auth.userId,
    email: auth.email ?? undefined,
    // Campos requeridos por el interface User pero no usados por callers
    app_metadata: {},
    user_metadata: {},
    aud: 'authenticated',
    created_at: '',
  } as unknown as User

  return { ok: true, user }
}

// ============================================
// Identidad para endpoints que HOY la reciben del cliente (T-340)
// ============================================
//
// ## Por qué existe
//
// Los endpoints de pago (`/api/stripe/{cancel,reactivate,subscription,create-checkout}`)
// nacieron leyendo el `userId` del **cuerpo o de la query**, sin token. Es decir: la
// identidad la ponía quien llamaba. Con solo el UUID de otra persona —que viaja en
// respuestas de la propia app— se podía **cancelar su suscripción, reactivarla (volver a
// cobrarle) o leer sus datos de facturación**.
//
// Se descubrió el 30/07/2026 por una vía indirecta: durante una suplantación de solo
// lectura, un clic en «Reactivar suscripción» **se ejecutó de verdad** sobre la cuenta de
// una usuaria. El candado de la suplantación vive en `verifyAuth` —«el paso por el que pasan
// TODAS las APIs»— y estos endpoints no pasaban por ahí. La suplantación fue el síntoma; el
// fallo de autorización era el de fondo.
//
// ## La regla
//
// **La identidad sale del token y solo del token.** El id que mande el cliente NO autoriza
// nada: en los seis endpoints el valor se sobrescribe siempre con el del token
// (`{ ...datos, userId: identidad.userId }`). Es decir, el contraste es un **detector**, no
// un control de acceso.
//
// ## Qué hacer cuando el cliente afirma otro id (31/07/2026)
//
// Hasta hoy se cortaba siempre con 403. Eso costó una venta a punto de perderse:
// `rdiazprados@gmail.com` intentó comprar premium **17 veces en 10 minutos** y recibió 403 en
// todas, porque su navegador mandaba el id de un usuario **que ya no existe en la base de
// datos** mientras su sesión era perfectamente válida. Cortar no impidió ningún abuso —el
// token ya mandaba— y sí le impidió pagar.
//
// Pero quitarlo del todo tampoco vale, y el motivo es concreto: si una pantalla muestra la
// cuenta A y el token es B, seguir adelante **cancelaría la suscripción de B en silencio**
// mientras la persona cree estar cancelando la de A. Ahí el 403 es lo correcto.
//
// Así que la política no la decide la ruta, sino **el daño de equivocarse de cuenta**:
//
//   · `cortar` (por defecto) — acciones destructivas o irreversibles sobre la suscripción:
//     cancelar, reactivar, registrar el motivo de una baja. Equivocarse cuesta caro y no se
//     deshace solo.
//   · `seguir-con-el-token` — acciones donde el peor caso es que la persona se cobre a sí
//     misma justo lo que iba a pagar, o lea sus propios datos: checkout, portal, consulta.
//
// **El defecto es `cortar` a propósito**: olvidarse de declarar la política tiene que fallar
// del lado seguro. Y el guardarraíl `endpointsPagoIdentidad` exige que cada endpoint de pago
// declare la suya por escrito, para que ninguno la herede por accidente.
//
// La señal `auth_identidad_ajena_rechazada` se emite en LOS DOS casos: el detector no se
// pierde por dejar pasar. Lo que cambia es que ya no se cobra en ventas — y la alerta
// `cobro_bloqueado_auth` (backend) avisa cuando alguien se queda atascado.
//
// Devuelve el status REAL de `verifyAuth` (401 sin sesión, 403 si es una suplantación
// escribiendo) en vez de colapsarlo todo a 401 como `getAuthenticatedUser`: en un endpoint
// que mueve dinero, distinguir «no estás autenticado» de «no puedes hacer esto» es lo que
// permite diagnosticar sin adivinar.
export type IdentidadResult =
  | { ok: true; userId: string; email: string | null; impersonadoPor: string | null }
  | { ok: false; response: NextResponse }

/** Qué hacer si el id que manda el cliente no es el del token. Ver el bloque de arriba. */
export type PoliticaDiscrepancia = 'cortar' | 'seguir-con-el-token'

export async function requireUsuarioPropio(
  request: NextRequest,
  endpoint: string,
  /** El id que afirma el cliente (body/query). NO se usa como identidad: solo se contrasta. */
  idQueAfirmaElCliente?: string | null,
  opciones: {
    /** Por defecto `cortar`: olvidarse tiene que fallar del lado seguro. */
    alDiscrepar?: PoliticaDiscrepancia
  } = {},
): Promise<IdentidadResult> {
  const alDiscrepar: PoliticaDiscrepancia = opciones.alDiscrepar ?? 'cortar'
  const auth = await verifyAuth(request, endpoint)
  if (!auth.success) {
    return {
      ok: false,
      response: NextResponse.json(
        {
          error:
            auth.status === 403
              ? 'Esta sesión es de solo lectura'
              : 'No autorizado',
          reason: auth.reason,
        },
        { status: auth.status },
      ),
    }
  }

  if (idQueAfirmaElCliente && idQueAfirmaElCliente !== auth.userId) {
    // La discrepancia SIEMPRE se registra, se corte o no: es la firma tanto del abuso como
    // del cliente desincronizado, y distinguirlos se hace mirando si ese id existe.
    const bloqueado = alDiscrepar === 'cortar'
    console.warn(
      `🔒 [auth] ${endpoint}: el cliente afirmó otro userId — ${bloqueado ? 'bloqueado' : 'se sigue con el del token'}`,
    )
    emitFireAndForget({
      source: 'vercel',
      severity: 'warn',
      eventType: 'auth_identidad_ajena_rechazada',
      endpoint,
      userId: auth.userId,
      metadata: { afirmado: idQueAfirmaElCliente, politica: alDiscrepar, bloqueado },
    })
    if (bloqueado) {
      return {
        ok: false,
        response: NextResponse.json({ error: 'No autorizado' }, { status: 403 }),
      }
    }
    // Se sigue con la identidad del TOKEN, nunca con la afirmada. La diferencia con cortar
    // no es de seguridad —el id del cliente no autoriza nada— sino de a quién le cuesta el
    // desajuste: aquí, a nadie.
  }

  return {
    ok: true,
    userId: auth.userId,
    email: auth.email,
    impersonadoPor: auth.impersonadoPor ?? null,
  }
}

// ============================================
// Propiedad de un recurso que puede ser ANÓNIMO (examen/psicotécnico sin sesión)
// ============================================
// [T-565]: la familia de exam/* y psychometric/* comprobaba propiedad así:
// `if (body.userId) { isOwner = await verifyTestOwnership(testId, body.userId) }`.
// Dos fallos, no uno: (a) la comprobación era OPCIONAL — bastaba con OMITIR userId
// para saltársela entera (y varios llamantes reales, como /exam/resume y
// /exam/progress, YA lo omiten siempre: la comprobación nunca corría); (b) el id
// contra el que se comparaba lo ponía el CLIENTE, así que aunque se mandara, poner
// el userId de la VÍCTIMA (no secreto: es su propio id, visible en cualquier
// pantalla suya) la hacía pasar igual. Con solo el UUID del test se leían las
// respuestas de otra persona, se completaba su examen o se le cambiaba el cupo.
//
// Aquí la identidad sale SIEMPRE de `verifyAuthOptional` (el token, o `null` si de
// verdad no hay sesión — el examen admite tomarse sin cuenta). Se deja pasar si el
// recurso no tiene dueño (examen anónimo) o si el dueño coincide con quien pide.

export type PropiedadRecursoResult =
  | { ok: true; callerUserId: string | null }
  | { ok: false; response: NextResponse }

/**
 * @param duenoReal El id del dueño tal como está en BD (no el que afirme el cliente),
 *   o `null` si el recurso no tiene dueño (anónimo).
 */
export async function requireDuenoDelRecurso(
  request: NextRequest,
  endpoint: string,
  duenoReal: string | null,
): Promise<PropiedadRecursoResult> {
  const auth = await verifyAuthOptional(request, endpoint)
  const callerUserId = auth?.userId ?? null

  const veredicto = juzgarPropiedad({ duenoReal, callerUserId })
  if (veredicto === 'permitido' || dejaPasar(veredicto)) return { ok: true, callerUserId }

  // Las dos denegaciones se separan a propósito ([T-671]): «no sé quién eres» es una sesión
  // caída y «no eres el dueño» es acceso a lo ajeno. Antes las dos salían como lo segundo, y
  // durante el incidente del 07/08 eso etiquetó 195 sesiones caídas como intentos de acceso
  // ajeno — las 195. Ver el porqué completo en `propiedadRecurso.ts`.
  const sinIdentidad = veredicto === 'sin_identidad'
  console.warn(`🔒 [auth] ${endpoint}: ${sinIdentidad ? 'sin identidad verificable' : 'recurso ajeno'} — bloqueado`)
  emitFireAndForget({
    source: 'vercel',
    // La sesión caída es un fallo NUESTRO que el usuario sufre → `error`, para que entre en el
    // catch-all de señales del panel. El acceso ajeno sigue siendo `warn`: es una denegación que
    // funciona como debe.
    severity: sinIdentidad ? 'error' : 'warn',
    eventType: sinIdentidad ? 'auth_sin_identidad_en_recurso' : 'auth_identidad_ajena_rechazada',
    endpoint,
    userId: callerUserId ?? undefined,
    metadata: { duenoReal, motivo: veredicto },
  })
  return {
    ok: false,
    response: NextResponse.json(
      {
        success: false,
        error: sinIdentidad
          ? 'Tu sesión no está activa. Vuelve a entrar para continuar.'
          : 'No tienes acceso a este recurso',
        // El cliente decide el aviso con esto, no adivinando por el código: ver
        // `lib/tests/avisoDeCorreccion.ts`.
        reason: veredicto,
      },
      { status: statusDe(veredicto) },
    ),
  }
}

// ============================================
// Autenticación + target_oposicion desde user_profiles
// ============================================
// Usado por endpoints que deben filtrar por oposición — NUNCA confiar en
// positionType que venga del cliente; derivarlo de la sesión autenticada.

export type AuthWithOposicionResult =
  | { ok: true; user: User; targetOposicion: string | null }
  | { ok: false; response: NextResponse }

export async function getAuthenticatedUserWithOposicion(
  request: NextRequest
): Promise<AuthWithOposicionResult> {
  const auth = await getAuthenticatedUser(request)
  if (!auth.ok) return auth

  let raw: string | null | undefined
  try {
    const [row] = await getAdminDb()
      .select({ target_oposicion: userProfiles.targetOposicion })
      .from(userProfiles)
      .where(eq(userProfiles.id, auth.user.id))
      .limit(1)
    raw = row?.target_oposicion
  } catch (error) {
    console.warn('⚠️ [auth] No se pudo leer target_oposicion:', (error as Error).message)
  }

  const targetOposicion = raw && raw.trim().length > 0 ? raw : null

  return { ok: true, user: auth.user, targetOposicion }
}

// ============================================
// Verificación de admin (email whitelist)
// ============================================
// La allowlist vive en lib/auth/adminEmails (client-safe, fuente única). Se
// reexporta aquí para no romper los imports existentes de los 27 callers.

export { isAdminEmail }

export async function requireAdmin(
  request: NextRequest
): Promise<AdminResult> {
  const auth = await getAuthenticatedUser(request)
  if (!auth.ok) return auth

  if (!isAdminEmail(auth.user.email)) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: 'No autorizado' },
        { status: 403 }
      ),
    }
  }

  return auth
}
