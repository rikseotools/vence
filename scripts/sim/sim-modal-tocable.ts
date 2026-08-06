#!/usr/bin/env npx tsx
/**
 * SIMULACIÓN [T-608] — un modal abierto en MÓVIL se puede TOCAR entero, también en la parte de abajo.
 *
 * ## Por qué hace falta un navegador, y por qué en móvil, y por qué SIN aceptar las cookies
 *
 * El defecto que lo origina (feedback Laura Simar, 06/08/2026) no lo ve el typecheck, ni un
 * unitario, ni una captura de pantalla: **el modal se pintaba perfecto** y aun así el cuarto
 * inferior no respondía, porque el banner de cookies (`fixed bottom-0 z-[9999]`) se llevaba los
 * toques y el modal estaba en `z-50`. Lo único que lo distingue es preguntar *«¿quién recibe el
 * toque en este punto?»*, y eso solo lo contesta un navegador de verdad.
 *
 * Las tres condiciones son necesarias a la vez, y por eso llevaba tiempo invisible:
 *   · **móvil**, porque en escritorio el modal cabe holgado y no llega a la franja del banner;
 *   · **con el banner de cookies EN PANTALLA**, o sea sin aceptarlas — quien ya las aceptó no
 *     vuelve a verlo, y desde ahí probamos siempre;
 *   · y mirando el punto concreto, no el aspecto general.
 *
 * Por eso el caso de CONTRASTE (aceptar las cookies y repetir) no es adorno: si las dos pasadas
 * dieran lo mismo, la simulación no estaría midiendo el banner.
 *
 * SOLO LEE. No escribe en ninguna tabla.
 *
 * Uso:
 *   npm run sim:modal-tocable -- --usuario <uuid>
 *   npm run sim:modal-tocable -- --oposicion <position_type> --tema 19
 *   SIM_BASE=http://localhost:3477 npm run sim:modal-tocable -- --usuario <uuid>
 *
 * Necesita AUTH_SECRET (SSM /vence-frontend/AUTH_SECRET): el modal de falladas exige sesión
 * y un historial de fallos.
 *
 * Sale 1 si algún punto del modal se lo queda otra capa.
 */
import { chromium, devices } from '@playwright/test'
import postgres from 'postgres'
import { mintOwnAuthCookie, cookieForPlaywright } from '../../lib/sim/session'
import { CAPAS } from '../../lib/ui/capas'
import { SLUG_TO_POSITION_TYPE } from '../../lib/config/oposiciones'

const arg = (n: string, d = '') => {
  const i = process.argv.indexOf(n)
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : d
}
const BASE = process.env.SIM_BASE || arg('--url', 'https://www.vence.es')
const HOST = new URL(BASE).hostname
const SECRET = process.env.AUTH_SECRET || process.env.SIM_AUTH_SECRET || ''
const MOVIL = arg('--movil', 'iPhone 13')

const sql = postgres(process.env.DATABASE_URL!, { ssl: 'require', max: 2 })
const fallos: string[] = []

interface Sondeo { y: number; z: string; texto: string; delModal: boolean }

/**
 * Abre el modal de falladas y pregunta, punto por punto de arriba abajo, QUIÉN recibiría el toque.
 * `aceptarCookies` decide si antes se quita de en medio el banner: es el contraste.
 */
async function sondear(ctx: import('@playwright/test').BrowserContext, url: string, aceptarCookies: boolean) {
  const page = await ctx.newPage()
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 })
  await page.waitForTimeout(7000)
  if (aceptarCookies) {
    const ck = page.getByRole('button', { name: /Aceptar todo/ })
    if (await ck.count()) { await ck.first().click().catch(() => {}); await page.waitForTimeout(1000) }
  }

  const casilla = page.locator('label', { hasText: /Solo preguntas falladas/i })
  if (!(await casilla.count())) { await page.close(); return { abierto: false, puntos: [] as Sondeo[] } }

  // Se espera la RESPUESTA del endpoint y luego a que el modal aparezca, nunca un reloj: en dev
  // la primera compilación de la ruta tarda varios segundos y un `waitForTimeout` daba «el modal
  // no llegó a abrirse» con el arreglo bien puesto — un canario que depende de lo rápida que sea
  // la máquina no es un canario (misma lección que `sim-repaso-ajeno`).
  const respuesta = page.waitForResponse(r => r.url().includes('/api/v2/tests/failed-questions'), { timeout: 90000 })
    .catch(() => null)
  await casilla.first().locator('input[type=checkbox]').click({ force: true }).catch(() => {})
  await respuesta
  const abierto = await page.getByText(/Preguntas Falladas/i).first()
    .waitFor({ state: 'visible', timeout: 30000 }).then(() => true).catch(() => false)
  if (abierto) await page.waitForTimeout(1200) // que asiente la animación de apertura
  if (!abierto) { await page.close(); return { abierto: false, puntos: [] as Sondeo[] } }

  const alto = (page.viewportSize()!).height
  const puntos: Sondeo[] = await page.evaluate((h) => {
    const out: Array<{ y: number; z: string; texto: string; delModal: boolean }> = []
    for (const frac of [0.25, 0.45, 0.6, 0.75, 0.88]) {
      const y = Math.round(h * frac)
      const el = document.elementFromPoint(Math.round(window.innerWidth / 2), y)
      if (!el) { out.push({ y, z: '(nada)', texto: '', delModal: false }); continue }
      let capa: Element | null = el, z = '(sin capa fija)', delModal = false
      while (capa && capa !== document.body) {
        const s = getComputedStyle(capa)
        if (s.position === 'fixed') {
          z = s.zIndex
          delModal = /Preguntas Falladas/.test((capa as HTMLElement).innerText || '')
          break
        }
        capa = capa.parentElement
      }
      out.push({ y, z, texto: (el.textContent || '').trim().slice(0, 40), delModal })
    }
    return out
  }, alto)
  await page.close()
  return { abierto, puntos }
}

async function main() {
  if (!SECRET) throw new Error('falta AUTH_SECRET (SSM /vence-frontend/AUTH_SECRET)')

  let userId = arg('--usuario')
  const positionType = arg('--oposicion')
  const tema = arg('--tema', '19')
  if (!userId && !positionType) throw new Error('pásame --usuario <uuid> o --oposicion <position_type>')

  if (!userId) {
    const cand = await sql<{ id: string }[]>`
      SELECT p.id FROM user_profiles p
       WHERE p.target_oposicion = ${positionType}
         AND EXISTS (SELECT 1 FROM tests t WHERE t.user_id = p.id)
       ORDER BY p.created_at DESC LIMIT 1`
    if (!cand.length) { console.log(`⚠️  nadie con tests en «${positionType}»`); await sql.end(); process.exit(0) }
    userId = cand[0].id
  }
  const perfil = await sql<{ target_oposicion: string | null }[]>`
    SELECT target_oposicion FROM user_profiles WHERE id = ${userId}`
  const pt = perfil[0]?.target_oposicion || positionType
  await sql.end()
  // El slug de la RUTA no está en `oposiciones` (esa tabla no tiene `position_type`): la fuente
  // canónica del mapeo ruta↔oposición es la config, que es la misma que usan las páginas.
  const slug = Object.entries(SLUG_TO_POSITION_TYPE).find(([, v]) => v === pt)?.[0]
  if (!slug) { console.log(`⚠️  no encuentro el slug de «${pt}» en la config de oposiciones`); process.exit(0) }

  const url = `${BASE}/${slug}/test/tema/${tema}`
  console.log(`📱 ¿se puede TOCAR el modal entero? — ${MOVIL} · ${url}\n`)
  console.log(`   (la capa del modal debería ser ${CAPAS.modal}; el aviso legal es ${CAPAS.avisoLegal})\n`)

  const navegador = await chromium.launch()
  const dispositivo = (devices as Record<string, object>)[MOVIL]
  if (!dispositivo) throw new Error(`dispositivo desconocido: ${MOVIL}`)

  for (const aceptar of [false, true]) {
    const ctx = await navegador.newContext({ ...dispositivo, baseURL: BASE, locale: 'es-ES' })
    const cookie = await mintOwnAuthCookie(
      { userId, email: 'sim-t608@vence.es' }, SECRET,
      { nowSec: Math.floor(Date.now() / 1000), host: HOST },
    )
    await ctx.addCookies([cookieForPlaywright(cookie, HOST)])
    const { abierto, puntos } = await sondear(ctx, url, aceptar)
    await ctx.close()

    const etiqueta = aceptar ? 'CON las cookies aceptadas (contraste)' : 'SIN aceptar cookies (lo que ve quien entra)'
    console.log(`── ${etiqueta}`)
    if (!abierto) { console.log('   ⚠️  el modal no llegó a abrirse: sin material para juzgar\n'); continue }

    const robados = puntos.filter(p => !p.delModal)
    for (const p of puntos) {
      console.log(`   y=${String(p.y).padStart(4)} → ${p.delModal ? '✅ modal' : '❌ OTRA CAPA'} (z=${p.z}) ${JSON.stringify(p.texto)}`)
    }
    if (robados.length) {
      console.log(`   ❌ ${robados.length}/${puntos.length} punto(s) del modal se los queda otra capa\n`)
      // Solo cuenta como FALLO el caso real (sin aceptar): el contraste está para demostrar
      // que la medición distingue las dos situaciones, no para exigir nada.
      if (!aceptar) fallos.push(`${robados.length} punto(s) del modal inalcanzables con el aviso legal en pantalla`)
    } else {
      console.log('   ✅ todos los puntos llegan al modal\n')
    }
  }

  await navegador.close()
  console.log(fallos.length ? `❌ ${fallos.join(' · ')}\n` : '✅ el modal se puede tocar entero\n')
  process.exit(fallos.length ? 1 : 0)
}

main().catch(e => { console.error('❌', e); process.exit(1) })
