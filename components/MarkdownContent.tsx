'use client'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

interface MarkdownContentProps {
  content: string | null
  className?: string
}

export default function MarkdownContent({ content, className }: MarkdownContentProps) {
  if (!content) return null
  return (
    <div className={className ?? 'prose prose-sm dark:prose-invert max-w-none text-gray-700 dark:text-gray-300 leading-relaxed prose-headings:font-semibold prose-h2:text-base prose-h2:mt-4 prose-h2:mb-2 prose-h3:text-sm prose-strong:text-gray-900 dark:prose-strong:text-white prose-ul:my-2 prose-li:my-0.5 prose-table:text-sm prose-td:py-1 prose-th:py-1'}>
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
    </div>
  )
}
