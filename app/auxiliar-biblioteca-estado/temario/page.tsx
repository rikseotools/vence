// app/auxiliar-biblioteca-estado/temario/page.tsx - Thin wrapper del componente dinámico compartido.
// Fuente única de verdad: BD (oposicion_bloques + topics).
import DynamicTemarioPage from '@/components/temario/DynamicTemarioPage'

// force-dynamic: renderizar bajo demanda para no saturar BD en build (3600+ páginas)
export const dynamic = 'force-dynamic'

export const metadata = {
  title: 'Temario Auxiliar de Archivos, Bibliotecas y Museos del Estado (Sección Bibliotecas) | Vence.es',
  description: 'Temario oficial de Auxiliar de Archivos, Bibliotecas y Museos del Estado (Sección Bibliotecas) con legislación literal del BOE. Acceso gratuito a todos los temas organizados por bloques.',
  alternates: {
    canonical: 'https://www.vence.es/auxiliar-biblioteca-estado/temario',
  },
}

export default async function TemarioPage() {
  return (
    <DynamicTemarioPage
      oposicionSlug="auxiliar-biblioteca-estado"
      oposicionDisplayName="Auxiliar de Archivos, Bibliotecas y Museos del Estado (Sección Bibliotecas)"
    />
  )
}
