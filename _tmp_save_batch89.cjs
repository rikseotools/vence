require("dotenv").config({ path: ".env.local" });
const { createClient } = require("@supabase/supabase-js");
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

(async () => {
  // #1 - LOTC art.75 ter legitimacion conflicto autonomia local
  const exp1 = `**Articulo 75 ter.1 de la LOTC** (Conflicto en defensa de la autonomia local):

> "Estan legitimados para plantear estos conflictos:
> a) El **municipio o provincia** que sea **destinatario unico** de la ley.
> b) Un numero de **municipios** que supongan al menos **un septimo** de los existentes en el ambito territorial [...] y representen como minimo **un sexto** de la poblacion oficial [...]
> c) Un numero de **provincias** que supongan al menos **la mitad** de las existentes [...] y representen como minimo **la mitad** de la poblacion oficial."

**Por que D es correcta (todas son correctas):**
El art. 75 ter.1 LOTC establece tres supuestos de legitimacion, y cada una de las opciones A, B y C reproduce fielmente uno de ellos:

- **A)** Destinatario unico: cuando la ley afecta a un solo municipio o provincia, ese ente puede plantear el conflicto por si solo (letra a).
- **B)** Municipios: al menos 1/7 de los existentes + 1/6 de la poblacion (letra b).
- **C)** Provincias: al menos la mitad de las existentes + la mitad de la poblacion (letra c).

**Fracciones clave a memorizar:**

| Ente | Fraccion de entes | Fraccion de poblacion |
|------|------------------|-----------------------|
| **Municipios** | 1/**7** | 1/**6** |
| **Provincias** | 1/**2** | 1/**2** |
| **Destinatario unico** | Solo 1 | No aplica |

**Diferencia entre municipios y provincias:**
Los requisitos para provincias son mas exigentes en proporcion (mitad vs septimo) porque hay muchas menos provincias que municipios en Espana. Esto equilibra el sistema para que ambas vias sean razonablemente accesibles.

**Clave:** Las tres opciones reproducen los tres supuestos del art. 75 ter.1 LOTC. Memorizar: municipios = 1/7 + 1/6; provincias = 1/2 + 1/2; destinatario unico = 1 solo.`;

  const { error: e1 } = await supabase.from("questions").update({ explanation: exp1 }).eq("id", "77bcba7b-ae44-4b1a-96c8-66b8508742d8");
  console.log(e1 ? "Error 1: " + e1.message : "OK 1 - LOTC art.75 ter conflicto local (" + exp1.length + " chars)");

  // #2 - LOTC art.15 Presidente TC convoca Salas
  const exp2 = `**Articulo 15 de la LOTC:**

> "El **Presidente** del Tribunal Constitucional ejerce la representacion del Tribunal, **convoca y preside** el Tribunal en **Pleno** y **convoca las Salas**; adopta las medidas precisas para el funcionamiento del Tribunal, de las Salas y de las Secciones [...]"

**Por que A es correcta (Presidente del TC):**
El art. 15 LOTC atribuye al Presidente del TC una lista tasada de funciones. Entre ellas esta expresamente la de **convocar las Salas**. No las preside (la Sala Primera la preside el Presidente, la Sala Segunda la preside el Vicepresidente segun el art. 16), pero si las **convoca**.

**Por que las demas son incorrectas:**

- **B)** "Las Secciones". Falso: las Secciones son organos internos del TC compuestos por 3 Magistrados cada una (art. 8 LOTC). No tienen competencia para convocar las Salas. Las Secciones se limitan a decidir sobre la admision o inadmision de recursos.

- **C)** "El Pleno". Falso: el Pleno es el organo colegiado del TC formado por los 12 Magistrados (art. 6 LOTC). No convoca las Salas; quien convoca tanto el Pleno como las Salas es el **Presidente**.

- **D)** "El Vicepresidente". Falso: el Vicepresidente **preside** la Sala Segunda (art. 16 LOTC) y sustituye al Presidente en caso de vacante, ausencia u otro motivo legal (art. 16.2). Pero convocar las Salas es funcion del Presidente, no del Vicepresidente.

**Funciones del Presidente del TC (art. 15 LOTC):**
- Representa al Tribunal
- Convoca y preside el **Pleno**
- **Convoca** las Salas
- Adopta medidas de funcionamiento
- Comunica vacantes
- Nombra letrados

**Clave:** El Presidente **convoca** las Salas. El Vicepresidente **preside** la Sala 2a, pero no convoca.`;

  const { error: e2 } = await supabase.from("questions").update({ explanation: exp2 }).eq("id", "b7a8a542-c87c-4136-8428-77f671635d02");
  console.log(e2 ? "Error 2: " + e2.message : "OK 2 - LOTC art.15 Presidente convoca (" + exp2.length + " chars)");

  // #3 - CE art.39 investigacion paternidad principio rector
  const exp3 = `**Articulo 39.2 de la Constitucion Espanola:**

> "Los poderes publicos aseguran, asimismo, la proteccion integral de los hijos [...] **La ley posibilitara la investigacion de la paternidad.**"

Este articulo esta ubicado en el **Capitulo III del Titulo I** de la CE, titulado "De los **principios rectores** de la politica social y economica" (arts. 39-52).

**Por que B es correcta (principio rector):**
La investigacion de la paternidad del art. 39 CE es un **principio rector** porque esta en el Capitulo III. Su ubicacion en la CE determina su naturaleza juridica y su nivel de proteccion (art. 53.3 CE: solo pueden ser alegados ante la jurisdiccion ordinaria "de acuerdo con lo que dispongan las leyes que los desarrollen").

**Por que las demas son incorrectas (confunden la categoria constitucional):**

- **A)** "Un **derecho fundamental**". Falso: los derechos fundamentales en sentido estricto estan en la **Seccion 1a del Capitulo II** (arts. 15-29). El art. 39 esta en el Capitulo III, no en la Seccion 1a. Los derechos fundamentales tienen la maxima proteccion: recurso de amparo ante el TC, desarrollo por ley organica, procedimiento preferente y sumario.

- **C)** "Una **garantia constitucional**". Falso: las garantias constitucionales son los mecanismos de proteccion de los derechos (como la reserva de ley, el recurso de amparo, la rigidez constitucional). La investigacion de la paternidad no es un mecanismo de proteccion, sino un contenido sustantivo (un mandato al legislador).

- **D)** "Un **derecho de los ciudadanos**". Falso: aunque los derechos del Capitulo II se denominan "derechos y deberes de los ciudadanos" (Seccion 2a, arts. 30-38), el art. 39 no esta en esa seccion. Esta en el Capitulo III (principios rectores), que tiene un regimen juridico distinto y menos protegido.

**Estructura del Titulo I de la CE:**

| Ubicacion | Contenido | Ejemplo |
|-----------|-----------|---------|
| Seccion 1a Cap. II (arts. 15-29) | **Derechos fundamentales** | Vida, libertad, reunion |
| Seccion 2a Cap. II (arts. 30-38) | **Derechos y deberes** | Trabajo, propiedad |
| **Cap. III (arts. 39-52)** | **Principios rectores** | Familia, salud, **paternidad** |

**Clave:** Art. 39 = Capitulo III = principio rector. No es derecho fundamental (Seccion 1a) ni derecho ciudadano (Seccion 2a).`;

  const { error: e3 } = await supabase.from("questions").update({ explanation: exp3 }).eq("id", "2a48cb26-5d38-431e-abfd-021d3117c7a4");
  console.log(e3 ? "Error 3: " + e3.message : "OK 3 - CE art.39 principio rector (" + exp3.length + " chars)");
})();
