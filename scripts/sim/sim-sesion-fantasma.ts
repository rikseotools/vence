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
 * ── ⚠️ ESTADO: EL FIXTURE DEL CASO 1 NO REPRODUCE AÚN EL FALLO (01/08/2026) ─────────────────
 *
 * Al estrenarla contra producción —que en ese momento **no llevaba el arreglo**— el caso 1 salió
 * VERDE. Eso no valida nada: **prueba que el fixture está mal**. Si el fantasma sintético se
 * limpia solo en el código viejo, entonces no es el estado en el que están las ~90 personas
 * reales, y la simulación no puede afirmar que el arreglo las cure.
 *
 * Lo más probable es que el blob de aquí caiga en la rama de «token expirado», que YA limpiaba
 * (ver `limpiarRastroDeSesion` y su llamada original). Un blob de Supabase de verdad lleva
 * `access_token`, `refresh_token` y `expires_at`; este no. **Antes de creerse un verde hay que
 * hacer que el caso 1 salga ROJO contra una versión sin el arreglo** — esa es la prueba de que
 * la simulación mide lo que dice medir, igual que se hizo con `sim-perfil-roto-se-cura`.
 *
 * El caso 2 (el sano) sí es informativo tal cual: comprueba que no deslogueamos a quien tiene
 * cookie válida, y ese contraste vale con cualquier fixture.
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

type Caso = { nombre: string; ok: boolean; detalle: string }
const casos: Caso[] = []
const anota = (nombre: string, ok: boolean, detalle: string) => {
  casos.push({ nombre, ok, detalle })
  console.log(`   ${ok ? '✅' : '❌'} ${nombre}\n      ${detalle}`)
}

/** El blob que deja Supabase legacy en `localStorage` y del que tira el pre-hydrate. */
const blobLegacy = (id: string, email: string) =>
  JSON.stringify({ user: { id, email, user_metadata: { full_name: 'Fantasma Sim' } } })

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
  const abrir = async (opts: { cookie?: string; id: string; email: string }) => {
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
    // El veredicto llega con `INITIAL_SESSION`, que el adaptador emite por sondeo: hay que
    // darle su tiempo o se mediría el estado de antes de la decisión.
    await p.waitForTimeout(6000)
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
  const f = await abrir({ id: idFantasma, email: `fantasma-${idFantasma.slice(0, 8)}@ejemplo.test` })
  anota(
    'al fantasma se le suelta: se borra el rastro que le resucitaba',
    !f.sesionLegacy && !f.perfilCacheado,
    `blob legacy=${f.sesionLegacy ? 'SIGUE (mal)' : 'borrado'} · perfil cacheado=${
      f.perfilCacheado ? 'SIGUE (mal)' : 'borrado'
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
  const s = await abrir({ cookie: cookieSana, id: sano.id, email: sano.email })
  anota(
    'al usuario SANO no se le toca (el caso que protege el dinero)',
    s.perfilCacheado,
    `perfil cacheado=${s.perfilCacheado ? 'intacto' : 'BORRADO (mal: le hemos deslogueado)'}.` +
      ` Usuario real ${sano.email.slice(0, 3)}***, con cookie Auth.js válida.`,
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
