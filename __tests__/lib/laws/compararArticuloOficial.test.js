/**
 * @jest-environment node
 */
// Clasificación de la diferencia entre lo que servimos y el texto oficial del BOE (T-139).
//
// El caso `reordenado` es REAL y es la razón de que este módulo exista: el art. 28 del
// Reglamento de Armas se dio por *truncado* comparando longitudes contra el bloque CRUDO del
// BOE (que trae todas las versiones y las notas). Contra el bloque VIGENTE no faltaba nada:
// estaban los 23 apartados, desordenados.

const { compararArticuloOficial, parrafos } = require('@/lib/laws/compararArticuloOficial')

const OFICIAL = '1. Primer apartado del artículo.\n\n2. Segundo apartado.\n\n3. Tercer apartado del artículo.'

describe('compararArticuloOficial', () => {
  it('mismo texto con otro formato → idéntico', () => {
    const nuestro = '1. Primer apartado del artículo.\n2. Segundo apartado.\n3. Tercer apartado del artículo.'
    expect(compararArticuloOficial(nuestro, OFICIAL).clase).toBe('identico')
  })

  it('acentos y puntuación no cuentan como diferencia', () => {
    expect(compararArticuloOficial('1 Primer apartado del articulo 2 Segundo apartado 3 Tercer apartado del articulo', OFICIAL).clase).toBe('identico')
  })

  it('todos los apartados pero en otro orden → reordenado, NO incompleto', () => {
    // Este es el fallo que costó un diagnóstico equivocado: "difiere" se leyó como "falta".
    const nuestro = '1. Primer apartado del artículo.\n\n3. Tercer apartado del artículo.\n\n2. Segundo apartado.'
    const r = compararArticuloOficial(nuestro, OFICIAL)
    expect(r.clase).toBe('reordenado')
    expect(r.faltan).toEqual([])
    expect(r.sobran).toEqual([])
  })

  it('un texto oficial partido en más párrafos que el nuestro NO se lee como incompleto', () => {
    // Los dos lados trocean distinto: aquí lo nuestro va en una sola línea.
    const nuestro = '1. Primer apartado del artículo. 2. Segundo apartado. 3. Tercer apartado del artículo.'
    expect(compararArticuloOficial(nuestro, OFICIAL).clase).toBe('identico')
  })

  it('falta un apartado → incompleto, y dice cuál', () => {
    const nuestro = '1. Primer apartado del artículo.\n\n3. Tercer apartado del artículo.'
    const r = compararArticuloOficial(nuestro, OFICIAL)
    expect(r.clase).toBe('incompleto')
    expect(r.faltan).toEqual(['2. Segundo apartado.'])
  })

  it('material que el BOE no tiene → contaminado, y manda sobre lo que falte', () => {
    // Prioridad deliberada: un texto con material ajeno no se arregla importando el oficial;
    // primero hay que saber de dónde salió (puede ser otra norma, o una versión derogada).
    const nuestro = OFICIAL + '\n\n4. Apartado que el BOE no tiene.'
    const r = compararArticuloOficial(nuestro, OFICIAL)
    expect(r.clase).toBe('contaminado')
    expect(r.sobran).toEqual(['4. Apartado que el BOE no tiene.'])
  })

  it('contaminado gana a incompleto cuando pasan las dos cosas', () => {
    const nuestro = '1. Primer apartado del artículo.\n\n9. Apartado inventado.'
    const r = compararArticuloOficial(nuestro, OFICIAL)
    expect(r.clase).toBe('contaminado')
    expect(r.faltan.length).toBe(2)
    expect(r.sobran.length).toBe(1)
  })

  it('sin texto oficial no se inventa veredicto', () => {
    expect(compararArticuloOficial('algo', '').clase).toBe('sin_oficial')
    expect(compararArticuloOficial('algo', null).clase).toBe('sin_oficial')
  })

  it('parrafos ignora líneas vacías y recorta', () => {
    expect(parrafos('  uno  \n\n\n  dos \n')).toEqual(['uno', 'dos'])
  })
})

describe('compararArticuloOficial — errata vs texto ajeno', () => {
  // Caso real: la disposición transitoria de la LO 3/1981 decía «el Defensor del Puebla».
  // Sin esta distinción, una letra cambiada bloqueaba la reactivación igual que el texto de
  // otra norma — y la tentación entonces es bajar el listón hasta tragarse lo segundo.
  it('una palabra mal copiada → erratas, no contaminado', () => {
    const oficial = 'A los cinco años de entrada en vigor de la presente Ley, el Defensor del Pueblo podrá proponer a las Cortes Generales las modificaciones que entienda que deben realizarse.'
    const nuestro = 'A los cinco años de entrada en vigor de la presente Ley, el Defensor del Puebla podrá proponer a las Cortes Generales las modificaciones que entienda que deben realizarse,'
    const r = compararArticuloOficial(nuestro, oficial)
    expect(r.clase).toBe('erratas')
  })

  it('un párrafo de OTRA norma sigue siendo contaminado', () => {
    const oficial = 'A los cinco años de entrada en vigor de la presente Ley, el Defensor del Pueblo podrá proponer modificaciones.'
    const nuestro = 'Las Administraciones públicas no podrán declarar lesivas las resoluciones que hayan sido recurridas en alzada.'
    expect(compararArticuloOficial(nuestro, oficial).clase).toBe('contaminado')
  })

  it('errata en un párrafo pero otro que falta de verdad → NO se rebaja a erratas', () => {
    const oficial = '1. Primer apartado del artículo.\n\n2. Segundo apartado que no tenemos en absoluto.'
    const nuestro = '1. Primer apartada del artículo.'
    const r = compararArticuloOficial(nuestro, oficial)
    expect(r.clase).not.toBe('erratas')
  })
})

describe('compararArticuloOficial — el tope de errata no puede tragarse un hueco', () => {
  // Caso real: la disposición transitoria de la LO 3/1981 venía partida en DOS líneas, así
  // que el párrafo oficial no casaba con ninguno de los nuestros y la errata se leía como
  // texto ajeno. Se comprueba también a nivel de texto completo — pero con un tope ABSOLUTO,
  // porque un 10% de un artículo de 4.000 caracteres es un apartado entero.
  it('errata con los saltos de línea en otro sitio → erratas', () => {
    const oficial = 'A los cinco años de entrada en vigor de la presente Ley, el Defensor del Pueblo podrá proponer a las Cortes Generales aquellas modificaciones que entienda.'
    const nuestro = 'A los cinco años de entrada en vigor de la presente Ley, el Defensor del Puebla podrá\nproponer a las Cortes Generales aquellas modificaciones que entienda,'
    expect(compararArticuloOficial(nuestro, oficial).clase).toBe('erratas')
  })

  it('un apartado entero que falta NO pasa por errata aunque sea poco porcentaje', () => {
    const relleno = 'texto de relleno del articulo que ocupa bastante espacio. '.repeat(60)
    const apartado = '\n\n7. Apartado que en nuestra copia no está y ocupa doscientos caracteres largos para que el porcentaje sea pequeño frente al resto del articulado completo.'
    const r = compararArticuloOficial(relleno, relleno + apartado)
    expect(r.clase).not.toBe('erratas')
    expect(r.clase).toBe('incompleto')
  })
})
