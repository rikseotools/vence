// app/leyes-de-oposiciones/page.js - Landing page para leyes de oposiciones
import Link from 'next/link'

// Metadatos para SEO
export const metadata = {
  title: 'Leyes para Oposiciones 2026 - Guía Completa de Normativas | Vence',
  description: 'Descubre qué leyes estudiar para tu oposición. Constitución, LOPD, Ley 39/2015, TREBEP y más normativas para Auxiliar Administrativo, Policía, Bomberos y otras oposiciones.',
  keywords: 'leyes oposiciones, normativas oposiciones, constitución española, ley 39/2015, lopd, trebep, auxiliar administrativo, policía, bomberos, código penal, procedimiento administrativo',
  openGraph: {
    title: 'Leyes para Oposiciones 2026 - Guía Completa | Vence',
    description: 'Guía completa de las leyes más importantes para oposiciones. Constitución, LOPD, procedimiento administrativo y más normativas actualizadas.',
    url: 'https://www.vence.es/leyes-de-oposiciones',
    siteName: 'Vence',
    images: [{
      url: 'https://www.vence.es/og-leyes-oposiciones.jpg',
      width: 1200,
      height: 630,
    }],
    locale: 'es_ES',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Leyes para Oposiciones 2026 - Guía Completa | Vence',
    description: 'Descubre qué leyes estudiar para tu oposición. Constitución, LOPD, Ley 39/2015, TREBEP y más normativas actualizadas.',
    images: ['https://www.vence.es/og-leyes-oposiciones.jpg'],
  },
  alternates: {
    canonical: `${process.env.SITE_URL || 'https://www.vence.es'}/leyes-de-oposiciones`
  },
}

export default function LeyesDeOposicionesPage() {

  // Lista de leyes con información detallada para landing page
  const leyes = [
    {
      id: 'constitucion',
      nombre: 'Constitución Española',
      descripcion: 'La norma suprema del ordenamiento jurídico español. Establece los derechos y deberes fundamentales, la organización territorial del Estado y los principios básicos de la democracia. Es la base legal de cualquier cargo público y aparece en prácticamente todas las oposiciones del país.',
      detalles: 'Contiene 169 artículos organizados en 10 títulos. Los más estudiados incluyen derechos fundamentales (Título I), organización territorial (Título VIII) y Tribunal Constitucional (Título IX). Imprescindible conocer la estructura del Estado, separación de poderes y sistema autonómico.',
      oposiciones: ['Auxiliar Administrativo', 'Administrativo', 'Policía Nacional', 'Guardia Civil', 'Bomberos', 'Policía Local', 'Correos'],
      frecuencia: 'Muy Alta',
      slug: 'constitucion-espanola'
    },
    {
      id: 'ley-3-2007',
      nombre: 'Ley Orgánica 3/2007 - Igualdad Efectiva',
      descripcion: 'Ley para la igualdad efectiva de mujeres y hombres. Establece principios de actuación de los poderes públicos en materia de igualdad, elimina discriminaciones y promueve la igualdad real entre géneros. Presente en prácticamente todas las oposiciones.',
      detalles: 'Regula la igualdad de trato y oportunidades, medidas de acción positiva, planes de igualdad en empresas y administraciones públicas. Especialmente relevante en el ámbito laboral público y en la función pública. Incluye medidas contra la violencia de género en el trabajo.',
      oposiciones: ['Auxiliar Administrativo', 'Administrativo', 'Policía Nacional', 'Guardia Civil', 'Bomberos', 'Policía Local', 'Justicia', 'Hacienda'],
      frecuencia: 'Muy Alta',
      slug: 'ley-organica-3-2007'
    },
    {
      id: 'ley-39-2015',
      nombre: 'Ley 39/2015 - Procedimiento Administrativo Común',
      descripcion: 'Regula el procedimiento administrativo común de las Administraciones Públicas. Fundamental para entender cómo se relacionan ciudadanos y administración: expedientes, plazos, recursos, notificaciones y derechos de los interesados.',
      detalles: 'Estructura los procedimientos administrativos: iniciación, instrucción, terminación y recursos. Define derechos de los ciudadanos ante la administración, administración electrónica, silencio administrativo y régimen sancionador. Esencial para cualquier puesto administrativo.',
      oposiciones: ['Auxiliar Administrativo', 'Administrativo', 'Policía Local', 'Bomberos', 'Corporaciones Locales', 'Hacienda'],
      frecuencia: 'Muy Alta',
      slug: 'ley-39-2015'
    },
    {
      id: 'ley-40-2015',
      nombre: 'Ley 40/2015 - Régimen Jurídico del Sector Público',
      descripcion: 'Complementa la Ley 39/2015 regulando el funcionamiento interno del sector público. Establece principios de actuación, organización administrativa, competencias, relaciones interadministrativas y responsabilidad patrimonial.',
      detalles: 'Regula la organización y funcionamiento del sector público, principios de actuación (eficacia, eficiencia, transparencia), órganos administrativos, delegación de competencias, convenios de colaboración y responsabilidad patrimonial de las administraciones.',
      oposiciones: ['Auxiliar Administrativo', 'Administrativo', 'Policía Local', 'Bomberos', 'Corporaciones Locales'],
      frecuencia: 'Alta',
      slug: 'ley-40-2015'
    },
    {
      id: 'lopd',
      nombre: 'Ley Orgánica 3/2018 - Protección de Datos (LOPD)',
      descripcion: 'Protección de Datos Personales y garantía de los derechos digitales. Adapta el RGPD europeo al ordenamiento español. Esencial en la era digital para cualquier administración que gestione datos de ciudadanos.',
      detalles: 'Establece principios del tratamiento de datos, derechos de los interesados (acceso, rectificación, supresión, portabilidad), medidas de seguridad, brechas de seguridad y régimen sancionador. Incluye derechos digitales específicos como desconexión digital.',
      oposiciones: ['Auxiliar Administrativo', 'Administrativo', 'Policía Nacional', 'Guardia Civil', 'Bomberos', 'Hacienda'],
      frecuencia: 'Alta',
      slug: 'ley-organica-3-2018'
    },
    {
      id: 'lbrl',
      nombre: 'Ley 7/1985 - Bases del Régimen Local (LBRL)',
      descripcion: 'Reguladora de las Bases del Régimen Local. Define la organización y competencias de los entes locales: municipios, provincias, islas. Fundamental para cualquier oposición de administración local.',
      detalles: 'Establece la autonomía local, organización municipal (alcalde, pleno, junta de gobierno), competencias locales, régimen de funcionamiento, participación ciudadana y régimen de impugnación de actos locales. Base del derecho administrativo local.',
      oposiciones: ['Corporaciones Locales', 'Policía Local', 'Bomberos', 'Auxiliar Administrativo Local'],
      frecuencia: 'Alta',
      slug: 'ley-7-1985'
    },
    {
      id: 'trebep',
      nombre: 'RDL 5/2015 - Estatuto Básico del Empleado Público (TREBEP)',
      descripcion: 'El estatuto básico del empleado público. La "biblia" de los funcionarios que regula desde el acceso al empleo público hasta los derechos, deberes, carrera profesional, situaciones administrativas e incompatibilidades.',
      detalles: 'Clasifica al personal público (funcionarios de carrera, interinos, laborales), regula el acceso por mérito y capacidad, derechos y deberes, código de conducta, carrera profesional, promoción interna, situaciones administrativas y régimen disciplinario.',
      oposiciones: ['Auxiliar Administrativo', 'Administrativo', 'Policía Nacional', 'Guardia Civil', 'Bomberos', 'Policía Local'],
      frecuencia: 'Alta',
      slug: 'rdl-5-2015'
    },
    {
      id: 'ley-1-2004',
      nombre: 'Ley Orgánica 1/2004 - Violencia de Género',
      descripcion: 'Medidas de Protección Integral contra la Violencia de Género. Establece medidas de sensibilización, prevención, detección, protección y asistencia integral a las víctimas. Fundamental en justicia y fuerzas de seguridad.',
      detalles: 'Define violencia de género, medidas de prevención, derechos de las víctimas, medidas de protección social y económica, tutela institucional, tutela judicial y régimen penal específico. Incluye órdenes de protección y juzgados especializados.',
      oposiciones: ['Auxilio Judicial', 'Tramitación Procesal', 'Policía Nacional', 'Guardia Civil', 'Bomberos', 'Policía Local'],
      frecuencia: 'Alta',
      slug: 'ley-organica-1-2004'
    },
    {
      id: 'ley-31-1995',
      nombre: 'Ley 31/1995 - Prevención de Riesgos Laborales',
      descripcion: 'Prevención de Riesgos Laborales en el trabajo. Establece las bases para garantizar la seguridad y salud laboral, obligaciones empresariales y derechos de los trabajadores. Aplicable a todo el sector público.',
      detalles: 'Define principios de prevención, evaluación y planificación de riesgos, derechos y obligaciones, consulta y participación de los trabajadores, formación en prevención, medidas de emergencia y vigilancia de la salud.',
      oposiciones: ['Auxiliar Administrativo', 'Administrativo', 'Policía Nacional', 'Guardia Civil', 'Bomberos', 'Corporaciones Locales'],
      frecuencia: 'Media',
      slug: 'ley-31-1995'
    },
    {
      id: 'codigo-penal',
      nombre: 'Ley Orgánica 10/1995 - Código Penal',
      descripcion: 'Código Penal español que tipifica delitos, faltas y sus penas correspondientes. Esencial para fuerzas y cuerpos de seguridad del Estado y justicia. Regula la responsabilidad penal y las medidas de seguridad.',
      detalles: 'Organizado en Libro I (disposiciones generales), Libro II (delitos y penas) y Libro III (faltas). Define principios penales, tipos de penas, circunstancias modificativas, responsabilidad civil derivada del delito y extinción de responsabilidad penal.',
      oposiciones: ['Policía Nacional', 'Guardia Civil', 'Policía Local', 'Auxilio Judicial', 'Tramitación Procesal'],
      frecuencia: 'Media',
      slug: 'codigo-penal'
    },
    {
      id: 'lecrim',
      nombre: 'RD 14 septiembre 1882 - Ley de Enjuiciamiento Criminal',
      descripcion: 'Real Decreto por el que se aprueba la Ley de Enjuiciamiento Criminal. Regula el procedimiento penal español desde la investigación hasta la sentencia. Fundamental en justicia y fuerzas de seguridad.',
      detalles: 'Establece el sumario, procedimiento ordinario y abreviado, diligencias previas, fase de investigación, juicio oral, recursos y ejecución de sentencias. Define roles del Ministerio Fiscal, jueces de instrucción y fuerzas de seguridad en la investigación penal.',
      oposiciones: ['Auxilio Judicial', 'Tramitación Procesal', 'Policía Nacional', 'Guardia Civil', 'Policía Local'],
      frecuencia: 'Media',
      slug: 'ley-enjuiciamiento-criminal'
    },
    {
      id: 'ley-fuerzas-seguridad',
      nombre: 'Ley Orgánica 2/1986 - Fuerzas y Cuerpos de Seguridad',
      descripcion: 'Regula las Fuerzas y Cuerpos de Seguridad del Estado y coordinación con policías locales. Define funciones, competencias, principios de actuación y estructura organizativa de los cuerpos policiales.',
      detalles: 'Establece principios básicos de actuación policial, organización de la Policía Nacional y Guardia Civil, coordinación policial, estatuto de los funcionarios policiales y régimen disciplinario específico.',
      oposiciones: ['Policía Nacional', 'Guardia Civil', 'Policía Local'],
      frecuencia: 'Alta',
      slug: 'ley-fuerzas-cuerpos-seguridad'
    },
    {
      id: 'poder-judicial',
      nombre: 'Ley Orgánica 6/1985 - Poder Judicial',
      descripcion: 'Ley Orgánica del Poder Judicial que regula la organización, funcionamiento y gobierno de juzgados y tribunales. Fundamental para entender la estructura judicial española.',
      detalles: 'Regula la organización judicial, competencias de juzgados y tribunales, Consejo General del Poder Judicial, carrera judicial, personal al servicio de la administración de justicia y régimen disciplinario.',
      oposiciones: ['Auxilio Judicial', 'Tramitación Procesal', 'Policía Nacional', 'Policía Local', 'Guardia Civil'],
      frecuencia: 'Media',
      slug: 'ley-poder-judicial'
    },
    {
      id: 'haciendas-locales',
      nombre: 'RDL 2/2004 - Haciendas Locales',
      descripcion: 'Texto refundido de la Ley Reguladora de las Haciendas Locales. Regula la gestión económica y financiera de ayuntamientos, diputaciones y otras entidades locales.',
      detalles: 'Establece los recursos de las entidades locales, tributos locales, tasas, contribuciones especiales, impuestos locales, subvenciones, operaciones de crédito y presupuestos locales.',
      oposiciones: ['Corporaciones Locales', 'Auxiliar Administrativo Local', 'Bomberos', 'Policía Local'],
      frecuencia: 'Media',
      slug: 'haciendas-locales'
    },
    {
      id: 'proteccion-seguridad-ciudadana',
      nombre: 'Ley Orgánica 4/2015 - Protección Seguridad Ciudadana',
      descripcion: 'Protección de la seguridad ciudadana, conocida como "Ley Mordaza". Regula el mantenimiento del orden público, derechos ciudadanos y actuación policial en espacios públicos.',
      detalles: 'Define infracciones contra la seguridad ciudadana, régimen sancionador, actuaciones policiales especiales, identificación de personas, cacheos, control de fronteras y medidas de protección de infraestructuras críticas.',
      oposiciones: ['Policía Nacional', 'Guardia Civil', 'Policía Local'],
      frecuencia: 'Alta',
      slug: 'proteccion-seguridad-ciudadana'
    },
    {
      id: 'trafico',
      nombre: 'RDL 6/2015 - Tráfico y Seguridad Vial',
      descripcion: 'Texto refundido de la Ley sobre Tráfico, Circulación de Vehículos a Motor y Seguridad Vial. Regula la circulación, permisos de conducir, infracciones y sanciones de tráfico.',
      detalles: 'Establece normas de circulación, señalización, permisos de conducir y licencias, matriculación de vehículos, inspección técnica, infracciones de tráfico, procedimiento sancionador y medidas cautelares.',
      oposiciones: ['Policía Local', 'Guardia Civil', 'Bomberos Conductores'],
      frecuencia: 'Media',
      slug: 'trafico-seguridad-vial'
    },
    {
      id: 'transparencia',
      nombre: 'Ley 19/2013 - Transparencia y Buen Gobierno',
      descripcion: 'Transparencia, acceso a la información pública y buen gobierno. Regula el derecho ciudadano a acceder a información pública y las obligaciones de transparencia de las administraciones.',
      detalles: 'Establece el derecho de acceso a información pública, publicidad activa, Portal de Transparencia, régimen de impugnaciones, buen gobierno y régimen sancionador por incumplimiento de obligaciones de transparencia.',
      oposiciones: ['Auxiliar Administrativo', 'Administrativo', 'Corporaciones Locales'],
      frecuencia: 'Media',
      slug: 'transparencia-buen-gobierno'
    },
    {
      id: 'jurisdiccion-contencioso',
      nombre: 'Ley 29/1998 - Jurisdicción Contencioso-Administrativa',
      descripcion: 'Reguladora de la Jurisdicción Contencioso-administrativa. Regula el control judicial de la actuación administrativa y la protección de derechos ciudadanos frente a la administración.',
      detalles: 'Define el ámbito de la jurisdicción contencioso-administrativa, órganos jurisdiccionales, procedimientos (ordinario, abreviado, especiales), medidas cautelares, sentencias y ejecución de las mismas.',
      oposiciones: ['Auxiliar Administrativo', 'Administrativo', 'Auxilio Judicial', 'Tramitación Procesal'],
      frecuencia: 'Media',
      slug: 'ley-29-1998'
    },
    {
      id: 'igualdad-trans',
      nombre: 'Ley 4/2023 - Igualdad Real Personas Trans y LGTBI',
      descripcion: 'Ley para la igualdad real y efectiva de las personas trans y garantía de los derechos de las personas LGTBI. Establece medidas contra la discriminación y promoción de la igualdad.',
      detalles: 'Regula el derecho a la autodeterminación de género, medidas de protección, atención sanitaria, ámbito educativo, laboral, deporte, medios de comunicación y régimen sancionador específico.',
      oposiciones: ['Policía Local', 'Bomberos', 'Auxiliar Administrativo', 'Administrativo'],
      frecuencia: 'Baja',
      slug: 'igualdad-trans-lgtbi'
    },
    {
      id: 'proteccion-civil',
      nombre: 'Ley 17/2015 - Sistema Nacional de Protección Civil',
      descripcion: 'Sistema Nacional de Protección Civil que organiza la respuesta ante emergencias y catástrofes. Fundamental para bomberos y servicios de emergencia.',
      detalles: 'Define la protección civil, organización del sistema, planificación de protección civil, medidas de autoprotección, intervención en emergencias, coordinación entre administraciones y participación ciudadana.',
      oposiciones: ['Bomberos', 'Guardia Civil', 'Policía Local'],
      frecuencia: 'Media',
      slug: 'proteccion-civil'
    }
  ]


  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white dark:from-gray-900 dark:to-gray-800">
      <div className="container mx-auto px-4 py-8">
        
        {/* Hero Section */}
        <div className="text-center mb-12">
          <h1 className="text-4xl md:text-5xl font-bold text-gray-900 dark:text-white mb-6">
            📚 Leyes para Oposiciones
          </h1>
          <p className="text-xl text-gray-600 dark:text-gray-300 max-w-4xl mx-auto leading-relaxed mb-8">
            ¿Te preguntas qué normativas debes estudiar para tu oposición? Aquí encontrarás las leyes más frecuentes 
            ordenadas por importancia y con ejemplos de dónde aparecen. Saldrás con una idea clara de al menos 
            una o dos leyes que tendrás que dominar.
          </p>
          
          {/* CTA Principal */}
          <Link 
            href="/leyes" 
            className="inline-block bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-bold py-4 px-8 rounded-xl hover:from-blue-700 hover:to-indigo-700 transition-all duration-300 shadow-lg hover:shadow-xl transform hover:scale-105 mb-8"
          >
            🎯 Estudiar Leyes con Vence
          </Link>
        </div>



        {/* Enlace a todas las leyes */}
        <div className="text-center mb-8">
          <div className="bg-gradient-to-r from-purple-100 to-blue-100 dark:from-purple-900/20 dark:to-blue-900/20 p-6 rounded-xl border border-purple-200 dark:border-purple-800">
            <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-3">
              📚 ¿Necesitas consultar alguna ley específica?
            </h3>
            <p className="text-gray-600 dark:text-gray-300 mb-4">
              Tenemos todas las leyes organizadas y actualizadas en nuestro apartado especializado
            </p>
            <Link
              href="/leyes"
              className="inline-block bg-gradient-to-r from-purple-600 to-blue-600 text-white font-bold py-3 px-6 rounded-lg hover:from-purple-700 hover:to-blue-700 transition-all duration-300 shadow-lg hover:shadow-xl"
            >
              🔍 Ver Todas las Leyes →
            </Link>
          </div>
        </div>

        {/* Lista de Leyes */}
        <div className="grid gap-6 md:gap-8">
          <h2 className="text-3xl font-bold text-center text-gray-900 dark:text-white mb-8">
            🏆 Las Leyes Más Frecuentes en Oposiciones
          </h2>
          
          {leyes.map((ley, index) => (
            <div key={ley.id} className="bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 overflow-hidden hover:shadow-xl transition-shadow">
              
              {/* Header de la ley */}
              <div className="bg-gradient-to-r from-blue-500 to-indigo-600 text-white p-6">
                <div className="flex items-center justify-between flex-wrap gap-4">
                  <div className="flex items-center space-x-4">
                    <div className="text-2xl font-bold bg-white/20 w-10 h-10 rounded-full flex items-center justify-center">
                      {index + 1}
                    </div>
                    <div>
                      <h3 className="text-xl md:text-2xl font-bold">{ley.nombre}</h3>
                      <div className="flex items-center space-x-4 mt-2">
                        <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                          ley.frecuencia === 'Muy Alta' ? 'bg-red-500/20 text-red-100' :
                          ley.frecuencia === 'Alta' ? 'bg-yellow-500/20 text-yellow-100' :
                          'bg-green-500/20 text-green-100'
                        }`}>
                          📊 Frecuencia: {ley.frecuencia}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Contenido */}
              <div className="p-6">
                <p className="text-gray-600 dark:text-gray-300 mb-4 leading-relaxed">
                  {ley.descripcion}
                </p>

                {/* Información detallada */}
                <div className="bg-gray-50 dark:bg-gray-900/50 p-4 rounded-lg mb-4">
                  <h4 className="font-semibold text-gray-900 dark:text-white mb-2 flex items-center">
                    <span className="mr-2">📋</span>
                    Qué incluye esta ley:
                  </h4>
                  <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">
                    {ley.detalles}
                  </p>
                </div>
                
                <div className="mb-4">
                  <h4 className="font-semibold text-gray-900 dark:text-white mb-2">
                    🎯 Aparece frecuentemente en:
                  </h4>
                  <div className="flex flex-wrap gap-2">
                    {ley.oposiciones.map((oposicion, idx) => (
                      <span key={idx} className="bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300 px-3 py-1 rounded-full text-sm">
                        {oposicion}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="flex flex-wrap gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
                  <Link
                    href={`/leyes/${ley.slug}/avanzado?n=25`}
                    className="bg-gradient-to-r from-green-600 to-emerald-600 text-white px-4 py-2 rounded-lg font-medium hover:from-green-700 hover:to-emerald-700 transition-all duration-200 flex items-center space-x-2"
                  >
                    <span>🎯</span>
                    <span>Practicar con Tests</span>
                  </Link>
                  
                  <Link
                    href={`/leyes/${ley.slug}`}
                    className="border-2 border-gray-300 text-gray-600 dark:text-gray-400 px-4 py-2 rounded-lg font-medium hover:bg-gray-50 dark:hover:bg-gray-800/20 transition-all duration-200 flex items-center space-x-2"
                  >
                    <span>📖</span>
                    <span>Ver Ley Completa</span>
                  </Link>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* CTA Final */}
        <div className="text-center mt-16 p-8 bg-gradient-to-r from-blue-600 to-indigo-600 rounded-2xl text-white">
          <h2 className="text-3xl font-bold mb-4">
            🚀 ¿Listo para Dominar las Leyes?
          </h2>
          <p className="text-xl mb-6 opacity-90">
            En Vence te enseñamos técnicas específicas para estudiar cada ley de forma eficaz. 
            Con resúmenes, tests personalizados y metodologías probadas.
          </p>
          
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              href="/nuestras-oposiciones"
              className="bg-white text-blue-600 font-bold py-3 px-8 rounded-xl hover:bg-gray-100 transition-all duration-300 shadow-lg hover:shadow-xl"
            >
              🎯 Comenzar Tests Gratuitos
            </Link>

            <Link
              href="/temarios"
              className="border-2 border-white text-white font-bold py-3 px-8 rounded-xl hover:bg-white/10 transition-all duration-300"
            >
              📚 Ver Todo el Temario
            </Link>
          </div>
        </div>

        {/* Información adicional */}
        <div className="mt-12 grid md:grid-cols-3 gap-6">
          <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-lg text-center">
            <div className="text-4xl mb-4">⚡</div>
            <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">
              Técnicas Especializadas
            </h3>
            <p className="text-gray-600 dark:text-gray-300 text-sm">
              Métodos específicos para memorizar normativas complejas de forma eficiente
            </p>
          </div>

          <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-lg text-center">
            <div className="text-4xl mb-4">📊</div>
            <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">
              Tests Personalizados
            </h3>
            <p className="text-gray-600 dark:text-gray-300 text-sm">
              Practica con preguntas reales de exámenes oficiales por cada ley específica
            </p>
          </div>

          <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-lg text-center">
            <div className="text-4xl mb-4">🎯</div>
            <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">
              Versiones Actualizadas
            </h3>
            <p className="text-gray-600 dark:text-gray-300 text-sm">
              Siempre trabajamos con las versiones consolidadas y vigentes de cada normativa
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}