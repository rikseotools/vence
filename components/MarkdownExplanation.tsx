'use client'

import ReactMarkdown from 'react-markdown'

interface MarkdownExplanationProps {
  content: string
  className?: string
  preserveLineBreaks?: boolean
}

/**
 * Componente para renderizar explicaciones con formato markdown
 * Usado en todos los componentes de test para mostrar explicaciones formateadas
 */
export default function MarkdownExplanation({ content, className = '', preserveLineBreaks = false }: MarkdownExplanationProps) {
  if (!content) return null

  // preserveLineBreaks: convierte \n simple a <br> via markdown trailing spaces
  // Usar solo en contextos donde el texto es plano (feedback admin), no en explicaciones de preguntas
  const processed = preserveLineBreaks ? content.replace(/(?<!\n)\n(?!\n)/g, '  \n') : content

  return (
    <div
      className={`
        prose prose-sm max-w-none
        prose-p:my-2 prose-p:leading-relaxed
        prose-strong:text-inherit prose-strong:font-semibold
        prose-em:text-inherit
        prose-ul:my-2 prose-ul:pl-4
        prose-ol:my-2 prose-ol:pl-4
        prose-li:my-0.5
        prose-headings:font-semibold prose-headings:my-2
        ${className}
      `}
    >
      <ReactMarkdown
        components={{
          a: ({ href, children }) => (
            <a href={href} target="_blank" rel="noopener noreferrer">{children}</a>
          ),
        }}
      >{processed}</ReactMarkdown>
    </div>
  )
}
