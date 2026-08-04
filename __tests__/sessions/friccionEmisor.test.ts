/**
 * friccionEmisor.test.ts — el emisor ÚNICO de fricción (T-542).
 *
 * Fija los invariantes que hacen que un guardarraíl pueda llamarlo desde dentro de un hook de git
 * sin miedo: no lanza, no bloquea, y no deja pasar una clase que la serie no sabe agregar.
 *
 * El `spawn` se inyecta a propósito: se comprueba lo que el emisor HACE, no lo que su código dice.
 */
import path from 'path'
import { createRequire } from 'module'

const req = createRequire(__filename)
const ROOT = path.join(__dirname, '..', '..')
const { emitirFriccion, MAX_DETALLE } = req(path.join(ROOT, 'lib/sessions/friccion.cjs'))

/** Doble del `spawn` de node: registra la llamada y devuelve algo con `unref()`. */
function spawnEspia() {
  const llamadas: Array<{ bin: string; args: string[]; opts: any }> = []
  const spawn = (bin: string, args: string[], opts: any) => {
    llamadas.push({ bin, args, opts })
    return { unref: () => {} }
  }
  return { spawn, llamadas }
}

/** Lee el valor de un flag del argv que se le pasó a `friccion-emitir.cjs`. */
const flag = (args: string[], n: string) => args[args.indexOf(n) + 1]

describe('emitirFriccion — el emisor único', () => {
  it('lanza el emisor con la clase, el guard y el detalle', () => {
    const { spawn, llamadas } = spawnEspia()
    const ok = emitirFriccion(
      { clase: 'guard_escape', guard: 'temario', detalle: 'la queja no es de temario' },
      { spawn },
    )

    expect(ok).toBe(true)
    expect(llamadas).toHaveLength(1)
    const { args } = llamadas[0]
    expect(args[0]).toContain(path.join('scripts', 'friccion-emitir.cjs'))
    expect(flag(args, '--clase')).toBe('guard_escape')
    expect(flag(args, '--guard')).toBe('temario')
    expect(flag(args, '--detalle')).toBe('la queja no es de temario')
  })

  it('no bloquea al proceso padre: detached + stdio ignore', () => {
    const { spawn, llamadas } = spawnEspia()
    emitirFriccion({ clase: 'guard_bloqueo', guard: 'temario', detalle: 'x' }, { spawn })

    // Corre dentro de hooks de git: si esperase al INSERT, un bus lento retrasaría cada commit.
    expect(llamadas[0].opts).toMatchObject({ detached: true, stdio: 'ignore' })
  })

  it('DESCARTA una clase que no está en el catálogo cerrado, sin gastar un proceso', () => {
    const { spawn, llamadas } = spawnEspia()

    // Es el bug que esto arregla, un nivel más abajo: si la clase no existe, `friccion-emitir.cjs`
    // la tira en silencio y el guardarraíl se queda creyendo que cuenta.
    expect(emitirFriccion({ clase: 'guard_inventado', guard: 'temario' }, { spawn })).toBe(false)
    expect(emitirFriccion({ clase: '', guard: 'temario' }, { spawn })).toBe(false)
    expect(emitirFriccion(null as any, { spawn })).toBe(false)
    expect(llamadas).toHaveLength(0)
  })

  it('recorta el detalle en vez de pasar un argv gigante', () => {
    const { spawn, llamadas } = spawnEspia()
    emitirFriccion({ clase: 'guard_escape', guard: 'temario', detalle: 'x'.repeat(500) }, { spawn })

    expect(flag(llamadas[0].args, '--detalle')).toHaveLength(MAX_DETALLE)
  })

  it('NUNCA lanza aunque el spawn reviente — la telemetría no decide si alguien puede cerrar', () => {
    const spawnRoto = () => {
      throw new Error('EAGAIN: no se pueden crear más procesos')
    }

    // Principio 9 (fail-open en telemetría). Si esto lanzara, «no se pudo contar el roce» se
    // convertiría en «no se pudo cerrar la impugnación» — que es el fallo que ya cazaron los 15
    // tests de `resolveDispute` el 28/07 con la recompensa.
    expect(() => emitirFriccion({ clase: 'guard_escape', guard: 'temario' }, { spawn: spawnRoto })).not.toThrow()
    expect(emitirFriccion({ clase: 'guard_escape', guard: 'temario' }, { spawn: spawnRoto })).toBe(false)
  })

  it('omite los flags que no se le pasan (no manda --detalle vacío)', () => {
    const { spawn, llamadas } = spawnEspia()
    emitirFriccion({ clase: 'deploy_espera', segundos: 420 }, { spawn })

    const { args } = llamadas[0]
    expect(args).not.toContain('--detalle')
    expect(args).not.toContain('--guard')
    expect(flag(args, '--segundos')).toBe('420')
  })
})
