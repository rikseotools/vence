// app/tcae-sescam/temario/page.tsx - Thin wrapper del componente dinamico compartido.
// Fuente unica de verdad: BD (oposicion_bloques + topics).
import DynamicTemarioPage from '@/components/temario/DynamicTemarioPage'

// force-dynamic: renderizar bajo demanda para no saturar BD en build
export const dynamic = 'force-dynamic'

export const metadata = {
  title: 'Temario TCAE SESCAM | Vence.es',
  description: 'Temario oficial DOCM de TCAE (Auxiliar de Enfermería) del SESCAM (Castilla-La Mancha). 30 temas en 2 bloques: legislación sanitaria y cuidados auxiliares de enfermería. Acceso gratuito.',
  alternates: {
    canonical: 'https://www.vence.es/tcae-sescam/temario',
  },
}

export default async function TemarioPage() {
  return (
    <DynamicTemarioPage
      oposicionSlug="tcae-sescam"
      oposicionDisplayName="TCAE SESCAM"
    />
  )
}
