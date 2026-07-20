// app/auxiliar-administrativo-ayuntamiento-huesca/temario/page.tsx - Thin wrapper del componente dinámico compartido.
// Fuente única de verdad: BD (oposicion_bloques + topics).
import DynamicTemarioPage from '@/components/temario/DynamicTemarioPage'

// force-dynamic: renderizar bajo demanda para no saturar BD en build (3600+ páginas)
export const dynamic = 'force-dynamic'

export const metadata = {
  title: 'Temario Auxiliar Administrativo del Ayuntamiento de Huesca | Vence.es',
  description: 'Temario oficial de Auxiliar Administrativo del Ayuntamiento de Huesca con legislación literal del BOE. Acceso gratuito a todos los temas organizados por bloques.',
  alternates: {
    canonical: 'https://www.vence.es/auxiliar-administrativo-ayuntamiento-huesca/temario',
  },
}

export default async function TemarioPage() {
  return (
    <DynamicTemarioPage
      oposicionSlug="auxiliar-administrativo-ayuntamiento-huesca"
      oposicionDisplayName="Auxiliar Administrativo del Ayuntamiento de Huesca"
    />
  )
}
