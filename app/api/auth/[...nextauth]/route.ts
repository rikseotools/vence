// app/api/auth/[...nextauth]/route.ts — endpoints de Auth.js (Fase B, DORMIDO).
// Maneja /api/auth/signin, /callback/google, /session, etc. Nadie lo usa hasta
// el flip (`AUTH_PROVIDER=authjs`). Redirect URI a registrar en Google Cloud:
//   https://www.vence.es/api/auth/callback/google
import { handlers } from '@/lib/auth/authjs'

export const runtime = 'nodejs'

export const { GET, POST } = handlers
