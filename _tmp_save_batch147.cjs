require("dotenv").config({ path: ".env.local" });
const { createClient } = require("@supabase/supabase-js");
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

(async () => {
  // #1 - Ley 39/2015 art.87 actuaciones complementarias 15 dias
  const exp1 = `**Articulo 87 de la Ley 39/2015 (LPAC) - Actuaciones complementarias:**

> "Antes de dictar resolucion, el organo competente para resolver podra decidir, mediante acuerdo motivado, la realizacion de las actuaciones complementarias indispensables para resolver el procedimiento."

El plazo para practicar estas actuaciones es de **no superior a 15 dias**. Una vez finalizadas, los interesados disponen de **7 dias** para formular alegaciones.

**Por que C es correcta (15 dias):**
El art. 87 LPAC establece que las actuaciones complementarias deberan practicarse en un plazo no superior a **15 dias**. Durante este tiempo, se suspende el plazo para resolver el procedimiento.

**Por que las demas son incorrectas:**

- **A)** "30 dias". Falso: 30 dias no es el plazo de las actuaciones complementarias. Es un plazo habitual en otros tramites (ej: informes del art. 80.2 o plazo de resolucion de recursos), pero no el del art. 87.

- **B)** "10 dias". Falso: 10 dias es el plazo para otros tramites de la LPAC (ej: tramite de audiencia del art. 82.2, subsanacion de solicitudes del art. 68.1), pero no el de las actuaciones complementarias.

- **D)** "7 dias". Trampa: 7 dias SI aparece en el art. 87, pero es el plazo para que los interesados formulen **alegaciones** una vez realizadas las actuaciones. La pregunta pide el plazo de las propias actuaciones, que es 15 dias.

**Plazos del art. 87 LPAC:**

| Plazo | Concepto |
|-------|----------|
| **15 dias** | **Practicar las actuaciones complementarias** |
| 7 dias | Alegaciones de los interesados tras las actuaciones |

**Clave:** 15 dias para las actuaciones, 7 dias para las alegaciones. No confundir ambos plazos del mismo articulo.`;

  const { error: e1 } = await supabase.from("questions").update({ explanation: exp1 }).eq("id", "2eadf212-d3d6-4908-8ee8-80ac1280e9d9");
  console.log(e1 ? "Error 1: " + e1.message : "OK 1 - Ley 39/2015 art.87 actuaciones 15 dias (" + exp1.length + " chars)");

  // #2 - Ley 39/2015 art.69 comunicacion habilita desde presentacion
  const exp2 = `**Articulo 69.3 de la Ley 39/2015 (LPAC):**

> "Las declaraciones responsables y las comunicaciones permitiran [...] el reconocimiento o ejercicio de un derecho o bien el inicio de una actividad, **desde el dia de su presentacion**, sin perjuicio de las facultades de comprobacion, control e inspeccion que tengan atribuidas las Administraciones Publicas."

**Por que B es correcta (la comunicacion habilita desde la presentacion):**
El art. 69.3 establece que la comunicacion habilita para el ejercicio de un derecho **desde el dia de su presentacion**. No hay que esperar resolucion administrativa: la presentacion es suficiente para actuar, aunque la Administracion puede comprobar despues.

**Por que las demas son incorrectas:**

- **A)** "Ambas tienen los mismos efectos juridicos". Falso: aunque ambas permiten actuar desde la presentacion, son figuras distintas. La **declaracion responsable** implica que el interesado manifiesta bajo su responsabilidad que cumple los requisitos y se compromete a mantenerlos (art. 69.1). La **comunicacion** es simplemente poner en conocimiento de la Administracion los datos identificativos y otros requisitos (art. 69.2). Las consecuencias de su inexactitud o incumplimiento pueden diferir.

- **C)** "Solo la declaracion responsable puede ser objeto de comprobacion posterior". Falso: el art. 69.3 dice que **ambas** estan sujetas a "las facultades de comprobacion, control e inspeccion" de la Administracion. Tanto la declaracion responsable como la comunicacion pueden ser verificadas.

- **D)** "Ninguna de las dos puede ser verificada por la Administracion". Falso: exactamente lo contrario. El art. 69.3 reconoce expresamente las facultades de **comprobacion, control e inspeccion** sobre ambas figuras. Ademas, si son inexactas o falsas, pueden determinarse la imposibilidad de continuar la actividad (art. 69.4).

**Clave:** La comunicacion habilita desde el dia de presentacion (art. 69.3). Ambas son verificables por la Administracion. No tienen exactamente los mismos efectos juridicos.`;

  const { error: e2 } = await supabase.from("questions").update({ explanation: exp2 }).eq("id", "7def67fc-7c10-4af8-ab6b-42e534f2777b");
  console.log(e2 ? "Error 2: " + e2.message : "OK 2 - Ley 39/2015 art.69 comunicacion (" + exp2.length + " chars)");

  // #3 - Ley 39/2015 recursos no suspension ejecucion acto impugnado
  const exp3 = `**Articulo 117.1 de la Ley 39/2015 (LPAC):**

> "La interposicion de cualquier recurso, excepto en los casos en que una disposicion establezca lo contrario, **no suspendera la ejecucion del acto impugnado**."

**Por que B es correcta:**
El art. 117.1 LPAC consagra el principio de **ejecutividad de los actos administrativos**: recurrir un acto no paraliza su ejecucion. La Administracion puede seguir ejecutando el acto mientras se resuelve el recurso (salvo que se acuerde la suspension, art. 117.2-4).

**Por que las demas son incorrectas:**

- **A)** "Contra los actos de tramite ponen fin a la via administrativa **en todo caso** y contra ellos procede alzada y reposicion". Falso: los actos de tramite son recurribles solo en **ciertos supuestos** (art. 112.1): cuando deciden el fondo, determinan la imposibilidad de continuar, producen indefension o perjuicio irreparable. No "en todo caso". Ademas, la frase esta mal construida (confunde "actos de tramite" con "poner fin a la via administrativa").

- **C)** "Contra los actos firmes en via administrativa **no cabe interponer ningun recurso** en via administrativa". Falso: contra los actos firmes cabe el **recurso extraordinario de revision** (art. 113), cuando concurren las circunstancias del art. 125.1 (documentos nuevos, falsos, prevaricacion, etc.). La firmeza cierra los recursos ordinarios, pero no el extraordinario.

- **D)** "Contra las disposiciones administrativas de caracter general cabe... **recurso extraordinario de revision**". Falso: el art. 112.3 dice "contra las disposiciones de caracter general **no cabra recurso en via administrativa**". Ningun recurso, ni ordinario ni extraordinario. Solo cabe impugnarlas ante la jurisdiccion contencioso-administrativa.

**Recursos en via administrativa (resumen):**

| Supuesto | Recurso disponible |
|----------|-------------------|
| Actos que no agotan via | Alzada (art. 121) |
| Actos que agotan via | Reposicion potestativo (art. 123) |
| Actos firmes | Revision extraordinaria (art. 125) |
| Disposiciones generales | **Ninguno** en via administrativa |

**Clave:** Recurrir no suspende la ejecucion (art. 117.1). Contra actos firmes si cabe revision. Contra disposiciones generales no cabe ningun recurso administrativo.`;

  const { error: e3 } = await supabase.from("questions").update({ explanation: exp3 }).eq("id", "e12e4d10-6d92-45c0-9d78-3cb6ed1e1e24");
  console.log(e3 ? "Error 3: " + e3.message : "OK 3 - Ley 39/2015 recursos no suspension (" + exp3.length + " chars)");
})();
