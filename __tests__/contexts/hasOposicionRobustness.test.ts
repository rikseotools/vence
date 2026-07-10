// __tests__/contexts/hasOposicionRobustness.test.ts
// GUARDARRAÍL + SIMULACIÓN del fix "guard fantasma" (428 perfiles con
// target_oposicion puesto pero target_oposicion_data NULL).
import { readFileSync } from 'fs'
import { join } from 'path'
import { decideOposicionLoad } from '@/lib/oposicion/decideLoad'
import { resolveUserOposicion } from '@/lib/oposicion/resolveUserOposicion'
import { OPOSICIONES, ALL_OPOSICION_IDS } from '@/lib/config/oposiciones'

describe('guardarraíl: hasOposicion deriva de oposicionId, no del blob', () => {
  const src = readFileSync(join(process.cwd(), 'contexts/OposicionContext.tsx'), 'utf-8')

  it('OposicionContext usa hasOposicion: !!oposicionId', () => {
    expect(src).toMatch(/hasOposicion:\s*!!oposicionId/)
  })

  it('OposicionContext NO vuelve a derivar hasOposicion del blob (!!userOposicion)', () => {
    expect(src).not.toMatch(/hasOposicion:\s*!!userOposicion/)
  })
})

describe('simulación: perfil como los 428 (target set, data NULL) resuelve bien', () => {
  // Oposiciones reales de las que hay usuarios afectados (jinayda/flor + genérica)
  const CASES = ['auxiliar_administrativo_madrid', 'auxiliar_administrativo_valencia']

  for (const opoId of CASES) {
    it(`${opoId}: opoId válido + blob NULL → hay oposición + nombre real del config`, () => {
      // 1) el load lo considera válido (no 'clear' ni 'invalid')
      const isValid = ALL_OPOSICION_IDS.includes(opoId)
      expect(decideOposicionLoad(true, opoId, isValid)).toBe('set')

      // 2) la identidad no es null pese al blob NULL, y trae el nombre del config
      const cfg = OPOSICIONES.find(o => o.id === opoId)!
      const identity = resolveUserOposicion(opoId, cfg.name, /* blob */ null)
      expect(identity).not.toBeNull()
      expect(identity!.name).toBe(cfg.name)
      expect(identity!.name).not.toBe('Tu oposición') // nombre real, no genérico

      // 3) hasOposicion (= !!oposicionId) sería true
      expect(!!opoId).toBe(true)
    })
  }

  it('sin target → sigue mostrando el selector (no romper el caso legítimo)', () => {
    expect(decideOposicionLoad(true, null, false)).toBe('clear')
    expect(resolveUserOposicion(null, null, null)).toBeNull()
  })
})
