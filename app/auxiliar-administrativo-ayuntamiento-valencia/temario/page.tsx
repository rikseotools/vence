// app/auxiliar-administrativo-ayuntamiento-valencia/temario/page.tsx - Thin wrapper del componente dinámico compartido.
// Fuente única de verdad: BD (oposicion_bloques + topics).
import DynamicTemarioPage from '@/components/temario/DynamicTemarioPage'

// force-dynamic: renderizar bajo demanda para no saturar BD en build (3600+ páginas)
export const dynamic = 'force-dynamic'

export const metadata = {
  title: 'Temario Auxiliar Administrativo Ayuntamiento Valencia | Vence.es',
  description: 'Temario oficial de Auxiliar Administrativo Ayuntamiento Valencia con legislación literal del BOE. Acceso gratuito a todos los temas organizados por bloques.',
  alternates: {
    canonical: 'https://www.vence.es/auxiliar-administrativo-ayuntamiento-valencia/temario',
  },
}

export default async function TemarioPage() {
  return (
    <DynamicTemarioPage
      oposicionSlug="auxiliar-administrativo-ayuntamiento-valencia"
      oposicionDisplayName="Auxiliar Administrativo Ayuntamiento Valencia"
    />
  )
}
