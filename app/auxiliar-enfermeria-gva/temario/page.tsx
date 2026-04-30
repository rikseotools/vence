// app/auxiliar-enfermeria-gva/temario/page.tsx - Thin wrapper del componente dinamico compartido.
// Fuente unica de verdad: BD (oposicion_bloques + topics).
import DynamicTemarioPage from '@/components/temario/DynamicTemarioPage'

// force-dynamic: renderizar bajo demanda para no saturar BD en build (3600+ páginas)
export const dynamic = 'force-dynamic'

export const metadata = {
  title: 'Temario Aux Enfermería GVA | Vence.es',
  description: 'Temario oficial BOCM de TCAE (Auxiliar de Enfermeria) del GVA. 24 temas en 2 bloques: legislacion sanitaria y cuidados auxiliares de enfermeria. Acceso gratuito.',
  alternates: {
    canonical: 'https://www.vence.es/auxiliar-enfermeria-gva/temario',
  },
}

export default async function TemarioPage() {
  return (
    <DynamicTemarioPage
      oposicionSlug="auxiliar-enfermeria-gva"
      oposicionDisplayName="Aux Enfermería GVA"
    />
  )
}
