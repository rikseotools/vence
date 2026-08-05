// alcance-de-ley.ts — ¿hay que ACOTAR al temario de la oposición, o hay que DEGRADAR?
//
// ESPEJO de `decidirAlcanceDeLey` / `esDegradacion` en `lib/api/_shared/topicScopeSql.ts`.
// El backend compila con `rootDir: src` y NO puede importar `lib/` de la raíz, así que la
// decisión está replicada y la sincronía la vigila `__tests__/backend/estimateAlcanceLeyParity.test.ts`,
// que las compara POR COMPORTAMIENTO sobre el espacio ENTERO de entradas (son 3 booleanos: 8 casos).
//
// ── POR QUÉ EXISTE ESTE FICHERO, que es la parte que importa ──────────────────────────────
//
// [T-551] arregló el 04/08 que el contador del configurador «por leyes» dijera 0 donde el test
// servía 1.283 (Félix Peña, premium, oposición sin temario construido). La causa era que la
// guarda de degradación estaba en un camino y **no en su gemelo**.
//
// Ese arreglo se aplicó SOLO al gemelo del frontend… y la familia `test-config` está enrutada
// al backend (`x-served-by: vence-backend`), así que **producción siguió devolviendo 0**.
// Medido contra www.vence.es el 05/08, con la combinación real de Félix:
//
//     scopeToPosition=false → count 1283
//     scopeToPosition=true  → count 0     ← lo que él seguía viendo
//
// Es la MISMA lección tres veces seguidas: T-326 (la lógica solo en el frontend, que nadie
// ejecuta), T-551 (la guarda en un camino y no en el otro) y esto. Por eso la decisión ya no
// se escribe a mano en ningún sitio: se importa de aquí, y un guardarraíl compara los dos
// espejos. Dos guardas con criterios distintos sobre el mismo recurso no protegen: se
// contradicen (la lección de [T-130]).

export type AlcanceDeLey =
  | 'ley_entera'
  | 'seleccion_del_usuario'
  | 'interseccion_con_temario'
  | 'temario';

/**
 * La regla, que es la que ya aprendió el camino del test con el incidente Alfonso (11/07):
 * **no se interseca contra vacío**. Si la oposición no tiene NINGUNA fila de `topic_scope`
 * para esa ley, se respeta lo que el usuario pidió explícitamente; y si no pidió artículos,
 * la ley entera. Nunca un cero silencioso.
 */
export function decidirAlcanceDeLey(opts: {
  acotarAlTemario: boolean;
  tieneScopeDeLaLey: boolean;
  haySeleccionManual: boolean;
}): AlcanceDeLey {
  if (!opts.acotarAlTemario) {
    return opts.haySeleccionManual ? 'seleccion_del_usuario' : 'ley_entera';
  }
  if (!opts.tieneScopeDeLaLey) {
    // DEGRADACIÓN: sin temario para esta ley, intersecar daría 0.
    return opts.haySeleccionManual ? 'seleccion_del_usuario' : 'ley_entera';
  }
  return opts.haySeleccionManual ? 'interseccion_con_temario' : 'temario';
}

/** ¿Se ha degradado, es decir, se pidió acotar y no se pudo? Útil para observarlo. */
export function esDegradacion(opts: {
  acotarAlTemario: boolean;
  tieneScopeDeLaLey: boolean;
}): boolean {
  return opts.acotarAlTemario && !opts.tieneScopeDeLaLey;
}
