require("dotenv").config({ path: ".env.local" });
const { createClient } = require("@supabase/supabase-js");
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

(async () => {
  // #1 - CE art.159.1 TC miembros propuesta CGPJ = 2
  const exp1 = `**Articulo 159.1 de la Constitucion Espanola - Composicion del Tribunal Constitucional:**

> "El Tribunal Constitucional se compone de **12 miembros** nombrados por el Rey; de ellos, **cuatro** a propuesta del **Congreso** por mayoria de tres quintos; **cuatro** a propuesta del **Senado**, con identica mayoria; **dos** a propuesta del **Gobierno**, y **dos** a propuesta del **Consejo General del Poder Judicial**."

**Por que B es correcta (dos miembros):**
El art. 159.1 CE establece que el CGPJ propone **2** de los 12 magistrados del TC. Es el mismo numero que propone el Gobierno (2), mientras que el Congreso y el Senado proponen 4 cada uno.

**Por que las demas son incorrectas:**

- **A)** "**Uno**." Falso: el CGPJ propone 2 magistrados, no 1. Ningun organo propone un solo miembro del TC.

- **C)** "**Cuatro**." Falso: proponen 4 miembros el **Congreso** y el **Senado** (cada uno), no el CGPJ. El CGPJ solo propone 2.

- **D)** "**Ocho**." Falso: 8 es la suma de los propuestos por Congreso (4) y Senado (4), pero ningun organo individual propone 8 miembros.

**Composicion del TC (art. 159.1 CE) - 12 magistrados:**

| Organo proponente | N.o magistrados | Mayoria requerida |
|-------------------|----------------|-------------------|
| Congreso de los Diputados | **4** | 3/5 |
| Senado | **4** | 3/5 |
| Gobierno | **2** | - |
| **CGPJ** | **2** | - |
| **Total** | **12** | |

**Regla mnemotecnica:** 4 + 4 + 2 + 2 = 12. Las Camaras (Congreso + Senado) proponen 8 (2/3 del total). Gobierno + CGPJ proponen 4 (1/3).

**Clave:** CGPJ propone 2 magistrados del TC. Congreso y Senado proponen 4 cada uno. Gobierno propone 2.`;

  const { error: e1 } = await supabase.from("questions").update({ explanation: exp1 }).eq("id", "0c6eb906-9b85-45b0-94e0-971c671cd133");
  console.log(e1 ? "Error 1: " + e1.message : "OK 1 - CE art.159 TC CGPJ 2 miembros (" + exp1.length + " chars)");

  // #2 - LO 3/2018 art.54 auditoría preventiva AEPD
  const exp2 = `**Articulo 54 de la LO 3/2018 (LOPDGDD) - Planes de auditoria:**

> Art. 54.1: "La Presidencia de la Agencia Espanola de Proteccion de Datos podra acordar la realizacion de planes de **auditoria preventiva**, referidos a los tratamientos de un sector concreto de actividad."
>
> Art. 54.2: "A resultas de los planes de auditoria, la Presidencia [...] podra dictar las **directrices generales o especificas** [...]"

**Por que D es correcta (auditoria preventiva):**
El art. 54.1 LOPDGDD establece que la Presidencia de la AEPD puede acordar planes de **"auditoria preventiva"**. Este es el termino exacto que usa la ley. El adjetivo "preventiva" indica que estas auditorias se realizan para verificar el cumplimiento de forma proactiva, antes de que se produzcan infracciones.

**Por que las demas son incorrectas:**

- **A)** "**Directrices** generales o especificas." Falso como respuesta a la pregunta: las directrices generales o especificas son el **resultado** de los planes de auditoria (art. 54.2), no lo que la Presidencia acuerda realizar. La pregunta pide que se acuerda realizar, y la respuesta es "auditoria preventiva", no directrices.

- **B)** "**Auditoria general**." Falso: el art. 54.1 dice "auditoria **preventiva**", no "auditoria general". La diferencia de adjetivo es la trampa: "preventiva" implica caracter proactivo, mientras que "general" sugeriria un alcance mas amplio pero sin el matiz preventivo.

- **C)** "**Fiscalizacion previa**." Falso: el termino "fiscalizacion previa" no aparece en el art. 54. La fiscalizacion previa es un concepto propio del control presupuestario (Intervencion General), no de la proteccion de datos.

**Planes de auditoria de la AEPD (art. 54 LOPDGDD):**

| Aspecto | Detalle |
|---------|---------|
| Quien acuerda | **Presidencia de la AEPD** |
| Que acuerda | Planes de **auditoria preventiva** |
| Ambito | Sector concreto de actividad |
| Resultado | Directrices generales o especificas |
| Caracter de directrices | **Obligado cumplimiento** (art. 54.3) |

**Clave:** La AEPD realiza "auditoria preventiva" (art. 54.1), no "auditoria general" ni "fiscalizacion previa". Las directrices son el resultado, no el objeto de la auditoria.`;

  const { error: e2 } = await supabase.from("questions").update({ explanation: exp2 }).eq("id", "d1f1728a-f350-47d2-be21-f093ee6d629a");
  console.log(e2 ? "Error 2: " + e2.message : "OK 2 - LO 3/2018 art.54 auditoria preventiva (" + exp2.length + " chars)");
})();
