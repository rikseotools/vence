// app/policia-municipal-madrid/temario/page.tsx - Thin wrapper del componente dinámico compartido.
// Fuente única de verdad: BD (oposicion_bloques + topics).
import DynamicTemarioPage from '@/components/temario/DynamicTemarioPage'

// PN es oposición nueva con poco tráfico — dynamic hasta que el pool se estabilice
export const dynamic = 'force-dynamic'

export const metadata = {
  title: 'Temario Policía Municipal del Ayuntamiento de Madrid 2026 - Escala Básica | Vence.es',
  description: 'Temario oficial de Policía Municipal del Ayuntamiento de Madrid (Escala Básica) con 45 temas: Ciencias Jurídicas, Ciencias Sociales y Ciencias Técnico-Científicas. Legislación actualizada del BOE.',
  alternates: {
    canonical: 'https://www.vence.es/policia-municipal-madrid/temario',
  },
}

export default async function TemarioPage() {
  return (
    <DynamicTemarioPage
      oposicionSlug="policia-municipal-madrid"
      oposicionDisplayName="Policía Municipal del Ayuntamiento de Madrid - Escala Básica"
    />
  )
}
