require("dotenv").config({ path: ".env.local" });
const { createClient } = require("@supabase/supabase-js");
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

(async () => {
  // #1 - CE art.167.3 referéndum reforma ordinaria 1/10 miembros 15 días
  const exp1 = `**Articulo 167.3 de la Constitucion Espanola - Referendum en la reforma ordinaria:**

> "Aprobada la reforma por las Cortes Generales, sera sometida a referendum para su ratificacion cuando asi lo soliciten, dentro de los **quince dias** siguientes a su aprobacion, una **decima parte** de los miembros de cualquiera de las Camaras."

**Por que D es correcta (1/10 miembros, 15 dias):**
En el procedimiento **ordinario** de reforma (art. 167), el referendum es **facultativo**: solo se convoca si lo piden una decima parte (1/10) de los miembros de cualquiera de las Camaras, en el plazo de 15 dias desde la aprobacion. No confundir con la reforma agravada (art. 168), donde el referendum es obligatorio.

**Por que las demas son incorrectas:**

- **A)** "En todos los casos". Falso: en el procedimiento ordinario (art. 167), el referendum no es automatico ni obligatorio. Solo se convoca si lo solicita 1/10 de los miembros. El referendum **obligatorio** es propio de la reforma **agravada** (art. 168.3), no de la ordinaria.

- **B)** "Cincuenta diputados o cincuenta senadores, dentro de los **veinte** dias". Contiene **dos errores**: (1) el umbral no es un numero fijo (50) sino una proporcion (1/10 de los miembros de cualquiera de las Camaras); (2) el plazo es **quince** dias, no veinte.

- **C)** "**Dos quintos** de los miembros, dentro de los quince dias". Falso: acierta en el plazo (15 dias) pero yerra en la proporcion: es **una decima parte** (1/10 = 10%), no dos quintos (2/5 = 40%). Dos quintos es una proporcion mucho mayor y haria mas dificil solicitar el referendum.

**Reforma ordinaria (art. 167) vs agravada (art. 168):**

| Aspecto | Ordinaria (art. 167) | Agravada (art. 168) |
|---------|---------------------|---------------------|
| Referendum | **Facultativo** (si lo pide 1/10) | **Obligatorio** |
| Plazo solicitud | 15 dias | - |

**Clave:** Referendum facultativo: 1/10 de los miembros + 15 dias. No confundir con el referendum obligatorio de la reforma agravada.`;

  const { error: e1 } = await supabase.from("questions").update({ explanation: exp1 }).eq("id", "d490be3a-12c5-46ac-96b8-a11d928c7f06");
  console.log(e1 ? "Error 1: " + e1.message : "OK 1 - CE art.167.3 referendum reforma (" + exp1.length + " chars)");

  // #2 - Ley 4/2023 art.9 Consejo de Participación de las Personas LGTBI
  const exp2 = `**Articulo 9.1 de la Ley 4/2023 - Consejo de Participacion de las Personas LGTBI:**

> "El **Consejo de Participacion de las Personas LGTBI** es el organo de participacion ciudadana en materia de derechos y libertades de las personas LGTBI, y tiene por finalidad institucionalizar la colaboracion y fortalecer el dialogo permanente entre las Administraciones publicas y la sociedad civil."

**Por que B es correcta:**
El art. 9.1 denomina al organo exactamente como **"Consejo de Participacion de las Personas LGTBI"**. Es un organo colegiado, interministerial, de caracter consultivo, adscrito al ministerio competente en materia de igualdad.

**Por que las demas son incorrectas (nombres inventados o alterados):**

- **A)** "**Plataforma** de Participacion ciudadana en materia LGTBI". Falso: no existe tal "Plataforma" en la Ley 4/2023. El organo es un **Consejo**, no una plataforma. La trampa cambia la naturaleza juridica del organo.

- **C)** "Consejo **Estatal** de **Derechos** de las Personas LGTBI". Falso: anade "Estatal" y cambia "Participacion" por "Derechos". El nombre correcto es "Consejo de **Participacion** de las Personas LGTBI", sin el calificativo "Estatal". La trampa altera dos palabras del nombre oficial.

- **D)** "**Comision** de Participacion de las Personas LGTBI". Falso: cambia "Consejo" por "Comision". Un consejo y una comision son organos de naturaleza diferente. El art. 9 crea un **Consejo**, no una comision.

**Clave:** El nombre exacto es "**Consejo** de **Participacion** de las **Personas LGTBI**". No es "Plataforma", ni "Comision", ni "Consejo Estatal de Derechos".`;

  const { error: e2 } = await supabase.from("questions").update({ explanation: exp2 }).eq("id", "95c6441d-0779-4c42-8ea1-8d8b009fa59e");
  console.log(e2 ? "Error 2: " + e2.message : "OK 2 - Ley 4/2023 art.9 Consejo LGTBI (" + exp2.length + " chars)");

  // #3 - LCSP art.103 revisión precios suministro energía
  const exp3 = `**Articulo 103.1 de la Ley 9/2017 (LCSP) - Revision de precios:**

> "La revision periodica y predeterminada de precios solo se podra llevar a cabo en los **contratos de obra**, en los contratos de **suministros de fabricacion de armamento y equipamiento** de las Administraciones Publicas, en los contratos de **suministro de energia** y en aquellos contratos en los que el periodo de recuperacion de la inversion sea igual o superior a cinco anos."

**Por que B es correcta (suministro de energia):**
El art. 103.1 LCSP enumera de forma **tasada** los contratos que admiten revision de precios. El contrato de **suministro de energia** esta expresamente incluido, dada la volatilidad de los precios energeticos.

**Por que las demas son incorrectas:**

- **A)** "Contratos de **servicios**". Falso: los contratos de servicios en general **no** estan en la lista del art. 103.1. Solo caben en la revision de precios si su periodo de recuperacion de inversion es igual o superior a 5 anos, no por ser contratos de servicios per se.

- **C)** "Contratos de **concesion de servicios**". Falso: las concesiones de servicios tampoco figuran como categoria autonoma en el listado del art. 103.1. Podrian tener revision de precios si cumplen el criterio de recuperacion de inversion (5 anos o mas), pero no como categoria especifica.

- **D)** "Contratos con periodo de recuperacion de la inversion **superior a tres anos**". Falso: el art. 103.1 dice "**igual o superior a cinco anos**", no tres. Ademas, dice "igual o", es decir, con exactamente 5 anos ya procede. La trampa reduce el umbral de 5 a 3 anos.

**Contratos con revision de precios (art. 103.1 LCSP):**
1. Contratos de **obra**
2. Suministros de fabricacion de **armamento y equipamiento**
3. Suministro de **energia**
4. Contratos con periodo de recuperacion de inversion **igual o superior a 5 anos**

**Clave:** Suministro de energia = revision de precios. Los contratos de servicios y concesiones NO estan en la lista por defecto. Periodo de recuperacion = 5 anos (no 3).`;

  const { error: e3 } = await supabase.from("questions").update({ explanation: exp3 }).eq("id", "0cc62fcc-2f0e-4e69-8c52-0f5fc4385c05");
  console.log(e3 ? "Error 3: " + e3.message : "OK 3 - LCSP art.103 revision energia (" + exp3.length + " chars)");
})();
