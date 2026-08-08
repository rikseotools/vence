// GUARDARRAÍL: la función de filtrar por artículos tiene que poder ENCONTRARSE.
//
// ## De dónde sale (30/07/2026)
//
// Manolo García pidió poder hacer tests de la parte de una ley que lleva estudiada: «si una
// ley tiene 100 artículos y llevas la mitad, poder señalar esos 50». La función existe desde
// hace meses. Se le indicó que buscara el apartado **«Filtrar por Artículos»** y contestó:
// *«sigo sin verlo… estoy estudiando la LO 3/2007 y no veo eso de Filtrar por Artículos por
// ningún lado»*.
//
// Al verificarlo en la pantalla real, las dos partes teníamos razón:
//   - En `/leyes/<ley>` (una sola ley) el rótulo SÍ dice «📄 Filtrar por Artículos».
//   - Entrando por un TEMA de su oposición —que es por donde estudia— hay varias leyes, y
//     entonces el rótulo decía solo «📖 Filtrar por Leyes». La palabra «artículos» no
//     aparecía en la pantalla, así que buscarla era imposible: la función estaba a dos
//     clics, detrás de un nombre que hablaba de otra cosa.
//
// Y el texto de ayuda de dentro remataba: citaba un botón llamado «🔧 Filtrar artículos»
// cuando el botón real dice «🔧 Artículos».
//
// Es el mismo patrón que el 405 y el `data.url` de esta misma semana: **el dato/función
// existe y lo que lo nombra no coincide**. Por eso esto se ata con un test y no con buena
// memoria: los rótulos los toca cualquiera, y nadie relee un hilo de feedback de julio.
import { readFileSync } from 'fs'
import { join } from 'path'

const src = readFileSync(join(process.cwd(), 'components/TestConfigurator.tsx'), 'utf8')

// [T-367, 06/08/2026] Segundo escalón del mismo defecto: el rótulo YA nombraba los
// artículos (arreglo de arriba), pero no había NINGÚN camino desde el temario —que es
// «por donde entra la gente» (cita literal del compromiso escrito a un usuario)— hasta
// esa pantalla. El único CTA de ley del temario (`LawTestCTA`) siempre lleva
// `selected_articles` y por tanto siempre auto-arranca el test, saltándose el filtro. Y el
// botón «📚 Filtrar por Títulos» de /teoria (que filtra la LECTURA) competía por el mismo
// nombre que «📄 Filtrar por Artículos» (que filtra el TEST) — un usuario los confundió.
const lawTestCtaSrc = readFileSync(join(process.cwd(), 'components/temario/LawTestCTA.tsx'), 'utf8')
const lawTestConfiguratorSrc = readFileSync(
  join(process.cwd(), 'app/leyes/[law]/LawTestConfigurator.tsx'),
  'utf8',
)
const lawArticlesClientSrc = readFileSync(
  join(process.cwd(), 'app/teoria/[law]/LawArticlesClient.tsx'),
  'utf8',
)

describe('el filtro por artículos es descubrible', () => {
  it('el rótulo del bloque nombra los ARTÍCULOS haya una ley o varias', () => {
    // La línea del encabezado, con sus dos ramas.
    const linea = src.split('\n').find((l) => l.includes("'📄 Filtrar por Artículos'"))
    expect(linea).toBeDefined()
    // Rama de varias leyes (modo tema): tiene que nombrarlos también, o quien busca
    // «artículos» no encuentra nada en pantalla.
    expect(linea).toMatch(/Filtrar por Leyes y Artículos/)
  })

  it('el texto de ayuda cita el botón por el nombre EXACTO que se lee en el botón', () => {
    // El botón real.
    expect(src).toMatch(/<span>Artículos<\/span>/)
    // La ayuda no puede inventarse otro nombre («Filtrar artículos») que no existe.
    expect(src).not.toMatch(/botón "🔧 Filtrar artículos"/)
    expect(src).toMatch(/con el botón "🔧 Artículos"/)
  })

  it('la ayuda también menciona Títulos, que es el atajo para ir por bloques', () => {
    expect(src).toMatch(/📚 Títulos/)
  })

  it('los botones de acotar salen con la ley marcada, y las leyes arrancan marcadas', () => {
    // Si `selectedLaws` arrancara vacío, el usuario desplegaría el filtro y no vería ningún
    // botón: exactamente el «no lo veo» que motivó este test.
    expect(src).toMatch(/const initialSelectedLaws = new Set\(lawsData\.map\(law => law\.law_short_name\)\)/)
    expect(src).toMatch(/\{isSelected && \(/)
  })

  // [T-367]
  it('hay un camino DESDE EL TEMARIO hasta el filtro, distinto del que auto-arranca el test', () => {
    // El CTA de siempre ("Hacer test de {ley}") sigue existiendo y sigue acotando al tema.
    expect(lawTestCtaSrc).toMatch(/buildLawTestLink/)
    // El nuevo: NO lleva selected_articles → no auto-arranca, aterriza en el configurador.
    expect(lawTestCtaSrc).toMatch(/buildLawFilterLink/)
    expect(lawTestCtaSrc).toMatch(/Elegir qué artículos/)
  })

  it('el enlace nuevo abre el panel YA desplegado, no otra vez plegado por defecto', () => {
    expect(lawTestConfiguratorSrc).toMatch(/abrir_filtro/)
    expect(lawTestConfiguratorSrc).toMatch(/initialShowLawsFilter=\{abrirFiltroParam\}/)
    expect(src).toMatch(/showLawsFilter, setShowLawsFilter\] = useState\(initialShowLawsFilter/)
  })

  it('el botón que filtra la LECTURA (temario) ya no compite por el nombre "Filtrar por Títulos" con el que filtra el TEST', () => {
    // Antes decían lo mismo salvo el emoji (📚 vs 📄) — el caso real que confundió a un
    // usuario, que pulsó "Aplicar filtro" en /teoria creyendo que configuraba el test.
    expect(lawArticlesClientSrc).not.toMatch(/>Filtrar por Títulos</)
    expect(lawArticlesClientSrc).toMatch(/Ver por Títulos/)
  })
})
