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
    // La mayoría de lo que llega al embudo NO es una decisión: es el criterio de la casa aplicado
    // a un caso nuevo. Medido el 05/08 — de cuatro preguntas paradas, TRES las contestaba el
    // método (no apagues el guardarraíl, no metas una credencial de más, manda lo medido sobre la
    // ficha) y solo una era de verdad de Manuel. Un embudo con ruido se deja de leer.
    ['pensar si el método ya lo contesta antes de preguntar', /ANTES DE PREGUNTAR/],
    // Un `claude -p` es de un solo tiro: lo que se deja «corriendo en segundo plano» no lo recoge
    // nadie. Medido el 05/08 — dos trabajadores terminaron su turno con «me paro aquí a esperar a
    // que acabe la prueba», y las tareas quedaron COGIDAS por nadie con la máquina a carga 0,05.
    ['no dejar nada en segundo plano: el turno no tiene futuro', /NO DEJES NADA/],
    ['y cerrar bien si no cabe, para no bloquear la tarea', /pause.*revision|revision.*--entrega/],
    ['y qué merece de verdad una pregunta', /usuario, a dinero/],
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

  // ── EL MÉTODO LLEGA A LOS TRABAJADORES, Y ES EL MISMO TEXTO ───────────────────────────
  // «Si se lo repito cada poco trabajan mejor» (Manuel, dos veces con las mismas palabras). El
  // texto ya existía (T-495) pero vivía dentro del recordatorio POR TIEMPO, que se dispara en el
  // `heartbeat` — así que solo llegaba a las sesiones de persona. Los trabajadores autónomos, que
  // son a quienes nadie corrige a media tarea, no lo veían nunca.
  //
  // Para un trabajador la cadencia sale gratis: cada tarea es un `claude -p` nuevo, así que el
  // método llega al empezar cada una, sin temporizar nada.
  it('el encargo lleva el método ENTERO, línea por línea', () => {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { METODO } = require('@/lib/sessions/recordatorio.cjs')
    expect(METODO.length).toBeGreaterThanOrEqual(5)
    for (const linea of METODO) expect(texto).toContain(linea)
  })

  // Dos copias del mismo texto acaban divergiendo, y entonces cada trabajador entiende su oficio
  // de una forma distinta. El encargo lo IMPORTA; si alguien lo reescribe, esto se rompe.
  it('y lo IMPORTA en vez de copiarlo', () => {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const fuente = require('fs').readFileSync(
      require('path').join(process.cwd(), 'lib', 'flota', 'encargo.cjs'), 'utf8')
    expect(fuente).toMatch(/require\(['"]\.\.\/sessions\/recordatorio\.cjs['"]\)/)
    expect(fuente).not.toMatch(/nada de chapuzas/)
  })

  it('sin tarea concreta, le manda elegirla él', () => {
    expect(ENC.encargo({ trabajador: 'l1', tarea: null })).toMatch(/backlog\.cjs next/)
  })
})

// ── ¿ESTÁ LIBRE PARA RECIBIRLO? ─────────────────────────────────────────────────────────────
// «Libre» se decidía solo por el claim, y entre mandar el encargo y que el trabajador reclame
// pasan minutos. En esa ventana es invisible y se le manda otro: pasó el 05/08 con `w1`, que
// recibió dos encargos seguidos — el segundo se tecleó dentro del proceso que ya corría y se
// perdió, desperdiciando la vuelta de reparto de esa tarea.
describe('a quién se le puede mandar un encargo AHORA', () => {
  it.each(['bash', 'zsh', '-bash', 'SH', ' fish '])('«%s» = esperando: se le manda', (c) => {
    expect(ENC.puedeRecibir(c).libre).toBe(true)
  })

  it.each(['claude', 'node', 'npm', 'vim', 'git'])('«%s» = trabajando: no se le manda', (c) => {
    const v = ENC.puedeRecibir(c)
    expect(v.libre).toBe(false)
    expect(v.motivo).toContain(c)
  })

  // Fail-closed: no saber qué hace no es lo mismo que saber que está libre.
  it.each([null, undefined, '', '   '])('sin dato (%s) NO se le manda', (c) => {
    const v = ENC.puedeRecibir(c as any)
    expect(v.libre).toBe(false)
    expect(v.motivo).toMatch(/no se pudo ver/)
  })
})

// ── ANALIZAR UNA IMPUGNACIÓN: SÍ. ENVIARLA: NO. ─────────────────────────────────────────────
// `esApta` las descarta del reparto automático porque acaban en un correo a una persona, y eso
// sigue impedido por permiso. Lo que cambia es que ahora hay dónde dejar el borrador, y el trabajo
// de verdad —dossier, contraste contra el boletín, ¿es sistémico?— es técnico y paralelizable.
describe('el encargo de impugnaciones', () => {
  const texto = ENC.encargoImpugnacion({ trabajador: 'l3' })

  it('nombra al trabajador y deja claro que NO envía', () => {
    expect(texto).toContain('l3')
    expect(texto).toMatch(/NO la vas a enviar t[úu]/)
  })

  // Las reglas duras de las impugnaciones no se deducen de los datos: viven en el manual, y
  // saltárselo es cómo se contesta mal a una persona que dedicó su tiempo a avisarnos.
  it('le manda leer el manual ANTES que nada', () => {
    expect(texto).toMatch(/impugnaciones-claude-code\.md/)
    expect(texto).toMatch(/L[ÉE]ELO ENTERO PRIMERO/)
  })

  it.each([
    ['coger UNA sola por la cola con claim atómico', /cola\.cjs next/],
    ['abrir el dossier', /revisar-impugnacion\.cjs/],
    ['verificar contra la fuente oficial', /FUENTE OFICIAL/],
    ['medir si es sistémico, no suponerlo', /S[ÍI]ST[EÉ]MICO\?|M[ÍI]DELO/],
    ['abrir ficha con la cifra si afecta a más', /reserve|Sin cifra no es un hallazgo/],
    ['dejar el borrador, que es el entregable', /backlog\.cjs borrador/],
    ['soltar la fila al terminar', /cola\.cjs release/],
  ])('lleva el paso: %s', (_c, patron) => {
    expect(texto).toMatch(patron as RegExp)
  })

  // El script se negaría igual (lib/sessions/aprobacion.cjs), pero decírselo evita que gaste el
  // turno intentándolo y acabe pensando que la tarea es imposible.
  it('le avisa de que cerrar.ts se negará con él', () => {
    expect(texto).toMatch(/NO cierres la impugnaci[óo]n|cerrar\.ts/)
  })

  // Lo que vale para cualquier encargo tiene que llegar también aquí: si la cola común se queda
  // fuera de una de las dos puertas, ese trabajador trabaja con otras reglas.
  it('comparte la cola común con el encargo normal (método incluido)', () => {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { METODO } = require('@/lib/sessions/recordatorio.cjs')
    for (const linea of METODO) expect(texto).toContain(linea)
    expect(texto).toMatch(/NADA SALE HACIA UNA PERSONA/)
    expect(texto).toMatch(/NO DEJES NADA/)
    expect(texto).toMatch(/80%/)
  })
})

describe('el registro de máquinas crece por FILAS, no por copias', () => {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const MAQ = require('@/lib/flota/maquinas.cjs')

  it('todo trabajador declarado tiene máquina y árbol', () => {
    for (const { trabajador } of MAQ.trabajadoresEsperados()) {
      expect(MAQ.maquinaDe(trabajador)).not.toBeNull()
      expect(MAQ.arbolDe(trabajador)).toBeTruthy()
    }
  })

  // El árbol de un trabajador local lleva su nombre: si dos compartieran árbol, el commit de uno
  // se llevaría el trabajo del otro — exactamente lo que [T-415] persigue entre sesiones.
  it('cada trabajador local tiene un árbol propio', () => {
    const locales = MAQ.trabajadoresEsperados().filter((x: any) => MAQ.maquinaDe(x.trabajador).local)
    const arboles = locales.map((x: any) => MAQ.arbolDe(x.trabajador))
    expect(new Set(arboles).size).toBe(locales.length)
  })

  // `crear-worktree.sh` exige kebab-case: con 'L1' el arranque muere en la validación del slug.
  it('los nombres son válidos como slug de worktree', () => {
    for (const { trabajador } of MAQ.trabajadoresEsperados()) {
      expect(trabajador).toMatch(/^[a-z0-9][a-z0-9-]*$/)
    }
  })
})
