// app/auxiliar-administrativo-sermas/temario/page.tsx - Thin wrapper del componente dinamico compartido.
// Fuente unica de verdad: BD (oposicion_bloques + topics).
import DynamicTemarioPage from '@/components/temario/DynamicTemarioPage'

// force-dynamic: renderizar bajo demanda para no saturar BD en build (3600+ páginas)
export const dynamic = 'force-dynamic'

export const metadata = {
  title: 'Temario Auxiliar Administrativo SERMAS | Vence.es',
  description: 'Temario oficial BOCM del Auxiliar Administrativo del SERMAS (Servicio Madrileno de Salud). 31 temas en 5 bloques: organizacion politica y sanitaria, derecho administrativo, personal, gestion administrativa e informatica. Acceso gratuito.',
  alternates: {
    canonical: 'https://www.vence.es/auxiliar-administrativo-sermas/temario',
  },
}

export default async function TemarioPage() {
  return (
    <DynamicTemarioPage
      oposicionSlug="auxiliar-administrativo-sermas"
      oposicionDisplayName="Auxiliar Administrativo SERMAS"
    />
  )
}
