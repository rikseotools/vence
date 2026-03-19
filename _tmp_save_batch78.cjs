require("dotenv").config({ path: ".env.local" });
const { createClient } = require("@supabase/supabase-js");
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

(async () => {
  // #1 - Portales Internet Publicos - Ceuta y Melilla
  const exp1 = `**Portales de Internet Publicos del PAGe - Categoria de Ceuta y Melilla:**

Las webs de las ciudades de **Ceuta y Melilla** se acceden desde la categoria de **"Portales de internet de las Comunidades Autonomas"** dentro del PAGe.

**Por que A es correcta:**
Ceuta y Melilla son **Ciudades Autonomas** con Estatutos de Autonomia propios (aprobados por LO 1/1995 y LO 2/1995). Aunque no son tecnicamente "Comunidades Autonomas" en sentido estricto, el PAGe las clasifica junto con las CCAA en la misma categoria de portales. Esto tiene logica: tienen organos de gobierno propios (Asamblea y Presidente) y competencias autonomicas similares a las CCAA.

**Por que las demas son incorrectas:**

- **B)** "Portales de internet de otros Organismos". Falso: Ceuta y Melilla no son "otros organismos" (como podrian ser el CSIC, la AEPD, etc.). Son entidades territoriales con autonomia, no organismos publicos vinculados a la AGE.

- **C)** "Portales de internet de Ciudades con Estatuto de Autonomia". Falso: aunque esta descripcion seria tecnicamente precisa, esta **categoria no existe** en la estructura del PAGe. No hay una seccion separada para "Ciudades con Estatuto de Autonomia"; se incluyen en la de CCAA.

- **D)** "Portales de internet de las Entidades Locales". Falso: las Entidades Locales son Ayuntamientos, Diputaciones, etc. Aunque Ceuta y Melilla tienen competencias municipales, su estatus de Ciudades Autonomas las situa en la categoria de CCAA, no en la de entidades locales.

**Clave:** Ceuta y Melilla = **Ciudades Autonomas** = clasificadas en el PAGe junto con las **CCAA**, no como entidades locales ni como "otros organismos".`;

  const { error: e1 } = await supabase.from("questions").update({ explanation: exp1 }).eq("id", "a0f19eaa-4fd3-4254-9c5d-539ab71ea282");
  console.log(e1 ? "Error 1: " + e1.message : "OK 1 - Ceuta Melilla PAGe (" + exp1.length + " chars)");

  // #2 - Ley 47/2003 art.60 anticipos Tesoreria - Consejo de Estado
  const exp2 = `**Articulo 60.1.a) de la Ley 47/2003 (LGP):**

> "Con caracter excepcional, el Gobierno [...] podra conceder **anticipos de Tesoreria** para atender gastos inaplazables [...] en los siguientes casos:
> a) Cuando, una vez iniciada la tramitacion de los expedientes de concesion de creditos extraordinarios o de suplementos de credito, hubiera dictaminado favorablemente el **Consejo de Estado**."

**Por que A es correcta:**
El dictamen **favorable del Consejo de Estado** es el requisito para que el Gobierno pueda conceder anticipos de Tesoreria cuando hay creditos extraordinarios o suplementos en tramitacion. El Consejo de Estado, como supremo organo consultivo del Gobierno (art. 107 CE), verifica que la necesidad de gasto esta justificada.

**Por que las demas son incorrectas (cambian el organo que dictamina):**

- **B)** "Hubieran dictaminado favorablemente las **Cortes Generales**". Falso: las Cortes Generales son las que finalmente **aprueban** los creditos extraordinarios o suplementos (art. 55 LGP), pero no son las que dictaminan previamente para el anticipo. El dictamen previo es del **Consejo de Estado**.

- **C)** "Hubiera dictaminado favorablemente el **Consejo de Ministros**". Falso: el Consejo de Ministros es el organo que **concede** el anticipo (como Gobierno), no el que dictamina previamente. Seria contradictorio que el mismo organo que concede tambien dictaminara sobre si mismo.

- **D)** "Ninguna es correcta". Falso: la opcion A es correcta.

**Anticipos de Tesoreria (art. 60 LGP):**
- Caracter **excepcional**
- Propuesta del **Ministro de Economia**
- Limite: **1% de los creditos** autorizados por la Ley de Presupuestos
- Requisito: dictamen favorable del **Consejo de Estado**

**Clave:** Dictamen para anticipos de Tesoreria = **Consejo de Estado** (no Cortes ni Consejo de Ministros).`;

  const { error: e2 } = await supabase.from("questions").update({ explanation: exp2 }).eq("id", "4489f6c9-6e18-4a32-a0de-e041350b14f4");
  console.log(e2 ? "Error 2: " + e2.message : "OK 2 - LGP anticipos Tesoreria (" + exp2.length + " chars)");
})();
