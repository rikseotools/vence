/**
 * @jest-environment node
 */
// Inventario de rutas y plan de barrido (T-487).
//
// El dato que manda el diseño, medido el 02/08 sobre el repo: 804 páginas bajo `app/` y solo 168
// FORMAS distintas, porque cada oposición tiene un envoltorio de 21 líneas sobre un componente
// compartido. El código se cubre por FORMA; los datos, rotando el ejemplar entre pasadas.

import {
  rutaDeFichero, formaDeRuta, paramsDeRuta, clasificarRuta,
  inventario, concretar, planDeBarrido, pasadasParaCicloCompleto,
} from '@/lib/sim/rutas'

const OPOS = new Set(['administrativo-aragon', 'administrativo-andalucia', 'celador-sas'])

describe('rutaDeFichero', () => {
  it.each([
    ['app/page.tsx', '/'],
    ['app/perfil/page.tsx', '/perfil'],
    ['app/administrativo-aragon/test/tema/[numero]/page.tsx', '/administrativo-aragon/test/tema/[numero]'],
    ['app/(marketing)/precios/page.js', '/precios'],
  ])('%s → %s', (fichero, esperada) => {
    expect(rutaDeFichero(fichero)).toBe(esperada)
  })
})

describe('formaDeRuta', () => {
  it('colapsa los parámetros dinámicos', () => {
    expect(formaDeRuta('/teoria/[ley]/[articulo]')).toBe('/teoria/:ley/:articulo')
  })

  it('colapsa la oposición cuando se le dice CUÁLES son', () => {
    expect(formaDeRuta('/administrativo-aragon/test/tema/[numero]', OPOS)).toBe('/:oposicion/test/tema/:numero')
  })

  // Un patrón «primer segmento con guiones» colapsaría /politica-privacidad con una oposición, y
  // el inventario diría que hay menos formas de las que hay: un barrido que se cree completo sin
  // serlo es peor que uno que declara lo que no mira.
  it('NO adivina: un segmento parecido a una oposición que no lo es se queda como está', () => {
    expect(formaDeRuta('/politica-privacidad', OPOS)).toBe('/politica-privacidad')
  })

  it('sin el conjunto de oposiciones, cada ruta es su propia forma (más visitas, ninguna mentira)', () => {
    expect(formaDeRuta('/administrativo-aragon/test', null)).toBe('/administrativo-aragon/test')
  })
})

describe('clasificarRuta — no todas cuestan ni ensucian lo mismo', () => {
  it.each([
    ['/politica-privacidad', 'publica'],
    ['/admin/salud-sistema', 'admin'],
    // Herramientas internas: sus 401/403 contra APIs internas son correctos y son ruido.
    ['/debug/shuffle', 'admin'],
    ['/perfil', 'autenticada'],
    ['/test/aleatorio', 'sirve_preguntas'],
    ['/administrativo-aragon/test/tema/[numero]', 'sirve_preguntas'],
    ['/psicotecnicos', 'sirve_preguntas'],
    ['/revisar/[testId]', 'efimera'],
  ])('%s → %s', (ruta, clase) => {
    expect(clasificarRuta(ruta)).toBe(clase)
  })

  // Abrir preguntas sin responderlas es LITERALMENTE la firma de `harvest_no_answer`. Que esas
  // rutas estén marcadas es lo que permite dejarlas fuera por defecto en vez de descubrirlo
  // cuando el antifraude denuncie a nuestra propia cuenta de pruebas.
  it('admin y las que sirven preguntas NO son «publica»: la clase es lo que permite excluirlas', () => {
    expect(clasificarRuta('/admin')).not.toBe('publica')
    expect(clasificarRuta('/test/rapido')).not.toBe('publica')
  })
})

describe('inventario', () => {
  const FICHEROS = [
    'app/page.tsx',
    'app/administrativo-aragon/test/page.tsx',
    'app/administrativo-andalucia/test/page.tsx',
    'app/celador-sas/test/page.tsx',
    'app/administrativo-aragon/temario/[slug]/page.tsx',
    'app/politica-privacidad/page.tsx',
  ]

  it('agrupa las 3 páginas de test de oposición en UNA forma', () => {
    const inv = inventario(FICHEROS, OPOS)
    const test = inv.find((f) => f.forma === '/:oposicion/test')!
    expect(test.ejemplares).toHaveLength(3)
    expect(inv.map((f) => f.forma).sort()).toEqual(
      ['/', '/:oposicion/temario/:slug', '/:oposicion/test', '/politica-privacidad'].sort(),
    )
  })

  it('es determinista: el mismo conjunto en otro orden da el mismo plan', () => {
    const a = inventario(FICHEROS, OPOS)
    const b = inventario([...FICHEROS].reverse(), OPOS)
    expect(JSON.stringify(b)).toBe(JSON.stringify(a))
  })

  it('recuerda los parámetros de cada forma', () => {
    expect(inventario(FICHEROS, OPOS).find((f) => f.forma === '/:oposicion/temario/:slug')!.params).toEqual(['slug'])
  })
})

describe('concretar — inventarse un id daría un 404 que parecería un fallo del sitio', () => {
  it('sustituye los parámetros por valores reales', () => {
    expect(concretar('/teoria/[ley]/[articulo]', { ley: 'ley-39-2015', articulo: '13' }))
      .toBe('/teoria/ley-39-2015/13')
  })

  it('devuelve null si falta un valor — eso NO es un fallo del sitio', () => {
    expect(concretar('/revisar/[testId]', {})).toBe(null)
    expect(concretar('/teoria/[ley]/[articulo]', { ley: 'x' })).toBe(null)
  })
})

describe('planDeBarrido', () => {
  const FICHEROS = [
    'app/page.tsx',
    'app/administrativo-aragon/test/page.tsx',
    'app/administrativo-andalucia/test/page.tsx',
    'app/celador-sas/test/page.tsx',
    'app/politica-privacidad/page.tsx',
    'app/admin/salud-sistema/page.tsx',
  ]
  const inv = inventario(FICHEROS, OPOS)

  it('una visita por FORMA: repetir ejemplares gasta presupuesto sin mirar nada nuevo', () => {
    const { visitas } = planDeBarrido(inv, { presupuesto: 50 })
    expect(visitas.map((v) => v.url).sort()).toEqual(['/', '/politica-privacidad'])
  })

  it('la rotación es determinista y cubre los DATOS con el tiempo', () => {
    const clases = ['publica', 'sirve_preguntas'] as const
    const urls = (p: number) => planDeBarrido(inv, { presupuesto: 50, pasada: p, clases: [...clases] })
      .visitas.filter((v) => v.forma === '/:oposicion/test').map((v) => v.url)
    expect(urls(0)).toEqual(['/administrativo-andalucia/test'])
    expect(urls(1)).toEqual(['/administrativo-aragon/test'])
    expect(urls(2)).toEqual(['/celador-sas/test'])
    expect(urls(3)).toEqual(urls(0))          // vuelve a empezar: ciclo completo y comprobable
  })

  it('el motivo dice qué ejemplar tocó, para que el muestreo no parezca arbitrario', () => {
    const { visitas } = planDeBarrido(inv, { presupuesto: 50, pasada: 1, clases: ['sirve_preguntas'] })
    expect(visitas[0].motivo).toBe('ejemplar 2/3 (pasada 1)')
  })

  // Un barrido que trunca en silencio se lee como «lo he visto todo» sin haberlo visto: es el
  // mismo fallo que las landings que se daban por auditadas.
  it('el presupuesto RECORTA y dice qué se quedó fuera', () => {
    const { visitas, fuera } = planDeBarrido(inv, { presupuesto: 1 })
    expect(visitas).toHaveLength(1)
    expect(fuera.some((f) => f.includes('sin presupuesto'))).toBe(true)
  })

  it('lo que no se puede concretar sale en «fuera», no como visita rota', () => {
    const conEfimera = inventario([...FICHEROS, 'app/revisar/[testId]/page.tsx'], OPOS)
    const { visitas, fuera } = planDeBarrido(conEfimera, { presupuesto: 50, clases: ['publica', 'efimera'] })
    expect(visitas.map((v) => v.url)).not.toContain('/revisar/[testId]')
    expect(fuera.some((f) => f.includes('faltan valores para testId'))).toBe(true)
  })

  // REGRESIÓN: la primera versión sustituía la oposición del ejemplar por una fija, y entonces el
  // barrido miraba 128 veces la MISMA oposición creyendo que las rotaba.
  it('`valores.oposicion` NO pisa la oposición del ejemplar rotado', () => {
    const urls = planDeBarrido(inv, {
      presupuesto: 50, pasada: 2, clases: ['sirve_preguntas'], valores: { oposicion: 'celador-sas' },
    }).visitas.map((v) => v.url)
    expect(urls).toEqual(['/celador-sas/test'])       // el de la pasada 2, no el forzado
    expect(planDeBarrido(inv, {
      presupuesto: 50, pasada: 0, clases: ['sirve_preguntas'], valores: { oposicion: 'celador-sas' },
    }).visitas.map((v) => v.url)).toEqual(['/administrativo-andalucia/test'])
  })

  it('sí rellena los segmentos [oposicion] LITERALES, que son otra cosa', () => {
    const conLiteral = inventario(['app/[oposicion]/comparar/page.tsx'], OPOS)
    const { visitas } = planDeBarrido(conLiteral, { presupuesto: 9, valores: { oposicion: 'celador-sas' } })
    expect(visitas.map((v) => v.url)).toEqual(['/celador-sas/comparar'])
  })

  // 128 oposiciones empiezan en el tema 1 y 3 empiezan en el 101: un valor universal daría 404
  // falsos SOLO en las pasadas que tocaran esas tres, que es la peor forma de fallar.
  it('el resolver por ejemplar recibe la oposición que ha tocado', () => {
    const vistos: Array<string | null> = []
    planDeBarrido(inventario([
      'app/administrativo-aragon/temario/[slug]/page.tsx',
      'app/celador-sas/temario/[slug]/page.tsx',
    ], OPOS), {
      presupuesto: 9, pasada: 1,
      resolver: ({ oposicion }) => { vistos.push(oposicion); return { slug: `tema-${oposicion === 'celador-sas' ? 101 : 1}` } },
    })
    expect(vistos).toEqual(['celador-sas'])
  })

  it('por defecto NO entra ni el admin ni lo que sirve preguntas', () => {
    const { visitas } = planDeBarrido(inv, { presupuesto: 50 })
    expect(visitas.some((v) => v.url.startsWith('/admin'))).toBe(false)
    expect(visitas.some((v) => v.clase === 'sirve_preguntas')).toBe(false)
  })
})

describe('pasadasParaCicloCompleto — poder DECIR cuánto tarda en verse todo', () => {
  it('es el mayor número de ejemplares de una forma incluida', () => {
    const inv = inventario([
      'app/page.tsx',
      'app/administrativo-aragon/temario/page.tsx',
      'app/administrativo-andalucia/temario/page.tsx',
    ], OPOS)
    expect(pasadasParaCicloCompleto(inv, ['publica'])).toBe(2)
  })
})
