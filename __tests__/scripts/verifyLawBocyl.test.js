// Fija los dos puntos propios del verificador BOCyL (scripts/verify-law-bocyl.cjs):
//  1. la URL ELI es una FICHA, no el texto → hay que resolverla a /dof/spa/html;
//  2. la comparación de cuerpos es insensible a puntuación/espaciado, para que un punto
//     o un espacio de más no hundan la similitud de un artículo por lo demás idéntico.
const { textUrl, bodyOf, depunct } = require('../../scripts/verify-law-bocyl.cjs')

describe('textUrl — resolver la ficha ELI al texto', () => {
  test('la ELI base gana el sufijo /dof/spa/html', () => {
    expect(textUrl('https://bocyl.jcyl.es/eli/es-cl/d/2021/05/20/13/'))
      .toBe('https://bocyl.jcyl.es/eli/es-cl/d/2021/05/20/13/dof/spa/html')
  })
  test('una ELI sin barra final también', () => {
    expect(textUrl('https://bocyl.jcyl.es/eli/es-cl/d/2013/02/14/7'))
      .toBe('https://bocyl.jcyl.es/eli/es-cl/d/2013/02/14/7/dof/spa/html')
  })
  test('una URL que ya apunta al texto se deja igual', () => {
    const u = 'https://bocyl.jcyl.es/eli/es-cl/d/2021/05/20/13/dof/spa/html'
    expect(textUrl(u)).toBe(u)
  })
  test('una URL no-ELI (boletines/.do) se deja igual', () => {
    const u = 'https://bocyl.jcyl.es/boletines/2015/09/14/html/BOCYL-D-14092015-8.do'
    expect(textUrl(u)).toBe(u)
  })
})

describe('bodyOf — quitar cabecera y título conocido', () => {
  test('quita "Artículo N." y el título de la BD, dejando el cuerpo', () => {
    expect(bodyOf('Artículo 3. Principios. 1. La asistencia presencial…', '3', 'Principios'))
      .toBe('1. La asistencia presencial…')
  })
  test('si el content ya viene sin cabecera, lo deja igual', () => {
    expect(bodyOf('1. La asistencia presencial…', '3', 'Principios'))
      .toBe('1. La asistencia presencial…')
  })
})

describe('depunct — comparación insensible a puntuación', () => {
  test('"a)La" y "a) La" quedan iguales', () => {
    expect(depunct('a)La Administración')).toBe(depunct('a) La Administración'))
  })
  test('un punto de más no cambia el texto normalizado', () => {
    expect(depunct('aplicación El presente')).toBe(depunct('aplicación. El presente'))
  })
})
