'use client'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import type { Components } from 'react-markdown'

const components: Components = {
  // H2 — sección principal con línea de acento azul
  h2: ({ children }) => (
    <h2 className="flex items-center gap-2 text-base font-bold text-gray-900 dark:text-gray-100 mt-6 mb-3 pb-1.5 border-b-2 border-indigo-500 dark:border-indigo-400">
      <span className="w-1 h-4 bg-indigo-500 dark:bg-indigo-400 rounded-full flex-shrink-0" />
      {children}
    </h2>
  ),
  // H3 — subsección con borde izquierdo
  h3: ({ children }) => (
    <h3 className="text-sm font-semibold text-indigo-700 dark:text-indigo-300 mt-4 mb-2 pl-2 border-l-2 border-indigo-400 dark:border-indigo-500">
      {children}
    </h3>
  ),
  // H4
  h4: ({ children }) => (
    <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mt-3 mb-1">
      {children}
    </h4>
  ),
  // Párrafos
  p: ({ children }) => (
    <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed mb-2">
      {children}
    </p>
  ),
  // Negrita
  strong: ({ children }) => (
    <strong className="font-semibold text-gray-900 dark:text-gray-100">{children}</strong>
  ),
  // Cita — callout amarillo para notas importantes
  blockquote: ({ children }) => (
    <blockquote className="my-3 pl-3 pr-2 py-2 bg-amber-50 dark:bg-amber-900/20 border-l-4 border-amber-400 dark:border-amber-500 rounded-r-md text-sm text-amber-900 dark:text-amber-200 italic">
      {children}
    </blockquote>
  ),
  // Lista no ordenada
  ul: ({ children }) => (
    <ul className="my-2 pl-4 space-y-1 list-disc text-sm text-gray-700 dark:text-gray-300">
      {children}
    </ul>
  ),
  // Lista ordenada
  ol: ({ children }) => (
    <ol className="my-2 pl-4 space-y-1 list-decimal text-sm text-gray-700 dark:text-gray-300">
      {children}
    </ol>
  ),
  // Ítem de lista
  li: ({ children }) => (
    <li className="leading-relaxed">{children}</li>
  ),
  // Separador horizontal — sección break
  hr: () => (
    <hr className="my-4 border-0 border-t border-gray-200 dark:border-gray-700" />
  ),
  // Código inline
  code: ({ children, className }) => {
    const isBlock = className?.includes('language-')
    if (isBlock) {
      return (
        <code className="block bg-gray-800 dark:bg-gray-900 text-green-300 text-xs p-3 rounded-md font-mono overflow-x-auto my-2">
          {children}
        </code>
      )
    }
    return (
      <code className="bg-gray-100 dark:bg-gray-800 text-indigo-700 dark:text-indigo-300 text-xs font-mono px-1.5 py-0.5 rounded">
        {children}
      </code>
    )
  },
  // Tabla completa — con sombra y bordes redondeados
  table: ({ children }) => (
    <div className="my-3 overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm">
      <table className="min-w-full text-sm divide-y divide-gray-200 dark:divide-gray-700">
        {children}
      </table>
    </div>
  ),
  // Cabecera de tabla
  thead: ({ children }) => (
    <thead className="bg-indigo-600 dark:bg-indigo-800">
      {children}
    </thead>
  ),
  // Cuerpo de tabla
  tbody: ({ children }) => (
    <tbody className="divide-y divide-gray-200 dark:divide-gray-700 bg-white dark:bg-gray-900">
      {children}
    </tbody>
  ),
  // Fila de tabla
  tr: ({ children }) => (
    <tr className="even:bg-gray-50 dark:even:bg-gray-800/50">
      {children}
    </tr>
  ),
  // Celda cabecera
  th: ({ children }) => (
    <th className="px-3 py-2 text-left text-xs font-semibold text-white uppercase tracking-wide">
      {children}
    </th>
  ),
  // Celda de datos
  td: ({ children }) => (
    <td className="px-3 py-1.5 text-xs text-gray-700 dark:text-gray-300 align-top">
      {children}
    </td>
  ),
}

interface MarkdownContentProps {
  content: string | null
  className?: string
}

export default function MarkdownContent({ content, className }: MarkdownContentProps) {
  if (!content) return null
  return (
    <div className={className ?? 'text-sm leading-relaxed'}>
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
        {content}
      </ReactMarkdown>
    </div>
  )
}
