require("dotenv").config({ path: ".env.local" });
const { createClient } = require("@supabase/supabase-js");
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

(async () => {
  // #1 - LBRL art.33 Pleno Diputacion control y fiscalizacion no delegable
  const exp1 = `**Articulo 33 de la Ley 7/1985 (LBRL) - Competencias del Pleno de la Diputacion:**

> Art. 33.2: "Corresponde en todo caso al Pleno: [...] n) **El control y la fiscalizacion de los organos de gobierno**."
>
> Art. 33.4: "Son igualmente atribuibles a la Junta de Gobierno las competencias que el Pleno le delegue, con excepcion de las enumeradas en el apartado 2, **parrafos a), b), c), d), e), f), g), h) y n)**."

**Por que A es la competencia NO delegable (y por tanto la respuesta):**
El control y la fiscalizacion de los organos de gobierno (parrafo n del art. 33.2) esta expresamente **excluido de la delegacion** en el art. 33.4. Tiene logica: el Pleno es el organo de control por excelencia y no puede delegar su propia funcion de vigilancia.

**Por que las demas SI son delegables:**

- **B)** "Aprobacion de proyectos de obra y de servicios cuando sea competente para su contratacion y no esten previstos en los Presupuestos". Esta competencia (art. 33.2.**i**) **no** esta en la lista de exclusiones del art. 33.4, por lo que **si** es delegable a la Junta de Gobierno.

- **C)** "Declaracion de lesividad de los actos de la Diputacion". Esta competencia (art. 33.2.**j**) tampoco aparece en las exclusiones del art. 33.4, por lo que **si** es delegable.

- **D)** "Ejercicio de acciones judiciales y administrativas y defensa de la Corporacion". Esta competencia (art. 33.2.**k**) tampoco esta excluida de la delegacion.

**Competencias no delegables del Pleno (art. 33.4):**
Las de los parrafos a) a h) y n): organizacion, ordenanzas, presupuestos, planes, plantilla, alteracion de calificacion juridica de bienes, enajenacion de patrimonio, operaciones de credito y **control/fiscalizacion**.

**Clave:** El control y la fiscalizacion (n) es indelegable. La aprobacion de proyectos (i), la declaracion de lesividad (j) y las acciones judiciales (k) si son delegables.`;

  const { error: e1 } = await supabase.from("questions").update({ explanation: exp1 }).eq("id", "ddbb91a9-e649-40b0-933f-587b2f2729f3");
  console.log(e1 ? "Error 1: " + e1.message : "OK 1 - LBRL art.33 Pleno no delegable (" + exp1.length + " chars)");

  // #2 - LCSP art.103 revision precios periodo recuperacion inversion 5 anos
  const exp2 = `**Articulo 103.1 de la Ley 9/2017 (LCSP) - Revision de precios:**

> "La revision periodica y predeterminada de precios solo se podra llevar a cabo en los **contratos de obra**, en los contratos de **suministros de fabricacion de armamento y equipamiento** de las Administraciones Publicas, en los contratos de **suministro de energia** y en aquellos contratos en los que el **periodo de recuperacion de la inversion sea igual o superior a cinco anos**."

**Por que A es correcta (igual o superior a cinco anos):**
El art. 103.1 LCSP enumera los contratos que pueden tener revision de precios. El ultimo supuesto es un criterio general: cualquier contrato cuyo **periodo de recuperacion de la inversion** sea **igual o superior a 5 anos**. Esto cubre contratos de larga duracion donde la inversion inicial es tan elevada que necesita al menos 5 anos para amortizarse.

**Por que las demas son incorrectas (plazos menores o diferentes):**

- **B)** "Superior a tres anos". Falso: el art. 103 dice "cinco anos", no "tres anos". Ademas, dice "**igual o** superior", no solo "superior". El matiz "igual o" es importante: con exactamente 5 anos ya procede la revision.

- **C)** "Igual o superior a tres anos". Falso: acierta en incluir "igual o superior" pero yerra en el plazo (3 anos en vez de 5). Tres anos no es el umbral que establece la ley.

- **D)** "Igual o superior a dos anos". Falso: dos anos aparece en otro contexto del art. 103: es el plazo minimo de ejecucion del contrato para que proceda la revision (**2 anos desde la formalizacion**). Pero eso es el requisito temporal de la ejecucion, no el periodo de recuperacion de la inversion. La trampa confunde dos plazos diferentes del mismo articulo.

**Clave:** Periodo de recuperacion de inversion = **5 anos** (igual o superior). No confundir con los 2 anos de ejecucion necesarios para que proceda la revision.`;

  const { error: e2 } = await supabase.from("questions").update({ explanation: exp2 }).eq("id", "66cfe09e-77f8-4ed7-9349-51bbc9bbe1fa");
  console.log(e2 ? "Error 2: " + e2.message : "OK 2 - LCSP art.103 revision precios 5 anos (" + exp2.length + " chars)");

  // #3 - LCSP art.307 resolucion suministros devolucion reciproca
  const exp3 = `**Articulo 307 de la Ley 9/2017 (LCSP) - Efectos de la resolucion del contrato de suministros:**

> Art. 307.1: "La resolucion del contrato dara lugar a la **reciproca devolucion** de los bienes y del importe de los pagos realizados, y, **cuando no fuera posible o conveniente** para la Administracion, habra de abonar esta el precio de los efectivamente entregados y recibidos de conformidad."
>
> Art. 307.2: "Solo tendra derecho el contratista a percibir [...] una indemnizacion del **3 por ciento** del precio de la adjudicacion del contrato, **IVA excluido**."

**Por que A es correcta:**
La opcion A reproduce fielmente el art. 307.1: devolucion reciproca de bienes y pagos, y si no es posible, la Administracion paga lo efectivamente entregado. Es el efecto principal de la resolucion.

**Por que las demas son incorrectas:**

- **B)** Dice "**6 por ciento**" del precio de adjudicacion. Falso: el art. 307.2 dice **3 por ciento**, no 6. La trampa duplica el porcentaje de indemnizacion.

- **C)** Contiene **dos errores**: (1) dice "**6 por ciento**" en vez de 3; (2) dice "**IVA incluido**" en vez de "**IVA excluido**". El art. 307.2 es claro: 3% del precio de adjudicacion, IVA excluido. Ademas, califica el 6% como "beneficio industrial" cuando el articulo solo habla de "indemnizacion".

- **D)** Dice "**en ningun caso** la Administracion habra de abonar el precio". Falso: es exactamente lo contrario. El art. 307.1 dice que "**cuando no fuera posible o conveniente**" la devolucion, la Administracion **si** debe pagar. La trampa invierte el sentido del articulo.

**Clave:** Devolucion reciproca (regla general). Si no es posible, la Administracion paga lo entregado. Indemnizacion por desistimiento: **3%** (no 6%), **IVA excluido** (no incluido).`;

  const { error: e3 } = await supabase.from("questions").update({ explanation: exp3 }).eq("id", "2a9a73c1-57eb-4a83-ad75-a894903b8a77");
  console.log(e3 ? "Error 3: " + e3.message : "OK 3 - LCSP art.307 resolucion suministros (" + exp3.length + " chars)");
})();
