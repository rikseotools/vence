require("dotenv").config({ path: ".env.local" });
const { createClient } = require("@supabase/supabase-js");
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

(async () => {
  // #1 - Ley 15/2022 art.40 Autoridad Independiente función que NO realiza
  const exp1 = `**Articulo 40 de la Ley 15/2022 - Funciones de la Autoridad Independiente para la Igualdad de Trato:**

> Art. 40.e): "Interesar la actuacion de la **Administracion del Estado** para sancionar las acciones u omisiones que puedan ser constitutivas de **infraccion administrativa**."
>
> Art. 40.f): "Poner en conocimiento del **Ministerio Fiscal** los hechos que puedan ser constitutivos de **infraccion penal**."

**Por que B es la funcion que NO realiza (y por tanto la respuesta):**
La opcion B dice "poner en conocimiento del **Ministerio Fiscal** los hechos que puedan ser constitutivos de **infraccion administrativa**." Falso: para las infracciones **administrativas**, la Autoridad no acude al MF sino que "interesa la actuacion de la Administracion del Estado" (art. 40.e). Solo acude al Ministerio Fiscal para infracciones **penales** (art. 40.f). La opcion B mezcla el destinatario de las penales (MF) con el tipo de infraccion (administrativa).

**Por que las demas SI son funciones de la Autoridad:**

- **A)** "Velar por el cumplimiento de la normativa [...] y formular propuestas para su modificacion." **Si es funcion**: corresponde al art. 40.a) de la Ley 15/2022.

- **C)** "Ejercitar acciones judiciales en defensa de los derechos [...]" **Si es funcion**: corresponde al art. 40.d) de la Ley 15/2022.

- **D)** "Poner en conocimiento del Ministerio Fiscal los hechos [...] de **infraccion penal**." **Si es funcion**: corresponde al art. 40.f) de la Ley 15/2022.

**Resumen de la distincion clave:**

| Tipo de infraccion | A quien acude la Autoridad |
|--------------------|---------------------------|
| **Administrativa** | **Administracion del Estado** (art. 40.e) |
| **Penal** | **Ministerio Fiscal** (art. 40.f) |

**Clave:** Infraccion administrativa = Administracion del Estado. Infraccion penal = Ministerio Fiscal. No confundir los destinatarios.`;

  const { error: e1 } = await supabase.from("questions").update({ explanation: exp1 }).eq("id", "573a3873-e3d7-420c-b1aa-572e07a2ee6d");
  console.log(e1 ? "Error 1: " + e1.message : "OK 1 - Ley 15/2022 art.40 Autoridad funciones (" + exp1.length + " chars)");

  // #2 - Ley 15/2022 art.4 derecho igualdad trato A+C correctas
  const exp2 = `**Articulo 4.1 de la Ley 15/2022 - Derecho a la igualdad de trato:**

> "El derecho protegido por la presente ley implica la **ausencia de toda discriminacion** por razon de las causas previstas en el apartado 1 del articulo 2."
>
> "En consecuencia, queda **prohibida toda disposicion, conducta, acto, criterio o practica** que atente contra el derecho a la igualdad."

**Por que D es correcta (A y C son correctas):**
El art. 4.1 contiene dos afirmaciones complementarias: (1) el derecho implica la ausencia de discriminacion (opcion A) y (2) queda prohibida toda actuacion que atente contra la igualdad (opcion C). Ambas proceden del mismo articulo y son igualmente validas.

**Analisis de cada opcion:**

- **A)** "Implica la **ausencia de toda discriminacion** por razon de las causas previstas en el art. 2.1." **Correcto**: reproduce la primera frase del art. 4.1.

- **B)** "Es un **principio informador del ordenamiento juridico** y [...] se ejecutara y aplicara con **caracter transversal**." **Incorrecto** como definicion del derecho del art. 4: esta formulacion corresponde al art. **3** de la Ley 15/2022, que habla del "principio de igualdad de trato y no discriminacion" como principio informador con aplicacion transversal. El art. 4, en cambio, define el derecho en si (ausencia de discriminacion + prohibicion de conductas).

- **C)** "Conlleva la **prohibicion de toda disposicion, conducta, acto, criterio o practica** que atente contra el derecho a la igualdad." **Correcto**: reproduce la segunda parte del art. 4.1.

- **D)** "Las respuestas A y C son correctas." **Correcto**: ambas son afirmaciones validas extraidas del art. 4.1.

**Art. 3 vs Art. 4 de la Ley 15/2022:**

| Articulo | Contenido |
|----------|-----------|
| Art. 3 | **Principio informador** del OJ, aplicacion transversal |
| **Art. 4** | **Derecho**: ausencia de discriminacion + prohibicion de conductas |

**Clave:** A y C son correctas (art. 4.1). B describe el art. 3 (principio informador), no el art. 4 (derecho).`;

  const { error: e2 } = await supabase.from("questions").update({ explanation: exp2 }).eq("id", "6e50a681-c441-43ca-8a0c-eede1dde0c8c");
  console.log(e2 ? "Error 2: " + e2.message : "OK 2 - Ley 15/2022 art.4 igualdad A+C (" + exp2.length + " chars)");

  // #3 - CE art.31.2 programación gasto público eficiencia y economía
  const exp3 = `**Articulo 31.2 de la Constitucion Espanola - Gasto publico:**

> "El gasto publico realizara una **asignacion equitativa** de los recursos publicos, y su programacion y ejecucion responderan a los criterios de **eficiencia** y **economia**."

**Por que B es correcta (eficiencia y economia):**
El art. 31.2 CE establece literalmente que la programacion y ejecucion del gasto publico responderan a criterios de **eficiencia** y **economia**. Son las dos palabras exactas que usa la Constitucion.

**Por que las demas son incorrectas (cambian las palabras):**

- **A)** "Asignacion **proporcional** y **eficacia**." Falso por dos motivos: (1) el art. 31.2 habla de asignacion "**equitativa**", no "proporcional"; (2) dice "**eficiencia**", no "eficacia". Equitativo y proporcional no son sinonimos, y eficiencia y eficacia son conceptos distintos.

- **C)** "**Eficacia** y economia." Falso: el art. 31.2 dice "**eficiencia**", no "eficacia". La eficiencia se refiere a lograr los objetivos con el menor coste posible (relacion medios-fines). La eficacia se refiere a lograr los objetivos sin atender al coste. La Constitucion elige "eficiencia" precisamente porque el gasto publico debe optimizar recursos.

- **D)** "Asignacion **proporcional** y **estabilidad presupuestaria**." Falso: ni "proporcional" ni "estabilidad presupuestaria" aparecen en el art. 31.2 CE. La estabilidad presupuestaria se incorporo en el art. 135 CE (reforma de 2011), no en el art. 31.

**Art. 31 CE completo:**

| Apartado | Contenido |
|----------|-----------|
| 31.1 | Sistema tributario justo: **igualdad, progresividad**, no confiscatorio |
| **31.2** | Gasto publico: asignacion **equitativa**, criterios de **eficiencia y economia** |
| 31.3 | Prestaciones personales/patrimoniales solo con arreglo a la ley |

**Clave:** Eficiencia (no eficacia) y economia. Asignacion equitativa (no proporcional). Son terminos literales del art. 31.2 CE.`;

  const { error: e3 } = await supabase.from("questions").update({ explanation: exp3 }).eq("id", "bf308900-961a-4013-b094-f4372a56e16f");
  console.log(e3 ? "Error 3: " + e3.message : "OK 3 - CE art.31.2 eficiencia economia (" + exp3.length + " chars)");
})();
