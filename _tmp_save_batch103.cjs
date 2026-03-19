require("dotenv").config({ path: ".env.local" });
const { createClient } = require("@supabase/supabase-js");
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

(async () => {
  // #1 - TFUE art.252 Abogados Generales TJUE conclusiones imparciales
  const exp1 = `**Articulo 252 del TFUE:**

> "La funcion del abogado general consistira en presentar **publicamente**, con toda **imparcialidad e independencia**, **conclusiones motivadas** sobre los asuntos que [...] requieran su intervencion."

**Por que B es correcta (conclusiones imparciales):**
Los Abogados Generales del TJUE no representan a ninguna parte. Su funcion es **asistir al Tribunal** presentando conclusiones motivadas, publicas e imparciales. Actuan como una especie de "consejero independiente" del Tribunal, analizando el caso y proponiendo una solucion juridica. El Tribunal no esta obligado a seguir sus conclusiones, pero suele hacerlo frecuentemente.

**Por que las demas son incorrectas (confunden la funcion del AG):**

- **A)** "Asesoran a las **Instituciones Comunitarias** en sus litigios contra los Estados miembros". Falso: los AG no asesoran a ninguna de las partes. No son abogados de las Instituciones. Son asistentes independientes e imparciales del propio Tribunal.

- **C)** "Asesoran tanto a Instituciones Comunitarias como a Estados miembros". Falso: los AG no asesoran a ninguna parte. No son abogados de nadie. Su imparcialidad e independencia es total: no representan ni a Instituciones ni a Estados.

- **D)** "Asesoran a los **Estados miembros** en sus litigios contra Instituciones Comunitarias". Falso: igual que las anteriores, los AG no asesoran a los Estados. Cada Estado tiene sus propios representantes juridicos (agentes) ante el Tribunal.

**Abogados Generales del TJUE (art. 252 TFUE):**
- **Funcion:** presentar conclusiones motivadas al Tribunal
- **Caracteristicas:** publicamente, con imparcialidad e independencia
- **NO son:** abogados de las partes (ni de Instituciones ni de Estados)
- **Numero actual:** 11 (originalmente 8, ampliado por Decision del Consejo)

**Clave:** Los AG presentan conclusiones al **Tribunal** (no asesoran a partes). Son **imparciales** e **independientes**.`;

  const { error: e1 } = await supabase.from("questions").update({ explanation: exp1 }).eq("id", "8876f13d-867c-44df-882d-ea00c5c4b284");
  console.log(e1 ? "Error 1: " + e1.message : "OK 1 - TFUE art.252 Abogados Generales (" + exp1.length + " chars)");

  // #2 - LBRL art.3 entidades locales constituirse Areas Metropolitanas
  const exp2 = `**Articulo 3 de la LBRL (Ley 7/1985):**

> "**3.1.** Son Entidades Locales **territoriales**: a) El Municipio. b) La Provincia. c) La Isla.
> **3.2.** Gozan, asimismo, de la condicion de Entidades Locales: a) Las Comarcas [...] b) Las **Areas Metropolitanas**. c) Las **Mancomunidades** de Municipios."

**Por que A es correcta (solo Areas Metropolitanas):**
La pregunta pide entidades que "**pueden constituirse con arreglo a la ley**". Esto se refiere al **art. 3.2** (entidades locales no territoriales), que son las que se crean por ley o por voluntad de los municipios. Las Areas Metropolitanas estan en el art. 3.2.b.

La clave esta en la distincion entre:
- **Art. 3.1**: Entidades **territoriales** (Municipio, Provincia, Isla) - **existen por mandato constitucional**, no se "constituyen"
- **Art. 3.2**: Entidades que **pueden constituirse** (Comarcas, Areas Metropolitanas, Mancomunidades) - se crean por ley o acuerdo

**Por que las demas son incorrectas:**

- **B)** "El Municipio". Falso: el Municipio es una entidad **territorial** del art. 3.1, no una que "se constituye con arreglo a la ley". Los municipios existen por mandato de la CE (art. 137 y 140).

- **C)** "La Provincia". Falso: la Provincia tambien es una entidad **territorial** del art. 3.1. Existe por mandato constitucional (art. 137 y 141 CE), no por constitucion voluntaria.

- **D)** "Todos los anteriores". Falso: Municipio y Provincia son territoriales (3.1), no "constituibles" (3.2). Solo las Areas Metropolitanas son del art. 3.2.

**Entidades Locales (art. 3 LBRL):**

| Art. 3.1 (Territoriales) | Art. 3.2 (Se constituyen) |
|--------------------------|---------------------------|
| Municipio | Comarcas |
| Provincia | **Areas Metropolitanas** |
| Isla | Mancomunidades |

**Clave:** "Constituirse con arreglo a la ley" = art. 3.2 (no 3.1). Municipio y Provincia son territoriales y existen por mandato constitucional.`;

  const { error: e2 } = await supabase.from("questions").update({ explanation: exp2 }).eq("id", "d1f658a8-9347-423e-95f4-90d9a56c9ce3");
  console.log(e2 ? "Error 2: " + e2.message : "OK 2 - LBRL art.3 entidades locales (" + exp2.length + " chars)");

  // #3 - CE art.168 reforma extraordinaria 2/3
  const exp3 = `**Articulo 168 de la Constitucion Espanola (reforma extraordinaria/agravada):**

> "168.1. Cuando se propusiere la revision total de la Constitucion o una parcial que afecte al Titulo Preliminar, al Capitulo segundo, Seccion primera del Titulo I, o al Titulo II, se procedera a la aprobacion del principio por **mayoria de dos tercios de cada Camara**, y a la disolucion inmediata de las Cortes."
> "168.2. Las Camaras elegidas deberan ratificar la decision y [...] debera ser aprobado por **mayoria de dos tercios** de ambas Camaras."

**Por que C es correcta (2/3 de cada Camara):**
La reforma extraordinaria (art. 168) exige **2/3** de cada Camara, tanto para aprobar el principio de reforma como para la aprobacion definitiva por las nuevas Cortes. Es el procedimiento mas rigido de la CE, con multiples garantias.

**Por que las demas son incorrectas:**

- **A)** "Consenso de cada Camara". Falso: no existe un requisito de "consenso" (unanimidad) en la CE. La CE establece mayorias cualificadas concretas (2/3), no consenso.

- **B)** "Mayoria de **3/5** de cada Camara". Falso: 3/5 es la mayoria del **art. 167** (reforma ordinaria), no del art. 168. Esta es la trampa principal: confundir las mayorias de los dos procedimientos de reforma.

- **D)** "Mayoria **absoluta** de cada Camara". Falso: la mayoria absoluta (mitad + 1) no es suficiente para la reforma extraordinaria. Se requieren 2/3, que es una mayoria superior.

**Comparacion de procedimientos de reforma:**

| Aspecto | Art. 167 (ordinaria) | Art. 168 (extraordinaria) |
|---------|---------------------|--------------------------|
| **Mayoria** | **3/5** | **2/3** |
| Disolucion Cortes | No | Si |
| Nuevas Cortes ratifican | No | Si (por 2/3) |
| Referendum | Facultativo | **Obligatorio** |

**Clave:** Art. 168 = 2/3. Art. 167 = 3/5. La trampa clasica es confundir las mayorias de ambos procedimientos.`;

  const { error: e3 } = await supabase.from("questions").update({ explanation: exp3 }).eq("id", "3b7497e2-85e1-4b49-8383-860efbc75524");
  console.log(e3 ? "Error 3: " + e3.message : "OK 3 - CE art.168 reforma 2/3 (" + exp3.length + " chars)");
})();
