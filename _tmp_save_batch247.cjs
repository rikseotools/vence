require("dotenv").config({ path: ".env.local" });
const { createClient } = require("@supabase/supabase-js");
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

(async () => {
  // #1 - Ley 39/2015 art.14.3 medios electrónicos reglamentariamente
  const exp1 = `**Articulo 14.3 de la Ley 39/2015 - Obligacion de medios electronicos:**

> "**Reglamentariamente**, las Administraciones podran establecer la obligacion de relacionarse con ellas a traves de medios electronicos para determinados procedimientos y para ciertos colectivos de personas fisicas que, por razon de su **capacidad economica, tecnica, dedicacion profesional** u otros motivos, quede acreditado que tienen acceso y disponibilidad de los medios electronicos necesarios."

**Por que D es correcta (reglamentariamente):**
El art. 14.3 Ley 39/2015 permite establecer esta obligacion por via **reglamentaria** (Real Decreto, Orden Ministerial, etc.). No se requiere rango de ley ni acuerdo del Consejo de Ministros. Basta con un reglamento que acredite que el colectivo tiene acceso a medios electronicos.

**Por que las demas son incorrectas:**

- **A)** "Sera **siempre obligatoria** cualquiera que sea la persona fisica." Falso: la regla general del art. 14.1 es que las personas fisicas **pueden elegir** si se comunican electronicamente o no. Solo es obligatorio para ciertos colectivos y procedimientos (art. 14.2 y 14.3), no "siempre y para cualquiera".

- **B)** "Solo podra ser establecida por el **Consejo de Ministros**." Falso: el art. 14.3 dice "reglamentariamente", lo que permite que cualquier Administracion (no solo el Gobierno central a traves del Consejo de Ministros) pueda establecerlo mediante norma reglamentaria.

- **C)** "Solo podra ser establecida por la **Ley**." Falso: el art. 14.3 dice "reglamentariamente", no "por ley". No se requiere rango de ley; un reglamento es suficiente. La propia Ley 39/2015 habilita esta posibilidad sin exigir ley formal.

**Obligacion de medios electronicos (art. 14 Ley 39/2015):**

| Colectivo | Obligatorio | Fuente |
|-----------|------------|--------|
| Personas fisicas (general) | **No** (pueden elegir) | Art. 14.1 |
| Personas juridicas | **Si** (siempre) | Art. 14.2 |
| Empleados publicos | **Si** (siempre) | Art. 14.2 |
| Colectivos con acceso acreditado | **Si** (si se establece **reglamentariamente**) | Art. 14.3 |

**Clave:** La obligacion para ciertos colectivos de personas fisicas se establece "reglamentariamente" (art. 14.3), no por ley ni por Consejo de Ministros.`;

  const { error: e1 } = await supabase.from("questions").update({ explanation: exp1 }).eq("id", "9c487b6b-f564-4d9e-ae6e-6fecb5db82a5");
  console.log(e1 ? "Error 1: " + e1.message : "OK 1 - Ley 39/2015 art.14.3 reglamentariamente (" + exp1.length + " chars)");

  // #2 - CE art.69.3 Senadores islas Lanzarote 1 senador
  const exp2 = `**Articulo 69.3 y 69.4 de la Constitucion Espanola - Senadores insulares:**

> Art. 69.3: "En las provincias insulares [...] correspondiendo **tres** a cada una de las islas mayores -Gran Canaria, Mallorca y Tenerife- y **uno** a cada una de las siguientes islas o agrupaciones: Ibiza-Formentera, Menorca, Fuerteventura, Gomera, Hierro, **Lanzarote** y La Palma."
>
> Art. 69.4: "Las poblaciones de **Ceuta** y **Melilla** elegiran cada una de ellas **dos** Senadores."

**Por que D es correcta (Lanzarote = 1 senador):**
Segun el art. 69.3 CE, **Lanzarote** es una de las islas menores que elige **1 solo senador**. Las islas mayores (Gran Canaria, Mallorca, Tenerife) eligen 3 cada una. Lanzarote esta expresamente enumerada entre las que eligen 1.

**Por que las demas son incorrectas (tienen mas de 1 senador):**

- **A)** "**Ceuta**." Falso: Ceuta elige **2** senadores (art. 69.4 CE), no 1. Ceuta tiene un regimen especial como ciudad autonoma.

- **B)** "**Tenerife**." Falso: Tenerife es una **isla mayor** y elige **3** senadores (art. 69.3 CE), no 1.

- **C)** "**Gran Canaria**." Falso: Gran Canaria es una **isla mayor** y elige **3** senadores (art. 69.3 CE), no 1.

**Senadores por territorios insulares y ciudades autonomas:**

| Territorio | Senadores | Tipo |
|-----------|-----------|------|
| Gran Canaria | **3** | Isla mayor |
| Mallorca | **3** | Isla mayor |
| Tenerife | **3** | Isla mayor |
| Ibiza-Formentera | 1 | Isla menor |
| Menorca | 1 | Isla menor |
| Fuerteventura | 1 | Isla menor |
| **Lanzarote** | **1** | **Isla menor** |
| La Palma | 1 | Isla menor |
| Gomera | 1 | Isla menor |
| Hierro | 1 | Isla menor |
| Ceuta | **2** | Ciudad autonoma |
| Melilla | **2** | Ciudad autonoma |

**Clave:** Islas mayores (Gran Canaria, Mallorca, Tenerife) = 3 senadores. Islas menores (Lanzarote, etc.) = 1 senador. Ceuta y Melilla = 2 senadores cada una.`;

  const { error: e2 } = await supabase.from("questions").update({ explanation: exp2 }).eq("id", "fe5fa182-58ce-4d35-8ec4-8821a21f0f49");
  console.log(e2 ? "Error 2: " + e2.message : "OK 2 - CE art.69 senadores Lanzarote 1 (" + exp2.length + " chars)");

  // #3 - Ley 40/2015 art.36 audiencia responsabilidad patrimonial 10 días
  const exp3 = `**Articulo 36.3 de la Ley 40/2015 - Responsabilidad patrimonial de autoridades y personal:**

> "Asimismo, la Administracion instruira igual procedimiento a las autoridades y demas personal a su servicio por los danos y perjuicios causados en sus bienes o derechos cuando hubiera sido condenada [...] la Administracion dara **audiencia al interesado** [...] por plazo de **diez dias**."

**Por que A es correcta (10 dias):**
El art. 36 de la Ley 40/2015 establece que en los procedimientos de exigencia de responsabilidad patrimonial a autoridades y personal al servicio de las Administraciones, el tramite de audiencia tiene una duracion de **10 dias**. Este plazo permite al interesado (la autoridad o funcionario a quien se le exige la responsabilidad) presentar alegaciones antes de la resolucion.

**Por que las demas son incorrectas (plazos diferentes):**

- **B)** "**5 dias**." Falso: 5 dias no es el plazo del tramite de audiencia en este procedimiento. El plazo es de 10 dias.

- **C)** "**7 dias**." Falso: 7 dias no es el plazo establecido en el art. 36. El plazo correcto es de 10 dias.

- **D)** "**15 dias**." Falso: 15 dias es un plazo comun en otros tramites administrativos (ej: alegaciones en el procedimiento sancionador, art. 89 Ley 39/2015), pero en la audiencia de responsabilidad patrimonial del art. 36 el plazo es de 10 dias.

**Plazos en el procedimiento de responsabilidad patrimonial:**

| Tramite | Plazo | Norma |
|---------|-------|-------|
| **Audiencia al interesado** (art. 36) | **10 dias** | Ley 40/2015 |
| Resolucion reclamacion ciudadanos | 6 meses | Ley 40/2015 art. 91 |
| Prescripcion del derecho | 1 ano | Ley 40/2015 art. 67.1 |

**Clave:** Audiencia en responsabilidad patrimonial de autoridades = 10 dias (art. 36 Ley 40/2015). No confundir con los 15 dias de otros tramites administrativos.`;

  const { error: e3 } = await supabase.from("questions").update({ explanation: exp3 }).eq("id", "7f1bb901-026b-4cca-863b-bc544351882f");
  console.log(e3 ? "Error 3: " + e3.message : "OK 3 - Ley 40/2015 art.36 audiencia 10 dias (" + exp3.length + " chars)");
})();
