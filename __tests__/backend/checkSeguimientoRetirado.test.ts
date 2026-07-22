// Retirada del sensor `hash_change` (cron check-seguimiento), 20/07.
// Peor sensor del radar: 32 aciertos de 835 señales (4%). Su emisión de señales ya estaba
// desconectada desde el 26/06 y nada aguas abajo consume su resultado.
//
// Estos tests fijan las dos cosas que se pueden romper sin darse cuenta al retirar un cron:
//   1. que siga apagado por defecto (no basta con quitar el @Cron: alguien lo revive sin querer),
//   2. que su heartbeat NO se registre mientras está retirado — si se registra, el panel de
//      salud se pone ROJO a los 4 días por un job que apagamos a propósito.
import fs from 'fs'
import path from 'path'

const SRC = path.join(
  process.cwd(),
  'backend/src/check-seguimiento/check-seguimiento.cron.ts',
)
const src = fs.readFileSync(SRC, 'utf8')

describe('cron check-seguimiento — retirado y reversible', () => {
  it('está apagado salvo que CHECK_SEGUIMIENTO_ENABLED sea exactamente "true"', () => {
    expect(src).toMatch(/CHECK_SEGUIMIENTO_ENABLED === 'true'/)
  })

  it('el handler sale antes de trabajar si está retirado', () => {
    // Sin esto el @Cron seguiría disparando el job completo.
    expect(src).toMatch(/if \(!CheckSeguimientoCron\.isEnabled\(\)\) return/)
  })

  it('el heartbeat solo se registra si el cron está activo', () => {
    // El fallo silencioso que evita: heartbeat vivo + cron apagado = salud en rojo permanente.
    const ctor = src.slice(src.indexOf('constructor('), src.indexOf('@Cron'))
    expect(ctor).toMatch(/if \(CheckSeguimientoCron\.isEnabled\(\)\)/)
    const registro = ctor.indexOf("heartbeatRegistry.register")
    const guarda = ctor.indexOf('if (CheckSeguimientoCron.isEnabled())')
    expect(guarda).toBeGreaterThanOrEqual(0)
    expect(registro).toBeGreaterThan(guarda)
  })

  it('documenta POR QUÉ se retira y CÓMO revivirlo (no se borra el contexto)', () => {
    expect(src).toMatch(/RETIRADO/)
    expect(src).toMatch(/hash_change/)
    expect(src).toMatch(/CHECK_SEGUIMIENTO_ENABLED=true/)
  })

  it('NO se borra el servicio ni el histórico: la retirada es reversible', () => {
    // La tabla convocatoria_seguimiento_checks y el panel histórico se conservan.
    expect(fs.existsSync(path.join(process.cwd(), 'backend/src/check-seguimiento/check-seguimiento.service.ts'))).toBe(true)
    expect(fs.existsSync(path.join(process.cwd(), 'app/admin/seguimiento-convocatorias/page.tsx'))).toBe(true)
  })
})

// Regresión del incidente 22/07: `cron_overdue` enumera el SchedulerRegistry (no el heartbeat),
// así que un cron retirado seguía marcándose overdue → CRITICAL diario 60 días. El fix des-registra
// el @Cron en onApplicationBootstrap cuando está apagado. (El test de COMPORTAMIENTO real corre en
// el suite del backend con ts-jest —soporta decoradores NestJS—:
// backend/src/check-seguimiento/check-seguimiento.cron.spec.ts. Aquí, en el jest del frontend, solo
// se asertan a nivel de fuente los invariantes, como el resto de este fichero.)
describe('cron check-seguimiento — des-registro del SchedulerRegistry (silencia cron_overdue)', () => {
  it('implementa OnApplicationBootstrap y borra el job cuando está retirado', () => {
    expect(src).toMatch(/implements OnApplicationBootstrap/)
    expect(src).toMatch(/onApplicationBootstrap\(\)/)
    expect(src).toMatch(/deleteCronJob\('check-seguimiento'\)/)
  })

  it('el des-registro está guardado por isEnabled (solo si está retirado)', () => {
    const hook = src.slice(src.indexOf('onApplicationBootstrap()'))
    const guarda = hook.indexOf('if (CheckSeguimientoCron.isEnabled()) return')
    const borrado = hook.indexOf("deleteCronJob('check-seguimiento')")
    expect(guarda).toBeGreaterThanOrEqual(0)
    expect(borrado).toBeGreaterThan(guarda)
  })

  it('el borrado es best-effort (try/catch, idempotente si el job ya no está)', () => {
    const hook = src.slice(src.indexOf('onApplicationBootstrap()'))
    expect(hook).toMatch(/try \{/)
    expect(hook).toMatch(/\} catch/)
  })
})
