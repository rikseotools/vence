require("dotenv").config({ path: ".env.local" });
const { createClient } = require("@supabase/supabase-js");
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

(async () => {
  // #1 - RD 1708/2011 art.24 solicitud acceso archivos INCORRECTA fecha
  const exp1 = `**Articulo 24.2 del RD 1708/2011 - Solicitud de acceso a documentos y archivos:**

> "En la solicitud debera indicarse con claridad el **documento o conjunto de documentos** a los que se refiere, asi como la **identidad del solicitante** y una **direccion** a efectos de comunicaciones."

**Por que C es la afirmacion INCORRECTA (y por tanto la respuesta):**
La opcion C dice que se debe indicar "la **fecha**, o una aproximacion a la misma, del documento o documentos." Falso: el art. 24.2 del RD 1708/2011 **no exige** indicar la fecha del documento. Solo requiere tres datos: (1) la identificacion del documento solicitado, (2) la identidad del solicitante y (3) una direccion de contacto. Aunque indicar la fecha puede facilitar la localizacion, no es un requisito legal obligatorio.

**Por que las demas SI son obligatorias (art. 24.2):**

- **A)** "Una **direccion**, a efectos de comunicaciones." **Correcto**: el art. 24.2 exige "una direccion a efectos de comunicaciones" para que el archivo pueda notificar la resolucion sobre el acceso.

- **B)** "La **identidad del solicitante**." **Correcto**: el art. 24.2 exige "la identidad del solicitante". Es necesaria para tramitar la solicitud y resolver sobre el acceso.

- **D)** "El **documento o conjunto de documentos** a los que se refiere." **Correcto**: el art. 24.2 exige "el documento o conjunto de documentos a los que se refiere". El solicitante debe identificar que documentos quiere consultar.

**Requisitos de la solicitud de acceso (art. 24.2 RD 1708/2011):**

| Dato | Obligatorio |
|------|-------------|
| Documento(s) solicitado(s) | **Si** |
| Identidad del solicitante | **Si** |
| Direccion de contacto | **Si** |
| ~~Fecha del documento~~ | **No** (no exigido) |

**Clave:** La solicitud exige identificar el documento, al solicitante y una direccion. La fecha del documento no es obligatoria, aunque puede ser util para la busqueda.`;

  const { error: e1 } = await supabase.from("questions").update({ explanation: exp1 }).eq("id", "98bdf1f4-8d6f-4a10-a6c4-16f5cedb882b");
  console.log(e1 ? "Error 1: " + e1.message : "OK 1 - RD 1708/2011 art.24 solicitud acceso (" + exp1.length + " chars)");
})();
