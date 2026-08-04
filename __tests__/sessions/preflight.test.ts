/**
 * @jest-environment node
 */
// ¿Esta sesión está completa para trabajar? (T-539)
//
// Todo el andamiaje de sesiones paralelas hace fail-open cuando le falta la BD, y para una PERSONA
// está bien: la avería de la telemetría no puede parar a quien está delante y puede juzgar. Para un
// trabajador autónomo, ese mismo camino significa trabajar sin supervisión y sin dejar rastro.
//
// Medido el 04/08 en un clon sin `.env.local` (la condición NORMAL de un worktree de agente): tres
// protecciones apagadas, el latido sin escribir —sesión invisible para el reparto— y nada por fuera
// que lo distinguiera de una sesión sana.
//
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { evaluarPreflight, mensajePreflight, severidadPreflight, evaluarUbicacion, cegueraBloquea, mensajeCeguera } =
  require('@/lib/sessions/preflight.cjs')
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { hogar } = require('@/lib/sessions/sid.cjs')
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { rol, rolDeclarado, esTrabajador } = require('@/lib/sessions/sid.cjs')

const sana = { sid: 'sid-1', host: 'fedora', coordinacion: true, latido: true }

describe('la MISMA observación, distinta consecuencia según quién seas', () => {
  it('sesión completa: los dos roles trabajan', () => {
    expect(evaluarPreflight({ ...sana, rol: 'persona' })).toMatchObject({ completo: true, puedeTrabajar: true })
    expect(evaluarPreflight({ ...sana, rol: 'trabajador' })).toMatchObject({ completo: true, puedeTrabajar: true })
  })

  // Es la tesis entera de esta pieza: sin BD, la persona sigue y el trabajador no.
  it('sin BD: la PERSONA puede trabajar (avisada)', () => {
    const v = evaluarPreflight({ sid: 'sid-1', coordinacion: false, rol: 'persona' })
    expect(v).toMatchObject({ completo: false, puedeTrabajar: true, veredicto: 'incompleto_avisado' })
  })

  it('sin BD: el TRABAJADOR no puede coger trabajo', () => {
    const v = evaluarPreflight({ sid: 'sid-1', coordinacion: false, rol: 'trabajador' })
    expect(v).toMatchObject({ completo: false, puedeTrabajar: false, veredicto: 'incompleto_bloqueante' })
  })
})

describe('qué cuenta como falta', () => {
  const claves = (v: any) => v.faltas.map((f: any) => f.clave)

  it('sin sid no hay identidad con la que reclamar nada', () => {
    expect(claves(evaluarPreflight({ sid: null, coordinacion: true, latido: true }))).toContain('identidad')
  })

  it('BD viva pero sin latido escrito → la sesión es invisible para las demás', () => {
    expect(claves(evaluarPreflight({ ...sana, latido: false }))).toEqual(['latido'])
  })

  // Si no hay BD, el latido no puede juzgarse: contarlo aparte sería contar dos veces el mismo
  // fallo y mandar a arreglar donde no es.
  it('sin BD NO se acusa además al latido: es el mismo fallo', () => {
    expect(claves(evaluarPreflight({ sid: 'sid-1', coordinacion: false, latido: null })))
      .toEqual(['coordinacion'])
  })

  // «no lo sé» no es «bien»: mismo principio que el guard del índice.
  it.each([
    ['coordinación sin comprobar', { sid: 'sid-1', coordinacion: null }],
    ['latido sin comprobar', { sid: 'sid-1', coordinacion: true, latido: null }],
  ])('%s cuenta como falta, no como aprobado', (_c, obs) => {
    expect(evaluarPreflight(obs as any).completo).toBe(false)
  })

  // No saber la máquina es aceptable —`mismaMaquina` ya trata el null con cuidado— y fingir que se
  // sabe sería peor que admitirlo.
  it('no saber la máquina NO impide trabajar', () => {
    expect(evaluarPreflight({ ...sana, host: null }).completo).toBe(true)
  })
})

describe('el mensaje dice cómo arreglarlo, no solo qué pasa', () => {
  it('a la persona le avisa de que NO está en el reparto', () => {
    const txt = mensajePreflight(evaluarPreflight({ sid: 'x', coordinacion: false, rol: 'persona' }))
    expect(txt).toMatch(/no lo sé/i)
    expect(txt).toMatch(/DATABASE_URL/)
  })

  it('al trabajador le dice por qué no puede seguir', () => {
    const txt = mensajePreflight(evaluarPreflight({ sid: 'x', coordinacion: false, rol: 'trabajador' }))
    expect(txt).toMatch(/TRABAJADOR INCOMPLETO/)
    expect(txt).toMatch(/invisible/)
  })

  // La credencial de un trabajador NO puede ser un .env.local copiado: son N copias de secretos de
  // negocio que además no se pueden rotar.
  it('el arreglo desaconseja el .env.local copiado', () => {
    const txt = mensajePreflight(evaluarPreflight({ sid: 'x', coordinacion: false, rol: 'trabajador' }))
    expect(txt).toMatch(/gestor de secretos/)
  })
})

describe('severidad: un trabajador parado no es lo mismo que una persona avisada', () => {
  it.each([
    ['completo', { ...sana, rol: 'persona' }, 'info'],
    ['persona incompleta', { sid: 'x', coordinacion: false, rol: 'persona' }, 'warn'],
    ['trabajador parado', { sid: 'x', coordinacion: false, rol: 'trabajador' }, 'error'],
  ])('%s → %s', (_c, obs, esperada) => {
    expect(severidadPreflight(evaluarPreflight(obs as any))).toBe(esperada)
  })
})

// ── EL ROL, QUE ES IDENTIDAD Y VIVE CON EL sid (T-539) ──────────────────────────────────────
describe('rol de sesión', () => {
  it('por defecto es persona: un valor que se olvida no puede cambiar el comportamiento', () => {
    expect(rol({ env: {} })).toBe('persona')
    expect(rol({ env: { VENCE_SESSION_ROLE: '' } })).toBe('persona')
  })

  it('un valor desconocido NO se interpreta: se trata como persona', () => {
    expect(rol({ env: { VENCE_SESSION_ROLE: 'robot' } })).toBe('persona')
  })

  it('se declara explícitamente, sin importar mayúsculas ni espacios', () => {
    expect(rol({ env: { VENCE_SESSION_ROLE: ' Trabajador ' } })).toBe('trabajador')
    expect(esTrabajador({ env: { VENCE_SESSION_ROLE: 'trabajador' } })).toBe(true)
    expect(esTrabajador({ env: {} })).toBe(false)
  })

  // ── LO DECLARADO ≠ LO EFECTIVO, y confundirlos apagó la alarma ─────────────────────────────
  // Medido en la 1ª vuelta del piloto: el trabajador declaró su rol en el comando del preflight y
  // no en los siguientes, que laten igual. El latido guardaba `rol()` —que devuelve 'persona' tanto
  // si se declaró como si no— así que cada comando normal lo degradaba a persona EN SILENCIO. Su
  // fila acabó en NULL teniendo un preflight que decía «trabajador», y con ella se apagó la alarma
  // del parte, que es exactamente lo que existe para verlo.
  describe('rolDeclarado: distingue «no lo ha dicho» de «ha dicho persona»', () => {
    it('sin variable → null, que es «no declarado» y NO se puede persistir como persona', () => {
      expect(rolDeclarado({ env: {} })).toBeNull()
      expect(rol({ env: {} })).toBe('persona')          // el efectivo sí tiene defecto
    })

    it('declarar persona SÍ es una afirmación, y se distingue del silencio', () => {
      expect(rolDeclarado({ env: { VENCE_SESSION_ROLE: 'persona' } })).toBe('persona')
    })

    it('un valor desconocido no es una declaración', () => {
      expect(rolDeclarado({ env: { VENCE_SESSION_ROLE: 'robot' } })).toBeNull()
    })
  })
})

// ── ESTAR EN EL ÁRBOL DE OTRA SESIÓN (T-539) ────────────────────────────────────────────────
// La identidad la manda el SITIO, así que un proceso que acaba en el árbol ajeno adopta su
// `.session-id` y se vuelve indistinguible de su dueña: el sid, el latido y la huella se derivan
// todos del directorio, así que al mudarse cambian con él y todo vuelve a cuadrar. Lo reportó el
// trabajador en la 1ª vuelta del piloto —su `cwd` se reiniciaba entre comandos— y es [T-415] por
// otra puerta. El único ancla que sobrevive a un cambio de directorio es el entorno del proceso.
describe('¿estoy en MI árbol?', () => {
  const CASA = '/home/manuel/vence-sessions/piloto-t533'

  it('mismo árbol → ok, y una barra final no cambia el veredicto', () => {
    expect(evaluarUbicacion(CASA, CASA)).toBe('ok')
    expect(evaluarUbicacion(`${CASA}/`, CASA)).toBe('ok')
  })

  it('otro árbol → fuera', () => {
    expect(evaluarUbicacion(CASA, '/home/manuel/vence-sessions/t486-flota')).toBe('fuera')
  })

  // Un falso positivo aquí manda a alguien a mudarse sin motivo, y a la tercera deja de hacer caso.
  it.each([
    ['nadie declaró el hogar', null, '/x'],
    ['no se sabe dónde estoy', CASA, null],
    ['ninguno de los dos', null, null],
  ])('%s → no se acusa', (_c, casa, aqui) => {
    expect(evaluarUbicacion(casa as any, aqui as any)).toBe('no_declarado')
  })

  it('el hogar lo declara el ENTORNO, no la sesión, y sin variable no hay hogar', () => {
    expect(hogar({ env: {} })).toBeNull()
    expect(hogar({ env: { VENCE_SESSION_HOME: `${CASA}/` } })).toBe(CASA)
  })

  it('estar fuera cuenta como falta del preflight', () => {
    const v = evaluarPreflight({ ...sana, ubicacion: 'fuera' })
    expect(v.completo).toBe(false)
    expect(v.faltas.map((f: any) => f.clave)).toContain('ubicacion')
  })

  it('«no declarado» NO cuenta como falta: es el caso de cualquier persona', () => {
    expect(evaluarPreflight({ ...sana, ubicacion: 'no_declarado' }).completo).toBe(true)
  })

  it('a un TRABAJADOR fuera de su árbol se le impide trabajar', () => {
    const v = evaluarPreflight({ ...sana, ubicacion: 'fuera', rol: 'trabajador' })
    expect(v.puedeTrabajar).toBe(false)
    expect(mensajePreflight(v)).toMatch(/NO es el suyo/)
  })
})

// ── CÓMO FALLA UN GUARDARRAÍL CIEGO ─────────────────────────────────────────────────────────
// El criterio vive en UN sitio a propósito: dos reglas sobre cómo fallar acabarían divergiendo,
// que es como nacieron los cinco escritores de `seguimiento_url` (T-130).
describe('ceguera de un guardarraíl', () => {
  it('a la persona la deja pasar; al trabajador lo para', () => {
    expect(cegueraBloquea('persona')).toBe(false)
    expect(cegueraBloquea('trabajador')).toBe(true)
  })

  it('el mensaje nombra el guardarraíl, el detalle y cómo diagnosticarlo', () => {
    const txt = mensajeCeguera('backlog-push-guard', 'sin DATABASE_URL')
    expect(txt).toContain('backlog-push-guard')
    expect(txt).toContain('sin DATABASE_URL')
    expect(txt).toMatch(/sesion:preflight/)
  })
})
