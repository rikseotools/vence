require("dotenv").config({ path: ".env.local" });
const { createClient } = require("@supabase/supabase-js");
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

(async () => {
  // #1 - CE art.1 valores superiores (variante directa)
  const exp1 = `**Articulo 1.1 de la Constitucion Espanola:**

> "Espana se constituye en un Estado social y democratico de Derecho, que propugna como valores superiores de su ordenamiento juridico la **libertad**, la **justicia**, la **igualdad** y el **pluralismo politico**."

**Por que A es correcta:**
La opcion A reproduce exactamente los cuatro valores superiores del art. 1.1 CE: libertad, justicia, igualdad y pluralismo politico. Son exactamente cuatro, en ese orden, y no incluyen ningun otro concepto.

**Por que las demas son incorrectas:**

- **B)** "Libertad, justicia, **democracia** y pluralismo politico". Falso: sustituye "igualdad" por "democracia". "Democratico" aparece como adjetivo del Estado ("Estado social y **democratico** de Derecho"), pero no es un valor superior. El tercer valor es igualdad, no democracia.

- **C)** "Igualdad ante la Ley, libertad, **unidad de la nacion espanola** y derecho a la **autonomia de nacionalidades y regiones**". Falso: mezcla conceptos del art. 1.1 con los del art. 2 CE (unidad de la nacion y derecho a la autonomia). Ademas, "igualdad ante la Ley" es del art. 14, no del art. 1.1 que dice simplemente "igualdad".

- **D)** "Igualdad, libertad, **democracia** y **monarquia parlamentaria**". Falso: ni "democracia" ni "monarquia parlamentaria" son valores superiores. La monarquia parlamentaria es la "forma politica del Estado" (art. 1.3 CE), no un valor del ordenamiento juridico.

**Los 4 valores superiores (art. 1.1 CE):** Libertad, Justicia, Igualdad, Pluralismo politico.`;

  const { error: e1 } = await supabase.from("questions").update({ explanation: exp1 }).eq("id", "c123ca82-39ef-4fb7-88e6-904cb292a38e");
  console.log(e1 ? "Error 1: " + e1.message : "OK 1 - CE art.1 valores directa (" + exp1.length + " chars)");

  // #2 - Ley 39/2015 art.46 publicacion lesiva
  const exp2 = `**Articulo 46 de la Ley 39/2015** (Indicacion de notificaciones y publicaciones):

> "Si el organo competente apreciase que la [...] publicacion de un acto **lesiona derechos o intereses legitimos**, se limitara a publicar en el Diario oficial que corresponda una **somera indicacion del contenido** del acto y del **lugar donde los interesados podran comparecer**, en el plazo que se establezca, para conocimiento del **contenido integro** del mencionado acto."

**Por que B es correcta:**
Reproduce fielmente el art. 46: cuando la publicacion puede lesionar derechos, se publica solo una somera indicacion (resumen breve) + lugar de comparecencia. El contenido integro se conoce compareciendo en persona, no en el diario oficial.

**Por que las demas son incorrectas:**

- **A)** "Sin que se pueda hacer mencion al contenido del mismo". Falso: el art. 46 SI permite una "somera indicacion del contenido". No se omite por completo el contenido, sino que se da una referencia minima. La opcion A es demasiado restrictiva.

- **C)** "Se publicara el contenido del acto, restringiendo datos de identificacion". Falso: el art. 46 no permite publicar el contenido del acto (ni siquiera anonimizado). La solucion es publicar solo una somera indicacion, no el acto completo con datos tachados.

- **D)** "Se acordara la no publicacion del acto". Falso: el art. 46 no suprime la publicacion, sino que la limita a una somera indicacion. El acto se sigue publicando, pero de forma resumida. La no publicacion total no esta contemplada.

**Mecanismo del art. 46:**
1. Se publica somera indicacion del contenido en el DO
2. Se indica lugar de comparecencia
3. El interesado acude para conocer el contenido integro
4. Se deja constancia de ese conocimiento`;

  const { error: e2 } = await supabase.from("questions").update({ explanation: exp2 }).eq("id", "d0e163d7-1a4c-4dba-88e4-94d6ebb90115");
  console.log(e2 ? "Error 2: " + e2.message : "OK 2 - Ley 39/2015 art.46 publicacion (" + exp2.length + " chars)");
})();
