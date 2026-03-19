require("dotenv").config({ path: ".env.local" });
const { createClient } = require("@supabase/supabase-js");
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

(async () => {
  // #1 - LCSP art.107.4 garantía definitiva concesiones pliego cláusulas administrativas particulares
  const exp1 = `**Articulo 107.4 de la Ley 9/2017 (LCSP) - Garantia definitiva en concesiones:**

> "En la concesion de obras y en la concesion de servicios el importe de la garantia definitiva se fijara en cada caso por el organo de contratacion en el **pliego de clausulas administrativas particulares**, en funcion de la **naturaleza, importancia y duracion** de la concesion de que se trate."

**Por que C es correcta (pliego de clausulas administrativas particulares):**
El art. 107.4 LCSP establece que para concesiones de obras y servicios, la garantia definitiva se fija en el **pliego de clausulas administrativas particulares** (PCAP), atendiendo a tres criterios: naturaleza, importancia y duracion de la concesion. Tiene sentido porque cada concesion es diferente, asi que el pliego particular (no el general) es el documento adecuado.

**Por que las demas son incorrectas:**

- **A)** Dice "pliego de clausulas administrativas **generales**". Falso: el art. 107.4 dice **particulares**, no generales. Los pliegos generales contienen condiciones tipo comunes a todos los contratos; la fijacion de la garantia especifica de cada concesion va en los **particulares**.

- **B)** Dice "pliego de **prescripciones tecnicas** particulares". Falso: el pliego de prescripciones tecnicas define las especificaciones tecnicas del contrato (calidad, materiales, requisitos funcionales), no las condiciones economicas ni las garantias. Las garantias se regulan en el pliego de clausulas **administrativas**.

- **D)** Contiene **dos errores**: (1) dice "pliego de clausulas administrativas **generales**" en vez de particulares; (2) dice "en funcion de la **complejidad**" cuando el art. 107.4 dice "naturaleza, **importancia** y duracion". Cambia el criterio legal.

**Clave:** Garantia definitiva en concesiones = pliego de clausulas administrativas **particulares** + criterios de naturaleza, importancia y duracion.`;

  const { error: e1 } = await supabase.from("questions").update({ explanation: exp1 }).eq("id", "f3eb28d8-6625-4401-8d88-2108362845a7");
  console.log(e1 ? "Error 1: " + e1.message : "OK 1 - LCSP art.107.4 garantia concesiones (" + exp1.length + " chars)");

  // #2 - LCSP art.237 comprobación replanteo 1 mes desde formalización
  const exp2 = `**Articulo 237 de la Ley 9/2017 (LCSP) - Comprobacion del replanteo:**

> "La ejecucion del contrato de obras comenzara con el acta de comprobacion del replanteo. A tales efectos, dentro del plazo que se consigne en el contrato que **no podra ser superior a un mes desde la fecha de su formalizacion** salvo casos excepcionales justificados, el servicio de la Administracion encargada de las obras procedera, en presencia del contratista, a efectuar la comprobacion del replanteo."

**Por que A es correcta (superior a un mes desde su formalizacion):**
El art. 237 LCSP fija un plazo maximo de **un mes** contado desde la **formalizacion** del contrato para realizar la comprobacion del replanteo. Son dos datos clave: el plazo (1 mes) y el momento desde el que se cuenta (formalizacion).

**Por que las demas son incorrectas:**

- **B)** Dice "quince dias desde su **adjudicacion**". Contiene **dos errores**: (1) el plazo es un **mes**, no quince dias; (2) se cuenta desde la **formalizacion**, no desde la adjudicacion. La adjudicacion y la formalizacion son actos distintos: primero se adjudica, luego se formaliza el contrato.

- **C)** Dice "un mes desde su **adjudicacion**". Acierta en el plazo (un mes) pero yerra en el momento: se cuenta desde la **formalizacion**, no desde la adjudicacion. La trampa es sutil porque confunde dos fases del procedimiento de contratacion.

- **D)** Dice "dos meses desde su formalizacion". Acierta en el momento (formalizacion) pero duplica el plazo: es **un** mes, no dos. El art. 237 es claro: "no podra ser superior a **un mes**".

**Clave:** Comprobacion del replanteo = maximo **1 mes** desde la **formalizacion**. No confundir formalizacion con adjudicacion, ni duplicar el plazo.`;

  const { error: e2 } = await supabase.from("questions").update({ explanation: exp2 }).eq("id", "dddfe293-e0ba-4444-aac9-9260a3579438");
  console.log(e2 ? "Error 2: " + e2.message : "OK 2 - LCSP art.237 replanteo 1 mes (" + exp2.length + " chars)");

  // #3 - LCSP art.312.f confusión de plantillas signos distintivos contratista
  const exp3 = `**Articulo 312.f de la Ley 9/2017 (LCSP) - Medidas para evitar la confusion de plantillas:**

> "A efectos de evitar la confusion de plantillas, se intentara que los **trabajadores de la empresa contratista** no compartan espacios y lugares de trabajo con el personal al servicio de la Administracion, y **los trabajadores y los medios de la empresa contratista** se identificaran mediante los correspondientes signos distintivos, tales como uniformidad o rotulaciones."

**Por que A es correcta:**
La opcion A reproduce fielmente el art. 312.f: (1) se intenta que los trabajadores de la **contratista** no compartan espacios con los de la Administracion, y (2) son los trabajadores y medios de la **contratista** quienes se identifican con signos distintivos. La logica es clara: la empresa contratista es la "invitada" en las dependencias publicas, por lo que es ella quien debe distinguirse.

**Por que las demas son incorrectas:**

- **B)** Dice que "los **empleados publicos** se identificaran mediante signos distintivos". Falso: el art. 312.f dice que son los trabajadores de la **empresa contratista** quienes se identifican, no los empleados publicos. La trampa invierte el sujeto de la obligacion de identificacion.

- **C)** Contiene **dos errores**: (1) dice que "los **empleados publicos** no compartan espacios" cuando el articulo se refiere a los trabajadores de la contratista; (2) dice que los empleados publicos se identifican con signos distintivos cuando es la contratista quien lo hace. Invierte completamente los sujetos en ambas medidas.

- **D)** "Todas son incorrectas". Falso: la opcion A reproduce correctamente el art. 312.f. Esta opcion es la trampa clasica de "todas incorrectas" cuando una si es correcta.

**Clave:** Quien se identifica con signos distintivos es la **empresa contratista** (no los empleados publicos). Y se intenta que los trabajadores de la **contratista** (no los funcionarios) no compartan espacios.`;

  const { error: e3 } = await supabase.from("questions").update({ explanation: exp3 }).eq("id", "f5d22984-288a-4ee9-93e1-8f603a275f85");
  console.log(e3 ? "Error 3: " + e3.message : "OK 3 - LCSP art.312.f confusion plantillas (" + exp3.length + " chars)");
})();
