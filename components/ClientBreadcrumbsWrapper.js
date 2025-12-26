'use client'
import { Suspense } from 'react'
import InteractiveBreadcrumbs from './InteractiveBreadcrumbs'

function BreadcrumbsFallback() {
  return (
    <nav className="bg-gray-50 border-b border-gray-200 py-3">
      <div className="container mx-auto px-4">
        <div className="h-5 w-48 bg-gray-200 animate-pulse rounded"></div>
      </div>
    </nav>
  )
}

export default function ClientBreadcrumbsWrapper() {
  return (
    <Suspense fallback={<BreadcrumbsFallback />}>
      <InteractiveBreadcrumbs />
    </Suspense>
  )
}