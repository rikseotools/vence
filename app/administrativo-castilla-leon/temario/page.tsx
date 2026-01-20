// app/administrativo-castilla-leon/temario/page.tsx - Server Component para SEO
import { Suspense } from 'react'
import Link from 'next/link'
import InteractiveBreadcrumbs from '@/components/InteractiveBreadcrumbs'
import TemarioClient from './TemarioClient'

// Datos estáticos de los bloques y temas - Cuerpo Administrativo Junta de Castilla y León
const BLOQUES = [
  {
    id: 'grupo1',
    titulo: 'Grupo I: Organización del Estado, UE y Comunidad Autónoma',
    icon: '🏛️',
    count: 10,
    temas: [
      { id: 1, titulo: 'La Constitución Española', descripcion: 'Estructura, principios, derechos y deberes fundamentales. Garantías y suspensión de derechos.', disponible: false },
      { id: 2, titulo: 'La Administración General del Estado', descripcion: 'Regulación y estructura. Ministerios y órganos superiores y directivos.', disponible: false },
      { id: 3, titulo: 'La Administración Local', descripcion: 'La provincia, el municipio y otras entidades. La organización territorial de la Comunidad de Castilla y León.', disponible: false },
      { id: 4, titulo: 'La Unión Europea', descripcion: 'Las instituciones europeas: Consejo Europeo, Parlamento, Comisión y Tribunal de Justicia.', disponible: false },
      { id: 5, titulo: 'El Estatuto de Autonomía de Castilla y León', descripcion: 'Estructura, contenido y reforma. Competencias de la Comunidad Autónoma.', disponible: false },
      { id: 6, titulo: 'Las Cortes de Castilla y León', descripcion: 'Composición, organización y funcionamiento. Funciones y procedimientos parlamentarios.', disponible: false },
      { id: 7, titulo: 'Instituciones propias de la Comunidad', descripcion: 'El Procurador del Común, Consejo Consultivo, Consejo de Cuentas y Consejo Económico y Social.', disponible: false },
      { id: 8, titulo: 'El Gobierno de la Comunidad', descripcion: 'El Presidente de la Junta, la Junta de Castilla y León y los Consejeros. Composición y funciones.', disponible: false },
      { id: 9, titulo: 'La Administración de Castilla y León', descripcion: 'Principios de organización y funcionamiento. Órganos centrales y periféricos.', disponible: false },
      { id: 10, titulo: 'El Sector Público de Castilla y León', descripcion: 'Administración Institucional y Empresas Públicas. Organismos autónomos y entes públicos.', disponible: false },
    ]
  },
  {
    id: 'grupo2',
    titulo: 'Grupo II: Derecho y Régimen Jurídico de las AAPP',
    icon: '⚖️',
    count: 9,
    temas: [
      { id: 11, titulo: 'Fuentes del Derecho Administrativo', descripcion: 'La jerarquía normativa. La Ley. Disposiciones del Gobierno con fuerza de ley. El Reglamento.', disponible: false },
      { id: 12, titulo: 'El Acto Administrativo', descripcion: 'Concepto, clases y elementos. Motivación, notificación y publicación. Eficacia y validez.', disponible: false },
      { id: 13, titulo: 'El Procedimiento Administrativo Común', descripcion: 'Fases del procedimiento: iniciación, ordenación, instrucción y terminación. Plazos.', disponible: false },
      { id: 14, titulo: 'La Revisión de los Actos Administrativos', descripcion: 'Revisión de oficio. Recursos administrativos: alzada, reposición y extraordinario de revisión.', disponible: false },
      { id: 15, titulo: 'Régimen Jurídico del Sector Público', descripcion: 'Ley 40/2015. Órganos administrativos. Principios de la potestad organizatoria.', disponible: false },
      { id: 16, titulo: 'La Potestad Sancionadora', descripcion: 'Principios. El procedimiento sancionador. La responsabilidad patrimonial de las Administraciones.', disponible: false },
      { id: 17, titulo: 'Los Contratos del Sector Público', descripcion: 'Tipología y elementos. Procedimientos de adjudicación. Ejecución y modificación.', disponible: false },
      { id: 18, titulo: 'Las Subvenciones Públicas', descripcion: 'Concepto y tipos. Procedimientos de concesión. Obligaciones y reintegro.', disponible: false },
      { id: 19, titulo: 'Políticas de Igualdad', descripcion: 'Igualdad de género. No discriminación. Políticas sobre discapacidad y dependencia.', disponible: false },
    ]
  },
  {
    id: 'grupo3',
    titulo: 'Grupo III: Régimen Jurídico de Empleados Públicos',
    icon: '👥',
    count: 5,
    temas: [
      { id: 20, titulo: 'El Estatuto Básico del Empleado Público', descripcion: 'TREBEP. Clases de personal. Derechos y deberes. Situaciones administrativas.', disponible: false },
      { id: 21, titulo: 'Ley de la Función Pública de Castilla y León', descripcion: 'Estructura y contenido. Cuerpos y escalas. Provisión de puestos y carrera profesional.', disponible: false },
      { id: 22, titulo: 'Derecho de Sindicación, Huelga e Incompatibilidades', descripcion: 'Libertad sindical. Derecho de huelga. Régimen de incompatibilidades del personal.', disponible: false },
      { id: 23, titulo: 'El Personal Laboral', descripcion: 'Régimen jurídico. El contrato de trabajo. Convenios colectivos. Derechos y deberes.', disponible: false },
      { id: 24, titulo: 'Ley General de la Seguridad Social', descripcion: 'Campo de aplicación. Afiliación y cotización. Acción protectora del sistema.', disponible: false },
    ]
  },
  {
    id: 'grupo4',
    titulo: 'Grupo IV: Gestión Financiera',
    icon: '💰',
    count: 6,
    temas: [
      { id: 25, titulo: 'El Presupuesto', descripcion: 'Concepto y principios presupuestarios. Presupuestos de Castilla y León: contenido, estructura y elaboración.', disponible: false },
      { id: 26, titulo: 'Los Créditos Presupuestarios', descripcion: 'Operaciones presupuestarias. Modificaciones de crédito. Créditos extraordinarios y suplementos.', disponible: false },
      { id: 27, titulo: 'La Gestión del Gasto', descripcion: 'Órganos competentes. Fases del procedimiento: autorización, disposición, obligación y pago.', disponible: false },
      { id: 28, titulo: 'Expedientes de Gasto', descripcion: 'Gestión de expedientes de gasto en contratos públicos y subvenciones. Documentos contables.', disponible: false },
      { id: 29, titulo: 'Nóminas de Empleados Públicos', descripcion: 'Estructura y confección. Retribuciones básicas y complementarias. Deducciones.', disponible: false },
      { id: 30, titulo: 'Control del Gasto Público', descripcion: 'Control interno: función interventora y control financiero. Control externo: Consejo de Cuentas.', disponible: false },
    ]
  },
  {
    id: 'grupo5',
    titulo: 'Grupo V: Competencias',
    icon: '💻',
    count: 11,
    temas: [
      { id: 31, titulo: 'Derechos de las Personas', descripcion: 'Derechos ante la Administración. Calidad en los servicios públicos. Cartas de servicios.', disponible: false },
      { id: 32, titulo: 'Oficinas de Asistencia en Materia de Registros', descripcion: 'Funciones y organización. Registro electrónico. Compulsa de documentos.', disponible: false },
      { id: 33, titulo: 'Administración Electrónica', descripcion: 'Servicios de información al ciudadano. El 012. Sede electrónica y portal de la Junta.', disponible: false },
      { id: 34, titulo: 'Transparencia y Protección de Datos', descripcion: 'Ley de Transparencia. Acceso a información pública. RGPD y LOPDGDD.', disponible: false },
      { id: 35, titulo: 'El Documento Administrativo', descripcion: 'Concepto y funciones. El expediente administrativo. Documentos electrónicos y copias.', disponible: false },
      { id: 36, titulo: 'Archivo de Documentos', descripcion: 'Concepto y tipos de archivo. Acceso a documentos. Conservación y eliminación.', disponible: false },
      { id: 37, titulo: 'Simplificación Administrativa', descripcion: 'Principios. Reducción de cargas. Administración electrónica y tramitación simplificada.', disponible: false },
      { id: 38, titulo: 'Informática Básica', descripcion: 'Componentes de hardware. Sistemas operativos: Windows 11. Gestión de archivos y carpetas.', disponible: false },
      { id: 39, titulo: 'Ofimática: Word y Excel', descripcion: 'Microsoft 365. Procesador de textos: funciones principales. Hoja de cálculo: fórmulas y gráficos.', disponible: false },
      { id: 40, titulo: 'Correo Electrónico e Internet', descripcion: 'Conceptos básicos. Navegadores y buscadores. Outlook: envío y recepción de mensajes.', disponible: false },
      { id: 41, titulo: 'Seguridad y Salud en el Trabajo', descripcion: 'Prevención de riesgos laborales. Riesgos en puestos administrativos. Ergonomía y pantallas.', disponible: false },
    ]
  }
]

// Obtener fecha formateada en el servidor
function getFechaActualizacion() {
  return new Date().toLocaleDateString('es-ES', {
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  })
}

export default function TemarioPage() {
  const fechaActualizacion = getFechaActualizacion()

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <Suspense fallback={<div className="h-10" />}>
        <InteractiveBreadcrumbs />
      </Suspense>

      <div className="container mx-auto px-4 py-8">
        {/* Header - SSR para SEO */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 rounded-full text-sm font-medium mb-4">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            Próximamente disponible
          </div>
          <h1 className="text-3xl sm:text-4xl font-bold text-gray-900 dark:text-white mb-3">
            Temario Administrativo Junta de Castilla y León
          </h1>
          <p className="text-gray-600 dark:text-gray-400 max-w-2xl mx-auto mb-4">
            41 temas oficiales organizados en 5 grupos conforme al programa del BOCYL.
            Próximamente con contenido literal de la legislación.
          </p>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Conforme a la{' '}
            <a
              href="https://bocyl.jcyl.es/boletines/2024/10/08/pdf/BOCYL-D-08102024-4.pdf"
              target="_blank"
              rel="noopener noreferrer"
              className="text-indigo-600 dark:text-indigo-400 hover:underline font-medium"
            >
              convocatoria BOCYL 08/10/2024
            </a>
            {' '}— 191 plazas turno libre
          </p>
        </div>

        {/* Info de la oposición */}
        <div className="max-w-4xl mx-auto mb-6 p-5 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700">
          <div className="flex items-start gap-4">
            <div className="flex-shrink-0 w-10 h-10 rounded-full bg-purple-100 dark:bg-purple-900/50 flex items-center justify-center">
              <span className="text-xl">🦁</span>
            </div>
            <div className="flex-1">
              <h2 className="font-semibold text-gray-900 dark:text-white mb-2">Cuerpo Administrativo de la Junta de Castilla y León</h2>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
                <div>
                  <span className="text-gray-500 dark:text-gray-400">Plazas:</span>
                  <p className="font-semibold text-gray-900 dark:text-white">191</p>
                </div>
                <div>
                  <span className="text-gray-500 dark:text-gray-400">Grupo:</span>
                  <p className="font-semibold text-gray-900 dark:text-white">C1</p>
                </div>
                <div>
                  <span className="text-gray-500 dark:text-gray-400">Examen:</span>
                  <p className="font-semibold text-gray-900 dark:text-white">100 test</p>
                </div>
                <div>
                  <span className="text-gray-500 dark:text-gray-400">Tiempo:</span>
                  <p className="font-semibold text-gray-900 dark:text-white">130 min</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Aviso de próximamente */}
        <div className="max-w-4xl mx-auto mb-6 p-5 bg-amber-50 dark:bg-amber-900/20 rounded-xl border border-amber-200 dark:border-amber-700">
          <div className="flex items-start gap-4">
            <div className="flex-shrink-0 w-10 h-10 rounded-full bg-amber-100 dark:bg-amber-900/50 flex items-center justify-center">
              <svg className="w-5 h-5 text-amber-600 dark:text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div>
              <h2 className="font-semibold text-amber-800 dark:text-amber-200 mb-1">Contenido en preparación</h2>
              <p className="text-sm text-amber-700 dark:text-amber-300">
                Estamos preparando el contenido completo del temario con la legislación literal.
                Regístrate para ser notificado cuando esté disponible.
              </p>
            </div>
          </div>
        </div>

        {/* Componente cliente para interactividad */}
        <TemarioClient
          bloques={BLOQUES}
          oposicion="administrativo-castilla-leon"
          fechaActualizacion={fechaActualizacion}
        />

        {/* Lista de todos los temas para SEO (oculto visualmente pero indexable) */}
        <nav className="sr-only" aria-label="Índice completo del temario">
          <h2>Índice del Temario Administrativo Junta de Castilla y León</h2>
          {BLOQUES.map(bloque => (
            <section key={bloque.id}>
              <h3>{bloque.titulo}</h3>
              <ul>
                {bloque.temas.map(tema => (
                  <li key={tema.id}>
                    <Link href={`/administrativo-castilla-leon/temario/tema-${tema.id}`}>
                      Tema {tema.id}: {tema.titulo} - {tema.descripcion}
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </nav>
      </div>
    </div>
  )
}
