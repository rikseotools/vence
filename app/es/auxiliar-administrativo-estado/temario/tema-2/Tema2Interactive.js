// app/es/auxiliar-administrativo-estado/temario/tema-2/Tema2Interactive.js
'use client'
import { useState } from 'react'

export default function Tema2Interactive() {
  const [activeSection, setActiveSection] = useState(null)
  const [showFullContent, setShowFullContent] = useState(false)

  // Contenido del Tema 2: El Tribunal Constitucional
  const sections = {
    1: {
      title: "1. Naturaleza y Posición Institucional",
      content: `El Tribunal Constitucional es el órgano jurisdiccional supremo en materia de garantías constitucionales.

• **Naturaleza jurídica**: Órgano constitucional independiente
• **Posición**: Intérprete supremo de la Constitución
• **Independencia**: Total independencia de los demás poderes del Estado
• **Función esencial**: Control de constitucionalidad y protección de derechos fundamentales

**Características principales:**
- Único en su orden jurisdiccional
- Tribunal especializado en materia constitucional
- Jurisdicción en todo el territorio nacional
- Sometido únicamente a la Constitución y a su Ley Orgánica`
    },
    2: {
      title: "2. Composición del Tribunal Constitucional",
      content: `El Tribunal Constitucional está compuesto por 12 magistrados nombrados por el Rey.

**Designación de los magistrados:**
• 4 magistrados: propuestos por el Congreso de los Diputados (mayoría de 3/5)
• 4 magistrados: propuestos por el Senado (mayoría de 3/5)
• 2 magistrados: propuestos por el Gobierno
• 2 magistrados: propuestos por el Consejo General del Poder Judicial

**Requisitos para ser magistrado:**
- Ser juristas de reconocida competencia
- Tener más de 15 años de ejercicio profesional
- Ser Magistrados, Fiscales, Profesores de Universidad, Funcionarios públicos o Abogados

**Mandato y renovación:**
- Mandato: 9 años
- Renovación: por terceras partes cada 3 años
- No reelegibles`
    },
    3: {
      title: "3. Organización Interna",
      content: `La organización del Tribunal Constitucional se estructura de la siguiente manera:

**El Presidente:**
• Elegido por los magistrados entre ellos
• Mandato de 3 años
• Representa al Tribunal
• Dirige los debates y deliberaciones

**El Vicepresidente:**
• Sustituye al Presidente en sus ausencias
• Elegido por los magistrados

**Las Salas:**
• **Primera Sala**: 6 magistrados (incluido el Presidente)
• **Segunda Sala**: 6 magistrados (incluido el Vicepresidente)
• **Pleno**: Los 12 magistrados

**Funcionamiento:**
- Sesiones: públicas o privadas según el caso
- Quórum: mayoría absoluta de magistrados
- Secretario General: da fe de las actuaciones`
    },
    4: {
      title: "4. Competencias del Tribunal Constitucional",
      content: `El Tribunal Constitucional tiene las siguientes competencias principales:

**1. Control de constitucionalidad:**
• Recursos de inconstitucionalidad contra leyes y normas con rango de ley
• Cuestiones de inconstitucionalidad planteadas por jueces y tribunales

**2. Protección de derechos fundamentales:**
• Recursos de amparo constitucional
• Protección frente a violaciones de derechos fundamentales

**3. Conflictos de competencia:**
• Entre el Estado y las Comunidades Autónomas
• Entre Comunidades Autónomas entre sí
• Entre órganos constitucionales del Estado

**4. Otras competencias:**
• Control previo de constitucionalidad de tratados internacionales
• Declaración sobre la constitucionalidad de los partidos políticos
• Resolución de conflictos en defensa de la autonomía local`
    },
    5: {
      title: "5. Procedimientos ante el Tribunal",
      content: `Los principales procedimientos ante el Tribunal Constitucional son:

**Recurso de inconstitucionalidad:**
• Legitimados: Presidente del Gobierno, 50 Diputados, 50 Senadores, órganos ejecutivos y asambleas de las CCAA, Defensor del Pueblo
• Plazo: 3 meses desde la publicación
• Objeto: leyes, normas con rango de ley

**Cuestión de inconstitucionalidad:**
• Planteada por jueces y tribunales
• Cuando consideren que una norma aplicable puede ser inconstitucional
• Procedimiento: auto motivado dirigido al TC

**Recurso de amparo:**
• Legitimación: cualquier persona física o jurídica
• Objeto: protección de derechos fundamentales
• Requisitos: agotamiento de la vía judicial previa
• Plazo: 30 días desde la notificación

**Tramitación:**
- Admisión a trámite
- Alegaciones de las partes
- Vista pública (si procede)
- Deliberación y fallo`
    },
    6: {
      title: "6. Efectos de las Sentencias",
      content: `Las sentencias del Tribunal Constitucional tienen efectos muy específicos:

**Características generales:**
• **Vinculación**: vinculan a todos los poderes públicos
• **Publicación**: se publican en el BOE
• **Cosa juzgada**: tienen valor de cosa juzgada

**Efectos según el tipo de sentencia:**

**Sentencias en recursos de inconstitucionalidad:**
- Efectos erga omnes (frente a todos)
- Nulidad de la norma declarada inconstitucional
- Efectos retroactivos, salvo en materia penal o sancionadora

**Sentencias en recursos de amparo:**
- Efectos inter partes (entre las partes)
- Restablecimiento del recurrente en la integridad de su derecho
- Anulación de la decisión, acto o resolución impugnados

**Sentencias interpretativas:**
- No declaran la inconstitucionalidad, sino que fijan la interpretación conforme a la Constitución
- Efectos vinculantes para todos los poderes públicos

**Autos de inadmisión:**
- No entran en el fondo del asunto
- Efectos limitados al caso concreto`
    }
  }

  // Orden de las secciones para navegación
  const sectionOrder = [1, 2, 3, 4, 5, 6]
  const currentIndex = sectionOrder.indexOf(activeSection)
  const previousSection = currentIndex > 0 ? sectionOrder[currentIndex - 1] : null
  const nextSection = currentIndex < sectionOrder.length - 1 ? sectionOrder[currentIndex + 1] : null

  const handlePrint = () => {
    const printContent = `
      <html>
        <head>
          <title>Tema 2: El Tribunal Constitucional</title>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            h1 { color: #dc2626; border-bottom: 3px solid #dc2626; padding-bottom: 10px; }
            h2 { color: #ea580c; margin-top: 30px; }
            ul, ol { margin-left: 20px; }
            strong { color: #991b1b; }
            .section { margin-bottom: 30px; page-break-inside: avoid; }
            @media print { .section { page-break-inside: avoid; } }
          </style>
        </head>
        <body>
          <h1>Tema 2: El Tribunal Constitucional</h1>
          <p><strong>Auxiliar Administrativo del Estado - Material Oficial 2025</strong></p>
          ${sectionOrder.map(num => `
            <div class="section">
              <h2>${sections[num].title}</h2>
              <div>${sections[num].content.replace(/\n/g, '<br>')}</div>
            </div>
          `).join('')}
        </body>
      </html>
    `
    
    const printWindow = window.open('', '_blank')
    printWindow.document.write(printContent)
    printWindow.document.close()
    printWindow.print()
  }

  if (showFullContent) {
    return (
      <div className="bg-white rounded-lg shadow-lg overflow-hidden">
        {/* Header del contenido completo */}
        <div className="bg-gradient-to-r from-red-600 to-orange-600 text-white p-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold">Tema 2 - Contenido Completo</h2>
              <p className="opacity-90">El Tribunal Constitucional</p>
            </div>
            <div className="flex items-center space-x-3">
              <button
                onClick={handlePrint}
                className="bg-white/20 hover:bg-white/30 px-4 py-2 rounded-lg transition-colors flex items-center"
              >
                <span className="mr-2">🖨️</span>
                Imprimir
              </button>
              <button
                onClick={() => setShowFullContent(false)}
                className="bg-white/20 hover:bg-white/30 px-4 py-2 rounded-lg transition-colors"
              >
                ✕ Cerrar
              </button>
            </div>
          </div>
        </div>

        {/* Contenido completo */}
        <div className="p-8 max-h-[70vh] overflow-y-auto">
          {sectionOrder.map((num) => (
            <div key={num} className="mb-8 pb-6 border-b border-gray-200 last:border-b-0">
              <h3 className="text-xl font-bold text-red-700 mb-4">{sections[num].title}</h3>
              <div className="text-gray-700 whitespace-pre-line leading-relaxed">
                {sections[num].content}
              </div>
            </div>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto">
      {/* Secciones del tema */}
      <div className="grid gap-4 mb-8">
        {sectionOrder.map((num) => (
          <div key={num} className="bg-white rounded-lg shadow-md overflow-hidden hover:shadow-lg transition-shadow">
            <button
              onClick={() => setActiveSection(activeSection === num ? null : num)}
              className="w-full p-4 text-left flex items-center justify-between bg-gradient-to-r from-red-50 to-orange-50 hover:from-red-100 hover:to-orange-100 transition-colors"
            >
              <span className="font-semibold text-red-800">{sections[num].title}</span>
              <span className="text-red-600 text-xl">
                {activeSection === num ? '−' : '+'}
              </span>
            </button>
            
            {activeSection === num && (
              <div className="p-6 bg-white border-t border-red-100">
                <div className="text-gray-700 whitespace-pre-line leading-relaxed mb-4">
                  {sections[num].content}
                </div>
                
                {/* Navegación entre secciones */}
                <div className="flex items-center justify-between pt-4 border-t border-gray-200">
                  <div>
                    {previousSection && (
                      <button
                        onClick={() => setActiveSection(previousSection)}
                        className="flex items-center text-red-600 hover:text-red-700 font-medium"
                      >
                        <span className="mr-2">←</span>
                        <span>{sections[previousSection].title}</span>
                      </button>
                    )}
                  </div>
                  
                  <div className="text-sm text-gray-500">
                    Sección {currentIndex + 1} de {sectionOrder.length}
                  </div>
                  
                  <div>
                    {nextSection && (
                      <button
                        onClick={() => setActiveSection(nextSection)}
                        className="flex items-center text-red-600 hover:text-red-700 font-medium"
                      >
                        <span>{sections[nextSection].title}</span>
                        <span className="ml-2">→</span>
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Botones de acción */}
      <div className="flex flex-col sm:flex-row gap-4 justify-center">
        <button
          onClick={() => setShowFullContent(true)}
          className="bg-gradient-to-r from-red-600 to-orange-600 text-white px-8 py-3 rounded-lg font-semibold hover:from-red-700 hover:to-orange-700 transition-colors flex items-center justify-center"
        >
          <span className="mr-2">📖</span>
          Ver Contenido Completo
        </button>
        
        <button
          onClick={handlePrint}
          className="bg-white border-2 border-red-600 text-red-600 px-8 py-3 rounded-lg font-semibold hover:bg-red-50 transition-colors flex items-center justify-center"
        >
          <span className="mr-2">🖨️</span>
          Imprimir Tema
        </button>
      </div>
    </div>
  )
}