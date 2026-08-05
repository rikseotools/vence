/**
 * @jest-environment node
 */
// Qué se le encarga a un trabajador de la flota, y qué NO. (T-486)
//
// Un trabajador arrancado sin encargo es una sesión mirando a la pared. Y el encargo no puede
// escribirse a mano cada vez: si cada quien improvisa el suyo, cada trabajador entiende su trabajo
// de una forma distinta y el piloto deja de ser comparable consigo mismo.
//
// ── LO QUE ESTE FICHERO NO PRETENDE ─────────────────────────────────────────────────────────
// La seguridad de la flota NO está en este texto, está en las credenciales: un trabajador tiene el
// rol de coordinación (4 tablas) y el de lectura (sin datos personales, sin escritura), y no tiene
// claves de AWS ni de Stripe. Aunque ignorase el encargo entero, no puede cobrar ni desplegar ni
// leer el correo de nadie.
//
// Lo que sí protege el encargo es el TIEMPO: que no coja algo que no va a poder terminar, y que no
// se meta donde hace falta criterio humano.
//
// eslint-disable-next-line @typescript-eslint/no-var-requires
const ENC = require('@/lib/flota/encargo.cjs')

const t = (title: string, id = 'T-1') => ({ id, title })

describe('qué NO es para un trabajador autónomo', () => {
  it.each([
    ['responder una impugnación de un usuario', /persona/i],
    ['Contestar a Marta sobre su feedback del temario', /persona/i],
    ['Desplegar el backend con el arreglo del cron', /AWS|despleg/i],
    ['El cobro de Stripe falla en el primer intento', /dinero/i],
    ['DECISIÓN DE MANUEL: publicar o no la oposición de Sevilla', /no es t[eé]cnic/i],
    ['Mandar la newsletter de agosto a los 1.300 inscritos', /correo/i],
  ])('«%s» se descarta', (titulo, motivo) => {
    const v = ENC.esApta(t(titulo))
    expect(v.apta).toBe(false)
    expect(v.motivo).toMatch(motivo)
  })

  // La criba es CONSERVADORA a propósito: lo que impide el daño es el permiso, y un filtro que se
  // pasara de listo dejaría a la flota sin trabajo que hacer.
  it.each([
    'Generar preguntas para los artículos huérfanos del temario',
    'El badge article_no_coverage no ve las leyes escopadas enteras',
    'Cantabria T6 sirve dos capítulos que su epígrafe no pide',
    'Cuatro alertas de salud del 01/08 quedaron sin triar',
  ])('«%s» SÍ es apta', (titulo) => {
    expect(ENC.esApta(t(titulo)).apta).toBe(true)
  })

  it('sin título no se juzga: se descarta diciendo por qué', () => {
    expect(ENC.esApta(t('  '))).toMatchObject({ apta: false })
    expect(ENC.esApta({} as any).motivo).toMatch(/sin t[ií]tulo/i)
  })
})

describe('elegir: la primera apta, y se dice qué se descartó', () => {
  it('salta las no aptas y devuelve la primera que vale', () => {
    const r = ENC.elegir([
      t('Responder a la impugnación de Sergio', 'T-1'),
      t('Desplegar el frontend', 'T-2'),
      t('Auditar el scope de Cantabria', 'T-3'),
    ])
    expect(r.tarea.id).toBe('T-3')
    expect(r.descartadas.map((d: any) => d.id)).toEqual(['T-1', 'T-2'])
  })

  it('si ninguna vale, lo dice en vez de inventarse una', () => {
    expect(ENC.elegir([t('Desplegar backend')]).tarea).toBeNull()
    expect(ENC.elegir([]).tarea).toBeNull()
  })
})

describe('el encargo dice lo que un trabajador solo no puede deducir', () => {
  const texto = ENC.encargo({ trabajador: 'w1', tarea: t('Auditar el scope', 'T-533') })

  it('nombra al trabajador y su tarea', () => {
    expect(texto).toContain('w1')
    expect(texto).toContain('T-533')
  })

  it('le manda leer la ficha y pasar el preflight ANTES de nada', () => {
    expect(texto).toMatch(/claim <id>|claim/)
    expect(texto).toMatch(/sesion:preflight/)
  })

  // Las reglas duras llevan su porqué: una regla sin motivo se salta en cuanto estorba.
  it.each([
    ['no pushear a main', /NO pushees a main/],
    ['no rodear un guardarraíl', /NO lo rodees|_SKIP/],
    ['verificar contra la fuente, no contra la ficha', /fuente oficial|las fichas se/i],
    ['cerrar con revision o release', /revision <id>|release <id>/],
    ['preguntar sin quedarse parado', /preguntar/],
  ])('lleva la regla: %s', (_c, patron) => {
    expect(texto).toMatch(patron)
  })

  // Sin esto, un trabajador da por imposible lo que solo necesitaba la otra credencial — le pasó
  // a w1 en la primera tarea real (T-476).
  it('explica que tiene DOS credenciales y para qué sirve cada una', () => {
    expect(texto).toMatch(/DATABASE_URL/)
    expect(texto).toMatch(/VENCE_LECTOR_URL/)
    expect(texto).toMatch(/permission denied/i)
  })

  // Lo que no esté escrito fuera cuando la sesión se compacte, se pierde. Y un trabajador no tiene
  // a nadie que se lo recuerde a media tarea.
  it('le dice que cierre al 80% de contexto, no al final', () => {
    expect(texto).toMatch(/80%/)
    expect(texto).toMatch(/cerrar ordenadamente|cabos sueltos/i)
  })

  it('sin tarea concreta, le manda elegirla él', () => {
    expect(ENC.encargo({ trabajador: 'l1', tarea: null })).toMatch(/backlog\.cjs next/)
  })
})
