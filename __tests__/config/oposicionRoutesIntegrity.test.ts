/**
 * Guardarraíl de integridad de rutas por oposición.
 *
 * Contexto (07/07/2026): al crear una oposición nueva es fácil seguir a medias el
 * manual (`docs/maintenance/crear-nueva-oposicion.md` FASE 5) y dejar las rutas
 * incompletas — una copia botched del template. La MAYORÍA de rutas las sirve el
 * catch-all compartido `app/[oposicion]/` (landing, test, test/aleatorio,
 * test/test-personalizado, test/tema/[numero], simulacro, examen-oficial…), así que
 * NO hace falta crearlas por oposición.
 *
 * La EXCEPCIÓN es `temario/`: el catch-all NO lo cubre. Por tanto, toda oposición
 * que tenga carpeta de rutas propia debe llevar test/ y temario/ EMPAREJADOS, y su
 * temario/ debe estar completo. Este test falla si una oposición queda a medias.
 *
 * Fuente de verdad de completitud DB+config+FS: `npm run audit:oposicion <slug>`.
 * Este test es el guardarraíl de FS que corre en CI (sin BD).
 */
import fs from 'fs'
import path from 'path'
import { OPOSICIONES } from '@/lib/config/oposiciones'

const APP = path.join(process.cwd(), 'app')
const has = (p: string) => fs.existsSync(path.join(APP, p))
const hasPage = (dir: string) => has(`${dir}/page.tsx`) || has(`${dir}/page.js`)

describe('Integridad de rutas de oposiciones (anti copia-a-medias)', () => {
  it('el catch-all compartido app/[oposicion] sirve landing + test (base de TODAS)', () => {
    expect(has('[oposicion]/page.tsx')).toBe(true)
    expect(hasPage('[oposicion]/test')).toBe(true)
  })

  it('cada oposición con carpeta propia: test/ y temario/ EMPAREJADOS (o ambos o ninguno)', () => {
    // El temario NO lo cubre el catch-all → tener test/ propio sin temario/ propio
    // deja la oposición sin /temario (404). Emparejarlos evita la copia a medias.
    const rotos = OPOSICIONES
      .filter((o) => fs.existsSync(path.join(APP, o.slug)))
      .filter((o) => hasPage(`${o.slug}/test`) !== hasPage(`${o.slug}/temario`))
      .map((o) => o.slug)
    expect(rotos).toEqual([])
  })

  it('cada temario/ propio está COMPLETO (page + [slug]/page)', () => {
    // [T-611] Antes se exigía además un `TopicContentView.tsx` propio: era la fábrica de
    // copias hecha guardarraíl. Ahora el componente es UNO (`components/temario/`), así que
    // lo que se comprueba es que la ruta exista entera y MONTE el compartido.
    const incompletos = OPOSICIONES
      .filter((o) => has(`${o.slug}/temario`))
      .filter((o) => !(hasPage(`${o.slug}/temario`) && hasPage(`${o.slug}/temario/[slug]`)))
      .map((o) => o.slug)
    expect(incompletos).toEqual([])
  })

  it('la página del tema monta el componente compartido, no un árbol propio', () => {
    // Excepción declarada y con trinquete en
    // `__tests__/guardrails/testsDeOposicionPersonalizada.guardrail.test.ts`.
    const CON_DISENO_PROPIO = ['auxiliar-administrativo-estado']
    const sinCompartido = OPOSICIONES
      .filter((o) => hasPage(`${o.slug}/temario/[slug]`))
      .filter((o) => !CON_DISENO_PROPIO.includes(o.slug))
      .filter((o) => {
        const p = path.join(APP, o.slug, 'temario', '[slug]', 'page.tsx')
        return !fs.readFileSync(p, 'utf8').includes("@/components/temario/TopicContentView")
      })
      .map((o) => o.slug)
    expect(sinCompartido).toEqual([])
  })
})
