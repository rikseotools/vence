// __tests__/canary/oposicionIdentityBD.test.ts
// CANARY contra BD del fix "guard fantasma": verifica que TODO perfil con
// target_oposicion puesto pero target_oposicion_data NULL (los ~428) apunta a una
// oposición que el CATÁLOGO conoce → el contexto le deriva nombre + hasOposicion y
// NO le sale el selector. Oposición desconocida = dato corrupto (fuera del fix).
//
// Guardado por DATABASE_URL (patrón officialExamsCoherence): se SALTA en CI sin BD,
// corre en local/post-deploy con `DATABASE_URL=... npx jest oposicionIdentityBD`.
import { ALL_OPOSICION_IDS, OPOSICIONES } from '@/lib/config/oposiciones'
import { resolveUserOposicion } from '@/lib/oposicion/resolveUserOposicion'

const HAS_DB = !!process.env.DATABASE_URL
const d = HAS_DB ? describe : describe.skip

d('CANARY: perfiles con target_oposicion sin blob resuelven a oposición conocida', () => {
  let affected: { id: string; n: number }[] = []

  beforeAll(async () => {
    const { Client } = await import('pg')
    const url = (process.env.DATABASE_URL || '').replace(/[?&]sslmode=require/, '')
    const c = new Client({ connectionString: url, ssl: { rejectUnauthorized: false } })
    await c.connect()
    affected = (await c.query(`
      SELECT target_oposicion AS id, COUNT(*)::int AS n
      FROM user_profiles
      WHERE target_oposicion IS NOT NULL AND target_oposicion_data IS NULL
      GROUP BY target_oposicion ORDER BY n DESC`)).rows as { id: string; n: number }[]
    await c.end()
  }, 30000)

  it('el fix DA identidad real a todos los afectados con oposición de CATÁLOGO', () => {
    const known = affected.filter(r => ALL_OPOSICION_IDS.includes(r.id))
    for (const r of known) {
      const cfg = OPOSICIONES.find(o => o.id === r.id)!
      const identity = resolveUserOposicion(r.id, cfg.name, null)
      expect(identity).not.toBeNull()
      expect(identity!.name).toBe(cfg.name) // nombre real, no genérico → NO selector fantasma
    }
    // sanidad: la inmensa mayoría de afectados son de catálogo (el fix los cubre)
    const nKnown = known.reduce((s, r) => s + r.n, 0)
    const nTotal = affected.reduce((s, r) => s + r.n, 0)
    expect(nKnown).toBeGreaterThan(nTotal * 0.8)
  })

  it('REPORTE (no-bloqueante): perfiles con target corrupto/desconocido (fuera de este fix)', () => {
    const unknown = affected.filter(r => !ALL_OPOSICION_IDS.includes(r.id))
    const nUnknown = unknown.reduce((s, r) => s + r.n, 0)
    if (nUnknown > 0) {
      console.warn(`⚠️  ${nUnknown} perfil(es) con target_oposicion corrupto/desconocido (siguen viendo el selector, correcto):`,
        unknown.map(u => `${JSON.stringify(u.id)}×${u.n}`).join(', '))
    }
    // Documental: estos NO son regresión del fix; son dato a sanear aparte.
    expect(nUnknown).toBeLessThan(affected.reduce((s, r) => s + r.n, 0)) // no TODO es corrupto
  })
})
