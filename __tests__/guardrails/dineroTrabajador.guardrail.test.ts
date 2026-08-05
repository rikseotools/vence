/**
 * ── NINGÚN SCRIPT QUE MUEVA DINERO SE QUEDA SIN SU PUERTA ────────────────────────────────────
 *
 * Gemelo de `aprobacionEnvios.guardrail.test.ts`, y por la misma razón: así es como se pierden
 * las protecciones — no quitándolas, sino **añadiendo un octavo script que no la tiene**.
 *
 * Y aquí hay una segunda capa que este test también vigila: el entorno del trabajador se GENERA
 * (`lib/flota/entornoTrabajador.cjs`), no se copia. El 05/08/2026 se copió el `.env.local` entero
 * a las cuatro máquinas del VPS y con él viajaron **dos claves `sk_live`**, el token de Bitrefill
 * y los de Ads. Las dos capas son necesarias: la del entorno hace que no PUEDA, la de la puerta
 * hace que no lo intente aunque un día vuelva a poder.
 */
import * as fs from 'fs'
import * as path from 'path'

const RAIZ = process.cwd()
const { decidirVariable, filtrarEntorno, NO_VIAJAN } = require(
  path.join(RAIZ, 'lib', 'flota', 'entornoTrabajador.cjs'))
const { puedeTocarDinero, OPERACIONES_DE_DINERO } = require(
  path.join(RAIZ, 'lib', 'sessions', 'dinero.cjs'))

// Los scripts que hoy hablan con un proveedor de dinero. Detectado por el USO real de la
// credencial o del cliente, no por mencionar la palabra.
const SCRIPTS_DE_DINERO = [
  'scripts/backfill-loyalty-coupons.cjs',
  'scripts/import-stripe-payments.cjs',
  'scripts/conciliar-vales.ts',
  'scripts/stripe/precio-heredado.cjs',
]

describe('la puerta del dinero', () => {
  it('solo una persona; y no declarar rol cuenta como trabajador (fail-closed)', () => {
    for (const tipo of Object.keys(OPERACIONES_DE_DINERO)) {
      expect(puedeTocarDinero('persona', tipo).ok).toBe(true)
      expect(puedeTocarDinero('trabajador', tipo).ok).toBe(false)
      expect(puedeTocarDinero(undefined, tipo).ok).toBe(false)
      expect(puedeTocarDinero(null, tipo).ok).toBe(false)
    }
  })

  it('una operación no declarada NO pasa: añadirla obliga a decir qué mueve', () => {
    expect(puedeTocarDinero('persona', 'lo_que_sea').ok).toBe(false)
  })

  it('cada script que toca dinero importa la puerta', () => {
    const sin: string[] = []
    for (const rel of SCRIPTS_DE_DINERO) {
      const p = path.join(RAIZ, rel)
      if (!fs.existsSync(p)) continue
      const src = fs.readFileSync(p, 'utf8')
      if (!/dinero\.cjs|exigirPersonaParaDinero/.test(src)) sin.push(rel)
    }
    expect(sin).toEqual([])
  })
})

describe('el entorno del trabajador se genera, no se copia', () => {
  it('ninguna credencial que mueva dinero viaja', () => {
    for (const v of ['STRIPE_SECRET_KEY', 'STRIPE_SECRET_KEY_NILA', 'STRIPE_WEBHOOK_SECRET',
      'BITREFILL_API_TOKEN', 'GOOGLE_ADS_REFRESH_TOKEN', 'META_ADS_ACCESS_TOKEN']) {
      expect(decidirVariable(v).viaja).toBe(false)
    }
  })

  it('ni la de enviar correo, ni la que acuña sesiones de cualquier usuario', () => {
    expect(decidirVariable('RESEND_API_KEY').viaja).toBe(false)
    expect(decidirVariable('EMAIL_FROM_ADDRESS').viaja).toBe(false)
    expect(decidirVariable('AUTH_SECRET').viaja).toBe(false)
  })

  it('pero SÍ viaja lo que necesita para trabajar: quitarlo lo limitaría', () => {
    for (const v of ['DATABASE_URL', 'AWS_ACCESS_KEY_ID', 'ANTHROPIC_API_KEY',
      'NEXT_PUBLIC_SITE_URL', 'CRON_SECRET']) {
      expect(decidirVariable(v).viaja).toBe(true)
    }
  })

  it('las NEXT_PUBLIC_STRIPE_* sí viajan: son públicas por definición (van en el bundle)', () => {
    expect(decidirVariable('NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY').viaja).toBe(true)
    expect(decidirVariable('NEXT_PUBLIC_STRIPE_PRICE_MONTHLY').viaja).toBe(true)
  })

  it('comenta la línea con el motivo en vez de borrarla, para que se sepa QUÉ falta y por qué', () => {
    const { texto, quitadas } = filtrarEntorno('DATABASE_URL=x\nSTRIPE_SECRET_KEY=sk_live_zzz\n')
    expect(texto).toContain('DATABASE_URL=x')
    expect(texto).not.toContain('sk_live_zzz')
    expect(texto).toMatch(/# \[flota\] STRIPE_SECRET_KEY no viaja/)
    expect(quitadas.map((q: any) => q.nombre)).toEqual(['STRIPE_SECRET_KEY'])
  })

  it('cada familia excluida dice POR QUÉ (un motivo vacío se copia sin pensar)', () => {
    for (const r of NO_VIAJAN) expect(String(r.motivo).length).toBeGreaterThan(15)
  })
})
