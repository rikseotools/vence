// app/es/auxiliar-administrativo-estado/temario/tema-4/Tema4Interactive.js - COMPONENTE INTERACTIVO TEMA 4
'use client'
import { useState } from 'react'

export default function Tema4Interactive() {
  const [activeSection, setActiveSection] = useState(0)

  // Secciones del tema
  const sections = [
    {
      id: 'marco-constitucional',
      title: '⚖️ Marco Constitucional del Poder Judicial',
      content: `
        <h3>El Poder Judicial en la Constitución (Arts. 117-127)</h3>
        
        <div class="bg-amber-50 p-4 rounded mb-4">
          <h4>📜 Principios Fundamentales (Art. 117 CE)</h4>
          <ul>
            <li><strong>Potestad jurisdiccional:</strong> Corresponde exclusivamente a Juzgados y Tribunales</li>
            <li><strong>Unidad jurisdiccional:</strong> Base de organización y funcionamiento</li>
            <li><strong>Independencia:</strong> Inamovibles, responsables y sometidos únicamente al imperio de la ley</li>
            <li><strong>Gratuidad:</strong> La justicia será gratuita cuando así lo disponga la ley</li>
          </ul>
        </div>

        <h4>🏛️ Organización Judicial (Art. 122)</h4>
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
          <div class="bg-blue-50 p-4 rounded">
            <h5>📏 Ley Orgánica del Poder Judicial</h5>
            <p>La LOPJ determinará la constitución, funcionamiento y gobierno de los Juzgados y Tribunales</p>
          </div>
          <div class="bg-green-50 p-4 rounded">
            <h5>🗺️ Planta y Demarcación</h5>
            <p>Se determinará por Ley, previo informe del CGPJ</p>
          </div>
          <div class="bg-purple-50 p-4 rounded">
            <h5>👨‍⚖️ Especialización</h5>
            <p>Especialización jurisdiccional por materias</p>
          </div>
          <div class="bg-yellow-50 p-4 rounded">
            <h5>🏛️ Sede</h5>
            <p>Juzgados y Tribunales no podrán ejercer más función que la jurisdiccional</p>
          </div>
        </div>

        <div class="bg-red-50 p-4 rounded mt-4">
          <h5>🔥 Muy Preguntado en Exámenes</h5>
          <div class="space-y-2">
            <p><strong>Art. 117.3:</strong> "El ejercicio de la potestad jurisdiccional corresponde exclusivamente a los Juzgados y Tribunales"</p>
            <p><strong>Art. 117.4:</strong> "Los Juzgados y Tribunales no ejercerán más funciones que las jurisdiccionales"</p>
            <p><strong>Art. 122.1:</strong> "La LOPJ determinará la constitución, funcionamiento y gobierno de los Juzgados y Tribunales"</p>
          </div>
        </div>

        <h4>⚖️ Garantías Procesales (Arts. 120-121)</h4>
        <div class="space-y-4">
          <div class="bg-blue-50 p-4 rounded">
            <h5>🔓 Publicidad (Art. 120.1)</h5>
            <p>Las actuaciones judiciales serán públicas, con las excepciones que prevean las leyes de procedimiento.</p>
          </div>
          
          <div class="bg-green-50 p-4 rounded">
            <h5>📝 Motivación (Art. 120.3)</h5>
            <p>Las sentencias serán siempre motivadas y se pronunciarán en audiencia pública.</p>
          </div>

          <div class="bg-yellow-50 p-4 rounded">
            <h5>💬 Lenguas (Art. 121)</h5>
            <p>Los ciudadanos podrán usar las lenguas oficiales en sus relaciones con la Administración de Justicia.</p>
          </div>
        </div>
      `
    },
    {
      id: 'tribunal-supremo',
      title: '🏛️ El Tribunal Supremo',
      content: `
        <h3>El Tribunal Supremo</h3>
        
        <div class="bg-blue-50 p-4 rounded mb-4">
          <h4>🏛️ Naturaleza y Función</h4>
          <p>Órgano jurisdiccional superior en todos los órdenes, salvo en materia de garantías constitucionales (Art. 123.1 CE).</p>
        </div>

        <h4>📊 Composición y Estructura</h4>
        
        <div class="space-y-4">
          <div class="bg-red-50 p-4 rounded">
            <h5>🔥 Las 5 Salas del Tribunal Supremo</h5>
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mt-3">
              <div class="bg-white p-3 rounded border-l-4 border-red-500">
                <h6>1️⃣ Primera Sala - Civil</h6>
                <p class="text-sm">Derecho Civil, Mercantil, Registro Civil</p>
              </div>
              <div class="bg-white p-3 rounded border-l-4 border-blue-500">
                <h6>2️⃣ Segunda Sala - Penal</h6>
                <p class="text-sm">Jurisdicción penal y aforados</p>
              </div>
              <div class="bg-white p-3 rounded border-l-4 border-green-500">
                <h6>3️⃣ Tercera Sala - Contencioso</h6>
                <p class="text-sm">Contencioso-administrativo</p>
              </div>
              <div class="bg-white p-3 rounded border-l-4 border-purple-500">
                <h6>4️⃣ Cuarta Sala - Social</h6>
                <p class="text-sm">Orden jurisdiccional social</p>
              </div>
              <div class="bg-white p-3 rounded border-l-4 border-yellow-500">
                <h6>5️⃣ Quinta Sala - Militar</h6>
                <p class="text-sm">Jurisdicción militar</p>
              </div>
            </div>
          </div>
        </div>

        <h4>👑 Presidencia y Funciones</h4>
        <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div class="bg-purple-50 p-4 rounded">
            <h5>👨‍⚖️ Presidente del TS</h5>
            <ul>
              <li>Es también <strong>Presidente del CGPJ</strong></li>
              <li>Nombrado por el Rey a propuesta del CGPJ</li>
              <li>Mandato de 5 años</li>
              <li>Representa al Poder Judicial</li>
            </ul>
          </div>

          <div class="bg-green-50 p-4 rounded">
            <h5>⚖️ Funciones Principales</h5>
            <ul>
              <li><strong>Casación:</strong> Recurso contra sentencias</li>
              <li><strong>Revisión:</strong> Unificación de doctrina</li>
              <li><strong>Aforamiento:</strong> Juzgar altos cargos</li>
              <li><strong>Consultas:</strong> Informes sobre anteproyectos</li>
            </ul>
          </div>
        </div>

        <h4>🎯 Competencias Específicas</h4>
        
        <div class="space-y-3">
          <div class="bg-blue-50 p-4 rounded">
            <h5>🔍 Recurso de Casación</h5>
            <p>Conoce de los recursos de casación contra sentencias de Audiencias Provinciales y TSJ en los casos previstos por la Ley.</p>
          </div>

          <div class="bg-yellow-50 p-4 rounded">
            <h5>👨‍💼 Aforados (Sala Segunda)</h5>
            <ul>
              <li>Diputados y Senadores</li>
              <li>Magistrados del TC, TS, AN</li>
              <li>Presidente del CGPJ</li>
              <li>Defensor del Pueblo y adjuntos</li>
              <li>Ministros del Gobierno</li>
              <li>Presidentes de CCAA</li>
            </ul>
          </div>
        </div>

        <div class="bg-red-50 p-4 rounded mt-4">
          <h5>🔥 Muy Preguntado en Exámenes</h5>
          <div class="space-y-2">
            <p><strong>Salas:</strong> 5 Salas (Civil, Penal, Contencioso, Social, Militar)</p>
            <p><strong>Presidente:</strong> También preside el CGPJ</p>
            <p><strong>Función:</strong> Órgano jurisdiccional superior (salvo garantías constitucionales)</p>
          </div>
        </div>
      `
    },
    {
      id: 'cgpj',
      title: '🏛️ Consejo General del Poder Judicial',
      content: `
        <h3>Consejo General del Poder Judicial (Art. 122.2 y 3 CE)</h3>
        
        <div class="bg-blue-50 p-4 rounded mb-4">
          <h4>🏛️ Naturaleza Constitucional</h4>
          <p>Órgano de <strong>gobierno del Poder Judicial</strong> que garantiza la independencia de Jueces y Magistrados frente a los demás poderes del Estado.</p>
        </div>

        <h4>📊 Composición del CGPJ</h4>
        
        <div class="bg-green-50 p-4 rounded mb-4">
          <h5>👥 21 Miembros Total</h5>
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
            <div class="bg-white p-4 rounded border-l-4 border-blue-500">
              <h6>👑 Presidente</h6>
              <p><strong>Presidente del Tribunal Supremo</strong></p>
              <p class="text-sm text-blue-600">Nombrado por el Rey a propuesta del CGPJ</p>
            </div>
            
            <div class="bg-white p-4 rounded border-l-4 border-green-500">
              <h6>⚖️ 12 Vocales Judiciales</h6>
              <p><strong>Jueces y Magistrados</strong> de todas las categorías judiciales</p>
              <p class="text-sm text-green-600">Elegidos por 3/5 del Congreso</p>
            </div>

            <div class="bg-white p-4 rounded border-l-4 border-purple-500">
              <h6>👨‍🎓 8 Vocales Juristas</h6>
              <p><strong>Abogados y otros juristas</strong> de reconocida competencia</p>
              <p class="text-sm text-purple-600">Elegidos por 3/5 del Senado</p>
            </div>

            <div class="bg-white p-4 rounded border-l-4 border-yellow-500">
              <h6>⏰ Mandato</h6>
              <p><strong>5 años</strong> sin posibilidad de reelección inmediata</p>
              <p class="text-sm text-yellow-600">Renovación cada 5 años</p>
            </div>
          </div>
        </div>

        <h4>⚖️ Funciones del CGPJ</h4>
        
        <div class="space-y-4">
          <div class="bg-blue-50 p-4 rounded">
            <h5>👨‍⚖️ Nombramientos</h5>
            <ul>
              <li><strong>Magistrados del TS:</strong> Propuesta al Rey</li>
              <li><strong>Presidentes TS y AN:</strong> Propuesta al Rey</li>
              <li><strong>Magistrados:</strong> De Audiencias y TSJ</li>
              <li><strong>Jueces:</strong> Ascensos y traslados</li>
            </ul>
          </div>

          <div class="bg-green-50 p-4 rounded">
            <h5>📋 Régimen Disciplinario</h5>
            <ul>
              <li>Inspección de Juzgados y Tribunales</li>
              <li>Expedientes disciplinarios</li>
              <li>Sanciones a Jueces y Magistrados</li>
              <li>Separación del servicio en casos graves</li>
            </ul>
          </div>

          <div class="bg-yellow-50 p-4 rounded">
            <h5>🏛️ Gobierno Judicial</h5>
            <ul>
              <li>Formación y perfeccionamiento</li>
              <li>Estadística judicial</li>
              <li>Medios personales y materiales</li>
              <li>Relaciones con otros poderes</li>
            </ul>
          </div>

          <div class="bg-purple-50 p-4 rounded">
            <h5>📝 Informes y Propuestas</h5>
            <ul>
              <li>Anteproyectos sobre organización judicial</li>
              <li>Memoria anual sobre justicia</li>
              <li>Propuestas de reforma</li>
              <li>Planta y demarcación judicial</li>
            </ul>
          </div>
        </div>

        <h4>🏢 Organización Interna (Art. 595 - Actualizada LO 1/2025)</h4>
        
        <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div class="bg-blue-50 p-4 rounded">
            <h5>🏛️ Pleno</h5>
            <p>21 miembros para decisiones más importantes</p>
            <ul class="text-sm mt-2">
              <li>• Nombramientos principales</li>
              <li>• Régimen disciplinario grave</li>
              <li>• Reglamentos internos</li>
            </ul>
          </div>

          <div class="bg-green-50 p-4 rounded">
            <h5>📋 Comisiones Tradicionales</h5>
            <ul class="text-sm">
              <li>• <strong>Permanente</strong></li>
              <li>• <strong>Calificación</strong></li>
              <li>• <strong>Disciplinaria</strong></li>
              <li>• <strong>Asuntos Económicos</strong></li>
              <li>• <strong>Igualdad</strong></li>
            </ul>
          </div>

          <div class="bg-red-50 p-4 rounded">
            <h5>🔒 Nueva Comisión (LO 1/2025)</h5>
            <p><strong>Supervisión y Control Protección Datos</strong> (Art. 610 ter)</p>
            <ul class="text-sm mt-2">
              <li>• <strong>3 vocales:</strong> 2 judiciales + 1 jurista</li>
              <li>• <strong>Mandato:</strong> 5 años</li>
              <li>• <strong>Función:</strong> Tratamientos datos fines jurisdiccionales</li>
              <li>• <strong>Apoyo:</strong> Dirección Supervisión (Art. 620 bis)</li>
            </ul>
          </div>
        </div>

        <h4>🔒 Autoridad Protección Datos Judicial (NOVEDAD LO 1/2025)</h4>
        
        <div class="bg-amber-50 p-4 rounded">
          <h5>📋 Comisión Supervisión y Control (Arts. 610 ter, 620 bis)</h5>
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mt-3">
            <div class="bg-white p-3 rounded">
              <h6>👥 Composición</h6>
              <ul class="text-sm">
                <li>• <strong>3 vocales CGPJ:</strong> 2 turno judicial + 1 jurista</li>
                <li>• <strong>Presidente/a:</strong> Elegido entre ellos</li>
                <li>• <strong>Mandato:</strong> 5 años</li>
                <li>• <strong>Secreto profesional</strong> durante y después mandato</li>
              </ul>
            </div>
            <div class="bg-white p-3 rounded">
              <h6>⚖️ Funciones</h6>
              <ul class="text-sm">
                <li>• <strong>Tratamientos datos</strong> fines jurisdiccionales tribunales</li>
                <li>• <strong>Recursos contencioso:</strong> Sala TS (Art. 638.2)</li>
                <li>• <strong>Agota vía administrativa</strong></li>
                <li>• <strong>Dirección apoyo:</strong> Jurista 15+ años experiencia</li>
              </ul>
            </div>
          </div>
        </div>

        <div class="bg-red-50 p-4 rounded mt-4">
          <h5>🔥 Muy Preguntado en Exámenes</h5>
          <div class="space-y-2">
            <p><strong>Composición:</strong> 21 miembros (Presidente TS + 12 jueces + 8 juristas)</p>
            <p><strong>Elección:</strong> 3/5 de cada Cámara por materias</p>
            <p><strong>Mandato:</strong> 5 años sin reelección inmediata</p>
            <p><strong>Comisiones LO 1/2025:</strong> 6 comisiones (nueva: Protección Datos)</p>
            <p><strong>Nueva competencia:</strong> Autoridad protección datos tribunales</p>
          </div>
        </div>
      `
    },
    {
      id: 'ministerio-fiscal',
      title: '⚖️ El Ministerio Fiscal',
      content: `
        <h3>El Ministerio Fiscal (Art. 124 CE)</h3>
        
        <div class="bg-blue-50 p-4 rounded mb-4">
          <h4>⚖️ Naturaleza y Función</h4>
          <p>El Ministerio Fiscal, <strong>sin perjuicio de las funciones encomendadas a otros órganos</strong>, tiene por misión <strong>promover la acción de la justicia</strong> en defensa de la legalidad, de los derechos de los ciudadanos y del interés público tutelado por la ley.</p>
        </div>

        <h4>📋 Principios de Actuación (Art. 124.2 CE)</h4>
        
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div class="bg-green-50 p-4 rounded">
            <h5>⚖️ Legalidad</h5>
            <p>Actúa con <strong>sujeción a los principios de legalidad</strong> e imparcialidad</p>
          </div>
          
          <div class="bg-purple-50 p-4 rounded">
            <h5>🎯 Imparcialidad</h5>
            <p>Ejercicio objetivo de sus funciones sin favoritismos</p>
          </div>

          <div class="bg-yellow-50 p-4 rounded">
            <h5>🏛️ Unidad de Actuación</h5>
            <p>Actúa bajo dirección del Fiscal General del Estado</p>
          </div>

          <div class="bg-red-50 p-4 rounded">
            <h5>📊 Jerarquía</h5>
            <p>Organización jerárquica bajo el Fiscal General</p>
          </div>
        </div>

        <h4>👨‍💼 Fiscal General del Estado (Art. 124.4 CE)</h4>
        
        <div class="bg-amber-50 p-4 rounded mb-4">
          <h5>🏛️ Nombramiento y Cese</h5>
          <ul>
            <li><strong>Nombramiento:</strong> Por el Rey, a propuesta del Gobierno</li>
            <li><strong>Audiencia previa:</strong> Consejo General del Poder Judicial</li>
            <li><strong>Cese:</strong> Con la renovación del Gobierno</li>
            <li><strong>Duración:</strong> No tiene mandato fijo, cesa con el Gobierno</li>
          </ul>
        </div>

        <h4>⚖️ Estatuto Orgánico del Ministerio Fiscal</h4>
        
        <div class="space-y-4">
          <div class="bg-blue-50 p-4 rounded">
            <h5>🎯 Funciones Esenciales</h5>
            <ul>
              <li><strong>Ejercicio acción penal:</strong> Incoación y ejercicio</li>
              <li><strong>Defensa legalidad:</strong> Vigilancia cumplimiento leyes</li>
              <li><strong>Protección víctimas:</strong> Especial atención grupos vulnerables</li>
              <li><strong>Garantías procesales:</strong> Defensa derechos ciudadanos</li>
              <li><strong>Defensa menor:</strong> Protección jurídica del menor</li>
            </ul>
          </div>

          <div class="bg-green-50 p-4 rounded">
            <h5>🏛️ Estructura Orgánica</h5>
            <div class="space-y-2">
              <p><strong>Fiscalía General del Estado:</strong> Órgano superior</p>
              <p><strong>Fiscalía ante TS:</strong> Asuntos del Tribunal Supremo</p>
              <p><strong>Fiscalía ante AN:</strong> Asuntos de la Audiencia Nacional</p>
              <p><strong>Fiscalías TSJ:</strong> En cada Comunidad Autónoma</p>
              <p><strong>Fiscalías Provinciales:</strong> Audiencias Provinciales</p>
              <p><strong>Fiscalías Especializadas:</strong> Anticorrupción, Medio Ambiente, etc.</p>
            </div>
          </div>
        </div>

        <h4>🔍 Funciones Específicas</h4>
        
        <div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div class="bg-red-50 p-4 rounded">
            <h5>⚖️ En Materia Penal</h5>
            <ul>
              <li>Ejercicio monopolístico acción penal pública</li>
              <li>Dirección investigación criminal</li>
              <li>Acusación en juicio oral</li>
              <li>Recursos contra sentencias absolutorias</li>
            </ul>
          </div>

          <div class="bg-blue-50 p-4 rounded">
            <h5>👨‍👩‍👧‍👦 En Materia Civil</h5>
            <ul>
              <li>Protección menores e incapacitados</li>
              <li>Matrimonios: nulidad y separación</li>
              <li>Filiación e investigación paternidad</li>
              <li>Interés social en procesos civiles</li>
            </ul>
          </div>

          <div class="bg-green-50 p-4 rounded">
            <h5>🏛️ En lo Contencioso-Administrativo</h5>
            <ul>
              <li>Defensa legalidad administrativa</li>
              <li>Interés general y social</li>
              <li>Recursos contra actos nulos</li>
            </ul>
          </div>

          <div class="bg-purple-50 p-4 rounded">
            <h5>👷‍♂️ En lo Social</h5>
            <ul>
              <li>Protección derechos trabajadores</li>
              <li>Seguridad Social</li>
              <li>Siniestralidad laboral</li>
            </ul>
          </div>
        </div>

        <div class="bg-red-50 p-4 rounded mt-4">
          <h5>🔥 Muy Preguntado en Exámenes</h5>
          <div class="space-y-2">
            <p><strong>Nombramiento FGE:</strong> Rey, propuesta Gobierno, oído CGPJ</p>
            <p><strong>Cese FGE:</strong> Con la renovación del Gobierno</p>
            <p><strong>Principios:</strong> Legalidad e imparcialidad</p>
            <p><strong>Función:</strong> Promover acción justicia, defensa legalidad</p>
          </div>
        </div>
      `
    },
    {
      id: 'organizacion-judicial',
      title: '🏛️ Organización Judicial',
      content: `
        <h3>Organización de la Administración de Justicia (LO 6/1985 modificada por LO 1/2025)</h3>
        
        <div class="bg-amber-50 p-4 rounded mb-4">
          <h4>🏛️ Nueva Estructura: Tribunales de Instancia</h4>
          <p>La <strong>Ley Orgánica 1/2025</strong> introduce una nueva organización basada en <strong>Tribunales de Instancia</strong> que sustituyen a los antiguos Juzgados, integrando múltiples secciones especializadas.</p>
        </div>

        <h4>⚖️ Órdenes Jurisdiccionales (Art. 9 LOPJ)</h4>
        
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          <div class="bg-red-50 p-4 rounded">
            <h5>⚖️ Orden Civil (Art. 9.2)</h5>
            <ul>
              <li><strong>Competencia residual:</strong> Todas las materias no atribuidas a otros órdenes</li>
              <li>Derecho de las personas y familia</li>
              <li>Derechos reales y obligaciones</li>
              <li>Derecho mercantil</li>
              <li>Registro Civil</li>
            </ul>
          </div>

          <div class="bg-blue-50 p-4 rounded">
            <h5>🚨 Orden Penal (Art. 9.3)</h5>
            <ul>
              <li>Causas y juicios criminales</li>
              <li>Excepto jurisdicción militar</li>
              <li>Responsabilidad criminal</li>
              <li>Medidas de seguridad</li>
              <li>Ejecución penal</li>
            </ul>
          </div>

          <div class="bg-green-50 p-4 rounded">
            <h5>🏛️ Orden Contencioso-Administrativo (Art. 9.4)</h5>
            <ul>
              <li>Actuación Administraciones Públicas sujeta a derecho administrativo</li>
              <li>Disposiciones generales de rango inferior a ley</li>
              <li>Responsabilidad patrimonial AAPP</li>
              <li>Recursos contra inactividad administrativa</li>
              <li><strong>Excepción:</strong> Normas Forales Vascas (solo TC)</li>
            </ul>
          </div>

          <div class="bg-purple-50 p-4 rounded">
            <h5>👷‍♂️ Orden Social (Art. 9.5)</h5>
            <ul>
              <li>Rama social del derecho</li>
              <li>Conflictos individuales y colectivos</li>
              <li>Seguridad Social</li>
              <li>Responsabilidad del Estado por legislación laboral</li>
            </ul>
          </div>
        </div>

        <h4>🏛️ Nueva Estructura Territorial</h4>
        
        <div class="space-y-4">
          <div class="bg-amber-50 p-4 rounded">
            <h5>🏛️ Tribunal Supremo</h5>
            <p><strong>Ámbito:</strong> Nacional | <strong>Sede:</strong> Madrid</p>
            <p>Órgano jurisdiccional superior en todos los órdenes</p>
          </div>

          <div class="bg-blue-50 p-4 rounded">
            <h5>🏛️ Audiencia Nacional y Tribunal Central de Instancia (Art. 95)</h5>
            <p><strong>Ámbito:</strong> Nacional | <strong>Sede:</strong> Madrid</p>
            <div class="mt-2">
              <strong>Tribunal Central de Instancia - Secciones:</strong>
              <ul class="ml-4">
                <li>• Sección de Instrucción (incluye Fiscalía Europea)</li>
                <li>• Sección de lo Penal</li>
                <li>• Sección de Menores</li>
                <li>• Sección de Vigilancia Penitenciaria</li>
                <li>• Sección de lo Contencioso-Administrativo</li>
              </ul>
            </div>
          </div>

          <div class="bg-green-50 p-4 rounded">
            <h5>🗺️ Tribunales Superiores de Justicia (Art. 74)</h5>
            <p><strong>Ámbito:</strong> Autonómico | <strong>17 TSJ</strong> (uno por CCAA)</p>
            <div class="mt-2">
              <strong>Nuevas competencias:</strong>
              <ul class="ml-4">
                <li>• Conocen recursos contra <strong>Tribunales de Instancia</strong></li>
                <li>• Protección datos autonómicas (Art. 74.1.k)</li>
                <li>• Autorización requerimiento información telecomunicaciones</li>
              </ul>
            </div>
          </div>

          <div class="bg-yellow-50 p-4 rounded">
            <h5>🏛️ Tribunales de Instancia (Art. 84 - NOVEDAD LO 1/2025)</h5>
            <p><strong>Ámbito:</strong> Partido judicial | <strong>Nueva denominación</strong></p>
            <div class="mt-2">
              <p><strong>Estructura básica:</strong> Sección Única de Civil y de Instrucción</p>
              <p><strong>Secciones especializadas opcionales:</strong></p>
              <ul class="ml-4 text-sm">
                <li>• Familia, Infancia y Capacidad</li>
                <li>• Lo Mercantil</li>
                <li>• Violencia sobre la Mujer</li>
                <li>• <strong>Violencia contra Infancia y Adolescencia (NUEVO)</strong></li>
                <li>• Lo Penal</li>
                <li>• Menores</li>
                <li>• Vigilancia Penitenciaria</li>
                <li>• Lo Contencioso-Administrativo</li>
                <li>• Lo Social</li>
              </ul>
            </div>
          </div>
        </div>

        <h4>📊 Secciones Especializadas Destacadas</h4>
        
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div class="bg-red-50 p-4 rounded">
            <h5>👨‍👩‍👧‍👦 Familia, Infancia y Capacidad (Art. 86)</h5>
            <ul class="text-sm">
              <li>Matrimonio y régimen económico</li>
              <li>Guarda y custodia menores</li>
              <li>Maternidad, paternidad, filiación</li>
              <li>Medidas apoyo personas con discapacidad</li>
              <li>Protección menor (Arts. 778 bis y ter LEC)</li>
              <li><strong>Competencia exclusiva y excluyente</strong></li>
            </ul>
          </div>

          <div class="bg-purple-50 p-4 rounded">
            <h5>🧒 Violencia Infancia y Adolescencia (Art. 89 bis - NUEVO)</h5>
            <ul class="text-sm">
              <li><strong>Homicidio, lesiones</strong> contra menores</li>
              <li><strong>Delitos contra libertad</strong> con víctimas menores</li>
              <li><strong>Delitos sexuales</strong> contra menores</li>
              <li><strong>Trata seres humanos</strong> (víctimas menores)</li>
              <li>Medidas cautelares protección</li>
              <li>Dependencias sin confrontación víctima-agresor</li>
            </ul>
          </div>

          <div class="bg-green-50 p-4 rounded">
            <h5>💼 Mercantil (Art. 87)</h5>
            <ul class="text-sm">
              <li>Propiedad intelectual e industrial</li>
              <li>Sociedades mercantiles</li>
              <li><strong>Competencia Unión Europea</strong> (Arts. 101-102 TFUE)</li>
              <li>Concursos acreedores (jurisdicción exclusiva)</li>
              <li>Tribunal Marca UE (Alicante - competencia nacional)</li>
            </ul>
          </div>

          <div class="bg-blue-50 p-4 rounded">
            <h5>⚖️ Oficina Judicial y Fiscal (Arts. 436, 439 sexies)</h5>
            <ul class="text-sm">
              <li><strong>Oficina judicial:</strong> Servicios comunes tramitación</li>
              <li><strong>Oficinas Justicia municipales:</strong> > 7.000 habitantes</li>
              <li>Asistencia jueces paz</li>
              <li>Comunicaciones procesales</li>
              <li>Videoconferencia y telepresencia</li>
            </ul>
          </div>
        </div>

        <div class="bg-red-50 p-4 rounded mt-4">
          <h5>🔥 Muy Preguntado en Exámenes</h5>
          <div class="space-y-2">
            <p><strong>LO 1/2025:</strong> Tribunales de Instancia (nueva denominación)</p>
            <p><strong>Órdenes:</strong> Civil (residual), Penal, Contencioso, Social</p>
            <p><strong>Nueva sección:</strong> Violencia contra Infancia y Adolescencia</p>
            <p><strong>Oficinas municipales:</strong> > 7.000 habitantes con personal justicia</p>
            <p><strong>Competencia exclusiva:</strong> Civil residual, Mercantil UE</p>
          </div>
        </div>
      `
    },
    {
      id: 'novedades-2025',
      title: '📋 Ley Orgánica 1/2025',
      content: `
        <h3>Ley Orgánica 1/2025: Modificación Integral del Sistema Judicial</h3>
        
        <div class="bg-amber-50 p-4 rounded mb-4">
          <h4>📋 Transformación Estructural</h4>
          <p>La <strong>Ley Orgánica 1/2025, de 2 de enero</strong>, modifica sustancialmente la LO 6/1985 del Poder Judicial, introduciendo los <strong>Tribunales de Instancia</strong> como nueva estructura organizativa que integra múltiples secciones especializadas.</p>
        </div>

        <h4>🏛️ Tribunales de Instancia: Nueva Estructura (Art. 84)</h4>
        
        <div class="space-y-4">
          <div class="bg-blue-50 p-4 rounded">
            <h5>⚖️ Estructura Básica</h5>
            <ul>
              <li><strong>Ubicación:</strong> Un Tribunal de Instancia en cada partido judicial</li>
              <li><strong>Sección básica:</strong> Sección Única de Civil y de Instrucción</li>
              <li><strong>Alternativa:</strong> Sección Civil separada + Sección de Instrucción</li>
              <li><strong>Presidencia:</strong> Cada tribunal cuenta con Presidencia</li>
              <li><strong>Adscripción funcional:</strong> Flexibilidad entre secciones mismo orden jurisdiccional</li>
            </ul>
          </div>

          <div class="bg-green-50 p-4 rounded">
            <h5>📊 Secciones Especializadas Disponibles</h5>
            <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
              <ul class="text-sm">
                <li>• <strong>Familia, Infancia y Capacidad</strong> (Art. 86)</li>
                <li>• <strong>Lo Mercantil</strong> (Art. 87)</li>
                <li>• <strong>Violencia sobre la Mujer</strong></li>
                <li>• <strong>Violencia Infancia y Adolescencia</strong> (Art. 89 bis - NUEVO)</li>
              </ul>
              <ul class="text-sm">
                <li>• <strong>Lo Penal</strong> (Art. 90)</li>
                <li>• <strong>Menores</strong> (Art. 91)</li>
                <li>• <strong>Vigilancia Penitenciaria</strong> (Art. 92)</li>
                <li>• <strong>Lo Contencioso-Administrativo</strong></li>
                <li>• <strong>Lo Social</strong></li>
              </ul>
            </div>
          </div>
        </div>

        <h4>🧒 Sección Violencia Infancia y Adolescencia (Art. 89 bis - PRINCIPAL NOVEDAD)</h4>
        
        <div class="bg-purple-50 p-4 rounded mb-4">
          <h5>⚖️ Competencias Penales Exclusivas</h5>
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div class="bg-white p-3 rounded">
              <h6>🔍 Delitos Instruye</h6>
              <ul class="text-sm">
                <li>• <strong>Homicidio, lesiones</strong> contra menores</li>
                <li>• <strong>Delitos libertad, torturas</strong> (víctimas menores)</li>
                <li>• <strong>Delitos sexuales</strong> contra menores</li>
                <li>• <strong>Trata seres humanos</strong> (Art. 177 bis CP)</li>
                <li>• <strong>Quebrantamiento</strong> (Art. 468 CP - víctima menor)</li>
              </ul>
            </div>
            <div class="bg-white p-3 rounded">
              <h6>⚖️ Otras Competencias</h6>
              <ul class="text-sm">
                <li>• <strong>Medidas cautelares</strong> protección menores</li>
                <li>• <strong>Delitos leves</strong> víctima menor</li>
                <li>• <strong>Sentencias conformidad</strong></li>
                <li>• <strong>Reconocimiento mutuo UE</strong></li>
                <li>• <strong>Dependencias separadas</strong> víctima-agresor</li>
              </ul>
            </div>
          </div>
          <div class="bg-red-50 p-3 rounded mt-3">
            <p class="text-sm"><strong>Prevalencia:</strong> Si hechos también competencia Violencia Mujer → <strong>competencia Violencia Mujer</strong></p>
          </div>
        </div>

        <h4>🏛️ Oficina Judicial y Servicios Comunes (Art. 436)</h4>
        
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div class="bg-blue-50 p-4 rounded">
            <h5>🏢 Oficina Judicial</h5>
            <ul class="text-sm">
              <li><strong>Servicios comunes tramitación</strong> + otros servicios</li>
              <li><strong>Diseño flexible:</strong> Según actividad desarrollada</li>
              <li><strong>Ámbito:</strong> Nacional, autonómico, provincial o partido</li>
              <li><strong>Comarcal:</strong> Apoyo varios Tribunales Instancia</li>
              <li><strong>Dirección:</strong> Letrado/a Administración Justicia</li>
            </ul>
          </div>

          <div class="bg-green-50 p-4 rounded">
            <h5>🏛️ Oficinas Justicia Municipales (Arts. 439 ter-quinquies)</h5>
            <ul class="text-sm">
              <li><strong>Ubicación:</strong> Municipios sin sede Tribunal Instancia</li>
              <li><strong>Personal:</strong> Municipios > 7.000 habitantes</li>
              <li><strong>Servicios:</strong> Asistencia juez paz, comunicaciones</li>
              <li><strong>Tecnología:</strong> Videoconferencia, telepresencia</li>
              <li><strong>Agrupaciones:</strong> Municipios limítrofes mismo partido</li>
            </ul>
          </div>
        </div>

        <h4>⚖️ Tribunal Central de Instancia Madrid (Art. 95)</h4>
        
        <div class="bg-red-50 p-4 rounded">
          <h5>🏛️ Competencia Nacional - 5 Secciones</h5>
          <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div class="bg-white p-3 rounded">
              <h6>🔍 Sección Instrucción</h6>
              <ul class="text-sm">
                <li>• Causas Audiencia Nacional</li>
                <li>• <strong>Fiscalía Europea:</strong> Jueces garantías</li>
                <li>• Extradiciones, euroórdenes</li>
                <li>• Reconocimiento mutuo UE</li>
              </ul>
            </div>
            <div class="bg-white p-3 rounded">
              <h6>⚖️ Otras Secciones</h6>
              <ul class="text-sm">
                <li>• <strong>Lo Penal:</strong> Delitos Art. 65</li>
                <li>• <strong>Menores:</strong> Responsabilidad penal menores</li>
                <li>• <strong>Vigilancia:</strong> Delitos AN</li>
                <li>• <strong>Contencioso:</strong> Competencia nacional</li>
              </ul>
            </div>
          </div>
        </div>

        <h4>💼 Régimen Especial Mercantil (Art. 87)</h4>
        
        <div class="space-y-3">
          <div class="bg-yellow-50 p-4 rounded">
            <h5>🏛️ Organización Territorial</h5>
            <ul class="text-sm">
              <li><strong>General:</strong> Sección Mercantil en capital provincia</li>
              <li><strong>Excepción:</strong> Provincias < 500.000 hab. → extensión jurisdicción</li>
              <li><strong>Partidos > 250.000 hab.:</strong> Sección propia posible</li>
              <li><strong>Concursos persona natural:</strong> Reparto especializado</li>
            </ul>
          </div>
          
          <div class="bg-blue-50 p-4 rounded">
            <h5>⚖️ Tribunal Marca UE (Alicante)</h5>
            <p class="text-sm"><strong>Competencia nacional exclusiva:</strong> Acciones Reglamento UE 2017/1001 marcas UE y Reglamento CE 6/2002 dibujos/modelos comunitarios</p>
          </div>
        </div>

        <h4>🔒 Protección Datos Jurisdiccional (CGPJ)</h4>
        
        <div class="bg-green-50 p-4 rounded">
          <h5>📋 Nueva Competencia CGPJ (Arts. 236 nonies, 610 ter, 620 bis)</h5>
          <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div class="bg-white p-3 rounded">
              <h6>👥 Comisión Supervisión</h6>
              <ul class="text-sm">
                <li>• <strong>3 vocales:</strong> 2 judiciales + 1 jurista</li>
                <li>• <strong>Mandato:</strong> 5 años</li>
                <li>• <strong>Recursos TS:</strong> Sala Contencioso</li>
              </ul>
            </div>
            <div class="bg-white p-3 rounded">
              <h6>🏢 Dirección Apoyo</h6>
              <ul class="text-sm">
                <li>• <strong>Director:</strong> Jurista 15+ años</li>
                <li>• <strong>Función:</strong> Apoyo técnico Comisión</li>
                <li>• <strong>Secreto profesional</strong> obligatorio</li>
              </ul>
            </div>
          </div>
        </div>

        <div class="bg-red-50 p-4 rounded mt-4">
          <h5>🔥 Muy Preguntado en Exámenes</h5>
          <div class="space-y-2">
            <p><strong>LO 1/2025:</strong> Tribunales de Instancia (sustituye Juzgados)</p>
            <p><strong>Nueva sección:</strong> Violencia Infancia y Adolescencia (Art. 89 bis)</p>
            <p><strong>Oficinas municipales:</strong> > 7.000 hab. con personal justicia</p>
            <p><strong>Tribunal Central:</strong> Madrid, 5 secciones, Fiscalía Europea</p>
            <p><strong>CGPJ protección datos:</strong> Nueva comisión + dirección apoyo</p>
            <p><strong>Marca UE:</strong> Alicante competencia nacional exclusiva</p>
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
                    ? 'bg-amber-600 text-white shadow-md'
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
                    activeSection === index ? 'bg-amber-50' : 'hover:bg-gray-50'
                  }`}
                  onClick={() => setActiveSection(index)}
                >
                  <div className={`w-3 h-3 rounded-full flex-shrink-0 ${
                    activeSection === index ? 'bg-amber-500' : 
                    activeSection > index ? 'bg-green-500' : 'bg-gray-300'
                  }`} />
                  <span className={`text-sm ${
                    activeSection === index ? 'text-amber-700 font-medium' : 'text-gray-600'
                  }`}>
                    {section.title.replace(/^[⚖️🏛️📋👨‍👩‍👧‍👦]+\s/, '')}
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
                className="w-full bg-amber-600 text-white py-2 px-4 rounded-lg hover:bg-amber-700 transition-colors flex items-center justify-center space-x-2"
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
              <div className="bg-amber-50 p-3 rounded">
                <div className="text-2xl font-bold text-amber-600">5</div>
                <div className="text-sm text-amber-700">Salas Tribunal Supremo</div>
              </div>
              <div className="bg-blue-50 p-3 rounded">
                <div className="text-2xl font-bold text-blue-600">21</div>
                <div className="text-sm text-blue-700">Miembros CGPJ</div>
              </div>
              <div className="bg-green-50 p-3 rounded">
                <div className="text-2xl font-bold text-green-600">17</div>
                <div className="text-sm text-green-700">Tribunales Superiores</div>
              </div>
              <div className="bg-purple-50 p-3 rounded">
                <div className="text-2xl font-bold text-purple-600">2025</div>
                <div className="text-sm text-purple-700">Nueva LO 1/2025</div>
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
          className="flex items-center space-x-2 px-6 py-3 bg-amber-600 text-white rounded-lg hover:bg-amber-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          <span>Siguiente</span>
          <span>→</span>
        </button>
      </div>
    </div>
  )
}