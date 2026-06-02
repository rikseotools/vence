// lib/auth/index.ts — Barrel del puerto de Auth CLIENTE + tipos agnósticos.
// NO re-exporta server.ts (runtime distinto: server usa `@/lib/auth/server`).
export { auth, getAuthClient } from './client'
export type {
  AuthUser,
  AuthSession,
  AuthEvent,
  AuthChange,
  Unsubscribe,
  SignInOptions,
  SignInResult,
  AuthClientPort,
} from './types'
