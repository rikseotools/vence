// app/es/auxiliar-administrativo-estado/temario/tema-7/Tema7Interactive.js
'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'

export default function Tema7Interactive() {
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

  // Obtener orden de las secciones
  const sectionOrder = Object.keys(sections)
  const currentIndex = sectionOrder.indexOf(activeSection)
  const previousSection = currentIndex > 0 ? sectionOrder[currentIndex - 1] : null
  const nextSection = currentIndex < sectionOrder.length - 1 ? sectionOrder[currentIndex + 1] : null

  // Función para imprimir todo el contenido
  const handlePrint = () => {
    const printWindow = window.open('', '_blank')
    
    // Contenido específico para impresión del Tema 7
    const printContent = {
      preliminar: `
        <div class="article">
          <h3>ARTÍCULO 1. OBJETO</h3>
          <p>Esta Ley tiene por objeto <strong>ampliar y reforzar la transparencia</strong> de la actividad pública, <strong>regular y garantizar el derecho de acceso</strong> a la información relativa a aquella actividad y <strong>establecer las obligaciones de buen gobierno</strong> que deben cumplir los responsables públicos así como las consecuencias derivadas de su incumplimiento.</p>
          <div class="key-point"><strong>🎯 Clave examen:</strong> Triple finalidad - transparencia + acceso + buen gobierno</div>
        </div>
      `,
      transparencia: `
        <div class="article">
          <h3>ARTÍCULO 2. ÁMBITO SUBJETIVO</h3>
          <p>Las disposiciones de este título se aplicarán a:</p>
          <h4>🏛️ Administraciones Públicas:</h4>
          <ul>
            <li><strong>a)</strong> AGE, CCAA, Ciudades de Ceuta y Melilla, EELL</li>
            <li><strong>b)</strong> Entidades Seguridad Social y mutuas</li>
            <li><strong>c)</strong> Organismos autónomos, Agencias Estatales</li>
            <li><strong>d)</strong> Entidades Derecho Público</li>
            <li><strong>e)</strong> Corporaciones Derecho Público</li>
          </ul>
          <h4>🏢 Otros Sujetos:</h4>
          <ul>
            <li><strong>f)</strong> Casa del Rey, Congreso, Senado, TC, CGPJ...</li>
            <li><strong>g)</strong> Sociedades mercantiles (>50% público)</li>
            <li><strong>h)</strong> Fundaciones sector público</li>
            <li><strong>i)</strong> Asociaciones de Administraciones</li>
          </ul>
          <div class="key-point"><strong>🎯 Clave examen:</strong> 9 letras (a-i), especial atención a f) y g) (>50%)</div>
        </div>
        <div class="article">
          <h3>ARTÍCULO 13. INFORMACIÓN PÚBLICA</h3>
          <p>Se entiende por información pública los <strong>contenidos o documentos</strong>, cualquiera que sea su formato o soporte, que <strong>obren en poder</strong> de alguno de los sujetos incluidos en el ámbito de aplicación de este título y que hayan sido <strong>elaborados o adquiridos</strong> en el ejercicio de sus funciones.</p>
          <div class="key-point"><strong>🎯 Clave examen:</strong> "elaborados o adquiridos" (NO "creados")</div>
        </div>
      `,
      acceso: `
        <div class="article">
          <h3>ARTÍCULO 14. LÍMITES AL DERECHO DE ACCESO</h3>
          <p>El derecho de acceso podrá ser limitado cuando acceder a la información suponga un perjuicio para:</p>
          <ul>
            <li><strong>a)</strong> La seguridad nacional</li>
            <li><strong>b)</strong> La defensa</li>
            <li><strong>c)</strong> Las relaciones exteriores</li>
            <li><strong>d)</strong> La seguridad pública</li>
            <li><strong>e)</strong> La prevención, investigación y sanción de ilícitos penales, administrativos o disciplinarios</li>
            <li><strong>f)</strong> La igualdad de las partes en procesos judiciales y tutela judicial efectiva</li>
            <li><strong>g)</strong> Las funciones administrativas de vigilancia, inspección y control</li>
            <li><strong>h)</strong> Los intereses económicos y comerciales</li>
            <li><strong>i)</strong> La política económica y monetaria</li>
            <li><strong>j)</strong> El secreto profesional y la propiedad intelectual e industrial</li>
            <li><strong>k)</strong> La garantía de confidencialidad o el secreto requerido en procesos de toma de decisión</li>
            <li><strong>l)</strong> La protección del medio ambiente</li>
          </ul>
          <div class="key-point"><strong>🎯 Clave examen:</strong> 12 límites (letras a-l) - El más preguntado del tema</div>
        </div>
      `,
      buen_gobierno: `
        <div class="article">
          <h3>ARTÍCULO 25. ÁMBITO SUBJETIVO</h3>
          <p>Las disposiciones de este título serán de aplicación a quienes ejerzan la alta dirección de los órganos directivos, con rango de Director General o superior, de la Administración General del Estado y entidades de derecho público vinculadas o dependientes de la misma.</p>
          <div class="key-point"><strong>🎯 Clave examen:</strong> Director General o superior - AGE y entidades vinculadas</div>
        </div>
        <div class="article">
          <h3>ARTÍCULO 26. PRINCIPIOS DE ACTUACIÓN</h3>
          <p>Los responsables públicos observarán en su actuación los principios generales que rigen el funcionamiento de la Administración Pública y, además, los principios de:</p>
          <ul>
            <li>1. Diligencia en el cumplimiento de sus funciones</li>
            <li>2. Información y transparencia en la gestión pública</li>
            <li>3. Ejemplaridad</li>
            <li>4. Austeridad en la gestión de los recursos públicos</li>
            <li>5. Accesibilidad en el trato con los ciudadanos</li>
            <li>6. Responsabilidad por las decisiones y actuaciones propias y de los organismos que dirigen</li>
            <li>7. Dedicación al servicio público que desempeñan</li>
            <li>8. Lealtad y buena fe</li>
            <li>9. Imparcialidad</li>
            <li>10. Objetividad</li>
          </ul>
          <div class="key-point"><strong>🎯 Clave examen:</strong> 10 principios - Memorizar todos</div>
        </div>
      `,
      consejo: `
        <div class="article">
          <h3>ARTÍCULO 33. CONSEJO DE TRANSPARENCIA Y BUEN GOBIERNO</h3>
          <p>Se crea el Consejo de Transparencia y Buen Gobierno como <strong>Autoridad Administrativa Independiente</strong>, con <strong>personalidad jurídica propia</strong> y <strong>plena autonomía</strong> orgánica y funcional.</p>
          <div class="key-point"><strong>🎯 Clave examen:</strong> AAI + personalidad jurídica + plena autonomía</div>
        </div>
        <div class="article">
          <h3>ARTÍCULO 35. PRESIDENTE</h3>
          <p>El Consejo estará dirigido por un Presidente, nombrado por <strong>real decreto del Consejo de Ministros</strong> por un período de <strong>seis años</strong>, sin posibilidad de <strong>reelección</strong>.</p>
          <div class="key-point"><strong>🎯 Clave examen:</strong> Real decreto + 6 años + no reelección</div>
        </div>
        <div class="article">
          <h3>ARTÍCULO 36. COMISIÓN DE TRANSPARENCIA</h3>
          <p>La Comisión de Transparencia y Buen Gobierno estará integrada por <strong>ocho miembros</strong> designados por un período de <strong>cinco años</strong>.</p>
          <div class="key-point"><strong>🎯 Clave examen:</strong> 8 miembros + 5 años</div>
        </div>
      `
    }
    
    const allContent = sectionOrder.map(key => {
      const section = sections[key]
      return `
        <div style="page-break-before: always; margin-bottom: 30px;">
          <h2 style="color: #1f2937; font-size: 24px; font-weight: bold; margin-bottom: 20px; border-bottom: 3px solid #e11d48; padding-bottom: 10px;">
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
        <title>Tema 7: Ley 19/2013 de Transparencia - Contenido Completo</title>
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
            border-bottom: 4px solid #e11d48;
            padding-bottom: 15px;
          }
          h2 { 
            color: #1f2937; 
            font-size: 20px; 
            margin-top: 25px; 
            margin-bottom: 15px;
            background-color: #f3f4f6;
            padding: 10px;
            border-left: 4px solid #e11d48;
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
        <h1>📚 TEMA 7: LEY 19/2013 DE TRANSPARENCIA</h1>
        <p style="text-align: center; color: #6b7280; margin-bottom: 40px;">
          Acceso a la información pública y buen gobierno<br>
          Material oficial actualizado 2025 - ilovetest.pro
        </p>
        ${allContent}
        <div style="text-align: center; margin-top: 40px; padding-top: 20px; border-top: 2px solid #e5e7eb; color: #6b7280; font-size: 14px;">
          <p>© ilovetest.pro - Preparación Inteligente para Oposiciones</p>
          <p>Tema 7: Ley 19/2013 de Transparencia - Auxiliar Administrativo del Estado</p>
        </div>
      </body>
      </html>
    `)
    printWindow.document.close()
    printWindow.print()
  }

  // Contenido por secciones para móvil
  const sections = {
    preliminar: {
      title: "📖 TÍTULO PRELIMINAR",
      content: (
        <div className="space-y-6">
          <article className="bg-rose-50 border-l-4 border-rose-400 p-4 rounded-lg">
            <h3 className="text-lg font-bold text-rose-800 mb-3">ARTÍCULO 1. OBJETO</h3>
            <p className="text-gray-700 leading-relaxed mb-3">
              Esta Ley tiene por objeto <strong>ampliar y reforzar la transparencia</strong> de la 
              actividad pública, <strong>regular y garantizar el derecho de acceso</strong> a la 
              información relativa a aquella actividad y <strong>establecer las obligaciones 
              de buen gobierno</strong> que deben cumplir los responsables públicos así como 
              las consecuencias derivadas de su incumplimiento.
            </p>
            <div className="text-sm text-rose-700 bg-rose-100 p-3 rounded">
              <strong>🎯 Clave examen:</strong> Triple finalidad - transparencia + acceso + buen gobierno
            </div>
          </article>
        </div>
      )
    },
    transparencia: {
      title: "🔍 TÍTULO I: TRANSPARENCIA",
      content: (
        <div className="space-y-6">
          {/* Artículo 2 */}
          <article className="bg-blue-50 border-l-4 border-blue-400 p-4 rounded-lg">
            <h3 className="text-lg font-bold text-blue-800 mb-3">ARTÍCULO 2. ÁMBITO SUBJETIVO</h3>
            <p className="text-gray-700 mb-3">Las disposiciones de este título se aplicarán a:</p>
            <div className="space-y-3">
              <div className="bg-white p-3 rounded">
                <div className="font-semibold text-blue-700 mb-2">🏛️ Administraciones Públicas:</div>
                <ul className="space-y-1 text-sm text-gray-600">
                  <li><strong>a)</strong> AGE, CCAA, Ciudades de Ceuta y Melilla, EELL</li>
                  <li><strong>b)</strong> Entidades Seguridad Social y mutuas</li>
                  <li><strong>c)</strong> Organismos autónomos, Agencias Estatales</li>
                  <li><strong>d)</strong> Entidades Derecho Público</li>
                  <li><strong>e)</strong> Corporaciones Derecho Público</li>
                </ul>
              </div>
              <div className="bg-white p-3 rounded">
                <div className="font-semibold text-blue-700 mb-2">🏢 Otros Sujetos:</div>
                <ul className="space-y-1 text-sm text-gray-600">
                  <li><strong>f)</strong> Casa del Rey, Congreso, Senado, TC, CGPJ...</li>
                  <li><strong>g)</strong> Sociedades mercantiles (&gt;50% público)</li>
                  <li><strong>h)</strong> Fundaciones sector público</li>
                  <li><strong>i)</strong> Asociaciones de Administraciones</li>
                </ul>
              </div>
            </div>
            <div className="mt-3 text-sm text-blue-700 bg-blue-100 p-3 rounded">
              <strong>🎯 Clave examen:</strong> 9 letras (a-i), especial atención a f) y g) (&gt;50%)
            </div>
          </article>

          {/* Artículo 13 */}
          <article className="bg-green-50 border-l-4 border-green-400 p-4 rounded-lg">
            <h3 className="text-lg font-bold text-green-800 mb-3">ARTÍCULO 13. INFORMACIÓN PÚBLICA</h3>
            <p className="text-gray-700 leading-relaxed mb-3">
              Se entiende por información pública los <strong>contenidos o documentos</strong>, 
              cualquiera que sea su formato o soporte, que <strong>obren en poder</strong> de alguno 
              de los sujetos incluidos en el ámbito de aplicación de este título y que hayan sido 
              <strong>elaborados o adquiridos</strong> en el ejercicio de sus funciones.
            </p>
            <div className="text-sm text-green-700 bg-green-100 p-3 rounded">
              <strong>🎯 Clave examen:</strong> "elaborados o adquiridos" (NO "creados")
            </div>
          </article>

          {/* Artículo 14 */}
          <article className="bg-orange-50 border-l-4 border-orange-400 p-4 rounded-lg">
            <h3 className="text-lg font-bold text-orange-800 mb-3">ARTÍCULO 14. LÍMITES AL DERECHO DE ACCESO 🔥</h3>
            <p className="text-gray-700 mb-3">El derecho de acceso podrá ser limitado cuando acceder a la información suponga un perjuicio para:</p>
            <div className="space-y-3">
              <div className="bg-white p-3 rounded">
                <h4 className="font-semibold text-orange-700 mb-2">🛡️ SEGURIDAD (a-d)</h4>
                <ul className="space-y-1 text-sm text-gray-600">
                  <li><strong>a)</strong> La seguridad nacional</li>
                  <li><strong>b)</strong> La defensa</li>
                  <li><strong>c)</strong> Las relaciones exteriores</li>
                  <li><strong>d)</strong> La seguridad pública</li>
                </ul>
              </div>
              <div className="bg-white p-3 rounded">
                <h4 className="font-semibold text-orange-700 mb-2">⚖️ JUSTICIA (e-g)</h4>
                <ul className="space-y-1 text-sm text-gray-600">
                  <li><strong>e)</strong> Prevención, investigación y sanción ilícitos</li>
                  <li><strong>f)</strong> Igualdad partes procesos judiciales</li>
                  <li><strong>g)</strong> Funciones vigilancia, inspección y control</li>
                </ul>
              </div>
              <div className="bg-white p-3 rounded">
                <h4 className="font-semibold text-orange-700 mb-2">💰 ECONOMÍA (h-i)</h4>
                <ul className="space-y-1 text-sm text-gray-600">
                  <li><strong>h)</strong> Intereses económicos y comerciales</li>
                  <li><strong>i)</strong> Política económica y monetaria</li>
                </ul>
              </div>
              <div className="bg-white p-3 rounded">
                <h4 className="font-semibold text-orange-700 mb-2">🔒 OTROS (j-l)</h4>
                <ul className="space-y-1 text-sm text-gray-600">
                  <li><strong>j)</strong> Secreto profesional y propiedad intelectual</li>
                  <li><strong>k)</strong> Confidencialidad en toma de decisión</li>
                  <li><strong>l)</strong> Protección del medio ambiente</li>
                </ul>
              </div>
            </div>
            <div className="text-sm text-orange-700 bg-orange-100 p-3 rounded">
              <strong>🎯 Clave examen:</strong> 12 límites exactos (a-l), NO incluir "orden público"
            </div>
          </article>

          {/* Artículo 24 */}
          <article className="bg-red-50 border-l-4 border-red-400 p-4 rounded-lg">
            <h3 className="text-lg font-bold text-red-800 mb-3">ARTÍCULO 24. RECLAMACIÓN ANTE EL CTBG</h3>
            <p className="text-gray-700 mb-3">Frente a toda resolución expresa o presunta en materia de acceso:</p>
            <div className="bg-white p-3 rounded space-y-2">
              <div><strong>Plazo interposición:</strong> 1 mes desde notificación o silencio</div>
              <div><strong>Plazo resolución:</strong> 3 meses máximo</div>
              <div><strong>Competencia:</strong> Consejo de Transparencia y Buen Gobierno</div>
              <div><strong>Carácter:</strong> Potestativo y previo a contencioso-administrativo</div>
            </div>
            <div className="mt-3 text-sm text-red-700 bg-red-100 p-3 rounded">
              <strong>🎯 Clave examen:</strong> 1 mes + 3 meses + CTBG
            </div>
          </article>
        </div>
      )
    },
    buengobierno: {
      title: "⚖️ TÍTULO II: BUEN GOBIERNO",
      content: (
        <div className="space-y-6">
          {/* Artículo 25 */}
          <article className="bg-green-50 border-l-4 border-green-400 p-4 rounded-lg">
            <h3 className="text-lg font-bold text-green-800 mb-3">ARTÍCULO 25. ÁMBITO SUBJETIVO 🔥</h3>
            <p className="text-gray-700 mb-3">Se aplicará a personas que ejerzan altos cargos:</p>
            <div className="bg-white p-3 rounded space-y-2 text-sm">
              <div><strong>a)</strong> Miembros del Gobierno y Secretarios de Estado</div>
              <div><strong>b)</strong> Miembros órganos gobierno CCAA</div>
              <div><strong>c)</strong> Miembros Corporaciones Locales (dedicación exclusiva)</div>
              <div><strong>d)</strong> Máximos responsables entidades arts. 2 y 3</div>
            </div>
          </article>

          {/* Artículo 26 */}
          <article className="bg-cyan-50 border-l-4 border-cyan-400 p-4 rounded-lg">
            <h3 className="text-lg font-bold text-cyan-800 mb-3">ARTÍCULO 26. PRINCIPIOS GENERALES 🔥</h3>
            <p className="text-gray-700 mb-3">Observarán los siguientes principios:</p>
            <div className="bg-white p-3 rounded space-y-2 text-sm">
              <div><strong>a)</strong> Eficacia, economía y eficiencia</div>
              <div><strong>b)</strong> No influir en tramitación sin justa causa</div>
              <div><strong>c)</strong> Cumplir con diligencia y resolver en plazo</div>
              <div><strong>d)</strong> Dedicación al servicio público y neutralidad</div>
              <div><strong>e)</strong> Guardar debida reserva</div>
              <div><strong>f)</strong> Mantener conducta digna</div>
              <div><strong>g)</strong> Abstenerse en conflictos de intereses</div>
            </div>
          </article>
        </div>
      )
    },
    consejo: {
      title: "🏛️ TÍTULO III: CONSEJO DE TRANSPARENCIA",
      content: (
        <div className="space-y-6">
          {/* Artículo 33 */}
          <article className="bg-indigo-50 border-l-4 border-indigo-400 p-4 rounded-lg">
            <h3 className="text-lg font-bold text-indigo-800 mb-3">ARTÍCULO 33. CONSEJO DE TRANSPARENCIA Y BUEN GOBIERNO</h3>
            <div className="space-y-3">
              <p className="text-gray-700">Se crea el <strong>Consejo de Transparencia y Buen Gobierno</strong> como <strong>Autoridad Administrativa Independiente</strong>.</p>
              <p className="text-gray-700">Tiene <strong>personalidad jurídica propia</strong> y plena capacidad de obrar. Actúa con <strong>autonomía orgánica y funcional</strong> y plena independencia.</p>
            </div>
            <div className="text-sm text-indigo-700 bg-indigo-100 p-3 rounded">
              <strong>🎯 Presidente:</strong> 6 años no renovable • <strong>Comisión:</strong> 8 miembros
            </div>
          </article>
        </div>
      )
    },
    resumen: {
      title: "🎯 RESUMEN Y TIPS",
      content: (
        <div className="space-y-6">
          {/* Artículos Clave */}
          <div className="bg-yellow-50 border-2 border-yellow-300 rounded-lg p-4">
            <h3 className="text-lg font-bold text-yellow-800 mb-3">🔥 ARTÍCULOS MÁS PREGUNTADOS</h3>
            <div className="space-y-3">
              <div className="bg-white p-3 rounded">
                <h4 className="font-bold text-red-700 mb-2">🔥 Críticos (&gt;80%)</h4>
                <ul className="text-sm space-y-1 text-gray-700">
                  <li>• <strong>Art. 1</strong> - Objeto (95% exámenes)</li>
                  <li>• <strong>Art. 13</strong> - Información pública (90%)</li>
                  <li>• <strong>Art. 2</strong> - Ámbito subjetivo (85%)</li>
                  <li>• <strong>Art. 24</strong> - Reclamaciones (80%)</li>
                </ul>
              </div>
              
              <div className="bg-white p-3 rounded">
                <h4 className="font-bold text-orange-700 mb-2">⚡ Importantes (&gt;60%)</h4>
                <ul className="text-sm space-y-1 text-gray-700">
                  <li>• <strong>Art. 14</strong> - Límites acceso (75%)</li>
                  <li>• <strong>Art. 33-40</strong> - Consejo (70%)</li>
                  <li>• <strong>Art. 25</strong> - Ámbito buen gobierno (60%)</li>
                  <li>• <strong>Art. 26</strong> - Principios actuación (50%)</li>
                </ul>
              </div>
            </div>
          </div>

          {/* Esquemas de Memorización */}
          <div className="bg-purple-50 border-2 border-purple-300 rounded-lg p-4">
            <h3 className="text-lg font-bold text-purple-800 mb-3">🧠 ESQUEMAS MEMORIZACIÓN</h3>
            
            <div className="space-y-4">
              <div className="bg-white p-3 rounded">
                <h4 className="font-bold text-purple-700 mb-2">🎯 Art. 14 - Los 12 Límites</h4>
                <div className="text-sm space-y-2">
                  <div>🛡️ <strong>SEGURIDAD</strong> (a-d): Nacional, Defensa, Exteriores, Pública</div>
                  <div>⚖️ <strong>JUSTICIA</strong> (e-g): Ilícitos, Procesos, Vigilancia</div>
                  <div>💰 <strong>ECONOMÍA</strong> (h-i): Comerciales, Monetaria</div>
                  <div>🔒 <strong>OTROS</strong> (j-l): Profesional, Confidencial, Ambiente</div>
                </div>
              </div>
              
              <div className="bg-white p-3 rounded">
                <h4 className="font-bold text-purple-700 mb-2">👥 Art. 25 - Altos Cargos</h4>
                <div className="text-sm space-y-1">
                  <div><strong>a)</strong> Gobierno + Secretarios Estado</div>
                  <div><strong>b)</strong> Órganos gobierno CCAA</div>
                  <div><strong>c)</strong> Corporaciones (dedicación exclusiva)</div>
                  <div><strong>d)</strong> Máximos responsables arts. 2 y 3</div>
                </div>
              </div>
            </div>
          </div>

          {/* Consejos de Estudio */}
          <div className="bg-emerald-50 border-2 border-emerald-300 rounded-lg p-4">
            <h3 className="text-lg font-bold text-emerald-800 mb-3">📚 CONSEJOS DE ESTUDIO</h3>
            <div className="space-y-3">
              <div className="bg-white p-3 rounded">
                <h4 className="font-bold text-emerald-700 mb-2">✅ Prioritario</h4>
                <ul className="text-sm space-y-1 text-gray-700">
                  <li>• Memorizar Art. 1 palabra por palabra</li>
                  <li>• Dominar las 9 letras del Art. 2</li>
                  <li>• Conocer los 12 límites del Art. 14</li>
                  <li>• Plazos del Art. 24 (1 mes + 3 meses)</li>
                </ul>
              </div>
              
              <div className="bg-white p-3 rounded">
                <h4 className="font-bold text-emerald-700 mb-2">📖 Recomendaciones</h4>
                <ul className="text-sm space-y-1 text-gray-700">
                  <li>• Hacer tests después de cada título</li>
                  <li>• Repasar artículos HOT semanalmente</li>
                  <li>• Practicar definiciones textuales</li>
                  <li>• Simular exámenes completos</li>
                </ul>
              </div>
            </div>
          </div>

          {/* Test Rápido */}
          <div className="bg-amber-50 border-2 border-amber-300 rounded-lg p-4">
            <h3 className="text-lg font-bold text-amber-800 mb-3">⚡ TEST RÁPIDO</h3>
            
            <div className="space-y-4">
              <div className="bg-white p-3 rounded border">
                <p className="font-medium mb-2">🔥 ¿Cuál NO es un límite del Art. 14?</p>
                <div className="space-y-1 text-sm mb-3">
                  <div>a) Seguridad nacional</div>
                  <div>b) Orden público</div>
                  <div>c) Defensa</div>
                  <div>d) Protección medio ambiente</div>
                </div>
                <div className="text-amber-700 font-bold text-sm bg-amber-100 p-2 rounded">
                  <strong>Respuesta:</strong> b) Orden público - No está en el Art. 14
                </div>
              </div>

              <div className="bg-white p-3 rounded border">
                <p className="font-medium mb-2">🔥 Mandato del Presidente CTBG:</p>
                <div className="space-y-1 text-sm mb-3">
                  <div>a) 4 años renovable</div>
                  <div>b) 6 años renovable</div>
                  <div>c) 6 años no renovable</div>
                  <div>d) 5 años no renovable</div>
                </div>
                <div className="text-amber-700 font-bold text-sm bg-amber-100 p-2 rounded">
                  <strong>Respuesta:</strong> c) 6 años no renovable - Art. 37.1
                </div>
              </div>
            </div>
          </div>
        </div>
      )
    }
  }

  return (
    <>
      {/* Botones de Acción */}
      <div className="text-center">
        <div className="max-w-md mx-auto space-y-4">
          <button 
            onClick={() => setShowModal(true)}
            className="w-full bg-rose-600 hover:bg-rose-700 text-white px-6 py-4 rounded-lg font-bold text-lg transition-colors shadow-lg hover:shadow-xl"
            aria-label="Estudiar contenido completo del Tema 7"
          >
            📖 Estudiar Tema Completo
          </button>
          
          <Link 
            href="/es/auxiliar-administrativo-estado/test/tema/7"
            className="block w-full bg-blue-600 hover:bg-blue-700 text-white px-6 py-4 rounded-lg font-bold text-lg transition-colors text-center shadow-lg hover:shadow-xl"
            aria-label="Realizar tests del Tema 7"
          >
            🎯 Hacer Tests del Tema
          </Link>

          <Link 
            href="/es/auxiliar-administrativo-estado/temario"
            className="block w-full bg-gray-600 hover:bg-gray-700 text-white px-6 py-3 rounded-lg font-medium transition-colors text-center shadow-lg hover:shadow-xl"
            aria-label="Volver al temario completo"
          >
            ← Volver al Temario
          </Link>
        </div>
      </div>

      {/* Modal Optimizado para Móvil */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-2 md:p-4" role="dialog" aria-labelledby="modal-title" aria-modal="true">
          <div className="bg-white rounded-lg shadow-2xl w-full h-full md:max-w-6xl md:max-h-[90vh] md:h-auto flex flex-col">
            {/* Header del Modal */}
            <header className="flex items-center justify-between p-4 md:p-6 border-b border-gray-200 bg-gradient-to-r from-rose-600 to-pink-600 text-white rounded-t-lg">
              <div className="flex-1 min-w-0">
                <h2 id="modal-title" className="text-lg md:text-2xl font-bold truncate">📚 Tema 7: Ley 19/2013</h2>
                <p className="text-rose-100 text-xs md:text-sm">Transparencia y buen gobierno • 28 páginas</p>
              </div>
              <button 
                onClick={handleCloseModal}
                className="ml-2 text-white hover:text-gray-300 text-2xl font-bold p-2 hover:bg-white/10 rounded-full transition-colors flex-shrink-0"
                aria-label="Cerrar modal del tema"
              >
                ✕
              </button>
            </header>
            
            {/* Navegación móvil */}
            <div className="md:hidden border-b border-gray-200">
              <button 
                onClick={() => setShowMobileMenu(!showMobileMenu)}
                className="w-full p-3 bg-gray-50 text-left font-medium text-gray-800 flex items-center justify-between"
              >
                <span>{sections[activeSection].title}</span>
                <span className={`transform transition-transform ${showMobileMenu ? 'rotate-180' : ''}`}>▼</span>
              </button>
              
              {showMobileMenu && (
                <div className="bg-gray-50 border-t border-gray-200">
                  {Object.entries(sections).map(([key, section]) => (
                    <button
                      key={key}
                      onClick={() => navigateToSection(key)}
                      className={`w-full p-3 text-left text-sm border-b border-gray-200 transition-colors ${
                        activeSection === key 
                          ? 'bg-blue-100 text-blue-800 font-medium' 
                          : 'hover:bg-gray-100'
                      }`}
                    >
                      {section.title}
                    </button>
                  ))}
                </div>
              )}
            </div>
            
            {/* Contenido del Modal */}
            <div className="flex flex-1 overflow-hidden">
              {/* Sidebar Desktop */}
              <nav className="hidden md:block w-80 bg-gray-50 border-r border-gray-200 p-4 overflow-y-auto" aria-label="Índice de contenidos">
                <h3 className="font-bold text-gray-800 mb-4">📋 Índice de Contenidos</h3>
                <div className="space-y-2 text-sm">
                  {Object.entries(sections).map(([key, section]) => (
                    <button
                      key={key}
                      onClick={() => setActiveSection(key)}
                      className={`w-full text-left p-2 rounded transition-colors ${
                        activeSection === key 
                          ? 'bg-blue-100 text-blue-800 font-semibold' 
                          : 'text-blue-700 hover:text-blue-900 hover:bg-blue-50'
                      }`}
                    >
                      {section.title}
                    </button>
                  ))}
                </div>
                
                <div className="mt-6 p-3 bg-blue-50 rounded-lg border border-blue-200">
                  <h4 className="font-bold text-blue-800 text-sm mb-2">🎯 Artículos Clave</h4>
                  <div className="text-xs text-blue-700 space-y-1">
                    <div>• Art. 1 - Objeto (95% exámenes)</div>
                    <div>• Art. 2 - Ámbito (85% exámenes)</div>
                    <div>• Art. 14 - Límites (75% exámenes)</div>
                    <div>• Art. 24 - Reclamaciones (80%)</div>
                  </div>
                </div>

                <div className="mt-4 p-3 bg-yellow-50 rounded-lg border border-yellow-200">
                  <h4 className="font-bold text-yellow-800 text-sm mb-2">🔥 Artículos Hot</h4>
                  <div className="text-xs text-yellow-700 space-y-1">
                    <div>• Art. 14 - Más preguntado</div>
                    <div>• Art. 25 - Súper crítico</div>
                    <div>• Art. 26 - Súper crítico</div>
                    <div>• Art. 21 - Muy frecuente</div>
                  </div>
                </div>
              </nav>
              
              {/* Contenido Principal - Adaptado para móvil */}
              <main className="flex-1 p-4 md:p-6 overflow-y-auto">
                <div className="max-w-none">
                  <h2 className="text-xl md:text-2xl font-bold text-gray-800 mb-4 md:mb-6 border-b-2 border-rose-200 pb-2">
                    {sections[activeSection].title}
                  </h2>
                  {sections[activeSection].content}
                  
                  {/* Navegación entre secciones */}
                  <div className="mt-8 pt-6 border-t border-gray-200">
                    <div className="flex justify-between items-center">
                      {/* Sección Anterior */}
                      <div className="flex-1">
                        {previousSection ? (
                          <button
                            onClick={() => setActiveSection(previousSection)}
                            className="flex items-center text-rose-600 hover:text-rose-800 transition-colors group"
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
                                index === currentIndex ? 'bg-rose-600' : 'bg-gray-300'
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
                            className="flex items-center text-rose-600 hover:text-rose-800 transition-colors group"
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
              </main>
            </div>
            
            {/* Footer del Modal */}
            <div className="border-t border-gray-200 p-3 md:p-4 bg-gray-50 rounded-b-lg">
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 md:gap-0">
                <div className="text-xs md:text-sm text-gray-600 text-center md:text-left">
                  📄 Ley 19/2013 • 28 páginas • 40 artículos clave • Actualizado 2025
                </div>
                <div className="flex gap-2 justify-center md:justify-end">
                  <button 
                    onClick={() => window.print()}
                    className="text-gray-600 hover:text-gray-800 text-xs md:text-sm px-3 py-1 border border-gray-300 rounded transition-colors"
                  >
                    📄 Imprimir
                  </button>
                  <Link 
                    href="/es/auxiliar-administrativo-estado/test/tema/7"
                    className="bg-blue-600 hover:bg-blue-700 text-white text-xs md:text-sm px-4 py-2 rounded transition-colors"
                  >
                    🎯 Hacer Tests
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
