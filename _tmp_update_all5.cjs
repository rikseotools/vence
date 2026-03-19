require("dotenv").config({ path: ".env.local" });
const { createClient } = require("@supabase/supabase-js");
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

(async () => {
  const updates = [
    {
      id: "c7448c86-98c3-4b38-ab01-f12b311935c5",
      name: "LO 3/2007 art.7",
      explanation: `**Articulo 7 de la LO 3/2007** (Acoso sexual y acoso por razon de sexo):

La pregunta pide senalar la respuesta **incorrecta**.

**C es INCORRECTA** porque dice "se considerara **acoso directo** por razon de sexo", cuando el articulo 7.4 realmente dice:

> "El condicionamiento de un derecho o de una expectativa de derecho a la aceptacion de una situacion constitutiva de acoso sexual o de acoso por razon de sexo se considerara tambien **acto de discriminacion** por razon de sexo."

La diferencia clave es: el articulo habla de **"acto de discriminacion"**, no de **"acoso directo"**. La opcion C cambia el termino juridico.

**Las demas opciones son correctas:**

- **A)** Reproduce fielmente el articulo 7.1: definicion de acoso sexual como comportamiento verbal o fisico de naturaleza sexual.

- **B)** Reproduce el articulo 7.3: el acoso sexual y el acoso por razon de sexo se consideran discriminatorios en todo caso.

- **D)** Reproduce el articulo 7.2: definicion de acoso por razon de sexo como comportamiento en funcion del sexo de una persona.

**Truco:** En preguntas de "senale la incorrecta", busca cambios sutiles de terminos. Aqui cambian "discriminacion" por "acoso directo".`
    },
    {
      id: "5e2d7489-0f5f-41bd-9763-26c819dec1df",
      name: "Ley 39/2015 art.77",
      explanation: `**Articulo 77.6 de la Ley 39/2015:**

> "Cuando la prueba consista en la emision de un informe de un organo administrativo, organismo publico o Entidad de derecho publico, se entendera que este tiene **caracter preceptivo**."

**Por que A es correcta:**
El articulo solo dice "preceptivo" (es decir, obligatorio solicitarlo). No anade "vinculante", lo que significa que el organo instructor debe pedirlo pero no esta obligado a seguir su contenido.

**Por que las demas son incorrectas:**

- **B)** "Preceptivo y vinculante" - Falso. El articulo solo dice preceptivo. Si fuera tambien vinculante, el organo estaria obligado a seguir lo que diga el informe, y eso no lo establece este articulo.

- **C)** "Potestativo y no vinculante" - Falso. "Potestativo" significa opcional, pero el articulo dice expresamente que es preceptivo (obligatorio).

- **D)** "Vinculante" - Falso. El articulo no menciona el caracter vinculante del informe.

**Clave para recordar:** Preceptivo = hay que pedirlo. Vinculante = hay que seguirlo. El art. 77.6 solo impone lo primero.`
    },
    {
      id: "92587d1c-971e-4f43-9737-f00c4dfea00d",
      name: "CE Disp.Transitoria 2",
      explanation: `**Disposicion Transitoria Segunda de la Constitucion Espanola:**

> "Los territorios que en el pasado hubiesen plebiscitado afirmativamente proyectos de Estatuto de autonomia y cuenten, al tiempo de promulgarse esta Constitucion, con regimenes provisionales de autonomia podran proceder inmediatamente en la forma que se preve en el apartado 2 del articulo 148..."

**Por que D es correcta:**
Las Comunidades que habian plebiscitado Estatutos en el pasado (Cataluna, Pais Vasco, Galicia) podian acceder a la autonomia **directamente**, sin necesidad de cumplir los requisitos de iniciativa municipal del articulo 143.2. No se les exigia ningun porcentaje de municipios.

**Por que las demas son incorrectas:**

- **A)** "3/4 partes" - Este requisito corresponde al articulo 151.1 (via rapida para comunidades sin regimen provisional previo), no a la Disposicion Transitoria Segunda.

- **B)** "2/3 partes" - Este porcentaje aparece en el articulo 143.2 como requisito general de iniciativa autonomica, pero la DT 2a exime de este tramite.

- **C)** "1/3 partes" - No corresponde a ningun requisito constitucional en materia de iniciativa autonomica.

**Clave:** La DT 2a era una "via privilegiada" para los territorios historicos que ya habian aprobado Estatutos durante la II Republica.`
    },
    {
      id: "e1885d75-103d-4a6d-ad4c-72d140835cf1",
      name: "Ley 39/2015 art.119",
      explanation: `**Articulo 119.2 de la Ley 39/2015:**

> "Cuando existiendo vicio de forma no se estime procedente resolver sobre el fondo se ordenara la **retroaccion del procedimiento al momento en el que el vicio fue cometido**, sin perjuicio de que eventualmente pueda acordarse la convalidacion de actuaciones por el organo competente para ello."

**Por que A es correcta:**
Reproduce casi literalmente el articulo 119.2: se retrotrae al momento exacto del vicio y se permite la convalidacion.

**Por que las demas son incorrectas:**

- **B)** "Declarar la inadmisibilidad" - La inadmisibilidad es otra cosa (art. 119.1). El vicio de forma no provoca inadmision, sino retroaccion para subsanarlo.

- **C)** "Retrotraer a su inicio" - El error esta en "a su inicio". El articulo dice "al momento en el que el vicio fue cometido", no al principio del procedimiento. Solo se repite desde el punto donde se produjo el error.

- **D)** "Declarar la nulidad" - No se declara nulo todo el procedimiento. Se retrotrae al punto del vicio y se permite convalidar actuaciones.

**Clave:** La diferencia entre A y C es sutil pero importante: se vuelve al momento del vicio, no al inicio. Asi se aprovechan las actuaciones anteriores al defecto.`
    },
    {
      id: "193dc6e6-f391-464c-b1f0-38a5b9a1d192",
      name: "Ley 39/2015 art.114",
      explanation: `**Articulo 114.1 de la Ley 39/2015** - Ponen fin a la via administrativa:

> a) Las resoluciones de los recursos de alzada.
> b) Las resoluciones de los procedimientos del articulo 112.2.
> c) Las resoluciones de organos sin superior jerarquico, **salvo** que una Ley diga lo contrario.
> d) Los acuerdos, pactos, convenios o contratos que **tengan** la consideracion de finalizadores.
> e) La resolucion de procedimientos de **responsabilidad patrimonial**, cualquiera que fuese el tipo de relacion.
> f) La resolucion de procedimientos **complementarios** en materia sancionadora (art. 90.4).

**Por que B es correcta:**
Reproduce fielmente el articulo 114.1.e): la resolucion de responsabilidad patrimonial pone fin a la via administrativa, sea la relacion publica o privada.

**Por que las demas son incorrectas:**

- **A)** Dice "en ningun caso" las resoluciones de organos sin superior jerarquico. Falso: el art. 114.1.c) dice que SI ponen fin, salvo que una ley establezca lo contrario. La opcion invierte el sentido.

- **C)** Dice acuerdos que "no tengan" la consideracion de finalizadores. Falso: el art. 114.1.d) dice los que SI tengan esa consideracion. La opcion cambia "tengan" por "no tengan".

- **D)** Dice procedimientos "simplificados" en materia sancionadora. Falso: el art. 114.1.f) habla de procedimientos "complementarios", no simplificados.

**Truco:** Tres trampas clasicas en esta pregunta: negar lo que el articulo afirma (A), invertir el sentido (C) y cambiar un termino clave (D).`
    }
  ];

  for (const u of updates) {
    const { error } = await supabase
      .from("questions")
      .update({ explanation: u.explanation })
      .eq("id", u.id);
    if (error) console.error("Error " + u.name + ":", error);
    else console.log("OK -", u.name, "(" + u.explanation.length + " chars)");
  }
})();
