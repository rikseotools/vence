// app/es/auxiliar-administrativo-estado/temario/tema-3/Tema3Interactive.js - COMPONENTE INTERACTIVO TEMA 3
'use client'
import { useState } from 'react'

export default function Tema3Interactive() {
  const [activeSection, setActiveSection] = useState(0)

  // Secciones del tema
  const sections = [
    {
      id: 'composicion-cortes',
      title: '🏛️ Composición de las Cortes Generales',
      content: `
        <h3>Las Cortes Generales (Art. 66 CE)</h3>
        <ul>
          <li><strong>Composición:</strong> Congreso de los Diputados + Senado</li>
          <li><strong>Representación:</strong> Del pueblo español</li>
          <li><strong>Inviolabilidad:</strong> Las Cortes Generales son inviolables</li>
          <li><strong>Mandato:</strong> 4 años para ambas Cámaras</li>
        </ul>

        <h4>Funciones principales (Art. 66.2)</h4>
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
          <div class="bg-blue-50 p-4 rounded">
            <h5>🏛️ Función Legislativa</h5>
            <p>Ejercen la potestad legislativa del Estado</p>
          </div>
          <div class="bg-green-50 p-4 rounded">
            <h5>💰 Función Financiera</h5>
            <p>Aprueban los Presupuestos Generales del Estado</p>
          </div>
          <div class="bg-yellow-50 p-4 rounded">
            <h5>🔍 Función de Control</h5>
            <p>Controlan la acción del Gobierno</p>
          </div>
          <div class="bg-purple-50 p-4 rounded">
            <h5>⚖️ Otras Competencias</h5>
            <p>Las demás que les atribuya la Constitución</p>
          </div>
        </div>

        <div class="bg-gray-100 p-4 rounded mt-4">
          <h5>📋 Prohibiciones (Art. 67)</h5>
          <ul>
            <li>❌ Nadie puede ser miembro de las dos Cámaras simultáneamente</li>
            <li>❌ No se puede acumular acta de CCAA con Diputado al Congreso</li>
            <li>❌ Los miembros no están ligados por mandato imperativo</li>
          </ul>
        </div>
      `
    },
    {
      id: 'congreso-diputados',
      title: '👥 El Congreso de los Diputados',
      content: `
        <h3>Congreso de los Diputados (Art. 68 CE)</h3>
        
        <div class="bg-blue-50 p-4 rounded mb-4">
          <h4>📊 Composición y Elección</h4>
          <ul>
            <li><strong>Número:</strong> Entre 300 y 400 Diputados (actualmente 350)</li>
            <li><strong>Elección:</strong> Sufragio universal, libre, igual, directo y secreto</li>
            <li><strong>Circunscripción:</strong> Provincial</li>
            <li><strong>Ceuta y Melilla:</strong> 1 Diputado cada una</li>
            <li><strong>Sistema:</strong> Representación proporcional</li>
            <li><strong>Mandato:</strong> 4 años</li>
          </ul>
        </div>

        <h4>🗳️ Requisitos Electorales (Art. 68.5)</h4>
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div class="bg-green-50 p-4 rounded">
            <h5>Electores y Elegibles</h5>
            <p>Todos los españoles que estén en pleno uso de sus derechos políticos</p>
          </div>
          <div class="bg-yellow-50 p-4 rounded">
            <h5>Españoles en el Extranjero</h5>
            <p>La ley reconocerá y el Estado facilitará el derecho de sufragio</p>
          </div>
        </div>

        <h4>📅 Calendario Electoral (Art. 68.6)</h4>
        <div class="timeline">
          <div class="bg-red-50 p-3 rounded mb-2">
            <strong>Terminación mandato:</strong> Automática tras 4 años o disolución
          </div>
          <div class="bg-orange-50 p-3 rounded mb-2">
            <strong>Convocatoria electoral:</strong> Entre 30 y 60 días desde terminación
          </div>
          <div class="bg-blue-50 p-3 rounded">
            <strong>Convocatoria Congreso:</strong> Dentro de 25 días tras elecciones
          </div>
        </div>

        <div class="bg-gray-100 p-4 rounded mt-4">
          <h5>🔥 Muy Preguntado en Exámenes</h5>
          <p><strong>Art. 68.6:</strong> "Las elecciones tendrán lugar entre los 30 días y 60 días desde la terminación del mandato. El Congreso electo deberá ser convocado dentro de los 25 días siguientes a la celebración de las elecciones."</p>
        </div>
      `
    },
    {
      id: 'senado',
      title: '🏛️ El Senado',
      content: `
        <h3>El Senado (Art. 69 CE)</h3>
        
        <div class="bg-purple-50 p-4 rounded mb-4">
          <h4>🗺️ Cámara de Representación Territorial</h4>
          <p>El Senado es la Cámara de representación territorial, con una composición mixta que combina elección directa y designación autonómica.</p>
        </div>

        <h4>📊 Composición del Senado</h4>
        
        <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div class="bg-blue-50 p-4 rounded">
            <h5>🏪 Senadores Provinciales (Art. 69.2)</h5>
            <ul>
              <li><strong>4 Senadores por provincia</strong></li>
              <li>Elección: Sufragio universal directo</li>
              <li>Total: ~200 senadores provinciales</li>
            </ul>
          </div>

          <div class="bg-green-50 p-4 rounded">
            <h5>🏝️ Senadores Insulares (Art. 69.3)</h5>
            <ul>
              <li><strong>Islas mayores:</strong> 3 senadores cada una
                <ul class="ml-4">
                  <li>• Gran Canaria: 3</li>
                  <li>• Mallorca: 3</li>
                  <li>• Tenerife: 3</li>
                </ul>
              </li>
              <li><strong>Islas menores:</strong> 1 senador cada una
                <ul class="ml-4">
                  <li>• Ibiza-Formentera, Menorca</li>
                  <li>• Fuerteventura, Gomera</li>
                  <li>• Hierro, Lanzarote, La Palma</li>
                </ul>
              </li>
            </ul>
          </div>

          <div class="bg-yellow-50 p-4 rounded">
            <h5>🏛️ Ceuta y Melilla (Art. 69.4)</h5>
            <p><strong>2 Senadores cada una</strong></p>
            <p>Total: 4 senadores</p>
          </div>

          <div class="bg-orange-50 p-4 rounded">
            <h5>🗺️ Senadores Autonómicos (Art. 69.5)</h5>
            <ul>
              <li><strong>1 senador base + 1 por cada millón de habitantes</strong></li>
              <li>Designación: Asamblea legislativa autonómica</li>
              <li>Representación proporcional asegurada</li>
              <li>Total: ~50 senadores autonómicos</li>
            </ul>
          </div>
        </div>

        <div class="bg-red-50 p-4 rounded mt-4">
          <h5>🔥 Muy Preguntado en Exámenes</h5>
          <div class="space-y-2">
            <p><strong>Art. 69.2:</strong> "En cada provincia se elegirán 4 senadores"</p>
            <p><strong>Art. 69.4:</strong> "Ceuta y Melilla elegirán cada una 2 senadores"</p>
            <p><strong>Art. 69.5:</strong> "Las CCAA designarán 1 + 1 por millón de habitantes"</p>
          </div>
        </div>

        <h4>⏰ Mandato</h4>
        <p class="bg-gray-100 p-3 rounded">El Senado es elegido por <strong>4 años</strong>. El mandato termina 4 años después de su elección o el día de disolución de la Cámara.</p>
      `
    },
    {
      id: 'inelegibilidad-prerrogativas',
      title: '⚖️ Inelegibilidad y Prerrogativas',
      content: `
        <h3>Inelegibilidad e Incompatibilidad (Art. 70)</h3>
        
        <div class="bg-red-50 p-4 rounded mb-4">
          <h4>❌ Causas de Inelegibilidad e Incompatibilidad</h4>
          <ul>
            <li><strong>a)</strong> Componentes del Tribunal Constitucional</li>
            <li><strong>b)</strong> Altos cargos de la Administración del Estado (excepto miembros del Gobierno)</li>
            <li><strong>c)</strong> El Defensor del Pueblo</li>
            <li><strong>d)</strong> Magistrados, Jueces y Fiscales en activo</li>
            <li><strong>e)</strong> Militares profesionales y Fuerzas de Seguridad en activo</li>
            <li><strong>f)</strong> Miembros de las Juntas Electorales</li>
          </ul>
        </div>

        <h3>Prerrogativas Parlamentarias (Art. 71)</h3>
        
        <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div class="bg-blue-50 p-4 rounded">
            <h4>🛡️ Inviolabilidad (Art. 71.1)</h4>
            <p>Los Diputados y Senadores <strong>gozarán de inviolabilidad</strong> por las opiniones manifestadas en el ejercicio de sus funciones.</p>
            <div class="mt-2 text-sm text-blue-700">
              <strong>Alcance:</strong> Protección absoluta por opiniones parlamentarias
            </div>
          </div>

          <div class="bg-green-50 p-4 rounded">
            <h4>🔒 Inmunidad (Art. 71.2)</h4>
            <ul>
              <li>Solo detención en <strong>flagrante delito</strong></li>
              <li>No pueden ser inculpados ni procesados sin <strong>previa autorización de la Cámara</strong></li>
            </ul>
            <div class="mt-2 text-sm text-green-700">
              <strong>Alcance:</strong> Protección procedimental durante el mandato
            </div>
          </div>

          <div class="bg-purple-50 p-4 rounded">
            <h4>⚖️ Aforamiento (Art. 71.3)</h4>
            <p>En las causas contra Diputados y Senadores será competente la <strong>Sala de lo Penal del Tribunal Supremo</strong>.</p>
            <div class="mt-2 text-sm text-purple-700">
              <strong>Alcance:</strong> Competencia judicial especial
            </div>
          </div>

          <div class="bg-yellow-50 p-4 rounded">
            <h4>💰 Asignación Económica (Art. 71.4)</h4>
            <p>Los Diputados y Senadores percibirán una <strong>asignación que será fijada por las respectivas Cámaras</strong>.</p>
            <div class="mt-2 text-sm text-yellow-700">
              <strong>Alcance:</strong> Independencia económica parlamentaria
            </div>
          </div>
        </div>

        <div class="bg-red-50 p-4 rounded mt-4">
          <h5>🔥 Muy Preguntado en Exámenes</h5>
          <div class="space-y-2">
            <p><strong>Inviolabilidad:</strong> Por opiniones en ejercicio de funciones</p>
            <p><strong>Inmunidad:</strong> Solo detención en flagrante delito + autorización Cámara</p>
            <p><strong>Competencia:</strong> Tribunal Supremo (Sala Penal)</p>
          </div>
        </div>

        <h4>🔍 Control Judicial</h4>
        <p class="bg-gray-100 p-3 rounded">La validez de las actas y credenciales estará sometida al <strong>control judicial</strong>, en los términos que establezca la ley electoral.</p>
      `
    },
    {
      id: 'funcionamiento',
      title: '⚙️ Funcionamiento Parlamentario',
      content: `
        <h3>Autonomía Parlamentaria (Art. 72)</h3>
        
        <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div class="bg-blue-50 p-4 rounded">
            <h4>📋 Autonomía Normativa</h4>
            <ul>
              <li>Establecen sus propios <strong>Reglamentos</strong></li>
              <li>Reforma: <strong>mayoría absoluta</strong> en votación final</li>
              <li>Estatuto del Personal: <strong>de común acuerdo</strong></li>
            </ul>
          </div>

          <div class="bg-green-50 p-4 rounded">
            <h4>💰 Autonomía Financiera</h4>
            <ul>
              <li>Aprueban <strong>autónomamente sus presupuestos</strong></li>
              <li>Control exclusivo de gastos parlamentarios</li>
            </ul>
          </div>

          <div class="bg-purple-50 p-4 rounded">
            <h4>👑 Organización</h4>
            <ul>
              <li>Eligen sus respectivos <strong>Presidentes</strong></li>
              <li>Eligen los demás miembros de sus <strong>Mesas</strong></li>
              <li>Sesiones conjuntas: Presidente del Congreso</li>
            </ul>
          </div>

          <div class="bg-yellow-50 p-4 rounded">
            <h4>🏛️ Poderes Administrativos</h4>
            <p>Los Presidentes ejercen <strong>todos los poderes administrativos y facultades de policía</strong> en el interior de sus respectivas sedes.</p>
          </div>
        </div>

        <h3>Períodos de Sesiones (Art. 73)</h3>
        
        <div class="bg-green-50 p-4 rounded mb-4">
          <h4>📅 Sesiones Ordinarias (Art. 73.1)</h4>
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div class="bg-white p-3 rounded">
              <h5>🍂 Primer Período</h5>
              <p><strong>Septiembre a Diciembre</strong></p>
            </div>
            <div class="bg-white p-3 rounded">
              <h5>🌸 Segundo Período</h5>
              <p><strong>Febrero a Junio</strong></p>
            </div>
          </div>
        </div>

        <div class="bg-orange-50 p-4 rounded mb-4">
          <h4>🚨 Sesiones Extraordinarias (Art. 73.2)</h4>
          <p><strong>Convocadas por:</strong></p>
          <ul>
            <li>El Gobierno</li>
            <li>La Diputación Permanente</li>
            <li>La mayoría absoluta de miembros de cualquiera de las Cámaras</li>
          </ul>
          <p class="mt-2"><strong>Características:</strong> Orden del día determinado y clausura una vez agotado.</p>
        </div>

        <h3>Funcionamiento (Art. 75)</h3>
        
        <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div class="bg-blue-50 p-4 rounded">
            <h4>🏛️ Modalidades (Art. 75.1)</h4>
            <p>Las Cámaras funcionarán en:</p>
            <ul>
              <li><strong>Pleno</strong></li>
              <li><strong>Comisiones</strong></li>
            </ul>
          </div>

          <div class="bg-green-50 p-4 rounded">
            <h4>📋 Delegación Legislativa (Art. 75.2)</h4>
            <p>Las Cámaras pueden delegar en <strong>Comisiones Legislativas Permanentes</strong> la aprobación de proyectos de ley.</p>
            <p class="text-sm mt-1">El Pleno puede recabar en cualquier momento el debate y votación.</p>
          </div>
        </div>

        <div class="bg-red-50 p-4 rounded mt-4">
          <h4>❌ Excepciones a la Delegación (Art. 75.3)</h4>
          <ul>
            <li>Reforma constitucional</li>
            <li>Cuestiones internacionales</li>
            <li>Leyes orgánicas y de bases</li>
            <li>Presupuestos Generales del Estado</li>
          </ul>
        </div>

        <div class="bg-gray-100 p-4 rounded mt-4">
          <h5>🔥 Muy Preguntado en Exámenes</h5>
          <p><strong>Art. 73.1:</strong> "Dos períodos ordinarios: septiembre a diciembre y febrero a junio"</p>
          <p><strong>Art. 75.3:</strong> "Excepciones delegación: reforma constitucional, internacionales, orgánicas y bases, presupuestos"</p>
        </div>
      `
    },
    {
      id: 'defensor-pueblo',
      title: '⚖️ El Defensor del Pueblo',
      content: `
        <h3>El Defensor del Pueblo (Art. 54 CE)</h3>
        
        <div class="bg-blue-50 p-4 rounded mb-4">
          <h4>👨‍⚖️ Naturaleza y Función</h4>
          <p>El Defensor del Pueblo es el <strong>alto comisionado de las Cortes Generales</strong>, designado por éstas para la <strong>defensa de los derechos del Título I</strong>, supervisando la actividad de la Administración.</p>
        </div>

        <h3>Ley Orgánica 3/1981 del Defensor del Pueblo</h3>
        
        <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div class="bg-green-50 p-4 rounded">
            <h4>🗳️ Elección (Art. 2 LO 3/1981)</h4>
            <ul>
              <li><strong>Período:</strong> 5 años</li>
              <li><strong>Mayoría:</strong> 3/5 de cada Cámara</li>
              <li><strong>Si no se alcanza:</strong> Comisión Mixta paritaria</li>
              <li><strong>Si persiste desacuerdo:</strong> Sucesivas votaciones</li>
            </ul>
          </div>

          <div class="bg-yellow-50 p-4 rounded">
            <h4>✅ Requisitos (Art. 6)</h4>
            <ul>
              <li>Ser <strong>español</strong></li>
              <li><strong>Mayor de edad</strong></li>
              <li>Pleno disfrute de <strong>derechos civiles y políticos</strong></li>
              <li>No incurso en causas de <strong>inelegibilidad o incompatibilidad</strong></li>
            </ul>
          </div>

          <div class="bg-red-50 p-4 rounded">
            <h4>❌ Incompatibilidades (Art. 7)</h4>
            <ul>
              <li>Mandato parlamentario</li>
              <li>Funciones de Gobierno o Administración</li>
              <li>Funciones directivas en partidos políticos y sindicatos</li>
              <li>Carreras judicial y fiscal</li>
              <li>Profesiones mercantiles (salvo docente, científico, literario, artístico)</li>
            </ul>
          </div>

          <div class="bg-purple-50 p-4 rounded">
            <h4>👥 Organización</h4>
            <ul>
              <li>El Defensor del Pueblo está auxiliado por <strong>2 adjuntos</strong></li>
              <li>Los nombrará y separará previa <strong>conformidad de las Cámaras</strong></li>
              <li>Sustitución en casos de ausencia, enfermedad o impedimento</li>
            </ul>
          </div>
        </div>

        <h4>📋 Funciones y Competencias</h4>
        
        <div class="space-y-4">
          <div class="bg-blue-50 p-4 rounded">
            <h5>🛡️ Defensa de Derechos</h5>
            <p>Defensa de los derechos comprendidos en el <strong>Título I de la Constitución</strong> (derechos fundamentales y libertades públicas).</p>
          </div>

          <div class="bg-green-50 p-4 rounded">
            <h5>🔍 Supervisión Administrativa</h5>
            <p>Supervisar la actividad de la <strong>Administración</strong>, dando cuenta a las Cortes Generales.</p>
          </div>

          <div class="bg-yellow-50 p-4 rounded">
            <h5>📝 Quejas Ciudadanas</h5>
            <ul>
              <li><strong>Legitimación:</strong> Toda persona natural o jurídica con interés legítimo</li>
              <li><strong>Plazo:</strong> 1 año desde conocimiento de los hechos</li>
              <li><strong>Sin restricción alguna</strong> para presentar quejas</li>
            </ul>
          </div>

          <div class="bg-orange-50 p-4 rounded">
            <h5>⚖️ Resoluciones</h5>
            <ul>
              <li>Puede formular <strong>advertencias, recomendaciones o recordatorios</strong></li>
              <li>Las decisiones de rechazo de quejas <strong>no son susceptibles de recurso</strong></li>
              <li>No tiene competencia jurisdiccional</li>
            </ul>
          </div>
        </div>

        <div class="bg-red-50 p-4 rounded mt-4">
          <h5>🔥 Muy Preguntado en Exámenes</h5>
          <div class="space-y-2">
            <p><strong>Período:</strong> 5 años</p>
            <p><strong>Elección:</strong> 3/5 de cada Cámara</p>
            <p><strong>Adjuntos:</strong> 2 adjuntos</p>
            <p><strong>Plazo quejas:</strong> 1 año desde conocimiento</p>
            <p><strong>Legitimación:</strong> Persona natural o jurídica con interés legítimo</p>
          </div>
        </div>
      `
    }
  ]

  const handlePrint = () => {
    window.print()
  }

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Navigation */}
      <div className="mb-8">
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
          <div className="flex flex-wrap gap-2">
            {sections.map((section, index) => (
              <button
                key={section.id}
                onClick={() => setActiveSection(index)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                  activeSection === index
                    ? 'bg-blue-600 text-white shadow-md'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200 hover:text-gray-800'
                }`}
              >
                {section.title}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        {/* Main Content */}
        <div className="lg:col-span-3">
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8">
            <div 
              className="prose prose-lg max-w-none"
              dangerouslySetInnerHTML={{ 
                __html: sections[activeSection].content 
              }}
            />
          </div>
        </div>

        {/* Sidebar */}
        <div className="lg:col-span-1">
          {/* Progress */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
            <h3 className="text-lg font-semibold text-gray-800 mb-4">Progreso del Tema</h3>
            <div className="space-y-3">
              {sections.map((section, index) => (
                <div 
                  key={section.id}
                  className={`flex items-center space-x-3 p-2 rounded cursor-pointer transition-colors ${
                    activeSection === index ? 'bg-blue-50' : 'hover:bg-gray-50'
                  }`}
                  onClick={() => setActiveSection(index)}
                >
                  <div className={`w-3 h-3 rounded-full flex-shrink-0 ${
                    activeSection === index ? 'bg-blue-500' : 
                    activeSection > index ? 'bg-green-500' : 'bg-gray-300'
                  }`} />
                  <span className={`text-sm ${
                    activeSection === index ? 'text-blue-700 font-medium' : 'text-gray-600'
                  }`}>
                    {section.title.replace(/^[🏛️👥⚖️⚙️🔍]+\s/, '')}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Actions */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
            <h3 className="text-lg font-semibold text-gray-800 mb-4">Acciones</h3>
            <div className="space-y-3">
              <button 
                onClick={handlePrint}
                className="w-full bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 transition-colors flex items-center justify-center space-x-2"
              >
                <span>🖨️</span>
                <span>Imprimir Tema</span>
              </button>
              <a 
                href="/es/auxiliar-administrativo-estado/test" 
                className="w-full bg-green-600 text-white py-2 px-4 rounded-lg hover:bg-green-700 transition-colors flex items-center justify-center space-x-2"
              >
                <span>📝</span>
                <span>Hacer Test</span>
              </a>
              <a 
                href="/es/auxiliar-administrativo-estado/temario" 
                className="w-full bg-gray-600 text-white py-2 px-4 rounded-lg hover:bg-gray-700 transition-colors flex items-center justify-center space-x-2"
              >
                <span>📚</span>
                <span>Volver al Temario</span>
              </a>
            </div>
          </div>

          {/* Key Stats */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h3 className="text-lg font-semibold text-gray-800 mb-4">Datos Clave</h3>
            <div className="space-y-4">
              <div className="bg-blue-50 p-3 rounded">
                <div className="text-2xl font-bold text-blue-600">350</div>
                <div className="text-sm text-blue-700">Diputados actuales</div>
              </div>
              <div className="bg-green-50 p-3 rounded">
                <div className="text-2xl font-bold text-green-600">266</div>
                <div className="text-sm text-green-700">Senadores totales</div>
              </div>
              <div className="bg-purple-50 p-3 rounded">
                <div className="text-2xl font-bold text-purple-600">5</div>
                <div className="text-sm text-purple-700">Años Defensor Pueblo</div>
              </div>
              <div className="bg-yellow-50 p-3 rounded">
                <div className="text-2xl font-bold text-yellow-600">3/5</div>
                <div className="text-sm text-yellow-700">Mayoría elección</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Navigation Buttons */}
      <div className="flex justify-between items-center mt-8">
        <button 
          onClick={() => setActiveSection(Math.max(0, activeSection - 1))}
          disabled={activeSection === 0}
          className="flex items-center space-x-2 px-6 py-3 bg-gray-100 text-gray-600 rounded-lg hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          <span>←</span>
          <span>Anterior</span>
        </button>

        <span className="text-sm text-gray-500">
          {activeSection + 1} de {sections.length}
        </span>

        <button 
          onClick={() => setActiveSection(Math.min(sections.length - 1, activeSection + 1))}
          disabled={activeSection === sections.length - 1}
          className="flex items-center space-x-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          <span>Siguiente</span>
          <span>→</span>
        </button>
      </div>
    </div>
  )
}