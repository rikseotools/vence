// app/tecnico-auxiliar-universidad-de-murcia/temario/page.tsx - Thin wrapper del componente dinámico compartido.
// Fuente única de verdad: BD (oposicion_bloques + topics).
import DynamicTemarioPage from '@/components/temario/DynamicTemarioPage'

// force-dynamic: renderizar bajo demanda para no saturar BD en build (3600+ páginas)
export const dynamic = 'force-dynamic'

export const metadata = {
  title: 'Temario Técnico Auxiliar (Auxiliar de Servicios) de la Universidad de Murcia | Vence.es',
  description: 'Temario oficial de Técnico Auxiliar (Auxiliar de Servicios) de la Universidad de Murcia con legislación literal del BOE. Acceso gratuito a todos los temas organizados por bloques.',
  alternates: {
    canonical: 'https://www.vence.es/tecnico-auxiliar-universidad-de-murcia/temario',
  },
}

export default async function TemarioPage() {
  return (
    <DynamicTemarioPage
      oposicionSlug="tecnico-auxiliar-universidad-de-murcia"
      oposicionDisplayName="Técnico Auxiliar (Auxiliar de Servicios) de la Universidad de Murcia"
    />
  )
}
