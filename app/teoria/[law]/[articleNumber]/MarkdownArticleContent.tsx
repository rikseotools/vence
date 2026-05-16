'use client'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

export default function MarkdownArticleContent({ content }: { content: string }) {
  return (
    <div className="prose prose-base max-w-none text-gray-800 leading-relaxed prose-headings:font-semibold prose-h2:text-lg prose-h2:mt-6 prose-h2:mb-3 prose-h3:text-base prose-h3:mt-4 prose-h3:mb-2 prose-table:text-sm prose-td:py-1.5 prose-th:py-1.5 prose-strong:text-gray-900 prose-ul:my-2 prose-li:my-0.5">
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
    </div>
  )
}
