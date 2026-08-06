/**
 * @jest-environment node
 */
// CERRAR EL CASO RETIRA SU BORRADOR DEL EMBUDO (T-486, 06/08)
//
// El embudo es lo PRIMERO que sale en `npm run flota`, porque su coste corre mientras nadie lo
// lee. Pero cerrar la impugnación no retiraba su borrador: medido el 06/08, **15 borradores
// abiertos** cuyos 15 casos estaban ya `resolved`/`rejected` — resueltos y ENVIADOS por otras
// sesiones. O sea que el panel llevaba días pidiendo aprobar cosas ya enviadas.
//
// Una señal que no se apaga sola acaba mintiendo, y una lista que miente se deja de mirar —
// que es peor que no tenerla.
//
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { retirarBorradoresDe } = require('@/lib/sessions/retirarBorrador.cjs')

/** `postgres` (porsager) se usa como etiqueta de plantilla: se finge para no necesitar BD. */
function sqlFalso(devuelve: any[] = [], espia: any = {}) {
  return (trozos: TemplateStringsArray, ...valores: any[]) => {
    espia.sql = trozos.join('?')
    espia.valores = valores
    if (espia.explota) throw new Error('la BD se cayó')
    return Promise.resolve(devuelve)
  }
}

describe('retira solo lo que corresponde', () => {
  it('devuelve cuántos retiró', async () => {
    const n = await retirarBorradoresDe(sqlFalso([{ id: 1 }, { id: 2 }]), 'abc-123', 'impugnación resolved')
    expect(n).toBe(2)
  })

  it('cero no es un fallo: no todo caso tuvo borrador', async () => {
    expect(await retirarBorradoresDe(sqlFalso([]), 'abc-123', 'x')).toBe(0)
  })

  it('busca por el uuid ENTERO y por la forma corta de 8 — las dos existen en filas reales', async () => {
    const espia: any = {}
    await retirarBorradoresDe(sqlFalso([], espia), 'dba485dc-fe10-47ab-822c-d0a01def9e90', 'm')
    expect(espia.valores).toContain('%dba485dc-fe10-47ab-822c-d0a01def9e90%')
    expect(espia.valores).toContain('%dba485dc%')
  })

  it('solo toca borradores ABIERTOS: no reescribe la historia de los ya cerrados', async () => {
    const espia: any = {}
    await retirarBorradoresDe(sqlFalso([], espia), 'abc-123', 'm')
    expect(espia.sql).toMatch(/kind = 'borrador'/)
    expect(espia.sql).toMatch(/status = 'open'/)
  })

  it('deja escrito POR QUÉ: quien lo lea después distingue «se envió» de «se descartó»', async () => {
    const espia: any = {}
    await retirarBorradoresDe(sqlFalso([], espia), 'abc-123', 'impugnación rejected')
    expect(espia.valores.some((v: any) => String(v).includes('impugnación rejected'))).toBe(true)
  })
})

describe('FALLA ABIERTO: el cierre ya está hecho y no se puede tumbar', () => {
  it('si la BD revienta, devuelve 0 en vez de propagar', async () => {
    const espia: any = { explota: true }
    await expect(retirarBorradoresDe(sqlFalso([], espia), 'abc', 'm')).resolves.toBe(0)
  })

  it('sin cliente o sin caso, no hace nada', async () => {
    expect(await retirarBorradoresDe(null, 'abc', 'm')).toBe(0)
    expect(await retirarBorradoresDe(sqlFalso([]), '', 'm')).toBe(0)
  })
})

describe('los DOS cierres lo usan — importado, no copiado', () => {
  const fs = require('fs'); const path = require('path')
  it.each([
    ['scripts/impugnaciones/cerrar.ts'],
    ['scripts/impugnaciones/cerrar-feedback.ts'],
  ])('%s retira el borrador al cerrar', (rel: string) => {
    const src = fs.readFileSync(path.join(process.cwd(), rel), 'utf8')
    expect(src).toMatch(/retirarBorrador\.cjs/)
    expect(src).toMatch(/retirarBorradorDelEmbudo\(/)
    // Copiar el UPDATE en cada script es como nacieron los cinco escritores de `seguimiento_url`.
    expect(src).not.toMatch(/UPDATE\s+public\.session_questions/)
  })
})
