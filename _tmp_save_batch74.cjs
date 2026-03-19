require("dotenv").config({ path: ".env.local" });
const { createClient } = require("@supabase/supabase-js");
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

(async () => {
  // #1 - Ley 50/1997 art.26 informe Politica Territorial
  const exp1 = `**Articulo 26.5 de la Ley 50/1997** (Informes preceptivos en elaboracion de normas):

Cuando la norma pudiera afectar a la **distribucion de competencias** entre el Estado y las CCAA, es necesario un informe previo del **Ministerio de Politica Territorial** (actualmente Ministerio de Politica Territorial y Memoria Democratica).

**Por que A es correcta:**
El art. 26.5 exige este informe preceptivo para asegurar que las nuevas normas respetan el reparto competencial Estado-CCAA. Es logico: el Ministerio de Politica Territorial es el departamento encargado de las relaciones con las Comunidades Autonomas y la coordinacion territorial.

**Por que las demas son incorrectas:**

- **B)** "Informe de la Secretaria General de Funcion Publica". Falso: la Secretaria General de Funcion Publica emite informe cuando la norma afecta al **regimen del personal** al servicio de la Administracion (empleados publicos), no cuando afecta al reparto competencial.

- **C)** "Informe del Consejo de Estado". Falso para este supuesto: el dictamen del Consejo de Estado es preceptivo para anteproyectos de ley y proyectos de reglamentos en general (art. 26.4), pero no es el informe especifico que se exige cuando afecta a la distribucion de competencias. Son informes distintos.

- **D)** "Ninguna respuesta es correcta". Falso: la opcion A es correcta.

**Informes preceptivos del art. 26 Ley 50/1997:**

| Supuesto | Informe de |
|----------|-----------|
| Afecta a **competencias Estado-CCAA** | **Ministerio de Politica Territorial** |
| Afecta al **personal** de la Administracion | Secretaria General de Funcion Publica |
| Anteproyectos de ley y reglamentos (general) | Consejo de Estado |
| Informes preceptivos (plazo general) | 10 dias (o 1 mes si es otra Administracion) |

**Clave:** Distribucion de competencias Estado-CCAA = informe del **Ministerio de Politica Territorial**.`;

  const { error: e1 } = await supabase.from("questions").update({ explanation: exp1 }).eq("id", "f32ff32f-a614-4640-a002-7110695402bb");
  console.log(e1 ? "Error 1: " + e1.message : "OK 1 - Ley 50/1997 informe competencias (" + exp1.length + " chars)");

  // #2 - CE art.113.4 mocion censura - mismo periodo de sesiones
  const exp2 = `**Articulo 113.4 de la Constitucion Espanola:**

> "Si la mocion de censura no fuere aprobada por el Congreso, sus signatarios no podran presentar otra durante el **mismo periodo de sesiones**."

**Por que D es correcta (durante el mismo periodo de sesiones):**
Si una mocion de censura es rechazada, los mismos firmantes **no pueden presentar otra** hasta que comience un nuevo periodo de sesiones. Los periodos ordinarios de sesiones son dos al ano: septiembre-diciembre y febrero-junio (art. 73 CE).

**Por que las demas son incorrectas:**

- **A)** "Durante dos periodos de sesiones". Falso: la prohibicion se limita al **mismo** periodo de sesiones, no a dos. En el siguiente periodo ya podrian presentar otra mocion.

- **B)** "En el plazo de 1 ano desde que se presento". Falso: la CE no establece un plazo temporal fijo de 1 ano. El limite es el periodo de sesiones en curso, que puede ser de pocos meses.

- **C)** "En el plazo de 6 meses desde que se rechazo". Falso: el limite no es temporal (6 meses) sino **funcional** (el mismo periodo de sesiones). Podrian pasar menos de 6 meses si el periodo de sesiones cambia.

**Datos clave de la mocion de censura (art. 113 CE):**
- Propuesta por al menos **1/10 de los Diputados** (35 diputados)
- Debe incluir un **candidato alternativo** a la Presidencia (constructiva)
- No se vota hasta pasados **5 dias** desde su presentacion
- En los **2 primeros dias** se pueden presentar mociones alternativas
- Se aprueba por **mayoria absoluta** (176 votos)
- Si se rechaza: los signatarios no pueden presentar otra en el **mismo periodo de sesiones**`;

  const { error: e2 } = await supabase.from("questions").update({ explanation: exp2 }).eq("id", "4ae8ee7a-3903-41ae-821a-8107cbdaa7c5");
  console.log(e2 ? "Error 2: " + e2.message : "OK 2 - CE art.113.4 mocion censura (" + exp2.length + " chars)");

  // #3 - CE art.30 servicio "militar" vs "civil" (senale incorrecta)
  const exp3 = `**Articulo 30.3 de la Constitucion Espanola:**

> "Podra establecerse un servicio **civil** para el cumplimiento de fines de interes general."

**Por que C es la incorrecta (y por tanto la respuesta):**
La opcion C dice: "Podra establecerse un servicio **militar** para el cumplimiento de fines de interes general."

Pero el art. 30.3 CE dice "servicio **civil**", no "servicio **militar**". La trampa esta en cambiar una sola palabra: **"civil" por "militar"**. El servicio civil es voluntario y de interes general; el servicio militar (art. 30.2) es otra cosa distinta.

**Por que las demas SI estan correctamente recogidas en el art. 30:**

- **A)** Reproduce fielmente el **art. 30.2**: la ley fijara las obligaciones militares, regulara la objecion de conciencia, las causas de exencion del servicio militar obligatorio y la prestacion social sustitutoria. **Correcto.**

- **B)** Reproduce fielmente el **art. 30.1**: "Los espanoles tienen el derecho y el **deber** de defender a Espana." **Correcto.**

- **D)** Reproduce fielmente el **art. 30.4**: "Mediante ley podran regularse los deberes de los ciudadanos en los casos de grave riesgo, catastrofe o calamidad publica." **Correcto.**

**Contenido del art. 30 CE:**
1. Derecho y **deber** de defender a Espana
2. Obligaciones militares, objecion de conciencia, prestacion social sustitutoria
3. Servicio **civil** (no militar) para fines de interes general
4. Deberes en caso de grave riesgo, catastrofe o calamidad publica

**Clave:** La trampa es el cambio de "**civil**" por "**militar**". El servicio para fines de interes general es civil, no militar.`;

  const { error: e3 } = await supabase.from("questions").update({ explanation: exp3 }).eq("id", "33040dc7-f9bb-43c5-9cf7-a92db6a4746b");
  console.log(e3 ? "Error 3: " + e3.message : "OK 3 - CE art.30 civil vs militar (" + exp3.length + " chars)");
})();
