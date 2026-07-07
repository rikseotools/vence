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
import { resolveAppUserId } from './resolveAppUser'
import { verifyGoogleIdToken } from './verifyGoogleIdToken'

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
      // En el primer sign-in, `user` trae el email del proveedor. Resolvemos el
      // UUID canónico UNA vez y lo persistimos en el token de sesión.
      if (user?.email) {
        const appUserId = await resolveAppUserId(user.email, user.name)
        if (appUserId) token.appUserId = appUserId
        token.email = user.email
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
      return session
    },
  },
})
