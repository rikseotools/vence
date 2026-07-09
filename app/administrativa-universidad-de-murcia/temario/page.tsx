// app/administrativa-universidad-de-murcia/temario/page.tsx - Thin wrapper del componente dinámico compartido.
// Fuente única de verdad: BD (oposicion_bloques + topics).
import DynamicTemarioPage from '@/components/temario/DynamicTemarioPage'

// force-dynamic: renderizar bajo demanda para no saturar BD en build (3600+ páginas)
export const dynamic = 'force-dynamic'

export const metadata = {
  title: 'Temario Administrativa - Universidad de Murcia | Vence.es',
  description: 'Temario oficial de Administrativa - Universidad de Murcia con legislación literal del BOE. Acceso gratuito a todos los temas organizados por bloques.',
  alternates: {
    canonical: 'https://www.vence.es/administrativa-universidad-de-murcia/temario',
  },
}

export default async function TemarioPage() {
  return (
    <DynamicTemarioPage
      oposicionSlug="administrativa-universidad-de-murcia"
      oposicionDisplayName="Administrativa - Universidad de Murcia"
    />
  )
}
