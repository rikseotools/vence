/**
 * @jest-environment node
 */
// El modo `--quitar` del repuntador de enlaces (T-186, 07/08/2026).
//
// Deja una landing SIN botón oficial (`programa_url = NULL`). Existe porque el caso real no era
// «apunta al documento equivocado» sino «no hay ningún documento al que apuntar»:
// `correos-personal-operativo` prometía «Ver OEP en BOE» y abría un 404 de Correos.
//
// Lo que se prueba aquí es la PUERTA, que es lo que puede romperse sin que nadie lo note: que no
// se pueda dejar una oposición activa sin enlace sin decir por qué. Se ejecuta el CLI de verdad
// (subproceso), no una reimplementación — y sin tocar la BD, porque la validación del motivo
// ocurre ANTES de conectar.
import { execFileSync } from 'child_process'
import { join } from 'path'

const SCRIPT = join(process.cwd(), 'scripts/convocatoria/repuntar-enlace-convocatoria.cjs')

/** Corre el CLI y devuelve {code, salida}. No lanza: el código de salida es el dato. */
function correr(args: string[]): { code: number; salida: string } {
  try {
    const out = execFileSync('node', [SCRIPT, ...args], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
      timeout: 20_000,
      env: { ...process.env, DATABASE_URL: '' }, // sin BD: si llegara a conectar, se vería
    })
    return { code: 0, salida: out }
  } catch (e: unknown) {
    const err = e as { status?: number; stdout?: string; stderr?: string }
    return { code: err.status ?? -1, salida: `${err.stdout ?? ''}${err.stderr ?? ''}` }
  }
}

describe('repuntar-enlace-convocatoria --quitar', () => {
  it('SIN motivo no se puede quitar el enlace de una landing', () => {
    const { code, salida } = correr(['--quitar', 'correos-personal-operativo'])
    expect(code).toBe(2)
    expect(salida).toMatch(/--motivo/)
  })

  it('un motivo de trámite tampoco vale: dentro de tres semanas no explica nada', () => {
    const { code, salida } = correr(['--quitar', 'correos-personal-operativo', '--motivo', 'roto'])
    expect(code).toBe(2)
    expect(salida).toMatch(/mínimo 20 caracteres|--motivo/)
  })

  it('sin slug tampoco arranca', () => {
    const { code } = correr(['--quitar', '--motivo', 'un motivo suficientemente largo para pasar'])
    expect(code).toBe(2)
  })

  it('el modo aparece en la ayuda (si no, no lo encuentra quien lo necesita)', () => {
    const { salida } = correr([])
    expect(salida).toMatch(/--quitar <slug> --motivo/)
  })

  it('con motivo válido pasa la puerta y llega a necesitar BD (no escribe nada aquí)', () => {
    const { code, salida } = correr([
      '--quitar',
      'correos-personal-operativo',
      '--motivo',
      'no existe documento publico al que apuntar: el enlace daba 404',
    ])
    // Sin DATABASE_URL el script se planta en `conectar()`, que es justo la señal de que la
    // validación del motivo quedó atrás: la puerta deja pasar lo que debe.
    expect(code).toBe(2)
    expect(salida).toMatch(/DATABASE_URL/)
  })
})
