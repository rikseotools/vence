/**
 * T-399 — el deploy tiene que saber, ANTES de registrar la task def, si el rol de ejecución
 * puede leer los secretos que le está pidiendo. Aquí se prueba el criterio, que es lo delicado:
 * equivocarse hacia el otro lado (marcar como no-permitido algo que sí lo está) abortaría deploys
 * buenos, y eso se aprende a saltar.
 */
import {
  cubre,
  arnsSinPermiso,
  secretosDeTaskDef,
} from '../../lib/deploy/secretosPermitidos.cjs'

const P = 'arn:aws:ssm:eu-west-2:349744179687:parameter/vence-backend/'

describe('cubre — comodines de IAM', () => {
  it('coincidencia exacta', () => {
    expect(cubre(`${P}DATABASE_URL`, `${P}DATABASE_URL`)).toBe(true)
    expect(cubre(`${P}DATABASE_URL`, `${P}DATABASE_URL_REPLICA`)).toBe(false)
  })

  it('`*` cubre el prefijo entero', () => {
    expect(cubre(`${P}*`, `${P}CUALQUIER_COSA`)).toBe(true)
    expect(cubre('arn:aws:ssm:eu-west-2:349744179687:parameter/vence-frontend/*', `${P}X`)).toBe(false)
  })

  it('`?` es exactamente un carácter', () => {
    expect(cubre(`${P}KEY_?`, `${P}KEY_1`)).toBe(true)
    expect(cubre(`${P}KEY_?`, `${P}KEY_12`)).toBe(false)
  })

  it('los puntos del ARN son literales, no comodín (si no, un recurso ajeno «cubriría» de más)', () => {
    expect(cubre('arn:aws:ssm:eu-west-2:1:parameter/a.b', 'arn:aws:ssm:eu-west-2:1:parameter/aXb')).toBe(false)
  })

  it('entradas vacías no cubren nada', () => {
    expect(cubre('', `${P}X`)).toBe(false)
    expect(cubre(`${P}*`, '')).toBe(false)
  })
})

describe('arnsSinPermiso — el caso real que dejó el deploy 6 h sin converger', () => {
  // La política enumeraba 22 ARNs; el deploy cableó un 23.º y nadie tocó el IAM.
  const politica = [`${P}DATABASE_URL`, `${P}CRON_SECRET`, `${P}RESEND_API_KEY`]

  it('detecta el secreto nuevo que nadie autorizó, y dice CUÁL', () => {
    const faltan = arnsSinPermiso(
      [`${P}DATABASE_URL`, `${P}DEVICE_LIMIT_MODE`, `${P}CRON_SECRET`],
      politica,
    )
    expect(faltan).toEqual([`${P}DEVICE_LIMIT_MODE`])
  })

  it('con todo permitido, no molesta (un guardarraíl que grita siempre se acaba apagando)', () => {
    expect(arnsSinPermiso([`${P}DATABASE_URL`, `${P}CRON_SECRET`], politica)).toEqual([])
  })

  it('un comodín del prefijo lo cubre todo — la opción 2 de la ficha no debe dar falsos positivos', () => {
    expect(arnsSinPermiso([`${P}LO_QUE_SEA`, `${P}OTRO`], [`${P}*`])).toEqual([])
  })

  it('no repite un ARN que aparece en varios contenedores', () => {
    const faltan = arnsSinPermiso([`${P}DEVICE_LIMIT_MODE`, `${P}DEVICE_LIMIT_MODE`], politica)
    expect(faltan).toHaveLength(1)
  })

  it('IGNORA los secretos que no son de SSM: se gobiernan con otra acción de IAM', () => {
    // Un `valueFrom` de Secrets Manager necesita `secretsmanager:GetSecretValue`; juzgarlo con
    // esta lista sería inventarse un veredicto sobre algo que no se ha mirado.
    const sm = 'arn:aws:secretsmanager:eu-west-2:349744179687:secret:loquesea-AbCdEf'
    expect(arnsSinPermiso([sm], politica)).toEqual([])
  })

  it('sin política (no se pudo leer el IAM) marca todo lo de SSM: quien llama decide si aborta o avisa', () => {
    expect(arnsSinPermiso([`${P}DATABASE_URL`], [])).toEqual([`${P}DATABASE_URL`])
  })

  it('tolera entradas basura sin reventar', () => {
    // @ts-expect-error — a propósito: el JSON viene de la CLI de AWS, no de nuestro código.
    expect(arnsSinPermiso(null, null)).toEqual([])
  })
})

describe('secretosDeTaskDef', () => {
  it('recoge los valueFrom de TODOS los contenedores', () => {
    const td = {
      containerDefinitions: [
        { secrets: [{ name: 'A', valueFrom: `${P}A` }] },
        { secrets: [{ name: 'B', valueFrom: `${P}B` }] },
        { name: 'sin secretos' },
      ],
    }
    expect(secretosDeTaskDef(td)).toEqual([`${P}A`, `${P}B`])
  })

  it('una task def sin contenedores no rompe', () => {
    expect(secretosDeTaskDef({})).toEqual([])
  })
})
