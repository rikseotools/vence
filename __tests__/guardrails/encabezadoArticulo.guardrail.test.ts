/**
 * Guardarraíl: ninguna vista de temario puede volver a colgar el encabezado de `article.title`.
 *
 * POR QUÉ (T-596, 05/08/2026). `TopicContentView.tsx` está copiado **una vez por oposición (131
 * copias, todas con distinto md5)** y las 131 tenían la misma línea:
 *
 *     {article.title && <h3 …>{article.title}</h3>}
 *
 * Con `title` a NULL — el estado de **13.952 artículos activos, el 23% del banco** — la tarjeta se
 * servía muda: número, botón «Hacer test» y ni una línea de texto, aunque el artículo tuviera su
 * contenido entero guardado. Lo destapó un usuario premium, no un detector.
 *
 * Con 131 copias divergentes, la regresión no es hipotética: basta con que alguien cree la oposición
 * 132 copiando una vista vieja. Este test mira TODAS las copias, así que la nueva nace vigilada.
 */
import { readFileSync } from 'fs'
import { join } from 'path'
// [T-611] La lista va en UN sitio: eran 131 y ahora es el componente compartido (+ las que
// conservan diseño propio). Con el glob de antes, este guardarraíl habría seguido en verde
// mirando un solo fichero residual.
import { vistasDeTemario, VISTA_COMPARTIDA } from '../helpers/vistasDeTemario'

const RAIZ = process.cwd()

describe('TopicContentView — el encabezado del artículo no depende de `title`', () => {
  const vistas = vistasDeTemario().map((v) => join(RAIZ, v))

  it('hay vistas que revisar (si esto falla, el propio guardarraíl se ha quedado ciego)', () => {
    expect(vistas.length).toBeGreaterThan(0)
    expect(vistas).toContain(join(RAIZ, VISTA_COMPARTIDA))
  })

  it.each(vistas.map((v) => [v.replace(`${RAIZ}/`, ''), v]))(
    '%s no condiciona el encabezado a article.title',
    (_rel, abs) => {
      const src = readFileSync(abs as string, 'utf8')
      // El patrón exacto que servía tarjetas mudas.
      expect(src).not.toMatch(/\{article\.title &&/)
      // Y usa el criterio ÚNICO, compartido con el detector de salud.
      expect(src).toContain('encabezadoArticulo(article)')
    },
  )

  it('el criterio vive en UN solo sitio y no se ha copiado dentro de las vistas', () => {
    for (const v of vistas) {
      const src = readFileSync(v, 'utf8')
      expect(src).toContain("lib/teoria/encabezadoArticulo")
      // Señal de haber reimplementado el extracto a mano en la vista.
      expect(src).not.toMatch(/content[^\n]{0,20}\.slice\(0,\s*1[0-9]{2}\)/)
    }
  })
})
