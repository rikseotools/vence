// __tests__/helpers/vistasDeTemario.ts
//
// [T-611] Qué ficheros PINTAN la página de un tema del temario.
//
// Durante dos años fueron 131 (`app/<oposicion>/temario/[slug]/TopicContentView.tsx`) y media
// docena de guardarraíles los enumeraban CADA UNO por su cuenta, con su propio glob. Al
// unificarlos en `components/temario/TopicContentView.tsx` esos globs se quedaron mirando un
// solo fichero residual y seguían en VERDE: la protección desaparecía sin que nada fallara.
//
// Por eso la lista se calcula en UN sitio. Si mañana vuelve a haber varias vistas (o se migra
// la última), todos los guardarraíles se enteran a la vez.
import { existsSync, readdirSync, statSync } from 'fs'
import { join, relative } from 'path'

const RAIZ = process.cwd()

/** El componente compartido: el que sirve el temario de casi todas las oposiciones. */
export const VISTA_COMPARTIDA = 'components/temario/TopicContentView.tsx'

/**
 * Vistas de temario, en ruta relativa al repo y con la compartida SIEMPRE la primera.
 * Incluye las que conservan diseño propio bajo `app/` (hoy: `auxiliar-administrativo-estado`),
 * que son las únicas que pueden divergir y por tanto las que hay que seguir auditando.
 */
export function vistasDeTemario(): string[] {
  const out: string[] = []
  if (existsSync(join(RAIZ, VISTA_COMPARTIDA))) out.push(VISTA_COMPARTIDA)
  const appDir = join(RAIZ, 'app')
  const buscar = (dir: string) => {
    for (const nombre of readdirSync(dir)) {
      if (nombre === 'node_modules' || nombre === '.next' || nombre === '.open-next') continue
      const full = join(dir, nombre)
      if (statSync(full).isDirectory()) buscar(full)
      else if (nombre === 'TopicContentView.tsx') out.push(relative(RAIZ, full))
    }
  }
  if (existsSync(appDir)) buscar(appDir)
  return out
}
