/**
 * [T-676] `aTexto` convierte el XML de un bloque del BOE en el texto del anexo. Es **la pieza que
 * decide si el anexo queda VERBATIM o destrozado**, y por tanto la única que puede reproducir el
 * defecto que este import vino a reparar: un usuario avisó de que servíamos los anexos del
 * RD 486/1997 «como resumidos» — teníamos uno completo de seis, con el Anexo I en 129 de 17.320
 * caracteres.
 *
 * Los casos salen del XML REAL de la API (`/texto/bloque/aniv`, `/anv`), no de un ejemplo inventado.
 */
const { aTexto } = require('@/scripts/oposiciones/importar-rd486-anexos.cjs')

const envuelve = (cuerpo: string) =>
  `<?xml version="1.0" encoding="utf-8"?><response><status><code>200</code></status><data>` +
  `<bloque id="aniv" tipo="encabezado" titulo="ANEXO IV">` +
  `<version id_norma="BOE-A-1997-8669" fecha_publicacion="19970423">${cuerpo}</version>` +
  `</bloque></data></response>`

describe('[T-676] aTexto — el anexo tiene que salir legible y completo', () => {
  it('conserva los párrafos separados: aplanarlos es la mitad de la queja del usuario', () => {
    // Los anexos son listas numeradas («1. …», «a) …»). Sin separación se leen como un muro de
    // texto, que es exactamente lo que el usuario llamó «resumidos».
    const t = aTexto(envuelve('<p class="parrafo">1. La iluminación deberá adaptarse.</p><p>a) Los riesgos.</p>'))
    expect(t).toBe('1. La iluminación deberá adaptarse.\n\na) Los riesgos.')
  })

  it('decodifica los acentos del BOE, que vienen como entidades', () => {
    // Si esto falla no salta nada: el texto se guarda con «iluminaci&oacute;n» dentro y el
    // opositor lo lee así. Un fallo silencioso, que es el peor.
    const t = aTexto(envuelve('<p>La iluminaci&oacute;n de cada zona ser&aacute; la m&iacute;nima segun el &ordm; se&ntilde;alado.</p>'))
    expect(t).toBe('La iluminación de cada zona será la mínima segun el º señalado.')
    expect(t).not.toMatch(/&[a-z]+;/)
  })

  it('quita la cabecera de la respuesta y se queda SOLO con el contenido del bloque', () => {
    // El XML trae `<response><status>` delante. Colarlo dentro del artículo metería «200 ok» en
    // el temario.
    const t = aTexto(envuelve('<p>Texto del anexo.</p>'))
    expect(t).toBe('Texto del anexo.')
    expect(t).not.toMatch(/200|response|status/)
  })

  it('colapsa espacios sobrantes pero NO junta párrafos', () => {
    const t = aTexto(envuelve('<p>Dos    espacios\ty tabulador.</p><p>Segundo.</p>'))
    expect(t).toBe('Dos espacios y tabulador.\n\nSegundo.')
  })

  it('descarta los párrafos vacíos en vez de dejar huecos', () => {
    expect(aTexto(envuelve('<p>Uno.</p><p></p><p>  </p><p>Dos.</p>'))).toBe('Uno.\n\nDos.')
  })

  it('resuelve &amp; al final, para no romper una entidad ya decodificada', () => {
    // `&amp;oacute;` tiene que acabar en «ó», no en «&oacute;»: si `&amp;` se resolviera primero
    // quedaría el literal a medias. El orden importa y por eso se fija aquí.
    expect(aTexto(envuelve('<p>Uno &amp; dos.</p>'))).toBe('Uno & dos.')
  })

  it('un bloque sin párrafos no revienta: devuelve cadena vacía', () => {
    // El script comprueba después la longitud y aborta; lo que no puede es lanzar aquí y dejar
    // media ley importada.
    expect(aTexto(envuelve(''))).toBe('')
  })
})
