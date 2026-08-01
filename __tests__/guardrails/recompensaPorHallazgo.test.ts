// GUARDARRAÍL: «un fallo o hallazgo, una recompensa».
//
// ## De dónde sale (30/07/2026)
//
// Una usuaria premium mandó TRES impugnaciones de «pregunta repetida», las tres válidas y
// las tres del mismo artículo: había cuatro versiones de la misma pregunta sobre los
// capítulos del Título I de la Constitución. Es **un descubrimiento suyo, no tres**, y el
// sistema habría pagado 3 € por él, porque el euro se concede automáticamente en cuanto una
// impugnación pasa a `resolved`.
//
// La regla que se fija: la primera cobra; las hermanas se cierran **igual de válidas** —
// tenían razón, y rechazarlas le enseñaría a no volver a avisar, justo a quien nos está
// encontrando los duplicados— pero sin abono y con el motivo escrito.
import { readFileSync } from 'fs'
import { join } from 'path'

const leer = (rel: string) => readFileSync(join(process.cwd(), rel), 'utf8')

describe('un fallo o hallazgo, una recompensa', () => {
  it('la condición está PUBLICADA donde el usuario la puede leer', () => {
    // No vale aplicarla en silencio: si no está escrita, es arbitrariedad.
    const pagina = leer('app/recompensas/page.tsx')
    expect(pagina).toContain('Un fallo o hallazgo, una recompensa')
    // Y dice lo que SÍ cuenta, para que nadie deje de reportar por miedo a que no le valga.
    expect(pagina).toMatch(/fallos distintos, cada uno cuenta/)
  })

  it('el cierre acepta saltarse la recompensa, pero EXIGIENDO motivo', () => {
    const schema = leer('lib/api/v2/dispute/schemas.ts')
    expect(schema).toContain('skipRewardReason')
    // Un booleano se teclea sin pensar; escribir el porqué obliga a pensarlo y deja rastro.
    expect(schema).toMatch(/skipRewardReason:\s*z\.string\(\)\.min\(10/)
  })

  // El ancla es una REGEX y no un literal a propósito (01/08/2026, T-394): la condición admite
  // guardas adicionales delante — la primera fue `!correccion &&`, para que corregir una respuesta
  // ya enviada no vuelva a evaluar la recompensa. Anclar al texto exacto hacía fallar el
  // guardarraíl por un cambio que NO tocaba lo que vigila, y un guardarraíl que salta por reformateo
  // acaba desactivado por costumbre. Lo que se exige sigue siendo lo mismo: `status === 'resolved'`
  // y `userId`.
  const ANCLA_RAMA_RESUELTA = /if \([^)]*status === 'resolved' && userId\)/

  it('con motivo NO se concede el euro; sin motivo se concede como siempre', () => {
    const q = leer('lib/api/v2/dispute/queries.ts')
    const m = q.match(ANCLA_RAMA_RESUELTA)
    expect(m).not.toBeNull()
    const bloque = q.slice(q.indexOf(m![0]), q.indexOf('3.4 Invalidar cache'))
    expect(bloque).toMatch(/if \(skipRewardReason\)/)
    expect(bloque).toMatch(/else \{[\s\S]*maybeRewardResolvedDispute/)
  })

  it('CORREGIR una respuesta ya enviada no vuelve a pagar el euro', () => {
    // Pagar dos veces por el mismo hallazgo es justo lo que la idempotencia protege: la
    // corrección reescribe lo que se dijo, no descubre nada nuevo. La guarda va en la MISMA
    // condición que abre la rama de recompensa, no en un `if` aparte que alguien pueda mover.
    const q = leer('lib/api/v2/dispute/queries.ts')
    const m = q.match(ANCLA_RAMA_RESUELTA)
    expect(m).not.toBeNull()
    expect(m![0]).toMatch(/!correccion/)
  })

  it('queda rastro de POR QUÉ no se pagó (auditable dentro de tres meses)', () => {
    const q = leer('lib/api/v2/dispute/queries.ts')
    expect(q).toContain('dispute_reward_skipped')
    expect(q).toMatch(/motivo: skipRewardReason/)
  })

  it('la hermana se cierra como RESUELTA, no como rechazada', () => {
    // El salto de recompensa vive DENTRO de la rama `resolved`: si alguien lo moviera para
    // rechazarlas, estaría diciéndole a quien acertó que se equivocaba.
    const q = leer('lib/api/v2/dispute/queries.ts')
    const i = q.indexOf('skipRewardReason')
    const j = q.search(ANCLA_RAMA_RESUELTA)
    expect(i).toBeGreaterThan(0)
    expect(j).toBeGreaterThan(0)
  })
})
