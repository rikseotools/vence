'use client'

// components/SupportButton.tsx
//
// Botón "Soporte" del header. Comportamiento HÍBRIDO:
//   - DENTRO de un test (hay una pregunta viva en QuestionContext) → abre el modal de soporte
//     AQUÍ MISMO (overlay), SIN navegar. Así el usuario NO pierde el test, y el modal detecta la
//     pregunta que está viendo (por si quiere impugnarla — ver FeedbackModal + resolveQuestionId).
//   - FUERA de un test → navega a /soporte (centro de soporte completo), como antes.
//
// Contexto: el botón navegaba SIEMPRE a /soporte (commit caf6e7f0, feb-26). Eso desmontaba el
// test → se perdía el progreso Y el contexto de la pregunta, así que en /soporte "no se detectaba
// ninguna pregunta" al intentar impugnar. Este híbrido lo arregla sin renunciar al centro de soporte.
//
// Se mantiene como <Link href="/soporte"> (SEO, teclado, y ctrl/cmd/middle-click → abrir en pestaña
// nueva siguen yendo a /soporte); solo el click normal, y solo dentro de un test, abre el modal.

import { useState, type ReactNode, type MouseEvent } from 'react'
import Link from 'next/link'
import { useQuestionContext } from '../contexts/QuestionContext'
import { useActiveTestId } from '../hooks/useActiveTestId'
import FeedbackModal from './FeedbackModal'

interface SupportButtonProps {
  children: ReactNode
  className?: string
  title?: string
  'aria-label'?: string
}

export default function SupportButton({ children, ...linkProps }: SupportButtonProps) {
  const { currentQuestionContext } = useQuestionContext()
  const activeTestId = useActiveTestId()
  const [open, setOpen] = useState(false)

  // "Está en un test/examen" = hay pregunta viva (test normal, y de paso detectable para impugnar)
  // O hay un examen activo (ExamLayout/OfficialExamLayout marcan active_test_id aunque no fijen una
  // "pregunta actual" —muestran todas—). En ambos, abrir el modal en sitio evita perder el progreso.
  const inTest = !!currentQuestionContext?.id || !!activeTestId

  const handleClick = (e: MouseEvent<HTMLAnchorElement>) => {
    // Solo interceptamos el click primario SIN modificadores; ctrl/cmd/shift/botón central
    // → dejar que el navegador abra /soporte (pestaña nueva) como esperaría el usuario.
    const plainLeftClick = e.button === 0 && !e.metaKey && !e.ctrlKey && !e.shiftKey && !e.altKey
    if (inTest && plainLeftClick) {
      e.preventDefault()
      setOpen(true)
    }
  }

  return (
    <>
      {/* aria-haspopup avisa a lectores de pantalla de que, en un test, este enlace abre un diálogo. */}
      <Link href="/soporte" onClick={handleClick} aria-haspopup={inTest ? 'dialog' : undefined} {...linkProps}>
        {children}
      </Link>
      {/* Montamos el modal SOLO al abrir: cerrado no corre sus hooks (más ligero y no exige
          providers cuando el botón se usa suelto). En la app real el AuthProvider está app-wide. */}
      {open && <FeedbackModal isOpen onClose={() => setOpen(false)} />}
    </>
  )
}
