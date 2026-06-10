// Aux. Admin. UNED — temario SSR (DynamicTemarioPage). Deploy trigger: fix de build en scripts/ (8f421764) está en paths-ignore.
// app/auxiliar-administrativo-universidad-uned/temario/page.tsx - Thin wrapper del componente dinamico compartido.
// Fuente unica de verdad: BD (oposicion_bloques + topics).
import DynamicTemarioPage from '@/components/temario/DynamicTemarioPage'

// force-dynamic: renderizar bajo demanda para no saturar BD en build (3600+ páginas)
export const dynamic = 'force-dynamic'

export const metadata = {
  title: 'Temario Auxiliar Administrativo UNED | Vence.es',
  description: 'Temario oficial BOJA de TCAE (Auxiliar de Enfermeria) del Canarias. 21 temas en 2 bloques: legislacion sanitaria y cuidados auxiliares de enfermeria. Acceso gratuito.',
  alternates: {
    canonical: 'https://www.vence.es/auxiliar-administrativo-universidad-uned/temario',
  },
}

export default async function TemarioPage() {
  return (
    <DynamicTemarioPage
      oposicionSlug="auxiliar-administrativo-universidad-uned"
      oposicionDisplayName="Auxiliar Administrativo UNED"
    />
  )
}
