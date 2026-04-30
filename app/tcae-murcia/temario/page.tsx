// app/tcae-murcia/temario/page.tsx - Thin wrapper del componente dinamico compartido.
// Fuente unica de verdad: BD (oposicion_bloques + topics).
import DynamicTemarioPage from '@/components/temario/DynamicTemarioPage'

// force-dynamic: renderizar bajo demanda para no saturar BD en build (3600+ páginas)
export const dynamic = 'force-dynamic'

export const metadata = {
  title: 'Temario TCAE Murcia | Vence.es',
  description: 'Temario oficial BOCM de TCAE (Auxiliar de Enfermeria) del SMS. 44 temas en 2 bloques: legislacion sanitaria y cuidados auxiliares de enfermeria. Acceso gratuito.',
  alternates: {
    canonical: 'https://www.vence.es/tcae-murcia/temario',
  },
}

export default async function TemarioPage() {
  return (
    <DynamicTemarioPage
      oposicionSlug="tcae-murcia"
      oposicionDisplayName="TCAE Murcia"
    />
  )
}
