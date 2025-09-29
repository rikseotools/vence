// app/auxiliar-administrativo-estado/temario/tema-1/Tema1Interactive.js
'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'

export default function Tema1Interactive() {
  const [showModal, setShowModal] = useState(false)
  const [activeSection, setActiveSection] = useState('preliminar') // Estado para navegación móvil
  const [showMobileMenu, setShowMobileMenu] = useState(false) // Estado para menú móvil

  useEffect(() => {
    // Auto-abrir modal solo si viene de enlace directo
    const params = new URLSearchParams(window.location.search)
    if (params.get('modal') === 'open') {
      setShowModal(true)
    }
  }, [])

  const handleCloseModal = () => {
    setShowModal(false)
    setActiveSection('preliminar')
    setShowMobileMenu(false)
  }

  // Función para navegar entre secciones en móvil
  const navigateToSection = (section) => {
    setActiveSection(section)
    setShowMobileMenu(false)
  }



  // Contenido por secciones para móvil
  const sections = {
    preliminar: {
      title: "📖 TÍTULO PRELIMINAR",
      content: (
        <div className="space-y-6">
          <article className="bg-blue-50 border-l-4 border-blue-400 p-4 rounded-lg">
            <h3 className="text-lg font-bold text-blue-800 mb-3">ARTÍCULO 1. ESTADO SOCIAL Y DEMOCRÁTICO</h3>
            <div className="space-y-3">
              <div className="bg-white p-3 rounded">
                <p className="text-gray-700 leading-relaxed mb-2">
                  <strong>1.</strong> España se constituye en un <strong>Estado social y democrático de Derecho</strong>, 
                  que propugna como valores superiores de su ordenamiento jurídico <strong>la libertad, la justicia, 
                  la igualdad y el pluralismo político</strong>.
                </p>
              </div>
              <div className="bg-white p-3 rounded">
                <p className="text-gray-700 leading-relaxed mb-2">
                  <strong>2.</strong> La <strong>soberanía nacional reside en el pueblo español</strong>, del que emanan 
                  los poderes del Estado.
                </p>
              </div>
              <div className="bg-white p-3 rounded">
                <p className="text-gray-700 leading-relaxed">
                  <strong>3.</strong> La forma política del Estado español es <strong>la Monarquía parlamentaria</strong>.
                </p>
              </div>
            </div>
            <div className="text-sm text-blue-700 bg-blue-100 p-3 rounded mt-3">
              <strong>🎯 Clave examen:</strong> 4 valores superiores + soberanía popular + monarquía parlamentaria
            </div>
          </article>

          <article className="bg-green-50 border-l-4 border-green-400 p-4 rounded-lg">
            <h3 className="text-lg font-bold text-green-800 mb-3">ARTÍCULO 2. UNIDAD E INDIVISIBILIDAD</h3>
            <div className="bg-white p-3 rounded">
              <p className="text-gray-700 leading-relaxed">
                La Constitución se fundamenta en la <strong>indisoluble unidad de la Nación española</strong>, 
                patria común e indivisible de todos los españoles, y reconoce y garantiza el derecho a la 
                <strong>autonomía</strong> de las nacionalidades y regiones que la integran y la 
                <strong>solidaridad</strong> entre todas ellas.
              </p>
            </div>
            <div className="text-sm text-green-700 bg-green-100 p-3 rounded mt-3">
              <strong>🎯 Clave examen:</strong> Unidad + autonomía + solidaridad (equilibrio territorial)
            </div>
          </article>

          <article className="bg-purple-50 border-l-4 border-purple-400 p-4 rounded-lg">
            <h3 className="text-lg font-bold text-purple-800 mb-3">ARTÍCULO 9. PRINCIPIOS GENERALES</h3>
            <div className="space-y-3">
              <div className="bg-white p-3 rounded">
                <p className="text-gray-700 mb-2"><strong>1.</strong> Los ciudadanos y los poderes públicos están sujetos a la Constitución y al resto del ordenamiento jurídico.</p>
              </div>
              <div className="bg-white p-3 rounded">
                <p className="text-gray-700 mb-2"><strong>2.</strong> Corresponde a los poderes públicos promover las condiciones para que la libertad y la igualdad del individuo y de los grupos en que se integra sean reales y efectivas...</p>
              </div>
              <div className="bg-white p-3 rounded">
                <p className="text-gray-700"><strong>3.</strong> La Constitución garantiza el principio de <strong>legalidad, la jerarquía normativa, la publicidad de las normas, la irretroactividad de las disposiciones sancionadoras no favorables o restrictivas de derechos individuales, la seguridad jurídica, la responsabilidad y la interdicción de la arbitrariedad</strong> de los poderes públicos.</p>
              </div>
            </div>
            <div className="text-sm text-purple-700 bg-purple-100 p-3 rounded mt-3">
              <strong>🎯 Clave examen:</strong> Art. 9.3 - 7 principios fundamentales del Estado de Derecho
            </div>
          </article>
        </div>
      )
    },
    derechos: {
      title: "⚖️ TÍTULO I: DERECHOS FUNDAMENTALES",
      content: (
        <div className="space-y-6">
          <article className="bg-red-50 border-l-4 border-red-400 p-4 rounded-lg">
            <h3 className="text-lg font-bold text-red-800 mb-3">ARTÍCULO 14. IGUALDAD</h3>
            <div className="bg-white p-3 rounded">
              <p className="text-gray-700 leading-relaxed">
                Los españoles son <strong>iguales ante la ley</strong>, sin que pueda prevalecer discriminación alguna 
                por razón de <strong>nacimiento, raza, sexo, religión, opinión o cualquier otra condición 
                o circunstancia personal o social</strong>.
              </p>
            </div>
            <div className="text-sm text-red-700 bg-red-100 p-3 rounded mt-3">
              <strong>🎯 Clave examen:</strong> Igualdad ante la ley + prohibición discriminación (7 causas)
            </div>
          </article>

          <article className="bg-orange-50 border-l-4 border-orange-400 p-4 rounded-lg">
            <h3 className="text-lg font-bold text-orange-800 mb-3">ARTÍCULO 15. DERECHO A LA VIDA</h3>
            <div className="bg-white p-3 rounded">
              <p className="text-gray-700 leading-relaxed">
                Todos tienen derecho a <strong>la vida y a la integridad física y moral</strong>, 
                sin que, en ningún caso, puedan ser sometidos a <strong>tortura</strong> ni a penas 
                o tratos inhumanos o degradantes. Queda <strong>abolida la pena de muerte</strong>, 
                salvo lo que puedan disponer las leyes penales militares para tiempos de guerra.
              </p>
            </div>
            <div className="text-sm text-orange-700 bg-orange-100 p-3 rounded mt-3">
              <strong>🎯 Clave examen:</strong> Vida + integridad + abolición pena muerte (salvo guerra)
            </div>
          </article>

          <article className="bg-teal-50 border-l-4 border-teal-400 p-4 rounded-lg">
            <h3 className="text-lg font-bold text-teal-800 mb-3">SECCIÓN 1ª: DERECHOS FUNDAMENTALES Y LIBERTADES PÚBLICAS</h3>
            <div className="grid md:grid-cols-2 gap-4">
              <div className="bg-white p-3 rounded">
                <h4 className="font-semibold text-teal-700 mb-2">Arts. 15-21: Derechos de la persona</h4>
                <ul className="text-sm text-gray-600 space-y-1">
                  <li>• Art. 15 - Vida e integridad</li>
                  <li>• Art. 16 - Libertad ideológica</li>
                  <li>• Art. 17 - Libertad personal</li>
                  <li>• Art. 18 - Honor, intimidad e imagen</li>
                  <li>• Art. 19 - Residencia y circulación</li>
                  <li>• Art. 20 - Expresión e información</li>
                  <li>• Art. 21 - Reunión y manifestación</li>
                </ul>
              </div>
              <div className="bg-white p-3 rounded">
                <h4 className="font-semibold text-teal-700 mb-2">Arts. 22-29: Derechos sociales</h4>
                <ul className="text-sm text-gray-600 space-y-1">
                  <li>• Art. 22 - Asociación</li>
                  <li>• Art. 23 - Participación política</li>
                  <li>• Art. 24 - Tutela judicial efectiva</li>
                  <li>• Art. 25 - Principio de legalidad penal</li>
                  <li>• Art. 26 - Tribunales de honor</li>
                  <li>• Art. 27 - Educación</li>
                  <li>• Art. 28 - Sindicación y huelga</li>
                  <li>• Art. 29 - Petición</li>
                </ul>
              </div>
            </div>
            <div className="text-sm text-teal-700 bg-teal-100 p-3 rounded mt-3">
              <strong>🎯 Clave examen:</strong> Sección 1ª (Arts. 15-29) = Derechos fundamentales con máxima protección
            </div>
          </article>
        </div>
      )
    },
    corona: {
      title: "👑 TÍTULO II: LA CORONA",
      content: (
        <div className="space-y-6">
          <article className="bg-purple-50 border-l-4 border-purple-400 p-4 rounded-lg">
            <h3 className="text-lg font-bold text-purple-800 mb-3">ARTÍCULO 56. EL REY</h3>
            <div className="space-y-3">
              <div className="bg-white p-3 rounded">
                <p className="text-gray-700 mb-2">
                  <strong>1.</strong> El Rey es el <strong>Jefe del Estado</strong>, símbolo de su unidad y permanencia, 
                  <strong>arbitra y modera</strong> el funcionamiento regular de las instituciones, 
                  <strong>asume la más alta representación</strong> del Estado español en las relaciones internacionales, 
                  especialmente con las naciones de su comunidad histórica, y <strong>ejerce las funciones</strong> 
                  que le atribuyen expresamente la Constitución y las leyes.
                </p>
              </div>
              <div className="bg-white p-3 rounded">
                <p className="text-gray-700">
                  <strong>2.</strong> Su título es el de <strong>Rey de España</strong> y podrá utilizar los demás 
                  que correspondan a la Corona.
                </p>
              </div>
            </div>
            <div className="text-sm text-purple-700 bg-purple-100 p-3 rounded mt-3">
              <strong>🎯 Clave examen:</strong> Jefe Estado + símbolo + árbitro y moderador + representación
            </div>
          </article>

          <article className="bg-pink-50 border-l-4 border-pink-400 p-4 rounded-lg">
            <h3 className="text-lg font-bold text-pink-800 mb-3">ARTÍCULO 57. SUCESIÓN</h3>
            <div className="bg-white p-3 rounded">
              <p className="text-gray-700 leading-relaxed mb-3">
                <strong>1.</strong> La Corona de España es <strong>hereditaria en los sucesores de S.M. Juan Carlos I de Borbón</strong>, 
                legítimo heredero de la dinastía histórica. La sucesión en el trono seguirá el orden regular de 
                <strong>primogenitura y representación</strong>, siendo preferida siempre la línea anterior a las posteriores; 
                en la misma línea, el grado más próximo al más remoto; en el mismo grado, el <strong>varón a la mujer</strong>, 
                y en el mismo sexo, la persona de más edad a la de menos.
              </p>
            </div>
            <div className="text-sm text-pink-700 bg-pink-100 p-3 rounded mt-3">
              <strong>🎯 Clave examen:</strong> Hereditaria + primogenitura + representación + preferencia masculina
            </div>
          </article>

          <article className="bg-indigo-50 border-l-4 border-indigo-400 p-4 rounded-lg">
            <h3 className="text-lg font-bold text-indigo-800 mb-3">ARTÍCULO 62. FUNCIONES DEL REY</h3>
            <div className="grid md:grid-cols-2 gap-4">
              <div className="bg-white p-3 rounded">
                <h4 className="font-semibold text-indigo-700 mb-2">Funciones principales:</h4>
                <ul className="text-sm text-gray-600 space-y-1">
                  <li>• a) Sancionar y promulgar las leyes</li>
                  <li>• b) Convocar y disolver las Cortes</li>
                  <li>• c) Convocar elecciones</li>
                  <li>• d) Proponer candidato a Presidente</li>
                  <li>• e) Nombrar y separar miembros Gobierno</li>
                </ul>
              </div>
              <div className="bg-white p-3 rounded">
                <h4 className="font-semibold text-indigo-700 mb-2">Otras funciones:</h4>
                <ul className="text-sm text-gray-600 space-y-1">
                  <li>• f) Expedir decretos acordados en Consejo</li>
                  <li>• g) Conferir empleos civiles y militares</li>
                  <li>• h) Conceder honores y distinciones</li>
                  <li>• i) Ser informado de asuntos de Estado</li>
                  <li>• j) Mando supremo de las Fuerzas Armadas</li>
                </ul>
              </div>
            </div>
            <div className="text-sm text-indigo-700 bg-indigo-100 p-3 rounded mt-3">
              <strong>🎯 Clave examen:</strong> 10 funciones (letras a-j) - Todas con refrendo ministerial
            </div>
          </article>
        </div>
      )
    },
    cortes: {
      title: "🏛️ TÍTULO III: LAS CORTES GENERALES",
      content: (
        <div className="space-y-6">
          <article className="bg-red-50 border-l-4 border-red-400 p-4 rounded-lg">
            <h3 className="text-lg font-bold text-red-800 mb-3">ARTÍCULO 66. LAS CORTES GENERALES</h3>
            <div className="space-y-3">
              <div className="bg-white p-3 rounded">
                <p className="text-gray-700 mb-2">
                  <strong>1.</strong> Las Cortes Generales representan al <strong>pueblo español</strong> y están formadas 
                  por el <strong>Congreso de los Diputados y el Senado</strong>.
                </p>
              </div>
              <div className="bg-white p-3 rounded">
                <p className="text-gray-700">
                  <strong>2.</strong> Las Cortes Generales ejercen la <strong>potestad legislativa del Estado</strong>, 
                  aprueban sus Presupuestos, controlan la acción del Gobierno y tienen las demás competencias 
                  que les atribuya la Constitución.
                </p>
              </div>
            </div>
            <div className="text-sm text-red-700 bg-red-100 p-3 rounded mt-3">
              <strong>🎯 Clave examen:</strong> Representan pueblo + bicameral + potestad legislativa + presupuestos + control
            </div>
          </article>

          <article className="bg-blue-50 border-l-4 border-blue-400 p-4 rounded-lg">
            <h3 className="text-lg font-bold text-blue-800 mb-3">COMPOSICIÓN DE LAS CORTES</h3>
            <div className="grid md:grid-cols-2 gap-4">
              <div className="bg-white p-3 rounded">
                <h4 className="font-semibold text-blue-700 mb-2">🏛️ Congreso de los Diputados</h4>
                <ul className="text-sm text-gray-600 space-y-2">
                  <li>• <strong>Mínimo 300, máximo 400 Diputados</strong></li>
                  <li>• <strong>Mandato 4 años</strong></li>
                  <li>• <strong>Sufragio universal, libre, igual, directo y secreto</strong></li>
                  <li>• <strong>Sistema proporcional</strong></li>
                  <li>• <strong>Circunscripción provincial</strong></li>
                  <li>• <strong>Mínimo 2 Diputados por provincia</strong></li>
                </ul>
              </div>
              <div className="bg-white p-3 rounded">
                <h4 className="font-semibold text-blue-700 mb-2">🏛️ Senado</h4>
                <ul className="text-sm text-gray-600 space-y-2">
                  <li>• <strong>Cámara de representación territorial</strong></li>
                  <li>• <strong>4 Senadores por provincia</strong></li>
                  <li>• <strong>3 por cada isla mayor</strong> (Canarias/Baleares)</li>
                  <li>• <strong>1 por cada isla menor/agrupación</strong></li>
                  <li>• <strong>1 Senador por Ceuta y Melilla</strong></li>
                  <li>• <strong>CCAA designan 1 + 1 por millón</strong></li>
                </ul>
              </div>
            </div>
            <div className="text-sm text-blue-700 bg-blue-100 p-3 rounded mt-3">
              <strong>🎯 Clave examen:</strong> Congreso (300-400) + Senado (territorial) + mandato 4 años
            </div>
          </article>
        </div>
      )
    },
    gobierno: {
      title: "🏢 TÍTULO IV: GOBIERNO Y ADMINISTRACIÓN",
      content: (
        <div className="space-y-6">
          <article className="bg-orange-50 border-l-4 border-orange-400 p-4 rounded-lg">
            <h3 className="text-lg font-bold text-orange-800 mb-3">ARTÍCULO 97. EL GOBIERNO</h3>
            <div className="bg-white p-3 rounded">
              <p className="text-gray-700 leading-relaxed">
                El Gobierno <strong>dirige la política interior y exterior</strong>, la <strong>administración civil y militar</strong> 
                y la <strong>defensa del Estado</strong>. Ejerce la <strong>función ejecutiva</strong> y la <strong>potestad reglamentaria</strong> 
                de acuerdo con la Constitución y las leyes.
              </p>
            </div>
            <div className="text-sm text-orange-700 bg-orange-100 p-3 rounded mt-3">
              <strong>🎯 Clave examen:</strong> 5 funciones: política + administración + defensa + ejecutiva + reglamentaria
            </div>
          </article>

          <article className="bg-green-50 border-l-4 border-green-400 p-4 rounded-lg">
            <h3 className="text-lg font-bold text-green-800 mb-3">ARTÍCULO 98. COMPOSICIÓN DEL GOBIERNO</h3>
            <div className="space-y-3">
              <div className="bg-white p-3 rounded">
                <p className="text-gray-700 mb-2">
                  <strong>1.</strong> El Gobierno se compone del <strong>Presidente, de los Vicepresidentes, 
                  en su caso, de los Ministros y de los demás miembros</strong> que establezca la ley.
                </p>
              </div>
              <div className="bg-white p-3 rounded">
                <p className="text-gray-700">
                  <strong>2.</strong> El Presidente <strong>dirige la acción del Gobierno</strong> y <strong>coordina las funciones</strong> 
                  de los demás miembros del mismo, sin perjuicio de la competencia y responsabilidad directa 
                  de éstos en su gestión.
                </p>
              </div>
            </div>
            <div className="text-sm text-green-700 bg-green-100 p-3 rounded mt-3">
              <strong>🎯 Clave examen:</strong> Presidente + Vicepresidentes + Ministros + otros miembros
            </div>
          </article>

          <article className="bg-yellow-50 border-l-4 border-yellow-400 p-4 rounded-lg">
            <h3 className="text-lg font-bold text-yellow-800 mb-3">ARTÍCULO 103. ADMINISTRACIÓN PÚBLICA</h3>
            <div className="space-y-3">
              <div className="bg-white p-3 rounded">
                <p className="text-gray-700 mb-2">
                  <strong>1.</strong> La Administración Pública sirve con <strong>objetividad</strong> los intereses generales 
                  y actúa de acuerdo con los principios de <strong>eficacia, jerarquía, descentralización, 
                  desconcentración y coordinación</strong>, con sometimiento pleno a la ley y al Derecho.
                </p>
              </div>
              <div className="bg-white p-3 rounded">
                <p className="text-gray-700">
                  <strong>3.</strong> La ley regulará el <strong>estatuto de los funcionarios públicos</strong>, el acceso 
                  a la función pública de acuerdo con los principios de <strong>mérito y capacidad</strong>, 
                  las peculiaridades del ejercicio de su derecho a sindicación...
                </p>
              </div>
            </div>
            <div className="text-sm text-yellow-700 bg-yellow-100 p-3 rounded mt-3">
              <strong>🎯 Clave examen:</strong> Objetividad + 5 principios + mérito y capacidad
            </div>
          </article>
        </div>
      )
    },
    judicial: {
      title: "⚖️ TÍTULO VI: PODER JUDICIAL",
      content: (
        <div className="space-y-6">
          <article className="bg-teal-50 border-l-4 border-teal-400 p-4 rounded-lg">
            <h3 className="text-lg font-bold text-teal-800 mb-3">ARTÍCULO 117. FUNCIÓN JURISDICCIONAL</h3>
            <div className="space-y-3">
              <div className="bg-white p-3 rounded">
                <p className="text-gray-700 mb-2">
                  <strong>1.</strong> La <strong>justicia emana del pueblo</strong> y se administra en nombre del Rey 
                  por <strong>Jueces y Magistrados</strong> integrantes del poder judicial, independientes, 
                  inamovibles, responsables y sometidos únicamente al <strong>imperio de la ley</strong>.
                </p>
              </div>
              <div className="bg-white p-3 rounded">
                <p className="text-gray-700 mb-2">
                  <strong>3.</strong> El ejercicio de la <strong>potestad jurisdiccional</strong> en todo tipo de procesos, 
                  juzgando y haciendo ejecutar lo juzgado, corresponde <strong>exclusivamente</strong> a los 
                  Juzgados y Tribunales determinados por las leyes...
                </p>
              </div>
            </div>
            <div className="text-sm text-teal-700 bg-teal-100 p-3 rounded mt-3">
              <strong>🎯 Clave examen:</strong> Justicia del pueblo + independientes + imperio ley + exclusividad
            </div>
          </article>

          <article className="bg-cyan-50 border-l-4 border-cyan-400 p-4 rounded-lg">
            <h3 className="text-lg font-bold text-cyan-800 mb-3">ARTÍCULO 122. CGPJ</h3>
            <div className="space-y-3">
              <div className="bg-white p-3 rounded">
                <p className="text-gray-700 mb-2">
                  <strong>2.</strong> El Consejo General del Poder Judicial está integrado por el <strong>Presidente 
                  del Tribunal Supremo</strong>, que lo presidirá, y por <strong>veinte miembros</strong> nombrados por el Rey 
                  por un período de <strong>cinco años</strong>.
                </p>
              </div>
              <div className="bg-white p-3 rounded">
                <p className="text-gray-700">
                  <strong>3.</strong> El Consejo General del Poder Judicial es el <strong>órgano de gobierno</strong> del mismo. 
                  La <strong>ley orgánica</strong> establecerá su estatuto y el régimen de incompatibilidades de sus miembros 
                  y sus funciones, en particular en materia de <strong>nombramientos, ascensos, inspección y régimen disciplinario</strong>.
                </p>
              </div>
            </div>
            <div className="text-sm text-cyan-700 bg-cyan-100 p-3 rounded mt-3">
              <strong>🎯 Clave examen:</strong> 21 miembros (Presidente TS + 20) + 5 años + órgano gobierno
            </div>
          </article>
        </div>
      )
    }
  };

  // Obtener orden de las secciones (después de la definición de sections)
  const sectionOrder = Object.keys(sections)
  const currentIndex = sectionOrder.indexOf(activeSection)
  const previousSection = currentIndex > 0 ? sectionOrder[currentIndex - 1] : null
  const nextSection = currentIndex < sectionOrder.length - 1 ? sectionOrder[currentIndex + 1] : null

  // Función para imprimir todo el contenido
  const handlePrint = () => {
    const printWindow = window.open('', '_blank')
    
    // Contenido específico para impresión de cada sección
    const printContent = {
      preliminar: `
        <div class="article">
          <h3>ARTÍCULO 1. ESTADO SOCIAL Y DEMOCRÁTICO</h3>
          <p><strong>1.</strong> España se constituye en un <strong>Estado social y democrático de Derecho</strong>, que propugna como valores superiores de su ordenamiento jurídico <strong>la libertad, la justicia, la igualdad y el pluralismo político</strong>.</p>
          <p><strong>2.</strong> La <strong>soberanía nacional reside en el pueblo español</strong>, del que emanan los poderes del Estado.</p>
          <p><strong>3.</strong> La forma política del Estado español es <strong>la Monarquía parlamentaria</strong>.</p>
          <div class="key-point"><strong>🎯 Clave examen:</strong> 4 valores superiores + soberanía popular + monarquía parlamentaria</div>
        </div>
        <div class="article">
          <h3>ARTÍCULO 2. UNIDAD E INDIVISIBILIDAD</h3>
          <p>La Constitución se fundamenta en la <strong>indisoluble unidad de la Nación española</strong>, patria común e indivisible de todos los españoles, y reconoce y garantiza el derecho a la <strong>autonomía</strong> de las nacionalidades y regiones que la integran y la <strong>solidaridad</strong> entre todas ellas.</p>
          <div class="key-point"><strong>🎯 Clave examen:</strong> Unidad + autonomía + solidaridad (equilibrio territorial)</div>
        </div>
        <div class="article">
          <h3>ARTÍCULO 9. PRINCIPIOS GENERALES</h3>
          <p><strong>1.</strong> Los ciudadanos y los poderes públicos están sujetos a la Constitución y al resto del ordenamiento jurídico.</p>
          <p><strong>2.</strong> Corresponde a los poderes públicos promover las condiciones para que la libertad y la igualdad del individuo y de los grupos en que se integra sean reales y efectivas...</p>
          <p><strong>3.</strong> La Constitución garantiza el principio de <strong>legalidad, la jerarquía normativa, la publicidad de las normas, la irretroactividad de las disposiciones sancionadoras no favorables o restrictivas de derechos individuales, la seguridad jurídica, la responsabilidad y la interdicción de la arbitrariedad</strong> de los poderes públicos.</p>
          <div class="key-point"><strong>🎯 Clave examen:</strong> Art. 9.3 - 7 principios fundamentales del Estado de Derecho</div>
        </div>
      `,
      derechos: `
        <div class="article">
          <h3>ARTÍCULO 14. IGUALDAD</h3>
          <p>Los españoles son <strong>iguales ante la ley</strong>, sin que pueda prevalecer discriminación alguna por razón de <strong>nacimiento, raza, sexo, religión, opinión o cualquier otra condición o circunstancia personal o social</strong>.</p>
          <div class="key-point"><strong>🎯 Clave examen:</strong> Igualdad ante la ley + prohibición discriminación (7 causas)</div>
        </div>
        <div class="article">
          <h3>ARTÍCULO 15. DERECHO A LA VIDA</h3>
          <p>Todos tienen derecho a <strong>la vida y a la integridad física y moral</strong>, sin que, en ningún caso, puedan ser sometidos a <strong>tortura</strong> ni a penas o tratos inhumanos o degradantes. Queda <strong>abolida la pena de muerte</strong>, salvo lo que puedan disponer las leyes penales militares para tiempos de guerra.</p>
          <div class="key-point"><strong>🎯 Clave examen:</strong> Vida + integridad + abolición pena muerte (salvo guerra)</div>
        </div>
        <div class="article">
          <h3>SECCIÓN 1ª: DERECHOS FUNDAMENTALES Y LIBERTADES PÚBLICAS</h3>
          <h4>Arts. 15-21: Derechos de la persona</h4>
          <ul>
            <li>• Art. 15 - Vida e integridad</li>
            <li>• Art. 16 - Libertad ideológica</li>
            <li>• Art. 17 - Libertad personal</li>
            <li>• Art. 18 - Honor, intimidad e imagen</li>
            <li>• Art. 19 - Residencia y circulación</li>
            <li>• Art. 20 - Expresión e información</li>
            <li>• Art. 21 - Reunión y manifestación</li>
          </ul>
          <h4>Arts. 22-29: Derechos sociales</h4>
          <ul>
            <li>• Art. 22 - Asociación</li>
            <li>• Art. 23 - Participación política</li>
            <li>• Art. 24 - Tutela judicial efectiva</li>
            <li>• Art. 25 - Principio de legalidad penal</li>
            <li>• Art. 26 - Tribunales de honor</li>
            <li>• Art. 27 - Educación</li>
            <li>• Art. 28 - Sindicación y huelga</li>
            <li>• Art. 29 - Petición</li>
          </ul>
          <div class="key-point"><strong>🎯 Clave examen:</strong> Sección 1ª (Arts. 15-29) = Derechos fundamentales con máxima protección</div>
        </div>
      `,
      corona: `
        <div class="article">
          <h3>ARTÍCULO 56. EL REY</h3>
          <p><strong>1.</strong> El Rey es el <strong>Jefe del Estado</strong>, símbolo de su unidad y permanencia, <strong>arbitra y modera</strong> el funcionamiento regular de las instituciones, <strong>asume la más alta representación</strong> del Estado español en las relaciones internacionales, especialmente con las naciones de su comunidad histórica, y <strong>ejerce las funciones</strong> que le atribuyen expresamente la Constitución y las leyes.</p>
          <p><strong>2.</strong> Su título es el de <strong>Rey de España</strong> y podrá utilizar los demás que correspondan a la Corona.</p>
          <div class="key-point"><strong>🎯 Clave examen:</strong> Jefe Estado + símbolo + árbitro y moderador + representación</div>
        </div>
        <div class="article">
          <h3>ARTÍCULO 57. SUCESIÓN</h3>
          <p><strong>1.</strong> La Corona de España es <strong>hereditaria en los sucesores de S.M. Juan Carlos I de Borbón</strong>, legítimo heredero de la dinastía histórica. La sucesión en el trono seguirá el orden regular de <strong>primogenitura y representación</strong>, siendo preferida siempre la línea anterior a las posteriores; en la misma línea, el grado más próximo al más remoto; en el mismo grado, el <strong>varón a la mujer</strong>, y en el mismo sexo, la persona de más edad a la de menos.</p>
          <div class="key-point"><strong>🎯 Clave examen:</strong> Hereditaria + primogenitura + representación + preferencia masculina</div>
        </div>
        <div class="article">
          <h3>ARTÍCULO 62. FUNCIONES DEL REY</h3>
          <h4>Funciones principales:</h4>
          <ul>
            <li>• a) Sancionar y promulgar las leyes</li>
            <li>• b) Convocar y disolver las Cortes</li>
            <li>• c) Convocar elecciones</li>
            <li>• d) Proponer candidato a Presidente</li>
            <li>• e) Nombrar y separar miembros Gobierno</li>
            <li>• f) Expedir decretos acordados en Consejo</li>
            <li>• g) Conferir empleos civiles y militares</li>
            <li>• h) Conceder honores y distinciones</li>
            <li>• i) Ser informado de asuntos de Estado</li>
            <li>• j) Mando supremo de las Fuerzas Armadas</li>
          </ul>
          <div class="key-point"><strong>🎯 Clave examen:</strong> 10 funciones (letras a-j) - Todas con refrendo ministerial</div>
        </div>
      `,
      cortes: `
        <div class="article">
          <h3>ARTÍCULO 66. LAS CORTES GENERALES</h3>
          <p><strong>1.</strong> Las Cortes Generales representan al <strong>pueblo español</strong> y están formadas por el <strong>Congreso de los Diputados y el Senado</strong>.</p>
          <p><strong>2.</strong> Las Cortes Generales ejercen la <strong>potestad legislativa del Estado</strong>, aprueban sus Presupuestos, controlan la acción del Gobierno y tienen las demás competencias que les atribuya la Constitución.</p>
          <div class="key-point"><strong>🎯 Clave examen:</strong> Representan pueblo + bicameral + potestad legislativa + presupuestos + control</div>
        </div>
        <div class="article">
          <h3>COMPOSICIÓN DE LAS CORTES</h3>
          <h4>🏛️ Congreso de los Diputados</h4>
          <ul>
            <li>• <strong>Mínimo 300, máximo 400 Diputados</strong></li>
            <li>• <strong>Mandato 4 años</strong></li>
            <li>• <strong>Sufragio universal, libre, igual, directo y secreto</strong></li>
            <li>• <strong>Sistema proporcional</strong></li>
            <li>• <strong>Circunscripción provincial</strong></li>
            <li>• <strong>Mínimo 2 Diputados por provincia</strong></li>
          </ul>
          <h4>🏛️ Senado</h4>
          <ul>
            <li>• <strong>Cámara de representación territorial</strong></li>
            <li>• <strong>4 Senadores por provincia</strong></li>
            <li>• <strong>3 por cada isla mayor</strong> (Canarias/Baleares)</li>
            <li>• <strong>1 por cada isla menor/agrupación</strong></li>
            <li>• <strong>1 Senador por Ceuta y Melilla</strong></li>
            <li>• <strong>CCAA designan 1 + 1 por millón</strong></li>
          </ul>
          <div class="key-point"><strong>🎯 Clave examen:</strong> Congreso (300-400) + Senado (territorial) + mandato 4 años</div>
        </div>
      `,
      gobierno: `
        <div class="article">
          <h3>ARTÍCULO 97. EL GOBIERNO</h3>
          <p>El Gobierno <strong>dirige la política interior y exterior</strong>, la <strong>administración civil y militar</strong> y la <strong>defensa del Estado</strong>. Ejerce la <strong>función ejecutiva</strong> y la <strong>potestad reglamentaria</strong> de acuerdo con la Constitución y las leyes.</p>
          <div class="key-point"><strong>🎯 Clave examen:</strong> 5 funciones: política + administración + defensa + ejecutiva + reglamentaria</div>
        </div>
        <div class="article">
          <h3>ARTÍCULO 98. COMPOSICIÓN DEL GOBIERNO</h3>
          <p><strong>1.</strong> El Gobierno se compone del <strong>Presidente, de los Vicepresidentes, en su caso, de los Ministros y de los demás miembros</strong> que establezca la ley.</p>
          <p><strong>2.</strong> El Presidente <strong>dirige la acción del Gobierno</strong> y <strong>coordina las funciones</strong> de los demás miembros del mismo, sin perjuicio de la competencia y responsabilidad directa de éstos en su gestión.</p>
          <div class="key-point"><strong>🎯 Clave examen:</strong> Presidente + Vicepresidentes + Ministros + otros miembros</div>
        </div>
        <div class="article">
          <h3>ARTÍCULO 103. ADMINISTRACIÓN PÚBLICA</h3>
          <p><strong>1.</strong> La Administración Pública sirve con <strong>objetividad</strong> los intereses generales y actúa de acuerdo con los principios de <strong>eficacia, jerarquía, descentralización, desconcentración y coordinación</strong>, con sometimiento pleno a la ley y al Derecho.</p>
          <p><strong>3.</strong> La ley regulará el <strong>estatuto de los funcionarios públicos</strong>, el acceso a la función pública de acuerdo con los principios de <strong>mérito y capacidad</strong>, las peculiaridades del ejercicio de su derecho a sindicación...</p>
          <div class="key-point"><strong>🎯 Clave examen:</strong> Objetividad + 5 principios + mérito y capacidad</div>
        </div>
      `,
      judicial: `
        <div class="article">
          <h3>ARTÍCULO 117. FUNCIÓN JURISDICCIONAL</h3>
          <p><strong>1.</strong> La <strong>justicia emana del pueblo</strong> y se administra en nombre del Rey por <strong>Jueces y Magistrados</strong> integrantes del poder judicial, independientes, inamovibles, responsables y sometidos únicamente al <strong>imperio de la ley</strong>.</p>
          <p><strong>3.</strong> El ejercicio de la <strong>potestad jurisdiccional</strong> en todo tipo de procesos, juzgando y haciendo ejecutar lo juzgado, corresponde <strong>exclusivamente</strong> a los Juzgados y Tribunales determinados por las leyes...</p>
          <div class="key-point"><strong>🎯 Clave examen:</strong> Justicia del pueblo + independientes + imperio ley + exclusividad</div>
        </div>
        <div class="article">
          <h3>ARTÍCULO 122. CGPJ</h3>
          <p><strong>2.</strong> El Consejo General del Poder Judicial está integrado por el <strong>Presidente del Tribunal Supremo</strong>, que lo presidirá, y por <strong>veinte miembros</strong> nombrados por el Rey por un período de <strong>cinco años</strong>.</p>
          <p><strong>3.</strong> El Consejo General del Poder Judicial es el <strong>órgano de gobierno</strong> del mismo. La <strong>ley orgánica</strong> establecerá su estatuto y el régimen de incompatibilidades de sus miembros y sus funciones, en particular en materia de <strong>nombramientos, ascensos, inspección y régimen disciplinario</strong>.</p>
          <div class="key-point"><strong>🎯 Clave examen:</strong> 21 miembros (Presidente TS + 20) + 5 años + órgano gobierno</div>
        </div>
      `
    }
    
    const allContent = sectionOrder.map(key => {
      const section = sections[key]
      return `
        <div style="page-break-before: always; margin-bottom: 30px;">
          <h2 style="color: #1f2937; font-size: 24px; font-weight: bold; margin-bottom: 20px; border-bottom: 3px solid #3b82f6; padding-bottom: 10px;">
            ${section.title}
          </h2>
          <div style="font-family: Arial, sans-serif; line-height: 1.6;">
            ${printContent[key] || 'Contenido de la sección'}
          </div>
        </div>
      `
    }).join('')

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Tema 1: La Constitución Española de 1978 - Contenido Completo</title>
        <style>
          body { 
            font-family: Arial, sans-serif; 
            margin: 20px; 
            line-height: 1.6; 
            color: #374151;
          }
          h1 { 
            color: #1f2937; 
            text-align: center; 
            margin-bottom: 30px;
            font-size: 28px;
            border-bottom: 4px solid #3b82f6;
            padding-bottom: 15px;
          }
          h2 { 
            color: #1f2937; 
            font-size: 20px; 
            margin-top: 25px; 
            margin-bottom: 15px;
            background-color: #f3f4f6;
            padding: 10px;
            border-left: 4px solid #3b82f6;
          }
          h3 { 
            color: #374151; 
            font-size: 16px; 
            margin-top: 20px; 
            margin-bottom: 10px;
            font-weight: bold;
          }
          .article { 
            margin-bottom: 20px; 
            padding: 15px; 
            border: 1px solid #d1d5db; 
            border-radius: 8px;
            background-color: #f9fafb;
          }
          .key-point { 
            background-color: #fef3c7; 
            padding: 10px; 
            border-radius: 6px; 
            border-left: 4px solid #f59e0b;
            margin-top: 10px;
            font-size: 14px;
          }
          strong { color: #1f2937; }
          ul { margin: 10px 0; padding-left: 20px; }
          li { margin-bottom: 5px; }
          @media print {
            body { margin: 15mm; }
            .article { break-inside: avoid; }
          }
        </style>
      </head>
      <body>
        <h1>🏛️ TEMA 1: LA CONSTITUCIÓN ESPAÑOLA DE 1978</h1>
        <p style="text-align: center; color: #6b7280; margin-bottom: 40px;">
          Base fundamental del ordenamiento jurídico español<br>
          Material oficial actualizado 2025 - vence.es
        </p>
        ${allContent}
        <div style="text-align: center; margin-top: 40px; padding-top: 20px; border-top: 2px solid #e5e7eb; color: #6b7280; font-size: 14px;">
          <p>© vence.es - Preparación Inteligente para Oposiciones</p>
          <p>Tema 1: La Constitución Española de 1978 - Auxiliar Administrativo del Estado</p>
        </div>
      </body>
      </html>
    `)
    printWindow.document.close()
    printWindow.print()
  }

  return (
    <div className="max-w-4xl mx-auto">
      {/* CTA Principal */}
      <div className="text-center mb-8">
        <button
          onClick={() => setShowModal(true)}
          className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white px-8 py-4 rounded-lg text-lg font-semibold hover:from-blue-700 hover:to-indigo-700 transition-all duration-300 shadow-lg hover:shadow-xl transform hover:scale-105"
        >
          📖 Acceder al Contenido Completo del Tema 1
        </button>
        <p className="text-gray-600 mt-3 text-sm">
          Contenido interactivo con todos los artículos clave organizados por títulos
        </p>
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg w-full max-w-6xl max-h-[90vh] overflow-hidden">
            {/* Header del Modal */}
            <div className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white p-6 flex justify-between items-center">
              <div>
                <h2 className="text-2xl font-bold">🏛️ Tema 1: Constitución Española de 1978</h2>
                <p className="text-blue-100 mt-1">Base fundamental del ordenamiento jurídico español</p>
              </div>
              <button
                onClick={handleCloseModal}
                className="text-white hover:text-gray-300 text-3xl font-bold"
              >
                ×
              </button>
            </div>

            {/* Contenido del Modal */}
            <div className="flex h-[calc(90vh-120px)]">
              {/* Sidebar Desktop */}
              <div className="hidden lg:block w-64 bg-gray-50 border-r border-gray-200 overflow-y-auto">
                <nav className="p-4 space-y-2">
                  {Object.keys(sections).map((key) => (
                    <button
                      key={key}
                      onClick={() => setActiveSection(key)}
                      className={`w-full text-left px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                        activeSection === key
                          ? 'bg-blue-600 text-white'
                          : 'text-gray-700 hover:bg-gray-200'
                      }`}
                    >
                      {sections[key].title}
                    </button>
                  ))}
                </nav>
              </div>

              {/* Contenido Principal */}
              <div className="flex-1 overflow-y-auto">
                {/* Menú Móvil Toggle */}
                <div className="lg:hidden bg-white border-b border-gray-200 p-4">
                  <button
                    onClick={() => setShowMobileMenu(!showMobileMenu)}
                    className="w-full bg-blue-50 text-blue-700 px-4 py-2 rounded-lg font-medium"
                  >
                    {sections[activeSection].title} ▼
                  </button>
                  
                  {showMobileMenu && (
                    <div className="mt-2 bg-white border border-gray-200 rounded-lg shadow-lg">
                      {Object.keys(sections).map((key) => (
                        <button
                          key={key}
                          onClick={() => navigateToSection(key)}
                          className={`w-full text-left px-4 py-3 border-b border-gray-100 last:border-b-0 text-sm ${
                            activeSection === key
                              ? 'bg-blue-50 text-blue-700 font-medium'
                              : 'text-gray-700 hover:bg-gray-50'
                          }`}
                        >
                          {sections[key].title}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Contenido de la Sección */}
                <div className="p-6">
                  <h3 className="text-2xl font-bold text-gray-800 mb-6">
                    {sections[activeSection].title}
                  </h3>
                  {sections[activeSection].content}
                  
                  {/* Navegación entre secciones */}
                  <div className="mt-8 pt-6 border-t border-gray-200">
                    <div className="flex justify-between items-center">
                      {/* Sección Anterior */}
                      <div className="flex-1">
                        {previousSection ? (
                          <button
                            onClick={() => setActiveSection(previousSection)}
                            className="flex items-center text-blue-600 hover:text-blue-800 transition-colors group"
                          >
                            <svg className="w-5 h-5 mr-2 transform group-hover:-translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                            </svg>
                            <div className="text-left">
                              <div className="text-xs text-gray-500 uppercase tracking-wide">Anterior</div>
                              <div className="font-medium">{sections[previousSection].title}</div>
                            </div>
                          </button>
                        ) : (
                          <div></div>
                        )}
                      </div>

                      {/* Indicador de posición */}
                      <div className="flex-shrink-0 mx-4">
                        <div className="text-sm text-gray-500">
                          {currentIndex + 1} de {sectionOrder.length}
                        </div>
                        <div className="flex space-x-1 mt-1">
                          {sectionOrder.map((_, index) => (
                            <div
                              key={index}
                              className={`w-2 h-2 rounded-full ${
                                index === currentIndex ? 'bg-blue-600' : 'bg-gray-300'
                              }`}
                            ></div>
                          ))}
                        </div>
                      </div>

                      {/* Sección Siguiente */}
                      <div className="flex-1 flex justify-end">
                        {nextSection ? (
                          <button
                            onClick={() => setActiveSection(nextSection)}
                            className="flex items-center text-blue-600 hover:text-blue-800 transition-colors group"
                          >
                            <div className="text-right">
                              <div className="text-xs text-gray-500 uppercase tracking-wide">Siguiente</div>
                              <div className="font-medium">{sections[nextSection].title}</div>
                            </div>
                            <svg className="w-5 h-5 ml-2 transform group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                            </svg>
                          </button>
                        ) : (
                          <div></div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Footer del Modal */}
            <div className="bg-gray-50 px-6 py-4 border-t border-gray-200 flex flex-col sm:flex-row justify-between items-center gap-4">
              <div className="text-sm text-gray-600">
                📚 Material oficial actualizado 2025 | Auxiliar Administrativo Estado
              </div>
              <div className="flex flex-wrap gap-3">
                <button
                  onClick={handlePrint}
                  className="bg-green-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-green-700 transition-colors flex items-center"
                >
                  <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                  </svg>
                  🖨️ Imprimir Todo
                </button>
                <Link
                  href="/auxiliar-administrativo-estado/test/tema/1"
                  className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors flex items-center"
                  onClick={handleCloseModal}
                >
                  🎯 Hacer Tests
                </Link>
                <button
                  onClick={handleCloseModal}
                  className="bg-gray-300 text-gray-700 px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-400 transition-colors"
                >
                  Cerrar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Preview Cards */}
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 mt-12">
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 hover:shadow-md transition-shadow">
          <div className="text-blue-600 text-2xl mb-3">📖</div>
          <h3 className="font-bold text-gray-800 mb-2">Título Preliminar</h3>
          <p className="text-gray-600 text-sm mb-4">
            Principios fundamentales del Estado español: valores superiores, soberanía y forma política.
          </p>
          <div className="text-xs text-blue-600 font-medium">Arts. 1-9 • Esenciales</div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 hover:shadow-md transition-shadow">
          <div className="text-green-600 text-2xl mb-3">⚖️</div>
          <h3 className="font-bold text-gray-800 mb-2">Derechos Fundamentales</h3>
          <p className="text-gray-600 text-sm mb-4">
            Catálogo completo de derechos y libertades fundamentales de los ciudadanos españoles.
          </p>
          <div className="text-xs text-green-600 font-medium">Arts. 10-55 • Críticos</div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 hover:shadow-md transition-shadow">
          <div className="text-purple-600 text-2xl mb-3">👑</div>
          <h3 className="font-bold text-gray-800 mb-2">La Corona</h3>
          <p className="text-gray-600 text-sm mb-4">
            Funciones del Rey como Jefe del Estado, sucesión y organización de la institución monárquica.
          </p>
          <div className="text-xs text-purple-600 font-medium">Arts. 56-65 • Importantes</div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 hover:shadow-md transition-shadow">
          <div className="text-red-600 text-2xl mb-3">🏛️</div>
          <h3 className="font-bold text-gray-800 mb-2">Las Cortes Generales</h3>
          <p className="text-gray-600 text-sm mb-4">
            Poder legislativo: composición, funciones y organización del Congreso y Senado.
          </p>
          <div className="text-xs text-red-600 font-medium">Arts. 66-96 • Frecuentes</div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 hover:shadow-md transition-shadow">
          <div className="text-orange-600 text-2xl mb-3">🏢</div>
          <h3 className="font-bold text-gray-800 mb-2">Gobierno y Administración</h3>
          <p className="text-gray-600 text-sm mb-4">
            Poder ejecutivo: composición del Gobierno y principios de la Administración Pública.
          </p>
          <div className="text-xs text-orange-600 font-medium">Arts. 97-107 • Clave AAPP</div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 hover:shadow-md transition-shadow">
          <div className="text-teal-600 text-2xl mb-3">⚖️</div>
          <h3 className="font-bold text-gray-800 mb-2">Poder Judicial</h3>
          <p className="text-gray-600 text-sm mb-4">
            Organización judicial: independencia, CGPJ y principios de la función jurisdiccional.
          </p>
          <div className="text-xs text-teal-600 font-medium">Arts. 117-127 • Importantes</div>
        </div>
      </div>

      {/* Estadísticas del Tema */}
      <div className="mt-12 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg p-6">
        <h3 className="text-xl font-bold text-gray-800 mb-4 text-center">📊 Estadísticas del Tema</h3>
        <div className="grid md:grid-cols-4 gap-4">
          <div className="text-center">
            <div className="text-2xl font-bold text-blue-600">169</div>
            <div className="text-sm text-gray-600">Artículos totales</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-green-600">95%</div>
            <div className="text-sm text-gray-600">Aparición en exámenes</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-purple-600">10</div>
            <div className="text-sm text-gray-600">Títulos principales</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-orange-600">⭐</div>
            <div className="text-sm text-gray-600">Prioridad máxima</div>
          </div>
        </div>
      </div>
    </div>
  )
}