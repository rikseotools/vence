// lib/auth/authjs.ts — Emisor Auth.js (NextAuth v5) — Fase B, DORMIDO.
//
// Define el login Google + el callback que fija `token.sub = user_profiles.id`
// (lookup por email — ver lib/auth/resolveAppUser.ts). NADIE lo consume todavía:
// el hub cliente sigue en `supabaseAdapter` (lib/auth/client.ts). Se activa en el
// flip de Fase B (`AUTH_PROVIDER=authjs`).
//
// La sesión de Auth.js (cookie, cifrada con AUTH_SECRET) NO es el Bearer. El
// access token para `Authorization: Bearer` lo acuña `/api/auth/token` en RS256
// (lib/auth/mintAccessToken.ts) a partir de esta sesión → separación limpia,
// sin el footgun JWE-vs-JWT.
//
// DORMIDO: si faltan GOOGLE_CLIENT_ID/SECRET el provider no se registra; si falta
// AUTH_SECRET NextAuth responde error en request (nadie lo llama aún).

import NextAuth from 'next-auth'
import Google from 'next-auth/providers/google'
import Credentials from 'next-auth/providers/credentials'
import { resolverPerfilPorEmail } from './resolveAppUser'
import { decidirReintentoPerfil, CAMPO_REINTENTO } from './reintentoPerfil'
import { verifyGoogleIdToken } from './verifyGoogleIdToken'
import { adminQueSuplanta, impersonacionCaducada } from '@/lib/admin/impersonacion'
import { emitFireAndForget } from '@/lib/observability/emit'

// En prod el client id llega inlineado como NEXT_PUBLIC_GOOGLE_CLIENT_ID
// (build-arg); en local existe GOOGLE_CLIENT_ID. Mismo valor, no secreto.
const googleId =
  process.env.GOOGLE_CLIENT_ID || process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID
const googleSecret = process.env.GOOGLE_CLIENT_SECRET

const providers = []

// Google redirect (OAuth code flow) — el botón "Iniciar sesión con Google".
if (googleId && googleSecret) {
  providers.push(
    Google({
      clientId: googleId,
      clientSecret: googleSecret,
      // `prompt=select_account`: paridad con el flujo Supabase previo — deja
      // elegir cuenta en vez de reusar la sesión Google silenciosamente.
      authorization: { params: { prompt: 'select_account' } },
    }),
  )
}

// Google One Tap / FedCM (id_token flow) — el popup automático. Auth.js NO acepta
// un id_token en el provider Google (solo redirect), así que se porta como un
// provider Credentials que verifica el id_token SERVER-SIDE (firma JWKS + aud + iss
// + exp + nonce + email_verified) y devuelve el email → los MISMOS callbacks jwt/
// session de abajo resuelven `user_profiles.id` e igualan al flujo redirect. Sin
// esto, One Tap quedaba muerto tras el flip a Auth.js (Supabase deshabilitó
// signInWithIdToken). Solo necesita el client id (para `aud`), no el secret.
if (googleId) {
  providers.push(
    Credentials({
      id: 'google-one-tap',
      name: 'Google One Tap',
      credentials: { id_token: {}, nonce: {} },
      async authorize(creds) {
        const idToken = typeof creds?.id_token === 'string' ? creds.id_token : ''
        const rawNonce = typeof creds?.nonce === 'string' ? creds.nonce : undefined
        const gUser = await verifyGoogleIdToken(idToken, rawNonce, googleId)
        if (!gUser) return null
        // `email` es lo único que consume el callback jwt (→ resolveAppUserId).
        return { id: gUser.sub, email: gUser.email, name: gUser.name }
      },
    }),
  )
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers,
  session: { strategy: 'jwt' },
  // Detrás de CloudFront/ALB; el host es de confianza (dominio propio).
  trustHost: true,
  secret: process.env.AUTH_SECRET,
  callbacks: {
    async jwt({ token, user }) {
      // T-335 — MUERTE DE LA SUPLANTACIÓN CADUCADA.
      //
      // Este callback es el único punto por el que pasa **toda** rotación de la sesión: lo
      // llama `@auth/core` justo antes de re-firmar la cookie. Devolver `null` aquí hace que
      // el propio Auth.js ejecute `sessionStore.clean()` y **borre la cookie del navegador**
      // (`@auth/core/lib/actions/session.js`) — el mismo mecanismo que hasta ahora renovaba
      // la suplantación pasa a ser el que la termina. Cero peticiones nuevas.
      //
      // Va lo PRIMERO a propósito: si la sesión ya no debe existir, nada más que se haga con
      // ella (resolver el usuario, propagar la marca) tiene sentido.
      if (impersonacionCaducada(token, Math.floor(Date.now() / 1000))) {
        emitFireAndForget({
          source: 'vercel',
          severity: 'info', // No es un error: es la salvaguarda haciendo su trabajo.
          eventType: 'impersonacion_caducada',
          endpoint: '/api/auth/session',
          metadata: { admin: adminQueSuplanta(token), motivo: 'ttl_vencido' },
        })
        return null
      }

      // En el primer sign-in, `user` trae el email del proveedor. Resolvemos el
      // UUID canónico y lo persistimos en el token de sesión.
      if (user?.email) {
        const r = await resolverPerfilPorEmail(user.email, user.name)
        if (r.id) token.appUserId = r.id
        else {
          // [T-434] Se deja constancia de CUÁNDO se intentó, para que el reintento de abajo no
          // vuelva a probar en la misma vuelta ni en la siguiente carga de página. Sin esta
          // marca, un usuario irresoluble consultaría la BD en cada petición.
          token[CAMPO_REINTENTO] = Math.floor(Date.now() / 1000)
          // [T-434] El perfil NO se pudo resolver ni crear. Sin esto, el fallo es INVISIBLE:
          // `resolveAppUserId` solo deja un `console.warn` que no se persiste en ninguna parte
          // (medido el 31/07: CERO rastro en `observable_events` y en `validation_error_logs`).
          //
          // Y no es inocuo. El comentario de aquella función supone que devolver null es seguro
          // «porque el emisor no acuñará token sin sub válido (503)», y NO es lo que pasa: la
          // sesión se firma igual, `session.user.id` se queda con el id por defecto de Auth.js
          // —que no existe en `user_profiles`— y el usuario navega roto. Todo lo que se indexa
          // por ese id le rebota: `/api/v2/user-stats` («Usuario no existe»), el checkout
          // (`404 · User not found in database`) y el propio formulario de soporte, así que
          // **tampoco puede avisarnos**.
          //
          // Medido el 31/07: 29-31 usuarios AL DÍA, algunos desde el 7 de julio, uno con 1.127
          // eventos y otro con 16 intentos de compra rechazados. La reconciliación de [T-245]
          // no les alcanza porque su `sub` nunca llegó a existir.
          //
          // Esto NO arregla el alta —esa decisión es aparte, ver [T-434]—: la hace VISIBLE.
          emitFireAndForget({
            source: 'vercel',
            severity: 'error',
            eventType: 'auth_alta_sin_perfil',
            endpoint: '/api/auth/session',
            // El email nunca en claro: basta el dominio para distinguir un proveedor caído
            // de un caso suelto, y el prefijo para reconocer al usuario si escribe.
            metadata: {
              emailPrefijo: user.email.slice(0, 3),
              dominio: user.email.split('@')[1] ?? null,
              motivo: r.motivo,
              detalle: r.detalle ?? null,
            },
          })
        }
        token.email = user.email
      }

      // ── [T-434] REINTENTO: el arreglo de fondo ───────────────────────────────────────────
      //
      // Hasta hoy, `token.appUserId` se resolvía SOLO en el bloque de arriba, y ese bloque solo
      // corre en el primer sign-in: `@auth/core@0.41.2` invoca este callback **sin `user`** en
      // cada rotación de sesión (`lib/actions/session.js`, una por carga de página). Es decir,
      // **un único fallo dejaba al usuario roto para siempre**, y por eso había 235 personas así
      // —la más antigua desde el 7 de julio— con 85 intentos de compra rechazados en una semana.
      //
      // El email SÍ viaja en el token (lo mete el propio Auth.js al construir el `defaultToken`
      // en el sign-in), así que la reparación no necesita nada más y **cura sola a los ya rotos**
      // la próxima vez que carguen una página.
      //
      // El usuario sano no paga NADA: `decidirReintentoPerfil` mira `appUserId` lo primero.
      const decision = decidirReintentoPerfil(token, Math.floor(Date.now() / 1000))
      if (decision.accion === 'reintentar') {
        token[CAMPO_REINTENTO] = Math.floor(Date.now() / 1000)
        const r = await resolverPerfilPorEmail(decision.email, token.name as string | null)
        if (r.id) {
          token.appUserId = r.id
          // Métrica de la REPARACIÓN, no del fallo: cuenta a los 235 vaciándose. Cuando deje de
          // hablar, el atasco está drenado; si no decae, es que siguen naciendo rotos.
          emitFireAndForget({
            source: 'vercel',
            severity: 'info',
            eventType: 'auth_perfil_recuperado',
            endpoint: '/api/auth/session',
            metadata: {
              emailPrefijo: decision.email.slice(0, 3),
              dominio: decision.email.split('@')[1] ?? null,
              motivo: r.motivo,
            },
          })
        } else {
          emitFireAndForget({
            source: 'vercel',
            severity: 'error',
            eventType: 'auth_alta_sin_perfil',
            endpoint: '/api/auth/session',
            metadata: {
              emailPrefijo: decision.email.slice(0, 3),
              dominio: decision.email.split('@')[1] ?? null,
              motivo: r.motivo,
              detalle: r.detalle ?? null,
              enReintento: true,
            },
          })
        }
      } else if (decision.accion === 'sin_email') {
        // Caso DISTINTO y que no se veía: sin email no hay nada que resolver, así que el
        // reintento no puede curarle NUNCA. Se emite aparte para no confundirlo con un fallo de
        // la resolución — si esto aparece, el arreglo de arriba no es la respuesta y hay que
        // mirar qué proveedor está firmando sesiones sin email.
        emitFireAndForget({
          source: 'vercel',
          severity: 'error',
          eventType: 'auth_sesion_sin_email',
          endpoint: '/api/auth/session',
          metadata: { sub: typeof token.sub === 'string' ? token.sub.slice(0, 8) : null },
        })
      }

      return token
    },
    async session({ session, token }) {
      // `session.user.id` = user_profiles.id (NO el sub de Google).
      // `token.appUserId` es `unknown` (JWT extiende Record<string,unknown>) →
      // narrow explícito con typeof, no confiar en truthy sobre unknown.
      const appUserId = token.appUserId
      if (typeof appUserId === 'string' && session.user) {
        session.user.id = appUserId
      }
      // T-289 — marca de SUPLANTACIÓN. Si esta sesión la acuñó un admin para ver la cuenta
      // de alguien, `imp` lleva su email. Se propaga a la sesión para dos cosas que no
      // pueden depender de la interfaz: acuñar el access token también marcado (y que el
      // candado de solo lectura funcione en las APIs) y pintar la franja de aviso.
      const imp = token.imp
      if (typeof imp === 'string' && imp) {
        ;(session as unknown as { impersonadoPor?: string }).impersonadoPor = imp
        // Y CUÁNDO caduca (T-335): quien derive algo de esta sesión —el access token, la
        // cookie-marca de la franja— tiene que poder limitarlo a la vida de la suplantación.
        // Propagar el «quién» sin el «hasta cuándo» es lo que dejó tokens sobreviviéndola.
        const impExp = token.impExp
        if (typeof impExp === 'number') {
          ;(session as unknown as { impersonadoHasta?: number }).impersonadoHasta = impExp
        }
      }
      return session
    },
  },
})
