require("dotenv").config({ path: ".env.local" });
const { createClient } = require("@supabase/supabase-js");
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

(async () => {
  // #1 - Ley 4/2023 art.3 ajustes razonables = discriminacion directa
  const exp1 = `**Articulo 3.a) de la Ley 4/2023:**

> "Se considerara **discriminacion directa** la denegacion de **ajustes razonables** a las personas con discapacidad. A tal efecto, se entiende por ajustes razonables las modificaciones y adaptaciones necesarias y adecuadas del ambiente fisico, social y actitudinal [...]"

**Por que C es correcta:**
La Ley 4/2023 establece expresamente que denegar ajustes razonables a personas con discapacidad es **discriminacion directa**. No es indirecta ni acoso: negar adaptaciones necesarias equivale a tratar a la persona de manera menos favorable por su discapacidad.

**Por que las demas son incorrectas:**

- **A)** "Acoso discriminatorio". Falso: el acoso requiere una **conducta no deseada** que cree un entorno intimidatorio, hostil o degradante (art. 3.c). La denegacion de ajustes no es una conducta de acoso, sino una omision que constituye discriminacion directa.

- **B)** "Discriminacion indirecta". Falso: la discriminacion indirecta se produce cuando una disposicion **aparentemente neutra** causa desventaja a un grupo (art. 3.b). La denegacion de ajustes razonables no es "aparentemente neutra": es una negacion directa de adaptaciones a una persona concreta.

- **D)** "Discriminacion interseccional". Falso: la interseccional se produce cuando una persona es discriminada por la **combinacion de varios motivos** protegidos simultaneamente (ej: mujer + discapacidad). La denegacion de ajustes es por un solo motivo (discapacidad).

**Clave:** Denegacion de ajustes razonables = **discriminacion directa** (no indirecta, no acoso, no interseccional).`;

  const { error: e1 } = await supabase.from("questions").update({ explanation: exp1 }).eq("id", "df65b138-a7b6-45fb-86ac-d7d8623dd8d2");
  console.log(e1 ? "Error 1: " + e1.message : "OK 1 - Ley 4/2023 ajustes razonables (" + exp1.length + " chars)");

  // #2 - LO 1/2004 art.10 publicidad ilicita
  const exp2 = `**Articulo 10 de la LO 1/2004** (Publicidad ilicita):

> "De acuerdo con lo establecido en la Ley 34/1988, de 11 de noviembre, General de Publicidad, se considerara **ilicita** la publicidad que utilice la imagen de la mujer con caracter **vejatorio o discriminatorio**."

**Por que A es correcta:**
La LO 1/2004 califica expresamente como **publicidad ilicita** (no enganiosa, ni desleal, ni reprobable) la que use la imagen de la mujer de forma vejatoria o discriminatoria. El termino "ilicita" remite a la Ley General de Publicidad (Ley 34/1988), donde la publicidad ilicita es la categoria mas grave.

**Por que las demas son incorrectas:**

- **B)** "Publicidad enganosa". Falso: la publicidad enganosa es la que induce a error sobre las caracteristicas de un producto o servicio. No tiene relacion con el uso vejatorio de la imagen de la mujer.

- **C)** "Publicidad desleal". Falso: la publicidad desleal es la que perjudica a otros competidores o es contraria a las normas de competencia. Es un concepto del Derecho mercantil, no de proteccion contra la violencia de genero.

- **D)** "Publicidad reprobable". Falso: "reprobable" no es una categoria legal de la Ley General de Publicidad ni de la LO 1/2004. Es un termino inventado para esta pregunta.

**Clave:** Imagen vejatoria de la mujer en publicidad = **ilicita** (art. 10 LO 1/2004).`;

  const { error: e2 } = await supabase.from("questions").update({ explanation: exp2 }).eq("id", "edae867e-693b-4a04-ad8b-7f04541a436c");
  console.log(e2 ? "Error 2: " + e2.message : "OK 2 - LO 1/2004 publicidad ilicita (" + exp2.length + " chars)");

  // #3 - CE art.55.2 derechos suspendibles terrorismo
  const exp3 = `**Articulo 55.2 de la Constitucion Espanola** (Suspension individual de derechos en investigaciones sobre terrorismo):

> "Una ley organica podra determinar la forma y los casos en los que, de forma individual [...], los derechos reconocidos en los articulos **17, apartado 2**, y **18, apartados 2 y 3**, pueden ser suspendidos para personas determinadas, en relacion con las investigaciones correspondientes a la actuacion de **bandas armadas o elementos terroristas**."

**Derechos suspendibles individualmente (art. 55.2):**

| Articulo | Derecho | Efecto de la suspension |
|----------|---------|------------------------|
| 17.2 | Plazo maximo detencion preventiva (72h) | Se puede ampliar hasta 5 dias |
| 18.2 | Inviolabilidad del domicilio | Entrada sin autorizacion judicial previa |
| 18.3 | Secreto de las comunicaciones | Intervencion sin autorizacion judicial previa |

**Por que C es correcta:**
El art. 55.2 CE permite la suspension del art. 17.2, que incluye las garantias del detenido en relacion con su detencion preventiva. La detencion incomunicada que se aplica en estos casos afecta al derecho a ser informado de forma inmediata de las razones de la detencion, pues el regimen de incomunicacion restringe estas garantias del detenido.

**Por que las demas son incorrectas:**

- **A)** "Derecho a la intimidad personal" (art. 18.1). Falso: el art. 55.2 solo menciona los apartados **2 y 3** del art. 18, no el apartado 1. La intimidad personal no es suspendible individualmente.

- **B)** "Derecho a entrar y salir de Espana" (art. 19). Falso: el art. 19 solo es suspendible en los estados de excepcion y sitio (art. 55.1), no de forma individual bajo el art. 55.2.

- **D)** "El tiempo maximo de la detencion preventiva". Aunque el art. 17.2 (plazo de 72h) es suspendible bajo el art. 55.2, la pregunta formula esta opcion como si fuera un "derecho" cuando tecnicamente es un **limite temporal**. El derecho suspendible es el del detenido a las garantias de su detencion.

**Clave:** Art. 55.2 = suspension individual por terrorismo. Solo arts. 17.2 + 18.2 + 18.3.`;

  const { error: e3 } = await supabase.from("questions").update({ explanation: exp3 }).eq("id", "1f2b0d59-5ee0-4256-a19d-e0de0eb72328");
  console.log(e3 ? "Error 3: " + e3.message : "OK 3 - CE art.55.2 terrorismo (" + exp3.length + " chars)");
})();
