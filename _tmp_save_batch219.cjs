require("dotenv").config({ path: ".env.local" });
const { createClient } = require("@supabase/supabase-js");
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

(async () => {
  // #1 - LOPJ art.95 Sección Instrucción Tribunal Central Instancia
  const exp1 = `**Articulo 95.a) de la LO 6/1985 (LOPJ) - Tribunal Central de Instancia:**

> Art. 95.a): "Seccion de Instruccion, que instruira las causas cuyo enjuiciamiento corresponda a la Sala de lo Penal de la Audiencia Nacional [...] Igualmente, conoceran de las **impugnaciones** que establezca la ley contra los **decretos de los Fiscales europeos delegados**."

**Por que C es correcta (Seccion de Instruccion del Tribunal Central de Instancia):**
El art. 95.a) LOPJ atribuye a la **Seccion de Instruccion** del Tribunal Central de Instancia el conocimiento de las impugnaciones contra los decretos de los Fiscales europeos delegados. Esta competencia se enmarca en el ambito de los jueces de garantias que controlan la actuacion de la Fiscalia Europea en Espana.

**Por que las demas son incorrectas:**

- **A)** "La **Sala de lo Penal** de la Audiencia Nacional." Falso: la Sala de lo Penal de la AN enjuicia las causas instruidas por la Seccion de Instruccion, pero no conoce de las impugnaciones contra decretos de Fiscales europeos delegados. Son funciones distintas.

- **B)** "La **Seccion de lo Penal** del Tribunal Central de Instancia." Falso: la Seccion de lo Penal tiene competencias de enjuiciamiento, no de control de la actuacion de los Fiscales europeos. Las impugnaciones corresponden a la Seccion de Instruccion.

- **D)** "La **Sala de Apelacion** de la Audiencia Nacional." Falso: la Sala de Apelacion conoce de los recursos contra resoluciones dictadas en primera instancia por la Sala de lo Penal, no de las impugnaciones contra decretos de Fiscales europeos.

**Secciones del Tribunal Central de Instancia (art. 95 LOPJ):**

| Seccion | Competencias principales |
|---------|--------------------------|
| **Instruccion** | Instruir causas + **impugnaciones decretos Fiscales europeos** |
| Penal | Enjuiciamiento de determinadas causas |

**Clave:** Impugnaciones contra decretos de Fiscales europeos delegados = Seccion de Instruccion del Tribunal Central de Instancia.`;

  const { error: e1 } = await supabase.from("questions").update({ explanation: exp1 }).eq("id", "5e22f494-a138-4ada-8b97-f6b50e915077");
  console.log(e1 ? "Error 1: " + e1.message : "OK 1 - LOPJ art.95 Fiscales europeos (" + exp1.length + " chars)");

  // #2 - Ley 39/2015 art.73 trámites admisión antes o dentro del día
  const exp2 = `**Articulo 73.3 de la Ley 39/2015 (LPAC) - Cumplimiento de tramites por los interesados:**

> "A los interesados que no cumplan lo dispuesto en los apartados anteriores, se les podra declarar decaidos en su derecho al tramite correspondiente. No obstante, se admitira la actuacion del interesado y producira sus efectos legales, si se produjera **antes o dentro del dia** que se notifique la resolucion en la que se tenga por transcurrido el plazo."

**Por que D es correcta (antes o dentro del dia de notificacion):**
El art. 73.3 establece que la actuacion tardia del interesado sera admitida si se realiza **antes** de la notificacion **o dentro del mismo dia** en que se notifique la resolucion de decaimiento. Es decir, el interesado tiene hasta el final del dia de la notificacion para presentar su actuacion con plenos efectos.

**Por que las demas son incorrectas:**

- **A)** "Se le declarara decaido en su derecho al tramite, **en todo caso**." Falso: el art. 73.3 dice "se les **podra** declarar decaidos", no que se hara "en todo caso". Ademas, aunque se declare el decaimiento, la actuacion se admite si se presenta antes o dentro del dia de la notificacion. "En todo caso" elimina la excepcion que contempla la ley.

- **B)** "Se le concedera, a su solicitud, una **ampliacion del plazo**." Falso: el art. 73 no preve una ampliacion automatica del plazo por solicitud del interesado en este supuesto. La ampliacion de plazos se regula en el art. 32, pero es un mecanismo distinto y previo al decaimiento.

- **C)** "Se admitira [...] si se produjera **unicamente antes del dia** que se notifique la resolucion." Falso: dice "unicamente antes", pero el art. 73.3 dice "antes **o dentro del dia**". La diferencia es crucial: "antes del dia" excluye el propio dia de la notificacion; "antes o dentro del dia" incluye ese dia completo.

**Art. 73.3 - Decaimiento y salvedad:**

| Supuesto | Consecuencia |
|----------|-------------|
| Incumplimiento del tramite | Se **podra** declarar decaido (no automatico) |
| Actuacion antes de la notificacion | Se admite con plenos efectos |
| Actuacion **dentro del dia** de notificacion | Se admite con plenos efectos |
| Actuacion despues del dia de notificacion | No se admite |

**Clave:** "Antes **o dentro del dia**" de la notificacion. La opcion C falla al decir "unicamente antes", excluyendo el dia de la notificacion.`;

  const { error: e2 } = await supabase.from("questions").update({ explanation: exp2 }).eq("id", "368ac75d-9074-44f4-bbf0-b999d5f7421d");
  console.log(e2 ? "Error 2: " + e2.message : "OK 2 - Ley 39/2015 art.73 decaimiento (" + exp2.length + " chars)");

  // #3 - LOPJ art.87 Mercantil concurso, INCORRECTA revisión AAPP autotutela
  const exp3 = `**Articulo 87.7.c) de la LO 6/1985 (LOPJ) - Jurisdiccion del juez del concurso (persona juridica):**

> Art. 87.7.c).2.a in fine: "En todo caso, quedara **excluida** de esta jurisdiccion la **revision de las acciones de responsabilidad** que ejerzan las **Administraciones Publicas** en el ejercicio de su **autotutela**."

**Por que C es la afirmacion INCORRECTA (y por tanto la respuesta):**
La opcion C ("la revision de las acciones de responsabilidad que ejerzan las AAPP en el ejercicio de su autotutela") NO es competencia exclusiva del juez del concurso. Al contrario, el art. 87.7.c).2.a expresamente la **excluye** de la jurisdiccion concursal. Las AAPP actuan con autotutela (pueden ejecutar sus propias decisiones sin acudir a los tribunales), y esa potestad no queda sometida al juez del concurso.

**Por que las demas SI son competencia exclusiva del juez del concurso:**

- **A)** "Acciones de responsabilidad civil contra la persona natural designada para el cargo de **administrador persona juridica**." **Si es exclusiva**: incluida en el art. 87.7.c).2.a.

- **B)** "Acciones de responsabilidad contra los **auditores** por danos a la persona juridica concursada." **Si es exclusiva**: incluida en el art. 87.7.c).3.a.

- **D)** "Acciones de reclamacion de **deudas sociales** contra socios subsidiariamente responsables." **Si es exclusiva**: incluida en el art. 87.7.c).1.a.

**Jurisdiccion exclusiva del juez del concurso (persona juridica):**

| Materia | Exclusiva |
|---------|-----------|
| Deudas sociales contra socios responsables | Si (1.a) |
| Responsabilidad de administradores | Si (2.a) |
| Responsabilidad de auditores | Si (3.a) |
| **Revision de acciones AAPP (autotutela)** | **No - expresamente excluida** |

**Clave:** La autotutela de las AAPP queda fuera de la jurisdiccion del juez del concurso. Es la unica exclusion expresa del art. 87.7.c).`;

  const { error: e3 } = await supabase.from("questions").update({ explanation: exp3 }).eq("id", "d132103c-e60a-41d7-9e4b-2adce6335d0c");
  console.log(e3 ? "Error 3: " + e3.message : "OK 3 - LOPJ art.87 Mercantil autotutela (" + exp3.length + " chars)");
})();
