require("dotenv").config({ path: ".env.local" });
const { createClient } = require("@supabase/supabase-js");
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

(async () => {
  // #1 - CE art.53.1 regulacion solo por ley - negociacion colectiva
  const exp1 = `**Articulo 53.1 de la Constitucion Espanola:**

> "Los derechos y libertades reconocidos en el **Capitulo segundo** del presente Titulo vinculan a todos los poderes publicos. Solo por **ley**, que en todo caso debera respetar su contenido esencial, podra regularse el ejercicio de tales derechos y libertades [...]"

**Por que A es correcta (negociacion colectiva laboral):**
El derecho a la negociacion colectiva laboral se recoge en el **art. 37 CE**, que esta en la **Seccion 2a del Capitulo II del Titulo I**. Segun el art. 53.1, todos los derechos del Capitulo II (Secciones 1a y 2a) solo pueden regularse por ley que respete su contenido esencial. Por tanto, la negociacion colectiva cumple esta condicion.

**Por que las demas son incorrectas (estan en el Capitulo III, no en el II):**

- **B)** "Derecho al acceso a la cultura". Esta en el **art. 44 CE**, que pertenece al **Capitulo III** (Principios rectores de la politica social y economica, arts. 39-52). El art. 53.1 NO se aplica al Capitulo III.

- **C)** "Derecho a la proteccion de la salud". Esta en el **art. 43 CE**, tambien en el **Capitulo III**. No tiene la proteccion del art. 53.1.

- **D)** "Derecho a una vivienda digna". Esta en el **art. 47 CE**, igualmente en el **Capitulo III**. Los principios rectores solo pueden ser alegados ante la jurisdiccion ordinaria segun las leyes que los desarrollen (art. 53.3).

**Niveles de proteccion de los derechos (art. 53 CE):**

| Ubicacion | Proteccion (art. 53) |
|-----------|---------------------|
| **Seccion 1a, Cap. II** (arts. 15-29) | Ley **organica** + recurso de amparo ante TC |
| **Seccion 2a, Cap. II** (arts. 30-38) | Solo por **ley** (reserva de ley) |
| **Capitulo III** (arts. 39-52) | Informan la legislacion, pero **sin reserva de ley** ni amparo |

**Clave:** Solo los derechos del **Capitulo II** (Secciones 1a y 2a) tienen reserva de ley (art. 53.1). Los principios rectores del **Capitulo III** (cultura, salud, vivienda) no.`;

  const { error: e1 } = await supabase.from("questions").update({ explanation: exp1 }).eq("id", "817a49ef-db89-4e41-b748-c5c823dac553");
  console.log(e1 ? "Error 1: " + e1.message : "OK 1 - CE art.53.1 reserva ley (" + exp1.length + " chars)");
})();
