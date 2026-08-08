// __tests__/security/canaryGateAssertionReal.test.ts
//
// T-280 — que el vigilante del gate anti-scraping VIGILE de verdad.
//
// El defecto que arregla: `canary-questions-gate` comprobaba que «el gate NO reta a un usuario
// normal» mandando en esa misma petición la cabecera de exención. Estaba exento cuando lo medía,
// así que la aserción pasaba SIEMPRE — incluso si el gate hubiera empezado a retar a todo el
// mundo, que es el fallo más caro (usuarios reales sin poder cargar preguntas). Una alarma que no
// puede sonar.
//
// Por qué no bastaba con quitar la exención, que era lo obvio: está MEDIDO que el usuario smoke
// acumula volumen de otras sondas —2.220 preguntas servidas el 27/07 y 380 el 29/07, contra un
// umbral de 500—, así que un día cargado habría dado rojo sin avería y el canary se habría ganado
// que lo ignoren. La salida es preguntar primero el veredicto del gate para el propio sujeto (sin
// servir preguntas ni gastar cuota) y decidir con eso.
//
// Estos tests leen el FUENTE (mismo patrón que `canaryGateAndOutboxPrune`): lo que se protege es
// que nadie devuelva la exención incondicional al camino de la sonda, no el runtime del canary.
import { readFileSync } from 'fs'
import { join } from 'path'

const ROOT = join(__dirname, '..', '..')
const CANARY = readFileSync(
  join(ROOT, 'backend/src/canary-questions-gate/canary-questions-gate.service.ts'),
  'utf-8',
)
const STATUS = readFileSync(join(ROOT, 'app/api/security/captcha/status/route.ts'), 'utf-8')

describe('canary del gate — la aserción que importa no puede estar exenta', () => {
  it('la exención es CONDICIONAL: solo cuando el sujeto está saturado', () => {
    // [T-381] La rama `sondaReal` dejó de ser `{}` — ahora manda la cabecera de MÉTRICAS
    // (`x-vence-canary-metrics-secret`, ver lib/api/syntheticTrust.ts) para no envenenar
    // `daily_questions_served` con esta sonda. Lo que importa para ESTE guardarraíl sigue
    // igual: esa rama NO puede llevar la cabecera que exime del RETO
    // (`x-vence-canary-secret`) — si la llevara, la sonda dejaría de ser real otra vez.
    const bloqueExencion = CANARY.match(/const exencion[^=]*=\s*sondaReal\s*\?\s*\{[\s\S]*?\}\s*:\s*\{[\s\S]*?\};/)?.[0] ?? ''
    expect(bloqueExencion).not.toBe('')
    const ramaSondaReal = bloqueExencion.match(/sondaReal\s*\?\s*(\{[\s\S]*?\})\s*:/)?.[1] ?? ''
    expect(ramaSondaReal).not.toMatch(/'x-vence-canary-secret':/)
    expect(CANARY).toMatch(/\.\.\.exencion,/)
  })

  it('NO existe ya una exención incondicional en la petición de preguntas', () => {
    // Se mira el bloque de headers del POST a /api/questions/filtered: ahí la cabecera con secreto
    // no puede aparecer literal, porque eso es exactamente el agujero que se cierra.
    const bloqueHeaders = CANARY.match(/questions\/filtered`, \{[\s\S]{0,600}?\},\n/)?.[0] ?? ''
    expect(bloqueHeaders).not.toMatch(/'x-vence-canary-secret':/)
    // El marcador sin secreto SÍ sigue (no exime de nada; evita ensuciar el log de errores).
    expect(bloqueHeaders).toMatch(/'x-vence-canary': '1'/)
  })

  it('la sonda real se decide con el veredicto del gate, no a ojo', () => {
    expect(CANARY).toMatch(/const sondaReal = sujetoSaturado === false/)
    expect(CANARY).toMatch(/captcha\/status\?subject=\$\{encodeURIComponent\(userId\)\}/)
  })

  it('el resultado dice SIEMPRE si la comprobación fue real o se omitió', () => {
    // Un verde que no distingue «comprobado» de «no pude comprobarlo» es el problema original con
    // otra cara: por eso el veredicto viaja en el resultado y en los tres caminos.
    expect(CANARY).toMatch(/gateAssertion: CanaryGateAssertion/)
    for (const estado of ['real', 'omitida_sujeto_saturado', 'omitida_veredicto_no_disponible']) {
      expect(CANARY).toContain(`'${estado}'`)
    }
    expect(CANARY).toMatch(/return \{ ok: true[^}]*gateAssertion/)
  })

  it('y el EVENTO verde también lo guarda, no solo la respuesta HTTP', () => {
    // La respuesta la lee el workflow que dispara el canary y se pierde; lo que queda para siempre
    // es la fila de `observable_events`. Si el veredicto no viaja ahí, un `canary_questions_gate_ok`
    // no distingue «comprobado» de «no pude comprobarlo» — el defecto de T-280 una capa más abajo.
    const CONTROLLER = readFileSync(
      join(ROOT, 'backend/src/canary-questions-gate/canary-questions-gate.controller.ts'),
      'utf-8',
    )
    const bloqueOk = CONTROLLER.match(/canary_questions_gate_ok[\s\S]{0,700}?\}\);/)?.[0] ?? ''
    expect(bloqueOk).toMatch(/gateAssertion: result\.gateAssertion/)
  })
})

describe('endpoint de estado — el veredicto se puede pedir sin servir preguntas', () => {
  it('evalúa el gate del sujeto pedido y no inventa el umbral', () => {
    expect(STATUS).toMatch(/evaluateLoadGate\(gateSubjects\(sujeto, null, null\)\)/)
    expect(STATUS).toMatch(/wouldChallenge: evaluacion\.challenge/)
  })

  it('sigue protegido por CRON_SECRET y solo responde el bloque si se pide sujeto', () => {
    expect(STATUS).toMatch(/auth !== `Bearer \$\{expected\}`/)
    expect(STATUS).toMatch(/\.\.\.\(gate \? \{ gate \} : \{\}\)/)
  })
})
