// app/test-oposiciones/layout.js
export const metadata = {
  title: 'Tests de Oposiciones - Constitución Española y Ley 39/2015 | Vence',
  description: 'Tests especializados para oposiciones: Constitución Española de 1978, Ley 39/2015 del Procedimiento Administrativo Común. Prepárate para Auxiliar Administrativo del Estado con tests organizados por títulos y capítulos.',
  keywords: 'tests oposiciones, constitución española, ley 39/2015, auxiliar administrativo, procedimiento administrativo, tests constitución, oposiciones estado, preparar oposiciones',
  openGraph: {
    title: 'Tests de Oposiciones - Constitución y Ley 39/2015 | Vence',
    description: 'Prepárate para oposiciones con tests especializados por ley y materia. Constitución Española y Ley 39/2015 organizados por títulos.',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Tests de Oposiciones | Vence',
    description: 'Tests especializados para oposiciones: Constitución Española y Ley 39/2015',
  },
}

export default function TestOposicionesLayout({ children }) {
  return (
    <div className="bg-gray-50">
      {children}
    </div>
  )
}