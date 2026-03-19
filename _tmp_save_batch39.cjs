require("dotenv").config({ path: ".env.local" });
const { createClient } = require("@supabase/supabase-js");
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

(async () => {
  // #1 - CE art.152.3 circunscripciones territoriales
  const exp1 = `**Articulo 152.3 de la Constitucion Espanola:**

> "Mediante la agrupacion de municipios **limitrofes**, los Estatutos podran establecer circunscripciones territoriales propias, que gozaran de **plena personalidad juridica**."

**Por que A es correcta:**
La opcion A reproduce literalmente el art. 152.3 CE: municipios **limitrofes** + **plena personalidad juridica**. Ambos elementos son esenciales.

**Por que las demas son incorrectas:**
Las opciones combinan dos variables para crear confusiones. Solo A tiene las dos correctas:

| Opcion | Tipo de municipios | Personalidad juridica | Correcta |
|--------|-------------------|-----------------------|----------|
| **A** | **Limitrofes** | **Plena** | SI |
| B | Intereses comunes | No plena | NO (ambas mal) |
| C | Intereses comunes | Plena | NO (tipo mal) |
| D | Limitrofes | No plena | NO (personalidad mal) |

- **B)** Dos errores: dice "intereses comunes" (es "limitrofes") y "no gozaran" (es "gozaran").

- **C)** Dice "intereses comunes" en vez de "**limitrofes**". El art. 152.3 exige que los municipios sean limitrofes (contiguos territorialmente), no simplemente que compartan intereses.

- **D)** Dice "no gozaran de plena personalidad juridica" cuando el art. 152.3 dice que SI gozaran. Estas circunscripciones son entes con personalidad juridica propia.

**Clave:** Las dos palabras clave son "**limitrofes**" (no "intereses comunes") y "**plena** personalidad juridica" (no "sin personalidad").`;

  const { error: e1 } = await supabase.from("questions").update({ explanation: exp1 }).eq("id", "dbddb24d-0182-43fe-9699-e85dfe6e1844");
  console.log(e1 ? "Error 1: " + e1.message : "OK 1 - CE art.152.3 circunscripciones (" + exp1.length + " chars)");

  // #2 - Windows 11 Alt+flecha izquierda explorador
  const exp2 = `**Atajos de navegacion en el Explorador de archivos de Windows 11:**

> **Alt + flecha izquierda** = Navegar a la carpeta **anterior** (equivale al boton "Atras" del explorador).

**Por que A es correcta:**
El atajo Alt + flecha izquierda funciona como el boton "Atras" en un navegador web: te lleva a la carpeta que visitaste antes. Es parte de la familia de atajos de navegacion con Alt + flechas.

**Por que las demas son incorrectas:**

- **B)** "Alt + * (asterisco)". El asterisco con teclado numerico (Bloq Num + *) expande todas las subcarpetas del elemento seleccionado en el arbol de navegacion. No sirve para ir a la carpeta anterior.

- **C)** "Alt + Supr". No es un atajo estandar del Explorador de archivos. Supr solo (sin Alt) envia archivos a la Papelera de reciclaje.

- **D)** "Alt + + (mas)". No es un atajo de navegacion del Explorador. El simbolo + en el teclado numerico expande la carpeta seleccionada en el arbol.

**Atajos de navegacion del Explorador (familia Alt + flechas):**
| Atajo | Funcion |
|-------|---------|
| **Alt + flecha izquierda** | Carpeta anterior (Atras) |
| Alt + flecha derecha | Carpeta siguiente (Adelante) |
| Alt + flecha arriba | Subir un nivel en la jerarquia |`;

  const { error: e2 } = await supabase.from("questions").update({ explanation: exp2 }).eq("id", "3d606bf3-331e-4d44-9c68-f66dd88d2097");
  console.log(e2 ? "Error 2: " + e2.message : "OK 2 - Windows Alt+izq explorador (" + exp2.length + " chars)");

  // #3 - CE art.143.2 + DT 1a iniciativa proceso autonomico
  const exp3 = `**Articulo 143.2 de la Constitucion Espanola** (Iniciativa del proceso autonomico - via general):

> "La iniciativa del proceso autonomico corresponde a **todas las Diputaciones interesadas** o al organo interinsular correspondiente y a las **dos terceras partes de los municipios** cuya poblacion represente, al menos, la **mayoria del censo electoral** de cada provincia o isla."

**Disposicion Transitoria Primera de la CE** (Territorios con regimen provisional de autonomia):

> "En los territorios dotados de un regimen provisional de autonomia, sus **organos colegiados superiores**, mediante acuerdo adoptado por la **mayoria absoluta** de sus miembros, podran sustituir la iniciativa que en el apartado 2 del articulo 143 atribuye a las Diputaciones Provinciales [...]."

**Por que C es correcta (A y B son correctas):**
La pregunta se refiere a territorios con regimen **provisional** de autonomia. En estos territorios existen **dos vias** para la iniciativa:
- **Via del art. 143.2** (opcion A): Diputaciones + 2/3 de municipios (via general, siempre aplicable)
- **Via de la DT 1a** (opcion B): organos colegiados superiores por mayoria absoluta (via especial que **sustituye** a la anterior)

Ambas vias son validas, por lo que A y B son correctas y la respuesta es C.

**Por que las demas son incorrectas:**

- **A)** Es correcta en si misma (art. 143.2), pero incompleta: no recoge la via especial de la DT 1a.

- **B)** Es correcta en si misma (DT 1a), pero incompleta: no recoge la via general del art. 143.2.

- **D)** "A y B son incorrectas". Falso: ambas son correctas como se ha explicado.

**Iniciativa autonomica en territorios con regimen provisional:**
| Via | Base legal | Quien la ejerce | Requisito |
|-----|-----------|-----------------|-----------|
| General | Art. 143.2 | Diputaciones + 2/3 municipios | Mayoria censo electoral |
| Especial | DT 1a | Organos colegiados superiores | Mayoria absoluta |`;

  const { error: e3 } = await supabase.from("questions").update({ explanation: exp3 }).eq("id", "c7d1f748-8cde-486f-8489-bcd48e415f36");
  console.log(e3 ? "Error 3: " + e3.message : "OK 3 - CE art.143 + DT1 autonomias (" + exp3.length + " chars)");
})();
