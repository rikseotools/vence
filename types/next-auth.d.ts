// types/next-auth.d.ts — Augmentación de tipos de Auth.js (Fase B).
// Añade `session.user.id` (= user_profiles.id) y `token.appUserId` para que el
// callback `jwt`/`session` de lib/auth/authjs.ts sea type-safe sin casts.
import type { DefaultSession } from 'next-auth'

declare module 'next-auth' {
  interface Session {
    user: {
      /** user_profiles.id canónico (NO el sub de Google). */
      id?: string
    } & DefaultSession['user']
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    /** user_profiles.id resuelto por lookup de email en el callback jwt. */
    appUserId?: string
  }
}
