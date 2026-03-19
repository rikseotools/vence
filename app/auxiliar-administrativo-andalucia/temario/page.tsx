// app/auxiliar-administrativo-andalucia/temario/page.tsx - Server Component para SEO
import { Suspense } from 'react'
import Link from 'next/link'
import InteractiveBreadcrumbs from '@/components/InteractiveBreadcrumbs'
import TemarioClient from './TemarioClient'

// Datos estáticos de los bloques y temas - BOJA junio 2024
const BLOQUES = [
  {
    id: 'bloque1',
    titulo: 'Bloque I: Área Jurídico Administrativa General',
    icon: '⚖️',
    count: 12,
    temas: [
      { id: 1, titulo: 'La Constitución Española de 1978', descripcion: 'Valores superiores y principios inspiradores. Derechos y libertades. Garantías y casos de suspensión.', disponible: true },
      { id: 2, titulo: 'Organización territorial del Estado', descripcion: 'Las Comunidades Autónomas. Los Estatutos de Autonomía. La Administración Local: tipología de Entes Locales.', disponible: true },
      { id: 3, titulo: 'La Comunidad Autónoma de Andalucía', descripcion: 'Antecedentes histórico-culturales. El Estatuto de Autonomía para Andalucía: fundamento, estructura y contenido básico.', disponible: false },
      { id: 4, titulo: 'Organización Institucional de la Comunidad Autónoma de Andalucía', descripcion: 'El Parlamento de Andalucía. El Presidente y el Consejo de Gobierno. La Oficina Andaluza contra el Fraude y la Corrupción.', disponible: false },
      { id: 5, titulo: 'Organización de la Administración de la Junta de Andalucía', descripcion: 'Principios de organización, actuación y atención ciudadana. Organización central y territorial.', disponible: false },
      { id: 6, titulo: 'El Derecho Administrativo', descripcion: 'La Ley. El Reglamento. El acto administrativo. Notificación y publicación. Eficacia y validez. Recursos administrativos.', disponible: true },
      { id: 7, titulo: 'El procedimiento administrativo común', descripcion: 'Los principios generales. Las fases del procedimiento. Derechos de los interesados.', disponible: true },
      { id: 8, titulo: 'Normativa sobre Igualdad y de Género', descripcion: 'Igualdad de Género: conceptos generales. Violencia de género. Publicidad institucional e imagen pública no sexista.', disponible: true },
      { id: 9, titulo: 'La Igualdad de Género en las Políticas Públicas', descripcion: 'Concepto de enfoque de género y transversalidad. La integración de la transversalidad en la Junta de Andalucía.', disponible: false },
      { id: 10, titulo: 'El presupuesto de la Comunidad Autónoma de Andalucía', descripcion: 'Concepto y estructura. Fases del ciclo presupuestario. La ejecución del presupuesto.', disponible: false },
      { id: 11, titulo: 'La función pública en la Administración de la Junta de Andalucía', descripcion: 'Adquisición y pérdida de la relación de servicio. Carrera profesional. Derechos y deberes. Prevención de riesgos laborales.', disponible: true },
      { id: 12, titulo: 'El sistema español de Seguridad Social', descripcion: 'El régimen general. Afiliación: altas, bajas. Cotización: bases y tipos. Recaudación de cuotas.', disponible: false }
    ]
  },
  {
    id: 'bloque2',
    titulo: 'Bloque II: Organización y Gestión Administrativa',
    icon: '📋',
    count: 10,
    temas: [
      { id: 13, titulo: 'La comunicación', descripcion: 'Elementos de la comunicación. Tipos de comunicación: verbal y no verbal. La atención al público.', disponible: false },
      { id: 14, titulo: 'Las relaciones de la ciudadanía con la Junta de Andalucía', descripcion: 'Derechos de información, petición y participación. Transparencia y acceso a la información pública.', disponible: false },
      { id: 15, titulo: 'Documentos de la Administración de la Junta de Andalucía', descripcion: 'Tipos, identidad e imagen corporativa. Recomendaciones de estilo y uso no sexista del lenguaje.', disponible: false },
      { id: 16, titulo: 'La gestión de documentos', descripcion: 'Documentos originales y copias. Desglose de documentos y formación de expedientes. Los registros administrativos.', disponible: false },
      { id: 17, titulo: 'El archivo', descripcion: 'Concepto. Tipos de archivos. Organización del archivo. Normas de seguridad y acceso.', disponible: false },
      { id: 18, titulo: 'La protección de datos', descripcion: 'Regulación legal. Principios de la protección de datos. RGPD y LOPDGDD. Infracciones y sanciones.', disponible: true },
      { id: 19, titulo: 'La calidad', descripcion: 'Concepto de calidad. Medición y costes de la no calidad. Evaluación de la calidad. Cartas de Servicios.', disponible: false },
      { id: 20, titulo: 'Sistemas Informáticos', descripcion: 'Conceptos fundamentales. Hardware. Redes de Área Local. Sistemas Operativos: Windows y Guadalinex.', disponible: false },
      { id: 21, titulo: 'Sistemas Ofimáticos', descripcion: 'Procesadores de texto. Hojas de cálculo. Referencia: LibreOffice 7.3 (Writer y Calc).', disponible: false },
      { id: 22, titulo: 'Redes de Comunicaciones e Internet', descripcion: 'Navegadores. Correo electrónico. Administración electrónica en la Junta de Andalucía.', disponible: false }
    ]
  }
]

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
        <div className="text-center mb-8">
          <h1 className="text-3xl sm:text-4xl font-bold text-gray-900 dark:text-white mb-3">
            Temario Auxiliar Administrativo Junta de Andalucía
          </h1>
          <p className="text-gray-600 dark:text-gray-400 max-w-2xl mx-auto mb-4">
            Contenido literal del BOE organizado conforme a los epígrafes oficiales. Haz clic en cualquier tema para ver la legislación completa.
          </p>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Actualizado a <span className="font-semibold text-gray-700 dark:text-gray-200">{fechaActualizacion}</span> conforme al{' '}
            programa oficial BOJA junio 2024
          </p>
        </div>

        <div className="max-w-4xl mx-auto mb-6 p-5 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700">
          <div className="flex items-start gap-4">
            <div className="flex-shrink-0 w-10 h-10 rounded-full bg-teal-100 dark:bg-teal-900/50 flex items-center justify-center">
              <svg className="w-5 h-5 text-teal-600 dark:text-teal-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div>
              <h2 className="font-semibold text-gray-900 dark:text-white mb-2">¿Por qué Vence ofrece el temario gratis?</h2>
              <div className="text-sm text-gray-600 dark:text-gray-400 space-y-2">
                <p>La legislación es pública y está disponible en el BOE.</p>
                <p>Vence lo organiza y estructura de forma adecuada, qué artículos y de qué leyes entran en cada tema, para que puedas estudiar de forma eficiente.</p>
                <p>Nos gusta mantener el temario de forma literal, artículo a artículo, ya que en el examen preguntarán de forma literal.</p>
                <p><Link href="/login" className="text-teal-600 dark:text-teal-400 hover:underline font-medium">Regístrate</Link> para recibir las actualizaciones en tu correo y practicar haciendo tests.</p>
              </div>
            </div>
          </div>
        </div>

        <TemarioClient
          bloques={BLOQUES}
          oposicion="auxiliar-administrativo-andalucia"
          fechaActualizacion={fechaActualizacion}
        />

        <nav className="sr-only" aria-label="Índice completo del temario">
          <h2>Índice del Temario Auxiliar Administrativo Junta de Andalucía</h2>
          {BLOQUES.map(bloque => (
            <section key={bloque.id}>
              <h3>{bloque.titulo}</h3>
              <ul>
                {bloque.temas.map(tema => (
                  <li key={tema.id}>
                    <Link href={`/auxiliar-administrativo-andalucia/temario/tema-${tema.id}`}>
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
