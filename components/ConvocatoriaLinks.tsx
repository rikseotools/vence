// components/ConvocatoriaLinks.tsx
// Server component: muestra enlaces oficiales de la convocatoria desde BD

import { getConvocatoriaActiva } from '@/lib/api/convocatoria/queries'

interface ConvocatoriaLinksProps {
  oposicionSlug: string
}

export default async function ConvocatoriaLinks({ oposicionSlug }: ConvocatoriaLinksProps) {
  const convocatoria = await getConvocatoriaActiva(oposicionSlug)

  if (!convocatoria) return null

  const { boletinOficialUrl, paginaInformacionUrl, observaciones } = convocatoria
  if (!boletinOficialUrl && !paginaInformacionUrl) return null

  return (
    <div className="bg-white rounded-xl shadow-lg p-6 border-l-4 border-blue-500">
      <h3 className="text-lg font-bold text-gray-900 mb-3">Enlaces Oficiales</h3>
      {observaciones && (
        <p className="text-sm text-gray-500 mb-4">{observaciones}</p>
      )}
      <div className="flex flex-col sm:flex-row gap-3">
        {boletinOficialUrl && (
          <a
            href={boletinOficialUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center justify-center space-x-2 bg-gray-100 hover:bg-gray-200 text-gray-800 px-5 py-3 rounded-lg font-medium transition-colors text-sm"
          >
            <span>Convocatoria oficial (PDF)</span>
            <span className="text-xs">&#x2197;</span>
          </a>
        )}
        {paginaInformacionUrl && (
          <a
            href={paginaInformacionUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center justify-center space-x-2 bg-gray-100 hover:bg-gray-200 text-gray-800 px-5 py-3 rounded-lg font-medium transition-colors text-sm"
          >
            <span>Seguimiento del proceso</span>
            <span className="text-xs">&#x2197;</span>
          </a>
        )}
      </div>
    </div>
  )
}
