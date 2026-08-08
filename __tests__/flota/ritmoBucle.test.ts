/**
 * [T-693] El supervisor se durmió 60 minutos con la flota parada: 8 entregas esperando, cero
 * trabajadores trabajando y la máquina a carga 0,00 con 6,6 GB libres. Al reiniciarlo, repartió
 * cuatro revisiones en la PRIMERA pasada.
 *
 * `siguientePausa` estaba bien desde [T-642] — no espacia si hay ocupados. Lo que fallaba es que
 * **el dato no le llegaba**: se raspaba del texto del subproceso, y `repartir` tiene DOS finales;
 * uno lleva la palabra «ocupado» y el otro no. Estos tests ejercitan **las dos redacciones**, que
 * es exactamente lo que no se probó al arreglar T-642 y por eso el defecto volvió por otra puerta.
 */
const BUC = require('@/lib/flota/bucle.cjs')

const CADA = 300

describe('[T-693] leerPasada — el dato del ritmo, sin depender de cómo esté redactada una frase', () => {
  it('lee la marca estructurada, que es el camino bueno', () => {
    const salida = `montones de prosa\n${BUC.lineaPasada({ repartidos: 0, ocupados: 4 })}`
    expect(BUC.leerPasada(salida)).toEqual({ repartidos: 0, ocupados: 4, fuente: 'marca' })
  })

  it('EL CASO DEL FALLO: «nada que repartir… todos con tarea» YA trae los ocupados', () => {
    // Esta es la frase que no llevaba la palabra «ocupado». Con ella el bucle leía 0 y espaciaba
    // hasta 60 min teniendo a los cuatro trabajando.
    const salida = '✅ nada que repartir: 4 trabajador(es) vivo(s), todos con tarea.\n' +
      BUC.lineaPasada({ repartidos: 0, ocupados: 4 })
    const p = BUC.leerPasada(salida)
    expect(p.ocupados).toBe(4)
    expect(BUC.siguientePausa({ ...p, cada: CADA, anterior: 3600 })).toBe(CADA)
  })

  it('LA OTRA REDACCIÓN: «N encargo(s) repartido(s) · M ocupado(s)» sigue funcionando', () => {
    const salida = '\n1 encargo(s) repartido(s) · 3 ocupado(s). Míralo con: npm run flota\n' +
      BUC.lineaPasada({ repartidos: 1, ocupados: 3 })
    expect(BUC.leerPasada(salida)).toEqual({ repartidos: 1, ocupados: 3, fuente: 'marca' })
  })

  it('sin marca cae al texto viejo: un clon sin actualizar degrada, no revienta', () => {
    // Mientras los clones se ponen al día conviven versiones. Leer ceros sería peor que leer poco.
    const p = BUC.leerPasada('1 encargo(s) repartido(s) · 3 ocupado(s).')
    expect(p).toEqual({ repartidos: 1, ocupados: 3, fuente: 'texto' })
  })

  it('y dice de dónde vino, para poder MEDIR si alguien se quedó atrás', () => {
    expect(BUC.leerPasada('no hay nada reconocible').fuente).toBe('ninguna')
  })

  it('una marca corrupta no tumba la pasada: se sigue por el camino viejo', () => {
    const p = BUC.leerPasada('##flota-pasada {esto no es json}\n2 encargo(s) repartido(s) · 1 ocupado(s)')
    expect(p).toEqual({ repartidos: 2, ocupados: 1, fuente: 'texto' })
  })
})

describe('[T-693] siguientePausa — un fallo es avería, no calma', () => {
  it('tras una pasada FALLIDA se vuelve al ritmo normal, no se espacia', () => {
    // El 08/08: `spawnSync ETIMEDOUT` porque la máquina estaba ahogada → esperaba 60 min más.
    // Cuanto peor iba el sistema, más tarde volvía a mirar.
    expect(BUC.siguientePausa({ repartidos: 0, ocupados: 0, cada: CADA, anterior: 3600, fallo: true })).toBe(CADA)
  })

  it('el fallo manda incluso sobre la calma acumulada', () => {
    expect(BUC.siguientePausa({ repartidos: 0, ocupados: 0, cada: CADA, anterior: 999999, fallo: true })).toBe(CADA)
  })

  it('sin fallo y sin nada que hacer, sigue espaciando (el back-off no se rompe)', () => {
    // Lo que NO queremos es cargarnos el back-off legítimo: si de verdad no hay nada, espaciar
    // está bien y evita despertar a la máquina cada 5 minutos por gusto.
    expect(BUC.siguientePausa({ repartidos: 0, ocupados: 0, cada: CADA, anterior: CADA })).toBeGreaterThan(CADA)
  })

  it('con la flota llena NO espacia, que es lo que arregló T-642', () => {
    expect(BUC.siguientePausa({ repartidos: 0, ocupados: 4, cada: CADA, anterior: 3600 })).toBe(CADA)
  })
})

describe('[T-693] los DOS extremos: repartir emite el dato en todos sus finales', () => {
  const fs = require('fs')
  const path = require('path')
  const src = fs.readFileSync(path.join(process.cwd(), 'scripts/flota/flota.cjs'), 'utf8')

  it('la salida TEMPRANA (nadie libre) también lo emite — era el agujero', () => {
    // El `return 0` de «nada que repartir» se iba sin decir cuántos hay ocupados, y el bucle
    // leía 0. Se ancla en la LÍNEA IMPRESA, no en la primera aparición del texto: hay un
    // comentario más arriba que habla de lo mismo y ancló ahí en el primer intento.
    const i = src.indexOf('✅ nada que repartir:')
    expect(i).toBeGreaterThan(0)
    const hastaElReturn = src.slice(i, src.indexOf('return 0', i) + 10)
    expect(hastaElReturn).toMatch(/BUC\.lineaPasada\(/)
  })

  it('la salida FINAL también, para que no haya un camino mudo', () => {
    const i = src.indexOf('encargo(s) repartido(s) · ')
    expect(i).toBeGreaterThan(0)
    expect(src.slice(i, src.indexOf('return 0', i) + 10)).toMatch(/BUC\.lineaPasada\(/)
  })

  it('el bucle YA NO raspa la prosa', () => {
    expect(src).not.toMatch(/r\.match\(\/·\\s\*\(\\d\+\)\\s\+ocupado\//)
    expect(src).toMatch(/BUC\.leerPasada\(r\)/)
  })

  it('y le pasa el fallo a la decisión del ritmo', () => {
    expect(src).toMatch(/siguientePausa\(\{[^}]*fallo: !!motivoSalto/)
  })

  it('BUC se importa al nivel del MÓDULO, no dentro de un comando', () => {
    // Esto no es estilo: `repartir` y `bucle` son comandos distintos del mismo fichero, y el
    // require vivía DENTRO de `bucle`. Al emitir el dato desde `repartir` reventaba con
    // «BUC is not defined» — y ningún test lo vio, porque todos leen el TEXTO del fichero y
    // ninguno ejecuta el comando. Lo cazó correrlo de verdad.
    const iRequire = src.indexOf("require(path.join(REPO, 'lib', 'flota', 'bucle.cjs'))")
    const iPrimerUso = src.indexOf('BUC.')
    expect(iRequire).toBeGreaterThan(0)
    expect(iRequire).toBeLessThan(iPrimerUso)
    // y una sola vez: dos requires en ámbitos distintos es cómo se llega otra vez aquí
    expect(src.split("require(path.join(REPO, 'lib', 'flota', 'bucle.cjs'))").length - 1).toBe(1)
  })
})
