require("dotenv").config({ path: ".env.local" });
const { createClient } = require("@supabase/supabase-js");
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

(async () => {
  const explanation = `**Articulo 25 de la Ley 29/1998** (Ley de la Jurisdiccion Contencioso-Administrativa):

> **25.1:** El recurso es admisible contra actos expresos y presuntos que pongan fin a la via administrativa, ya sean **definitivos** o **de tramite**, si estos ultimos:
> - Deciden directa o indirectamente el fondo del asunto
> - Determinan la imposibilidad de continuar el procedimiento
> - Producen indefension
> - Causan perjuicio irreparable a derechos o intereses legitimos
>
> **25.2:** Tambien es admisible contra la **inactividad** de la Administracion y contra **actuaciones materiales** que constituyan via de hecho.

La pregunta pide la **incorrecta**.

**Por que B es incorrecta:**
Dice que el recurso sera admisible contra **todos** los actos de tramite que pongan fin a la via administrativa. Falso: el art. 25.1 solo admite recurso contra actos de tramite cuando cumplen alguna de las cuatro condiciones (deciden el fondo, impiden continuar, causan indefension o perjuicio irreparable). No todos los actos de tramite son recurribles.

**Por que las demas son correctas:**

- **A)** Actos expresos y presuntos definitivos que pongan fin a la via administrativa - Correcto segun el art. 25.1. Los actos definitivos si son recurribles sin condiciones adicionales.

- **C)** Actuaciones materiales que constituyan via de hecho - Correcto segun el art. 25.2.

- **D)** Inactividad de la Administracion - Correcto segun el art. 25.2.

**Clave:** Los actos definitivos son siempre recurribles; los de tramite solo cuando cumplen condiciones especificas. Esta distincion es fundamental en contencioso-administrativo.`;

  const { error } = await supabase
    .from("questions")
    .update({ explanation })
    .eq("id", "5fe93ffd-53a4-42a4-aa8e-9dc43f676690");

  if (error) console.error("Error:", error);
  else console.log("OK - Ley 29/1998 art.25 guardada (" + explanation.length + " chars)");
})();
