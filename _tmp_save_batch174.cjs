require("dotenv").config({ path: ".env.local" });
const { createClient } = require("@supabase/supabase-js");
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

(async () => {
  // #1 - CE art.53.2 tutela preferencia y sumariedad Sección 1ª Capítulo 2º
  const exp1 = `**Articulo 53.2 de la Constitucion Espanola - Tutela reforzada de derechos:**

> "Cualquier ciudadano podra recabar la tutela de las libertades y derechos reconocidos en el **articulo 14** y la **Seccion primera del Capitulo segundo** ante los Tribunales ordinarios por un procedimiento basado en los principios de **preferencia y sumariedad**."

**Por que D es correcta (Seccion primera del Capitulo segundo del Titulo I):**
La tutela preferente y sumaria protege los derechos del art. 14 (igualdad) y los de la **Seccion 1.a del Capitulo 2.o del Titulo I** (arts. 15-29: derechos fundamentales y libertades publicas). Son los derechos con la maxima proteccion constitucional.

**Por que las demas son incorrectas (confunden secciones y capitulos):**

- **A)** "Seccion **segunda** del Capitulo **primero**". Falso: contiene **dos errores**: (1) la seccion es la **primera**, no la segunda; (2) el capitulo es el **segundo**, no el primero. El Capitulo 1.o (arts. 11-13) trata de espanoles y extranjeros, no de derechos fundamentales.

- **B)** "Capitulo **primero** del Titulo I". Falso: dice Capitulo primero cuando es el **segundo**. Ademas, no especifica la seccion, con lo que abarcaria todo el Capitulo 1.o (nacionalidad y extranjeria), que no goza de esta tutela reforzada.

- **C)** "Seccion **segunda** del Capitulo segundo". Falso: la Seccion 2.a del Capitulo 2.o (arts. 30-38) contiene los "derechos y deberes de los ciudadanos" (servicio militar, tributos, matrimonio, propiedad, etc.), que gozan de reserva de ley (art. 53.1) pero **no** del procedimiento preferente y sumario del art. 53.2. Solo la Seccion **1.a** tiene esa proteccion reforzada.

**Estructura del Titulo I y niveles de proteccion:**

| Ubicacion | Contenido | Preferencia y sumariedad |
|-----------|-----------|--------------------------|
| Cap. 1.o (arts. 11-13) | Espanoles y extranjeros | NO |
| Cap. 2.o, **Sec. 1.a** (arts. 15-29) | **Derechos fundamentales** | **SI** |
| Cap. 2.o, Sec. 2.a (arts. 30-38) | Derechos y deberes ciudadanos | NO |
| Cap. 3.o (arts. 39-52) | Principios rectores | NO |

**Clave:** Tutela preferente y sumaria = art. 14 + **Seccion 1.a del Capitulo 2.o** (arts. 15-29). No confundir con la Seccion 2.a (arts. 30-38) ni con el Capitulo 1.o.`;

  const { error: e1 } = await supabase.from("questions").update({ explanation: exp1 }).eq("id", "ee77f0bd-9d80-4fd6-bb5d-53feca7e0fdc");
  console.log(e1 ? "Error 1: " + e1.message : "OK 1 - CE art.53.2 tutela preferente (" + exp1.length + " chars)");

  // #2 - LGP art.56.3 créditos extraordinarios organismos Ministro Hacienda gastos personal <1M
  const exp2 = `**Articulo 56.3 de la Ley 47/2003 (LGP) - Creditos extraordinarios de organismos autonomos:**

El art. 56.3 establece una **escala de competencias** para autorizar creditos extraordinarios o suplementarios:

> **a)** Presidentes/Directores del organismo: hasta 10% del capitulo y maximo 500.000 euros, **excluidos gastos de personal**.
>
> **b)** **Ministro de Hacienda**: cuando se superen los limites anteriores sin alcanzar el 20% del capitulo ni 1.000.000 euros. Tambien cuando afecten a **gastos de personal** siempre que **no superen 1.000.000 euros**.
>
> **c)** Consejo de Ministros: en los restantes casos.

**Por que B es correcta (gastos de personal, no superior a 1 millon):**
Los gastos de personal estan **excluidos** de la competencia de los directores de organismos (art. 56.3.a). Por tanto, cuando los creditos afectan a gastos de personal, la competencia pasa directamente al **Ministro de Hacienda**, siempre que su cuantia no supere **1.000.000 euros**. Por encima, decide el Consejo de Ministros.

**Por que las demas son incorrectas:**

- **A)** "Gastos de personal, **sin excepcion alguna**". Falso: si hay excepcion: cuando la cuantia **supera** 1.000.000 euros, la competencia pasa al **Consejo de Ministros** (art. 56.3.c). El Ministro de Hacienda no tiene competencia ilimitada sobre gastos de personal.

- **C)** "Gastos corrientes en bienes y servicios, cuantia **superior** a 1 millon". Falso: si la cuantia supera 1 millon, la competencia es del **Consejo de Ministros**, no del Ministro de Hacienda. Ademas, la pregunta especifica gastos de personal, no gastos corrientes.

- **D)** "Gastos de personal, entre **500.000 y 1 millon**". Falso: el art. 56.3.b no limita la competencia del Ministro a un rango minimo de 500.000 euros para gastos de personal. Los 500.000 son el limite maximo de la competencia del director del organismo para gastos **no** de personal. Para gastos de personal, el Ministro es competente desde el primer euro hasta 1 millon.

**Escala de competencias (art. 56.3):**

| Competente | Gastos generales | Gastos de personal |
|-----------|-----------------|-------------------|
| Director organismo | Hasta 10% y 500.000 euros | **Excluido** |
| **Ministro Hacienda** | Hasta 20% y 1.000.000 euros | **Hasta 1.000.000 euros** |
| Consejo de Ministros | Resto | Mas de 1.000.000 euros |

**Clave:** Gastos de personal = Ministro de Hacienda hasta 1 millon. El director del organismo nunca puede autorizar gastos de personal.`;

  const { error: e2 } = await supabase.from("questions").update({ explanation: exp2 }).eq("id", "2fd0a19b-0312-47ef-ba4d-a77f0dde84d8");
  console.log(e2 ? "Error 2: " + e2.message : "OK 2 - LGP art.56.3 creditos personal (" + exp2.length + " chars)");
})();
