require("dotenv").config({ path: ".env.local" });
const { createClient } = require("@supabase/supabase-js");
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

(async () => {
  // #1 - CE art.1.1 valores superiores (otra pregunta distinta a la anterior)
  const exp1 = `**Articulo 1.1 de la Constitucion Espanola:**

> "Espana se constituye en un Estado social y democratico de Derecho, que propugna como **valores superiores** de su ordenamiento juridico la libertad, la justicia, la igualdad y el pluralismo politico."

**Por que B es correcta:**
El art. 1.1 CE los define como **"valores superiores"**, no como "principios". La terminologia exacta es fundamental en las oposiciones: la CE habla de valores, no de principios, en este articulo concreto.

**Por que las demas son incorrectas:**

- **A)** "Principios superiores del ordenamiento juridico". Falso: el art. 1.1 dice "**valores** superiores", no "principios superiores". Es un error terminologico sutil pero clave.

- **C)** "Principios de los que emana la soberania nacional". Falso por dos motivos: (1) no son "principios" sino "valores"; (2) la soberania nacional reside en el pueblo espanol (art. 1.2), no emana de estos valores.

- **D)** "Principios generales del ordenamiento juridico". Falso: de nuevo usa "principios" en lugar de "valores". Los principios generales del Derecho son una fuente del derecho (art. 1.4 Codigo Civil), concepto distinto de los valores superiores del art. 1.1 CE.

**Clave:** El art. 1.1 CE usa la palabra **"valores"**, no "principios". Todas las opciones incorrectas sustituyen "valores" por "principios" para confundir.`;

  const { error: e1 } = await supabase.from("questions").update({ explanation: exp1 }).eq("id", "b79df96f-0e3e-492b-8996-c2282dd39564");
  console.log(e1 ? "Error 1: " + e1.message : "OK 1 - CE art.1.1 valores (" + exp1.length + " chars)");

  // #2 - CE art.167 reforma constitucional ordinaria
  const exp2 = `**Articulo 167 de la Constitucion Espanola** (Reforma constitucional ordinaria):

> **167.1:** Aprobacion por **mayoria de 3/5** de cada Camara. Sin acuerdo: Comision paritaria.
> **167.2:** Si no se logra, el Congreso por **2/3** puede aprobar si el Senado dio mayoria absoluta.
> **167.3:** "Aprobada la reforma por las Cortes Generales, sera sometida a **referendum** para su ratificacion cuando asi lo soliciten, dentro de los **quince dias** siguientes a su aprobacion, una **decima parte** de los miembros de cualquiera de las Camaras."

El derecho a la propiedad privada (art. 33 CE, Seccion 2a Cap. II) no esta protegido por el art. 168 (que solo cubre el Titulo Preliminar, Seccion 1a Cap. II y Titulo II), por lo que se reforma por el **art. 167** (procedimiento ordinario).

**Por que D es correcta:**
Reproduce literalmente el art. 167.3: referendum facultativo si lo pide 1/10 de los miembros de cualquiera de las Camaras dentro de 15 dias.

**Por que las demas son incorrectas:**

- **A)** "Reforma por iniciativa popular con 500.000 firmas". Falso: el art. 166 CE excluye expresamente la iniciativa popular de la reforma constitucional (remite al art. 87.1 y 87.2, no al 87.3). Las 500.000 firmas son para la iniciativa legislativa popular (art. 87.3), no para reforma.

- **B)** "Aprobacion por 2/3 de cada Camara y disolucion inmediata". Esto describe el procedimiento del **art. 168** (agravado), no el 167. El art. 167 exige 3/5 y no requiere disolucion de las Cortes.

- **C)** "Disueltas las Cortes, las nuevas Camaras ratifican por 3/5". De nuevo describe el **art. 168** (agravado). En el art. 167 no hay disolucion ni nuevas Camaras.

**Reforma ordinaria (167) vs agravada (168):**

| | Art. 167 (ordinario) | Art. 168 (agravado) |
|---|---|---|
| Mayoria | 3/5 | 2/3 + disolucion + 2/3 |
| Referendum | Facultativo (si 1/10 lo pide) | Obligatorio |
| Ambito | Todo lo no protegido por 168 | Titulo Preliminar, Sec.1a Cap.II, Titulo II |`;

  const { error: e2 } = await supabase.from("questions").update({ explanation: exp2 }).eq("id", "bed9017f-87f4-4be8-bd5a-a334bfa83472");
  console.log(e2 ? "Error 2: " + e2.message : "OK 2 - CE art.167 reforma (" + exp2.length + " chars)");

  // #3 - CE art.149.1.29a seguridad publica
  const exp3 = `**Articulo 149.1.29a de la Constitucion Espanola** (Seguridad publica):

> **149.1.29a:** "Seguridad publica, sin perjuicio de la posibilidad de creacion de policias por las Comunidades Autonomas en la forma que se establezca en los respectivos Estatutos en el marco de lo que disponga **una ley organica**."

**La pregunta pide la respuesta INCORRECTA.**

**Por que A es incorrecta (y por tanto la respuesta correcta):**
La opcion A dice "en el marco de lo que disponga **reglamentariamente**". Falso: el art. 149.1.29a dice "en el marco de lo que disponga una **ley organica**". La diferencia es fundamental: una ley organica requiere mayoria absoluta del Congreso (art. 81 CE), mientras que un reglamento es una norma del Gobierno de rango inferior. La creacion de policias autonomicas se regula por LO, no por reglamento.

**Por que las demas SI son competencias exclusivas del Estado:**

- **B)** "Regulacion de las condiciones de obtencion, expedicion y homologacion de titulos academicos y profesionales" - Art. 149.1.30a CE. Correcto literalmente.

- **C)** "Bases y coordinacion general de la sanidad" - Art. 149.1.16a CE. Correcto literalmente.

- **D)** "Defensa del patrimonio cultural, artistico y monumental espanol contra la exportacion y la expoliacion" - Art. 149.1.28a CE. Correcto literalmente.

**Clave:** El error esta en una sola palabra: **"reglamentariamente"** en lugar de **"una ley organica"**. Este tipo de trampa es muy habitual en examenes de oposicion: cambian una palabra del articulo para ver si el opositor lo ha memorizado con precision.`;

  const { error: e3 } = await supabase.from("questions").update({ explanation: exp3 }).eq("id", "d3b841c7-3bc0-44ba-9782-a7a6a0845433");
  console.log(e3 ? "Error 3: " + e3.message : "OK 3 - CE art.149.29 seguridad (" + exp3.length + " chars)");
})();
