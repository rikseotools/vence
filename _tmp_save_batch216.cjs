require("dotenv").config({ path: ".env.local" });
const { createClient } = require("@supabase/supabase-js");
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

(async () => {
  // #1 - CE art.164 sentencias TC INCORRECTA recurso anulación
  const exp1 = `**Articulo 164.1 de la Constitucion Espanola - Sentencias del TC:**

> "Las sentencias del Tribunal Constitucional se publicaran en el **boletin oficial del Estado con los votos particulares**, si los hubiere. Tienen el valor de **cosa juzgada** a partir del dia siguiente de su publicacion y **no cabe recurso alguno** contra ellas. Las que declaren la inconstitucionalidad de una ley [...] tienen **plenos efectos frente a todos**."

**Por que C es la afirmacion INCORRECTA (y por tanto la respuesta):**
La opcion C dice que "cabe **recurso de anulacion**" contra las sentencias del TC. Falso: el art. 164.1 CE establece tajantemente que "**no cabe recurso alguno** contra ellas". Las sentencias del TC son **irrecurribles**; no existe ningun recurso (ni de anulacion, ni de apelacion, ni de casacion) contra ellas. Son firmes e inapelables desde su publicacion.

**Por que las demas SI son correctas (art. 164.1):**

- **A)** "Las que declaren la inconstitucionalidad [...] tienen **plenos efectos frente a todos**." **Correcto**: el art. 164.1 atribuye efectos *erga omnes* a las sentencias de inconstitucionalidad. Vinculan a todos, no solo a las partes.

- **B)** "Tienen valor de **cosa juzgada** a partir del dia siguiente de su publicacion." **Correcto**: el art. 164.1 establece que la cosa juzgada se produce al dia siguiente de la publicacion en el BOE.

- **D)** "Se publicaran en el BOE con los **votos particulares**." **Correcto**: el art. 164.1 exige la publicacion en el BOE incluyendo los votos particulares (disidentes o concurrentes), si los hubiere.

**Sentencias del TC (art. 164 CE):**

| Caracteristica | Detalle |
|----------------|---------|
| Publicacion | BOE + votos particulares |
| Cosa juzgada | Desde el dia siguiente a la publicacion |
| Recursos | **No cabe recurso alguno** |
| Efectos | Plenos efectos frente a todos (si inconstitucionalidad) |

**Clave:** Las sentencias del TC son irrecurribles. "No cabe recurso alguno" es una formula absoluta del art. 164.1 CE.`;

  const { error: e1 } = await supabase.from("questions").update({ explanation: exp1 }).eq("id", "d9f08792-8bc5-443c-9ed4-8d51bc2be00f");
  console.log(e1 ? "Error 1: " + e1.message : "OK 1 - CE art.164 sentencias TC (" + exp1.length + " chars)");

  // #2 - Concepto 227 presupuestario, edición publicaciones NO
  const exp2 = `**Clasificacion economica del presupuesto - Concepto 227 vs Articulo 24:**

> **Concepto 227** (Art. 22): "Trabajos realizados por otras empresas y profesionales." Incluye gastos de actividades ejecutadas mediante contrato con empresas externas o profesionales independientes.
>
> **Articulo 24**: "Gastos de publicaciones." Gastos ocasionados por la **edicion y distribucion** de las publicaciones de acuerdo con el plan elaborado por el departamento.

**Por que B es correcta (edicion y distribucion de publicaciones NO va al Concepto 227):**
Los gastos de **edicion y distribucion de publicaciones** se imputan al **Articulo 24** (Gastos de publicaciones), no al Concepto 227. El Articulo 24 cubre especificamente las publicaciones realizadas conforme al plan del departamento u organismo.

**Por que las demas SI se imputan al Concepto 227:**

- **A)** "Otorgamiento de **poderes notariales**." **Si pertenece al Concepto 227**, subconcepto 99 (Otros). Los gastos notariales son servicios de profesionales independientes.

- **C)** "Tramites **aduaneros** por importaciones/exportaciones temporales." **Si pertenece al Concepto 227**, subconcepto 99 (Otros). Son servicios realizados por agentes externos.

- **D)** "Dotacion de **premios literarios**, de investigacion y estudios." **Si pertenece al Concepto 227**, subconcepto 06 (Estudios y trabajos tecnicos), siempre que no tengan caracter de transferencias.

**Concepto 227 - Principales gastos incluidos:**

| Subconcepto | Gastos |
|-------------|--------|
| 06 | Premios literarios/investigacion, publicaciones fuera del Plan, exposiciones |
| 99 | Poderes notariales, tramites aduaneros |
| ~~Art. 24~~ | ~~Edicion y distribucion de publicaciones del Plan~~ (va a Art. 24, no 227) |

**Clave:** Las publicaciones del Plan van al Articulo 24. Los premios literarios y publicaciones fuera del Plan van al Concepto 227.06. No confundir ambos.`;

  const { error: e2 } = await supabase.from("questions").update({ explanation: exp2 }).eq("id", "654cc362-f146-4359-be77-5c44573a6558");
  console.log(e2 ? "Error 2: " + e2.message : "OK 2 - Concepto 227 publicaciones (" + exp2.length + " chars)");

  // #3 - CE art.14 reforma procedimiento ordinario 3/5
  const exp3 = `**Articulos 167 y 168 de la Constitucion Espanola - Reforma del art. 14:**

> Art. 168.1: "Cuando se propusiere la revision total de la Constitucion o una parcial que afecte al Titulo preliminar, al Capitulo segundo, **Seccion primera** del Titulo I, o al Titulo II, se procedera a la aprobacion del principio por mayoria de **dos tercios** de cada Camara [...]"

**Paso clave: Ubicacion del art. 14 en la estructura de la CE**

El art. 14 esta en el **Capitulo II del Titulo I**, pero **antes** del inicio de la Seccion 1.a:

- Art. 14: Igualdad (esta "suelto", antes de las Secciones)
- Seccion 1.a: arts. **15-29** (Derechos fundamentales)
- Seccion 2.a: arts. 30-38 (Derechos y deberes)

El art. 168 solo protege la **Seccion 1.a** (arts. 15-29), **no** todo el Capitulo II. Como el art. 14 no esta en la Seccion 1.a, se reforma por el procedimiento **ordinario** del art. 167.

**Por que B es correcta (3/5 de cada Camara):**
Al aplicarse el art. 167 (procedimiento ordinario), la mayoria requerida es de **tres quintos** de cada Camara. No se exige disolucion de Cortes ni referendum obligatorio.

**Por que las demas son incorrectas:**

- **A)** "Mayoria de **dos tercios** de cada Camara." Falso: los 2/3 corresponden al art. **168** (procedimiento agravado), que no se aplica al art. 14. Solo se aplicaria si se reformase un articulo de la Seccion 1.a (arts. 15-29), el Titulo Preliminar o el Titulo II.

- **C)** "2/3 del Congreso y 3/5 en el Senado." Falso: no existe un procedimiento mixto con mayorias diferentes para cada Camara. Ambos procedimientos (167 y 168) exigen la misma mayoria en las dos Camaras.

- **D)** "3/5 en el Congreso y 2/3 en el Senado." Falso: misma razon que C. No hay asimetria entre Camaras en el procedimiento de reforma constitucional.

**Reforma constitucional y art. 14:**

| Articulo CE | Procedimiento | Mayoria |
|-------------|---------------|---------|
| **14 (igualdad)** | **Art. 167 (ordinario)** | **3/5** |
| 15-29 (Seccion 1.a) | Art. 168 (agravado) | 2/3 |
| Titulo Preliminar, Titulo II | Art. 168 (agravado) | 2/3 |

**Clave:** El art. 14 NO esta en la Seccion 1.a (que empieza en el art. 15). Por eso se reforma por el art. 167 (3/5), no por el 168 (2/3). Es una trampa clasica de oposiciones.`;

  const { error: e3 } = await supabase.from("questions").update({ explanation: exp3 }).eq("id", "06b4b2b8-396a-44e9-a2ba-2448153d7ab7");
  console.log(e3 ? "Error 3: " + e3.message : "OK 3 - CE art.14 reforma 3/5 (" + exp3.length + " chars)");
})();
