/**
 * T-448 — el criterio del aviso «se te acaba la suscripción» y del mes de gracia.
 *
 * Lo que se protege aquí es una PROMESA: el email dice «tienes un mes», y el barrido que anula
 * las ofertas usa esta misma función. Si las dos se separaran, el texto diría una cosa y el
 * sistema haría otra, y nadie se enteraría hasta que un usuario reclamara su precio y no lo
 * encontrara.
 */
import {
  fechaLimiteRetorno,
  debeAvisarFinSuscripcion,
  debeAnularOferta,
  diasParaVolver,
} from '../../lib/api/premium/finSuscripcion'

const d = (iso: string) => new Date(iso)

describe('fechaLimiteRetorno — un mes NATURAL, no 30 días', () => {
  it('mismo día del mes siguiente', () => {
    expect(fechaLimiteRetorno(d('2026-08-15T10:00:00Z')).toISOString()).toBe('2026-09-15T10:00:00.000Z')
  })

  it('un mes de 31 días cuenta como mes, no como 30 noches', () => {
    // Del 1 de julio al 1 de agosto son 31 días: si fuese `+30 días` caería el 31 de julio y le
    // estaríamos quitando un día al plazo que le prometimos.
    expect(fechaLimiteRetorno(d('2026-07-01T00:00:00Z')).toISOString()).toBe('2026-08-01T00:00:00.000Z')
  })

  it('31 de enero → 28/29 de febrero, NO el 3 de marzo', () => {
    // `setMonth(+1)` a pelo desborda y regala tres días. 2026 no es bisiesto.
    expect(fechaLimiteRetorno(d('2026-01-31T09:00:00Z')).toISOString()).toBe('2026-02-28T09:00:00.000Z')
  })

  it('cruza el fin de año sin perderse', () => {
    expect(fechaLimiteRetorno(d('2026-12-20T08:00:00Z')).toISOString()).toBe('2027-01-20T08:00:00.000Z')
  })

  it('una fecha ilegible revienta en vez de inventarse un plazo', () => {
    expect(() => fechaLimiteRetorno('no soy una fecha')).toThrow()
  })
})

describe('debeAvisarFinSuscripcion — a quién y cuándo', () => {
  const base = { enCuentaAntigua: true, seApaga: true, finPeriodo: d('2026-08-04T09:00:00Z') }
  const ahora = d('2026-08-01T09:00:00Z') // exactamente 3 días antes

  it('cuenta antigua + se apaga + vence en 3 días → se avisa', () => {
    expect(debeAvisarFinSuscripcion(base, ahora)).toBe(true)
  })

  it('NO se avisa a quien ya está en la cuenta vigente: no hay precio que mantenerle', () => {
    expect(debeAvisarFinSuscripcion({ ...base, enCuentaAntigua: false }, ahora)).toBe(false)
  })

  it('NO se avisa a quien SÍ va a renovar: ese recibe el recordatorio de cobro, y decirle las dos cosas sería contradecirse', () => {
    expect(debeAvisarFinSuscripcion({ ...base, seApaga: false }, ahora)).toBe(false)
  })

  it('no se avisa con 10 días ni con 1 día de antelación (la ventana es la ventana)', () => {
    expect(debeAvisarFinSuscripcion({ ...base, finPeriodo: d('2026-08-11T09:00:00Z') }, ahora)).toBe(false)
    expect(debeAvisarFinSuscripcion({ ...base, finPeriodo: d('2026-08-02T09:00:00Z') }, ahora)).toBe(false)
  })

  it('el margen de 12 h absorbe que el cron corre a hora fija y los periodos vencen a cualquier hora', () => {
    expect(debeAvisarFinSuscripcion({ ...base, finPeriodo: d('2026-08-04T20:00:00Z') }, ahora)).toBe(true)
    expect(debeAvisarFinSuscripcion({ ...base, finPeriodo: d('2026-08-05T09:00:01Z') }, ahora)).toBe(false)
  })

  it('sin fecha de fin no se inventa un aviso', () => {
    expect(debeAvisarFinSuscripcion({ ...base, finPeriodo: null }, ahora)).toBe(false)
    expect(debeAvisarFinSuscripcion({ ...base, finPeriodo: 'basura' }, ahora)).toBe(false)
  })
})

describe('debeAnularOferta — respeta el mes que se prometió', () => {
  const fin = d('2026-08-04T09:00:00Z')

  it('NO se anula el último día: quien llega justo a tiempo debe encontrar su precio', () => {
    expect(debeAnularOferta(fin, d('2026-09-04T08:59:00Z'))).toBe(false)
  })

  it('se anula pasado el mes', () => {
    expect(debeAnularOferta(fin, d('2026-09-04T09:00:01Z'))).toBe(true)
  })

  it('mientras aún tiene acceso, ni de lejos', () => {
    expect(debeAnularOferta(fin, d('2026-08-01T09:00:00Z'))).toBe(false)
  })

  it('sin fecha no se anula nada (ante la duda, NO se le quita el precio)', () => {
    expect(debeAnularOferta(null)).toBe(false)
    expect(debeAnularOferta('basura')).toBe(false)
  })

  it('el barrido y el email usan la MISMA frontera — si divergen, mentimos', () => {
    const limite = fechaLimiteRetorno(fin)
    expect(debeAnularOferta(fin, new Date(limite.getTime() - 1))).toBe(false)
    expect(debeAnularOferta(fin, new Date(limite.getTime() + 1))).toBe(true)
  })
})

describe('diasParaVolver — lo que se le dice en el texto', () => {
  it('un mes por delante', () => {
    expect(diasParaVolver(d('2026-08-04T09:00:00Z'), d('2026-08-04T09:00:00Z'))).toBe(31)
  })
  it('nunca negativo: si se pasó, es 0', () => {
    expect(diasParaVolver(d('2026-08-04T09:00:00Z'), d('2026-10-01T09:00:00Z'))).toBe(0)
  })
})
