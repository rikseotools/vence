/**
 * [T-682] Un `tsc --noEmit` de este repo pide más de 1 GB (y el guard le PERMITE hasta 6). Cuatro
 * turnos de la flota coinciden en ese peaje por construcción —todos pasan por el `pre-push`— y el
 * 07/08 eso dejó el VPS con **memoria al 98,7 % de presión y CPU al 0 %**: nadie calculaba, todos
 * esperaban memoria. Medido con `ps`: 1,3 + 1,2 + 0,7 + 0,6 = 3,8 GB solo en typechecks, sobre 7,7.
 *
 * Este módulo serializa. Lo que se prueba aquí es el CRITERIO; que de verdad serialice lo prueba
 * `npm run sim:candado-typecheck`, que lanza dos a la vez y mira si se solapan.
 */
const {
  conCandado, interpretarSalida, RUTA_CANDADO, SALIDA_SIN_CANDADO,
} = require('@/lib/hooks/candadoTypecheck.cjs')

describe('[T-682] conCandado — envuelve el comando sin cambiar lo que hace', () => {
  it('serializa con flock sobre un candado de MÁQUINA', () => {
    // Por máquina y no por worktree: el recurso escaso es la RAM, y los cuatro trabajadores tienen
    // árboles distintos — un candado por árbol no serializaría nada.
    const i = conCandado({ comando: 'npm', args: ['run', 'typecheck'], esperaMaxSegundos: 900 })
    expect(i.comando).toBe('flock')
    expect(i.args).toEqual(['-w', '900', '-E', String(SALIDA_SIN_CANDADO), RUTA_CANDADO, 'npm', 'run', 'typecheck'])
    expect(RUTA_CANDADO).toBe('/tmp/vence-typecheck.lock')
  })

  it('NO comparte candado con el deploy: son recursos distintos', () => {
    // Compartirlo serializaría un typecheck detrás de un build de 30 minutos.
    expect(RUTA_CANDADO).not.toContain('deploy')
  })

  it('sin `flock` corre el comando tal cual: la ausencia no puede impedir un push', () => {
    const i = conCandado({ comando: 'npm', args: ['run', 'typecheck'], hayFlock: false })
    expect(i.comando).toBe('npm')
    expect(i.args).toEqual(['run', 'typecheck'])
    expect(i.conCandado).toBe(false)
    expect(i.motivo).toMatch(/sin `flock`/)
  })

  it('exige comando: envolver `undefined` acabaría corriendo flock a secas', () => {
    expect(() => conCandado({ args: ['x'] })).toThrow(/falta el comando/)
  })
})

describe('[T-682] interpretarSalida — no confundir «no cogí el candado» con «los tipos fallan»', () => {
  it('el código propio de flock significa que no se consiguió el candado, NO un fallo de tipos', () => {
    // Es lo único que impide que este candado se coma un error de tipos, que es exactamente lo que
    // el guard existe para cazar. Por eso `-E` con un código que `tsc` no usa.
    expect(interpretarSalida(SALIDA_SIN_CANDADO)).toBe('sin_candado')
  })

  it('sin candado, ese mismo código es un fallo como cualquier otro', () => {
    // Sin `flock` de por medio, un 99 viene del comando y hay que tratarlo como fallo: darlo por
    // «no cogí el candado» dejaría pasar un push roto.
    expect(interpretarSalida(SALIDA_SIN_CANDADO, { conCandado: false })).toBe('fallo')
  })

  it('0 es OK y cualquier otro código es fallo', () => {
    expect(interpretarSalida(0)).toBe('ok')
    expect(interpretarSalida(1)).toBe('fallo')
    expect(interpretarSalida(2)).toBe('fallo')
  })
})

describe('[T-682] el guard usa el candado y sigue distinguiendo el fallo real', () => {
  const fs = require('fs')
  const path = require('path')
  const src = fs.readFileSync(path.join(process.cwd(), 'scripts/typecheck-push-guard.cjs'), 'utf8')

  it('el spawn del typecheck pasa por `conCandado`', () => {
    expect(src).toMatch(/conCandado\(\{/)
    expect(src).toMatch(/spawnSync\(inv\.comando, inv\.args/)
  })

  it('si no consigue el candado, CORRE IGUAL (fail-open) en vez de bloquear el push', () => {
    // Un candado que puede dejar a alguien sin pushear para siempre es peor que el problema que
    // arregla. Es la diferencia deliberada con el cerrojo del deploy, que sí aborta.
    expect(src).toMatch(/'sin_candado'/)
    expect(src).toMatch(/se corre igual, sin serializar/)
  })

  it('la espera va al bus de fricción compartido, no a un evento propio', () => {
    // Dos emisores del mismo hecho no miden el doble, divergen.
    expect(src).toMatch(/typecheck_espera/)
    expect(src).toMatch(/emitirFriccion/)
  })
})
