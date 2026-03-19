require("dotenv").config({ path: ".env.local" });
const { createClient } = require("@supabase/supabase-js");
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

(async () => {
  // #1 - Ley 50/1981 art.6 Ministerio Fiscal principio legalidad
  const exp1 = `**Articulo 6 de la Ley 50/1981 (Estatuto Organico del Ministerio Fiscal):**

> "Por el principio de **legalidad** el Ministerio Fiscal actuara con sujecion a la Constitucion, a las leyes y demas normas que integran el ordenamiento juridico vigente, dictaminando, informando y ejercitando, en su caso, las acciones procedentes [...]"

**Por que C es correcta (legalidad):**
El art. 6 define expresamente el principio de **legalidad** como aquel que obliga al MF a actuar conforme a la Constitucion y al ordenamiento juridico. Es el principio que vincula al MF con el Derecho vigente: no puede actuar al margen de la ley.

**Por que las demas son incorrectas (son otros principios del MF):**

- **A)** "Profesionalidad". Falso: aunque la profesionalidad es un valor del MF, el principio que vincula al MF con la sujecion a la CE y al ordenamiento es la **legalidad** (art. 6), no la profesionalidad. La profesionalidad no aparece como principio autonomo en los arts. 6-8 del Estatuto.

- **B)** "Objetividad". Falso: la objetividad no es el principio que define la sujecion al ordenamiento juridico. La objetividad se relaciona con la actuacion imparcial del MF, pero el principio que el art. 6 vincula a la CE es la legalidad.

- **D)** "Imparcialidad". Falso: el art. 7 del Estatuto define el principio de **imparcialidad** como aquel por el que el MF actua "con plena objetividad e independencia en defensa de los intereses que le estan encomendados". La imparcialidad se refiere a la neutralidad del MF, no a su sujecion al ordenamiento.

**Principios del Ministerio Fiscal (arts. 6-8 Estatuto):**

| Principio | Articulo | Contenido |
|-----------|----------|-----------|
| **Legalidad** | Art. 6 | Sujecion a CE y ordenamiento |
| Imparcialidad | Art. 7 | Objetividad e independencia |
| Unidad de actuacion | Art. 8 | Dependencia jerarquica |

**Clave:** Legalidad = sujecion al ordenamiento. Imparcialidad = objetividad. No confundirlos.`;

  const { error: e1 } = await supabase.from("questions").update({ explanation: exp1 }).eq("id", "0b13d9e6-61b2-4dc7-b126-29d55e915ef3");
  console.log(e1 ? "Error 1: " + e1.message : "OK 1 - Ley 50/1981 art.6 MF legalidad (" + exp1.length + " chars)");

  // #2 - TFUE art.267 cuestion prejudicial podra pedir
  const exp2 = `**Articulo 267 del TFUE (parrafos 2 y 3):**

> Parrafo 2: "Cuando se plantee una cuestion de esta naturaleza ante un organo jurisdiccional de uno de los Estados miembros, dicho organo **podra** pedir al Tribunal que se pronuncie sobre la misma, si estima necesaria una decision al respecto para poder emitir su fallo."

> Parrafo 3: "Cuando se plantee una cuestion de este tipo en un asunto pendiente ante un organo jurisdiccional nacional, cuyas decisiones **no sean susceptibles de ulterior recurso** judicial de Derecho interno, dicho organo **estara obligado** a someter la cuestion al Tribunal."

**Por que C es correcta ("podra pedir"):**
El art. 267 TFUE distingue dos supuestos:
- Organo jurisdiccional **con recurso**: **podra** plantear la cuestion prejudicial (facultativo)
- Organo jurisdiccional de **ultima instancia**: **estara obligado** a plantearla (preceptivo)

La opcion C reproduce fielmente el parrafo 2: el organo "podra pedir" si estima necesaria una decision.

**Por que las demas son incorrectas:**

- **A)** "Dicho organo **debera** pedir al Tribunal [...]". Falso: el parrafo 2 dice "**podra**", no "debera". La obligacion de plantear la cuestion solo existe para los organos de ultima instancia (parrafo 3). La trampa cambia "podra" (facultativo) por "debera" (obligatorio).

- **B)** "Dicho organo **debera** pedir [...] cuando se trate de un asunto en relacion con una persona privada de libertad". Falso: el parrafo 4 del art. 267 dice que cuando haya persona privada de libertad, el TJUE "se pronunciara con la **mayor brevedad**". No dice que el organo "debera" plantear la cuestion; solo establece urgencia en la tramitacion.

- **D)** "Dicho organo **podra** pedir [...] si sus decisiones no son susceptibles de ulterior recurso". Falso: cuando las decisiones NO son susceptibles de recurso (ultima instancia), el organo NO "podra" sino que **estara obligado** a plantear la cuestion. La trampa combina la facultad ("podra") con el supuesto de obligacion (ultima instancia).

**Cuestion prejudicial (art. 267 TFUE):**

| Supuesto | Regimen |
|----------|---------|
| Organo **con** recurso | **Podra** plantear (facultativo) |
| Organo de **ultima instancia** | **Obligado** a plantear (preceptivo) |
| Persona privada de libertad | TJUE resuelve con **mayor brevedad** |

**Clave:** "Podra" (facultativo) vs "estara obligado" (ultima instancia). La trampa tipica es invertir estos dos regimenes.`;

  const { error: e2 } = await supabase.from("questions").update({ explanation: exp2 }).eq("id", "535e250a-4224-4caf-a977-fdb8c2cc6dff");
  console.log(e2 ? "Error 2: " + e2.message : "OK 2 - TFUE art.267 cuestion prejudicial (" + exp2.length + " chars)");
})();
