import { readFileSync } from 'fs'
import { join } from 'path'

// GUARDRAIL anti-regresión (incidente 20/06): "inscripción abierta" se deriva de FECHAS
// (isInscripcionAbierta / isOpenForDisplay), NUNCA de estado_proceso. Antes home/SEO/card
// filtraban por estado_proceso='inscripcion_abierta' (que el tiempo desincroniza) y se
// contradecían con el banner. Este test falla si alguien reintroduce ese patrón en una
// superficie de USUARIO o deja de usar el predicado compartido. Es la red que evita que
// el fix se revierta en silencio.

const ROOT = join(__dirname, '..', '..')
const read = (p: string) => readFileSync(join(ROOT, p), 'utf8')

// Superficies de usuario que muestran "inscripción abierta" + el predicado que deben usar.
const SURFACES = [
  'app/page.tsx',
  'app/oposiciones/page.tsx',
  'app/oposiciones/[filtro]/page.tsx',
  'app/oposiciones/components/OposicionCard.tsx',
]

// Patrón prohibido: decidir "abierta" comparando estado_proceso === 'inscripcion_abierta'.
// (camelCase estadoProceso o snake estado_proceso). El cron audit-estados SÍ lo compara a
// propósito, por eso NO está en la lista de superficies.
const FORBIDDEN = /(estado_proceso|estadoProceso)\s*===\s*['"]inscripcion_abierta['"]/

describe('GUARDRAIL: "inscripción abierta" deriva de fechas, no de estado_proceso', () => {
  for (const file of SURFACES) {
    it(`${file} usa el predicado compartido de fechas`, () => {
      const src = read(file)
      expect(src).toMatch(/from ['"]@\/lib\/oposiciones\/inscripcion['"]/)
      expect(/isInscripcionAbierta|isOpenForDisplay|isShowableCatalogada/.test(src)).toBe(true)
    })

    it(`${file} NO filtra "abierta" por estado_proceso (anti-regresión)`, () => {
      expect(FORBIDDEN.test(read(file))).toBe(false)
    })
  }

  it('el banner filtra por fechas (inscription_start/deadline en SQL)', () => {
    const src = read('app/api/v2/banner/open-inscriptions/route.ts')
    expect(src).toMatch(/inscription_start/)
    expect(src).toMatch(/inscription_deadline/)
    expect(FORBIDDEN.test(src)).toBe(false)
  })

  it('catalogadas (sin test) enlazan a la convocatoria oficial, no a una landing interna', () => {
    const src = read('app/oposiciones/[filtro]/page.tsx')
    // la sección de catalogadas usa seguimiento_url como href externo
    expect(src).toMatch(/seguimiento_url/)
    expect(src).toMatch(/target="_blank"/)
  })
})
