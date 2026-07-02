// lib/api/auth/rs256.ts
// Contrato + material de claves del token RS256/JWKS (Fase B — auth agnóstico).
//
// FUENTE ÚNICA de la verdad del token asimétrico que emitirá Auth.js:
//   - claims del contrato (issuer, audience),
//   - carga de la clave privada/pública + `kid` desde el entorno (SSM → env de la task),
//   - el `alg` permitido (RS256, NUNCA 'none' ni HS con material RSA).
//
// SERVER-ONLY: importa material de clave. No debe entrar en ningún bundle cliente.
// Lee `process.env` en tiempo de LLAMADA (no de import) → el módulo es inerte
// ("dormido") mientras las env no estén puestas: `isRs256Configured()` = false.
//
// Env vars (inyectadas por frontend-deploy.yml desde SSM /vence-frontend/*):
//   AUTH_JWT_PRIVATE_KEY  — PEM PKCS8 (SecureString). Solo el emisor la necesita.
//   AUTH_JWT_PUBLIC_KEY   — PEM SPKI. La usan el endpoint JWKS y los verificadores.
//   AUTH_JWT_KID          — id de la clave (p.ej. "vence-202607"). Va en el header.
//   AUTH_JWT_ISSUER       — opcional; default "https://www.vence.es".
//   AUTH_JWKS_URL         — opcional; default `${issuer}/.well-known/jwks.json`.

import { importPKCS8, importSPKI, exportJWK, type CryptoKey, type JWK } from 'jose'

/** Único algoritmo asimétrico permitido. NUNCA añadir 'none' ni algoritmos HS. */
export const AUTH_JWT_ALG = 'RS256' as const

/** Audience del contrato (se mantiene 'authenticated' para no tocar EXPECTED_AUDIENCE). */
export const AUTH_JWT_AUDIENCE = 'authenticated' as const

/** Emisor propio. Configurable por si cambia el dominio. */
export function getIssuer(): string {
  return process.env.AUTH_JWT_ISSUER || 'https://www.vence.es'
}

/** URL del JWKS público (para verificadores que no tengan la clave local). */
export function getJwksUrl(): string {
  return process.env.AUTH_JWKS_URL || `${getIssuer()}/.well-known/jwks.json`
}

export function getKid(): string | null {
  return process.env.AUTH_JWT_KID || null
}

function getPrivateKeyPem(): string | null {
  return process.env.AUTH_JWT_PRIVATE_KEY || null
}

export function getPublicKeyPem(): string | null {
  return process.env.AUTH_JWT_PUBLIC_KEY || null
}

/** ¿Está el emisor listo para FIRMAR? (privada + kid presentes). */
export function canSign(): boolean {
  return Boolean(getPrivateKeyPem() && getKid())
}

/** ¿Hay clave pública local para verificar sin round-trip al JWKS? */
export function hasLocalPublicKey(): boolean {
  return Boolean(getPublicKeyPem())
}

/** Configuración RS256 completa (firma + verificación local). */
export function isRs256Configured(): boolean {
  return canSign() && hasLocalPublicKey()
}

// Cache de las claves importadas (importPKCS8/SPKI es async y no gratis).
// La cachea POR PEM: si la env cambia (rotación con redeploy) se re-importa.
let privCache: { pem: string; key: CryptoKey } | null = null
let pubCache: { pem: string; key: CryptoKey } | null = null

export async function getPrivateKey(): Promise<CryptoKey | null> {
  const pem = getPrivateKeyPem()
  if (!pem) return null
  if (privCache && privCache.pem === pem) return privCache.key
  const key = await importPKCS8(pem, AUTH_JWT_ALG)
  privCache = { pem, key }
  return key
}

export async function getLocalPublicKey(): Promise<CryptoKey | null> {
  const pem = getPublicKeyPem()
  if (!pem) return null
  if (pubCache && pubCache.pem === pem) return pubCache.key
  const key = await importSPKI(pem, AUTH_JWT_ALG)
  pubCache = { pem, key }
  return key
}

/** Solo para tests: resetea la cache de claves importadas. */
export function _clearRs256KeyCache(): void {
  privCache = null
  pubCache = null
}

/**
 * Construye el JWKS público ({ keys: [...] }). Helper PURO (sin next/server) →
 * lo envuelve el route `/.well-known/jwks.json`. Vacío si el emisor está dormido.
 * NUNCA incluye material privado (exportJWK sobre la clave pública no expone `d`).
 */
export async function buildJwks(): Promise<{ keys: JWK[] }> {
  const publicKey = await getLocalPublicKey()
  const kid = getKid()
  if (!publicKey || !kid) return { keys: [] }

  const jwk = await exportJWK(publicKey)
  jwk.kid = kid
  jwk.use = 'sig'
  jwk.alg = AUTH_JWT_ALG
  return { keys: [jwk] }
}
