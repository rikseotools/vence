/**
 * Núcleo de lectura de bloques consolidados del BOE (T-726).
 *
 * Lo que se prueba aquí es lo que decide si un anexo queda VERBATIM o destrozado — que es el
 * defecto que un usuario nos encontró dos días seguidos (RD 486/1997 y RD 485/1997).
 */
const {
  aTexto, indiceBloques, clasificarBloque, tituloYCuerpo,
} = require('../../../lib/boe/bloquesConsolidados.cjs')

const envolver = (interior) => `<?xml version="1.0" encoding="utf-8"?>
<response><status><code>200</code></status><data>
  <bloque id="ani" tipo="encabezado" titulo="ANEXO I">
    <version id_norma="BOE-A-1997-8668" fecha_publicacion="19970423">${interior}</version>
  </bloque>
</data></response>`

describe('aTexto', () => {
  it('conserva un párrafo por línea doble (los anexos son listas: aplanarlos los vuelve ilegibles)', () => {
    const t = aTexto(envolver('<p class="anexo_num">ANEXO I</p><p class="parrafo">a) Uno.</p><p class="parrafo">b) Dos.</p>'))
    expect(t).toBe('ANEXO I\n\na) Uno.\n\nb) Dos.')
  })

  it('descarta la cabecera XML y el envoltorio, no solo las etiquetas', () => {
    expect(aTexto(envolver('<p>Texto.</p>'))).toBe('Texto.')
  })

  it('traduce las entidades que el BOE usa de verdad', () => {
    const t = aTexto(envolver('<p>Se&ntilde;alizaci&oacute;n a 20 &deg;C, 1&ordm; p&aacute;rrafo</p>'))
    expect(t).toBe('Señalización a 20 °C, 1º párrafo')
  })

  it('NO desescapa dos veces: `&amp;aacute;` es el texto literal, no una á', () => {
    expect(aTexto(envolver('<p>Regla &amp;aacute; y R&amp;D</p>'))).toBe('Regla &aacute; y R&D')
  })

  it('colapsa espacios sobrantes pero no toca los saltos de párrafo', () => {
    expect(aTexto(envolver('<p>  dos    espacios  </p><p>otro</p>'))).toBe('dos espacios\n\notro')
  })

  it('ignora los párrafos vacíos en vez de dejar huecos dobles', () => {
    expect(aTexto(envolver('<p>uno</p><p>  </p><p>dos</p>'))).toBe('uno\n\ndos')
  })
})

describe('indiceBloques', () => {
  const indice = `<data>
    <bloque id="preambulo" tipo="preambulo"></bloque>
    <bloque id="a1" tipo="precepto" titulo="Artículo 1"></bloque>
    <bloque id="ddunica" tipo="precepto" titulo="Disposición derogatoria única"></bloque>
    <bloque id="anvii" tipo="encabezado" titulo="ANEXO VII"></bloque>
  </data>`

  it('devuelve los bloques en el orden del BOE, con tipo y título', () => {
    const b = indiceBloques(indice)
    expect(b.map((x) => x.id)).toEqual(['preambulo', 'a1', 'ddunica', 'anvii'])
    expect(b[3]).toEqual({ id: 'anvii', tipo: 'encabezado', titulo: 'ANEXO VII' })
  })

  it('tolera bloques sin atributo titulo (el preámbulo no lo trae)', () => {
    expect(indiceBloques(indice)[0].titulo).toBe('')
  })
})

describe('clasificarBloque', () => {
  it('numera los anexos con la convención que la BD ya usa (AI, AII…)', () => {
    expect(clasificarBloque({ tipo: 'encabezado', titulo: 'ANEXO I' }))
      .toEqual({ clase: 'anexo', articleNumber: 'AI', romano: 'I' })
    expect(clasificarBloque({ tipo: 'encabezado', titulo: 'ANEXO VII' }).articleNumber).toBe('AVII')
  })

  it('nombra las disposiciones únicas y las ordinales como están en BD', () => {
    expect(clasificarBloque({ tipo: 'precepto', titulo: 'Disposición derogatoria única' }).articleNumber).toBe('DDunica')
    expect(clasificarBloque({ tipo: 'precepto', titulo: 'Disposición transitoria única' }).articleNumber).toBe('DTunica')
    expect(clasificarBloque({ tipo: 'precepto', titulo: 'Disposición final primera' }).articleNumber).toBe('DF1')
    expect(clasificarBloque({ tipo: 'precepto', titulo: 'Disposición final segunda' }).articleNumber).toBe('DF2')
    expect(clasificarBloque({ tipo: 'precepto', titulo: 'Disposición adicional tercera' }).articleNumber).toBe('DA3')
  })

  it('IGNORA el articulado y el preámbulo: eso ya lo trae el extractor normal', () => {
    expect(clasificarBloque({ tipo: 'precepto', titulo: 'Artículo 5' })).toBeNull()
    expect(clasificarBloque({ tipo: 'preambulo', titulo: '' })).toBeNull()
    expect(clasificarBloque({ tipo: 'firma', titulo: '' })).toBeNull()
  })

  it('no inventa numeración para lo que no reconoce (mejor null que un article_number falso)', () => {
    expect(clasificarBloque({ tipo: 'encabezado', titulo: 'ANEXO XV' })).toBeNull()
    expect(clasificarBloque({ tipo: 'precepto', titulo: 'Disposición final vigésima' })).toBeNull()
    expect(clasificarBloque({ tipo: 'encabezado', titulo: 'ANEXO I bis' })).toBeNull()
  })
})

describe('tituloYCuerpo', () => {
  it('en un anexo, el subtítulo va al title y la cabecera SE QUEDA en el contenido', () => {
    const texto = 'ANEXO II\n\nColores de seguridad\n\n1. Los colores…'
    expect(tituloYCuerpo(texto, 'anexo', 'II')).toEqual({
      title: 'Anexo II — Colores de seguridad',
      content: texto,
    })
  })

  it('en una disposición, la rúbrica va al title y NO se repite en el contenido', () => {
    const texto = 'Disposición derogatoria única. Derogación normativa singular.\n\nQueda derogado el RD 1403/1986.'
    expect(tituloYCuerpo(texto, 'disposicion')).toEqual({
      title: 'Derogación normativa singular',
      content: 'Queda derogado el RD 1403/1986.',
    })
  })

  it('una disposición sin rúbrica no pierde su contenido', () => {
    const r = tituloYCuerpo('Disposición final segunda\n\nEntrará en vigor…', 'disposicion')
    expect(r.title).toBe('Disposición final segunda')
    expect(r.content).toBe('Entrará en vigor…')
  })

  it('un anexo sin subtítulo se queda con su nombre, no con la primera frase del cuerpo', () => {
    expect(tituloYCuerpo('ANEXO I', 'anexo', 'I').title).toBe('Anexo I')
  })
})

describe('tablas', () => {
  const conTabla = (tabla) => `<data><bloque id="anii" tipo="encabezado" titulo="ANEXO II">
    <version id_norma="X"><p class="anexo_num">ANEXO II</p>${tabla}<p class="parrafo">Después.</p></version>
  </bloque></data>`

  const TABLA_BOE = `<table class="tabla">
    <tr><td><p class="cabeza_tabla">Color</p></td><td><p class="cabeza_tabla">Significado</p></td></tr>
    <tr><td rowspan="2"><p>Rojo.</p></td><td><p>Se&ntilde;al de prohibici&oacute;n.</p></td></tr>
    <tr><td><p>Peligro-alarma.</p></td></tr>
  </table>`

  it('convierte la tabla a Markdown en vez de aplanarla (el render sí pinta `| … |`)', () => {
    const t = aTexto(conTabla(TABLA_BOE))
    expect(t).toContain('| Color | Significado |')
    expect(t).toContain('| --- | --- |')
    expect(t).toContain('| Rojo. | Señal de prohibición. |')
  })

  it('el rowspan REPITE el valor: una celda vacía se leería como «sin valor»', () => {
    expect(aTexto(conTabla(TABLA_BOE))).toContain('| Rojo. | Peligro-alarma. |')
  })

  it('la tabla no se come el texto que va antes ni después', () => {
    const t = aTexto(conTabla(TABLA_BOE))
    expect(t.startsWith('ANEXO II')).toBe(true)
    expect(t.trimEnd().endsWith('Después.')).toBe(true)
  })

  it('no deja marcadores internos ni bytes NUL en el texto (irían tal cual a Postgres)', () => {
    const t = aTexto(conTabla(TABLA_BOE))
    expect(t.includes('\u0000')).toBe(false)
    expect(t).not.toMatch(/TABLA\d/)
  })

  it('una barra dentro de una celda no rompe la rejilla', () => {
    const t = aTexto(conTabla('<table><tr><td><p>a|b</p></td><td><p>c</p></td></tr></table>'))
    expect(t).toContain('| a\\|b | c |')
  })
})
