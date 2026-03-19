require("dotenv").config({ path: ".env.local" });
const { createClient } = require("@supabase/supabase-js");
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

(async () => {
  // #1 - CE art.161 admision recurso inconstitucionalidad no suspende
  const exp1 = `**Articulo 161.2 de la Constitucion Espanola:**

> "El Gobierno podra impugnar ante el Tribunal Constitucional las disposiciones y resoluciones adoptadas por los organos de las Comunidades Autonomas. La impugnacion producira la suspension de la disposicion o resolucion recurrida [...]"

**Por que C es correcta (no suspende en ningun caso):**
La **admision** de un recurso o cuestion de inconstitucionalidad (art. 161.1) **nunca** produce la suspension automatica de la norma impugnada. La ley sigue vigente y aplicandose mientras el TC resuelve. Esto es logico: si cualquier admision suspendiera la norma, se paralizaria la actividad legislativa.

**Por que las demas son incorrectas:**

- **A)** "Suspendera en todo caso". Falso: la admision de un recurso de inconstitucionalidad no suspende nada automaticamente. La norma sigue vigente hasta que el TC dicte sentencia.

- **B)** "Suspendera, excepto impugnacion del Gobierno vs CCAA". Falso por doble error: ni suspende la admision del recurso, ni la excepcion esta bien planteada. La confusion viene de mezclar el art. 161.1 con el 161.2.

- **D)** "No suspendera, excepto impugnacion del Gobierno vs CCAA". Falso: esta opcion mezcla dos cosas distintas. La admision de un recurso (art. 161.1) y la impugnacion del Gobierno vs CCAA (art. 161.2) son **procedimientos diferentes**. El art. 161.2 SI produce suspension automatica, pero es una impugnacion, no una admision de recurso.

**Distincion clave:**

| Procedimiento | Art. CE | Suspension automatica? |
|---------------|---------|----------------------|
| Admision de recurso/cuestion de inconstitucionalidad | 161.1 | **NO** |
| Impugnacion del Gobierno vs disposiciones de CCAA | 161.2 | **SI** (caduca a los 5 meses si el TC no la ratifica) |

**Clave:** Admision de recurso = **nunca suspende**. Impugnacion del Gobierno vs CCAA = **si suspende**. Son procedimientos distintos del art. 161.`;

  const { error: e1 } = await supabase.from("questions").update({ explanation: exp1 }).eq("id", "9ae22ad7-184e-4011-92f8-0c3114959575");
  console.log(e1 ? "Error 1: " + e1.message : "OK 1 - CE art.161 admision no suspende (" + exp1.length + " chars)");

  // #2 - Ley 39/2015 art.2 sector publico
  const exp2 = `**Articulo 2.1 de la Ley 39/2015** (Ambito subjetivo - sector publico):

> "La presente Ley se aplica al **sector publico**, que comprende:
> a) La Administracion General del Estado.
> b) Las Administraciones de las Comunidades Autonomas.
> c) Las Entidades que integran la **Administracion Local**.
> d) El sector publico institucional."

**Por que D es correcta (sector publico):**
El art. 2.1 enumera los cuatro componentes del **sector publico**. Las Entidades de la Administracion Local (Ayuntamientos, Diputaciones, etc.) son la **letra c)** del art. 2.1, es decir, forman parte del concepto amplio de "sector publico".

**Por que las demas son incorrectas:**

- **A)** "Entidades publicas instrumentales". Falso: las entidades publicas instrumentales son organismos vinculados o dependientes de las Administraciones (organismos autonomos, entidades publicas empresariales, etc.). Los Ayuntamientos y Diputaciones son **Administraciones territoriales**, no instrumentales.

- **B)** "Sector publico institucional". Falso y trampa frecuente: el sector publico institucional es la **letra d)** del art. 2.1, que segun el art. 2.2 incluye organismos publicos, entidades de derecho privado, universidades publicas, etc. La Administracion Local es la **letra c)**, separada e independiente del sector institucional.

- **C)** "Organizacion central". Falso: no es un concepto de la Ley 39/2015. La "organizacion central" podria referirse a la AGE (letra a), pero las entidades locales son Administracion **territorial descentralizada**, no central.

**Estructura del sector publico (art. 2 Ley 39/2015):**
- a) AGE (Administracion central)
- b) CCAA (Administracion autonomica)
- c) **Administracion Local** (territorial)
- d) Sector publico institucional (no territorial)

**Clave:** Administracion Local = parte del **sector publico** (concepto amplio), pero NO del sector publico **institucional** (concepto restringido, letra d).`;

  const { error: e2 } = await supabase.from("questions").update({ explanation: exp2 }).eq("id", "e3caa123-e91a-46dc-bca6-0084ea1ee1d7");
  console.log(e2 ? "Error 2: " + e2.message : "OK 2 - Ley 39/2015 sector publico (" + exp2.length + " chars)");
})();
