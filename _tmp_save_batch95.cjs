require("dotenv").config({ path: ".env.local" });
const { createClient } = require("@supabase/supabase-js");
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

(async () => {
  // #1 - Ley 39/2015 art.54 formas inicio procedimiento
  const exp1 = `**Articulo 54 de la Ley 39/2015:**

> "Los procedimientos podran iniciarse **de oficio** o **a solicitud del interesado**."

**Por que C es correcta (de oficio o a solicitud del interesado):**
El art. 54 es taxativo: solo hay **dos** formas de iniciar un procedimiento administrativo:
1. **De oficio**: por iniciativa de la propia Administracion (art. 58: iniciativa propia, orden superior, peticion razonada de otros organos, o denuncia)
2. **A solicitud del interesado**: cuando el ciudadano lo pide (art. 66)

**Por que las demas son incorrectas:**

- **A)** "Siempre sera necesario una instancia por escrito del ciudadano". Falso: no siempre es necesaria la iniciativa del ciudadano. Los procedimientos tambien pueden iniciarse **de oficio** (por la propia Administracion). Muchos procedimientos (sancionadores, de inspeccion, de oficio) se inician sin que el ciudadano lo pida.

- **B)** "De oficio, a instancia de parte o mediante **denuncia**". Falso: la denuncia no es una tercera forma de iniciacion independiente. La denuncia es una de las formas en que se puede iniciar un procedimiento **de oficio** (art. 58.2), pero no es una via autonoma. El art. 54 solo lista dos formas, no tres.

- **D)** "De oficio, **en todo caso**". Falso: no todos los procedimientos se inician de oficio. Muchos requieren la solicitud del interesado (ej: solicitar una licencia, pedir una subvencion, iniciar un recurso). "En todo caso" elimina la segunda via (solicitud del interesado).

**Formas de inicio del procedimiento (art. 54):**
- **De oficio** (incluye: iniciativa propia, orden superior, peticion razonada, denuncia)
- **A solicitud del interesado**

**Clave:** Solo hay dos formas. La denuncia NO es una tercera via independiente (esta dentro del "de oficio"). "Siempre" y "en todo caso" son palabras trampa que limitan a una sola via.`;

  const { error: e1 } = await supabase.from("questions").update({ explanation: exp1 }).eq("id", "d187afe2-d7aa-4baa-b85b-ceae84387590");
  console.log(e1 ? "Error 1: " + e1.message : "OK 1 - Ley 39/2015 art.54 inicio (" + exp1.length + " chars)");

  // #2 - CE Preambulo pueblo espanol ratifica
  const exp2 = `**Preambulo de la Constitucion Espanola de 1978:**

> "En consecuencia, las **Cortes** aprueban y el **pueblo espanol ratifica** la siguiente CONSTITUCION."

**Por que B es correcta (el pueblo espanol):**
La ultima frase del Preambulo distingue claramente dos actos:
1. Las **Cortes aprueban** la Constitucion (votacion parlamentaria)
2. El **pueblo espanol ratifica** (referendum del 6 de diciembre de 1978)

La pregunta pide quien **ratifica**, y la respuesta es el **pueblo espanol**, mediante referendum. Es una manifestacion del principio de soberania popular (art. 1.2 CE).

**Por que las demas son incorrectas:**

- **A)** "El Gobierno". Falso: el Gobierno no ratifica la Constitucion. El Gobierno es el poder ejecutivo, pero la Constitucion emana del poder constituyente (el pueblo). El Gobierno no tiene papel de aprobacion ni ratificacion constitucional.

- **C)** "Las Cortes Generales". Falso y trampa frecuente: las Cortes **aprueban** la Constitucion, pero no la **ratifican**. Aprobar y ratificar son actos distintos. La pregunta pide expresamente quien "ratifica", y eso es el pueblo espanol mediante referendum. Si preguntaran quien "aprueba", la respuesta seria las Cortes.

- **D)** "El Rey". Falso: el Rey **sanciona y promulga** la Constitucion (segun el mandato del pueblo y las Cortes), pero no la ratifica. Sancion (firma del Rey) y ratificacion (aprobacion popular) son conceptos diferentes.

**Proceso de la CE de 1978:**

| Fase | Quien | Acto |
|------|-------|------|
| Aprobacion | **Cortes** | Votacion parlamentaria |
| **Ratificacion** | **Pueblo espanol** | Referendum (6 dic 1978) |
| Sancion | Rey | Firma real |
| Promulgacion | Rey | Entrada en vigor |

**Clave:** Ratifica = **pueblo** (referendum). Aprueban = Cortes. Sanciona = Rey. No confundir los tres actos.`;

  const { error: e2 } = await supabase.from("questions").update({ explanation: exp2 }).eq("id", "29e1b5b6-9ccb-4c4c-88e2-1898534ce15b");
  console.log(e2 ? "Error 2: " + e2.message : "OK 2 - CE Preambulo ratifica (" + exp2.length + " chars)");
})();
