import { readFileSync } from 'fs'
import { join } from 'path'

/**
 * [T-698] — Un job programado declarado para VIGILANCIA pero sin forma de CONSTRUIRSE.
 *
 * ## El caso, medido el 08/08/2026
 *
 * `vence-content-radar` y `vence-instagram-daily` se declararon en el catálogo de liveness
 * (`external-jobs.registry.ts`) el 06/08 con su emisión de `cron_tick`/`cron_run` escrita en el
 * código. Pero **sus imágenes de ECR eran del 07/07**, un mes anteriores: se desplegó el backend
 * que los vigila y nunca se reconstruyó el contenedor que tenía que responder. No había ningún
 * camino que los construyera — los dos se habían subido a mano en julio.
 *
 * Consecuencia: `cron_overdue` disparó **20 críticos por correo en 24 h** sobre dos jobs que
 * funcionaban perfectamente (comprobado: el radar corrió el viernes a las 06:01 con «23 posts» y
 * el de Instagram hoy a las 10:00 con código de salida 0).
 *
 * Y lo caro no es el ruido. Esa misma alerta es la que destapó en julio que el worker de PDFs
 * llevaba **dos días muerto** porque su imagen se había purgado del registry (moría en el pull,
 * sin logs ni eventos). Con dos falsos permanentes gritando, esa alerta ya no distingue «muerto»
 * de «no instrumentado» — que es exactamente la confusión que la hace inútil.
 *
 * ## Qué exige este guardarraíl
 *
 * Que las dos listas no se separen: **todo job periódico externo tiene que tener declarado cómo
 * se construye**. Declarar solo la vigilancia es prometer una alerta que no puede ser cierta.
 */

const RAIZ = join(__dirname, '..', '..')

function leer(rel: string): string {
  return readFileSync(join(RAIZ, rel), 'utf8')
}

/** Nombres de los jobs externos periódicos declarados para liveness. */
function jobsVigilados(): string[] {
  const src = leer('backend/src/cron-schedule/external-jobs.registry.ts')
  return [...src.matchAll(/^\s*name:\s*'([^']+)'/gm)].map((m) => m[1])
}

/** Familias de task def que el script de deploy sabe construir y re-pinear. */
function jobsConstruibles(): string[] {
  const src = leer('scripts/deploy/repin-derived-taskdefs.sh')
  const bloque = src.match(/DERIVED_WORKERS=\(([\s\S]*?)\n\)/)
  if (!bloque) throw new Error('no se encontró DERIVED_WORKERS en repin-derived-taskdefs.sh')
  return [...bloque[1].matchAll(/"([^"|]+)\|/g)].map((m) => m[1])
}

/**
 * El worker de PDFs se declara en el catálogo como `temario-pdf-worker` y su familia de task def
 * es `vence-temario-pdf-worker`. Se normaliza en vez de exigir que coincidan: renombrar recursos
 * de AWS para que cuadre un test sería mover el problema, no resolverlo.
 */
function normalizar(n: string): string {
  return n.replace(/^vence-/, '')
}

describe('[T-698] todo job programado que se VIGILA tiene que poder CONSTRUIRSE', () => {
  it('cada job externo del catálogo de liveness está en el script de deploy', () => {
    const construibles = jobsConstruibles().map(normalizar)
    const huerfanos = jobsVigilados()
      .map(normalizar)
      .filter((j) => !construibles.includes(j))

    expect({
      huerfanos,
      porque:
        'Un job vigilado sin camino de construcción es una alerta que no puede ser cierta: su ' +
        'imagen envejece hasta no emitir la señal que se le exige, y cron_overdue grita para ' +
        'siempre. Declararlo en scripts/deploy/repin-derived-taskdefs.sh (DERIVED_WORKERS).',
    }).toEqual({ huerfanos: [], porque: expect.any(String) })
  })

  it('el catálogo no está vacío (si el parseo se rompe, el test no puede pasar en falso)', () => {
    // Sin esto, cambiar el formato del registro dejaría la lista a cero y el test verde: el
    // modo de fallo clásico de un guardarraíl que compara dos listas.
    expect(jobsVigilados().length).toBeGreaterThanOrEqual(3)
    expect(jobsConstruibles().length).toBeGreaterThanOrEqual(3)
  })

  it('cada entrada del script declara sus cinco campos (familia|stage|repo|contexto|dockerfile)', () => {
    const src = leer('scripts/deploy/repin-derived-taskdefs.sh')
    const bloque = src.match(/DERIVED_WORKERS=\(([\s\S]*?)\n\)/)![1]
    const entradas = [...bloque.matchAll(/"([^"]+)"/g)].map((m) => m[1])
    expect(entradas.length).toBeGreaterThanOrEqual(3)
    for (const e of entradas) {
      // 5 campos ⇒ 4 separadores. Una entrada con el formato viejo (3 campos) construiría con el
      // contexto vacío y fallaría en el deploy, no aquí — que es tarde.
      expect({ entrada: e, separadores: e.split('|').length }).toEqual({
        entrada: e,
        separadores: 5,
      })
    }
  })

  it('ningún job usa el repo ECR del frontend, cuya retención de 10 imágenes lo purgaría', () => {
    // La causa raíz del incidente del worker de PDFs (27→29/07): imagen en `vence-frontend`,
    // que rota ~6 veces al día, así que el digest pineado desaparecía en ~2 días.
    const src = leer('scripts/deploy/repin-derived-taskdefs.sh')
    const bloque = src.match(/DERIVED_WORKERS=\(([\s\S]*?)\n\)/)![1]
    const repos = [...bloque.matchAll(/"[^"|]+\|[^|]*\|([^|]+)\|/g)].map((m) => m[1])
    expect(repos.length).toBeGreaterThanOrEqual(3)
    expect(repos.filter((r) => r === 'vence-frontend')).toEqual([])
  })
})
