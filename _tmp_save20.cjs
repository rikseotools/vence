require("dotenv").config({ path: ".env.local" });
const { createClient } = require("@supabase/supabase-js");
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

(async () => {
  const explanation = `**Articulo 71 de la Constitucion Espanola** (Prerrogativas parlamentarias):

> **71.1:** "Los Diputados y Senadores gozaran de **inviolabilidad** por las opiniones manifestadas en el ejercicio de sus funciones."
> **71.2:** "Durante el periodo de su mandato gozaran de **inmunidad** y solo podran ser detenidos en caso de flagrante delito. No podran ser inculpados ni procesados sin la previa autorizacion de la **Camara respectiva**."
> **71.3:** "En las causas contra Diputados y Senadores sera competente la Sala de lo Penal del **Tribunal Supremo**."

**Por que C es correcta:**
Reproduce literalmente el art. 71.1: inviolabilidad por opiniones en el ejercicio de sus funciones.

**Por que las demas son incorrectas:**

- **A)** Dice "Sala de lo Penal de la **Audiencia Nacional**". Falso: el art. 71.3 dice **Tribunal Supremo**, no Audiencia Nacional. Es el tribunal mas alto quien juzga a parlamentarios.

- **B)** Dice que el voto es "personal, **delegable** y emitido de forma **electronica**". Falso: el art. 79.3 CE dice que el voto es "personal e **indelegable**". Ademas, no se exige forma electronica.

- **D)** Dice "autorizacion **conjunta de ambas Camaras**". Falso: el art. 71.2 dice autorizacion de "la **Camara respectiva**" (la del propio parlamentario). Un diputado necesita autorizacion del Congreso; un senador, del Senado. No se requiere autorizacion conjunta.

**Tres conceptos clave del art. 71:**
- **Inviolabilidad** (71.1): protege las opiniones (permanente)
- **Inmunidad** (71.2): protege de detencion/procesamiento (durante mandato)
- **Aforamiento** (71.3): competencia del Tribunal Supremo`;

  const { error } = await supabase
    .from("questions")
    .update({ explanation })
    .eq("id", "1a4c123e-24d3-49b7-b425-b1ac091d9991");

  if (error) console.error("Error:", error);
  else console.log("OK - CE art.71 prerrogativas (" + explanation.length + " chars)");
})();
