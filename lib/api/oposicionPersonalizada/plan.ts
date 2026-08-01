// lib/api/oposicionPersonalizada/plan.ts — de lo que el usuario armó a lo que se escribe. (T-327)
//
// PURO: sin BD y sin red. Recibe el temario tal cual sale de la pantalla y devuelve el PLAN de
// escritura (qué oposición, qué temas, qué filas de scope). Quien escribe es otro módulo.
//
// Se separa porque aquí está lo que puede salir mal en silencio: un `position_type` que choque
// con otro, un tema sin leyes que se cuele, un artículo repetido que infle el scope. Nada de eso
// da error en Postgres — simplemente deja al usuario con un temario distinto del que construyó.

/** Lo que llega de la pantalla (mismo shape que `components/oposicionPersonalizada/temario.ts`). */
export interface TemaEntrada {
  titulo: string
  articulos: Array<{ lawId: string; articleNumber: string | null }>
}
export interface TemarioEntrada {
  nombre: string
  temas: TemaEntrada[]
}

export interface FilaScope {
  lawId: string
  /** `null` = LA LEY ENTERA. Es lo que `topic_scope.article_numbers IS NULL` significa. */
  articleNumbers: string[] | null
}
export interface TemaPlan {
  topicNumber: number
  titulo: string
  scope: FilaScope[]
}
export interface PlanGuardado {
  positionType: string
  nombre: string
  temas: TemaPlan[]
}

/**
 * `position_type` de una oposición personalizada.
 *
 * Se DERIVA del id de la fila, no del nombre: dos usuarios pueden llamar «Subalterno» a su
 * oposición (de hecho pasa: esa etiqueta se la han llevado 25 personas) y un slug por nombre las
 * colisionaría, mezclando dos temarios distintos en el mismo `topic_scope`. El id es único por
 * construcción, así que esto no puede chocar nunca.
 *
 * El prefijo hace el origen legible de un vistazo en la BD, que es donde alguien se lo va a
 * encontrar sin contexto.
 */
export function positionTypeDe(customOposicionId: string): string {
  return `personalizada_${String(customOposicionId).replace(/-/g, '')}`
}

/** ¿Este `position_type` es de una oposición personalizada? Para no tratarlas como del catálogo. */
export function esPersonalizada(positionType: string | null | undefined): boolean {
  return typeof positionType === 'string' && positionType.startsWith('personalizada_')
}

/** Recorta y colapsa espacios. Un nombre con espacios raros se ve mal en todas partes. */
function limpio(s: string): string {
  return String(s ?? '').trim().replace(/\s+/g, ' ')
}

export interface ErrorPlan {
  campo: 'nombre' | 'temas'
  mensaje: string
}

/**
 * Construye el plan. Devuelve `errores` en vez de lanzar: quien llama tiene que poder contestarle
 * al usuario QUÉ falta, y una excepción genérica no dice nada útil desde el otro lado de la red.
 *
 * Lo que hace, y cada cosa evita un fallo silencioso concreto:
 *  · **descarta los temas sin artículos** — se guardarían y al entrar no habría nada que estudiar;
 *  · **agrupa por ley** con la forma exacta de `topic_scope`;
 *  · **deduplica los artículos** dentro de cada ley (repetir infla el scope sin dar error);
 *  · **la ley entera manda** sobre los sueltos de esa misma ley: son dos formas de decir lo mismo
 *    y guardar las dos hace que el temario se contradiga consigo mismo;
 *  · **renumera los temas de 1 a N** después de descartar los vacíos, para que no queden huecos
 *    («Tema 1, Tema 3») que el usuario no ha pedido.
 */
export function construirPlan(
  entrada: TemarioEntrada,
  customOposicionId: string,
): { plan: PlanGuardado | null; errores: ErrorPlan[] } {
  const errores: ErrorPlan[] = []
  const nombre = limpio(entrada?.nombre ?? '')
  if (nombre.length < 3) {
    errores.push({ campo: 'nombre', mensaje: 'El nombre de la oposición es demasiado corto.' })
  }

  const temas: TemaPlan[] = []
  for (const t of entrada?.temas ?? []) {
    const arts = Array.isArray(t?.articulos) ? t.articulos : []
    if (arts.length === 0) continue // tema a medias: no se guarda

    const orden: string[] = []
    const porLey = new Map<string, { entera: boolean; nums: string[] }>()
    for (const a of arts) {
      if (!a?.lawId) continue
      if (!porLey.has(a.lawId)) {
        porLey.set(a.lawId, { entera: false, nums: [] })
        orden.push(a.lawId)
      }
      const g = porLey.get(a.lawId)!
      if (a.articleNumber === null || a.articleNumber === undefined) g.entera = true
      else if (!g.nums.includes(String(a.articleNumber))) g.nums.push(String(a.articleNumber))
    }

    const scope: FilaScope[] = orden
      .map((lawId) => {
        const g = porLey.get(lawId)!
        return { lawId, articleNumbers: g.entera ? null : g.nums }
      })
      // Una ley sin artículos y sin ser «entera» no aporta nada y sí puede confundir.
      .filter((f) => f.articleNumbers === null || f.articleNumbers.length > 0)

    if (scope.length === 0) continue
    temas.push({
      topicNumber: temas.length + 1, // renumerado, sin huecos
      titulo: limpio(t?.titulo ?? '') || `Tema ${temas.length + 1}`,
      scope,
    })
  }

  if (temas.length === 0) {
    errores.push({
      campo: 'temas',
      mensaje: 'Añade al menos un artículo a un tema: un temario vacío no serviría preguntas.',
    })
  }

  if (errores.length > 0) return { plan: null, errores }
  return {
    plan: { positionType: positionTypeDe(customOposicionId), nombre, temas },
    errores: [],
  }
}
