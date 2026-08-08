import pathlib

ANCLA = "### 🧰 ¿Esto ya existe? — registro de herramientas (ANTES de construir nada)"

NUEVO = """### 🔎 Un guardarraíl no LISTA a quién vigila: lo BUSCA (T-722, 08/08/2026)

**Cuatro veces pagado ya, y siempre igual:** alguien escribe a mano la lista de sitios que tocan un
recurso compartido, la lista no está mal *ese día*, y **se queda vieja sola**. Entonces el
guardarraíl da verde sobre un universo que ya no es el real — que es peor que no tenerlo, porque
tranquiliza.

| caso | cómo se contó | cuántos había |
|---|---|---|
| [T-130] `seguimiento_url` | «los escritores que conozco» | **cinco** |
| [T-339] `target_oposicion` | tres puertas listadas | **cuatro** (y al buscar apareció una quinta) |
| [T-689] `review_requested_at` | `FUENTES = [tres ficheros]` | **cuatro**; el que faltaba contaba 11 filas ya revisadas como pendientes |
| [T-722] escritores de `explanation_data` | dos ficheros | **tres**; el tercero marcaba preguntas `safe` sin mirar si sus opciones se citan entre sí, y hay **79 activas** en las que eso importa |

**El patrón que funciona** (implementado en los tres guardarraíles anteriores): recorrer el árbol,
quedarse con los ficheros que de verdad tocan el recurso **por patrón de escritura real** (no por
mencionarlo: leerlo no cuenta), y **fallar si encuentra menos de los que ya se sabe que hay**. Ese
mínimo no es opcional — un descubrimiento que devuelve cero pasaría TODO en verde sin mirar nada,
que es la forma más silenciosa de perder un guardarraíl.

⚠️ **Y lo que NO hay que convertir, que es la mitad de la regla.** Medido el 08/08: hay **30**
constantes con lista de rutas en `__tests__`, y solo unas pocas son de este tipo. Los **trinquetes**
—`ZONA_CIEGA_PENDIENTE` de `user-scoping-c2`, `TECHO_CRUDOS` de `llmInstrumentation`,
`CACHEABLES_PENDIENTES`— llevan lista fija **a propósito**: es una línea base congelada que solo
puede ENCOGER, y ahí la lista *es* el mecanismo. Descubrir automáticamente los vaciaría de sentido.

**La regla, entonces, no es «ninguna lista a mano»: es «ninguna lista a mano que pretenda ser
exhaustiva».** Si la constante se llama `LOS_ESCRITORES`, `CONSUMIDORES`, `PUERTAS` o `TODAS_LAS_X`,
tiene que buscarlas. Si es una deuda que se está pagando poco a poco, se queda quieta.

Para reconocer a los escritores de un recurso ya hay pieza: `lib/admin/toolWriters.ts` detecta por
patrón real (`UPDATE … SET`, `INSERT INTO`, `.set({…})`) y es lo que usa `npm run tools:buscar`.
**No hay que reinventar la detección** — lo que faltaba es que los guardarraíles la usen en vez de
tener cada uno su lista.

"""

p = pathlib.Path('/home/manuel/vence-sessions/movil3/CLAUDE.md')
s = p.read_text()
assert ANCLA in s, 'ancla no encontrada en CLAUDE.md'
p.write_text(s.replace(ANCLA, NUEVO + ANCLA, 1))
print('CLAUDE.md actualizado')
