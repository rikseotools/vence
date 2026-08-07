// __tests__/scripts/auditOposicionPublishing.test.ts
//
// GUARDARRAÍL: los dos gates de completitud de oposiciones (`audit:oposicion` y `audit:served`)
// escriben en la MISMA tabla y el MISMO kind (`content_health_findings`, `oposicion_incompleta`)
// — son las dos caras de "esta oposición está incompleta": completitud de CREACIÓN (config, BD,
// rutas) y fidelidad de SERVIDO (lo que la fuente de producción entrega de verdad). [T-455]
//
// El riesgo que esto fija: un DELETE de "reemplaza, no acumula" que solo mirara kind+slug haría
// que la ÚLTIMA herramienta en correr sobre un slug borrase los hallazgos de la OTRA — dos
// escritores del mismo cubo con un solo borrador se pisan. El origen (`detail->>'origen'`)
// separa las dos series y cada una solo gestiona la suya.

import fs from 'fs'
import path from 'path'

const read = (p: string) => fs.readFileSync(path.join(process.cwd(), p), 'utf8')
const OPOSICION = read('scripts/audit-oposicion-completa.ts')
const SERVIDO = read('scripts/audit-served-questions.ts')

describe('audit:oposicion y audit:served publican en el mismo kind, con origen propio', () => {
  it('los dos escriben en content_health_findings con kind oposicion_incompleta', () => {
    for (const src of [OPOSICION, SERVIDO]) {
      expect(src).toMatch(/INSERT INTO content_health_findings/)
      expect(src).toMatch(/'oposicion_incompleta'/)
    }
  })

  it('los dos declaran un origen DISTINTO en detail', () => {
    expect(OPOSICION).toMatch(/origen:\s*'audit:oposicion'/)
    expect(SERVIDO).toMatch(/origen:\s*'audit:served'/)
  })

  it('los dos DELETE de reemplazo van acotados por detail->>\'origen\' (no se pisan entre sí)', () => {
    for (const src of [OPOSICION, SERVIDO]) {
      const m = src.match(/DELETE FROM content_health_findings WHERE[^`]*/)
      expect(m).not.toBeNull()
      expect(m![0]).toMatch(/kind = 'oposicion_incompleta'/)
      expect(m![0]).toMatch(/oposicion_slug/)
      expect(m![0]).toMatch(/detail->>'origen'/)
    }
  })

  it('los dos emiten observable_events con event_type oposicion_auditada', () => {
    for (const src of [OPOSICION, SERVIDO]) {
      expect(src).toMatch(/INSERT INTO observable_events/)
      expect(src).toMatch(/'oposicion_auditada'/)
    }
  })

  it('audit:served publica FAIL-OPEN: el catch de publicarHallazgos no toca fails/warns', () => {
    const fn = SERVIDO.slice(
      SERVIDO.indexOf('async function publicarHallazgos'),
      SERVIDO.indexOf('\n;(async () => {'),
    )
    const catchBlock = fn.slice(fn.indexOf('} catch'))
    expect(catchBlock).not.toMatch(/\bfails\+\+/)
    expect(catchBlock).not.toMatch(/\bwarns\+\+/)
    expect(catchBlock).not.toMatch(/process\.exit/)
  })

  it('audit:served publica también el caso "sin topics activos" (antes se perdía en el warns++ mudo)', () => {
    const sinTopics = SERVIDO.slice(
      SERVIDO.indexOf('if (!topics || !topics.length)'),
      SERVIDO.indexOf('const findings: string[] = []'),
    )
    expect(sinTopics).toMatch(/warns\+\+/)
    expect(sinTopics).toMatch(/publicarHallazgos/)
  })

  it('audit:served publica POR SLUG (dentro de auditOposicion), no una vez al final del run', () => {
    const auditFn = SERVIDO.slice(
      SERVIDO.indexOf('async function auditOposicion'),
      SERVIDO.indexOf('async function publicarHallazgos'),
    )
    expect(auditFn).toMatch(/await publicarHallazgos\(slug,/)
  })
})
