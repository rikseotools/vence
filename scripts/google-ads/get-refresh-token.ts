// scripts/google-ads/get-refresh-token.ts
//
// Bootstrap de un solo uso: genera el refresh token OAuth2 con scope de Ads.
// NO necesita el developer token (solo client_id/secret) — se puede ejecutar
// en cuanto el scope esté habilitado en Cloud Console, antes del Basic Access.
//
//   npm run ads:auth
//   (o: npx tsx --env-file=.env.local scripts/google-ads/get-refresh-token.ts)
//
// Requisitos en Cloud Console (mismo proyecto del OAuth existente):
//   - API "Google Ads API" habilitada
//   - scope https://www.googleapis.com/auth/adwords en la pantalla de consentimiento
//   - redirect URI http://localhost:3000/oauth2callback en el OAuth client

import http from 'node:http'
import { URL } from 'node:url'
import { exec } from 'node:child_process'

const CLIENT_ID = process.env.GOOGLE_ADS_CLIENT_ID || process.env.GOOGLE_CLIENT_ID
const CLIENT_SECRET =
  process.env.GOOGLE_ADS_CLIENT_SECRET || process.env.GOOGLE_CLIENT_SECRET
// Puerto dedicado para no chocar con `next dev` (3000). Debe coincidir
// exactamente con el redirect URI registrado en el OAuth client de Cloud Console.
const PORT = 3456
const REDIRECT_URI = `http://localhost:${PORT}/oauth2callback`
// Ads + Search Console (solo lectura) en un mismo token. Ambos scopes deben
// estar en la pantalla de consentimiento de Cloud Console.
const SCOPE = [
  'https://www.googleapis.com/auth/adwords',
  'https://www.googleapis.com/auth/webmasters.readonly',
].join(' ')

if (!CLIENT_ID || !CLIENT_SECRET) {
  console.error(
    '❌ Falta GOOGLE_ADS_CLIENT_ID/GOOGLE_CLIENT_ID o el secret. ' +
      'Ejecuta con --env-file=.env.local (o vía `npm run ads:auth`).'
  )
  process.exit(1)
}

const authParams: Record<string, string> = {
  client_id: CLIENT_ID,
  redirect_uri: REDIRECT_URI,
  response_type: 'code',
  scope: SCOPE,
  access_type: 'offline',
  prompt: 'consent', // fuerza la emisión de refresh_token
}
// Preselecciona la cuenta correcta (la que tiene acceso a Ads), evitando
// autorizar por error con otra cuenta de la sesión del navegador.
if (process.env.GOOGLE_ADS_LOGIN_HINT) {
  authParams.login_hint = process.env.GOOGLE_ADS_LOGIN_HINT
}

const authUrl =
  'https://accounts.google.com/o/oauth2/v2/auth?' + new URLSearchParams(authParams).toString()

async function exchangeCode(code: string): Promise<{ refresh_token?: string }> {
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: CLIENT_ID!,
      client_secret: CLIENT_SECRET!,
      redirect_uri: REDIRECT_URI,
      grant_type: 'authorization_code',
    }).toString(),
  })
  const data = (await res.json()) as { refresh_token?: string; error_description?: string }
  if (!res.ok) throw new Error(data.error_description || JSON.stringify(data))
  return data
}

const server = http.createServer(async (req, res) => {
  if (!req.url?.startsWith('/oauth2callback')) {
    res.writeHead(404).end()
    return
  }
  const code = new URL(req.url, REDIRECT_URI).searchParams.get('code')
  if (!code) {
    res.writeHead(400).end('Sin code en la respuesta.')
    return
  }
  try {
    const tokens = await exchangeCode(code)
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' })
    res.end('<h2>✅ Autorizado. Vuelve a la terminal.</h2>')
    if (tokens.refresh_token) {
      console.log('\n✅ Refresh token obtenido. Añádelo a .env.local:\n')
      console.log(`GOOGLE_ADS_REFRESH_TOKEN=${tokens.refresh_token}\n`)
    } else {
      console.warn(
        '\n⚠️  No vino refresh_token (ya habías autorizado antes). ' +
          'Revoca el acceso en https://myaccount.google.com/permissions y repite.\n'
      )
    }
  } catch (e) {
    res.writeHead(500).end('Error al canjear el code. Mira la terminal.')
    console.error('❌ Error en el canje:', (e as Error).message)
  } finally {
    server.close()
  }
})

server.listen(PORT, () => {
  console.log('\n1) Abre esta URL y autoriza con venceoposiciones@gmail.com:\n')
  console.log(authUrl + '\n')
  exec(`xdg-open "${authUrl}"`, () => {}) // intenta abrir el navegador; si falla, copia la URL
})
