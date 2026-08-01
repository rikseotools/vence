/**
 * ¿SE CURA DE VERDAD UN USUARIO ROTO? — el reintento de perfil, con navegador real. (T-434)
 *
 * ── QUÉ CAPA ES ESTA, Y POR QUÉ NINGUNA OTRA LA CUBRE ───────────────────────────────────────
 *
 * El arreglo de T-434 tiene dos mitades y solo una estaba probada ejecutándose:
 *
 *   · la DECISIÓN (`decidirReintentoPerfil`) y la RESOLUCIÓN (`resolverPerfilPorEmail`) tienen
 *     unitarios y una simulación contra la BD real — se ejecutan de verdad;
 *   · el CABLEADO dentro del callback `jwt` de Auth.js **no lo ejercía nada**. Sus guardarraíles
 *     leen el fichero como texto y comprueban que las líneas están ahí. Eso demuestra que el
 *     código está ESCRITO, no que FUNCIONE.
 *
 * Y es justo la mitad que no se puede probar de otra forma: ese callback lo invoca `@auth/core`
 * por dentro, con su propio token, en cada rotación de sesión. No hay manera de llamarlo desde
 * un test — hay que hacer que la aplicación lo llame. Por eso esto es un navegador de verdad
 * contra la aplicación viva.
 *
 * El modo de fallo que caza es el peor de todos porque es SILENCIOSO: si el cableado no corre,
 * el canario dirá «0 curaciones», y eso se lee igual que «no había nadie a quien curar».
 *
 * ── CÓMO ENTRA SIN PASAR POR GOOGLE ─────────────────────────────────────────────────────────
 *
 * La única puerta de alta es Google, pero la SESIÓN es una cookie firmada con `AUTH_SECRET`.
 * Se forja aquí —mismo mecanismo que `sim-impersonacion.ts`, no se inventa otro— y así se puede
 * fabricar el estado exacto de los 235 usuarios rotos: **cookie válida, con su email, y SIN
 * `appUserId`**. Que es precisamente el estado que no se puede pedirle a Google que produzca.
 *
 * ── NO ESCRIBE NADA ─────────────────────────────────────────────────────────────────────────
 *
 * Usa un usuario que YA existe, así que la reparación esperada es «encontrar su perfil», no
 * crear uno. Es seguro correrlo contra producción, que es donde de verdad hay que comprobarlo.
 *
 * Uso:
 *   npx tsx --env-file=.env.local scripts/sim/sim-perfil-roto-se-cura.ts [--url=https://www.vence.es]
 */
import { config } from 'dotenv'
config({ path: '.env.local' })
import { chromium } from 'playwright'
import { encode } from 'next-auth/jwt'

const URL_BASE = process.argv.find((a) => a.startsWith('--url'))?.split('=')[1] || 'http://localhost:3000'

const MES = 60 * 60 * 24 * 30

type Caso = { nombre: string; ok: boolean; detalle: string }
const casos: Caso[] = []
const anota = (nombre: string, ok: boolean, detalle: string) => {
  casos.push({ nombre, ok, detalle })
  console.log(`   ${ok ? '✅' : '❌'} ${nombre}\n      ${detalle}`)
}

async function main() {
  const secret = process.env.AUTH_SECRET
  if (!secret) {
    console.error('❌ Falta AUTH_SECRET (SSM: /vence-frontend/AUTH_SECRET).')
    process.exit(1)
  }
  const { sessionCookieNameFor, cookieForPlaywright } = await import('../../lib/sim/session')
  const { pgConfig } = await import('../../lib/db/pgSsl.cjs')
  const { Client } = await import('pg')

  // Un usuario REAL cualquiera: la reparación esperada es encontrarlo, no crearlo.
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
  const { id: uid, email } = rows[0] as { id: string; email: string }

  const host = new URL(URL_BASE).hostname
  const COOKIE = sessionCookieNameFor(host)
  const now = () => Math.floor(Date.now() / 1000)

  console.log(`\n══ ¿Se cura un usuario roto? — reintento de perfil (T-434) ═══════════════`)
  console.log(`   navegador real contra ${URL_BASE}`)
  console.log(`   usuario de prueba: ${email.slice(0, 3)}***@${email.split('@')[1]} (${uid})\n`)

  const cookieCon = async (token: Record<string, unknown>) =>
    encode({ token, secret, salt: COOKIE, maxAge: MES })

  const navegador = await chromium.launch()

  /** Abre una pestaña con la cookie dada, carga una página y devuelve lo que ve la app. */
  const conSesion = async (token: Record<string, unknown>) => {
    const ctx = await navegador.newContext()
    await ctx.addCookies([cookieForPlaywright(await cookieCon(token), host)])
    const p = await ctx.newPage()
    // Cargar una página normal es lo que dispara la ROTACIÓN de sesión, que es el momento en
    // el que corre el callback. Sin esto no se estaría probando nada.
    const resp = await p.goto(`${URL_BASE}/`, { waitUntil: 'domcontentloaded' })
    const estadoPagina = resp?.status() ?? 0
    const r = await p.request.get(`${URL_BASE}/api/auth/session`)
    const sesion = (await r.json().catch(() => null)) as { user?: { id?: string } } | null
    await ctx.close()
    return { estadoPagina, idQueVeLaApp: sesion?.user?.id ?? null, sesion }
  }

  try {
    // ── 1. EL CASO DE LOS 235 ────────────────────────────────────────────────────────────
    console.log('1) Usuario roto: cookie válida, con email, SIN appUserId')
    const roto = await conSesion({ email, sub: uid, iat: now(), exp: now() + MES, jti: `sim-${now()}` })
    anota(
      'la sesión sigue viva (no se rompe a quien se viene a reparar)',
      roto.estadoPagina === 200,
      `la home responde ${roto.estadoPagina}`,
    )
    anota(
      'la app YA le reconoce su perfil real (el reintento ha corrido)',
      roto.idQueVeLaApp === uid,
      roto.idQueVeLaApp === uid
        ? `session.user.id = ${uid} — curado`
        : `session.user.id = ${roto.idQueVeLaApp ?? 'null'}, esperado ${uid}. ` +
          `Si esto falla contra un despliegue que YA lleva el arreglo, el cableado no corre.`,
    )

    // ── 2. EL USUARIO SANO NO SE TOCA ────────────────────────────────────────────────────
    console.log('\n2) Usuario sano: ya trae su appUserId')
    const sano = await conSesion({
      appUserId: uid,
      email,
      sub: uid,
      iat: now(),
      exp: now() + MES,
      jti: `sim-${now()}`,
    })
    anota(
      'sigue viendo su perfil, sin cambios',
      sano.estadoPagina === 200 && sano.idQueVeLaApp === uid,
      `home ${sano.estadoPagina} · session.user.id = ${sano.idQueVeLaApp}`,
    )

    // ── 3. SIN EMAIL: EL CASO QUE EL REINTENTO NO PUEDE CURAR ────────────────────────────
    //
    // Lo que se comprueba aquí NO es que se cure —no puede—, sino que **no se rompe**. Es la
    // rama que emite `auth_sesion_sin_email`, y si al pasar por ella la sesión reventara,
    // habríamos cambiado «no puede pagar» por «no puede entrar».
    console.log('\n3) Sesión sin email: no hay por dónde curarla, pero NO puede reventar')
    const sinEmail = await conSesion({ sub: uid, iat: now(), exp: now() + MES, jti: `sim-${now()}` })
    anota(
      'la página carga igual (degradar, nunca derribar)',
      sinEmail.estadoPagina === 200,
      `la home responde ${sinEmail.estadoPagina}`,
    )

    // ── 4. DOS CARGAS SEGUIDAS ───────────────────────────────────────────────────────────
    //
    // La ventana de 5 min vive en el token, que se re-firma en cada rotación. Aquí no se
    // puede leer el token desde fuera, así que lo que se comprueba es lo observable: que
    // recargar no deja al usuario peor de lo que estaba.
    console.log('\n4) Recargar dos veces seguidas no empeora nada')
    const t = { email, sub: uid, iat: now(), exp: now() + MES, jti: `sim-${now()}` }
    const a = await conSesion(t)
    const b = await conSesion(t)
    anota(
      'las dos cargas responden y coinciden',
      a.estadoPagina === 200 && b.estadoPagina === 200 && a.idQueVeLaApp === b.idQueVeLaApp,
      `1ª: ${a.estadoPagina}/${a.idQueVeLaApp} · 2ª: ${b.estadoPagina}/${b.idQueVeLaApp}`,
    )
  } finally {
    await navegador.close()
  }

  const fallos = casos.filter((x) => !x.ok)
  console.log('\n' + '═'.repeat(72))
  if (fallos.length === 0) {
    console.log('✅ SIMULACIÓN VERDE — el reintento corre de verdad en la aplicación viva')
    return
  }
  console.log(`❌ SIMULACIÓN ROJA — ${fallos.length} de ${casos.length}`)
  for (const f of fallos) console.log(`   · ${f.nombre}: ${f.detalle}`)
  console.log(
    '\n   OJO: contra un despliegue que TODAVÍA no lleva T-434, el caso 1 falla por diseño.\n' +
      '   Eso no es un defecto: es la línea base. Vuelve a correrlo después de desplegar.',
  )
  process.exit(1)
}

main().catch((e) => {
  console.error('❌', e)
  process.exit(1)
})
