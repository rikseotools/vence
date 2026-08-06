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

  // ⚠️ ESTE TEST FIJABA EL BUG (corregido el 06/08, T-612). Afirmaba que DATABASE_URL,
  // AWS_ACCESS_KEY_ID, ANTHROPIC_API_KEY y CRON_SECRET «SÍ viajan» porque «quitarlo lo
  // limitaría» — y eso es exactamente lo que dejó a los cinco worktrees del VPS con la
  // credencial de escritura total sobre la BD de producción. Un test verde puede estar
  // certificando el defecto: lo que fijaba no era una necesidad medida, era una suposición.
  it('lo que necesita para trabajar viaja — pero eso NO incluye credenciales de admin', () => {
    // Lo que de verdad necesita: lo público y sus roles ACOTADOS.
    for (const v of ['NEXT_PUBLIC_SITE_URL', 'VENCE_LECTOR_URL', 'VENCE_COORDINACION_URL']) {
      expect(decidirVariable(v).viaja).toBe(true)
    }
    // Y lo que se creía necesario y no lo era: su DATABASE_URL lo escribe
    // `arrancar-trabajador.sh` con el rol de coordinación, no se hereda del portátil.
    for (const v of ['DATABASE_URL', 'AWS_ACCESS_KEY_ID', 'ANTHROPIC_API_KEY', 'CRON_SECRET']) {
      expect(decidirVariable(v).viaja).toBe(false)
    }
  })

  it('las NEXT_PUBLIC_STRIPE_* sí viajan: son públicas por definición (van en el bundle)', () => {
    expect(decidirVariable('NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY').viaja).toBe(true)
    expect(decidirVariable('NEXT_PUBLIC_STRIPE_PRICE_MONTHLY').viaja).toBe(true)
  })

  it('comenta la línea con el motivo en vez de borrarla, para que se sepa QUÉ falta y por qué', () => {
    const { texto, quitadas } = filtrarEntorno('NEXT_PUBLIC_SITE_URL=x\nSTRIPE_SECRET_KEY=sk_live_zzz\n')
    expect(texto).toContain('NEXT_PUBLIC_SITE_URL=x')
    expect(texto).not.toMatch(/^STRIPE_SECRET_KEY=/m)     // no queda como línea ACTIVA
    expect(texto).toMatch(/# \[flota\] STRIPE_SECRET_KEY no viaja/)
    expect(quitadas.map((q: any) => q.nombre)).toEqual(['STRIPE_SECRET_KEY'])
  })

  it('cada familia excluida EXPRESAMENTE dice POR QUÉ (un motivo vacío se copia sin pensar)', () => {
    for (const r of NO_VIAJAN) expect(String(r.motivo).length).toBeGreaterThan(15)
  })

  it('y cada permitido declara su porqué: añadir uno tiene que costar una frase', () => {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { VIAJAN } = require(path.join(RAIZ, 'lib', 'flota', 'entornoTrabajador.cjs'))
    expect(VIAJAN.length).toBeLessThanOrEqual(6)   // trinquete: la lista de permitidos NO crece sola
    for (const r of VIAJAN) expect(String(r.porque).length).toBeGreaterThan(10)
  })
})

// ═══════════════════════════════════════════════════════════════════════════════════════════
// LISTA DE LO PERMITIDO, NO DE LO PROHIBIDO (T-612, 06/08) — corrección de este mismo filtro
//
// La versión del 05/08 enumeraba lo peligroso y dejaba pasar TODO lo demás. Medido al día
// siguiente: los cinco worktrees del VPS tenían un `.env.local` producido por este filtro —lleva
// sus motivos literales dentro— con DATABASE_URL=venceadmin (escritura total en producción),
// AWS_ACCESS_KEY_ID/SECRET, GITHUB_PAT, SUPABASE_SERVICE_ROLE_KEY y VERCEL_TOKEN.
//
// Ninguna estaba prohibida. No porque se decidiera que podían viajar, sino porque nadie las
// escribió en la lista. Lo encontró un trabajador auditando, no una alerta nuestra.
// ═══════════════════════════════════════════════════════════════════════════════════════════
describe('lo que no está declarado NO viaja', () => {
  it('una variable que nadie previó se bloquea SOLA — es el arreglo entero', () => {
    const d = decidirVariable('UNA_CREDENCIAL_QUE_AUN_NO_EXISTE')
    expect(d.viaja).toBe(false)
    expect(d.motivo).toMatch(/no está declarada/)
  })

  it.each([
    ['DATABASE_URL', /venceadmin|ESCRITURA TOTAL/],
    ['AWS_ACCESS_KEY_ID', /despliega|SSM/],
    ['AWS_SECRET_ACCESS_KEY', /despliega|SSM/],
    ['GITHUB_PAT', /main|pre-push/],
    ['SUPABASE_SERVICE_ROLE_KEY', /RLS/],
    ['VERCEL_TOKEN', /despliega/],
  ])('las CINCO que el filtro viejo dejó pasar: %s queda fuera y dice por qué', (v, motivo) => {
    const d = decidirVariable(v)
    expect(d.viaja).toBe(false)
    expect(d.motivo).toMatch(motivo)
  })

  it('lo que SÍ necesita para trabajar sigue pasando (no se ha roto al trabajador)', () => {
    for (const v of ['NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY', 'NEXT_PUBLIC_SUPABASE_URL',
                     'VENCE_LECTOR_URL', 'VENCE_COORDINACION_URL', 'VENCE_SESSION_ROLE', 'NODE_ENV']) {
      expect(decidirVariable(v).viaja).toBe(true)
    }
  })

  it('el rechazo EXPRESO gana sobre el permitido, por si alguien nombra mal una variable', () => {
    // Un `NEXT_PUBLIC_` no puede colar una clave secreta por casar con el prefijo permitido.
    expect(decidirVariable('STRIPE_SECRET_KEY').viaja).toBe(false)
  })

  it('un .env real filtrado no conserva ninguna de las cinco', () => {
    const entrada = [
      'DATABASE_URL=postgres://venceadmin:x@host/db',
      'AWS_ACCESS_KEY_ID=AKIAX',
      'GITHUB_PAT=ghp_x',
      'SUPABASE_SERVICE_ROLE_KEY=eyJx',
      'VERCEL_TOKEN=vc_x',
      'NEXT_PUBLIC_SUPABASE_URL=https://x.supabase.co',
    ].join('\n')
    const { texto, quitadas } = filtrarEntorno(entrada)
    for (const v of ['venceadmin', 'AKIAX', 'ghp_x', 'eyJx', 'vc_x']) {
      // El valor no puede sobrevivir como línea ACTIVA (comentado con su motivo sí, para que se
      // entienda la ausencia — pero entonces `dotenv` ya no lo carga).
      const activas = texto.split('\n').filter((l) => !l.trimStart().startsWith('#'))
      expect(activas.join('\n')).not.toContain(v)
    }
    expect(texto).toContain('NEXT_PUBLIC_SUPABASE_URL')
    expect(quitadas.length).toBe(5)
  })
})
