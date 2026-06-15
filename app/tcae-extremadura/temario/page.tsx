// app/tcae-extremadura/temario/page.tsx - Thin wrapper del componente dinamico compartido.
// Fuente unica de verdad: BD (oposicion_bloques + topics).
import DynamicTemarioPage from '@/components/temario/DynamicTemarioPage'

// force-dynamic: renderizar bajo demanda para no saturar BD en build
export const dynamic = 'force-dynamic'

export const metadata = {
  title: 'Temario TCAE SES Extremadura | Vence.es',
  description: 'Temario oficial DOE de TCAE (Auxiliar de Enfermería) del SES (Extremadura). 30 temas en 2 bloques: legislación sanitaria y cuidados auxiliares de enfermería. Acceso gratuito.',
  alternates: {
    canonical: 'https://www.vence.es/tcae-extremadura/temario',
  },
}

export default async function TemarioPage() {
  return (
    <DynamicTemarioPage
      oposicionSlug="tcae-extremadura"
      oposicionDisplayName="TCAE SES Extremadura"
    />
  )
}
