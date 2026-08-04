// components/TopicNavFooter.tsx — Navegación entre temas del temario
// Componente compartido que muestra el número de tema visible (displayNum)
// en vez del topic_number interno, evitando confusión al usuario.
'use client'

import Link from 'next/link'

interface TopicNavFooterProps {
  topicNumber: number
  basePath: string
  getDisplayNum: (topicNumber: number) => number
  /**
   * Números de tema que EXISTEN en esta oposición. Si se pasa, no se pinta un botón hacia un
   * tema que no está.
   *
   * Nace de un 404 que destapó [T-541]: «Tema siguiente» hacía `topicNumber + 1` a ciegas, y
   * mientras los enlaces se escapaban a otra oposición el fallo quedaba TAPADO — el tema
   * siguiente existía… en la oposición equivocada. Al enderezar los enlaces salió a la luz.
   *
   * Opcional para no tocar las ~120 páginas del catálogo, que numeran por bloques y tienen su
   * propia forma de saberlo; sin el dato se mantiene el comportamiento de siempre.
   */
  temasExistentes?: number[]
}

export default function TopicNavFooter({ topicNumber, basePath, getDisplayNum, temasExistentes }: TopicNavFooterProps) {
  // Sin la lista no se opina (comportamiento histórico); con ella, manda.
  const existe = (n: number) => !temasExistentes || temasExistentes.includes(n)
  const anterior = topicNumber > 1 && existe(topicNumber - 1)
  const siguiente = existe(topicNumber + 1)

  return (
    <footer className="no-print mt-12 pt-8 border-t border-gray-200 dark:border-gray-700">
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex gap-3">
          {anterior && (
            <Link
              href={`${basePath}/temario/tema-${topicNumber - 1}`}
              className="flex items-center gap-2 px-4 py-2 text-gray-600 dark:text-gray-300 hover:text-indigo-600 dark:hover:text-indigo-400 border border-gray-300 dark:border-gray-600 rounded-md transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              Tema {getDisplayNum(topicNumber - 1)}
            </Link>
          )}
          {siguiente && (
          <Link
            href={`${basePath}/temario/tema-${topicNumber + 1}`}
            className="flex items-center gap-2 px-4 py-2 text-gray-600 dark:text-gray-300 hover:text-indigo-600 dark:hover:text-indigo-400 border border-gray-300 dark:border-gray-600 rounded-md transition-colors"
          >
            Tema {getDisplayNum(topicNumber + 1)}
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </Link>
          )}
        </div>

        <Link
          href={`${basePath}/test/tema/${topicNumber}`}
          className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 transition-colors"
        >
          Practicar este tema
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </Link>
      </div>
    </footer>
  )
}
