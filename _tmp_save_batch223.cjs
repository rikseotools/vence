require("dotenv").config({ path: ".env.local" });
const { createClient } = require("@supabase/supabase-js");
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

(async () => {
  // #1 - CE art.53.1 Sección 2ª Cap.II solo por ley
  const exp1 = `**Articulo 53 de la Constitucion Espanola - Garantias de los derechos:**

> Art. 53.1: "Los derechos y libertades reconocidos en el **Capitulo segundo** del presente Titulo vinculan a todos los poderes publicos. **Solo por ley**, que en todo caso debera respetar su contenido esencial, podra regularse el ejercicio de tales derechos y libertades [...]"

**Por que B es correcta (solo puede regularse por ley):**
El art. 53.1 CE establece una **reserva de ley** para todos los derechos del Capitulo II del Titulo I (arts. 14-38), que incluye tanto la Seccion 1.a (arts. 15-29) como la **Seccion 2.a** (arts. 30-38). Por tanto, los derechos de la Seccion 2.a solo pueden regularse por ley. Esta es la unica garantia que comparten TODOS los derechos del Capitulo II.

**Por que las demas son incorrectas (confunden garantias de la Seccion 1.a con la 2.a):**

- **A)** "Para su reforma ha de seguirse el **art. 168**." Falso: el art. 168 (procedimiento agravado de reforma) solo se aplica a la **Seccion 1.a** del Capitulo II (arts. 15-29), no a la Seccion 2.a (arts. 30-38). Los derechos de la Seccion 2.a se reforman por el art. 167 (procedimiento ordinario).

- **C)** "Estan protegidos por un procedimiento **preferente y sumario**." Falso: el art. 53.2 CE reserva el procedimiento preferente y sumario ante tribunales ordinarios para el art. 14 y la **Seccion 1.a** (arts. 15-29), no para la Seccion 2.a.

- **D)** "Estan tutelados por el **recurso de amparo**." Falso: el recurso de amparo ante el TC (art. 53.2 CE) solo protege al art. 14, la **Seccion 1.a** (arts. 15-29) y la objecion de conciencia (art. 30). Los demas derechos de la Seccion 2.a no tienen amparo.

**Garantias segun ubicacion en la CE:**

| Garantia | Seccion 1.a (15-29) | Seccion 2.a (30-38) |
|----------|---------------------|---------------------|
| **Reserva de ley (art. 53.1)** | **Si** | **Si** |
| Procedimiento preferente y sumario | Si | No |
| Recurso de amparo TC | Si | No |
| Reforma por art. 168 | Si | No |

**Clave:** La reserva de ley (art. 53.1) es la unica garantia comun a TODO el Capitulo II. Las demas (amparo, preferente y sumario, reforma agravada) solo se aplican a la Seccion 1.a.`;

  const { error: e1 } = await supabase.from("questions").update({ explanation: exp1 }).eq("id", "5e2d9172-bda7-4f62-9d4f-2892665c910f");
  console.log(e1 ? "Error 1: " + e1.message : "OK 1 - CE art.53.1 Seccion 2a solo ley (" + exp1.length + " chars)");

  // #2 - Ley 7/1985 art.11.2 elementos del municipio
  const exp2 = `**Articulo 11.2 de la Ley 7/1985 (LBRL) - Elementos del municipio:**

> "Son elementos del Municipio el **territorio**, la **poblacion** y la **organizacion**."

**Por que A es correcta (territorio, poblacion y organizacion):**
El art. 11.2 LBRL enumera literalmente tres elementos del municipio: **territorio**, **poblacion** y **organizacion**. Son exactamente estas tres palabras, sin sinonimos ni variantes.

**Por que las demas son incorrectas (usan terminos diferentes):**

- **B)** "El **termino municipal**, los **habitantes** y la organizacion." Falso: usa "termino municipal" en lugar de "territorio" y "habitantes" en lugar de "poblacion". Aunque "termino municipal" y "habitantes" son conceptos relacionados, el art. 11.2 usa las palabras **exactas** "territorio" y "poblacion".

- **C)** "El territorio, la poblacion y el **ayuntamiento**." Falso: usa "ayuntamiento" en lugar de "organizacion". El ayuntamiento es la forma concreta de organizacion del municipio (art. 19 LBRL: "El Gobierno y la administracion municipal corresponden al Ayuntamiento"), pero el art. 11.2 usa el termino generico "organizacion", no "ayuntamiento".

- **D)** "El **termino municipal**, los **habitantes** y los **organos de gobierno**." Falso: cambia los tres terminos. Ninguna de las tres palabras coincide con las del art. 11.2. "Termino municipal" no es "territorio", "habitantes" no es "poblacion" y "organos de gobierno" no es "organizacion".

**Elementos del municipio (art. 11.2 LBRL):**

| Elemento | Termino exacto | NO confundir con |
|----------|---------------|-------------------|
| 1.o | **Territorio** | Termino municipal |
| 2.o | **Poblacion** | Habitantes, vecinos |
| 3.o | **Organizacion** | Ayuntamiento, organos de gobierno |

**Clave:** Territorio + poblacion + organizacion. Son tres terminos literales del art. 11.2. Las preguntas suelen sustituir estas palabras por sinonimos para crear opciones falsas.`;

  const { error: e2 } = await supabase.from("questions").update({ explanation: exp2 }).eq("id", "e02182e7-5347-4113-806a-a558e1c105ea");
  console.log(e2 ? "Error 2: " + e2.message : "OK 2 - LBRL art.11 elementos municipio (" + exp2.length + " chars)");
})();
