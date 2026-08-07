/**
 * [T-663] El supervisor corre como un usuario normal, y `systemctl restart` de una unidad del
 * sistema exige que polkit se lo permita. Sin la regla, `ordenDeArranque()` está escrita, se
 * invoca, y NO arranca nada nunca — que no es lo mismo que no tenerla: el supervisor cree que
 * lo intentó, y el trabajador se queda muerto con su tarea cogida (contado como ocupado, así que
 * tampoco recibe trabajo nuevo). Medido en el VPS el 07/08: `w1`, 6 horas.
 */
const ENC = require('@/lib/flota/encargo.cjs')

describe('[T-663] permisoDeResurreccion — separar «no puedo» de «no existe»', () => {
  it('reconoce el bloqueo de polkit, que es el fallo real medido en el VPS', () => {
    const real =
      'Failed to restart vence-flota@w3.service: Interactive authentication required.\n' +
      "See system logs and 'systemctl status vence-flota@w3.service' for details."
    const v = ENC.permisoDeResurreccion(real)
    expect(v.puede).toBe(false)
    expect(v.motivo).toMatch(/polkit/)
  })

  it('«unidad no encontrada» es PERMISO CONCEDIDO, y de ahí sale la sonda no destructiva', () => {
    // polkit autoriza ANTES de que systemd busque la unidad. Por eso se sondea con una unidad
    // inexistente: distingue las dos causas sin reiniciar el turno de nadie.
    const v = ENC.permisoDeResurreccion(
      'Failed to restart vence-flota-sonda-inexistente.service: Unit vence-flota-sonda-inexistente.service not found.',
    )
    expect(v.puede).toBe(true)
  })

  it('la sonda apunta a una unidad de la flota que NO existe (si existiera, reiniciaría algo)', () => {
    expect(ENC.SONDA_RESURRECCION).toMatch(/^systemctl restart vence-flota/)
    expect(ENC.SONDA_RESURRECCION).toMatch(/inexistente/)
  })

  it('no inventa un bloqueo donde no lo hay: salida vacía o exitosa no acusa a polkit', () => {
    // Un falso «no tienes permiso» mandaría a tocar polkit cuando el fallo es otro.
    expect(ENC.permisoDeResurreccion('').puede).toBe(true)
    expect(ENC.permisoDeResurreccion(undefined).puede).toBe(true)
  })

  it('reconoce las otras dos formas del mismo rechazo', () => {
    expect(ENC.permisoDeResurreccion('Failed: Access denied').puede).toBe(false)
    expect(ENC.permisoDeResurreccion('not authorized to perform operation').puede).toBe(false)
  })
})

describe('[T-663] el permiso se APROVISIONA, no se apunta como paso manual', () => {
  const fs = require('fs')
  const path = require('path')
  const script = fs.readFileSync(
    path.join(process.cwd(), 'scripts/flota/arrancar-trabajador.sh'),
    'utf8',
  )

  it('arrancar-trabajador.sh instala la regla de polkit', () => {
    // Si el permiso se documenta en vez de instalarse, la siguiente máquina nace rota igual y
    // nadie lo nota hasta que un trabajador muere. Es el mismo modo de fallo que este test cubre.
    expect(script).toMatch(/polkit-1\/rules\.d/)
    expect(script).toMatch(/org\.freedesktop\.systemd1\.manage-units/)
  })

  it('la regla está ACOTADA: solo unidades de la flota, no el resto del sistema', () => {
    // Conceder `manage-units` a secas le daría a la flota el control de cron, ssh y todo lo demás.
    expect(script).toMatch(/indexOf\("vence-flota"\)\s*===\s*0/)
  })
})
