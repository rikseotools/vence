require("dotenv").config({ path: ".env.local" });
const { createClient } = require("@supabase/supabase-js");
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

(async () => {
  // #1 - CE art.74 sesion conjunta Camaras
  const exp1 = `**Articulo 74.1 de la Constitucion Espanola:**

> "Las Camaras se reuniran en **sesion conjunta** para ejercer las competencias **no legislativas** que el **Titulo II** atribuye expresamente a las Cortes Generales."

**Por que A es correcta:**
La exclusion de sucesores que contraigan matrimonio prohibido (art. 57.4 CE) es una competencia del **Titulo II** (De la Corona). Como el art. 74.1 establece que las sesiones conjuntas son para competencias no legislativas del Titulo II, esta materia requiere sesion conjunta de ambas Camaras.

**Por que las demas son incorrectas:**

- **B)** "Debate y votacion de Decretos-leyes". Falso: los Decretos-leyes se debaten y votan exclusivamente en el **Congreso** (art. 86.2 CE), no en sesion conjunta. El Senado no participa en la convalidacion de Decretos-leyes.

- **C)** "Iniciativa de reforma constitucional y su tramitacion". Falso: la reforma constitucional se tramita por cada Camara **por separado** (arts. 167-168 CE). Cada una aprueba con sus propias mayorias. No es sesion conjunta.

- **D)** "Sancion y publicacion oficial de las leyes". Falso: la sancion es competencia del **Rey** (art. 62.a CE), no de las Camaras. Las Camaras aprueban las leyes; el Rey las sanciona y ordena su publicacion.

**Sesiones conjuntas (art. 74.1): competencias NO legislativas del Titulo II:**
- Sucesion a la Corona (prohibicion de matrimonio, art. 57.4)
- Provision a la sucesion (art. 57.3)
- Inhabilitacion del Rey (art. 59.2)
- Regencia (art. 59.3)
- Tutela del Rey menor (art. 60.1)
- Juramento del Rey (art. 61.1)`;

  const { error: e1 } = await supabase.from("questions").update({ explanation: exp1 }).eq("id", "0017f907-c0ba-42aa-953e-2ae53eb80cd8");
  console.log(e1 ? "Error 1: " + e1.message : "OK 1 - CE art.74 sesion conjunta (" + exp1.length + " chars)");

  // #2 - Ley 19/2013 art.17 solicitud acceso informacion
  const exp2 = `**Articulo 17.2 de la Ley 19/2013** (Solicitud de acceso a la informacion publica):

> "La solicitud podra presentarse por cualquier medio que permita tener constancia de: a) La **identidad del solicitante**. b) La **informacion que se solicita**. c) Una **direccion de contacto**, preferentemente electronica, a efectos de comunicaciones. d) En su caso, la **modalidad** que se prefiera para acceder a la informacion solicitada."

> Art. 17.3: "El solicitante **no esta obligado a motivar** su solicitud de acceso a la informacion."

**Por que B es la INCORRECTA:**
La opcion B dice "la razon de la solicitud", pero el art. 17.3 establece expresamente que el solicitante **no esta obligado a motivar** su solicitud. No necesita explicar por que quiere la informacion. Este es un principio fundamental del derecho de acceso: se ejerce sin justificar el motivo.

**Por que las demas son correctas (SI deben constar):**

- **A)** "Direccion de contacto, preferentemente electronica". SI: art. 17.2.c) lo exige expresamente para las comunicaciones.

- **C)** "La informacion que se solicita". SI: art. 17.2.b) lo exige. Es logico: la Administracion necesita saber que informacion se pide.

- **D)** "La identidad del solicitante". SI: art. 17.2.a) lo exige. Hay que identificarse para ejercer el derecho.

**Contenido obligatorio de la solicitud (art. 17.2):**
1. Identidad del solicitante
2. Informacion solicitada
3. Direccion de contacto (preferentemente electronica)
4. Modalidad de acceso preferida (opcional)
5. **NO se exige motivacion** (art. 17.3)`;

  const { error: e2 } = await supabase.from("questions").update({ explanation: exp2 }).eq("id", "086b79c7-790f-40a2-b880-5f12957d3688");
  console.log(e2 ? "Error 2: " + e2.message : "OK 2 - Ley 19/2013 art.17 solicitud (" + exp2.length + " chars)");
})();
