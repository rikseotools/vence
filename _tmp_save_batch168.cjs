require("dotenv").config({ path: ".env.local" });
const { createClient } = require("@supabase/supabase-js");
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

(async () => {
  // #1 - LCSP art.204 modificación contratos 20% precio inicial
  const exp1 = `**Articulo 204.1 de la Ley 9/2017 (LCSP) - Modificacion prevista en los pliegos:**

> "Los contratos de las Administraciones Publicas podran modificarse durante su vigencia hasta un maximo del **veinte por ciento** del precio inicial cuando en los pliegos de clausulas administrativas particulares se hubiere advertido expresamente de esta posibilidad."

**Por que A es correcta (20% del precio inicial):**
El art. 204.1 permite modificar contratos durante su vigencia hasta un maximo del **20%** del precio inicial, siempre que los pliegos lo prevean expresamente. La clausula de modificacion debe ser clara, precisa e inequivoca, y precisar el alcance, limites y condiciones.

**Por que las demas son incorrectas (porcentajes diferentes):**

- **B)** "**10%**". Falso: el art. 204.1 dice 20%, no 10%. El 10% aparece en otro contexto de la LCSP: el art. 205.2.c permite modificaciones no previstas hasta un 10% del precio para servicios y suministros (y 15% para obras). No confundir modificaciones previstas (20%) con no previstas (10%/15%).

- **C)** "**15%**". Falso: no es el porcentaje del art. 204.1. El 15% aparece como limite para modificaciones **no previstas** en contratos de obras (art. 205.2.c), no para modificaciones previstas en los pliegos.

- **D)** "**5%**". Falso: el 5% aparece en otro contexto de la LCSP (por ejemplo, la garantia definitiva es del 5% del precio de adjudicacion, art. 107.1). No tiene relacion con el limite de modificacion.

**Limites de modificacion contractual (LCSP):**

| Tipo de modificacion | Limite | Articulo |
|---------------------|--------|----------|
| **Prevista** en los pliegos | **20%** del precio inicial | Art. **204** |
| No prevista (obras) | 15% del precio | Art. 205.2.c |
| No prevista (servicios/suministros) | 10% del precio | Art. 205.2.c |

**Clave:** Modificacion prevista en pliegos = 20%. No prevista = 10% o 15%. No confundir las dos.`;

  const { error: e1 } = await supabase.from("questions").update({ explanation: exp1 }).eq("id", "59af4271-751d-4ea6-9c3c-3e42169e8312");
  console.log(e1 ? "Error 1: " + e1.message : "OK 1 - LCSP art.204 modificacion 20% (" + exp1.length + " chars)");

  // #2 - LCSP art.44 recurso especial contratación concesiones 3 millones
  const exp2 = `**Articulo 44.1 de la Ley 9/2017 (LCSP) - Recurso especial en materia de contratacion:**

> Art. 44.1: "Seran susceptibles de recurso especial [...] cuando se refieran a los siguientes contratos:
> a) Contratos de **obras** cuyo valor estimado sea superior a **tres millones de euros**, y de **suministro y servicios**, que tenga un valor estimado superior a **cien mil euros**.
> [...]
> c) Concesiones de **obras** o de **servicios** cuyo valor estimado supere los **tres millones de euros**."

**Por que B es correcta (concesiones superiores a 3 millones):**
El art. 44.1.c establece que las **concesiones** de obras o servicios son susceptibles de recurso especial cuando su valor estimado supere los **3 millones de euros**. La opcion B reproduce este supuesto.

**Por que las demas son incorrectas:**

- **A)** Habla de "encargos" con importe inferior al de contratos de servicios. Falso: los encargos a medios propios (art. 32 LCSP) no figuran entre los actos susceptibles de recurso especial del art. 44. El recurso especial se aplica a contratos y concesiones por encima de ciertos umbrales.

- **C)** Dice "obras superior a **500.000 euros** y suministro/servicios superior a **300.000 euros**". Falso: los umbrales correctos del art. 44.1.a son **3 millones** para obras y **100.000 euros** para suministro y servicios. Esta opcion reduce drasticamente el umbral de obras y triplica el de servicios.

- **D)** Dice "obras superior a **2 millones** y suministro/servicios superior a **100.000 euros**". Falso: acierta en el umbral de servicios (100.000) pero yerra en el de obras: son **3 millones**, no 2. La trampa reduce el umbral de obras en un tercio.

**Umbrales del recurso especial (art. 44.1 LCSP):**

| Tipo de contrato | Umbral |
|-----------------|--------|
| **Obras** | > 3 millones euros |
| **Suministro y servicios** | > 100.000 euros |
| **Concesiones** (obras o servicios) | > 3 millones euros |

**Clave:** Obras y concesiones = 3 millones. Suministro y servicios = 100.000 euros.`;

  const { error: e2 } = await supabase.from("questions").update({ explanation: exp2 }).eq("id", "30033d69-4d5f-46e4-8e9d-4aa84853e6d0");
  console.log(e2 ? "Error 2: " + e2.message : "OK 2 - LCSP art.44 recurso especial (" + exp2.length + " chars)");

  // #3 - RDL 6/2023 art.109 RPT denominaciones tipo planificación
  const exp3 = `**Articulo 109 del RDL 6/2023 - Relaciones de puestos de trabajo (RPT):**

> Art. 109.1: "Las relaciones de puestos de trabajo son instrumentos tecnicos de **planificacion** a traves de los cuales la Administracion del Estado organiza, racionaliza y ordena su personal."
>
> "Las relaciones de puestos de trabajo **son publicas** y han de incluir, de forma conjunta o separada, todos los puestos de trabajo de naturaleza funcionarial, laboral y eventual existentes."
>
> Art. 109.2: "Los puestos de trabajo incluidos en la RPT se ordenaran atendiendo a **denominaciones tipo** y a **caracteristicas analogas**."

**Por que B es correcta:**
El art. 109.2 establece que los puestos en la RPT se ordenan por **denominaciones tipo** y **caracteristicas analogas**. Esto permite agrupar puestos similares de forma sistematica.

**Por que las demas son incorrectas (cambios sutiles):**

- **A)** Dice "en ambitos especificos **no podran** existir otros instrumentos que sustituyan a las RPT". Falso: el articulo contempla que **si** podran existir otros instrumentos de ordenacion del personal en ambitos especificos. La trampa anade un "no" que invierte el sentido.

- **C)** Dice "las RPT **pueden** ser publicas". Falso: el art. 109.1 dice que las RPT "**son** publicas", no que "pueden" serlo. "Son" expresa obligatoriedad y certeza; "pueden" sugiere posibilidad opcional. La diferencia es esencial: la publicidad de las RPT es un requisito, no una opcion.

- **D)** Dice "instrumentos tecnicos de **control**". Falso: el art. 109.1 dice "instrumentos tecnicos de **planificacion**", no de "control". La planificacion implica organizar y prever; el control implica supervisar y verificar. Son funciones administrativas diferentes.

**Clave:** RPT = instrumentos de **planificacion** (no control), **son** publicas (no "pueden ser"), y los puestos se ordenan por **denominaciones tipo**.`;

  const { error: e3 } = await supabase.from("questions").update({ explanation: exp3 }).eq("id", "086d2f81-9b71-40a2-ad7b-2a9bea8b426c");
  console.log(e3 ? "Error 3: " + e3.message : "OK 3 - RDL 6/2023 art.109 RPT (" + exp3.length + " chars)");
})();
