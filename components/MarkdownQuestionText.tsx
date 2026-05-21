'use client'

import ReactMarkdown from 'react-markdown'

interface MarkdownQuestionTextProps {
  text: string
  className?: string
}

/**
 * Renderiza el enunciado de una pregunta con markdown inline (negritas, cursivas).
 * Diseñado para ser un drop-in replacement de {text} en <p> o <h3>.
 * NO añade wrappers extra ni margins — hereda el estilo del padre.
 */
export default function MarkdownQuestionText({ text, className = '' }: MarkdownQuestionTextProps) {
  if (!text) return null

  // Only render markdown if text actually contains markdown syntax
  if (!text.includes('*') && !text.includes('~~')) {
    return <span className="whitespace-pre-line">{text}</span>
  }

  return (
    <span className={className}>
      <ReactMarkdown
        components={{
          // Render paragraphs as spans to avoid nesting <p> inside <p>
          p: ({ children }) => <span>{children}</span>,
          // No links in question text
          a: ({ children }) => <>{children}</>,
        }}
      >{text}</ReactMarkdown>
    </span>
  )
}
