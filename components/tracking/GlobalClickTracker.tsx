// components/tracking/GlobalClickTracker.tsx
// Captura TODOS los clicks del usuario automáticamente
'use client'

import { useEffect, useCallback, useRef } from 'react'
import { usePathname } from 'next/navigation'
import { InteractionTracker } from '@/hooks/useInteractionTracker'
import { useAuth } from '@/contexts/AuthContext'

// Elementos a ignorar (no trackear clicks en estos)
const IGNORED_ELEMENTS = ['html', 'body', 'main', 'div', 'span', 'section', 'article']
const IGNORED_CLASSES = ['backdrop', 'overlay', 'modal-bg']

// Extraer información útil del elemento clickeado
function getElementInfo(element: HTMLElement): {
  tag: string
  text: string
  id: string | null
  classes: string[]
  href: string | null
  dataTrack: string | null
  ariaLabel: string | null
  role: string | null
  closest: {
    button: string | null
    link: string | null
    form: string | null
  }
} {
  // Buscar el elemento interactivo más cercano
  const interactiveElement = element.closest('button, a, input, select, textarea, [role="button"], [onclick]') as HTMLElement | null
  const targetElement = interactiveElement || element

  // Obtener texto visible (truncado)
  let text = ''
  if (targetElement.tagName === 'INPUT' || targetElement.tagName === 'TEXTAREA') {
    text = (targetElement as HTMLInputElement).placeholder || (targetElement as HTMLInputElement).name || ''
  } else {
    text = (targetElement.textContent || '').trim().slice(0, 100)
  }

  // Obtener clases relevantes (filtrar clases de Tailwind genéricas)
  const allClasses = Array.from(targetElement.classList)
  const relevantClasses = allClasses.filter(c =>
    !c.match(/^(flex|grid|block|hidden|w-|h-|p-|m-|bg-|text-|border-|rounded|shadow|transition|hover:|focus:|dark:)/)
  ).slice(0, 5)

  return {
    tag: targetElement.tagName.toLowerCase(),
    text,
    id: targetElement.id || null,
    classes: relevantClasses,
    href: (targetElement as HTMLAnchorElement).href || null,
    dataTrack: targetElement.dataset.track || null,
    ariaLabel: targetElement.getAttribute('aria-label'),
    role: targetElement.getAttribute('role'),
    closest: {
      button: element.closest('button')?.textContent?.trim().slice(0, 50) || null,
      link: (element.closest('a') as HTMLAnchorElement)?.href || null,
      form: element.closest('form')?.id || element.closest('form')?.name || null
    }
  }
}

// Determinar si el click es interesante (no ruido)
function isInterestingClick(element: HTMLElement): boolean {
  const tag = element.tagName.toLowerCase()

  // Siempre trackear elementos interactivos
  if (['button', 'a', 'input', 'select', 'textarea'].includes(tag)) return true

  // Trackear elementos con roles interactivos
  const role = element.getAttribute('role')
  if (role && ['button', 'link', 'tab', 'menuitem', 'option', 'checkbox', 'radio'].includes(role)) return true

  // Trackear elementos con onclick o data-track
  if (element.onclick || element.dataset.track) return true

  // Trackear si tiene un ancestro interactivo cercano
  const closestInteractive = element.closest('button, a, [role="button"], [onclick]')
  if (closestInteractive && closestInteractive !== document.body) return true

  // Ignorar divs/spans genéricos sin interactividad
  if (IGNORED_ELEMENTS.includes(tag)) {
    // Pero trackear si tiene clases específicas que indican interactividad
    const hasInteractiveClass = Array.from(element.classList).some(c =>
      c.includes('btn') || c.includes('button') || c.includes('click') || c.includes('link')
    )
    return hasInteractiveClass
  }

  return false
}

// Determinar la categoría del click
function getClickCategory(element: HTMLElement, pathname: string): string {
  // Por página
  if (pathname.includes('/test')) return 'test'
  if (pathname.includes('/psicotecnicos')) return 'psychometric'
  if (pathname.includes('/temario')) return 'navigation'
  if (pathname.includes('/login') || pathname.includes('/registro')) return 'auth'
  if (pathname.includes('/premium') || pathname.includes('/pricing')) return 'conversion'
  if (pathname.includes('/admin')) return 'ui'

  // Por elemento
  const tag = element.tagName.toLowerCase()
  if (tag === 'a' || element.closest('nav')) return 'navigation'
  if (element.closest('form')) return 'auth'

  return 'ui'
}

interface GlobalClickTrackerProps {
  children: React.ReactNode
}

export default function GlobalClickTracker({ children }: GlobalClickTrackerProps) {
  const pathname = usePathname()
  const { user } = useAuth() as { user: { id: string } | null }
  const lastClickRef = useRef<string>('')
  const lastClickTimeRef = useRef<number>(0)

  const handleClick = useCallback((event: MouseEvent) => {
    const target = event.target as HTMLElement
    if (!target) return

    // Ignorar clicks en elementos no interesantes
    if (!isInterestingClick(target)) return

    // Debounce - ignorar clicks muy rápidos en el mismo elemento
    const clickKey = `${target.tagName}-${target.id}-${target.className}`
    const now = Date.now()
    if (clickKey === lastClickRef.current && now - lastClickTimeRef.current < 300) {
      return
    }
    lastClickRef.current = clickKey
    lastClickTimeRef.current = now

    // Obtener info del elemento
    const elementInfo = getElementInfo(target)
    const category = getClickCategory(target, pathname || '')

    // Enviar evento
    InteractionTracker.track({
      eventType: 'click',
      eventCategory: category as any,
      component: 'GlobalClickTracker',
      action: elementInfo.tag,
      label: elementInfo.text || elementInfo.ariaLabel || elementInfo.id || undefined,
      value: {
        tag: elementInfo.tag,
        id: elementInfo.id,
        classes: elementInfo.classes,
        href: elementInfo.href,
        dataTrack: elementInfo.dataTrack,
        role: elementInfo.role,
        closestButton: elementInfo.closest.button,
        closestLink: elementInfo.closest.link,
        closestForm: elementInfo.closest.form,
        x: event.clientX,
        y: event.clientY,
        pageUrl: pathname
      },
      pageUrl: pathname || undefined,
      elementId: elementInfo.id || undefined,
      elementText: elementInfo.text?.slice(0, 200) || undefined,
      userId: user?.id
    })
  }, [pathname, user?.id])

  useEffect(() => {
    // Capturar todos los clicks en el documento
    document.addEventListener('click', handleClick, true)

    return () => {
      document.removeEventListener('click', handleClick, true)
    }
  }, [handleClick])

  return <>{children}</>
}
