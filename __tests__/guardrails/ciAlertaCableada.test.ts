/**
 * @jest-environment node
 */
// ¿El evento que EMITE el CI lo ESCUCHA alguna regla de alerta? — guardarraíl anti-silo.
//
// ## El silencio que lo motiva (28/07/2026)
//
// El job «Notify failure to observable_events» de `.github/workflows/test.yml` emite
// `eventType: "workflow_failed"`. La regla `RULE_WORKFLOW_FAILURE_BURST` preguntaba por
// `event_type = 'workflow_failure'`. Un nombre de diferencia, y las dos mitades funcionando
// perfectamente por separado: el CI escribía y el motor de alertas leía… otra cosa.
//
// Medido en producción antes de arreglarlo: **328 eventos `workflow_failed`** (el último, de ese
// mismo día) frente a **3 `workflow_failure`**, el último del 1 de julio. Cuatro semanas de fallos
// de CI apilándose sin que nadie recibiera un aviso — y el día que hizo falta (tres veces `main` en
// rojo bloqueando a todas las sesiones), el aviso tampoco salió.
//
// Ningún test podía cazarlo porque cada lado tenía los suyos y ninguno cruzaba la frontera. Este sí:
// lee el workflow REAL y el fichero de reglas REAL, y exige que el nombre coincida. Es barato y no
// se puede satisfacer con un mock.
import fs from 'fs'
import path from 'path'

const RAIZ = path.join(__dirname, '..', '..')
const WORKFLOW = path.join(RAIZ, '.github', 'workflows', 'test.yml')
const REGLAS = path.join(RAIZ, 'backend', 'src', 'alerts', 'alert-rules.ts')

describe('el evento que emite el CI lo escucha una regla de alerta', () => {
  const yml = fs.readFileSync(WORKFLOW, 'utf8')
  const reglas = fs.readFileSync(REGLAS, 'utf8')

  // `eventType:"workflow_failed"` dentro del payload jq del job de notificación.
  const emitidos = [...yml.matchAll(/eventType\s*:\s*"([a-z_]+)"/g)].map((m) => m[1])

  it('el workflow declara al menos un eventType (si no, el aviso no existe)', () => {
    expect(emitidos.length).toBeGreaterThan(0)
  })

  it.each(emitidos)('«%s» aparece en alert-rules.ts', (evento) => {
    expect(reglas).toContain(`'${evento}'`)
  })

  it('el aviso de CI rojo mira la rama, no solo el fallo', () => {
    // Un CI rojo en una rama de PR es normal; en `main` bloquea a todo el mundo. La regla que
    // avisa al primer fallo tiene que distinguirlos o se convierte en ruido.
    expect(reglas).toContain("metadata->>'ref' = 'refs/heads/main'")
  })

  it('`main` NO cancela sus propios runs: sin veredicto no hay evento que alertar', () => {
    // El otro cabo del mismo problema. Con `cancel-in-progress: true` en main, el 57% de los runs
    // moría cancelado y el job de aviso (`if: failure() && !cancelled()`) no llegaba a correr.
    const concurrency = yml.slice(yml.indexOf('concurrency:'), yml.indexOf('jobs:'))
    expect(concurrency).toMatch(/cancel-in-progress:\s*\$\{\{\s*github\.event_name\s*==\s*'pull_request'\s*\}\}/)
  })
})
