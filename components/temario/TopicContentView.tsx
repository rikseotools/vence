// components/temario/TopicContentView.tsx
//
// [T-611] La página de un TEMA del temario, UNA sola vez.
//
// Hasta el 06/08/2026 este componente vivía copiado en `app/<oposicion>/temario/[slug]/
// TopicContentView.tsx`, una vez por oposición. Al medirlo, lo único que cambiaba de verdad
// entre copias era:
//   · `getBlockInfo` → ya es dato (`lib/temario/bloquesPorOposicion.ts`, [T-611] fase 1)
//   · el color del acento «ha caído en examen» → ahora dato (`lib/temario/acentoPorOposicion.ts`)
//   · si montaban o no `<TopicVideoCourses>` (faltaba en 54 → se les daba por olvido, no por
//     decisión: el componente se auto-oculta cuando no hay cursos)
//   · el `loginHref` del botón de imprimir, escrito a mano en 119 copias con exactamente la
//     misma fórmula que las otras 12 derivaban
// Todo lo demás eran 122 cuerpos distintos por deriva de copia-pega, con consecuencias
// medidas: `expandAll` declarado en 78 copias y conectado a un botón en CERO.
//
// ⚠️ NO vuelvas a copiar este fichero bajo `app/`. Una oposición nueva se da de alta con una
// FILA en `lib/temario/bloquesPorOposicion.ts` (y, si quiere acento propio, otra en
// `acentoPorOposicion.ts`). Lo hace cumplir el guardarraíl
// `__tests__/guardrails/testsDeOposicionPersonalizada.guardrail.test.ts`.
'use client'

import { useEffect, useState } from 'react'
import ArticleTTS from '@/components/ArticleTTS'
import LawTestCTA from '@/components/temario/LawTestCTA'
import Link from 'next/link'
import type { TopicContent, LawWithArticles, Article } from '@/lib/api/temario/schemas'
import { useAuth } from '@/contexts/AuthContext'
import TopicPrintButton from '@/components/TopicPrintButton'
import { useLawSlugs } from '@/contexts/LawSlugContext'
import TopicVideoCourses from '@/components/TopicVideoCourses'
import TopicNavFooter from '@/components/TopicNavFooter'
import MarkdownContent from '@/components/MarkdownContent'
import { encabezadoArticulo } from '@/lib/teoria/encabezadoArticulo'
import { resolverBloque } from '@/lib/temario/bloquesTemario'
import { BLOQUES_POR_OPOSICION } from '@/lib/temario/bloquesPorOposicion'
import { acentoDe, clasesAcento, type AcentoTemario, type ClasesAcento } from '@/lib/temario/acentoPorOposicion'
import { anclaArticulo } from '@/lib/navigation/backToArticleLink'
import { emitClientEvent } from '@/lib/observability/client'

interface TopicContentViewProps {
  content: TopicContent
  /** Slug de la oposición. Resuelve bloques y acento; también el `loginHref` de imprimir. */
  oposicion?: string
  /**
   * Prefijo del que cuelgan los enlaces de esta pantalla (miga «Temario», tema anterior/
   * siguiente y «Practicar este tema»). Por defecto se deriva de `oposicion`.
   *
   * Existe porque una oposición PERSONALIZADA no tiene slug: vive en `/oposicion-personalizada/
   * <id>`, y su página reutiliza este componente. Sin poder decirlo, heredaba el valor por
   * defecto de `oposicion` —un slug REAL— y mandaba al usuario al temario de otra oposición sin
   * fallar por ningún lado ([T-541]). Se pasa explícito y no se adivina del perfil: se puede
   * estar leyendo una personalizada que no es tu objetivo, porque son públicas.
   */
  basePath?: string
  /** Números de tema que existen en esta oposición; sin esto el pie navega a ciegas. [T-541] */
  temasExistentes?: number[]
  updatedAt: string
  /** Acento del «ha caído en examen». Por defecto, el declarado para esa oposición. */
  acento?: AcentoTemario
}

export default function TopicContentView({
  content,
  oposicion,
  basePath: basePathProp,
  temasExistentes,
  updatedAt,
  acento: acentoProp,
}: TopicContentViewProps) {
  const [expandedLaws, setExpandedLaws] = useState<Set<string>>(new Set())
  const { user, userProfile } = useAuth() as { user: any; userProfile: any }

  // El prefijo lo manda quien renderiza; `oposicion` solo es el atajo de las páginas del
  // catálogo, donde slug y raíz coinciden. Ver `basePath` en las props ([T-541]).
  const basePath = basePathProp ?? (oposicion ? `/${oposicion}` : '')

  const tramos = oposicion ? BLOQUES_POR_OPOSICION[oposicion] : undefined
  const bloqueDe = (topicNumber: number) => resolverBloque(tramos, topicNumber)
  const blockInfo = bloqueDe(content.topicNumber)

  const acento = clasesAcento(acentoProp ?? acentoDe(oposicion))

  const toggleLaw = (lawId: string) => {
    setExpandedLaws((prev) => {
      const next = new Set(prev)
      if (next.has(lawId)) {
        next.delete(lawId)
      } else {
        next.add(lawId)
      }
      return next
    })
  }

  // Contar artículos con preguntas oficiales
  const articlesWithOfficialQuestions = content.laws.reduce((acc, law) => {
    return acc + law.articles.filter((a) => a.officialQuestionCount > 0).length
  }, 0)

  // [T-611] Al VOLVER de un test, devolverle a su artículo. No basta con el ancla del
  // navegador: la tarjeta existe en el DOM pero su ley está PLEGADA (`hidden`), así que sin
  // desplegarla el salto no lleva a ninguna parte. Se hace en efecto (tras montar) para no
  // tocar el HTML que se sirve — es una página ISR y cualquier diferencia sería un hydration
  // mismatch.
  useEffect(() => {
    if (typeof window === 'undefined') return
    const ancla = window.location.hash.replace(/^#/, '')
    if (!ancla) return

    const ley = content.laws.find((l) =>
      l.articles.some((a) => anclaArticulo(l.law.shortName, a.articleNumber) === ancla),
    )
    emitClientEvent({
      severity: 'info',
      eventType: 'temario_vuelta_articulo',
      metadata: {
        resultado: ley ? 'articulo' : 'no_encontrado',
        oposicion: oposicion ?? null,
        topicNumber: content.topicNumber,
      },
    })
    if (!ley) return

    setExpandedLaws((prev) => new Set(prev).add(ley.law.id))
    // El artículo sigue oculto hasta que React repinta con la ley ya desplegada.
    const t = window.setTimeout(() => {
      // `scrollIntoView` no está en todos los entornos (jsdom, navegadores in-app antiguos).
      // Si no está, la ley ya se ha desplegado y el ancla del navegador hace su trabajo: lo
      // que NO puede pasar es que una excepción aquí se lleve por delante la vuelta entera.
      document.getElementById(ancla)?.scrollIntoView?.({ block: 'center' })
    }, 0)
    return () => window.clearTimeout(t)
    // Solo al abrir la página con ancla: re-ejecutarlo pelearía con el usuario si pliega la ley.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [content.topicNumber])

  // Lo escribían a mano 119 copias con esta misma fórmula; las otras 12 ya lo derivaban así.
  // Sin slug (oposición PERSONALIZADA) no se inventa uno: antes heredaba el de
  // `administrativo-estado` por el valor por defecto del componente, que es el mismo modo de
  // fallo de [T-541] un enlace más abajo.
  const loginHref = oposicion
    ? `/login?oposicion=${oposicion.replace(/-/g, '_')}&return_to=${basePath}/temario`
    : `/login?return_to=${basePath}/temario`

  return (
    <>
      {/* Print styles */}
      <style jsx global>{`
        @media print {
          .no-print {
            display: none !important;
          }
          body {
            background: white !important;
            color: black !important;
          }
          .print-break-before {
            page-break-before: always;
          }
          .print-avoid-break {
            page-break-inside: avoid;
          }
          .article-content {
            font-size: 11pt;
            line-height: 1.5;
          }
          .print-header {
            border-bottom: 2px solid #000;
            padding-bottom: 1rem;
            margin-bottom: 1.5rem;
          }
          .law-section {
            margin-bottom: 2rem;
          }
          @page {
            margin: 2cm;
          }
        }
      `}</style>

      {/* Control bar */}
      <div className="no-print sticky top-0 z-10 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 shadow-sm">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between">
          <Link
            href={`${basePath}/temario`}
            className="flex items-center gap-2 text-gray-600 dark:text-gray-300 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            <span>Volver al índice</span>
          </Link>

          <TopicPrintButton loginHref={loginHref} topicNumber={content.topicNumber} />
        </div>
      </div>

      {/* Main content */}
      <main className="max-w-4xl mx-auto px-4 py-8">
        {/* Header */}
        <header className="print-header mb-8">
          {blockInfo.block && (
            <span className="inline-block px-3 py-1 mb-3 text-sm font-medium text-blue-700 dark:text-blue-300 bg-blue-100 dark:bg-blue-900/30 rounded-full">
              {blockInfo.block}
            </span>
          )}
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-3">
            Tema {blockInfo.displayNum}: {content.title.replace(/^Tema \d+:\s*/, '')}
          </h1>

          {content.description && (
            <p className="text-gray-600 dark:text-gray-400 text-lg mb-4">{content.description}</p>
          )}

          {/* Stats */}
          <div className="flex flex-wrap gap-4 text-sm">
            <span className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-200 rounded-full">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
              </svg>
              {content.laws.length} {content.laws.length === 1 ? 'ley' : 'leyes'}
            </span>
            <span className="flex items-center gap-1.5 px-3 py-1.5 bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200 rounded-full">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              {content.totalArticles} artículos
            </span>
            {articlesWithOfficialQuestions > 0 && (
              <span className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full ${acento.pildora}`}>
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.857-9.809a.75.75 0 00-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 10-1.06 1.061l2.5 2.5a.75.75 0 001.137-.089l4-5.5z" clipRule="evenodd" />
                </svg>
                {articlesWithOfficialQuestions} con preguntas de examen
              </span>
            )}
          </div>

          {/* Mensaje personalizado para usuarios logueados */}
          {user && (() => {
            // Obtener nombre: userProfile > user_metadata > email
            const userName = userProfile?.user_name || user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'Opositor/a'
            // Obtener avatar: userProfile > user_metadata
            const avatarUrl = userProfile?.avatar_url || user?.user_metadata?.avatar_url
            return (
              <div className="mt-4 p-4 bg-gradient-to-r from-purple-50 to-indigo-50 dark:from-purple-900/20 dark:to-indigo-900/20 border border-purple-200 dark:border-purple-700 rounded-xl">
                <div className="flex items-start gap-3">
                  {/* Avatar del usuario */}
                  <div className="flex-shrink-0 w-10 h-10 bg-purple-100 dark:bg-purple-800 rounded-full flex items-center justify-center overflow-hidden">
                    {avatarUrl ? (
                      <img src={avatarUrl} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <span className="text-lg font-bold text-purple-600 dark:text-purple-300">
                        {userName[0].toUpperCase()}
                      </span>
                    )}
                  </div>
                  <div className="flex-1">
                    <p className="text-sm text-purple-900 dark:text-purple-100">
                      <span className="font-semibold">{userName}</span>, este temario está{' '}
                      <span className="font-semibold text-purple-700 dark:text-purple-300">personalizado para ti</span>.{' '}
                      Cuantos más tests de repaso hagas, más aprende Vence de ti, para que seas más productivo y te enfoques en lo importante.
                    </p>
                  </div>
                </div>
              </div>
            )
          })()}

          {/* Fecha de actualización y registro */}
          <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Actualizado a{' '}
              <span className="font-semibold text-gray-800 dark:text-gray-200">{updatedAt}</span>.{' '}
              <Link href="/login" className="text-indigo-600 dark:text-indigo-400 hover:underline font-medium">
                Regístrate
              </Link>
              {' '}para recibir actualizaciones cuando la legislación cambie.
            </p>
          </div>
        </header>

        {/* Video course banner — se auto-oculta si esta oposición no tiene cursos */}
        <TopicVideoCourses courses={content.videoCourses} />

        {/* Laws and articles */}
        <div className="space-y-6">
          {content.laws.map((lawData, index) => (
            <LawSection
              key={lawData.law.id}
              lawData={lawData}
              isExpanded={expandedLaws.has(lawData.law.id)}
              onToggle={() => toggleLaw(lawData.law.id)}
              isFirst={index === 0}
              acento={acento}
            />
          ))}
        </div>

        {/* Empty state */}
        {content.laws.length === 0 && (
          <div className="text-center py-12">
            <svg className="w-16 h-16 mx-auto text-gray-300 dark:text-gray-600 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
              Contenido no disponible
            </h3>
            <p className="text-gray-500 dark:text-gray-400">
              Este tema aún no tiene contenido asignado.
            </p>
          </div>
        )}

        <TopicNavFooter
          temasExistentes={temasExistentes}
          topicNumber={content.topicNumber}
          basePath={basePath}
          getDisplayNum={(n) => bloqueDe(n).displayNum}
        />
      </main>
    </>
  )
}

// Law section component
interface LawSectionProps {
  lawData: LawWithArticles
  isExpanded: boolean
  onToggle: () => void
  isFirst: boolean
  acento: ClasesAcento
}

function LawSection({ lawData, isExpanded, onToggle, isFirst, acento }: LawSectionProps) {
  const { law, articles } = lawData
  const officialCount = articles.filter((a) => a.officialQuestionCount > 0).length

  return (
    <section className={`law-section ${!isFirst ? 'print-break-before' : ''}`}>
      {/* Law header - clickable */}
      <button
        onClick={onToggle}
        className="no-print w-full flex items-center justify-between p-4 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-750 transition-colors"
      >
        <div className="text-left">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            {law.shortName}
          </h2>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {law.name} {law.year && `(${law.year})`}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-right">
            <span className="text-sm text-gray-500 dark:text-gray-400">
              {articles.length} artículos
            </span>
            {officialCount > 0 && (
              <span className={`block text-xs ${acento.contadorLey}`}>
                {officialCount} con examen
              </span>
            )}
          </div>
          <svg
            className={`w-5 h-5 text-gray-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </button>

      {/* Enlace a test - siempre visible */}
      <div className="no-print flex items-center justify-between mt-1 -mb-1 px-1">
        <ArticleTTS articles={articles} lawName={law.shortName} />
        <LawTestCTA lawShortName={law.shortName} articles={articles} />
      </div>

      {/* Print-only law header */}
      <div className="hidden print:block mb-4">
        <h2 className="text-xl font-bold text-black border-b-2 border-gray-300 pb-2">
          {law.shortName}
        </h2>
        <p className="text-sm text-gray-600 mt-1">
          {law.name} {law.year && `(${law.year})`}
        </p>
      </div>

      {/* Articles list */}
      <div className={`mt-2 space-y-4 ${!isExpanded ? 'hidden print:block' : ''}`}>
        {articles.map((article) => (
          <ArticleCard
            key={article.id}
            article={article}
            lawShortName={law.shortName}
            acento={acento}
          />
        ))}
      </div>
    </section>
  )
}

// Article card component
function ArticleCard({
  article,
  lawShortName,
  acento,
}: {
  article: Article
  lawShortName: string
  acento: ClasesAcento
}) {
  const { getSlug } = useLawSlugs()
  const hasOfficialQuestions = article.officialQuestionCount > 0
  // [T-611] El sitio al que se vuelve tras el test. Sin este `id` el enlace de vuelta no tiene
  // a dónde apuntar: eran 0 de 131 copias las que anclaban sus artículos.
  const ancla = anclaArticulo(lawShortName, article.articleNumber) ?? undefined

  return (
    <article
      id={ancla}
      className={`print-avoid-break scroll-mt-20 bg-white dark:bg-gray-800 border rounded-lg overflow-hidden ${
        hasOfficialQuestions ? acento.bordeArticulo : 'border-gray-200 dark:border-gray-700'
      }`}
    >
      {/* Article header */}
      <div
        className={`px-4 py-3 border-b ${
          hasOfficialQuestions
            ? acento.fondoCabecera
            : 'bg-gray-50 dark:bg-gray-750 border-gray-200 dark:border-gray-700'
        }`}
      >
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-baseline gap-2 flex-1 min-w-0">
            <span className="font-mono text-sm font-semibold text-indigo-600 dark:text-indigo-400 flex-shrink-0">
              Art. {article.articleNumber}
            </span>
            {(() => {
              // T-596: el encabezado NO puede colgar de `title` — 23% del banco lo tiene a NULL
              // teniendo el texto guardado, y esas tarjetas se servían mudas.
              const encabezado = encabezadoArticulo(article)
              return encabezado ? (
                <h3 className="font-medium text-gray-900 dark:text-white truncate">{encabezado}</h3>
              ) : null
            })()}
          </div>
          {/* Badge de pregunta de examen */}
          {hasOfficialQuestions && (
            <div className={`flex-shrink-0 flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-full ${acento.badge}`}>
              <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.857-9.809a.75.75 0 00-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 10-1.06 1.061l2.5 2.5a.75.75 0 001.137-.089l4-5.5z" clipRule="evenodd" />
              </svg>
              <span className="hidden sm:inline">Examen</span>
              <span className="font-semibold">{article.officialQuestionCount}</span>
            </div>
          )}
        </div>
        {/* Location info */}
        {(article.titleNumber || article.chapterNumber || article.section) && (
          <div className="mt-1 text-xs text-gray-500 dark:text-gray-400 flex flex-wrap gap-2">
            {article.titleNumber && <span>Título {article.titleNumber}</span>}
            {article.chapterNumber && <span>Capítulo {article.chapterNumber}</span>}
            {article.section && <span>{article.section}</span>}
          </div>
        )}
      </div>

      {/* Article content */}
      <div className="px-4 py-4 article-content text-gray-700 dark:text-gray-300 leading-relaxed">
        {article.content ? (
          <MarkdownContent content={article.content} />
        ) : (
          <p className="text-gray-400 dark:text-gray-500 italic">Contenido no disponible</p>
        )}
      </div>

      {/* Test button for this article - only show if article has questions */}
      {article.questionCount > 0 && (
        <div className="no-print px-4 pb-4 flex justify-end">
          <Link
            href={`/leyes/${getSlug(lawShortName)}?selected_articles=${article.articleNumber}&source=temario`}
            onClick={() => {
              // Vuelta de «📖 Volver a mi temario» (LawTestPageWrapper). [T-611] Va CON el
              // ancla del artículo: sin ella devolvía arriba del tema y con las leyes
              // plegadas, que es justo lo que reportó la usuaria.
              if (typeof window !== 'undefined') {
                const base = window.location.href.split('#')[0]
                sessionStorage.setItem('temario_return_url', ancla ? `${base}#${ancla}` : base)
              }
            }}
            className="inline-flex items-center px-2 py-1 text-xs font-medium text-white bg-green-600 hover:bg-green-700 rounded transition-colors"
          >
            Hacer test Art. {article.articleNumber}
          </Link>
        </div>
      )}
    </article>
  )
}
