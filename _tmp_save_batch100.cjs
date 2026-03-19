require("dotenv").config({ path: ".env.local" });
const { createClient } = require("@supabase/supabase-js");
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

(async () => {
  // #1 - Ley 50/1997 art.15 Secretarios de Estado nombramiento
  const exp1 = `**Articulo 15.1 de la Ley 50/1997 del Gobierno:**

> "Los Secretarios de Estado son nombrados y separados por **Real Decreto del Consejo de Ministros**, aprobado a propuesta del Presidente del Gobierno o del miembro del Gobierno a cuyo Departamento pertenezcan."

**Por que B es la incorrecta (y por tanto la respuesta):**
La opcion B dice "Real Decreto **del Presidente del Gobierno**". Pero el art. 15.1 dice "Real Decreto **del Consejo de Ministros**". La diferencia es crucial:
- Los Secretarios de Estado se nombran por **RD del Consejo de Ministros** (organo colegiado)
- No por RD del Presidente (que seria un acto individual del Presidente)

La **propuesta** si puede venir del Presidente o del ministro del departamento, pero el **acto de nombramiento** es del Consejo de Ministros.

**Por que las demas SI son correctas:**

- **A)** "Los Secretarios de Estado dependientes de la Presidencia seran suplidos por quien designe el Presidente". **SI**: art. 15.3 lo establece expresamente.

- **C)** "Son nombrados y separados a propuesta del Presidente o del miembro del Gobierno a cuyo Departamento pertenezcan". **SI**: art. 15.1 establece que la propuesta puede venir de cualquiera de los dos.

- **D)** "La suplencia se determinara segun el orden de precedencia del RD de estructura organica del Ministerio". **SI**: art. 15.2 lo establece expresamente.

**Nombramiento de Secretarios de Estado (art. 15):**
- **Quien nombra:** Consejo de Ministros (por RD)
- **Quien propone:** Presidente del Gobierno o el Ministro del departamento
- **Suplencia:** orden de precedencia del RD de estructura organica
- **Suplencia si dependen de Presidencia:** quien designe el Presidente

**Clave:** RD del **Consejo de Ministros** (no del Presidente). La trampa cambia el organo que adopta el acto.`;

  const { error: e1 } = await supabase.from("questions").update({ explanation: exp1 }).eq("id", "13b81067-c7f4-4d0a-ac5f-7bb9ab27d40f");
  console.log(e1 ? "Error 1: " + e1.message : "OK 1 - Ley 50/1997 Secretarios Estado (" + exp1.length + " chars)");

  // #2 - CE art.137 autonomia municipios provincias CCAA
  const exp2 = `**Articulo 137 de la Constitucion Espanola:**

> "El Estado se organiza territorialmente en **municipios**, en **provincias** y en las **Comunidades Autonomas** que se constituyan. Todas estas entidades gozan de **autonomia** para la gestion de sus respectivos intereses."

**Por que D es correcta (articulo 137):**
El art. 137 CE es el primer articulo del **Titulo VIII** ("De la Organizacion Territorial del Estado") y establece el principio fundamental de la estructura territorial de Espana: municipios, provincias y CCAA, todas con autonomia. Es el articulo basico de la organizacion territorial.

**Por que las demas son incorrectas (son articulos de otras materias):**

- **A)** "Articulo **148**". Falso: el art. 148 CE lista las **competencias que pueden asumir las CCAA** (22 materias). Habla de competencias, no del principio de autonomia de municipios y provincias.

- **B)** "Articulo **115**". Falso: el art. 115 CE regula la **disolucion de las Cortes Generales** por el Presidente del Gobierno. No tiene nada que ver con la organizacion territorial ni con la autonomia municipal.

- **C)** "Articulo **147**". Falso: el art. 147 CE regula los **Estatutos de Autonomia** (su contenido minimo: denominacion, delimitacion territorial, organizacion institucional, competencias). Esta en el Titulo VIII pero trata de los Estatutos, no del principio general de autonomia.

**Estructura del Titulo VIII de la CE:**
- Art. **137**: Principio de organizacion territorial y **autonomia**
- Art. 138-139: Solidaridad e igualdad
- Art. 140-142: Municipios y provincias
- Art. 143-158: Comunidades Autonomas (acceso, competencias, organizacion)

**Clave:** Art. **137** = autonomia de municipios, provincias y CCAA. No confundir con 147 (Estatutos), 148 (competencias CCAA) ni 115 (disolucion Cortes).`;

  const { error: e2 } = await supabase.from("questions").update({ explanation: exp2 }).eq("id", "6f9e4831-1ac2-4658-8dc6-3196f10b16a9");
  console.log(e2 ? "Error 2: " + e2.message : "OK 2 - CE art.137 autonomia (" + exp2.length + " chars)");
})();
