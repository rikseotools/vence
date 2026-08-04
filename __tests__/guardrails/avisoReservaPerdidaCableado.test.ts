// __tests__/guardrails/avisoReservaPerdidaCableado.test.ts — [T-516]
//
// El aviso de «lo que tenías ya no es tuyo» solo sirve si CORRE. Y su modo de fallo es el peor
// posible: si alguien desengancha el hook, o cambia el nombre del script, o el hook deja de
// llamarlo, no se rompe nada — simplemente **deja de avisar**, en silencio, y volvemos a que dos
// sesiones le hablen a Manuel del mismo caso sin saberlo.
//
// Mismo patrón que `ciAlertaCableada` / `canariesPostDeployDisparados`: no se juzga la lógica
// (para eso están sus tests), se comprueba que la pieza sigue enchufada donde dice estarlo.
import * as fs from 'fs'
import * as path from 'path'

const ROOT = path.resolve(__dirname, '../..')
const leer = (p: string) => fs.readFileSync(path.join(ROOT, p), 'utf8')

describe('GUARDARRAÍL: el aviso de reserva perdida sigue enchufado', () => {
  it('el hook UserPromptSubmit está declarado en .claude/settings.json', () => {
    const cfg = JSON.parse(leer('.claude/settings.json'))
    const hooks = cfg?.hooks?.UserPromptSubmit ?? []
    const comandos = hooks.flatMap((h: { hooks?: Array<{ command?: string }> }) =>
      (h.hooks ?? []).map((x) => x.command ?? ''),
    )
    expect(comandos.some((c: string) => c.includes('recordatorio-hook.cjs'))).toBe(true)
  })

  it('ese hook INVOCA al consultor de reservas (no solo al recordatorio de método)', () => {
    const src = leer('scripts/sessions/recordatorio-hook.cjs')
    expect(src).toMatch(/reserva-perdida/)
  })

  it('el aviso va en CADA turno, no atado al contador de N mensajes', () => {
    // Si cayera dentro del `if (n % CADA !== 0) return`, el aviso llegaría hasta 15 turnos tarde:
    // para entonces la sesión ya le habría escrito al usuario un caso que lleva otra.
    const src = leer('scripts/sessions/recordatorio-hook.cjs')
    const posAviso = src.indexOf('reserva-perdida')
    const posCorte = src.indexOf('n % CADA !== 0')
    expect(posAviso).toBeGreaterThan(-1)
    expect(posCorte).toBeGreaterThan(-1)
    expect(posAviso).toBeLessThan(posCorte)
  })

  it('el consultor existe y es fail-open (nunca puede bloquear el prompt)', () => {
    const src = leer('scripts/sessions/reserva-perdida.cjs')
    expect(src).toMatch(/fail-open/i)
    // Un timeout duro: sin él, una BD lenta cuelga el prompt de todas las sesiones.
    expect(src).toMatch(/TIMEOUT_MS/)
    expect(src).toMatch(/THROTTLE_MS/)
  })

  it('el criterio vive en el núcleo puro, no copiado dentro del script', () => {
    // Dos copias de «¿esto sigue siendo mío?» acabarían diciendo cosas distintas, que es
    // exactamente como nació el problema de identidad que esta ficha arregla.
    const src = leer('scripts/sessions/reserva-perdida.cjs')
    expect(src).toMatch(/reservaPerdida\.cjs/)
    expect(fs.existsSync(path.join(ROOT, 'lib/sessions/reservaPerdida.cjs'))).toBe(true)
  })

  it('el consultor resuelve la identidad con el módulo compartido (T-407), no a su manera', () => {
    const src = leer('scripts/sessions/reserva-perdida.cjs')
    expect(src).toMatch(/sessions[/'\\]+sid\.cjs|resolverSid/)
    expect(src).not.toMatch(/process\.env\.CLAUDE_CODE_SESSION_ID/)
  })

  it('la cola del backlog filtra los estados cerrados (o avisa de trabajo terminado)', () => {
    const src = leer('scripts/sessions/reserva-perdida.cjs')
    expect(src).toMatch(/status NOT IN \('done','dropped'\)/)
  })

  it('cubre las DOS colas: tareas del backlog y casos de la cola de atención', () => {
    const src = leer('scripts/sessions/reserva-perdida.cjs')
    for (const tabla of ['backlog_tasks', 'user_feedback', 'question_disputes', 'psychometric_question_disputes']) {
      expect(src).toContain(tabla)
    }
  })
})
