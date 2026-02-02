'use client'

import ReactMarkdown from 'react-markdown'

interface MarkdownExplanationProps {
  content: string
  className?: string
}

/**
 * Componente para renderizar explicaciones con formato markdown
 * Usado en todos los componentes de test para mostrar explicaciones formateadas
 */
export default function MarkdownExplanation({ content, className = '' }: MarkdownExplanationProps) {
  if (!content) return null

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
      <ReactMarkdown>{content}</ReactMarkdown>
    </div>
  )
}
