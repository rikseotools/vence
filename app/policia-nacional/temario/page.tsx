// app/policia-nacional/temario/page.tsx - Thin wrapper del componente dinámico compartido.
// Fuente única de verdad: BD (oposicion_bloques + topics).
import DynamicTemarioPage from '@/components/temario/DynamicTemarioPage'

// Static generation: cache infinito, invalidar con revalidateTag('temario')
export const revalidate = false

export const metadata = {
  title: 'Temario Policía Nacional 2026 - Escala Básica | Vence.es',
  description: 'Temario oficial de Policía Nacional (Escala Básica) con 45 temas: Ciencias Jurídicas, Ciencias Sociales y Ciencias Técnico-Científicas. Legislación actualizada del BOE.',
  alternates: {
    canonical: 'https://www.vence.es/policia-nacional/temario',
  },
}

export default async function TemarioPage() {
  return (
    <DynamicTemarioPage
      oposicionSlug="policia-nacional"
      oposicionDisplayName="Policía Nacional - Escala Básica"
    />
  )
}
