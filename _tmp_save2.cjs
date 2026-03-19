require("dotenv").config({ path: ".env.local" });
const { createClient } = require("@supabase/supabase-js");
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

(async () => {
  const explanation = `**Articulo 2.2 de la Ley 50/1997** (Ley del Gobierno):

> Art. 2.2.i): "Interponer el recurso de inconstitucionalidad."

**Por que B es correcta:**
La interposicion del recurso de inconstitucionalidad es una competencia especifica del Presidente del Gobierno recogida en el art. 2.2.i). El Presidente puede interponerlo directamente, sin necesidad de deliberacion del Consejo de Ministros.

**Por que las demas son incorrectas:**

- **A)** "El nombramiento de Ministros y Vicepresidentes" - Falso. El art. 2.2.k) dice que el Presidente **propone al Rey** el nombramiento. Quien nombra formalmente es el Rey (art. 100 CE). El Presidente propone, no nombra.

- **C)** "La creacion y supresion de organos directivos ministeriales" - Falso. El art. 2.2.j) atribuye al Presidente crear y suprimir **Departamentos Ministeriales y Secretarias de Estado**, no organos directivos inferiores. Los organos directivos (Subsecretarias, Direcciones Generales) los crea cada Ministerio.

- **D)** "La declaracion directa de los estados de alarma y excepcion" - Falso. El estado de alarma lo declara el Gobierno mediante decreto del Consejo de Ministros (art. 116.2 CE), no el Presidente directamente. El estado de excepcion requiere ademas autorizacion del Congreso (art. 116.3 CE).

**Clave:** El Presidente propone (nombramientos) e interpone (recurso de inconstitucionalidad). No confundir "proponer al Rey" con "nombrar".`;

  const { error } = await supabase
    .from("questions")
    .update({ explanation })
    .eq("id", "3fe6dda0-b00d-43a3-b125-16472eab53cc");

  if (error) console.error("Error:", error);
  else console.log("OK - Ley 50/1997 art.2 guardada (" + explanation.length + " chars)");
})();
