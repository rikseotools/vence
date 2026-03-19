require("dotenv").config({ path: ".env.local" });
const { createClient } = require("@supabase/supabase-js");
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

(async () => {
  // #1 - LOTC art.6 TC formas de actuacion
  const exp1 = `**Articulo 6.1 de la Ley Organica del Tribunal Constitucional (LOTC):**

> "El Tribunal Constitucional actua en **Pleno**, en **Sala** o en **Seccion**."

**Por que D es la INCORRECTA:**
El TC **no actua en "Comision"**. Las Comisiones son un organo tipico de las Camaras legislativas (Congreso y Senado), no del Tribunal Constitucional. El art. 6.1 LOTC enumera taxativamente las tres formas de actuacion: Pleno, Sala y Seccion.

**Por que las demas son correctas:**

- **A)** "En Sala". Correcto: el TC tiene **2 Salas**. La Sala Primera (Presidente + 5 Magistrados) y la Sala Segunda (Vicepresidente + 5 Magistrados). Conocen principalmente de los recursos de amparo.

- **B)** "En Seccion". Correcto: cada Sala se divide en **2 Secciones** de 3 Magistrados. Se encargan de la admision o inadmision de asuntos.

- **C)** "En Pleno". Correcto: el Pleno esta integrado por los **12 Magistrados** bajo la presidencia del Presidente. Conoce de los recursos y cuestiones de inconstitucionalidad, conflictos de competencias, etc.

**Estructura del TC:**
| Organo | Composicion | Funcion principal |
|--------|-------------|-------------------|
| **Pleno** | 12 Magistrados | Inconstitucionalidad, conflictos |
| **Salas** (2) | 6 Magistrados cada una | Recursos de amparo |
| **Secciones** (4) | 3 Magistrados cada una | Admision de asuntos |`;

  const { error: e1 } = await supabase.from("questions").update({ explanation: exp1 }).eq("id", "8875829a-528f-40b3-bb29-f5b9da2757db");
  console.log(e1 ? "Error 1: " + e1.message : "OK 1 - LOTC art.6 TC formas (" + exp1.length + " chars)");

  // #2 - LOTC art.35 cuestion de inconstitucionalidad - quien la plantea
  const exp2 = `**Articulo 35.1 de la LOTC y articulo 163 de la CE** (Cuestion de inconstitucionalidad):

> "Cuando un **Juez o Tribunal**, de oficio o a instancia de parte, considere que una norma con rango de Ley aplicable al caso y de cuya validez dependa el fallo **pueda ser contraria a la Constitucion**, planteara la cuestion al Tribunal Constitucional."

**Por que D es correcta:**
La cuestion de inconstitucionalidad **solo** puede ser planteada por los **organos judiciales** (Jueces y Tribunales). Es un mecanismo exclusivo del poder judicial cuando, en un proceso concreto, duda de la constitucionalidad de una norma con rango de ley.

**Por que las demas son incorrectas:**

- **A)** "Toda persona natural o juridica con interes legitimo". Falso para la cuestion. Estas personas estan legitimadas para el **recurso de amparo** (art. 162.1.b CE), no para la cuestion de inconstitucionalidad. Los particulares no pueden acudir directamente al TC para cuestionar leyes.

- **B)** "El Defensor del Pueblo". Falso para la cuestion. El Defensor del Pueblo esta legitimado para el **recurso de inconstitucionalidad** (art. 162.1.a CE) y el **recurso de amparo** (art. 162.1.b CE), pero no para la cuestion de inconstitucionalidad.

- **C)** "El Ministerio Fiscal". Falso para la cuestion. El Ministerio Fiscal esta legitimado para el **recurso de amparo** (art. 162.1.b CE), pero no para plantear la cuestion de inconstitucionalidad. En la cuestion, el Fiscal es **oido** (art. 35.2 LOTC) pero no la plantea.

**Cuestion vs Recurso de inconstitucionalidad:**
| Aspecto | Cuestion | Recurso |
|---------|----------|---------|
| Quien la plantea | **Solo organos judiciales** | Presidente, 50 diputados, 50 senadores, Defensor, CCAA |
| Cuando | Durante un proceso, antes de sentencia | 3 meses desde publicacion de la ley |
| Motivo | Norma con rango de ley de cuya validez depende el fallo | Inconstitucionalidad de la norma |`;

  const { error: e2 } = await supabase.from("questions").update({ explanation: exp2 }).eq("id", "ab05b08e-ec4c-42a5-b345-c85cc64a8ef1");
  console.log(e2 ? "Error 2: " + e2.message : "OK 2 - LOTC art.35 cuestion (" + exp2.length + " chars)");

  // #3 - CE art.163 cuando procede cuestion de inconstitucionalidad
  const exp3 = `**Articulo 5.3 de la Ley Organica del Poder Judicial (LOPJ):**

> "Procedera el planteamiento de la cuestion de inconstitucionalidad cuando **por via interpretativa no sea posible la acomodacion** de la norma al ordenamiento constitucional."

**Por que C es correcta:**
La cuestion de inconstitucionalidad es un mecanismo de **ultima ratio**: solo procede cuando el juez ha intentado interpretar la norma de forma compatible con la Constitucion y **no ha sido posible**. Si la norma puede "salvarse" mediante una interpretacion conforme, no se plantea la cuestion.

**Por que las demas son incorrectas:**

- **A)** "Cuando a traves de la **jurisprudencia** no pueda interpretarse". Falso: el criterio no es la jurisprudencia, sino la **via interpretativa** en general. La cuestion se plantea cuando ninguna interpretacion posible (no solo la jurisprudencial) puede hacer compatible la norma con la CE.

- **B)** "Cuando por via interpretativa **sea posible** la acomodacion". Falso: es exactamente al reves. Si la interpretacion conforme ES posible, **no** se plantea la cuestion. El juez debe aplicar la norma interpretandola conforme a la CE. Solo si eso es imposible, acude al TC.

- **D)** "Cuando a traves de la **costumbre** no pueda interpretarse". Falso: la costumbre (fuente del derecho del art. 1 del Codigo Civil) no tiene relacion con el planteamiento de la cuestion de inconstitucionalidad. El criterio es la imposibilidad de interpretacion conforme a la Constitucion, no la costumbre.

**Principio de interpretacion conforme:** Los jueces deben interpretar las normas de acuerdo con la Constitucion (art. 5.1 LOPJ). Solo cuando esto resulta imposible, procede la cuestion de inconstitucionalidad ante el TC.`;

  const { error: e3 } = await supabase.from("questions").update({ explanation: exp3 }).eq("id", "9d37675e-05e6-4692-ab3d-51e7c413d518");
  console.log(e3 ? "Error 3: " + e3.message : "OK 3 - CE art.163 cuestion procede (" + exp3.length + " chars)");
})();
