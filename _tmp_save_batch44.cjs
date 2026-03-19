require("dotenv").config({ path: ".env.local" });
const { createClient } = require("@supabase/supabase-js");
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

(async () => {
  // #1 - TFUE art.267 cuestion prejudicial obligatoria
  const exp1 = `**Articulo 267 del TFUE** (Cuestion prejudicial):

> "Cuando se plantee una cuestion de esta naturaleza ante un organo jurisdiccional de uno de los Estados miembros, dicho organo **podra** pedir al Tribunal que se pronuncie sobre la misma [...]
> Cuando se plantee una cuestion de este tipo en un asunto pendiente ante un organo jurisdiccional nacional, **cuyas decisiones no sean susceptibles de ulterior recurso judicial** de Derecho interno, dicho organo estara **obligado** a someter la cuestion al Tribunal."

**Por que D es correcta:**
El art. 267 TFUE establece **dos regimenes** segun la instancia del organo judicial:

| Organo judicial | Cuestion prejudicial | Texto art. 267 |
|----------------|---------------------|----------------|
| Con recurso posible | **Facultativa** ("podra") | Puede plantearla si lo estima necesario |
| **Sin recurso** (ultima instancia) | **Obligatoria** ("estara obligado") | Debe plantearla si tiene dudas |

La opcion D recoge correctamente los **dos requisitos** acumulativos: (1) dudas sobre interpretacion de norma comunitaria + (2) que sus decisiones no sean susceptibles de recurso.

**Por que las demas son incorrectas:**

- **A)** "Siempre que les surjan dudas, **sin ningun otro requisito**". Falso: las dudas solas no bastan para que sea **obligatorio**. Si el organo tiene recurso superior, el planteamiento es facultativo (puede, pero no debe). Solo es obligatorio si ademas es ultima instancia.

- **B)** "Siempre que deban aplicar una norma comunitaria". Falso: no basta con aplicar una norma. Hace falta que tengan **dudas** sobre su interpretacion o validez. Si la norma es clara (doctrina del "acto claro"), no hay obligacion de plantear cuestion.

- **C)** "Nunca estan obligados: es facultativo". Falso: para los organos de **ultima instancia** es obligatorio (art. 267 parrafo 3). Solo es facultativo para los organos cuyas decisiones admiten recurso.

**Clave:** Obligatorio = dudas + ultima instancia (sin recurso). Facultativo = dudas + instancia con recurso.`;

  const { error: e1 } = await supabase.from("questions").update({ explanation: exp1 }).eq("id", "1d1aa4d5-690f-4b48-b2e9-0e57af98e1b0");
  console.log(e1 ? "Error 1: " + e1.message : "OK 1 - TFUE art.267 cuestion prejudicial (" + exp1.length + " chars)");

  // #2 - Ley 50/1997 organos de colaboracion y apoyo
  const exp2 = `**Articulo 7 y siguientes de la Ley 50/1997** (Organos de colaboracion y apoyo al Gobierno):

El Titulo II de la Ley 50/1997, del Gobierno, regula los **organos de colaboracion y apoyo al Gobierno**, que son tres:

> 1. La **Comision General de Secretarios de Estado y Subsecretarios** (art. 8)
> 2. Los **Secretarios de Estado** (art. 7)
> 3. Los **Gabinetes** (art. 10)

**Por que B es correcta (NO es organo de colaboracion y apoyo):**
Los **Secretarios Generales Tecnicos** no aparecen en el Titulo II de la Ley 50/1997. Son organos directivos de los Departamentos ministeriales, regulados en la Ley 40/2015 (LRJSP), no organos de colaboracion al Gobierno. Su funcion es de asistencia tecnica al Ministro y de servicios comunes del Ministerio.

**Por que las demas son incorrectas (SI son organos de colaboracion):**

- **A)** "Comision General de Secretarios de Estado y Subsecretarios". SI es organo de colaboracion: art. 8 de la Ley 50/1997. Prepara las sesiones del Consejo de Ministros y examina los asuntos.

- **C)** "Secretarios de Estado". SI son organos de colaboracion: art. 7 de la Ley 50/1997. Son organos superiores directamente responsables de la accion del Gobierno en un sector.

- **D)** "Gabinetes". SI son organos de colaboracion: art. 10 de la Ley 50/1997. Son organos de apoyo politico y tecnico del Presidente, Vicepresidentes, Ministros y Secretarios de Estado.

**Organos de colaboracion y apoyo (Titulo II Ley 50/1997):**
| Organo | Articulo | Funcion |
|--------|----------|---------|
| Secretarios de Estado | Art. 7 | Ejecucion de la accion del Gobierno |
| Comision Gral. de SE y Subsecretarios | Art. 8 | Preparar sesiones del Consejo de Ministros |
| Gabinetes | Art. 10 | Apoyo politico y tecnico |`;

  const { error: e2 } = await supabase.from("questions").update({ explanation: exp2 }).eq("id", "aba03842-c471-4f1b-93f6-21cb4af28abd");
  console.log(e2 ? "Error 2: " + e2.message : "OK 2 - Ley 50/1997 organos colaboracion (" + exp2.length + " chars)");
})();
