'use client'

// hooks/useActiveTestId.ts
//
// Id del test/examen ACTIVO en esta pestaña, o null. Lo escriben ExamLayout y OfficialExamLayout
// (sessionStorage 'vence:active_test_id' + evento 'vence:active-test-changed' al montar/desmontar);
// el header ya lo lee para el badge de "examen pendiente". Reactivo: se re-sincroniza con el evento.
//
// Uso: señal fiable de "el usuario está EN un test/examen ahora mismo" — útil para no navegar y
// perder el progreso (p.ej. el botón de Soporte abre el modal en sitio). Complementa a
// QuestionContext: el modo examen no fija una "pregunta actual" (muestra todas), pero SÍ marca
// aquí que hay un examen en curso.

import { useState, useEffect } from 'react'

export function useActiveTestId(): string | null {
  const [id, setId] = useState<string | null>(null)
  useEffect(() => {
    const sync = () => setId(typeof window !== 'undefined' ? sessionStorage.getItem('vence:active_test_id') : null)
    sync()
    window.addEventListener('vence:active-test-changed', sync)
    return () => window.removeEventListener('vence:active-test-changed', sync)
  }, [])
  return id
}
