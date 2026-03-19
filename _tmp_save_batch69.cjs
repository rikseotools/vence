require("dotenv").config({ path: ".env.local" });
const { createClient } = require("@supabase/supabase-js");
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

(async () => {
  // #1 - CE art.54 Defensor del Pueblo
  const exp1 = `**Articulo 54 de la Constitucion Espanola:**

> "Una ley organica regulara la institucion del **Defensor del Pueblo**, como alto comisionado de las Cortes Generales, designado por estas para la defensa de los derechos comprendidos en este Titulo, a cuyo efecto podra supervisar la actividad de la Administracion, dando cuenta a las Cortes Generales."

**Por que D es correcta (articulo 54):**
El art. 54 CE es el unico articulo que establece la figura del Defensor del Pueblo. Se ubica en el **Capitulo IV del Titulo I** ("De las garantias de las libertades y derechos fundamentales"), junto al art. 53 sobre tutela judicial.

**Por que las demas son incorrectas (que regulan esos articulos):**

- **A)** "Articulo 47". Falso: el art. 47 CE regula el **derecho a una vivienda digna** (principio rector de la politica social, Capitulo III del Titulo I). Nada que ver con el Defensor del Pueblo.

- **B)** "Articulo 62". Falso: el art. 62 CE regula las **funciones del Rey** (sancionar leyes, convocar elecciones, proponer candidato a Presidente, etc.). Esta en el Titulo II (De la Corona).

- **C)** "Articulo 29". Falso: el art. 29 CE regula el **derecho de peticion** (todos los espanoles pueden dirigir peticiones por escrito a los poderes publicos). Esta en la Seccion 1a del Capitulo 2o del Titulo I.

**Ubicacion del Defensor del Pueblo en la CE:**
- Art. 54: creacion y funcion principal
- Art. 162.1.b): legitimado para interponer recurso de inconstitucionalidad
- LO 3/1981: ley de desarrollo

**Clave:** Defensor del Pueblo = art. **54** CE. No confundir con art. 47 (vivienda), art. 62 (Rey) ni art. 29 (peticion).`;

  const { error: e1 } = await supabase.from("questions").update({ explanation: exp1 }).eq("id", "1d33e37e-fd4d-4294-b1da-3f31cff2adee");
  console.log(e1 ? "Error 1: " + e1.message : "OK 1 - CE art.54 Defensor Pueblo (" + exp1.length + " chars)");

  // #2 - CE art.25.1 principio de legalidad penal
  const exp2 = `**Articulo 25.1 de la Constitucion Espanola:**

> "Nadie puede ser condenado o sancionado por acciones u omisiones que en el momento de producirse **no constituyan delito, falta o infraccion administrativa**, segun la **legislacion vigente en aquel momento**."

**Por que A es correcta (principio de legalidad penal):**
El art. 25.1 CE consagra el principio de **legalidad penal** (conocido como *nullum crimen, nulla poena sine lege*): solo se puede castigar por conductas previamente tipificadas como delito o infraccion en una norma vigente. Tiene dos vertientes:
- **Tipicidad**: la conducta debe estar previamente definida
- **Irretroactividad** de las normas sancionadoras desfavorables

**Por que las demas son incorrectas:**

- **B)** "El ius puniendi del Estado". Falso: el *ius puniendi* es el **poder del Estado para castigar**, un concepto amplio que abarca todo el sistema penal y sancionador. El art. 25.1 no define ni establece ese poder, sino que lo **limita** mediante el principio de legalidad. El ius puniendi es el concepto general; la legalidad penal es un limite concreto.

- **C)** "Principio de responsabilidad por actos propios". Falso: la responsabilidad por actos propios es un principio de **Derecho civil** (nadie responde por actos ajenos). El art. 25.1 no habla de responsabilidad civil sino de **tipicidad** y **legalidad** en el ambito penal/sancionador.

- **D)** "Todas las respuestas son correctas". Falso: solo A es correcta. Ni el ius puniendi ni la responsabilidad por actos propios son lo que recoge el art. 25.1.

**Clave:** Art. 25.1 CE = principio de **legalidad penal** = nadie puede ser sancionado por algo que no estaba tipificado cuando lo hizo.`;

  const { error: e2 } = await supabase.from("questions").update({ explanation: exp2 }).eq("id", "447a84e9-5611-493c-99d3-aa791fd3efd1");
  console.log(e2 ? "Error 2: " + e2.message : "OK 2 - CE art.25.1 legalidad penal (" + exp2.length + " chars)");

  // #3 - CE art.137 organizacion territorial
  const exp3 = `**Articulo 137 de la Constitucion Espanola:**

> "El Estado se organiza territorialmente en **municipios**, en **provincias** y en las **Comunidades Autonomas** que se constituyan. Todas estas entidades gozan de **autonomia** para la gestion de sus respectivos intereses."

**Por que B es correcta (CCAA + municipios + provincias):**
El art. 137 CE enumera exactamente **tres** entidades territoriales con autonomia: municipios, provincias y Comunidades Autonomas. Ni mas ni menos.

**Por que las demas son incorrectas:**

- **A)** "CCAA y provincias". Falso: **falta los municipios**. El art. 137 menciona expresamente los municipios como primer nivel de organizacion territorial. Omitirlos es incompleto.

- **C)** "CCAA, municipios, provincias y las islas". Falso: **sobran las islas**. El art. 137 NO menciona las islas como entidad territorial autonoma. Las islas aparecen en el art. 141.4 CE como elemento de la organizacion provincial en los archipielagos (Cabildos en Canarias, Consejos Insulares en Baleares), pero no en el art. 137.

- **D)** "CCAA y municipios". Falso: **falta las provincias**. El art. 137 incluye expresamente las provincias como nivel intermedio entre municipios y CCAA.

**Organizacion territorial del Estado (art. 137 CE):**

| Nivel | Entidad | Gobierno |
|-------|---------|----------|
| Local | **Municipios** | Ayuntamientos |
| Intermedio | **Provincias** | Diputaciones |
| Regional | **CCAA** | Parlamentos y Gobiernos autonomicos |

**Clave:** Art. 137 = **tres** niveles: municipios + provincias + CCAA. Las **islas** NO estan en el art. 137 (aparecen en el art. 141.4).`;

  const { error: e3 } = await supabase.from("questions").update({ explanation: exp3 }).eq("id", "906f5159-97e2-45a1-a27a-2e784b9e3e88");
  console.log(e3 ? "Error 3: " + e3.message : "OK 3 - CE art.137 org. territorial (" + exp3.length + " chars)");
})();
