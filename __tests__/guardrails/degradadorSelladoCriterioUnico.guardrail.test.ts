import { readFileSync } from 'fs'
import { join } from 'path'

/**
 * El degradador de temas sellados sin pipeline (T-518) y el BADGE que los cuenta tienen que
 * juzgar el mismo hecho con el MISMO criterio. Si divergen, pasa lo peor de los dos mundos:
 * el badge dice «pendiente» de temas que el degradador ya no toca, o el degradador degrada
 * temas que el badge daba por buenos. Dos puertas al mismo recurso con criterios distintos no
 * protegen: se contradicen (misma lección que el registro de herramientas, T-130).
 *
 * La fuente única es `ESCRITORES_SIN_PIPELINE` en `lib/temario/revisionEpigrafe.cjs`.
 */
const RAIZ = join(__dirname, '..', '..')
const DEGRADADOR = join(RAIZ, 'scripts/temario/degradar-sellado-sin-pipeline.cjs')
const BADGE = join(RAIZ, 'lib/api/scope-verification/queries.ts')

describe('el degradador de sellados no puede inventarse su propio criterio (T-518)', () => {
  const fuente = readFileSync(DEGRADADOR, 'utf8')

  it('importa ESCRITORES_SIN_PIPELINE de la fuente única', () => {
    expect(fuente).toMatch(/ESCRITORES_SIN_PIPELINE/)
    expect(fuente).toMatch(/lib\/temario\/revisionEpigrafe\.cjs/)
  })

  it('NO escribe el nombre del escritor a mano en su SQL', () => {
    // `'claude_direct'` literal aquí sería una segunda definición del criterio: el día que se
    // añada otro escritor sin pipeline, el badge lo vería y el degradador no.
    const sql = fuente.slice(fuente.indexOf('const SELECT'), fuente.indexOf('})()'))
    expect(sql).not.toMatch(/'claude_direct'/)
  })

  it('el badge usa esa MISMA constante', () => {
    expect(readFileSync(BADGE, 'utf8')).toMatch(/ESCRITORES_SIN_PIPELINE/)
  })

  it('sigue siendo dry-run por defecto y con techo de seguridad', () => {
    // Un degradador masivo que escriba sin pedirlo, o sin tope, es un incidente esperando.
    expect(fuente).toMatch(/--apply/)
    expect(fuente).toMatch(/--max/)
    expect(fuente).toMatch(/ABORTO/)
  })

  it('no toca topic_scope: esto cambia el ESTADO de verificación, no el temario servido', () => {
    const sqlEscrituras = fuente.match(/UPDATE\s+(\w+)/g) || []
    expect(sqlEscrituras.every((m) => /topic_scope_verification/.test(m) || !/topic_scope\b/.test(m))).toBe(true)
    expect(fuente).not.toMatch(/DELETE\s+FROM/i)
  })
})
