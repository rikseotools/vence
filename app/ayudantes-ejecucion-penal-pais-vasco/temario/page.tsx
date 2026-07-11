// app/ayudantes-ejecucion-penal-pais-vasco/temario/page.tsx - Thin wrapper del componente dinámico compartido.
// Fuente única de verdad: BD (oposicion_bloques + topics).
import DynamicTemarioPage from '@/components/temario/DynamicTemarioPage'

// force-dynamic: renderizar bajo demanda para no saturar BD en build (3600+ páginas)
export const dynamic = 'force-dynamic'

export const metadata = {
  title: 'Temario Ayudantes en Ejecución Penal (Euskadi) | Vence.es',
  description: 'Temario oficial de Ayudantes en Ejecución Penal (Euskadi) con legislación literal del BOE. Acceso gratuito a todos los temas organizados por bloques.',
  alternates: {
    canonical: 'https://www.vence.es/ayudantes-ejecucion-penal-pais-vasco/temario',
  },
}

export default async function TemarioPage() {
  return (
    <DynamicTemarioPage
      oposicionSlug="ayudantes-ejecucion-penal-pais-vasco"
      oposicionDisplayName="Ayudantes en Ejecución Penal (Euskadi)"
    />
  )
}
