/**
 * lib/ui/navOverflowProbe.ts — CÓMO se mira que la cabecera no deje nada fuera de la pantalla,
 * y QUÉ cuenta como defecto. Fuente única para los dos sitios que lo comprueban.
 *
 * ## Por qué existe (T-504, 04/08/2026)
 *
 * El arreglo de la cabecera nació con dos capas: el núcleo puro `lib/ui/navOverflow.ts` (que
 * decide el reparto) y la simulación `scripts/sim/sim-cabecera-alcanzable.ts` (que lo comprueba
 * con navegador real). La segunda es la única que puede ver el fallo que motivó la ficha —el
 * `min-w-0` que falta, el bloque derecho empujado fuera del viewport— porque es geometría de
 * layout: el núcleo puro recibe anchos ya medidos y **no puede saber si esos anchos son los
 * buenos**. Si alguien quita el `min-w-0`, `clientWidth` pasa a ser el ancho del contenido, el
 * reparto concluye «caben todos» y sus 18 tests siguen verdes mientras el avatar vuelve a
 * quedarse fuera.
 *
 * Pero la simulación **solo corría a mano**. Es el modo de fallo que este repo ya se ha
 * encontrado varias veces (T-455): *una comprobación on-demand que nadie repite no es una
 * comprobación*. La premisa de la propia ficha era «la cabecera creció un enlace cada vez
 * durante meses y nadie comprobó que siguiera cabiendo, porque no había con qué» — ahora hay
 * con qué, pero seguía sin correr solo.
 *
 * Por eso el mismo criterio lo usan **dos** ejecutores, y por eso vive aquí y no duplicado:
 *
 * | Quién | Cuándo | Qué cubre |
 * |---|---|---|
 * | `scripts/sim/sim-cabecera-alcanzable.ts` | a mano, cuando se toca la cabecera | premium, free y anónimo (los menús más largos) |
 * | `e2e/smoke-cabecera-alcanzable.spec.ts` | **cada PR + cada 6 h contra producción** | anónimo (sin secretos en CI) |
 *
 * El reparto se hizo así a propósito: el ejecutor automático no puede forjar sesiones sin
 * meter `AUTH_SECRET` en GitHub Actions, y el caso anónimo **es sensible igual** — a 1280 px
 * ya no caben todos los enlaces ni sin sesión, así que un `min-w-0` perdido lo saca del sitio
 * como sacaría a los demás. Cubre menos casos, pero es el que de verdad se repite.
 *
 * Dos criterios sobre lo mismo divergen (la lección del quinto escritor de `seguimiento_url`,
 * T-130), así que aquí no hay copia: los guiones de medida y el veredicto son estos.
 */

/** Lo que se mide de la cabecera en una anchura concreta. */
export interface MedidaCabecera {
  hayCabecera: boolean
  /** `scrollWidth - clientWidth` de la fila. >1 px = está desbordando su contenedor. */
  desborde: number
  /** Controles cuyo CENTRO cae fuera del viewport → no se pueden pulsar. */
  fuera: Array<{ que: string; px: number; lado: string; l: number; r: number }>
  /** Enlaces pintados en la barra. */
  enBarra: number
  /** Enlaces que la cabecera declara tener (sale del medidor invisible). 0 = no se sabe. */
  totalEnlaces: number
  hayBotonMas: boolean
  /** Hay sesión aplicada (se deduce de la campana, que solo existe con sesión). */
  haySesion: boolean
}

/** Lo que se mide del desplegable «Más» una vez abierto. */
export interface MedidaMenuMas {
  /** Enlaces dentro del menú. */
  enMenu: number
  /** Enlaces del menú que NO se pueden pulsar, con el motivo. */
  inalcanzablesEnMenu: string[]
}

/**
 * Guion que se evalúa DENTRO del navegador para medir la cabecera.
 *
 * Se exporta como texto (y no como función) porque los dos ejecutores lo pasan a
 * `page.evaluate`, que serializa: mantenerlo en una sola cadena evita que una de las dos copias
 * se quede atrás.
 */
export const GUION_MEDIR_CABECERA = `(() => {
  const header = document.querySelector('header');
  if (!header) return { hayCabecera: false, desborde: 0, fuera: [], enBarra: 0, totalEnlaces: 0, hayBotonMas: false, haySesion: false };
  const fila = header.querySelector('div > div.flex.items-center.justify-between');
  const desborde = fila ? fila.scrollWidth - fila.clientWidth : 0;

  // Todo lo que el usuario puede pulsar en la barra principal. Se excluye lo que está oculto
  // (display:none del responsive) y el MEDIDOR, que es invisible a propósito.
  //
  // El criterio es el CENTRO dentro del viewport, no el borde, y no es un umbral elegido a
  // ojo: un elemento cuyo centro está en pantalla se puede pulsar, y uno cuyo centro está
  // fuera no. Con el borde habría que inventarse una tolerancia — el logo lleva scale-125 y
  // su caja visual asoma 1 px por la izquierda sin que eso le impida a nadie hacer clic.
  // Que nada se vea CORTADO lo cubre la otra comprobación (la fila no desborda su contenedor),
  // que es geometría de layout y no admite discusión.
  const fuera = [];
  const pulsables = header.querySelectorAll('a[href], button');
  for (let i = 0; i < pulsables.length; i++) {
    const el = pulsables[i];
    if (el.closest('[aria-hidden="true"]')) continue;
    const r = el.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) continue;
    if (r.top > 200) continue;
    const nombre = (el.getAttribute('aria-label') || el.textContent || el.tagName).replace(/\\s+/g, ' ').trim().slice(0, 40);
    const centro = (r.left + r.right) / 2;
    if (centro > window.innerWidth) fuera.push({ que: nombre, px: Math.round(centro - window.innerWidth), lado: 'derecha', l: Math.round(r.left), r: Math.round(r.right) });
    else if (centro < 0) fuera.push({ que: nombre, px: Math.round(-centro), lado: 'izquierda', l: Math.round(r.left), r: Math.round(r.right) });
  }

  const nav = header.querySelector('nav');
  const medidor = nav ? nav.querySelector('[aria-hidden="true"]') : null;
  // El total sale del MEDIDOR, que por construcción lleva la lista completa. Si no está (código
  // viejo, o alguien lo quitó) NO se puede comprobar que no falte ningún enlace — pero las
  // otras dos comprobaciones siguen valiendo, así que el caso NO se salta: se marca.
  const totalEnlaces = medidor ? medidor.querySelectorAll('[data-medida="enlace"]').length : 0;
  const enBarra = nav ? nav.querySelectorAll('a[href]').length : 0;
  const botones = nav ? nav.querySelectorAll('button[aria-haspopup="menu"]') : [];
  // Que la sesión se haya aplicado se mira por la CAMPANA, que solo existe con sesión. Antes se
  // deducía del medidor y eso ataba la comprobación al código nuevo: contra el código viejo
  // todos los casos con sesión se saltaban «no concluyentes» y el resumen salía verde con 8 de
  // 12 casos sin mirar. Un instrumento que no puede juzgar el fallo que busca no sirve.
  const haySesion = !!header.querySelector('button[aria-label^="Notificaciones"]');
  return { hayCabecera: true, desborde, fuera, enBarra, totalEnlaces, hayBotonMas: botones.length > 0, haySesion };
})()`

/**
 * Guion que se evalúa DENTRO del navegador con el menú «Más» ya abierto.
 *
 * NO basta con CONTAR los enlaces: la primera versión de la simulación los contaba y daba verde
 * con el menú **recortado por un `overflow-x: auto`**, o sea invisible en pantalla pero presente
 * en el DOM. Lo cazó un pantallazo. Se comprueba que en el centro de cada enlace conteste él y
 * no otro elemento (`elementFromPoint`), que es lo que caza recortes, tapados y z-index malos.
 */
export const GUION_MENU_MAS = `(() => {
  const enlaces = Array.from(document.querySelectorAll('header nav [role="menu"] a[href]'));
  const malos = [];
  for (let i = 0; i < enlaces.length; i++) {
    const el = enlaces[i];
    const b = el.getBoundingClientRect();
    const etiqueta = (el.textContent || '').replace(/\\s+/g, ' ').trim().slice(0, 30);
    if (b.width === 0 || b.height === 0) { malos.push(etiqueta + ' (sin caja: recortado u oculto)'); continue }
    const cx = (b.left + b.right) / 2, cy = (b.top + b.bottom) / 2;
    if (cx < 0 || cy < 0 || cx > innerWidth || cy > innerHeight) { malos.push(etiqueta + ' (fuera de pantalla)'); continue }
    const golpe = document.elementFromPoint(cx, cy);
    if (!golpe || (golpe !== el && !el.contains(golpe))) {
      malos.push(etiqueta + ' (tapado por <' + (golpe ? golpe.tagName.toLowerCase() : 'nada') + '>)');
    }
  }
  return { total: enlaces.length, inalcanzables: malos };
})()`

/** El selector del botón que abre «Más». Compartido para que los dos ejecutores abran lo mismo. */
export const SELECTOR_BOTON_MAS = 'header nav button[aria-haspopup="menu"]'

/**
 * El VEREDICTO: qué cuenta como defecto. Puro — recibe lo medido y devuelve los problemas en
 * castellano, listos para imprimir o para el mensaje de un `expect`.
 *
 * Devuelve `[]` cuando no hay nada que reprochar. Es la lista, y no un booleano, porque el valor
 * de esta comprobación está en NOMBRAR el control que el usuario no podía pulsar: eso es lo que
 * convirtió el reporte de un usuario («no veo mi perfil») en un diagnóstico.
 */
export function problemasDeCabecera(
  m: MedidaCabecera & MedidaMenuMas,
  ancho: number,
): string[] {
  const problemas: string[] = []

  // 1 px de tolerancia: el subpíxel del layout no es un desborde.
  if (m.desborde > 1) problemas.push(`la fila desborda su contenedor ${m.desborde}px`)

  for (const f of m.fuera) {
    problemas.push(
      `«${f.que}» no se puede pulsar: su centro cae ${f.px}px fuera por la ${f.lado} [${f.l}..${f.r}] de ${ancho}`,
    )
  }

  // Solo se puede afirmar que falta un enlace si se sabe cuántos había: con el medidor ausente
  // (`totalEnlaces === 0`) no se acusa — se marca aparte como no concluyente.
  if (m.totalEnlaces > 0 && m.enBarra + m.enMenu < m.totalEnlaces) {
    problemas.push(
      `se han perdido ${m.totalEnlaces - m.enBarra - m.enMenu} enlaces (barra ${m.enBarra} + menú ${m.enMenu} de ${m.totalEnlaces})`,
    )
  }

  if (m.hayBotonMas && m.enMenu === 0) {
    problemas.push('el botón «Más» existe pero su menú no se abre o está vacío')
  }

  for (const mal of m.inalcanzablesEnMenu) {
    problemas.push(`en el menú «Más», «${mal}» no se puede pulsar`)
  }

  return problemas
}

/**
 * Anchuras de escritorio que se prueban. 1280 es donde arranca el menú completo (`xl:`) y donde
 * el reparto aprieta más; 1920 es la pantalla más común de sobremesa y era la del usuario que
 * lo reportó.
 */
export const ANCHURAS_ESCRITORIO = [1280, 1440, 1536, 1920] as const
