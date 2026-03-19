require("dotenv").config({ path: ".env.local" });
const { createClient } = require("@supabase/supabase-js");
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

(async () => {
  // #1 - LOPJ art.561 plazos informes CGPJ urgencia 15 dias
  const exp1 = `**Articulo 561.2 de la Ley Organica del Poder Judicial:**

> "El Consejo General del Poder Judicial emitira su informe en el plazo improrrogable de **treinta dias**. Si en la orden de remision se hiciere constar la **urgencia** del informe, el plazo sera de **quince dias**. Excepcionalmente el organo remitente podra conceder la **prorroga** del plazo [...]. La duracion de la prorroga sera de quince dias, salvo en los casos en los que en la orden de remision se hubiere hecho constar la urgencia del informe, en cuyo caso sera de **diez dias**."

**Por que C es correcta (15 dias):**
El art. 561.2 LOPJ establece un sistema de plazos escalonado para los informes del CGPJ. Cuando hay **urgencia**, el plazo se reduce de 30 a **15 dias**. La pregunta pide expresamente el plazo "en caso de urgencia", asi que la respuesta es 15 dias.

**Por que las demas son incorrectas (confunden los distintos plazos):**

- **A)** "20 dias". Falso: no existe ningun plazo de 20 dias en el art. 561. Es un numero inventado.

- **B)** "10 dias". Falso: 10 dias es el plazo de **prorroga en caso de urgencia**, no el plazo del informe urgente en si. El informe urgente es de 15 dias; si se prorroga, se anaden 10 mas. La trampa es confundir la prorroga con el plazo principal.

- **D)** "30 dias". Falso: 30 dias es el plazo **ordinario** (sin urgencia). La pregunta pide especificamente el plazo cuando hay urgencia, que es 15 dias.

**Sistema de plazos del art. 561.2 LOPJ:**

| Situacion | Plazo informe | Prorroga |
|-----------|--------------|----------|
| **Ordinario** | 30 dias | +15 dias |
| **Urgente** | **15 dias** | +10 dias |

**Clave:** Urgencia = **15 dias**. La trampa principal es el "10 dias" (que es la prorroga urgente, no el plazo). Plazo normal = 30 dias.`;

  const { error: e1 } = await supabase.from("questions").update({ explanation: exp1 }).eq("id", "5fffe288-5e0a-49a4-ba55-ed4c5e8cf283");
  console.log(e1 ? "Error 1: " + e1.message : "OK 1 - LOPJ art.561 plazos urgencia (" + exp1.length + " chars)");

  // #2 - CE art.11.3 naturalizacion doble nacionalidad
  const exp2 = `**Articulo 11.3 de la Constitucion Espanola:**

> "El Estado podra concertar tratados de doble nacionalidad con los paises iberoamericanos o con aquellos que hayan tenido o tengan una particular vinculacion con Espana. En estos mismos paises, **aun cuando no reconozcan a sus ciudadanos un derecho reciproco**, podran naturalizarse los espanoles **sin perder su nacionalidad de origen**."

**Por que B es correcta:**
El art. 11.3 CE establece dos cosas fundamentales:
1. Los espanoles pueden naturalizarse en paises con vinculacion especial **sin perder** su nacionalidad espanola
2. Esto se aplica **incluso si** esos paises no reconocen el mismo derecho a sus ciudadanos (no se exige reciprocidad)

**Por que las demas son incorrectas:**

- **A)** "No podran naturalizarse sin perder su nacionalidad de origen". Falso: es exactamente lo contrario de lo que dice el art. 11.3. El articulo permite la naturalizacion **conservando** la nacionalidad espanola. Esta opcion niega el derecho que el articulo reconoce.

- **C)** "Podran naturalizarse **perdiendo** su nacionalidad de origen". Falso: invierte la consecuencia. El art. 11.3 dice expresamente "**sin perder** su nacionalidad de origen". La trampa es quitar el "sin" para cambiar completamente el significado.

- **D)** "Podran naturalizarse sin perder su nacionalidad, **siempre que** los citados paises reconozcan un derecho reciproco". Falso: invierte la condicion. El art. 11.3 dice "**aun cuando no reconozcan**" (no se exige reciprocidad). La opcion D exige reciprocidad como condicion obligatoria, que es justo lo contrario.

**Naturalizacion de espanoles en paises vinculados (art. 11.3 CE):**
- Pueden naturalizarse **sin perder** la nacionalidad espanola
- **No** se exige reciprocidad del otro pais
- Paises: iberoamericanos o con vinculacion especial con Espana

**Clave:** "Sin perder" + "aun cuando no reconozcan reciprocidad". Las trampas invierten una o ambas condiciones.`;

  const { error: e2 } = await supabase.from("questions").update({ explanation: exp2 }).eq("id", "46ba82fb-ae95-4a51-b151-5f2f24956572");
  console.log(e2 ? "Error 2: " + e2.message : "OK 2 - CE art.11.3 naturalizacion (" + exp2.length + " chars)");

  // #3 - CE art.15 pena de muerte
  const exp3 = `**Articulo 15 de la Constitucion Espanola:**

> "Todos tienen derecho a la vida y a la integridad fisica y moral, sin que, en ningun caso, puedan ser sometidos a tortura ni a penas o tratos inhumanos o degradantes. Queda abolida la pena de muerte, **salvo lo que puedan disponer las leyes penales militares para tiempos de guerra**."

**Por que A es correcta:**
La opcion A reproduce literalmente el art. 15 CE completo. Este articulo tiene dos partes:
1. Derecho a la vida e integridad + prohibicion absoluta de tortura
2. Abolicion de la pena de muerte con una unica excepcion: leyes penales **militares** para tiempos de **guerra**

**Nota historica:** Esta excepcion fue suprimida por la LO 11/1995, por lo que actualmente la pena de muerte esta abolida sin excepcion. Pero la pregunta pide la redaccion literal del art. 15 CE, que mantiene esa salvedad en su texto.

**Por que las demas son incorrectas:**

- **B)** "Salvo cuando las **Cortes Generales** la estimen conveniente". Falso: el art. 15 CE no otorga a las Cortes Generales la facultad de restablecer la pena de muerte. La unica excepcion (ya eliminada) era para leyes penales militares en tiempos de guerra, no una decision discrecional de las Cortes.

- **C)** "Queda abolida la pena de muerte" (sin excepcion). Falso: aunque en la practica actual es asi (tras la LO 11/1995), el **texto literal** del art. 15 CE incluye la salvedad "salvo lo que puedan disponer las leyes penales militares para tiempos de guerra". La pregunta pide la redaccion del articulo.

- **D)** "Salvo cuando se declaren los Estados de Alarma, Excepcion y Sitio". Falso: los estados del art. 116 CE no tienen relacion con la pena de muerte. La excepcion del art. 15 se refiere a "tiempos de guerra" en el ambito militar, no a los estados excepcionales.

**Art. 15 CE - dos garantias:**
1. Derecho a la vida + prohibicion de tortura (sin excepciones)
2. Abolicion pena de muerte (excepcion textual: leyes militares en guerra, ya eliminada por LO 11/1995)

**Clave:** La redaccion literal incluye "salvo leyes penales militares para tiempos de guerra". No confundir con Cortes Generales (B), abolicion total (C) o estados excepcionales (D).`;

  const { error: e3 } = await supabase.from("questions").update({ explanation: exp3 }).eq("id", "f6036dce-0cf8-4a84-a386-f0d2b321f688");
  console.log(e3 ? "Error 3: " + e3.message : "OK 3 - CE art.15 pena de muerte (" + exp3.length + " chars)");
})();
