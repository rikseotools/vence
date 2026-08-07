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
    ['cerrar con revision o release si no puede terminarla', /revision <id>|release <id>/],
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

// ── ¿EL ENCARGO ARRANCÓ DE VERDAD? (T-642) ──────────────────────────────────────────────────
// `tmux send-keys` solo confirma que se escribieron las teclas. Medido el 07/08: con la cuota
// semanal agotada, `claude -p` moría en <1s y el vigía lo contaba como éxito cada 5 min durante
// 3h sin que nadie llegara a trabajar — 27 relanzamientos inútiles de la misma tarea.
describe('¿arrancó de verdad el encargo, o murió al instante? (T-642)', () => {
  it('si el panel sigue ocupado (claude en marcha), arrancó', () => {
    const v = ENC.arrancoDeVerdad('claude')
    expect(v.arranco).toBe(true)
    expect(v.motivo).toBeNull()
  })

  it('EL CASO REAL: si volvió a un shell, NO arrancó — se dice, no se declara éxito', () => {
    const v = ENC.arrancoDeVerdad('bash')
    expect(v.arranco).toBe(false)
    expect(v.motivo).toMatch(/casi al instante/)
  })

  it.each(['bash', 'zsh', '-bash', 'SH', ' fish '])('cualquier shell (%s) cuenta como "volvió", no solo bash', (c) => {
    expect(ENC.arrancoDeVerdad(c).arranco).toBe(false)
  })

  // Fail-closed hacia «no se sabe», DISTINTO de fail-closed hacia «murió»: un panel que no se
  // pudo leer no es lo mismo que uno que se leyó y volvió a un shell — confundirlos habría dado
  // por muerto a un trabajador que solo estaba en una máquina con SSH lento en ese instante.
  it.each([null, undefined, '', '   '])('sin dato (%s): no se sabe, ni true ni false', (c) => {
    const v = ENC.arrancoDeVerdad(c as any)
    expect(v.arranco).toBeNull()
    expect(v.motivo).toMatch(/no se pudo ver/)
  })

  it('usa el MISMO criterio que puedeRecibir, no uno paralelo (T-130)', () => {
    // Dos preguntas que dependen del mismo estado del panel no pueden tener criterios que
    // diverjan: es justo el olor de los cinco escritores de seguimiento_url.
    for (const c of ['claude', 'node', 'bash', '', 'vim']) {
      const ocupado = !ENC.puedeRecibir(c).libre
      const noArranco = ENC.arrancoDeVerdad(c).arranco === false
      // "no arrancó" solo puede ser true cuando "ocupado" es false (volvió a estar libre) Y hay dato.
      if (noArranco) expect(ocupado).toBe(false)
    }
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
  // El techo lo puso Manuel en RAM, no en número de trabajadores: «lanza hasta que la RAM esté al
  // 80%, no más». Así que el registro puede crecer, pero cada máquina tiene que seguir siendo UNA
  // fila con su árbol propio — que es lo que estos tres tests protegen.
  it('el registro declara los trabajadores de cada máquina, sin duplicar nombres', () => {
    const todos = MAQ.trabajadoresEsperados().map((x: any) => x.trabajador)
    expect(new Set(todos).size).toBe(todos.length)
    expect(todos.length).toBeGreaterThanOrEqual(4)
  })

  it('los nombres son válidos como slug de worktree', () => {
    for (const { trabajador } of MAQ.trabajadoresEsperados()) {
      expect(trabajador).toMatch(/^[a-z0-9][a-z0-9-]*$/)
    }
  })
})

// ── EL SUPERVISOR NO PUEDE DEPENDER DE QUE ALGUIEN LE PREGUNTE ──────────────────────────────
// Sabía repartir, pero solo cuando se lo pedían. Y como el turno de un `claude -p` muere al
// terminar, la consecuencia real era que la flota se paraba entera y nadie se enteraba hasta la
// siguiente vez que Manuel preguntaba — medido el 05/08 con ocho trabajadores en pie y seis sin
// hacer nada. Un panel que hay que mirar no es vigilancia.
// ── EL CICLO ENTERO, COMO LAS SESIONES DEL PORTÁTIL ─────────────────────────────────────────
// «Deben tratar las tareas como lo hacen en mi portátil: las ejecutan, las despliegan, las
// verifican en producción y las archivan si están correctas» (Manuel, 05/08). Tenía razón: lo que
// se lo impedía era el ENCARGO, no el sistema. Un trabajador local corre como él, alcanza AWS y
// comparte el candado del deploy con sus sesiones — verificado con `sts get-caller-identity`.
//
// La única máquina que NO puede es el VPS, y no por política: el candado es un `flock` sobre un
// fichero LOCAL, así que entre máquinas no hay exclusión y dos deploys podrían solaparse ([T-485]).
describe('el ciclo completo depende de la máquina, no de una política', () => {
  const local = ENC.encargo({ trabajador: 'l1', tarea: t('x'), puedeDesplegar: true })
  const remoto = ENC.encargo({ trabajador: 'w1', tarea: t('x'), puedeDesplegar: false })

  it.each([
    ['despliega', /deploy-cuando-verde/],
    ['verifica EN PRODUCCIÓN, no en local', /EN PRODUCCI[ÓO]N/],
    ['y cierra él mismo', /done <id> --outcome/],
  ])('quien puede: %s', (_c, patron) => {
    expect(local).toMatch(patron as RegExp)
  })

  it('quien no puede, NO despliega y deja la tarea esperando al deploy', () => {
    expect(remoto).not.toMatch(/deploy-cuando-verde/)
    expect(remoto).toMatch(/tras-deploy/)
    expect(remoto).toMatch(/T-485/)          // con el porqué: una regla sin motivo se salta
  })

  // Cerrar con un outcome que confiesa trabajo pendiente es cerrar en falso, y `done` ya lo aborta.
  // Decírselo antes evita que gaste el turno chocando con la puerta.
  it('le avisa de cuándo NO debe cerrar', () => {
    expect(local).toMatch(/NO cierres: usa `pause`/)
  })

  // Las dos puertas comparten el final: si una se queda sin él, ese trabajador cierra distinto.
  it('el encargo de impugnaciones lleva el mismo cierre', () => {
    expect(ENC.encargoImpugnacion({ trabajador: 'l1', puedeDesplegar: true })).toMatch(/done <id> --outcome/)
  })
})

// ── UN SOLO PROGRAMADOR (T-617, 06/08) ──────────────────────────────────────────────────────
// Estos tests vigilaban que DOS bucles (`vigilar` y `bucle`) no divergieran. Ya no hay dos: se
// colapsaron en uno, y `bucle` delega en `repartir` en vez de reimplementar la criba. Así que las
// mismas propiedades se comprueban ahora donde de verdad viven — y siguen haciendo falta.
//
// Merece la pena dejar dicho lo que pasó al colapsarlos: `repartir` NO relanzaba turnos muertos
// (eso solo estaba en `vigilar`), así que la fusión perdía esa capacidad en silencio. Lo cazaron
// estos mismos tests, que es exactamente para lo que se escribieron.
describe('el programador continuo', () => {
  const src = require('fs').readFileSync(
    require('path').join(process.cwd(), 'scripts', 'flota', 'flota.cjs'), 'utf8')
  const bloqueRepartir = src.slice(src.indexOf("cmd === 'repartir'"), src.indexOf("cmd === 'bucle'"))

  it('existe, se puede acotar la cadencia, y `vigilar` sigue funcionando como alias', () => {
    expect(src).toMatch(/cmd === 'bucle'/)
    expect(src).toMatch(/--cada/)
    expect(src).toMatch(/cmd = 'bucle'/)   // el alias
  })

  // NO reimplementa la criba: lanza `repartir` como hijo. Una segunda copia acabaría entregando
  // cosas distintas según quién repartiera ([T-130]).
  it('el bucle delega en `repartir`, no reparte por su cuenta', () => {
    const bloqueBucle = src.slice(src.indexOf("cmd === 'bucle'"))
    expect(bloqueBucle).toMatch(/execFileSync\(process\.execPath,\s*\[__filename,\s*'repartir'\]/)
    expect(bloqueBucle).not.toMatch(/tmux send-keys/)
  })

  // Pasa por la MISMA puerta que el reparto manual: si tuviera su propio camino de envío, se
  // quedaría sin las comprobaciones que se le añadan a la otra ([T-130]).
  it('reparte por mandarEncargo, no por su cuenta', () => {
    expect(bloqueRepartir).toMatch(/mandarEncargo\(/)
    expect(bloqueRepartir).not.toMatch(/tmux send-keys/)
  })

  // Un turno muerto se relanza CON SU TAREA. Darle otra encima de un trabajo a medias es como se
  // pierde ese trabajo [T-577]. Y una tarea cogida por un turno muerto bloquea a TODOS.
  it('a quien tiene tarea cogida y sin proceso le devuelve LA SUYA', () => {
    expect(bloqueRepartir).toMatch(/reanuda:\s*true/)
    expect(bloqueRepartir).toMatch(/tarea:\s*suya/)
  })

  // Lo que es de una persona sigue siéndolo: automatizar la aprobación sería justo lo que este
  // sistema no quiere.
  it('no responde preguntas ni aprueba borradores', () => {
    expect(bloqueRepartir).not.toMatch(/responder|answer\s*=|aprob/i)
  })
})

// ── «NO SE PUDO VER» NO ES «ESTÁ EJECUTANDO» ────────────────────────────────────────────────
// `puedeRecibir('')` devuelve libre:false, que es correcto para decidir si se le manda un encargo
// (sin dato no se manda). Pero leerlo al revés —«no está libre, luego está trabajando»— pinta de
// verde a un trabajador que NO EXISTE: paso con w3 y w4 el 05/08, declarados en el registro y
// nunca arrancados, saliendo «🟢 ejecutando» en el panel.
describe('el panel distingue «ocupado» de «no se pudo ver»', () => {
  it('sin dato, puedeRecibir dice que NO se le mande (eso está bien)', () => {
    expect(ENC.puedeRecibir('').libre).toBe(false)
  })

  it('pero el panel exige un comando REAL antes de pintarlo ejecutando', () => {
    const src = require('fs').readFileSync(
      require('path').join(process.cwd(), 'scripts', 'flota', 'flota.cjs'), 'utf8')
    expect(src).toMatch(/const ejecutando = comando !== ''/)
  })
})

// ── EL REPARTO VA POR CAPACIDAD, NO POR TURNO ───────────────────────────────────────────────
// Una tarea de backlog casi siempre acaba en «desplegar y verificar en producción», y eso solo lo
// puede hacer quien comparte el candado del deploy. Una impugnación es análisis puro: la cierra
// igual de bien un trabajador del VPS. Repartir por turno mandaba backlog a quien no podía
// terminarlo, y generaba cola de «hecho, falta desplegar».
describe('a cada trabajador, el trabajo que PUEDE terminar', () => {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const MAQ = require('@/lib/flota/maquinas.cjs')

  it('quien puede desplegar cierra el ciclo entero: le toca el backlog', () => {
    expect(MAQ.puedeDesplegar('l1').puede).toBe(true)
  })

  it('quien no puede, a impugnaciones — que no necesitan deploy', () => {
    const v = MAQ.puedeDesplegar('w1')
    expect(v.puede).toBe(false)
    expect(v.porQueNo).toMatch(/T-485/)      // con el porqué, no como dogma
  })

  // Desde el 05/08 la capacidad de desplegar ya no manda a nadie a impugnaciones (la flota salió
  // de esa cola), pero sigue decidiendo QUÉ tareas se le ofrecen: `esApta` descarta las de deploy
  // para quien no puede. El criterio se conserva; lo que cambió es su consecuencia.
  it('y el vigía sigue repartiendo por esa capacidad, no por el nombre', () => {
    const src = require('fs').readFileSync(
      require('path').join(process.cwd(), 'scripts', 'flota', 'flota.cjs'), 'utf8')
    expect(src).toMatch(/MAQ\.puedeDesplegar\(trabajador\)\.puede/)
    expect(src).not.toMatch(/const aImpugnaciones = !MAQ\.puedeDesplegar/)
  })

  it('un trabajador no declarado no despliega (fail-closed)', () => {
    expect(MAQ.puedeDesplegar('no-existe').puede).toBe(false)
  })
})

// Las dos puertas de reparto (`repartir` y `vigilar`) tienen que usar el MISMO criterio: si no, el
// trabajo que le toca a alguien dependería de por dónde entrases — y así es como una de las dos se
// queda sin lo que se añade a la otra ([T-130]).
describe('repartir y vigilar reparten igual', () => {
  const src = require('fs').readFileSync(
    require('path').join(process.cwd(), 'scripts', 'flota', 'flota.cjs'), 'utf8')

  it('los dos consultan puedeDesplegar para decidir la cola', () => {
    const enRepartir = src.slice(src.indexOf("cmd === 'repartir'"))
    expect(enRepartir).toMatch(/MAQ\.puedeDesplegar\(f\.trabajador\)\.puede/)
    expect(src).toMatch(/MAQ\.puedeDesplegar\(trabajador\)\.puede/)
  })

  it('y ninguno de los dos manda por su cuenta: pasan por mandarEncargo', () => {
    expect((src.match(/tmux send-keys -t \$\{trabajador\}/g) || []).length).toBeLessThanOrEqual(1)
  })
})

// ── NINGÚN ENVÍO SIN RASTRO ─────────────────────────────────────────────────────────────────
// El turno de un trabajador no se observaba en absoluto: nacía y moría dentro de un fichero de log
// en su máquina, sin cruzar a ninguna parte. Nadie podía responder «¿cuánto tarda un turno?»,
// «¿cuántos mueren a medias?» ni «¿qué se le encargó y cuándo?» sin entrar por SSH a leer un tail.
//
// Al ponerlo, se emitió desde cada llamador… y se olvidó en `repartir`, así que la serie nacía
// incompleta el primer día. Por eso el rastro lo deja la PUERTA y esto lo exige.
describe('el rastro del turno lo deja la puerta, no el llamador', () => {
  const src = require('fs').readFileSync(
    require('path').join(process.cwd(), 'scripts', 'flota', 'flota.cjs'), 'utf8')

  it('mandarEncargo emite el turno él mismo', () => {
    const fn = src.slice(src.indexOf('function mandarEncargo'), src.indexOf('/** Dónde vive el fichero de entorno'))
    expect(fn).toMatch(/if \(turno\) turno\(\)/)
  })

  // Si un llamador se olvida del reporte, su envío queda invisible: la serie miente por omisión,
  // que es la forma en que un panel deja de servir sin que nadie lo note.
  it('TODA llamada a mandarEncargo pasa su reporte', () => {
    // Sin la definición: `function mandarEncargo(…)` no es una llamada.
    const llamadas = (src.match(/(?<!function )mandarEncargo\([\s\S]{0,600}?\)\n/g) || [])
    expect(llamadas.length).toBeGreaterThanOrEqual(4)
    const sinTurno = llamadas.filter((c: string) => !/turno:\s*\(\)\s*=>/.test(c))
    expect({ sinTurno: sinTurno.length, ejemplos: sinTurno.map((c: string) => c.slice(0, 70)) })
      .toEqual({ sinTurno: 0, ejemplos: [] })
  })

  it('y un turno muerto se distingue de uno que empieza', () => {
    expect(src).toMatch(/emitirTurno\(trabajador, 'muerto'/)
    expect(src).toMatch(/'encargado'/)
  })
})

// ── RESCATAR ES ADITIVO; DESCARTAR, NO ──────────────────────────────────────────────────────
// La puerta del clon rehúsa dar trabajo nuevo a quien tiene cambios sin commitear —y hace bien:
// pueden ser la única copia— pero eso deja al trabajador ENCALLADO hasta que alguien lo mira. Pasó
// cuatro veces el 05/08 y las cuatro se resolvió a mano con los mismos tres comandos.
//
// Automatizarlo es seguro porque rescatar solo AÑADE: en el peor caso deja un commit de más, que
// se descarta leyéndolo. Lo que destruye es lo contrario, y eso sigue siendo de una persona.
// ── ESTO COMPRUEBA LO QUE LA ORDEN DICE, NO LO QUE HACE ─────────────────────────────────────
// Antes se leía el TEXTO de `scripts/flota/flota.cjs` y se recortaba con `indexOf`, así que un
// renombrado del comentario que servía de ancla dejaba el bloque vacío y los `toMatch` pasaban
// sobre la nada. Ahora se le pide la orden a quien la produce en producción — el mismo valor que
// se ejecuta —, de modo que estos trinquetes no pueden quedarse mirando a un sitio equivocado.
//
// Aun así siguen siendo texto: que **funcione** lo demuestra `npm run sim:rescate-flota`, que la
// ejecuta contra repos git reales (rescata lo sin commitear, no pisa una rama divergida, …).
describe('el rescate automático', () => {
  const { ordenRescate } = require(require('path').join(process.cwd(), 'lib', 'flota', 'rescate.cjs'))
  const bloque: string = ordenRescate({ arbol: '/arbol/del/trabajador', trabajador: 'w1' })
  const fuente = require('fs').readFileSync(
    require('path').join(process.cwd(), 'scripts', 'flota', 'flota.cjs'), 'utf8')

  it('la orden que se ejecuta es la del módulo, no una copia en el supervisor', () => {
    expect(bloque.length).toBeGreaterThan(200)
    expect(fuente).toMatch(/RESC\.ordenRescate\(/)
    // Si alguien vuelve a incrustar la orden en el supervisor, la simulación pasaría a probar
    // una copia y dejaría de decir nada del comando real.
    expect(fuente).not.toMatch(/SUCIO=\$\(git status --porcelain/)
  })

  it('solo añade: commit y push, jamás descarta', () => {
    expect(bloque).toMatch(/git add -A/)
    expect(bloque).toMatch(/git push/)
    expect(bloque).not.toMatch(/reset|clean -|checkout --|stash/)
  })

  // La salida cómoda ante un `non-fast-forward` es `--force`, y es exactamente lo que un rescate no
  // puede hacer: destruiría lo que hubiera en el remoto, o sea lo que se venía a proteger.
  it('NUNCA fuerza el push', () => {
    // `push --force`, `push -f`, o el `+` del refspec. Nada de eso puede aparecer.
    expect(bloque).not.toMatch(/push[^\n]*--force|push\s+-f\b|HEAD:\+|:\+refs/)
  })

  // Una referencia nueva por rescate no choca con nada. Y como lleva el SHA dentro, rescatar dos
  // veces el mismo commit escribe la MISMA ref: idempotente sin comprobar nada.
  it('empuja a una referencia nueva que lleva el SHA', () => {
    expect(bloque).toMatch(/rescate\/w1-.*\$\(git rev-parse --short "\$R"\)/)
  })

  // El 05/08 el rescate dijo «nada que salvar» en las 4 máquinas del VPS con 22 commits sin
  // empujar: miraba `HEAD`, y los trabajadores entregan en una rama por tarea y vuelven a `main`.
  // Que lo EJECUTA bien lo prueba el caso 3.bis de `npm run sim:rescate-flota`; esto solo impide
  // que alguien vuelva a estrechar la mirada a HEAD.
  it('mira TODAS las ramas, no solo HEAD', () => {
    expect(bloque).toMatch(/--branches --not --remotes/)
    expect(bloque).toMatch(/for-each-ref[^;]*refs\/heads/)
    expect(bloque).not.toMatch(/count HEAD --not --remotes/)
  })

  // Si no hay nada que salvar no debe crear ruido: ni commits vacíos ni ramas.
  it('si no hay nada que salvar, sale sin tocar nada', () => {
    expect(bloque).toMatch(/echo NADA && exit 0/)
  })

  // Un commit de rescate NO introduce trabajo, lo CONSERVA: las comprobaciones tienen que pasar
  // cuando alguien lo lleve a main, no para impedir que se guarde. Sin esto el rescate moriría en
  // el mismo `pre-commit` que ya bloqueó al trabajador.
  it('el commit de rescate no pasa por el hook, y el mensaje dice que no está aprobado', () => {
    expect(bloque).toMatch(/--no-verify/)
    expect(bloque).toMatch(/rescatar no es aprobar/)
  })

  it('y deja rastro, salga bien o mal', () => {
    expect(fuente).toMatch(/emitirTurno\(w, ok \? 'rescatado' : 'rescate_fallido'/)
  })
})

// ── UN FILTRO QUE SOBREVIVE A SU MOTIVO ES UN BLOQUEO SIN MOTIVO ────────────────────────────
// Los dos falsos positivos los reportó otra sesión, no un test — y ese es el dato: una tarea que el
// reparto salta en CADA vuelta no aparece en ningún sitio. No falla, solo deja de repartir.
describe('la criba y sus falsos positivos', () => {
  // «factur» a secas era demasiado ancho: en este repo casi toda tarea valiosa justifica su
  // prioridad con lo que vende. [T-585] —corpus documental, contenido puro— llevaba rondas
  // saltándose sola porque su ficha dice «factura 1.691 €/90d».
  it('el dinero como CONTEXTO no descarta; como ASUNTO sí', () => {
    expect(ENC.esApta(t('El corpus documental de las que MÁS VENDEN está vacío: Madrid factura 1.691 €/90d')).apta).toBe(true)
    for (const titulo of [
      'Nila tiene NUEVE precios activos con duplicados',
      'Unificar stripe-fees-summary a las dos cuentas',
      'Las 184 suscripciones que se apagan solas no reciben aviso',
      'Revisar la facturación de julio',
    ]) expect(ENC.esApta(t(titulo)).apta).toBe(false)
  })

  // El filtro del deploy dejó de ser universal el 05/08, cuando los locales pasaron a cerrar el
  // ciclo entero. Se quedó atrás descartando 6 tareas abiertas que sí podían hacerse.
  it('desplegar solo descarta a quien NO puede desplegar', () => {
    const tarea = t('Desplegar el backend con el arreglo del cron')
    expect(ENC.esApta(tarea).apta).toBe(false)
    expect(ENC.esApta(tarea, { puedeDesplegar: true }).apta).toBe(true)
  })

  // Poder desplegar no abre las demás puertas: lo que protege a los usuarios no depende de eso.
  it('pero poder desplegar NO relaja lo demás', () => {
    for (const titulo of [
      'Responder a la impugnación de Sergio',
      'Mandar la newsletter de agosto',
      'El cobro de Stripe falla en el primer intento',
    ]) expect(ENC.esApta(t(titulo), { puedeDesplegar: true }).apta).toBe(false)
  })

  it('y `elegir` le pasa la capacidad a la criba', () => {
    const r = ENC.elegir([t('Desplegar el frontend', 'T-1'), t('Auditar el scope', 'T-2')], { puedeDesplegar: true })
    expect(r.tarea.id).toBe('T-1')
  })
})

// ── LA FLOTA NO TOCA IMPUGNACIONES, Y EL PORTÁTIL NO RECIBE REPARTO ─────────────────────────
// Dos decisiones de Manuel del 05/08, y las dos tienen que poder comprobarse sin arrancar nada:
// «cámbialos a backlog» y «no uses trabajadores locales porque voy a abrir consolas y se me va a
// colgar el ordenador».
describe('a quién y a qué se reparte', () => {
  const MAQ = require(require('path').join(process.cwd(), 'lib', 'flota', 'maquinas.cjs'))
  const fuente = require('fs').readFileSync(
    require('path').join(process.cwd(), 'scripts', 'flota', 'flota.cjs'), 'utf8')

  it('el portátil sigue DECLARADO (si no, se pierde la ruta de sus árboles y lo que tengan sin empujar)', () => {
    const todos = MAQ.trabajadoresEsperados().map((x: any) => x.trabajador)
    expect(todos).toEqual(expect.arrayContaining(['l1', 'l6', 'w1', 'w4']))
  })

  it('pero NO recibe reparto automático: solo los del VPS', () => {
    const reciben = MAQ.trabajadoresQueReciben().map((x: any) => x.trabajador)
    expect(reciben).toEqual(['w1', 'w2', 'w3', 'w4'])
    expect(reciben).not.toContain('l1')
  })

  it('el reparto usa la lista de los que RECIBEN, no la de los declarados', () => {
    // Si se colara `trabajadoresEsperados`, el portátil volvería a recibir trabajo automático y
    // el bloqueo no serviría de nada. Antes se exigían ≥2 apariciones porque había DOS puertas
    // (`repartir` y `vigilar`); desde [T-617] hay UNA, que es lo que de verdad lo garantiza.
    expect((fuente.match(/trabajadoresQueReciben\(\)/g) || []).length).toBeGreaterThanOrEqual(1)
  })

  // ── ESTE TEST NACE DE HABERSE QUEDADO CORTO ────────────────────────────────────────────
  // La primera versión comprobaba que `VENCE_FLOTA_IMPUGNACIONES` APARECIERA en el fichero. Y
  // aparecía: se había arreglado `vigilar` y NO `repartir`, así que el test pasó en verde
  // mientras `repartir` seguía mandando a los cuatro del VPS a impugnaciones — que es como se
  // descubrió, mandándolas de verdad. Ahora se exige que las DOS puertas pregunten al MISMO
  // sitio, que es lo único que impide que se vuelvan a separar.
  it('la puerta del reparto no manda impugnaciones por su cuenta', () => {
    const { flotaCogeImpugnaciones } = require(
      require('path').join(process.cwd(), 'lib', 'flota', 'encargo.cjs'))
    expect(flotaCogeImpugnaciones()).toBe(false)
    // Consulta el helper, no un `if` propio. Se exigían ≥2 porque eran dos puertas y una se había
    // arreglado sin la otra; desde [T-617] hay UNA sola, que es la forma fuerte de lo mismo.
    expect((fuente.match(/ENC\.flotaCogeImpugnaciones\(\)/g) || []).length).toBeGreaterThanOrEqual(1)
    // Y ninguna decide por su cuenta leyendo la variable de entorno.
    expect(fuente).not.toMatch(/process\.env\.VENCE_FLOTA_IMPUGNACIONES/)
    // El fallback «si no hay tarea, dale una impugnación» ya no puede ser incondicional.
    expect(fuente).not.toMatch(/if \(!texto\) \{ texto = ENC\.encargoImpugnacion/)
  })

  it('se puede reactivar declarándolo, y el criterio vive en UN sitio', () => {
    const path = require('path').join(process.cwd(), 'lib', 'flota', 'encargo.cjs')
    delete require.cache[path]
    process.env.VENCE_FLOTA_IMPUGNACIONES = '1'
    expect(require(path).flotaCogeImpugnaciones()).toBe(true)
    delete process.env.VENCE_FLOTA_IMPUGNACIONES
    delete require.cache[path]
  })
})

// ── EL ENCARGO NO PUEDE CONTRADECIRSE A SÍ MISMO ────────────────────────────────────────────
// Tenía a la vez la regla dura «NO pushees a main» y el paso «git push origin HEAD:main». Un
// trabajador que lee las dos elige una, y no hay forma de saber cuál. Salió al preguntarse por
// qué el trabajo se quedaba en el disco: la instrucción de empujar existía y era la equivocada.
describe('el encargo dice UNA sola cosa sobre empujar y cerrar', () => {
  const ENC = require(require('path').join(process.cwd(), 'lib', 'flota', 'encargo.cjs'))
  const texto = (puedeDesplegar: boolean) =>
    ENC.encargo({ trabajador: 'w1', tarea: { id: 'T-1', title: 'prueba' }, puedeDesplegar })

  it('no manda empujar a main, que es lo que su propia regla dura prohíbe', () => {
    for (const t of [texto(false), texto(true)]) {
      expect(t).toMatch(/NO pushees a main/)
      expect(t).not.toMatch(/push origin HEAD:main/)
    }
  })

  it('manda empujar la rama PRONTO, no al final', () => {
    for (const t of [texto(false), texto(true)]) {
      expect(t).toMatch(/git push origin HEAD\b/)
      expect(t).toMatch(/NO EXISTE|no existe/)
    }
  })

  it('exige cerrar antes de terminar el turno, con la comprobación de que no queda nada suelto', () => {
    for (const t of [texto(false), texto(true)]) {
      expect(t).toMatch(/TU TURNO NO TERMINA SIN CERRAR/)
      expect(t).toMatch(/--not --remotes/)
      expect(t).toMatch(/COGIDA POR NADIE/)
    }
  })
})

// ── UNA CAUSA AFIRMADA TIENE QUE ESTAR DEMOSTRADA ───────────────────────────────────────────
// El encargo pedía verificar el CONTENIDO contra la fuente oficial, pero no decía nada sobre las
// afirmaciones del propio trabajador. Y «causa raíz encontrada» es la frase que hace que quien
// revisa se lo crea y mergee sin volver a mirarlo — el 06/08 se mergearon tres ramas así.
// El primer trabajador que lo hizo bien (w2 en T-592, con la cifra «127 commits por detrás»)
// lo hizo por oficio, no porque se lo pidieran: eso es suerte, no diseño.
describe('el encargo exige demostrar lo que se afirma', () => {
  const ENC = require(require('path').join(process.cwd(), 'lib', 'flota', 'encargo.cjs'))
  const t = ENC.encargo({ trabajador: 'w1', tarea: { id: 'T-1', title: 'x' }, puedeDesplegar: false })

  it('prohíbe afirmar una causa sin demostrarla', () => {
    expect(t).toMatch(/NO AFIRMES UNA CAUSA QUE NO HAYAS DEMOSTRADO/)
  })

  it('y da las DOS formas válidas de demostrarla, no un «asegúrate» genérico', () => {
    expect(t).toMatch(/REPRODUCIRLA/)
    expect(t).toMatch(/MEDIRLA/)
    expect(t).toMatch(/CIFRA/)
  })

  it('deja salida honesta: si no puede demostrarlo, que lo diga como sospecha', () => {
    expect(t).toMatch(/SOSPECHO/)
    // La salida tiene que existir: sin ella, la regla se rodea afirmando igual.
    expect(t).toMatch(/PEOR que no haber mirado/)
  })
})

// ── EL ESCALÓN QUE NO TENÍA MOTOR ───────────────────────────────────────────────────────────
// Cinco de los seis escalones del ciclo de una tarea avanzan solos; `entregada → revisada`
// esperaba a que alguien decidiera mirar. Medido el 06/08: 23 entregas paradas, 15 h de media,
// la más vieja 41 h. No era una cola lenta: era una cola sin salida.
describe('el encargo de REVISIÓN', () => {
  const ENC = require(require('path').join(process.cwd(), 'lib', 'flota', 'encargo.cjs'))
  const t = ENC.encargoRevision({
    trabajador: 'w3', tarea: { id: 'T-148', title: 'Guardia Civil' },
    entrega: 'arreglado X', autor: 'w4',
  })

  it('dice explícitamente que NO la rehaga: es el fallo caro de reofrecer una tarea hecha', () => {
    expect(t).toMatch(/NO LA REHAGAS/)
    expect(t).toMatch(/REVISAR lo que ya entregó otro/)
  })

  it('pide comprobar la AFIRMACIÓN contra la realidad, no solo leer el código', () => {
    expect(t).toMatch(/CONTRA LA REALIDAD/)
    expect(t).toMatch(/afirma una causa sin demostrarla/)
  })

  it('exige veredicto cerrado y hallazgos con el CÓMO', () => {
    expect(t).toMatch(/--veredicto ok/)
    expect(t).toMatch(/--veredicto problemas/)
    expect(t.replace(/\s+/g, ' ')).toMatch(/no es un veredicto, es un sello/)
  })

  it('NO delega el merge: eso sigue siendo de una persona', () => {
    expect(t).toMatch(/NO la mergees a `main`/)
  })

  it('le dice cómo cogerla, porque `claim` la va a rechazar (y eso es lo esperado)', () => {
    expect(t).toMatch(/claim T-148 --force --motivo/)
  })
})

describe('el supervisor reparte revisiones ANTES que tareas nuevas', () => {
  const fuente = require('fs').readFileSync(
    require('path').join(process.cwd(), 'scripts', 'flota', 'flota.cjs'), 'utf8')

  it('busca entregas sin revisar antes de elegir tarea', () => {
    const rep = fuente.slice(fuente.indexOf("cmd === 'repartir'"))
    expect(rep.indexOf('porRevisar')).toBeLessThan(rep.indexOf('ENC.elegir(candidatas'))
  })

  it('y nunca le da a nadie SU propia entrega', () => {
    expect(fuente).toMatch(/review_requested_by IS DISTINCT FROM/)
  })
})

// ── LA MEMORIA DEL REPARTO NO PUEDE VIVIR SOLO EN RAM ───────────────────────────────────────
// El `Set` de repartidas muere con el proceso, así que dos invocaciones seguidas de `repartir`
// daban la MISMA tarea a dos trabajadores. Pasó dos veces el 06/08: T-038 a w3 y w4, y T-533 a
// w2 y w3 — la segunda ya con encargos de REVISIÓN, que es peor: dos revisando lo mismo.
describe('el reparto recuerda entre invocaciones', () => {
  const fuente = require('fs').readFileSync(
    require('path').join(process.cwd(), 'scripts', 'flota', 'flota.cjs'), 'utf8')

  it('la memoria sale de la BD, no de una variable del proceso', () => {
    expect(fuente).toMatch(/repartidasHacePoco/)
    expect(fuente).toMatch(/event_type = 'flota_turno'/)
  })

  it('y filtra TANTO las revisiones como las tareas nuevas', () => {
    // Si solo filtrara una de las dos, el duplicado vuelve por la otra puerta.
    expect((fuente.match(/!repartidasHacePoco\.has\(/g) || []).length).toBeGreaterThanOrEqual(2)
  })
})

// ── UN `index.lock` NO ES BASURA POR DEFECTO ────────────────────────────────────────────────
// El rescate hace `git add -A && git commit`, y el 06/08 reventó con «Unable to create
// index.lock» mientras w1 tenía un `git commit` VIVO. Forzar ahí puede dejar a medias el índice
// de quien sí estaba trabajando — lo contrario de lo que un rescate viene a hacer.
describe('el rescate se aparta de un commit en curso', () => {
  const R = require(require('path').join(process.cwd(), 'lib', 'flota', 'rescate.cjs'))
  const orden = R.ordenRescate({ arbol: '/arbol', trabajador: 'w1' })

  it('mira si hay un git vivo antes de tocar el índice', () => {
    expect(orden).toMatch(/index\.lock/)
    expect(orden).toMatch(/pgrep/)
  })

  it('y si lo hay, sale sin tocar nada (no borra el lock ni fuerza)', () => {
    expect(orden).toMatch(/echo OCUPADO; exit 0/)
    expect(orden).not.toMatch(/rm -f .*index\.lock/)
  })

  it('el supervisor lo cuenta como espera, no como fallo', () => {
    const f = require('fs').readFileSync(
      require('path').join(process.cwd(), 'scripts', 'flota', 'flota.cjs'), 'utf8')
    expect(f).toMatch(/está commiteando ahora mismo/)
  })
})

// ═══════════════════════════════════════════════════════════════════════════════════════════
// ENCADENAR TAREAS DENTRO DEL TURNO (T-486, 06/08)
//
// Pregunta de Manuel: «¿por qué ellos mismos no se sugieren qué tarea seguir aprovechando el
// contexto? eso sí pasa con tareas en local con Claude Code». Tenía razón y la causa era literal:
// el encargo decía que el turno es de un solo tiro y NUNCA les decía que encadenaran, así que
// terminaban una tarea y se paraban. Medido el 06/08: w2, w3 y w4 llevaban ~30 min encendidos sin
// hacer nada esperando a que el supervisor repartiera otra vez.
//
// La diferencia con una sesión local es que allí el proceso sigue vivo; aquí `claude -p` muere al
// terminar de escribir. Pero DENTRO del turno no hay ninguna limitación: puede cerrar una tarea y
// coger otra. Lo que faltaba no era una capacidad, era la instrucción.
// ═══════════════════════════════════════════════════════════════════════════════════════════
describe('el turno no termina con contexto libre', () => {
  const texto = () => ENC.COLA_COMUN({ puedeDesplegar: false }).join('\n')

  it('le dice que coja otra tarea al cerrar la suya', () => {
    expect(texto()).toMatch(/ENCADENA MIENTRAS TE QUEDE CONTEXTO/)
  })

  it('y que la coja RELACIONADA, que es donde el contexto vale (orden de Manuel)', () => {
    const t = texto()
    expect(t).toMatch(/RELACIONADA/)
    // Se apoya en lo que el CLI YA sugiere al cerrar (`sugerirSiguiente`, T-498: relacionadas
    // primero y `next` como red), en vez de mandarle a elegir a ciegas.
    expect(t).toMatch(/backlog\.cjs done/)
    expect(t).toMatch(/backlog\.cjs claim/)
  })

  it('renueva el lease mientras encadena, o su tarea queda libre para otro', () => {
    // Sin esto, encadenar 3 h significaba perder el claim a los 90 min y que otro trabajador
    // cogiera la MISMA tarea mientras el primero seguía escribiendo en ella.
    expect(texto()).toMatch(/backlog\.cjs heartbeat/)
    expect(texto()).toMatch(/90 min/)
  })

  it('y el límite sigue siendo el CONTEXTO, no la tarea (no contradice la regla del 80%)', () => {
    const t = texto()
    expect(t).toMatch(/80%/)
    // Encadenar y «no dejes nada en segundo plano» conviven: lo segundo prohíbe esperar fuera del
    // turno, no trabajar más dentro de él. Si alguien borra una de las dos, esto lo canta.
    expect(t).toMatch(/TU TURNO NO TIENE FUTURO/)
    expect(t).toMatch(/primer plano/)
  })

  it('recuerda que se reclama antes y se cierra antes de coger la siguiente', () => {
    // Sin esto, «encadena» se leería como «acumula tareas», que es justo lo contrario: dos
    // cogidas a la vez se las quitan a los demás mientras solo se trabaja una.
    expect(texto()).toMatch(/dos\s*\n?\s*tareas cogidas a la vez|dos tareas cogidas a la vez/)
  })
})

// ── T-642 (07/08/2026): un trabajador que se cae desaparece en silencio ─────────────────────
// Los tres casos que se midieron ese día, cada uno con su prueba. No son hipótesis: los tres
// ocurrieron el mismo día y los tres tenían la misma forma — el supervisor DECLARABA un estado
// en vez de OBSERVARLO, y como nadie miraba, la flota se paraba sin que constara en ningún sitio.
describe('[T-642] presenciaDelPanel — sin sesión NO es lo mismo que apagado, ni que invisible', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { presenciaDelPanel, ordenDeArranque } = require('../../lib/flota/encargo.cjs')

  it('sin sesión y DEBERÍA tenerla: se resucita, no se salta', () => {
    // El fallo literal del 07/08: `w2` y `w4` perdieron su tmux y el bucle los descartó sin una
    // línea, imprimiendo «todo en marcha, nada que repartir» durante una hora.
    const p = presenciaDelPanel({ sesionExiste: false, reparte: true })
    expect(p.estado).toBe('sin_sesion')
    expect(p.accion).toBe('resucitar')
    expect(p.libre).toBe(false)
  })

  it('sin sesión pero su máquina no reparte: está APAGADO, y eso no es una avería', () => {
    // Los seis del portátil salían 🔴 de forma permanente. Seis rojos fijos enseñan a no mirar el
    // rojo, y entonces el que sí importa pasa desapercibido.
    const p = presenciaDelPanel({ sesionExiste: false, reparte: false })
    expect(p.estado).toBe('apagado')
    expect(p.accion).toBeNull()
  })

  it('no se pudo preguntar: ni se actúa ni se da por muerto', () => {
    // Con `sesionViva` devolviendo `false` ante un ssh caído, la reanimación automática habría
    // recreado sesiones SANAS —matando el turno de dentro— cada vez que la red hiciera un hipo.
    const p = presenciaDelPanel({ sesionExiste: null, reparte: true })
    expect(p.estado).toBe('invisible')
    expect(p.accion).toBeNull()
    expect(p.libre).toBe(false)
  })

  it('con sesión, decide por el panel: shell = libre, otra cosa = trabajando', () => {
    expect(presenciaDelPanel({ sesionExiste: true, paneCommand: 'bash', reparte: true }).estado).toBe('libre')
    expect(presenciaDelPanel({ sesionExiste: true, paneCommand: 'bash', reparte: true }).libre).toBe(true)
    expect(presenciaDelPanel({ sesionExiste: true, paneCommand: 'claude', reparte: true }).estado).toBe('trabajando')
  })

  it('con sesión pero panel ilegible: invisible, NO libre (fail-closed de T-539)', () => {
    const p = presenciaDelPanel({ sesionExiste: true, paneCommand: '', reparte: true })
    expect(p.estado).toBe('invisible')
    expect(p.libre).toBe(false)
  })

  it('el criterio NO se duplica: se apoya en puedeRecibir', () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { puedeRecibir, SHELLS } = require('../../lib/flota/encargo.cjs')
    for (const sh of SHELLS) {
      expect(presenciaDelPanel({ sesionExiste: true, paneCommand: sh, reparte: true }).libre)
        .toBe(puedeRecibir(sh).libre)
    }
  })
})

describe('[T-642] ordenDeArranque — tiene que levantar TAMBIÉN a uno ya «arrancado»', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { ordenDeArranque } = require('../../lib/flota/encargo.cjs')

  it('donde hay unidad usa restart, NUNCA start', () => {
    // La unidad es de un solo disparo (`active (exited)`): sobre ella `systemctl start` es un
    // no-op y el comando imprimía ✅ igual. Medido con w2 y w4, que no volvieron.
    // (El parámetro pasó de `local` a `systemd` en T-647: la condición es «¿hay unidad?», no
    // «¿está en mi máquina?» — de eso depende en qué cgroup acaban los turnos.)
    const o = ordenDeArranque({ trabajador: 'w2', systemd: true })
    expect(o).toContain('systemctl restart vence-flota@w2')
    expect(o).not.toMatch(/systemctl start/)
  })

  it('en el portátil no hay unidad: crea la sesión solo si no está', () => {
    const o = ordenDeArranque({ trabajador: 'l3', systemd: false })
    expect(o).toContain('tmux has-session -t l3')
    expect(o).toContain('tmux new-session -d -s l3')
    expect(o).not.toMatch(/systemctl/)
  })

  it('es idempotente por construcción: repetirla sobre uno sano no lo tumba', () => {
    // `restart` sobre una unidad viva la reinicia (que es lo que se quiere si su tmux murió) y
    // `has-session ||` no toca la que ya existe. Ninguna de las dos formas mata trabajo ajeno
    // sin querer, que es la razón de que la reanimación solo dispare con `sesionExiste === false`.
    expect(ordenDeArranque({ trabajador: 'w1', systemd: true })).toBe(ordenDeArranque({ trabajador: 'w1', systemd: true }))
    expect(ordenDeArranque({ trabajador: 'l1', systemd: false })).toBe(ordenDeArranque({ trabajador: 'l1', systemd: false }))
  })
})

describe('[T-642] un turno HUÉRFANO sigue siendo un turno', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { presenciaDelPanel } = require('../../lib/flota/encargo.cjs')

  it('sin sesión pero CON proceso vivo: NO se resucita ni se le manda nada', () => {
    // El caso medido dos veces el 07/08: el OOM del VPS se llevó el servidor de tmux y el
    // `claude -p` de dentro quedó huérfano y siguió trabajando. Al no ver sesión, se creaba una
    // nueva y se mandaba un SEGUNDO turno: dos procesos escribiendo en el mismo worktree.
    const p = presenciaDelPanel({ sesionExiste: false, reparte: true, turnosVivos: 1 })
    expect(p.estado).toBe('trabajando')
    expect(p.accion).toBeNull()
    expect(p.libre).toBe(false)
    expect(p.motivo).toMatch(/huérfano/)
  })

  it('el PROCESO manda sobre el panel cuando discrepan', () => {
    // Panel en un shell (parecería libre) pero con un turno vivo: gana el que puede destruir
    // trabajo. Un falso «ocupado» cuesta una vuelta de reparto; un falso «libre» cuesta el árbol.
    expect(presenciaDelPanel({ sesionExiste: true, paneCommand: 'bash', reparte: true, turnosVivos: 1 }).libre).toBe(false)
  })

  it('sin turnos vivos, la decisión es la de siempre', () => {
    expect(presenciaDelPanel({ sesionExiste: false, reparte: true, turnosVivos: 0 }).accion).toBe('resucitar')
    expect(presenciaDelPanel({ sesionExiste: true, paneCommand: 'bash', reparte: true, turnosVivos: 0 }).libre).toBe(true)
  })

  it('y una máquina apagada con turnos a 0 sigue siendo apagado, no avería', () => {
    expect(presenciaDelPanel({ sesionExiste: false, reparte: false, turnosVivos: 0 }).estado).toBe('apagado')
  })
})

describe('[T-647] a los trabajadores los levanta systemd, y de eso depende el techo de memoria', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { ordenDeArranque } = require('../../lib/flota/encargo.cjs')
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const MAQ = require('../../lib/flota/maquinas.cjs')

  it('la máquina de la flota los levanta por unidad, aunque el supervisor esté EN ella', () => {
    // Se decidía por local/remoto, y en el VPS el supervisor vive en la misma máquina: caía en la
    // rama de tmux, levantaba las sesiones él y todos los `claude -p` acababan contabilizados en
    // SU cgroup. Medido: un turno se desbocó a 6,6 GB y el kernel mató al supervisor.
    const o = ordenDeArranque({ trabajador: 'w2', systemd: true })
    expect(o).toContain('systemctl restart vence-flota@w2')
    expect(o).not.toMatch(/tmux new-session/)
  })

  it('donde NO hay unidad (el portátil de Manuel), se crea la sesión a mano', () => {
    const o = ordenDeArranque({ trabajador: 'l3', systemd: false })
    expect(o).toContain('tmux new-session -d -s l3')
    expect(o).not.toMatch(/systemctl/)
  })

  it('y el registro de máquinas lo DECLARA: la del VPS sí, el portátil no', () => {
    // Si alguien añade una máquina nueva y olvida declararlo, sus turnos volverían al cgroup del
    // supervisor sin que nada lo dijera. Esto lo deja escrito donde se lee.
    expect(MAQ.maquinaDe('w1').systemd).toBe(true)
    expect(Boolean(MAQ.maquinaDe('l1').systemd)).toBe(false)
  })
})
