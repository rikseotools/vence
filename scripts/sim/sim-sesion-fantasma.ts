/**
 * ¿SE SUELTA AL FANTASMA SIN SOLTAR AL SANO? — navegador real. (T-434)
 *
 * ── QUÉ CAPA ES ESTA, Y POR QUÉ NINGUNA OTRA LA CUBRE ───────────────────────────────────────
 *
 * `decidirSesionFantasma` tiene unitarios y decide bien. Pero lo que rompía no era la decisión:
 * era el CABLEADO en el navegador — un pre-hydrate que resucita al usuario del blob legacy de
 * Supabase y le pone un perfil cacheado que, a su vez, impide soltarlo. Ese bucle solo existe
 * cuando hay un `localStorage` de verdad, un `INITIAL_SESSION` de verdad y un React montándose
 * de verdad. **No hay forma de reproducirlo con un test.**
 *
 * ── LAS DOS DIRECCIONES, Y POR QUÉ HACEN FALTA LAS DOS ──────────────────────────────────────
 *
 * Este cambio decide si alguien está logueado, así que puede fallar hacia los dos lados y solo
 * uno de ellos se nota:
 *
 *   1. **Soltar de MENOS** → la persona sigue encerrada (el bug original). Silencioso.
 *   2. **Soltar de MÁS** → se desloguea a usuarios SANOS, premium incluidos. Ruidoso y caro.
 *
 * Un caso solo probaría la mitad, y sería justo la mitad que no duele. Por eso cada caso lleva
 * enfrente su contraste.
 *
 * ── ✅ EL FIXTURE ARREGLADO, Y LO QUE ENSEÑÓ (05/08/2026) ────────────────────────────────────
 *
 * La versión anterior salía VERDE contra una producción **sin el arreglo**, y su propia cabecera
 * avisaba de que eso no validaba nada sino que delataba el fixture. Se comprobó con el navegador
 * instrumentado y era exacto: el blob de mentira **no llevaba `access_token`**, así que
 * **supabase-js lo borraba antes de que React montara** —desaparecía a los 3 s y el AuthProvider
 * arrancaba a los 4,3 s—, o sea que el fantasma nunca llegaba a nacer.
 *
 * Con un blob de la forma REAL (con `access_token`, `refresh_token` y `expires_at` no caducado)
 * se reproduce entero: pre-hydrate resucita al usuario, la guarda del perfil cacheado impide
 * soltarlo, y el rastro sobrevive. Esa es la prueba de que la simulación mide lo que dice medir.
 *
 * ── Y EL CASO 3, QUE ES EL QUE DE VERDAD PASA ───────────────────────────────────────────────
 *
 * Al medir los 182 afectados apareció que **no están deslogueados**: 180 tenían identidad
 * verificada, 0 tenían fila en `user_profiles` con el id que rebotaba y 0 estaban en
 * `deleted_users_log`. Son usuarios SANOS con **dos identidades en el navegador**: el rastro
 * legacy dice un id y la sesión Auth.js dice otro. El caso 3 lo reproduce y exige que ese rastro
 * ajeno se suelte; su contraste es el caso 2, donde el rastro es del MISMO usuario y no se toca.
 *
 * ── NO ESCRIBE NADA ─────────────────────────────────────────────────────────────────────────
 *
 * El fantasma se fabrica con un id INVENTADO (uno que no existe en `user_profiles`, que es
 * exactamente el estado de las ~90 personas). El sano usa un usuario real pero solo LEE. Las
 * cookies forjadas llevan la marca de simulación, como el resto de sims de esta familia, para
 * no envenenar el canario que las acompaña.
 *
 * Uso:
 *   npx tsx --env-file=.env.local scripts/sim/sim-sesion-fantasma.ts [--url=https://www.vence.es]
 */
import { config } from 'dotenv'
config({ path: '.env.local' })
import { chromium } from 'playwright'
import { encode } from 'next-auth/jwt'
import { randomUUID } from 'crypto'

const URL_BASE =
  process.argv.find((a) => a.startsWith('--url'))?.split('=')[1] || 'http://localhost:3000'
const MES = 60 * 60 * 24 * 30
// ⏱ CADA CASO MIDE EN SU VENTANA, y no es un detalle de estilo: los dos arreglos actúan en
// momentos distintos, así que una sola espera dejaría a uno de los dos sin poder discriminar.
//
//   · SIN SESIÓN (caso 1): el cliente da DOS oportunidades a la sesión —reintento a los 5 s y
//     otro 10 s después— antes de darla por perdida, para no desloguear a un premium por un
//     bache. La cura corre al final de esa cadena, así que hay que esperarla; medir a los 6 s
//     daría un ROJO falso. Lo que discrimina aquí no es el reloj sino el BLOB: el código viejo
//     también suelta usuario y perfil, y lo que NO soltaba era el rastro que le reencierra.
//   · IDENTIDAD AJENA (caso 3): se decide en el veredicto de `INITIAL_SESSION` (~3,5-6 s). Aquí
//     el reloj SÍ discrimina, y hay que medir ANTES del rescate tardío: pasados los ~18-21 s el
//     código sin el arreglo también ha limpiado y el caso pasaría estando roto.
const VENTANA_TRAS_REINTENTOS_MS = 22_000
const VENTANA_TRAS_VEREDICTO_MS = 10_000

type Caso = { nombre: string; ok: boolean; detalle: string }
const casos: Caso[] = []
const anota = (nombre: string, ok: boolean, detalle: string) => {
  casos.push({ nombre, ok, detalle })
  console.log(`   ${ok ? '✅' : '❌'} ${nombre}\n      ${detalle}`)
}

/**
 * El blob que deja Supabase legacy en `localStorage` y del que tira el pre-hydrate.
 *
 * ⚠️ TIENE QUE PARECERSE AL DE VERDAD, y esto es lo que invalidaba la medición anterior
 * (01/08): la primera versión guardaba solo `{user:{id,email}}`, sin `access_token` ni
 * `expires_at`. Con eso el cliente lo trataba como un token caducado —rama que YA limpiaba— así
 * que el caso salía VERDE contra un código que no tenía el arreglo. **Un verde que no depende
 * del arreglo no prueba nada**, y por poco se lee como que el fallo no existía.
 *
 * Un blob real lleva sesión completa y NO caducada: es el estado en el que están las personas
 * medidas —cliente convencido de estar dentro, servidor que no las conoce—, y el único con el
 * que la simulación puede distinguir el código roto del arreglado.
 */
const blobLegacy = (id: string, email: string) => {
  const ahoraSeg = Math.floor(Date.now() / 1000)
  return JSON.stringify({
    access_token: `sim.${Buffer.from(id).toString('base64url')}.fantasma`,
    refresh_token: `sim-refresh-${id.slice(0, 8)}`,
    token_type: 'bearer',
    expires_in: MES,
    expires_at: ahoraSeg + MES, // NO caducado: si caducara, el cliente ya lo limpiaba por otra rama
    user: {
      id,
      email,
      aud: 'authenticated',
      role: 'authenticated',
      app_metadata: { provider: 'email', providers: ['email'] },
      user_metadata: { full_name: 'Fantasma Sim' },
      created_at: new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString(),
    },
  })
}

/** El perfil cacheado: lo pone el propio pre-hydrate y es lo que impedía soltar al usuario. */
const perfilCacheado = (id: string, email: string) =>
  JSON.stringify({ profile: { id, email, plan_type: 'premium' }, cachedAt: Date.now() })

async function main() {
  const secret = process.env.AUTH_SECRET
  if (!secret) {
    console.error('❌ Falta AUTH_SECRET (SSM: /vence-frontend/AUTH_SECRET).')
    process.exit(1)
  }
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  if (!supabaseUrl) {
    console.error('❌ Falta NEXT_PUBLIC_SUPABASE_URL: sin ella no se puede formar la clave.')
    process.exit(1)
  }
  const ref = supabaseUrl.split('://')[1]?.split('.')[0]
  const CLAVE_SESION = `sb-${ref}-auth`
  const CLAVE_PERFIL = `sb-${ref}-profile`

  const { sessionCookieNameFor, cookieForPlaywright, CLAIM_SIMULACION } = await import(
    '../../lib/sim/session'
  )
  const { pgConfig } = await import('../../lib/db/pgSsl.cjs')
  const { Client } = await import('pg')

  const c = new Client(pgConfig(process.env.DATABASE_URL!))
  await c.connect()
  const { rows } = await c.query(
    `SELECT id, email FROM user_profiles WHERE email IS NOT NULL AND email <> '' ORDER BY created_at DESC LIMIT 1`,
  )
  await c.end()
  if (!rows.length) {
    console.error('❌ Sin usuario con email en la BD.')
    process.exit(1)
  }
  const sano = rows[0] as { id: string; email: string }

  const host = new URL(URL_BASE).hostname
  const COOKIE = sessionCookieNameFor(host)
  const ahora = () => Math.floor(Date.now() / 1000)

  console.log(`\n══ ¿Se suelta al fantasma sin soltar al sano? (T-434) ════════════════════`)
  console.log(`   navegador real contra ${URL_BASE}\n`)

  const navegador = await chromium.launch()

  /**
   * Siembra el `localStorage` ANTES de que cargue la aplicación —si no, el pre-hydrate ya habría
   * corrido y no estaríamos probando el caso— y devuelve lo que queda después.
   */
  const abrir = async (opts: { cookie?: string; id: string; email: string; esperaMs: number }) => {
    const ctx = await navegador.newContext()
    if (opts.cookie) await ctx.addCookies([cookieForPlaywright(opts.cookie, host)])
    await ctx.addInitScript(
      ([k1, v1, k2, v2]: string[]) => {
        try {
          localStorage.setItem(k1, v1)
          localStorage.setItem(k2, v2)
        } catch {}
      },
      [CLAVE_SESION, blobLegacy(opts.id, opts.email), CLAVE_PERFIL, perfilCacheado(opts.id, opts.email)],
    )
    const p = await ctx.newPage()
    await p.goto(`${URL_BASE}/`, { waitUntil: 'domcontentloaded' })
    await p.waitForTimeout(opts.esperaMs)
    const estado = await p.evaluate(
      ([k1, k2]: string[]) => ({
        sesionLegacy: localStorage.getItem(k1) !== null,
        perfilCacheado: localStorage.getItem(k2) !== null,
      }),
      [CLAVE_SESION, CLAVE_PERFIL],
    )
    await ctx.close()
    return estado
  }

  // ── 1. EL FANTASMA: blob legacy en localStorage y NINGUNA cookie de Auth.js ───────────────
  // Es el estado exacto de las ~90 personas medidas: el cliente cree que está dentro y el
  // servidor no le conoce. Debe soltarse.
  const idFantasma = randomUUID()
  const f = await abrir({
    id: idFantasma,
    email: `fantasma-${idFantasma.slice(0, 8)}@ejemplo.test`,
    esperaMs: VENTANA_TRAS_REINTENTOS_MS,
  })
  anota(
    'al fantasma se le suelta: se borra el rastro que le resucitaba',
    !f.sesionLegacy && !f.perfilCacheado,
    `blob legacy=${f.sesionLegacy ? 'SIGUE' : 'borrado'} · perfil cacheado=${
      f.perfilCacheado ? 'SIGUE' : 'borrado'
    }. Si alguno sobrevive, la próxima carga vuelve a encerrarle.`,
  )

  // ── 2. EL CONTRASTE, y es el que protege el dinero: usuario SANO ──────────────────────────
  // Misma siembra de localStorage, pero CON cookie de Auth.js válida. No se le puede tocar: si
  // este caso se pone rojo, estamos deslogueando a gente que está dentro, premium incluidos.
  const cookieSana = await encode({
    token: {
      sub: sano.id,
      email: sano.email,
      appUserId: sano.id,
      [CLAIM_SIMULACION]: true,
      iat: ahora(),
      exp: ahora() + MES,
    },
    secret,
    salt: COOKIE,
    maxAge: MES,
  })
  const s = await abrir({
    cookie: cookieSana,
    id: sano.id,
    email: sano.email,
    esperaMs: VENTANA_TRAS_REINTENTOS_MS,
  })
  anota(
    'al usuario SANO no se le toca (el caso que protege el dinero)',
    s.perfilCacheado,
    `perfil cacheado=${s.perfilCacheado ? 'intacto' : 'BORRADO (mal: le hemos deslogueado)'}.` +
      ` Usuario real ${sano.email.slice(0, 3)}***, con cookie Auth.js válida.`,
  )

  // ── 3. EL CASO QUE DE VERDAD PASA: sesión BUENA + rastro de OTRA identidad ────────────────
  //
  // Medido el 05/08/2026 sobre los 182 que rebotaban en 14 días: 180 tenían identidad
  // verificada, 0 tenían perfil con el id que rebotaba, 0 estaban dados de baja. No están
  // deslogueados: **son sanos con dos nombres en el navegador**, y el viejo se cuela como
  // `?userId=` en los endpoints que reciben el id por parámetro (1.920 de esos 401 no traían
  // identidad de token). Mientras el rastro sobreviva, cada carga vuelve a hacerlo.
  //
  // Se exige que el BLOB LEGACY desaparezca: es el que resucita al fantasma en la carga
  // siguiente. No se exige nada del perfil cacheado porque, tras descartarlo, la app carga el
  // perfil BUENO y vuelve a escribirlo — con el id correcto, que es lo que se quería.
  const idAjeno = randomUUID()
  const a = await abrir({
    cookie: cookieSana,
    id: idAjeno,
    email: `ajeno-${idAjeno.slice(0, 8)}@ejemplo.test`,
    esperaMs: VENTANA_TRAS_VEREDICTO_MS,
  })
  anota(
    'con sesión BUENA, el rastro de OTRA identidad se suelta',
    !a.sesionLegacy,
    `blob legacy=${a.sesionLegacy ? 'SIGUE (mal: la próxima carga vuelve a mandar el id ajeno)' : 'borrado'}.` +
      ` Cookie de ${sano.email.slice(0, 3)}*** y rastro de ${idAjeno.slice(0, 8)} (que no existe).`,
  )

  await navegador.close()

  const fallos = casos.filter((x) => !x.ok)
  console.log(`\n   ${fallos.length ? '❌' : '✅'} ${casos.length - fallos.length}/${casos.length} casos OK\n`)
  return fallos.length ? 1 : 0
}

main()
  .then((c) => process.exit(c))
  .catch((e) => {
    // Una simulación que no puede ejecutarse NO es una simulación en verde.
    console.error(`\n⚠️  sim-sesion-fantasma: no pude comprobarlo (${e.message}).\n`)
    process.exit(1)
  })
