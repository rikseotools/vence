require("dotenv").config({ path: ".env.local" });
const { createClient } = require("@supabase/supabase-js");
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

(async () => {
  // #1 - CE art.68.6 Congreso electo convocado 25 dias
  const exp1 = `**Articulo 68.6 de la Constitucion Espanola:**

> "Las elecciones tendran lugar entre los **treinta dias y sesenta dias** desde la terminacion del mandato. El Congreso electo debera ser convocado dentro de los **veinticinco dias** siguientes a la celebracion de las elecciones."

**Por que A es correcta (25 dias):**
El art. 68.6 CE establece que tras las elecciones, el nuevo Congreso debe convocarse en un plazo maximo de **25 dias**. Es un plazo de garantia para que no haya un vacio prolongado entre la eleccion y la constitucion del nuevo Congreso.

**Por que las demas son incorrectas (confunden plazos o inventan):**

- **B)** "A los **veinte** dias". Falso: el plazo es 25 dias, no 20. Ademas, la expresion "a los 20 dias" sugiere un plazo fijo, mientras que el art. 68.6 dice "**dentro de** los 25 dias" (es un plazo maximo, no un dia concreto).

- **C)** "Dentro del **mes siguiente**". Falso: "un mes" equivaldria a 30-31 dias, pero el plazo constitucional es de 25 dias. Es mas corto que un mes.

- **D)** "Entre los **treinta dias y sesenta dias**". Falso y trampa sutil: 30-60 dias es el plazo para celebrar las **elecciones** (desde la terminacion del mandato), no para convocar el Congreso electo. La pregunta pide el plazo de convocatoria del Congreso, no el de celebracion de elecciones. Son dos plazos distintos dentro del mismo articulo.

**Los dos plazos del art. 68.6 CE:**

| Evento | Plazo |
|--------|-------|
| Celebrar **elecciones** (desde fin del mandato) | Entre 30 y 60 dias |
| Convocar **Congreso electo** (desde las elecciones) | Dentro de **25 dias** |

**Clave:** 25 dias para convocar el Congreso electo. La trampa principal (D) usa el plazo de elecciones (30-60 dias) del mismo articulo.`;

  const { error: e1 } = await supabase.from("questions").update({ explanation: exp1 }).eq("id", "4a452697-18c5-4f21-a23b-23d7b970346a");
  console.log(e1 ? "Error 1: " + e1.message : "OK 1 - CE art.68.6 Congreso 25 dias (" + exp1.length + " chars)");

  // #2 - CE art.70.2 actas credenciales control judicial
  const exp2 = `**Articulo 70.2 de la Constitucion Espanola:**

> "La validez de las actas y credenciales de los miembros de ambas Camaras estara sometida al **control judicial**, en los terminos que establezca la ley electoral."

**Por que C es correcta (control judicial):**
El art. 70.2 CE somete la validez de las actas y credenciales de diputados y senadores al **control judicial**. Esto significa que si hay impugnaciones sobre los resultados electorales o la validez de un acta, la decision final corresponde a los **tribunales** (en la practica, la Sala de lo Contencioso-Administrativo del Tribunal Supremo, segun la LOREG).

**Por que las demas son incorrectas:**

- **A)** "Control **constitucional**". Falso: el control de actas no corresponde al Tribunal Constitucional. Aunque el TC tiene funciones de control de constitucionalidad (recursos de inconstitucionalidad, amparo), la verificacion de actas electorales es competencia de la jurisdiccion **ordinaria** (judicial), no constitucional.

- **B)** "Control **popular**". Falso: no existe un mecanismo de "control popular" sobre las actas. La validez de las credenciales no se somete a votacion ciudadana ni a ningun mecanismo de participacion directa. Es un control tecnico-juridico que corresponde a los jueces.

- **D)** "Control **institucional**". Falso: "control institucional" es un concepto generico que no aparece en el art. 70.2 CE. La CE es especifica: el control es **judicial**. No de cualquier institucion, sino de los tribunales de justicia.

**Control de actas y credenciales (art. 70.2 CE):**
- **Quien controla:** los tribunales (control judicial)
- **Segun que norma:** la ley electoral (LOREG)
- **En la practica:** Sala 3a del Tribunal Supremo

**Clave:** "Control **judicial**" (no constitucional, no popular, no institucional).`;

  const { error: e2 } = await supabase.from("questions").update({ explanation: exp2 }).eq("id", "70a44bf8-1245-4748-b0ee-57b86a344023");
  console.log(e2 ? "Error 2: " + e2.message : "OK 2 - CE art.70.2 control judicial (" + exp2.length + " chars)");
})();
