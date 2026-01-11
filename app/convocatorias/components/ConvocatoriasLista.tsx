/**
 * Componente de lista de convocatorias
 */

// Link removido temporalmente - las páginas individuales tienen thin content
// import Link from 'next/link';

interface Convocatoria {
  id: string;
  boe_id: string;
  boe_fecha: string;
  titulo: string;
  titulo_limpio: string | null;
  departamento_nombre: string | null;
  epigrafe: string | null;
  tipo: string | null;
  categoria: string | null;
  num_plazas: number | null;
  oposicion_relacionada: string | null;
  boe_url_pdf: string | null;
  boe_url_html: string | null;
  ambito: string | null;
  comunidad_autonoma: string | null;
  provincia: string | null;
  municipio: string | null;
}

interface Props {
  convocatorias: Convocatoria[];
}

const TIPO_BADGES: Record<string, { bg: string; text: string; label: string }> = {
  convocatoria: { bg: 'bg-green-100 dark:bg-green-900/30', text: 'text-green-700 dark:text-green-300', label: 'Convocatoria' },
  admitidos: { bg: 'bg-blue-100 dark:bg-blue-900/30', text: 'text-blue-700 dark:text-blue-300', label: 'Admitidos' },
  tribunal: { bg: 'bg-purple-100 dark:bg-purple-900/30', text: 'text-purple-700 dark:text-purple-300', label: 'Tribunal' },
  resultado: { bg: 'bg-yellow-100 dark:bg-yellow-900/30', text: 'text-yellow-700 dark:text-yellow-300', label: 'Resultado' },
  correccion: { bg: 'bg-orange-100 dark:bg-orange-900/30', text: 'text-orange-700 dark:text-orange-300', label: 'Corrección' },
  otro: { bg: 'bg-gray-100 dark:bg-gray-700', text: 'text-gray-700 dark:text-gray-300', label: 'Otro' },
};

const CATEGORIA_BADGES: Record<string, string> = {
  'C2': 'bg-teal-100 dark:bg-teal-900/30 text-teal-700 dark:text-teal-300',
  'C1': 'bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300',
  'A2': 'bg-pink-100 dark:bg-pink-900/30 text-pink-700 dark:text-pink-300',
  'A1': 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300',
  'B': 'bg-cyan-100 dark:bg-cyan-900/30 text-cyan-700 dark:text-cyan-300',
};

export default function ConvocatoriasLista({ convocatorias }: Props) {
  if (convocatorias.length === 0) {
    return (
      <div className="text-center py-12 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
        <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
        <h3 className="mt-2 text-sm font-medium text-gray-900 dark:text-white">
          No hay convocatorias
        </h3>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          No se encontraron convocatorias con los filtros seleccionados
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {convocatorias.map((conv) => {
        const tipoBadge = TIPO_BADGES[conv.tipo || 'otro'] || TIPO_BADGES.otro;
        const categoriaBadge = conv.categoria ? CATEGORIA_BADGES[conv.categoria] : null;

        return (
          <article
            key={conv.id}
            className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4 hover:shadow-md transition-shadow"
          >
            {/* Badges */}
            <div className="flex flex-wrap gap-2 mb-2">
              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${tipoBadge.bg} ${tipoBadge.text}`}>
                {tipoBadge.label}
              </span>
              {categoriaBadge && (
                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${categoriaBadge}`}>
                  {conv.categoria}
                </span>
              )}
              {conv.num_plazas && conv.num_plazas > 0 && (
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300">
                  {conv.num_plazas} plazas
                </span>
              )}
              {conv.oposicion_relacionada && (
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300">
                  Tu oposición
                </span>
              )}
              {conv.ambito && (
                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                  conv.ambito === 'estatal'
                    ? 'bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300'
                    : conv.ambito === 'local'
                    ? 'bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300'
                    : 'bg-violet-100 dark:bg-violet-900/30 text-violet-700 dark:text-violet-300'
                }`}>
                  {conv.ambito === 'estatal' ? 'Estatal' : conv.ambito === 'local' ? 'Local' : 'Autonómico'}
                </span>
              )}
              {conv.comunidad_autonoma && (
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300">
                  {conv.comunidad_autonoma}
                </span>
              )}
            </div>

            {/* Título */}
            <h3 className="text-base font-medium text-gray-900 dark:text-white line-clamp-2">
              {conv.titulo_limpio || conv.titulo}
            </h3>

            {/* Meta */}
            <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-gray-500 dark:text-gray-400">
              <span className="flex items-center">
                <svg className="mr-1.5 h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                {new Date(conv.boe_fecha).toLocaleDateString('es-ES', {
                  day: 'numeric',
                  month: 'short',
                  year: 'numeric'
                })}
              </span>
              {conv.departamento_nombre && (
                <span className="flex items-center">
                  <svg className="mr-1.5 h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                  </svg>
                  <span className="truncate max-w-[200px]">
                    {conv.departamento_nombre.replace('MINISTERIO DE ', '').replace('MINISTERIO PARA ', '')}
                  </span>
                </span>
              )}
              <span className="text-gray-400 dark:text-gray-500">
                {conv.boe_id}
              </span>
            </div>

            {/* Actions */}
            <div className="mt-3 flex gap-3">
              {conv.boe_url_pdf && (
                <a
                  href={conv.boe_url_pdf}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm font-medium text-gray-600 dark:text-gray-400 hover:underline flex items-center"
                >
                  <svg className="mr-1 h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  PDF
                </a>
              )}
              {conv.boe_url_html && (
                <a
                  href={conv.boe_url_html}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm font-medium text-gray-600 dark:text-gray-400 hover:underline"
                >
                  Ver en BOE
                </a>
              )}
            </div>
          </article>
        );
      })}
    </div>
  );
}
