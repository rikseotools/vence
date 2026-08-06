// app/tu-oposicion-a-medida/content.ts
//
// Contenido de la landing en un solo sitio, para que la parte VISIBLE (JSX) y la que lee un
// buscador (JSON-LD FAQPage) no puedan divergir — un array, dos consumidores. Separado de
// page.tsx para poder testear el contenido sin renderizar el Server Component.
//
// T-328. Depende de que [T-327] esté en producción (verificado 01/08: crear → buscar por ley y
// por contenido del articulado → armar temas → guardar → hacerla objetivo → estudiar, con
// rastreador de rutas en verde). Esta landing NO promete lo que [T-327] todavía no tiene: no hay
// test aleatorio ni simulacro de la oposición ENTERA para una personalizada (solo test POR
// TEMA) — prometerlo sería quemar la palabra antes de tenerlo, que es justo lo que la ficha
// avisa de no hacer.

/** A dónde manda el CTA principal. El propio destino gestiona el login si hace falta. */
export const CTA_HREF = '/oposicion-personalizada'

export interface FaqItem {
  pregunta: string
  respuesta: string
}

export const FAQ_ITEMS: FaqItem[] = [
  {
    pregunta: '¿Para qué oposiciones sirve esto?',
    respuesta:
      'Para cualquiera que no encuentres montada en ninguna plataforma: A1, A2, cuerpos específicos, oposiciones de un solo ayuntamiento o comunidad… Si tienes el programa oficial y nadie lo ha preparado, aquí lo puedes montar tú.',
  },
  {
    pregunta: '¿Es gratis crear mi oposición?',
    respuesta:
      'Sí. Crear tu temario, buscar leyes y artículos, y guardarlo no requiere Premium — es gratuito para cualquier cuenta con sesión iniciada.',
  },
  {
    pregunta: '¿Cómo elijo qué entra si mi programa no nombra las leyes?',
    respuesta:
      'El buscador no solo busca por nombre de ley: también busca DENTRO del articulado. Si tu epígrafe dice "silencio administrativo" en vez de "Ley 39/2015", igual encuentras el artículo exacto buscando esa expresión.',
  },
  {
    pregunta: '¿Qué puedo practicar una vez montado el temario?',
    respuesta:
      'Tests por cada tema que hayas creado, con las mismas preguntas, estadísticas y progreso que cualquier oposición de Vence. El test de toda la oposición de una vez (aleatorio o simulacro) todavía no está disponible para temarios personalizados — solo por tema.',
  },
  {
    pregunta: '¿Otras personas pueden ver o usar mi oposición?',
    respuesta:
      'Se publica como "Oposición <tu nombre> by <tus iniciales>" y cualquiera puede elegirla como la suya para estudiar con ella. Solo tú puedes editarla — los demás la ven, no la modifican.',
  },
  {
    pregunta: '¿Y si mi oposición ya existe en el catálogo de Vence?',
    respuesta:
      'Mejor: usa esa directamente, tiene su propio seguimiento de convocatoria y ficha oficial. Esto es para cuando de verdad no hay ninguna preparada.',
  },
]
